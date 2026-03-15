# Air Quality Torino

Monitoraggio qualità dell'aria per Torino — dati PM10/PM2.5 da Arpa Piemonte con correlazione meteo UniTo, visualizzati tramite una web app React deployata su Vercel.

---

## Struttura del Progetto

```
AirQualityTorino/
├── scripts/                      # Pipeline dati Python
│   ├── downloader.py             # Scarica PM10/PM2.5 da Arpa Piemonte
│   ├── weather_downloader.py     # Scarica meteo da UniTo
│   ├── import_csv.py             # Importa CSV storici in Supabase
│   ├── db_cleanup.py             # Pulizia database SQLite locale
│   └── cleanup_non_torino.py     # Rimuove dati non-Torino da Supabase
├── frontend/                     # App React + Vite (deploy su Vercel)
├── supabase/                     # Migrazioni database Supabase
├── downloads/                    # CSV generati automaticamente
├── data/                         # Database SQLite locale e log
├── requirements.txt              # Dipendenze Python
├── start_sync.bat                # Avvio sync completo su Windows
└── start_local.bat               # Avvio frontend locale su Windows
```

---

## Setup

### Python (pipeline dati)

```bash
pip install -r requirements.txt
```

Crea un file `.env` nella root (vedi `.env.example`):

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your_anon_key
```

### Frontend

```bash
cd frontend
npm install
npm run dev      # sviluppo locale → http://localhost:5173
npm run build    # build produzione
```

---

## Comandi

```bash
# Scarica dati PM10/PM2.5 → downloads/*.csv e data/pm_data.db
python scripts/downloader.py

# Scarica dati meteo (auto-detect mesi con misurazioni PM)
python scripts/weather_downloader.py
# Oppure specifica intervallo:
python scripts/weather_downloader.py 2025-01 2025-03

# Importa CSV storici in Supabase
python scripts/import_csv.py

# Pulizia database locale (rimuovi record non-Torino + VACUUM)
python scripts/db_cleanup.py

# Rimuovi dati non-Torino da Supabase
python scripts/cleanup_non_torino.py

# Windows: sync completo (PM + meteo)
start_sync.bat

# Windows: avvia frontend locale
start_local.bat
```

---

## Pianificazione Automatica (Windows Task Scheduler)

```powershell
$taskName   = "AirQualityTorino_Sync"
$pythonExe  = "C:\Python314\python.exe"
$scriptPath = "C:\Users\attil\OneDrive\Documenti\GitHub\AirQualityTorino\scripts\downloader.py"
$workDir    = "C:\Users\attil\OneDrive\Documenti\GitHub\AirQualityTorino"

$action  = New-ScheduledTaskAction -Execute $pythonExe -Argument $scriptPath -WorkingDirectory $workDir
$trigger = New-ScheduledTaskTrigger -Daily -At "08:00"
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -RunLevel Highest -Force
```

### Linux / macOS (cron)

```cron
0 8 * * * /usr/bin/python3 /path/to/AirQualityTorino/scripts/downloader.py
```

---

## Architettura

```
Arpa Piemonte API (JSON)
  └─ scripts/downloader.py → downloads/*.csv + data/pm_data.db + Supabase

UniTo Osservatorio Meteo (HTML)
  └─ scripts/weather_downloader.py → data/pm_data.db + Supabase

Supabase (PostgreSQL)
  └─ frontend/ (React + Vite → Vercel)
```

### Schema database SQLite

```sql
measurements (id, pollutant TEXT, station TEXT, date TEXT, value REAL, downloaded_at TEXT)
  UNIQUE (pollutant, station, date)   -- INSERT OR IGNORE per idempotenza

weather (id, city TEXT, date TEXT, tmax, tmin, tmed, prec, sr_max, sr_tot,
         ur_med, v_med, v_max, p_max, p_min, p_med REAL, downloaded_at TEXT)
  UNIQUE (city, date)                 -- INSERT OR REPLACE per refresh mensile
```

---

## Sorgenti Dati

| Fonte | URL |
|-------|-----|
| PM10 | `https://www.arpa.piemonte.it/rischi_naturali/data/qa/pm10/pm10.json` |
| PM2.5 | `https://www.arpa.piemonte.it/rischi_naturali/data/qa/pm25/pm25.json` |
| Meteo | `https://www.meteo.dfg.unito.it/mese-{mese}-{anno}` |

---

## Troubleshooting

| Problema | Soluzione |
|----------|-----------|
| `URLError` | Il sito è irraggiungibile; il downloader ritenta automaticamente 3 volte con 5 min di attesa |
| CSV vuoto | L'endpoint JSON potrebbe non avere ancora dati validati per oggi |
| Errore SSL meteo | Il certificato UniTo è self-signed — la verifica SSL è disabilitata di proposito |
