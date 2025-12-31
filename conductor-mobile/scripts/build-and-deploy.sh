#!/bin/bash
# Build release APK and deploy to Firebase App Distribution

set -e  # Exit on error

cd "$(dirname "$0")/.."

echo "🔨 Building Conductor Mobile - Release APK"
echo "=========================================="
echo ""

# Check if keystore exists
if [ ! -f "androidApp/keystore.jks" ]; then
    echo "❌ Keystore not found!"
    echo "   Run: ./scripts/generate-keystore.sh first"
    exit 1
fi

# Build release APK
echo "📦 Building release APK..."
./gradlew :androidApp:assembleRelease

if [ $? -ne 0 ]; then
    echo "❌ Build failed."
    exit 1
fi

APK_PATH="androidApp/build/outputs/apk/release/androidApp-release.apk"

if [ ! -f "$APK_PATH" ]; then
    echo "❌ APK not found at expected location: $APK_PATH"
    exit 1
fi

echo ""
echo "✅ APK built successfully!"
echo "   Location: $APK_PATH"
echo "   Size: $(du -h "$APK_PATH" | cut -f1)"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "⚠️  Firebase CLI not installed."
    echo "   Install: npm install -g firebase-tools"
    echo "   Then run: firebase login"
    echo ""
    echo "📱 You can manually install the APK:"
    echo "   adb install \"$APK_PATH\""
    exit 0
fi

# Check if logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    echo "⚠️  Not logged in to Firebase."
    echo "   Run: firebase login"
    exit 1
fi

# Upload to Firebase App Distribution
echo "🚀 Uploading to Firebase App Distribution..."
firebase appdistribution:distribute "$APK_PATH" \
    --app YOUR_FIREBASE_APP_ID \
    --release-notes-file "release-notes.txt" \
    --groups "testers"

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Successfully deployed to Firebase App Distribution!"
    echo ""
    echo "📱 Testers will receive a notification to install the update."
    echo "   Or share the Firebase link directly."
    echo ""
else
    echo ""
    echo "❌ Firebase upload failed."
    echo "   You can manually upload the APK to Firebase Console:"
    echo "   https://console.firebase.google.com/project/_/appdistribution"
    exit 1
fi
