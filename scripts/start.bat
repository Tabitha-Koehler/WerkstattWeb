@echo off
title WerkstattWeb - Starting...
cd /d "C:\WerkstattWeb"
echo Starting WerkstattWeb Docker services...
docker compose up -d
echo.
echo Services started:
echo   Frontend:  http://localhost:4200
echo   Backend:   http://localhost:3000
echo.
echo Press any key to close this window...
pause >nul
