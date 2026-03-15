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
