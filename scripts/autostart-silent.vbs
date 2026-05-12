' WerkstattWeb Silent Autostart
' Runs "docker compose up -d" without showing a CMD window.
' Place a shortcut to this file in:
'   C:\Users\<YourName>\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
'
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\WerkstattWeb"
shell.Run "docker compose up -d", 0, False
