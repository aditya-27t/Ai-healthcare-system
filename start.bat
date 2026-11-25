@echo off
echo Starting MedAssist AI Web Application at http://localhost:8090 ...
start "" http://localhost:8090
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8090
