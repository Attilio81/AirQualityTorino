# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Air quality monitoring application for Piedmont, Italy. Downloads PM10/PM2.5 data from Arpa Piemonte's API, optionally correlates with weather data from UniTo's meteorological observatory, stores everything in SQLite, and visualizes it via a Streamlit dashboard. (The repository name "InstagramClaw" is unrelated to the project's purpose.)

## Commands

```bash
# Install dependencies (dashboard only — downloader uses stdlib)
pip install -r requirements.txt

# Download PM10/PM2.5 data → saves to downloads/*.csv and pm_data.db
python downloader.py

# Download weather data (auto-detects months with PM measurements)
python weather_downloader.py
# Or specify date range:
python weather_downloader.py 2025-01 2025-03

# Launch the Streamlit dashboard
streamlit run dashboard.py

# Clean up non-Torino records and VACUUM the database
python db_cleanup.py

# Windows: install deps + launch downloader + dashboard in separate windows
start.bat
```

## Architecture

### Data Pipeline

```
Arpa Piemonte API (JSON)
  └─ downloader.py → downloads/PM*_Piemonte_YYYYMMDD.csv + pm_data.db (measurements table)

UniTo Meteorological Observatory (HTML)
  └─ weather_downloader.py → pm_data.db (weather table)

pm_data.db
  └─ dashboard.py (Streamlit UI with filters, KPIs, charts, PM↔weather correlations)
```

### Module Responsibilities

| File | Role |
|------|------|
| `downloader.py` | Fetches PM10/PM2.5 JSON, pivots station×date matrix, saves CSV + SQLite. Retries 3× with 5-min wait on failure. |
| `weather_downloader.py` | Scrapes UniTo HTML tables, parses divTable structure with a custom `HTMLParser` subclass. 2s polite delay between requests. SSL verification disabled for UniTo cert. |
| `dashboard.py` | Streamlit app; caches DB queries for 300s. Renders filters, KPIs, time series, pivot table, and scatter plots (PM vs weather variables). |
| `db_cleanup.py` | Deletes non-Torino rows from both tables, then VACUUMs. |

### Database Schema

```sql
measurements (id, pollutant TEXT, station TEXT, date TEXT, value REAL, downloaded_at TEXT)
  UNIQUE (pollutant, station, date)   -- INSERT OR IGNORE for idempotency

weather (id, city TEXT, date TEXT, tmax, tmin, tmed, prec, sr_max, sr_tot,
         ur_med, v_med, v_max, p_max, p_min, p_med REAL, downloaded_at TEXT)
  UNIQUE (city, date)                 -- INSERT OR REPLACE for monthly refresh
```

Dates are stored as `YYYY-MM-DD` strings. All modules open the DB via `with sqlite3.connect(DB_FILE)`.

### External Data Sources

- **PM data**: `https://www.arpa.piemonte.it/rischi_naturali/data/qa/pm10/pm10.json` and `.../pm25/pm25.json`
- **Weather**: `https://www.meteo.dfg.unito.it/mese-{month}-{year}` (monthly HTML pages)

### Key Implementation Notes

- Downloader uses only Python stdlib (`urllib`, `csv`, `json`, `sqlite3`, `logging`). No `requests`.
- CSV output is UTF-8 with BOM (`utf-8-sig`) for Excel compatibility on Windows.
- `CITY_FILTER = "Torino"` is hardcoded in each module — change in all four files if targeting a different city.
- Scheduling: Windows Task Scheduler (documented in README.md with PowerShell setup) or cron on Linux/macOS.
