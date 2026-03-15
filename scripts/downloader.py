"""
Automazione Download Dati PM10 / PM2.5 - Arpa Piemonte
Scarica quotidianamente i dati PM10 e PM2.5 dall API JSON di Arpa Piemonte,
li salva come CSV con timestamp e archivia solo i record mancanti nel DB SQLite.

Uso: python downloader.py
"""

import csv
import json
import logging
import os
import sqlite3
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# --- Configurazione globale ---
DOWNLOAD_DIR = Path(__file__).parent.parent / "downloads"
DB_FILE      = Path(__file__).parent.parent / "data" / "pm_data.db"
LOG_FILE     = Path(__file__).parent.parent / "data" / "log.txt"

MAX_RETRIES        = 3
RETRY_WAIT_SECONDS = 5 * 60  # 5 minuti
REQUEST_TIMEOUT    = 30       # secondi

CITY_FILTER = "Torino"  # scarica solo le stazioni di questa città


@dataclass
class Pollutant:
    """Descrittore di un inquinante da scaricare."""
    label: str     # Es. "PM10"
    json_url: str  # URL dell endpoint JSON


POLLUTANTS = [
    Pollutant(
        label="PM10",
        json_url="https://www.arpa.piemonte.it/rischi_naturali/data/qa/pm10/pm10.json",
    ),
    Pollutant(
        label="PM25",
        json_url="https://www.arpa.piemonte.it/rischi_naturali/data/qa/pm25/pm25.json",
    ),
]

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def _get_supabase() -> "Client | None":
    """Return Supabase client if credentials are configured, else None."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        logging.warning("Supabase credentials not set — skipping cloud sync")
        return None
    return create_client(url, key)


def _upsert_measurements(records: list, supabase: "Client") -> None:
    """Upsert records to Supabase measurements table."""
    if not records:
        return
    rows = [
        {
            "pollutant": r["pollutant"],
            "station":   r["station"],
            "date":      r["date"],
            "value":     r["value"],
            "downloaded_at": r["downloaded_at"],
        }
        for r in records
    ]
    supabase.table("measurements").upsert(
        rows, on_conflict="pollutant,station,date"
    ).execute()
    logging.info("Supabase: upserted %d measurement rows", len(rows))


def _upsert_stations(api_records: list, pollutant: str, supabase: "Client") -> None:
    """Upsert station coordinates from Arpa API JSON records.
    One row per station; pollutants[] merged with existing values.
    Coordinates come from lat/lon/nome_stazione fields in the Arpa JSON.
    Falls back to denominazione_stazione when nome_stazione is absent.
    """
    seen: dict = {}
    for r in api_records:
        name = r.get("nome_stazione") or r.get("denominazione_stazione") or r.get("station")
        lat  = r.get("lat")
        lon  = r.get("lon")
        if not name or lat is None or lon is None:
            continue
        if name not in seen:
            seen[name] = {"name": name, "lat": lat, "lon": lon, "pollutants": [pollutant]}
        elif pollutant not in seen[name]["pollutants"]:
            seen[name]["pollutants"].append(pollutant)

    if not seen:
        logging.warning("Supabase: no station coordinates found in API response")
        return

    # Read existing pollutants to merge without duplicates
    existing = (
        supabase.table("stations")
        .select("name,pollutants")
        .in_("name", list(seen.keys()))
        .execute()
        .data or []
    )
    existing_map = {row["name"]: set(row.get("pollutants") or []) for row in existing}

    rows = []
    for name, info in seen.items():
        merged = existing_map.get(name, set()) | set(info["pollutants"])
        rows.append({**info, "pollutants": sorted(merged)})

    supabase.table("stations").upsert(rows, on_conflict="name").execute()
    logging.info("Supabase: upserted %d station rows", len(rows))


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

def ensure_download_dir() -> None:
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Database SQLite
# ---------------------------------------------------------------------------

def init_db() -> None:
    """Crea la tabella se non esiste gia."""
    with sqlite3.connect(DB_FILE) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS measurements (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                pollutant     TEXT    NOT NULL,
                station       TEXT    NOT NULL,
                date          TEXT    NOT NULL,
                value         REAL,
                downloaded_at TEXT    NOT NULL,
                UNIQUE (pollutant, station, date)
            )
        """)
        conn.commit()


