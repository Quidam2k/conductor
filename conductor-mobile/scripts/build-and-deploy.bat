@echo off
REM Build release APK and deploy to Firebase App Distribution (Windows)

cd /d "%~dp0\.."

echo 🔨 Building Conductor Mobile - Release APK
echo ==========================================
echo.

REM Check if keystore exists
if not exist "androidApp\keystore.jks" (
    echo ❌ Keystore not found!
    echo    Run: scripts\generate-keystore.bat first
    exit /b 1
)

REM Build release APK
echo 📦 Building release APK...
call gradlew.bat :androidApp:assembleRelease

if errorlevel 1 (
    echo ❌ Build failed.
    exit /b 1
)

set APK_PATH=androidApp\build\outputs\apk\release\androidApp-release.apk

if not exist "%APK_PATH%" (
    echo ❌ APK not found at expected location: %APK_PATH%
    exit /b 1
)

echo.
echo ✅ APK built successfully!
echo    Location: %APK_PATH%
for %%A in ("%APK_PATH%") do echo    Size: %%~zA bytes
echo.

REM Check if Firebase CLI is installed
where firebase >nul 2>nul
if errorlevel 1 (
    echo ⚠️  Firebase CLI not installed.
    echo    Install: npm install -g firebase-tools
    echo    Then run: firebase login
    echo.
    echo 📱 You can manually install the APK:
    echo    adb install "%APK_PATH%"
    exit /b 0
)

REM Upload to Firebase App Distribution
echo 🚀 Uploading to Firebase App Distribution...
firebase appdistribution:distribute "%APK_PATH%" --app YOUR_FIREBASE_APP_ID --release-notes-file "release-notes.txt" --groups "testers"

if errorlevel 0 (
    echo.
    echo 🎉 Successfully deployed to Firebase App Distribution!
    echo.
    echo 📱 Testers will receive a notification to install the update.
    echo    Or share the Firebase link directly.
    echo.
) else (
    echo.
    echo ❌ Firebase upload failed.
    echo    You can manually upload the APK to Firebase Console:
    echo    https://console.firebase.google.com/project/_/appdistribution
    exit /b 1
)
