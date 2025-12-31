@echo off
REM Generate a test event QR code for Conductor Mobile testing
REM Usage: generate-test-event.bat [minutes_until_start]
REM Default: 2 minutes

cd /d "%~dp0"
python generate-test-event.py %*
pause
