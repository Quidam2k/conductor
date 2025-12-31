#!/bin/bash
# Generate Android signing keystore for release builds

KEYSTORE_FILE="androidApp/keystore.jks"
KEY_ALIAS="conductor"

echo "🔐 Generating Android Release Keystore"
echo "======================================"
echo ""

# Check if keystore already exists
if [ -f "$KEYSTORE_FILE" ]; then
    echo "⚠️  Keystore already exists at: $KEYSTORE_FILE"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
    rm "$KEYSTORE_FILE"
fi

# Generate keystore
keytool -genkeypair \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -keystore "$KEYSTORE_FILE" \
    -dname "CN=Conductor, OU=Development, O=Conductor, L=Unknown, ST=Unknown, C=US" \
    -storepass conductor \
    -keypass conductor

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Keystore generated successfully!"
    echo ""
    echo "📋 Keystore details:"
    echo "   File: $KEYSTORE_FILE"
    echo "   Alias: $KEY_ALIAS"
    echo "   Password: conductor"
    echo ""
    echo "⚠️  IMPORTANT: Keep this keystore safe! You'll need it for all future releases."
    echo "   Add keystore.jks to .gitignore to avoid committing it."
    echo ""
else
    echo ""
    echo "❌ Keystore generation failed."
    exit 1
fi
