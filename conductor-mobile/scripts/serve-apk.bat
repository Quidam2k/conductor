@echo off
REM Serve APK for OTA installation via local network
cd /d "%~dp0\.."

echo Starting APK server...
echo.

python scripts\serve-apk.py

pause
