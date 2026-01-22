#!/usr/bin/env python3
"""
Conductor QR Code Generator - Creates QR codes for test events with dynamic timing.
Supports multiple event templates.

Usage:
    python generate-conductor-qr.py                    # Generate Inaugural (default)
    python generate-conductor-qr.py inaugural          # Generate Inaugural
    python generate-conductor-qr.py diagnostic         # Generate Node Diagnostic
    python generate-conductor-qr.py both               # Generate both
"""

import json
import gzip
import base64
from datetime import datetime, timedelta, timezone
import qrcode
import os
import sys

# Event templates
EVENTS = {
    "inaugural": {
        "title": "Pantheon Inaugural",
        "description": "Your AI assistants present: a demonstration of synchronized coordination.",
        "actions": [
            {"relativeTime": 0, "action": "Take a deep breath. The Pantheon is online.",
             "color": "#9C27B0", "icon": "🏛️", "style": "emphasis", "hapticPattern": "single",
             "noticeSeconds": 15, "countdownSeconds": [10, 5, 3, 2, 1]},
            {"relativeTime": 20, "action": "Raise your phone like a torch. You are the conductor now.",
             "color": "#FF9800", "icon": "🔥", "style": "emphasis", "hapticPattern": "double",
             "noticeSeconds": 10, "countdownSeconds": [5, 3, 2, 1]},
            {"relativeTime": 40, "action": "Look left, then right. You're part of something bigger.",
             "color": "#2196F3", "icon": "👀", "style": "normal", "hapticPattern": "single",
             "noticeSeconds": 10, "countdownSeconds": [5, 3, 2, 1]},
            {"relativeTime": 60, "action": "Clap once. The signal has been sent.",
             "color": "#4CAF50", "icon": "👏", "style": "alert", "hapticPattern": "triple",
             "noticeSeconds": 10, "countdownSeconds": [5, 3, 2, 1]},
            {"relativeTime": 80, "action": "Final pose: arms crossed, slight nod. Test complete.",
             "color": "#E91E63", "icon": "✨", "style": "emphasis", "hapticPattern": "double",
             "noticeSeconds": 10, "countdownSeconds": [5, 3, 2, 1]},
        ]
    },
    "diagnostic": {
        "title": "Pantheon Node Initialization",
        "description": "System diagnostic and welcome sequence for Conductor mobile node.",
        "actions": [
            {"relativeTime": 0, "action": "System Link Established",
             "color": "#4CAF50", "icon": "🔗", "style": "normal", "hapticPattern": "single",
             "noticeSeconds": 10, "countdownSeconds": [5, 3, 2, 1]},
            {"relativeTime": 30, "action": "Audio Channel Diagnostic",
             "color": "#2196F3", "icon": "🔊", "style": "emphasis", "hapticPattern": "double",
             "noticeSeconds": 5, "countdownSeconds": [3, 2, 1]},
            {"relativeTime": 60, "action": "Haptic Array Stress Test",
             "color": "#FF9800", "icon": "📳", "style": "alert", "hapticPattern": "triple",
             "noticeSeconds": 5, "countdownSeconds": [3, 2, 1]},
            {"relativeTime": 90, "action": "Visual Synchronization",
             "color": "#F44336", "icon": "👁️", "style": "emphasis", "hapticPattern": "triple",
             "noticeSeconds": 5, "countdownSeconds": [3, 2, 1]},
            {"relativeTime": 120, "action": "Welcome to the Network, Operator.",
             "color": "#9C27B0", "icon": "🏛️", "style": "emphasis", "hapticPattern": "double",
             "noticeSeconds": 10, "countdownSeconds": [5, 4, 3, 2, 1]},
            {"relativeTime": 150, "action": "Entering Standby Mode",
             "color": "#607D8B", "icon": "💤", "style": "normal", "hapticPattern": "single",
             "noticeSeconds": 5, "countdownSeconds": [3, 2, 1]},
        ]
    }
}

def generate_event(template_name: str, start_minutes_from_now: int = 2):
    """Generate an event with dynamic timing."""
    template = EVENTS[template_name]
    now = datetime.now(timezone.utc)
    start_time = now + timedelta(minutes=start_minutes_from_now)

    actions = []
    for i, action_template in enumerate(template["actions"]):
        action_time = start_time + timedelta(seconds=action_template["relativeTime"])
        action = {
            "id": f"action-{i+1}",
            "time": action_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "action": action_template["action"],
            "audioAnnounce": True,
            "announceActionName": True,
            **{k: v for k, v in action_template.items() if k not in ["action"]}
        }
        actions.append(action)

    event = {
        "title": template["title"],
        "description": template["description"],
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

def generate_qr(template_name: str, start_minutes: int = 2):
    """Generate QR code for an event template."""
    print(f"\n{'='*60}")
    print(f"  CONDUCTOR - {EVENTS[template_name]['title'].upper()}")
    print(f"{'='*60}\n")

    event = generate_event(template_name, start_minutes)
    encoded = encode_event(event)
    conductor_url = f"conductor://event/{encoded}"

    print(f"  Event: {event['title']}")
    print(f"  Starts: {event['startTime']} ({start_minutes} min from now)")
    print(f"  Actions: {len(event['timeline'])}")

    max_time = max(a.get('relativeTime', 0) for a in EVENTS[template_name]['actions'])
    print(f"  Duration: ~{max_time} seconds")
    print()

    print("  TIMELINE:")
    for action in EVENTS[template_name]["actions"]:
        print(f"    +{action['relativeTime']:3d}s: {action['action'][:50]}...")
    print()

    # Generate QR code
    script_dir = os.path.dirname(os.path.abspath(__file__))
    qr_path = os.path.join(script_dir, f"conductor-{template_name}-qr.png")

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

    print(f"  QR Code: {qr_path}")
    print(f"  URL length: {len(conductor_url)} chars")
    print()

    return qr_path

def main():
    print("\n" + "="*60)
    print("  CONDUCTOR QR CODE GENERATOR")
    print("  Pantheon Onboarding Package")
    print("="*60)

    # Parse command line
    if len(sys.argv) > 1:
        choice = sys.argv[1].lower()
    else:
        choice = "inaugural"

    start_minutes = 2
    if len(sys.argv) > 2:
        try:
            start_minutes = int(sys.argv[2])
        except ValueError:
            pass

    if choice == "both":
        generate_qr("diagnostic", start_minutes)
        generate_qr("inaugural", start_minutes)
        print("="*60)
        print("  RECOMMENDED ORDER:")
        print("  1. Diagnostic (tech warm-up, 2.5 min)")
        print("  2. Inaugural (theatrical, 90 sec)")
        print("="*60 + "\n")
    elif choice == "diagnostic":
        generate_qr("diagnostic", start_minutes)
    else:
        generate_qr("inaugural", start_minutes)

    print("="*60)
    print("  NEXT STEPS:")
    print("="*60)
    print()
    print("  1. Install APK: serve-apk.bat")
    print("  2. Open QR PNG on monitor")
    print("  3. Scan with Conductor app")
    print("  4. Hit 'Go Live'!")
    print()

if __name__ == "__main__":
    main()
