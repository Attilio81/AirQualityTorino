# Reorganization + Vercel Deploy Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize project into scripts/ and data/ folders, remove Streamlit, deploy frontend to Vercel, push to GitHub.

**Architecture:** Python scripts move to `scripts/`, runtime data to `data/`. Frontend (React/Vite) deployed to Vercel. Git repo initialized and pushed to `https://github.com/Attilio81/AirQualityTorino.git`.

**Tech Stack:** Python 3.14, React 19 + Vite 8 + MUI, Supabase, Vercel CLI

---

## Chunk 1: File Reorganization

### Task 1: Create folder structure and move Python scripts

**Files:**
- Create: `scripts/` directory
- Move: `downloader.py` → `scripts/downloader.py`
- Move: `weather_downloader.py` → `scripts/weather_downloader.py`
- Move: `import_csv.py` → `scripts/import_csv.py`
- Move: `db_cleanup.py` → `scripts/db_cleanup.py`
- Move: `cleanup_non_torino.py` → `scripts/cleanup_non_torino.py`

- [ ] **Step 1: Create scripts/ directory**

```bash
mkdir -p scripts
```

- [ ] **Step 2: Move all Python scripts**

```bash
mv downloader.py scripts/
mv weather_downloader.py scripts/
mv import_csv.py scripts/
mv db_cleanup.py scripts/
mv cleanup_non_torino.py scripts/
```

- [ ] **Step 3: Verify scripts are in place**

```bash
ls scripts/
```
Expected: 5 Python files listed.

---

### Task 2: Create data/ directory and move runtime files

**Files:**
- Create: `data/` directory
- Move: `pm_data.db` → `data/pm_data.db` (if present)
- Move: `log.txt` → `data/log.txt` (if present)

- [ ] **Step 1: Create data/ directory**

```bash
mkdir -p data
```

- [ ] **Step 2: Move db and log**

```bash
[ -f pm_data.db ] && mv pm_data.db data/
[ -f log.txt ] && mv log.txt data/
```

- [ ] **Step 3: Verify**

```bash
ls data/
```

---

### Task 3: Delete Streamlit dashboard and pycache

**Files:**
- Delete: `dashboard.py`
- Delete: `__pycache__/` (entire directory)

- [ ] **Step 1: Delete dashboard.py**

```bash
rm dashboard.py
```

- [ ] **Step 2: Delete __pycache__**

```bash
rm -rf __pycache__
```

---

### Task 4: Update batch files with new paths

**Files:**
- Modify: `start.bat` — remove Streamlit, update downloader path
- Modify: `start_sync.bat` — update Python script paths

- [ ] **Step 1: Rewrite start.bat** (remove Streamlit reference, point to scripts/)

Replace content of `start.bat`:
```bat
@echo off
title AirQuality Torino - Avvio
cd /d "%~dp0"

set "PY_SCRIPTS=%APPDATA%\Python\Python314\Scripts"
if exist "%PY_SCRIPTS%" set "PATH=%PY_SCRIPTS%;%PATH%"

echo [1/2] Installazione dipendenze...
pip install -r requirements.txt --quiet

echo [2/2] Avvio downloader...
start "Downloader" python scripts/downloader.py

echo.
echo Downloader avviato. Chiudi questa finestra se vuoi.
pause
```

- [ ] **Step 2: Rewrite start_sync.bat** (update paths to scripts/)

Replace content of `start_sync.bat`:
```bat
@echo off
echo ============================================================
echo  AirQuality Torino - Sync Supabase
echo  %date% %time%
echo ============================================================

cd /d "%~dp0"

echo [1/2] Download PM10 e PM25...
C:/Python314/python.exe scripts/downloader.py
if errorlevel 1 echo [ATTENZIONE] downloader.py ha restituito un errore

echo.
echo [2/2] Download meteo...
C:/Python314/python.exe scripts/weather_downloader.py
if errorlevel 1 echo [ATTENZIONE] weather_downloader.py ha restituito un errore

echo.
echo ============================================================
echo  Sync completato - %time%
echo ============================================================
pause
```

---

### Task 5: Update .gitignore for new paths

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Update .gitignore paths**

Replace `pm_data.db` with `data/pm_data.db` and `log.txt` with `data/log.txt`:

```
.env
data/pm_data.db
data/log.txt
downloads/
__pycache__/
*.pyc
frontend/node_modules/
frontend/.env
```

---

## Chunk 2: Python Script Path Updates

### Task 6: Update DB_FILE path in all Python scripts

Each script references `pm_data.db` directly. Since it moves to `data/pm_data.db`, and scripts now run from root (or `scripts/`), the path must be relative to root.

**Files:**
- Modify: `scripts/downloader.py`
- Modify: `scripts/weather_downloader.py`
- Modify: `scripts/import_csv.py`
- Modify: `scripts/db_cleanup.py`
- Modify: `scripts/cleanup_non_torino.py`

- [ ] **Step 1: Check current DB_FILE definition in each script**

```bash
grep -n "DB_FILE\|pm_data.db\|log.txt\|downloads" scripts/*.py
```

- [ ] **Step 2: Update DB_FILE to use path relative to script location**

