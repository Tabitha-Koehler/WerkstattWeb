@echo off
echo ============================================
echo   WerkstattWeb - Setup
echo ============================================
echo.

REM .env erstellen falls nicht vorhanden
if not exist .env (
  copy .env.example .env
  echo [OK] .env Datei erstellt - bitte ANTHROPIC_API_KEY und WATCH_FOLDER eintragen!
  echo.
) else (
  echo [OK] .env Datei gefunden
)

REM Backend Dependencies
echo [1/4] Installiere Backend-Abhaengigkeiten...
cd backend
call npm install
if errorlevel 1 (
  echo [FEHLER] Backend npm install fehlgeschlagen
  pause
  exit /b 1
)
cd ..
echo [OK] Backend bereit

REM Frontend Dependencies
echo [2/4] Installiere Frontend-Abhaengigkeiten...
cd frontend
call npm install
if errorlevel 1 (
  echo [FEHLER] Frontend npm install fehlgeschlagen
  pause
  exit /b 1
)
cd ..
echo [OK] Frontend bereit

REM Docker starten
echo [3/4] Starte PostgreSQL Datenbank...
docker-compose up -d
if errorlevel 1 (
  echo [FEHLER] Docker konnte nicht gestartet werden - ist Docker Desktop installiert und laeuft?
  pause
  exit /b 1
)

echo Warte 5 Sekunden auf Datenbank...
timeout /t 5 /nobreak >nul

echo [OK] Datenbank laeuft

echo.
echo ============================================
echo   Setup abgeschlossen!
echo ============================================
echo.
echo Naechste Schritte:
echo   1. .env Datei oeffnen und ANTHROPIC_API_KEY eintragen
echo   2. .env Datei oeffnen und WATCH_FOLDER eintragen (Ordner mit Rechnungen)
echo   3. start-backend.bat in einem Terminalfenster ausfuehren
echo   4. start-frontend.bat in einem anderen Terminalfenster ausfuehren
echo   5. Browser oeffnen: http://localhost:4200
echo.
pause
