@echo off
REM Generate Android signing keystore for release builds (Windows)

set KEYSTORE_FILE=androidApp\keystore.jks
set KEY_ALIAS=conductor

echo 🔐 Generating Android Release Keystore
echo ======================================
echo.

REM Check if keystore already exists
if exist "%KEYSTORE_FILE%" (
    echo ⚠️  Keystore already exists at: %KEYSTORE_FILE%
    set /p OVERWRITE="Do you want to overwrite it? (y/N): "
    if /i not "%OVERWRITE%"=="y" (
        echo Aborted.
        exit /b 1
    )
    del "%KEYSTORE_FILE%"
)

REM Generate keystore
keytool -genkeypair ^
    -alias "%KEY_ALIAS%" ^
    -keyalg RSA ^
    -keysize 2048 ^
    -validity 10000 ^
    -keystore "%KEYSTORE_FILE%" ^
    -dname "CN=Conductor, OU=Development, O=Conductor, L=Unknown, ST=Unknown, C=US" ^
    -storepass conductor ^
    -keypass conductor

if errorlevel 0 (
    echo.
    echo ✅ Keystore generated successfully!
    echo.
    echo 📋 Keystore details:
    echo    File: %KEYSTORE_FILE%
    echo    Alias: %KEY_ALIAS%
    echo    Password: conductor
    echo.
    echo ⚠️  IMPORTANT: Keep this keystore safe! You'll need it for all future releases.
    echo    Add keystore.jks to .gitignore to avoid committing it.
    echo.
) else (
    echo.
    echo ❌ Keystore generation failed.
    echo    Make sure Java/JDK is installed and 'keytool' is in your PATH.
    exit /b 1
)
