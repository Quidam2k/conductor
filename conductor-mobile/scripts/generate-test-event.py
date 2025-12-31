#!/usr/bin/env python3
"""
Generate a test event QR code for Conductor Mobile testing.
Creates an event with actions starting in the near future.
"""

import json
import gzip
import base64
from datetime import datetime, timedelta, timezone
import sys

try:
    import qrcode
    HAS_QRCODE = True
except ImportError:
    HAS_QRCODE = False

def generate_test_event(start_minutes_from_now: int = 2, action_interval_seconds: int = 15):
    """
    Generate a test event with actions starting soon.

    Args:
        start_minutes_from_now: When to start the first action
        action_interval_seconds: Time between each action
    """
    now = datetime.now(timezone.utc)
    start_time = now + timedelta(minutes=start_minutes_from_now)

    # Create timeline actions
    actions = []
    action_texts = [
        ("Raise hand", "emphasis"),
        ("Wave slowly", "normal"),
        ("Clap once", "alert"),
        ("Turn around", "normal"),
        ("Take a step forward", "normal"),
        ("Final pose", "emphasis"),
    ]

    for i, (text, style) in enumerate(action_texts):
        action_time = start_time + timedelta(seconds=i * action_interval_seconds)
        actions.append({
            "id": f"action-{i+1}",
            "time": action_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "action": text,
            "audioAnnounce": True,
            "announceActionName": True,
            "style": style,
            "hapticPattern": "double" if style == "normal" else "triple"
        })

    # Create embedded event (minimal format for URL)
    event = {
        "title": "Test Flash Mob",
        "description": "A test event for Conductor Mobile development",
        "startTime": start_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "timezone": "America/New_York",
        "timeline": actions
    }

    return event

def encode_event(event: dict) -> str:
    """Encode event to URL-safe base64 compressed format."""
    # Convert to JSON
    json_str = json.dumps(event, separators=(',', ':'))  # Compact JSON

    # Compress with gzip
    compressed = gzip.compress(json_str.encode('utf-8'))

    # Base64 encode and make URL-safe
    b64 = base64.b64encode(compressed).decode('ascii')
    url_safe = b64.replace('+', '-').replace('/', '_').rstrip('=')

    return url_safe

def print_qr_ascii(data: str):
    """Print QR code as ASCII art."""
    if not HAS_QRCODE:
        return False

    try:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=1,
            border=1,
        )
        qr.add_data(data)
        qr.make(fit=True)
        # Use simple chars for Windows compatibility
        qr.print_tty()
        return True
    except Exception:
        # Fallback: just print a message about using online QR generator
        print("    (QR display failed - use online QR generator)")
        return False

def main():
    print()
    print("=" * 60)
    print("  CONDUCTOR TEST EVENT GENERATOR")
    print("=" * 60)
    print()

    # Parse command line args
    start_minutes = 2
    if len(sys.argv) > 1:
        try:
            start_minutes = int(sys.argv[1])
        except ValueError:
            print(f"Usage: {sys.argv[0]} [minutes_until_start]")
            print("  Default: 2 minutes")
            return

    print(f"  Generating test event starting in {start_minutes} minute(s)...")
    print()

    # Generate event
    event = generate_test_event(start_minutes_from_now=start_minutes)
    encoded = encode_event(event)

    # Create full URLs
    conductor_url = f"conductor://event/{encoded}"

    # Print event info
    print("  EVENT DETAILS:")
    print(f"    Title: {event['title']}")
    print(f"    Start: {event['startTime']}")
    print(f"    Actions: {len(event['timeline'])}")
    print()

    print("  TIMELINE:")
    for action in event['timeline']:
        print(f"    {action['time']}: {action['action']}")
    print()

    # Print encoded data
    print("  ENCODED DATA:")
    print(f"    Length: {len(encoded)} characters")
    print()

    # Print URLs
    print("  DEEP LINK URL:")
    print(f"    {conductor_url}")
    print()

    # Try to generate QR code
    print("  QR CODE:")
    if HAS_QRCODE:
        print()
        print_qr_ascii(conductor_url)
        print()
    else:
        print("    (Install 'qrcode' module: pip install qrcode)")
        print()

    # Also print just the encoded data for manual use
    print("  RAW ENCODED DATA (copy this to a QR generator):")
    print()
    print(encoded)
    print()

    print("=" * 60)
    print("  TESTING INSTRUCTIONS:")
    print("=" * 60)
    print()
    print("  1. If QR code displayed above, scan with Conductor app")
    print("  2. OR copy the encoded data and paste into:")
    print("     - https://www.qr-code-generator.com/")
    print("     - Add 'conductor://event/' prefix before the data")
    print("  3. OR type the deep link URL in Chrome on Android:")
    print("     (Chrome will open the Conductor app)")
    print()

if __name__ == "__main__":
    main()
