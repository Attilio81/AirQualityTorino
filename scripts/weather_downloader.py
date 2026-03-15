"""
Scarica i dati meteo storici dall'Osservatorio Meteorologico UniTo (Torino)
e li salva nel DB SQLite.

Sorgente: https://www.meteo.dfg.unito.it/mese-{mese}-{anno}
Colonne:  Tmax, Tmin, Tmed, Prec, SRmax, SRtot, URmed, Vmed(m/s), Vmax(m/s),
          Pmax, Pmin, Pmed

Comportamento:
- Scarica solo i mesi in cui ci sono rilevazioni PM nel DB ARPA per Torino
- Per il mese corrente ri-scarica sempre (aggiorna i giorni nuovi)
- I dati storici già presenti vengono saltati

Uso:
    python weather_downloader.py                  # automatico dai mesi PM Torino
    python weather_downloader.py 2025-01 2025-03  # intervallo manuale
"""

import logging
import os
import re
import sqlite3
import ssl
import sys
import time
from datetime import date, datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

DB_FILE         = Path(__file__).parent.parent / "data" / "pm_data.db"
LOG_FILE        = Path(__file__).parent.parent / "data" / "log.txt"
REQUEST_TIMEOUT = 30
POLITE_DELAY    = 2   # secondi tra una richiesta e l'altra
CITY            = "Torino"  # unica città monitorata
BASE_URL        = "https://www.meteo.dfg.unito.it/mese-{month}-{year}"

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
# Database
# ---------------------------------------------------------------------------

def init_weather_table() -> None:
    """Crea/migra la tabella weather con schema UniTo completo."""
    with sqlite3.connect(DB_FILE) as conn:
        cols_existing = [r[1] for r in conn.execute(
            "SELECT * FROM pragma_table_info('weather')"
        ).fetchall()] if conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='weather'"
        ).fetchone() else []

        # Ricrea se mancano colonne chiave del nuovo schema
        need_recreate = bool(cols_existing) and not all(
            c in cols_existing for c in ("city", "tmed", "v_med")
        )
        if need_recreate:
            logger.info("Migrazione: ricreo tabella weather con schema UniTo")
            conn.execute("DROP TABLE weather")
            conn.commit()

        conn.execute("""
            CREATE TABLE IF NOT EXISTS weather (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                city          TEXT    NOT NULL,
                date          TEXT    NOT NULL,
                tmax          REAL,
                tmin          REAL,
                tmed          REAL,
                prec          REAL,
                sr_max        REAL,
                sr_tot        REAL,
                ur_med        REAL,
                v_med         REAL,
                v_max         REAL,
                p_max         REAL,
                p_min         REAL,
                p_med         REAL,
                downloaded_at TEXT NOT NULL,
                UNIQUE (city, date)
            )
        """)
        conn.commit()


