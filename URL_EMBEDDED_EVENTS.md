# URL-Embedded Events - Phase 1.5 Implementation

## Overview

URL-embedded events enable **censorship-resistant, server-free event coordination** by encoding all event data directly into the URL. This approach eliminates single points of failure and makes events impossible to take down by simply removing a server.

## Implementation Status: ✅ COMPLETE

### Features Implemented

1. **EventEncoder Service** (`conductor-web/src/services/EventEncoder.ts`)
   - JSON → gzip → base64url encoding pipeline
   - Automatic field optimization (excludes defaults to save space)
   - Compression stats: **51% size reduction** (2.05x compression ratio)
   - Full decode/encode with error handling

2. **URL Parameter Support** (`conductor-web/src/pages/EventJoinPage.tsx`)
   - Detects `?event=` query parameter
   - Prioritizes embedded events over server-based events
   - Automatic fallback to server API if no embedded data
   - Disables polling for embedded events (no server needed)

3. **Visual Indicators**
   - 🔒 "Offline Event" badge in header
   - Footer message: "Offline/Embedded Event - No server required"
   - Clear differentiation between embedded vs server-based events

4. **Test Script** (`conductor-server/scripts/create-embedded-event.js`)
   - Generate embedded URLs from database events
   - Test mode: `node scripts/create-embedded-event.js --test`
   - Compression stats and QR code viability analysis

## Compression Performance

### Test Results (5-action event)

```
Original JSON size:    1167 bytes
Compressed size:       570 bytes
Compression ratio:     2.05x
Size reduction:        51%
Total URL length:      600 characters
QR Code Version:       15 (scannable)
```

### QR Code Viability

- ✅ **Scannable** at QR version 15
- Supports up to **~10 actions** before reaching QR v20 limit
- Complex events with many actions may require v25-30
- Maximum theoretical: **4296 characters** (QR v40)

## Usage

### Generate Embedded Event URL

```bash
# From test data
cd conductor-server
node scripts/create-embedded-event.js --test

# From existing database event
node scripts/create-embedded-event.js <eventId>

# Set custom web URL
set WEB_URL=https://yourdomain.com
node scripts/create-embedded-event.js --test
```

### Test Manually

1. **Start web server:**
   ```bash
   cd conductor-web
   npm run dev
   ```

2. **Generate test URL:**
   ```bash
   cd ../conductor-server
   node scripts/create-embedded-event.js --test
   ```

3. **Copy the generated URL** (looks like):
   ```
   http://localhost:5175/e?event=H4sIAAAAAAAACq3SwYoTQRAG4Fdp6jzRzSRZ2LllWfWkLJKLikilu5Ip...
   ```

4. **Open in browser** and verify:
   - ✅ "🔒 Offline Event" badge appears
   - ✅ Event title loads: "Test Flash Mob Event"
   - ✅ 5 timeline actions displayed
   - ✅ Countdown timer shows time until start
   - ✅ Preview button works
   - ✅ Audio toggle available
   - ✅ Footer shows "Offline/Embedded Event - No server required"

### Browser Console Testing

Open browser console and test encoding/decoding:

```javascript
// Import functions (they're available in EventJoinPage)
const { encodeEvent, decodeEvent } = await import('./services/EventEncoder');

// Test event
const testEvent = {
  title: "Quick Test",
  description: "Testing compression",
  startTime: new Date(Date.now() + 3600000).toISOString(),
  timezone: "America/New_York",
  timeline: [
    {
      id: "1",
      time: new Date(Date.now() + 3600000).toISOString(),
      action: "Test action",
      icon: "🎯",
      audioAnnounce: true,
      countdownBeeps: true,
      style: "normal",
      hapticPattern: "double"
    }
  ]
};

// Encode
const encoded = await encodeEvent(testEvent);
console.log("Encoded:", encoded);
console.log("Length:", encoded.length);

// Decode
const decoded = await decodeEvent(encoded);
console.log("Decoded:", decoded);
```

## Architecture

### Data Flow

```
Event Object (JS)
    ↓
JSON.stringify()
    ↓
TextEncoder → UTF-8 bytes
    ↓
CompressionStream('gzip')
    ↓
btoa() → base64
    ↓
URL-safe conversion (+ → -, / → _, remove padding)
    ↓
URL parameter: ?event=<encoded>
```

### Reverse Flow (Decoding)

```
URL parameter: ?event=<encoded>
    ↓
URL-safe decode (- → +, _ → /, add padding)
    ↓
atob() → binary
    ↓
Uint8Array
    ↓
DecompressionStream('gunzip')
    ↓
TextDecoder → UTF-8 string
    ↓
JSON.parse()
    ↓
Event Object (JS)
```

## File Structure

