@echo off
echo ============================================================
echo  AirQuality Torino - Dashboard locale
echo ============================================================

cd /d "%~dp0\frontend"

echo Avvio server locale su http://localhost:5173
echo Premi Ctrl+C per fermare.
echo.

npm run dev
