@echo off
title WerkstattWeb - Remove Autostart
set LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\WerkstattWeb-Autostart.lnk
if exist "%LNK%" (
  del "%LNK%"
  echo Autostart removed.
) else (
  echo Autostart shortcut not found.
)
pause
