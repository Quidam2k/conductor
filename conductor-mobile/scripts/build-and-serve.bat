@echo off
REM Build APK and serve for OTA installation
cd /d "%~dp0\.."

echo ============================================
echo   CONDUCTOR MOBILE - BUILD AND SERVE
echo ============================================
echo.

REM Check for qrcode package
python -c "import qrcode" 2>nul
if errorlevel 1 (
    echo Installing qrcode package...
    pip install qrcode
    echo.
)

echo Building debug APK...
call gradlew.bat assembleDebug

if errorlevel 1 (
    echo.
    echo BUILD FAILED!
    pause
    exit /b 1
)

echo.
echo Build complete! Starting server...
echo.

python scripts\serve-apk.py

pause
