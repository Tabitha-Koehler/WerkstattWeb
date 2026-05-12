@echo off
title WerkstattWeb - Stopping...
cd /d "C:\WerkstattWeb"
echo Stopping WerkstattWeb Docker services...
docker compose down
echo Done.
timeout /t 3