In each script that has `DB_FILE = "pm_data.db"`, replace with:

```python
import os
DB_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "pm_data.db")
```

- [ ] **Step 3: Update log file path in downloader.py (if hardcoded)**

```python
LOG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "log.txt")
```

- [ ] **Step 4: Update downloads/ output path in downloader.py (if hardcoded)**

```python
DOWNLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "downloads")
```

- [ ] **Step 5: Verify scripts parse without error**

```bash
python -c "import ast; [ast.parse(open(f).read()) for f in __import__('glob').glob('scripts/*.py')]" && echo OK
```

---

## Chunk 3: README

### Task 7: Rewrite README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write new README.md**

```markdown
# Air Quality Torino

Monitoraggio qualità dell'aria per Torino — dati PM10/PM2.5 da Arpa Piemonte con correlazione meteo UniTo.

## Struttura del Progetto

```
AirQualityTorino/
├── scripts/                    # Pipeline dati Python
│   ├── downloader.py           # Scarica PM10/PM2.5 da Arpa Piemonte
│   ├── weather_downloader.py   # Scarica meteo da UniTo
│   ├── import_csv.py           # Importa CSV storici
│   ├── db_cleanup.py           # Pulizia database
│   └── cleanup_non_torino.py   # Rimuove dati non-Torino
├── frontend/                   # App React + Vite (Vercel)
├── supabase/                   # Migrazioni database
├── downloads/                  # CSV generati automaticamente
├── data/                       # Database SQLite e log
├── requirements.txt            # Dipendenze Python
└── start_sync.bat              # Avvio sync su Windows
```

## Setup

### Python (pipeline dati)

```bash
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
npm run dev      # sviluppo locale → http://localhost:5173
npm run build    # build produzione
```

## Comandi

```bash
# Scarica dati PM10/PM2.5
python scripts/downloader.py

# Scarica dati meteo (auto-detect mesi con misurazioni PM)
python scripts/weather_downloader.py
# Oppure specifica intervallo:
python scripts/weather_downloader.py 2025-01 2025-03

# Pulizia database (rimuovi record non-Torino + VACUUM)
python scripts/db_cleanup.py

# Windows: sync completo (PM + meteo)
start_sync.bat
```

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

## Architettura dati

```
Arpa Piemonte API (JSON) → downloader.py → downloads/*.csv + data/pm_data.db
UniTo Meteo (HTML)       → weather_downloader.py → data/pm_data.db
data/pm_data.db          → frontend/ (via Supabase)
```

### Schema database

```sql
measurements (id, pollutant, station, date, value, downloaded_at)
  UNIQUE (pollutant, station, date)

weather (id, city, date, tmax, tmin, tmed, prec, sr_max, sr_tot,
         ur_med, v_med, v_max, p_max, p_min, p_med, downloaded_at)
  UNIQUE (city, date)
```

## Frontend (Vercel)

Il frontend React è deployato su Vercel. Per aggiornare:

```bash
cd frontend
npm run build
# oppure push su GitHub (auto-deploy via Vercel)
```

## Sorgenti dati

- **PM10/PM2.5**: Arpa Piemonte API JSON
- **Meteo**: UniTo Osservatorio Meteorologico (HTML mensile)
```

---

## Chunk 4: Git + Vercel Deploy

### Task 8: Initialize git and push to GitHub

**Files:** none (git operations)

- [ ] **Step 1: Initialize git repository**

```bash
git init
```

- [ ] **Step 2: Add remote origin**

```bash
git remote add origin https://github.com/Attilio81/AirQualityTorino.git
```

- [ ] **Step 3: Stage all files**

```bash
git add .
```

- [ ] **Step 4: Verify staged files (check nothing sensitive is included)**

```bash
git status
```
Verify: `.env`, `data/pm_data.db`, `data/log.txt`, `downloads/` are NOT listed (covered by .gitignore).

- [ ] **Step 5: Initial commit**

```bash
git commit -m "$(cat <<'EOF'
feat: initial commit — reorganize project structure

- Move Python scripts to scripts/
- Move runtime data to data/
- Remove Streamlit dashboard
- Add React/Vite frontend
- Update README and batch files

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Push to GitHub**

```bash
git branch -M main
git push -u origin main
```

---

### Task 9: Deploy frontend to Vercel

**Files:** none (deploy operations)

- [ ] **Step 1: Check if Vercel CLI is installed**

```bash
vercel --version
```
If not installed: `npm install -g vercel`

- [ ] **Step 2: Login to Vercel (if needed)**

```bash
vercel whoami
```
If not logged in: `vercel login`

- [ ] **Step 3: Deploy frontend to Vercel**

```bash
cd frontend
vercel --prod
```

When prompted:
- Set up and deploy: **Y**
- Which scope: select your account
- Link to existing project: **N** (first time) or **Y** (if already exists)
- Project name: `airquality-torino`
- Directory: `./` (already in frontend/)
- Override settings: **N**

- [ ] **Step 4: Note the deployment URL**

Vercel will output the production URL (e.g. `https://airquality-torino.vercel.app`).

- [ ] **Step 5: Verify deployment**

Open the Vercel URL in browser and confirm the frontend loads correctly.

---