```
conductor-web/src/
├── services/
│   └── EventEncoder.ts          # Encode/decode logic
└── pages/
    └── EventJoinPage.tsx         # URL detection & UI

conductor-server/
└── scripts/
    ├── create-embedded-event.js  # URL generator
    └── tests/
        └── test-embedded-event.js # Playwright test
```

## API Changes

### EventJoinPage Route

- **Before:** `/e/:eventId` (server-based only)
- **After:** `/e/:eventId` OR `/e?event=<encoded>` (dual mode)

### Loading Priority

1. Check for `?event=` query parameter
2. If found → decode embedded event (no server needed)
3. If not found → use `:eventId` to fetch from server

## Limitations & Trade-offs

### Current Implementation

- **No emergency alerts:** Embedded events can't receive real-time updates
- **No participant count:** Can't track who joined without server
- **Static data:** Once shared, event details can't be changed
- **URL length:** Complex events (20+ actions) may be too long for some QR readers

### Solutions for Phase 2 (Native App)

1. **Custom URL scheme:** `conductor://event/<encoded>`
2. **System alarms:** Native scheduling independent of app state
3. **Local storage:** Cache events, no repeated decoding
4. **Deep linking:** OS-level URL handling
5. **Share sheet:** Native QR generation and sharing

## Distribution Methods

### 1. QR Codes (Recommended)

Generate QR codes with embedded URLs for physical distribution:
- Posters, flyers, stickers
- Projected on buildings
- Printed on business cards
- Screen sharing in Zoom/Meet

### 2. Short Links

Use URL shorteners for easier sharing:
```bash
# Example with bit.ly, tinyurl, etc.
https://bit.ly/protest-oct-16 → full embedded URL
```

### 3. Social Media

- Twitter/X posts (watch length limits)
- Signal group messages
- Telegram channels
- WhatsApp broadcasts
- Reddit posts

### 4. Mesh Distribution

- Bluetooth file transfer (Android Nearby Share, AirDrop)
- Local WiFi direct
- P2P apps (Briar, Bridgefy)

## Security Considerations

### ✅ Advantages

- **No central server** = no single point of failure
- **No database** = nothing to seize or subpoena
- **No logs** = participants can't be tracked server-side
- **No authentication** = anonymous participation
- **Offline-first** = works without internet (after initial load)

### ⚠️ Considerations

- **URL visibility:** Event details visible in browser history, logs
- **No encryption:** Data is compressed but not encrypted
- **Tamper detection:** Anyone can modify and reshare URLs
- **Replay attacks:** URLs can be saved and reused

### Future Security (Phase 2)

- Add digital signatures (verify organizer identity)
- Add optional encryption with shared passphrase
- Add checksum validation
- Use custom URL scheme to avoid browser history

## Next Steps

### Phase 2: Native App (Kotlin Multiplatform)

**Priority 1: Offline-First Architecture**
- Local event storage (SQLite)
- System alarm scheduling
- Background processing
- No network required after download

**Priority 2: Custom URL Scheme**
- Register `conductor://` or `popupprotest://`
- Deep linking from browser → app
- Intent handling (Android) and Universal Links (iOS)

**Priority 3: Enhanced Distribution**
- Built-in QR code generator
- Native share sheet integration
- Bluetooth mesh networking
- NFC tag writing

**Priority 4: Security Hardening**
- Event signing with organizer keys
- Optional E2E encryption
- Tamper detection
- Secure enclave storage

### Branding: "Pop-Up Protest"

Strong, memorable name for the native app:
- **Pop-Up Protest** (primary)
- Alternatives: FlashMob, CoordinateNow, SyncAction

### Timeline

- **Days 1-2:** Kotlin Multiplatform setup, basic UI
- **Days 3-4:** URL scheme handling, event decoder
- **Days 5-6:** System alarms, notifications
- **Days 7-8:** Polish, testing, documentation

## Testing Checklist

- [ ] Generate test embedded URL
- [ ] Open in browser (Chrome, Firefox, Safari)
- [ ] Verify "🔒 Offline Event" badge
- [ ] Verify event loads correctly
- [ ] Test countdown timer
- [ ] Test preview button (adjusts start time)
- [ ] Test audio toggle (if supported)
- [ ] Test timeline actions display
- [ ] Close and reopen URL (should work offline after cache)
- [ ] Test on mobile browser
- [ ] Test QR code scanning
- [ ] Verify no server polling occurs (check Network tab)

## References

- RFC 4648 §5: Base64url encoding
- QR Code capacity: https://www.qrcode.com/en/about/version.html
- Compression API: https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API
- Custom URL schemes: https://developer.android.com/training/app-links/deep-linking

---

**Status:** Phase 1.5 COMPLETE ✅
**Next:** Phase 2 - Kotlin Multiplatform Native App
**Last Updated:** October 16, 2025