def store_new_records(pollutant_label: str, records: list) -> tuple:
    """
    Inserisce nel DB solo i record validati che non esistono gia.
    Usa INSERT OR IGNORE: se la coppia (pollutant, station, date) e gia
    presente viene saltata silenziosamente.

    Returns (inserted, skipped).
    """
    validated = [
        r for r in records
        if r.get("flag_gestore_sistema") == "0"
        and r.get("denominazione_stazione", "").startswith(CITY_FILTER)
    ]
    if not validated:
        return 0, 0

    downloaded_at = datetime.now().isoformat(timespec="seconds")
    rows = [
        (
            pollutant_label,
            r["denominazione_stazione"],
            r["data"],
            r["valore_validato"],
            downloaded_at,
        )
        for r in validated
    ]

    with sqlite3.connect(DB_FILE) as conn:
        cursor = conn.executemany(
            """
            INSERT OR IGNORE INTO measurements
                (pollutant, station, date, value, downloaded_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            rows,
        )
        conn.commit()
        inserted = cursor.rowcount

    skipped = len(rows) - inserted
    return inserted, skipped


# ---------------------------------------------------------------------------
# Fetch & CSV
# ---------------------------------------------------------------------------

def fetch_json(url: str) -> list:
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def pivot_to_csv(records: list) -> tuple:
    """
    Pivotta i record JSON in una tabella stazione x data.
    Considera solo i dati validati (flag_gestore_sistema == "0").
    Returns (header_columns, rows_as_dicts).
    """
    validated = [
        r for r in records
        if r.get("flag_gestore_sistema") == "0"
        and r.get("denominazione_stazione", "").startswith(CITY_FILTER)
    ]
    if not validated:
        return [], []

    dates = sorted({r["data"] for r in validated}, reverse=True)
    header = ["stazione"] + dates

    station_order = []
    seen = set()
    for r in validated:
        s = r["denominazione_stazione"]
        if s not in seen:
            station_order.append(s)
            seen.add(s)

    rows = []
    for station in station_order:
        row = {"stazione": station}
        for r in validated:
            if r["denominazione_stazione"] == station:
                val = r["valore_validato"]
                row[r["data"]] = round(val) if val is not None else ""
        rows.append(row)

    return header, rows


# ---------------------------------------------------------------------------
# Download singolo inquinante
# ---------------------------------------------------------------------------

def download_pollutant(pollutant: Pollutant, attempt: int) -> bool:
    logger.info("[%s] Tentativo %d/%d - fetch JSON.", pollutant.label, attempt, MAX_RETRIES)

    try:
        records = fetch_json(pollutant.json_url)
    except URLError as exc:
        logger.error("[%s] Errore di rete: %s", pollutant.label, exc)
        return False
    except Exception as exc:
        logger.error("[%s] Errore imprevisto: %s", pollutant.label, exc, exc_info=True)
        return False

    header, rows = pivot_to_csv(records)
    if not rows:
        logger.warning("[%s] Nessun dato validato trovato. Download annullato.", pollutant.label)
        return False

    logger.info("[%s] %d stazioni, %d date.", pollutant.label, len(rows), len(header) - 1)

    # Salva CSV giornaliero
    today = datetime.now().strftime("%Y%m%d")
    dest_path = DOWNLOAD_DIR / f"{pollutant.label}_Piemonte_{today}.csv"
    with open(dest_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=header, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    logger.info("[%s] CSV salvato: %s", pollutant.label, dest_path)

    # Inserisce solo i record mancanti nel DB
    inserted, skipped = store_new_records(pollutant.label, records)
    logger.info(
        "[%s] DB: %d nuovi record inseriti, %d gia presenti e saltati.",
        pollutant.label, inserted, skipped,
    )

    # Supabase cloud sync (non-fatal)
    sb = _get_supabase()
    if sb:
        try:
            # Build new_records in the shape _upsert_measurements expects,
            # mirroring the filter used in store_new_records.
            downloaded_at = datetime.now().isoformat(timespec="seconds")
            new_records = [
                {
                    "pollutant": pollutant.label,
                    "station":   r["denominazione_stazione"],
                    "date":      r["data"],
                    "value":     r["valore_validato"],
                    "downloaded_at": downloaded_at,
                }
                for r in records
                if r.get("flag_gestore_sistema") == "0"
                and r.get("denominazione_stazione", "").startswith(CITY_FILTER)
            ]
            _upsert_measurements(new_records, sb)
            _upsert_stations(records, pollutant.label, sb)
        except Exception as exc:
            logging.error("Supabase upsert failed: %s", exc)
            # Non-fatal: SQLite is source of truth

    return True


def run_with_retry(pollutant: Pollutant) -> bool:
    for attempt in range(1, MAX_RETRIES + 1):
        if download_pollutant(pollutant, attempt):
            return True
        if attempt < MAX_RETRIES:
            logger.warning(
                "[%s] Nuovo tentativo tra %d minuti...",
                pollutant.label, RETRY_WAIT_SECONDS // 60,
            )
            time.sleep(RETRY_WAIT_SECONDS)
    return False


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    ensure_download_dir()
    init_db()
    logger.info("=" * 60)
    logger.info("Avvio - %s", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    results = {}
    for pollutant in POLLUTANTS:
        results[pollutant.label] = run_with_retry(pollutant)

    logger.info("-" * 60)
    for label, success in results.items():
        if success:
            logger.info("ESITO [%s]: SUCCESSO", label)
        else:
            logger.error("ESITO [%s]: ERRORE - fallito dopo %d tentativi.", label, MAX_RETRIES)
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
