#!/usr/bin/env python3
"""
Generate QR code for Pantheon Inaugural event.
Creates event starting 2 minutes from now.
"""

import json
import gzip
import base64
from datetime import datetime, timedelta, timezone
import qrcode
import os

def generate_pantheon_event(start_minutes_from_now: int = 2):
    """Generate the Pantheon Inaugural event with dynamic start time."""
    now = datetime.now(timezone.utc)
    start_time = now + timedelta(minutes=start_minutes_from_now)

    # Actions with relative timing (in seconds from start)
    actions = [
        {
            "id": "action-1",
            "relativeTime": 0,
            "action": "Take a deep breath. The Pantheon is online.",
            "audioAnnounce": True,
            "noticeSeconds": 15,
            "countdownSeconds": [10, 5, 3, 2, 1],
            "announceActionName": True,
            "color": "#9C27B0",
            "icon": "🏛️",
            "style": "emphasis",
            "hapticPattern": "single"
        },
        {
            "id": "action-2",
            "relativeTime": 20,
            "action": "Raise your phone like a torch. You are the conductor now.",
            "audioAnnounce": True,
            "noticeSeconds": 10,
            "countdownSeconds": [5, 3, 2, 1],
            "announceActionName": True,
            "color": "#FF9800",
            "icon": "🔥",
            "style": "emphasis",
            "hapticPattern": "double"
        },
        {
            "id": "action-3",
            "relativeTime": 40,
            "action": "Look left, then right. You're part of something bigger.",
            "audioAnnounce": True,
            "noticeSeconds": 10,
            "countdownSeconds": [5, 3, 2, 1],
            "announceActionName": True,
            "color": "#2196F3",
            "icon": "👀",
            "style": "normal",
            "hapticPattern": "single"
        },
        {
            "id": "action-4",
            "relativeTime": 60,
            "action": "Clap once. The signal has been sent.",
            "audioAnnounce": True,
            "noticeSeconds": 10,
            "countdownSeconds": [5, 3, 2, 1],
            "announceActionName": True,
            "color": "#4CAF50",
            "icon": "👏",
            "style": "alert",
            "hapticPattern": "triple"
        },
        {
            "id": "action-5",
            "relativeTime": 80,
            "action": "Final pose: arms crossed, slight nod. Test complete.",
            "audioAnnounce": True,
            "noticeSeconds": 10,
            "countdownSeconds": [5, 3, 2, 1],
            "announceActionName": True,
            "color": "#E91E63",
            "icon": "✨",
            "style": "emphasis",
            "hapticPattern": "double"
        }
    ]

    # Set absolute times based on start
    for action in actions:
        action_time = start_time + timedelta(seconds=action["relativeTime"])
        action["time"] = action_time.strftime("%Y-%m-%dT%H:%M:%SZ")

    event = {
        "title": "Pantheon Inaugural",
        "description": "Your AI assistants present: a demonstration of synchronized coordination.",
        "startTime": start_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "timezone": "America/Denver",
        "timeline": actions
    }

    return event

def encode_event(event: dict) -> str:
    """Encode event to URL-safe base64 compressed format."""
    json_str = json.dumps(event, separators=(',', ':'))
    compressed = gzip.compress(json_str.encode('utf-8'))
    b64 = base64.b64encode(compressed).decode('ascii')
    url_safe = b64.replace('+', '-').replace('/', '_').rstrip('=')
    return url_safe

def main():
    print("\n" + "=" * 60)
    print("  PANTHEON INAUGURAL - First Run Experience")
    print("=" * 60 + "\n")

    # Generate event starting in 2 minutes
    event = generate_pantheon_event(start_minutes_from_now=2)
    encoded = encode_event(event)
    conductor_url = f"conductor://event/{encoded}"

    print(f"  Event: {event['title']}")
    print(f"  Starts: {event['startTime']} (2 minutes from generation)")
    print(f"  Actions: {len(event['timeline'])}")
    print(f"  Duration: ~90 seconds")
    print()

    print("  TIMELINE:")
    for action in event['timeline']:
        print(f"    +{action['relativeTime']:2d}s: {action['action'][:50]}...")
    print()

    # Generate QR code PNG
    script_dir = os.path.dirname(os.path.abspath(__file__))
    qr_path = os.path.join(script_dir, "pantheon-inaugural-qr.png")

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(conductor_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img.save(qr_path)

    print(f"  QR Code saved: {qr_path}")
    print()
    print("  DEEP LINK URL:")
    print(f"  {conductor_url[:80]}...")
    print()
    print("=" * 60)
    print("  INSTRUCTIONS:")
    print("=" * 60)
    print()
    print("  1. Install APK first (run serve-apk.bat from conductor-mobile/scripts)")
    print("  2. Open the PNG file on your monitor")
    print("  3. Tap 'Scan QR' in the Conductor app")
    print("  4. Point phone at screen")
    print("  5. Tap 'Go Live' to start the 2-minute countdown")
    print()
    print("  The event showcases: TTS, haptics, countdown, circular timeline")
    print()

if __name__ == "__main__":
    main()
