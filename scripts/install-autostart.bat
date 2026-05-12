@echo off
title WerkstattWeb - Install Autostart
echo Installing WerkstattWeb autostart...
echo.

set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set VBS=%~dp0autostart-silent.vbs
set LNK=%STARTUP%\WerkstattWeb-Autostart.lnk

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$s = $ws.CreateShortcut('%LNK%'); " ^
  "$s.TargetPath = '%VBS%'; " ^
  "$s.Description = 'WerkstattWeb Docker Autostart'; " ^
  "$s.Save()"

if exist "%LNK%" (
  echo SUCCESS: Autostart shortcut created.
  echo Location: %LNK%
  echo.
  echo WerkstattWeb will now start automatically on Windows login.
  echo Frontend will be available at: http://localhost:4200
) else (
  echo ERROR: Could not create shortcut. Try running as Administrator.
)
echo.
pause
