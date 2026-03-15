"""
Importa i CSV storici in Supabase.

Formato CSV atteso:
  stazione, <date1>, <date2>, ...
  Torino - Via della Consolata, 45, 38, ...

Uso:
    python import_csv.py
"""

import csv
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

CSV_FILES = {
    "PM10": Path(__file__).parent / "Dati Vecchi da importare" / "tabella_PM10.csv",
    "PM25": Path(__file__).parent / "Dati Vecchi da importare" / "tabella_PM2.5 (2).csv",
}

BATCH_SIZE = 500


def read_csv(path: Path, pollutant: str) -> list[dict]:
    """Legge il CSV wide-format e restituisce lista di record long-format."""
    records = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader)
        dates = header[1:]  # prima colonna = "stazione"

        for row in reader:
            if not row:
                continue
            station = row[0].strip()
            if not station:
                continue
            for i, date in enumerate(dates):
                raw = row[i + 1].strip() if i + 1 < len(row) else ""
                if not raw:
                    continue
                try:
                    value = float(raw)
                except ValueError:
                    continue
                records.append({
                    "station": station,
                    "date": date,
                    "pollutant": pollutant,
                    "value": value,
                })
    return records


def upsert_batch(sb, records: list[dict]) -> None:
    sb.table("measurements").upsert(
        records, on_conflict="station,date,pollutant"
    ).execute()


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERRORE: SUPABASE_URL o SUPABASE_SERVICE_KEY non configurati in .env")
        return

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    for pollutant, path in CSV_FILES.items():
        if not path.exists():
            print(f"[{pollutant}] File non trovato: {path}")
            continue

        records = read_csv(path, pollutant)
        print(f"[{pollutant}] {len(records)} righe lette da {path.name}")

        for i in range(0, len(records), BATCH_SIZE):
            batch = records[i:i + BATCH_SIZE]
            upsert_batch(sb, batch)
            print(f"[{pollutant}] Upserted {i + len(batch)}/{len(records)}")

        print(f"[{pollutant}] Completato.")

    print("Importazione terminata.")


if __name__ == "__main__":
    main()