def store_weather(rows: list[dict]) -> tuple[int, int]:
    """Inserisce/aggiorna i record meteo nel DB."""
    if not rows:
        return 0, 0
    downloaded_at = datetime.now().isoformat(timespec="seconds")
    data = [
        (
            r["city"], r["date"],
            r.get("tmax"), r.get("tmin"), r.get("tmed"),
            r.get("prec"), r.get("sr_max"), r.get("sr_tot"),
            r.get("ur_med"), r.get("v_med"), r.get("v_max"),
            r.get("p_max"), r.get("p_min"), r.get("p_med"),
            downloaded_at,
        )
        for r in rows
    ]
    with sqlite3.connect(DB_FILE) as conn:
        cursor = conn.executemany(
            """
            INSERT OR REPLACE INTO weather
                (city, date, tmax, tmin, tmed, prec, sr_max, sr_tot,
                 ur_med, v_med, v_max, p_max, p_min, p_med, downloaded_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            data,
        )
        conn.commit()
        inserted = cursor.rowcount
    return inserted, len(data) - inserted


def months_from_pm_db_for_city(city: str) -> list[tuple[int, int]]:
    """Mesi con rilevazioni PM nel DB per un dato comune."""
    if not DB_FILE.exists():
        return []
    pattern = city + " - %"
    with sqlite3.connect(DB_FILE) as conn:
        rows = conn.execute(
            """
            SELECT DISTINCT
                CAST(substr(date,1,4) AS INTEGER),
                CAST(substr(date,6,2) AS INTEGER)
            FROM measurements
            WHERE station LIKE ? OR station = ?
            ORDER BY 1,2
            """,
            (pattern, city),
        ).fetchall()
    return [(y, m) for y, m in rows]


def already_downloaded_months() -> set[tuple[int, int]]:
    """Mesi già presenti nel DB per Torino."""
    if not DB_FILE.exists():
        return set()
    with sqlite3.connect(DB_FILE) as conn:
        rows = conn.execute(
            """
            SELECT DISTINCT
                CAST(substr(date,1,4) AS INTEGER),
                CAST(substr(date,6,2) AS INTEGER)
            FROM weather WHERE city = ?
            """,
            (CITY,),
        ).fetchall()
    return {(y, m) for y, m in rows}


def _get_supabase() -> "Client | None":
    """Return Supabase client if credentials are configured, else None."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        logging.warning("Supabase credentials not set — skipping cloud sync")
        return None
    return create_client(url, key)


def _upsert_weather(records: list, supabase: "Client") -> None:
    """Upsert records to Supabase weather table on (city, date) conflict."""
    if not records:
        return
    supabase.table("weather").upsert(
        records, on_conflict="city,date"
    ).execute()
    logging.info("Supabase: upserted %d weather rows", len(records))


# ---------------------------------------------------------------------------
# Scraping UniTo
# ---------------------------------------------------------------------------

class _TableParser(HTMLParser):
    """
    Estrae le righe dalla divTable con class 'mese' usata dal sito UniTo.
    La struttura è:
      <div class="divTable mese">
        <div class="divTableBody">
          <div class="divTableRow">
            <div class="divTableHead">...</div>
            <div class="divTableCell ...">...</div>
          </div>
        </div>
      </div>
    Usa uno stack per tracciare il contesto corrente in modo corretto.
    """
    def __init__(self):
        super().__init__()
        # stack entries: "table" | "body" | "row" | "cell" | "other"
        self._stack: list[str] = []
        self.rows: list[list[str]] = []
        self._current_row: list[str] = []
        self._current_cell: list[str] = []

    @staticmethod
    def _get_class(attrs) -> str:
        return dict(attrs).get("class", "")

    def handle_starttag(self, tag, attrs):
        if tag != "div":
            return
        cls = self._get_class(attrs)
        if "table" not in self._stack:
            if "divTable" in cls and "mese" in cls:
                self._stack.append("table")
            return
        if "divTableBody" in cls:
            self._stack.append("body")
        elif "divTableRow" in cls:
            self._current_row = []
            self._stack.append("row")
        elif "divTableCell" in cls or "divTableHead" in cls:
            self._current_cell = []
            self._stack.append("cell")
        else:
            self._stack.append("other")

    def handle_endtag(self, tag):
        if tag != "div" or "table" not in self._stack:
            return
        ctx = self._stack.pop()
        if ctx == "cell":
            self._current_row.append(" ".join(self._current_cell).strip())
        elif ctx == "row":
            if self._current_row:
                self.rows.append(self._current_row)

    def handle_data(self, data):
        if self._stack and self._stack[-1] == "cell":
            text = data.strip()
            if text:
                self._current_cell.append(text)


def _to_f(s: str):
    """Converte stringa in float; estrae il primo numero se formato '1.4 (5.0)'."""
    if not s:
        return None
    m = re.match(r"[-+]?[0-9]*\.?[0-9]+", s.strip())
    if not m:
        return None
    try:
        return float(m.group())
    except ValueError:
        return None


def fetch_month(year: int, month: int) -> list[dict]:
    """
    Scarica la pagina UniTo per anno/mese e restituisce lista di dict con
    i dati giornalieri:
    {city, date, tmax, tmin, tmed, prec, sr_max, sr_tot, ur_med,
     v_med, v_max, p_max, p_min, p_med}
    """
    url = BASE_URL.format(month=month, year=year)
    logger.info("[meteo] GET %s", url)

    req = Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    _ssl_ctx = ssl.create_default_context()
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = ssl.CERT_NONE
    try:
        raw = urlopen(req, timeout=REQUEST_TIMEOUT, context=_ssl_ctx).read().decode("utf-8", "replace")
    except URLError as exc:
        logger.error("[meteo] Rete: %s", exc)
        return []
    except Exception as exc:
        logger.error("[meteo] Errore: %s", exc, exc_info=True)
        return []

    parser = _TableParser()
    parser.feed(raw)

    if len(parser.rows) < 2:
        logger.warning("[meteo] Tabella non trovata per %d/%02d", year, month)
        return []

    # Prima riga = header, le successive = dati giornalieri
    # Colonne: giorno Tmax Tmin Tmed Prec SRmax SRtot URmed Vmed Vmax Pmax Pmin Pmed
    records = []
    for row in parser.rows[1:]:
        if len(row) < 13:
            continue
        day_s = re.sub(r"\D", "", row[0])
        if not day_s:
            continue
        try:
            day_date = date(year, month, int(day_s)).isoformat()
        except ValueError:
            continue
        records.append({
            "city":   CITY,
            "date":   day_date,
            "tmax":   _to_f(row[1]),
            "tmin":   _to_f(row[2]),
            "tmed":   _to_f(row[3]),
            "prec":   _to_f(row[4]),
            "sr_max": _to_f(row[5]),
            "sr_tot": _to_f(row[6]),
            "ur_med": _to_f(row[7]),
            "v_med":  _to_f(row[8]),   # es. "1.4 (5.0)" → 1.4 m/s
            "v_max":  _to_f(row[9]),
            "p_max":  _to_f(row[10]),
            "p_min":  _to_f(row[11]),
            "p_med":  _to_f(row[12]),
        })

    logger.info("[meteo] %d/%02d → %d giorni", year, month, len(records))
    return records


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def parse_ym(s: str) -> tuple[int, int]:
    parts = s.split("-")
    return int(parts[0]), int(parts[1])


def main() -> None:
    init_weather_table()

    today      = date.today()
    current_ym = (today.year, today.month)

    # Determina i mesi da scaricare
    if len(sys.argv) == 3:
        start_ym = parse_ym(sys.argv[1])
        end_ym   = parse_ym(sys.argv[2])
        months: list[tuple[int, int]] = []
        y, mo = start_ym
        while (y, mo) <= end_ym:
            months.append((y, mo))
            mo += 1
            if mo > 12:
                mo = 1
                y += 1
    else:
        months = months_from_pm_db_for_city(CITY)
        if not months:
            logger.error("Nessun mese Torino nel DB PM. Esegui downloader.py prima.")
            sys.exit(1)

    done = already_downloaded_months()

    logger.info("=" * 60)
    logger.info("[%s] %d mesi da verificare", CITY, len(months))

    sb = _get_supabase()

    # Mesi già in Supabase (per non ri-uppare inutilmente)
    supabase_months: set[tuple[int, int]] = set()
    if sb:
        try:
            res = sb.table("weather").select("date").eq("city", CITY).execute()
            for r in (res.data or []):
                d = r["date"][:7]  # YYYY-MM
                y, m = int(d[:4]), int(d[5:7])
                supabase_months.add((y, m))
        except Exception as exc:
            logging.warning("Supabase: impossibile leggere mesi presenti: %s", exc)

    total_ins = total_skip = 0
    for ym in months:
        already_in_sqlite = ym in done and ym != current_ym
        already_in_supabase = ym in supabase_months and ym != current_ym

        if already_in_sqlite and already_in_supabase:
            logger.debug("[%s] %d/%02d già presente in SQLite e Supabase, skip", CITY, *ym)
            continue

        if already_in_sqlite and not already_in_supabase:
            # Leggi da SQLite e upserta su Supabase senza ri-scaricare dal web
            logger.info("[%s] %d/%02d già in SQLite, upsert su Supabase", CITY, *ym)
            with sqlite3.connect(DB_FILE) as conn:
                rows_raw = conn.execute(
                    "SELECT city,date,tmax,tmin,tmed,prec,sr_max,sr_tot,"
                    "ur_med,v_med,v_max,p_max,p_min,p_med FROM weather "
                    "WHERE city=? AND substr(date,1,7)=?",
                    (CITY, f"{ym[0]}-{ym[1]:02d}"),
                ).fetchall()
            cols = ["city","date","tmax","tmin","tmed","prec","sr_max","sr_tot",
                    "ur_med","v_med","v_max","p_max","p_min","p_med"]
            rows = [dict(zip(cols, r)) for r in rows_raw]
            if sb and rows:
                try:
                    _upsert_weather(rows, sb)
                except Exception as exc:
                    logging.error("Supabase weather upsert failed: %s", exc)
            continue

        rows = fetch_month(*ym)
        if rows:
            ins, sk = store_weather(rows)
            total_ins  += ins
            total_skip += sk
            logger.info("[%s] %d/%02d → +%d inseriti", CITY, ym[0], ym[1], ins)
            if sb:
                try:
                    _upsert_weather(rows, sb)
                except Exception as exc:
                    logging.error("Supabase weather upsert failed: %s", exc)
        time.sleep(POLITE_DELAY)

    logger.info("-" * 60)
    logger.info("FINE — inseriti/aggiornati: %d, invariati: %d", total_ins, total_skip)
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
