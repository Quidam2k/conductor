@echo off
REM Quick deploy to connected Android phone via ADB
REM Run this from anywhere - it will cd to the right location

cd /d "%~dp0\.."

echo.
echo ========================================
echo   Conductor Mobile - Deploy to Phone
echo ========================================
echo.

REM Check for connected device
echo Checking for connected device...
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" devices | findstr /R "device$" >nul
if errorlevel 1 (
    echo.
    echo ERROR: No device connected!
    echo.
    echo Connect your phone via USB and enable:
    echo   1. Developer Options (tap Build Number 7 times)
    echo   2. USB Debugging (in Developer Options)
    echo.
    pause
    exit /b 1
)

echo Device found!
echo.

REM Build debug APK
echo Building debug APK...
call gradlew.bat assembleDebug
if errorlevel 1 (
    echo.
    echo BUILD FAILED
    pause
    exit /b 1
)

REM Find the APK
set APK_PATH=androidApp\build\outputs\apk\debug\androidApp-debug.apk
if not exist "%APK_PATH%" (
    echo.
    echo ERROR: APK not found at %APK_PATH%
    pause
    exit /b 1
)

echo.
echo Installing APK...
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" install -r "%APK_PATH%"
if errorlevel 1 (
    echo.
    echo INSTALL FAILED
    echo (If app is already running, close it and try again)
    pause
    exit /b 1
)

echo.
echo ========================================
echo   SUCCESS! App installed.
echo ========================================
echo.
echo The app should appear as "Conductor" on your phone.
echo.
echo To generate a test QR code, run:
echo   scripts\generate-test-event.bat
echo.
pause
