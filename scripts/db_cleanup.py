"""
Pulizia del database pm_data.db:
- Rimuove dalla tabella measurements tutte le stazioni NON di Torino
- Rimuove dalla tabella weather eventuali righe con city != 'Torino'
- Esegue VACUUM per ridurre le dimensioni del file

Uso: python db_cleanup.py
"""

import sqlite3
from pathlib import Path

DB_FILE     = Path(__file__).parent.parent / "data" / "pm_data.db"
CITY_FILTER = "Torino"


def main() -> None:
    if not DB_FILE.exists():
        print("Database non trovato:", DB_FILE)
        return

    with sqlite3.connect(DB_FILE) as conn:
        # --- Stato prima ---
        m_tot = conn.execute("SELECT COUNT(*) FROM measurements").fetchone()[0]
        stations = conn.execute(
            "SELECT DISTINCT station FROM measurements ORDER BY station"
        ).fetchall()
        print(f"measurements: {m_tot} righe, {len(stations)} stazioni")

        non_torino = [s[0] for s in stations if not s[0].startswith(CITY_FILTER)]
        print(f"Stazioni NON '{CITY_FILTER}' da rimuovere: {len(non_torino)}")
        for s in non_torino:
            print(f"  - {s}")

        if non_torino:
            cursor = conn.execute(
                f"DELETE FROM measurements WHERE station NOT LIKE '{CITY_FILTER} - %' AND station != ?",
                (CITY_FILTER,),
            )
            conn.commit()
            print(f"\nEliminate {cursor.rowcount} righe da measurements.")
        else:
            print("Nessuna riga da eliminare in measurements.")

        # --- Pulizia weather ---
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()]
        if "weather" in tables:
            w_tot = conn.execute("SELECT COUNT(*) FROM weather").fetchone()[0]
            print(f"\nweather: {w_tot} righe")
            cursor = conn.execute(
                "DELETE FROM weather WHERE city != ?", (CITY_FILTER,)
            )
            conn.commit()
            if cursor.rowcount:
                print(f"Eliminate {cursor.rowcount} righe da weather (city != '{CITY_FILTER}').")
            else:
                print("Nessuna riga da eliminare in weather.")

        # --- VACUUM ---
        print("\nEseguo VACUUM...")
        conn.execute("VACUUM")
        print("VACUUM completato.")

    size_mb = DB_FILE.stat().st_size / 1024 / 1024
    print(f"\nDimensione DB finale: {size_mb:.2f} MB")
    print("Pulizia completata.")


if __name__ == "__main__":
    main()
