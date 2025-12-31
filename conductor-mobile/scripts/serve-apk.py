#!/usr/bin/env python3
"""
Simple HTTP server to host APK for OTA installation.
Run this, then navigate to the URL on your Android phone to download and install.
"""

import http.server
import socketserver
import os
import socket
import webbrowser
import qrcode
from pathlib import Path

PORT = 8888
APK_PATH = Path(__file__).parent.parent / "androidApp/build/outputs/apk/release/androidApp-release.apk"
DEBUG_APK_PATH = Path(__file__).parent.parent / "androidApp/build/outputs/apk/debug/androidApp-debug.apk"

def get_local_ip():
    """Get the local IP address for LAN access."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "localhost"

def create_index_html(apk_name, apk_size):
    """Create the download page HTML."""
    size_mb = apk_size / (1024 * 1024)
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conductor Mobile - Install</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
        }}
        .card {{
            background: rgba(255,255,255,0.95);
            border-radius: 16px;
            padding: 30px;
            color: #333;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }}
        h1 {{ margin: 0 0 10px 0; font-size: 28px; }}
        .subtitle {{ color: #666; margin-bottom: 20px; }}
        .download-btn {{
            display: block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 18px 30px;
            border-radius: 12px;
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            margin: 20px 0;
            transition: transform 0.2s, box-shadow 0.2s;
        }}
        .download-btn:hover {{
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
        }}
        .info {{ font-size: 14px; color: #666; }}
        .steps {{ background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }}
        .steps h3 {{ margin: 0 0 10px 0; font-size: 16px; }}
        .steps ol {{ margin: 0; padding-left: 20px; }}
        .steps li {{ margin: 8px 0; }}
        .version {{ font-size: 12px; color: #999; text-align: center; margin-top: 20px; }}
    </style>
</head>
<body>
    <div class="card">
        <h1>Conductor Mobile</h1>
        <p class="subtitle">Coordinate synchronized actions in real-time</p>

        <a href="/{apk_name}" class="download-btn">
            Download APK ({size_mb:.1f} MB)
        </a>

        <div class="steps">
            <h3>Installation Steps:</h3>
            <ol>
                <li>Tap the download button above</li>
                <li>When prompted, tap "Open" or find the APK in Downloads</li>
                <li>If asked, allow installation from this source</li>
                <li>Tap "Install" when prompted</li>
                <li>Open Conductor and scan your first event QR code!</li>
            </ol>
        </div>

        <p class="info">
            <strong>Note:</strong> You may need to enable "Install unknown apps"
            in your phone's settings for your browser.
        </p>

        <p class="version">Conductor Mobile v0.1.0-alpha</p>
    </div>
</body>
</html>'''

class APKHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.apk_path = None
        self.apk_name = None

        # Check which APK exists
        if APK_PATH.exists():
            self.apk_path = APK_PATH
            self.apk_name = "conductor-release.apk"
        elif DEBUG_APK_PATH.exists():
            self.apk_path = DEBUG_APK_PATH
            self.apk_name = "conductor-debug.apk"

        super().__init__(*args, directory=str(Path(__file__).parent.parent), **kwargs)

    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            if self.apk_path:
                html = create_index_html(self.apk_name, self.apk_path.stat().st_size)
                self.send_response(200)
                self.send_header("Content-type", "text/html")
                self.end_headers()
                self.wfile.write(html.encode())
            else:
                self.send_error(404, "No APK found. Run build first.")
        elif self.path == f"/{self.apk_name}":
            self.send_response(200)
            self.send_header("Content-type", "application/vnd.android.package-archive")
            self.send_header("Content-Disposition", f"attachment; filename={self.apk_name}")
            self.send_header("Content-Length", str(self.apk_path.stat().st_size))
            self.end_headers()
            with open(self.apk_path, "rb") as f:
                self.wfile.write(f.read())
        else:
            super().do_GET()

def main():
    # Check if APK exists
    if not APK_PATH.exists() and not DEBUG_APK_PATH.exists():
        print("No APK found!")
        print("Run: ./gradlew.bat :androidApp:assembleRelease")
        print("  or ./gradlew.bat :androidApp:assembleDebug")
        return

    apk_type = "release" if APK_PATH.exists() else "debug"
    apk_size = APK_PATH.stat().st_size if APK_PATH.exists() else DEBUG_APK_PATH.stat().st_size

    local_ip = get_local_ip()
    url = f"http://{local_ip}:{PORT}"

    print()
    print("=" * 50)
    print("  CONDUCTOR MOBILE - APK SERVER")
    print("=" * 50)
    print()
    print(f"  APK Type: {apk_type}")
    print(f"  APK Size: {apk_size / (1024*1024):.1f} MB")
    print()
    print("  Open this URL on your Android phone:")
    print(f"  {url}")
    print()
    print("=" * 50)
    print()

    # Try to generate QR code
    try:
        qr = qrcode.QRCode(version=1, box_size=2, border=1)
        qr.add_data(url)
        qr.make(fit=True)
        qr.print_ascii(invert=True)
        print()
    except ImportError:
        print("  (Install 'qrcode' for QR code: pip install qrcode)")
        print()
    except:
        pass

    print("  Press Ctrl+C to stop the server")
    print()

    with socketserver.TCPServer(("", PORT), APKHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Server stopped.")

if __name__ == "__main__":
    main()
