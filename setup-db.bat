@echo off
echo =====================================================
echo   WerkstattWeb - Datenbank einrichten (als Admin)
echo =====================================================
echo.
echo Dieses Skript muss als ADMINISTRATOR ausgefuehrt werden!
echo.

set PGBIN=C:\Program Files\PostgreSQL\17\bin
set PGDATA=C:\Program Files\PostgreSQL\17\data

REM pg_hba.conf auf trust umstellen
echo [1] Stelle Authentifizierung auf trust um...
powershell -Command "(Get-Content '%PGDATA%\pg_hba.conf') -replace 'scram-sha-256','trust' | Set-Content '%PGDATA%\pg_hba.conf'"

REM Service neu starten
echo [2] Starte PostgreSQL neu...
net stop postgresql-x64-17
timeout /t 3 /nobreak >nul
net start postgresql-x64-17
timeout /t 3 /nobreak >nul

REM Benutzer und Datenbank anlegen
echo [3] Lege Benutzer und Datenbank an...
"%PGBIN%\psql.exe" -U postgres -c "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'werkstatt') THEN CREATE USER werkstatt WITH PASSWORD 'werkstatt2024'; END IF; END $$;"
"%PGBIN%\psql.exe" -U postgres -c "SELECT 'CREATE DATABASE werkstattweb OWNER werkstatt' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'werkstattweb')\gexec"
"%PGBIN%\psql.exe" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE werkstattweb TO werkstatt;"

REM Passwort fuer postgres setzen (fuer spaetere Nutzung)
"%PGBIN%\psql.exe" -U postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"

REM pg_hba.conf wieder auf scram-sha-256
echo [4] Stelle Authentifizierung zurueck...
powershell -Command "(Get-Content '%PGDATA%\pg_hba.conf') -replace 'trust','scram-sha-256' | Set-Content '%PGDATA%\pg_hba.conf'"

REM Service neu starten
echo [5] Finaler Neustart...
net stop postgresql-x64-17
timeout /t 3 /nobreak >nul
net start postgresql-x64-17
timeout /t 3 /nobreak >nul

echo.
echo =====================================================
echo   Datenbank erfolgreich eingerichtet!
echo =====================================================
echo   Benutzer:   werkstatt
echo   Passwort:   werkstatt2024
echo   Datenbank:  werkstattweb
echo.
echo Jetzt start-backend.bat starten!
echo.
pause
