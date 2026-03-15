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
