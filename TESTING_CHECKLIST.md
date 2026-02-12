# Conductor — Real-Device Testing Checklist

Test on the hosted version: https://quidam2k.github.io/conductor/

## Android Chrome

- [ ] Page loads, input screen appears
- [ ] "Add to Home Screen" prompt available, icon shows correctly
- [ ] Opens in standalone mode from home screen (no browser chrome)
- [ ] Demo event loads, preview shows correct info
- [ ] Practice mode: circular timeline renders and animates
- [ ] Practice mode: TTS announces actions
- [ ] Practice mode: speed slider changes playback speed
- [ ] Practice mode: mute button silences TTS
- [ ] Live mode: real-time countdown works
- [ ] Vibration works on action triggers
- [ ] Screen stays on during practice/live (wake lock)
- [ ] Web Share API shows system share sheet
- [ ] "Copy Event Code" copies to clipboard
- [ ] "Copy Shareable Link" copies to clipboard
- [ ] "Download Bundled HTML" downloads a file
- [ ] Downloaded file opens in browser and loads the event
- [ ] Create event: editor wizard completes all 3 steps
- [ ] Offline: go to airplane mode after first load → reload → app works

## iOS Safari

- [ ] Page loads, input screen appears
- [ ] "Add to Home Screen" works (Share → Add to Home Screen), icon shows
- [ ] Opens in standalone mode from home screen
- [ ] Demo event loads, preview shows correct info
- [ ] Practice mode: circular timeline renders and animates
- [ ] Practice mode: TTS announces actions (screen on)
- [ ] **TTS works with screen locked** (the critical test)
- [ ] Practice mode: speed slider changes playback speed
- [ ] Practice mode: mute button silences TTS
- [ ] Live mode: real-time countdown works
- [ ] Screen stays on during practice/live (wake lock)
- [ ] "Copy Event Code" copies to clipboard
- [ ] "Copy Shareable Link" copies to clipboard
- [ ] Create event: editor wizard completes all 3 steps
- [ ] Shared link opens correctly in Safari

## Desktop (Chrome, Firefox, Safari)

- [ ] Chrome: page loads, all screens work
- [ ] Firefox: page loads, all screens work
- [ ] Safari (if available): page loads, all screens work
- [ ] Window resize doesn't break layout
- [ ] Circular timeline renders at different window sizes
- [ ] Copy buttons work
- [ ] Download bundled HTML works
- [ ] PWA install prompt appears in Chrome address bar

## Cross-Device Sharing

- [ ] Create event on device A → copy link → open on device B → same event
- [ ] Create event → download bundled HTML → transfer file → open on another device
- [ ] Event code copied from one device pastes and loads on another
