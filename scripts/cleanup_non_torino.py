"""
Elimina da Supabase tutte le misurazioni di stazioni non di Torino.
Conserva solo le righe dove 'station' contiene 'Torino'.

Uso:
    python cleanup_non_torino.py
"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERRORE: SUPABASE_URL o SUPABASE_SERVICE_KEY non configurati in .env")
        return

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Conta prima
    res = sb.table("measurements").select("station", count="exact").not_.ilike("station", "%torino%").execute()
    count = res.count
    print(f"Righe non-Torino trovate: {count}")

    if count == 0:
        print("Niente da eliminare.")
        return

    confirm = input(f"Eliminare {count} righe? (s/N): ").strip().lower()
    if confirm != 's':
        print("Annullato.")
        return

    # Elimina tutte le righe dove station NON contiene 'Torino' (case-insensitive)
    sb.table("measurements").delete().not_.ilike("station", "%torino%").execute()
    print(f"Eliminazione completata.")


if __name__ == "__main__":
    main()
