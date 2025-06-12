const QRCode = require('qrcode');
const networkUtils = require('./network');

class QRCodeGenerator {
    async generateServerQR(serverInfo) {
        const connectionInfo = networkUtils.generateConnectionInfo(serverInfo);
        
        try {
            // Generate QR code as data URL
            const qrDataUrl = await QRCode.toDataURL(JSON.stringify(connectionInfo), {
                type: 'image/png',
                quality: 0.92,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });

            return {
                dataUrl: qrDataUrl,
                connectionInfo,
                text: JSON.stringify(connectionInfo, null, 2)
            };
        } catch (error) {
            console.error('QR code generation failed:', error);
            throw new Error('Failed to generate QR code');
        }
    }

    async generateEventQR(eventData) {
        try {
            const qrDataUrl = await QRCode.toDataURL(JSON.stringify(eventData), {
                type: 'image/png',
                quality: 0.92,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });

            return {
                dataUrl: qrDataUrl,
                eventData,
                text: JSON.stringify(eventData, null, 2)
            };
        } catch (error) {
            console.error('Event QR code generation failed:', error);
            throw new Error('Failed to generate event QR code');
        }
    }

    generateQRHTML(qrData, title = 'Conductor Server') {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .container {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            color: #333;
            max-width: 500px;
            width: 90%;
        }
        .logo {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        h1 {
            margin: 0 0 10px;
            color: #333;
            font-size: 2em;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 1.1em;
        }
        .qr-container {
            background: white;
            padding: 20px;
            border-radius: 15px;
            display: inline-block;
            margin: 20px 0;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        }
        .qr-code {
            max-width: 250px;
            width: 100%;
            height: auto;
        }
        .info {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
        }
        .info h3 {
            margin: 0 0 15px;
            color: #333;
            font-size: 1.2em;
        }
        .info-item {
            margin: 8px 0;
            font-family: monospace;
            font-size: 0.9em;
            color: #555;
        }
        .instructions {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
        }
        .instructions h3 {
            margin: 0 0 10px;
            color: #1976d2;
        }
        .instructions ol {
            margin: 0;
            padding-left: 20px;
        }
        .refresh-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 1em;
            cursor: pointer;
            margin-top: 20px;
            transition: background 0.3s;
        }
        .refresh-btn:hover {
            background: #5a67d8;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🎭</div>
        <h1>${title}</h1>
        <div class="subtitle">Scan to connect your mobile device</div>
        
        <div class="qr-container">
            <img src="${qrData.dataUrl}" alt="QR Code" class="qr-code">
        </div>
        
        <div class="info">
            <h3>📱 Connection Info</h3>
            <div class="info-item"><strong>Server URL:</strong> ${qrData.connectionInfo.serverUrl}</div>
            <div class="info-item"><strong>IP Address:</strong> ${qrData.connectionInfo.serverIP}</div>
            <div class="info-item"><strong>Port:</strong> ${qrData.connectionInfo.serverPort}</div>
            <div class="info-item"><strong>Version:</strong> ${qrData.connectionInfo.version}</div>
        </div>
        
        <div class="instructions">
            <h3>📋 Instructions</h3>
            <ol>
                <li>Install the Conductor mobile app</li>
                <li>Open the app and tap "Scan QR Code"</li>
                <li>Point your camera at the QR code above</li>
                <li>Follow the setup instructions in the app</li>
            </ol>
        </div>
        
        <button class="refresh-btn" onclick="window.location.reload()">
            🔄 Refresh QR Code
        </button>
    </div>

    <script>
        // Auto-refresh every 5 minutes to keep connection info current
        setTimeout(() => {
            window.location.reload();
        }, 300000);
    </script>
</body>
</html>`;
    }
}

module.exports = new QRCodeGenerator();