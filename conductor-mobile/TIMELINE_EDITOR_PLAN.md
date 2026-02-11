# Timeline Editor Plan

## Goal
Enable anyone to create and share events directly from the app or a web tool.

---

## Phase 1: Simple Mobile Editor (MVP)

### User Flow
1. Tap "Create Event" on home screen
2. Enter event name and optional description
3. Add actions one by one:
   - Action text (e.g., "Raise your hand")
   - Relative time from start (e.g., "+30 seconds")
4. Preview the timeline
5. Generate QR code / shareable link
6. Share via any app (Messages, WhatsApp, etc.)

### UI Screens

#### Create Event Screen
```
┌─────────────────────────────┐
│  ← Create Event             │
├─────────────────────────────┤
│                             │
│  Event Name                 │
│  ┌─────────────────────────┐│
│  │ Flash Mob at Park       ││
│  └─────────────────────────┘│
│                             │
│  Description (optional)     │
│  ┌─────────────────────────┐│
│  │ Meet at the fountain    ││
│  └─────────────────────────┘│
│                             │
│  Start Time                 │
│  ┌─────────────────────────┐│
│  │ In 5 minutes       ▼   ││
│  └─────────────────────────┘│
│                             │
│  [ Continue to Actions → ]  │
│                             │
└─────────────────────────────┘
```

#### Add Actions Screen
```
┌─────────────────────────────┐
│  ← Actions                  │
├─────────────────────────────┤
│                             │
│  Timeline (3 actions)       │
│  ┌─────────────────────────┐│
│  │ 0:00  Wave hello        ││
│  │ 0:30  Raise hand        ││
│  │ 1:00  Final pose        ││
│  └─────────────────────────┘│
│                             │
│  [ + Add Action ]           │
│                             │
│  ─────────────────────────  │
│                             │
│  [ Preview Timeline ]       │
│  [ Generate QR Code ]       │
│                             │
└─────────────────────────────┘
```

#### Add Action Dialog
```
┌─────────────────────────────┐
│  Add Action                 │
├─────────────────────────────┤
│                             │
│  What to do:                │
│  ┌─────────────────────────┐│
│  │ Raise your hand         ││
│  └─────────────────────────┘│
│                             │
│  When (after start):        │
│  ┌──────┐ ┌────────────────┐│
│  │  30  │ │ seconds    ▼  ││
│  └──────┘ └────────────────┘│
│                             │
│  [ Cancel ]     [ Add ]     │
│                             │
└─────────────────────────────┘
```

#### Share Screen
```
┌─────────────────────────────┐
│  ← Share Event              │
├─────────────────────────────┤
│                             │
│  "Flash Mob at Park"        │
│  3 actions • Starts in 5min │
│                             │
│  ┌─────────────────────────┐│
│  │                         ││
│  │      [QR CODE]          ││
│  │                         ││
│  └─────────────────────────┘│
│                             │
│  [ Copy Link ]              │
│  [ Share via... ]           │
│                             │
│  ─────────────────────────  │
│  Tip: Others scan this QR   │
│  to join your event!        │
└─────────────────────────────┘
```

### Data Model (already exists)
```kotlin
data class Event(
    val id: String,
    val title: String,
    val description: String?,
    val startTime: Instant,
    val timezone: String,
    val timeline: List<TimelineAction>
)

data class TimelineAction(
    val id: String,
    val time: Instant,        // Absolute time
    val action: String,       // What to do
    val hapticPattern: String // "normal", "emphasis", "alert"
)
```

### Implementation Tasks

1. **CreateEventScreen.kt** - New Compose screen
   - Event name/description input
   - Start time picker (relative: "in X minutes")
   - Navigation to actions screen

2. **EditActionsScreen.kt** - New Compose screen
   - List of current actions
   - Add action dialog
   - Reorder/delete actions
   - Preview button

3. **ShareEventScreen.kt** - New Compose screen
   - Generate QR code using existing QrCodeGenerator
   - Copy link button
   - Share intent integration

4. **EventEditorViewModel.kt** - New ViewModel
   - Holds draft event state
   - Converts relative times to absolute times at share time
   - Calls EventEncoder to generate URL

5. **Navigation updates** - Add routes for new screens

### Files to Create
```
androidApp/src/main/kotlin/com/conductor/mobile/
├── screens/
│   ├── CreateEventScreen.kt      (NEW)
│   ├── EditActionsScreen.kt      (NEW)
│   └── ShareEventScreen.kt       (NEW)
└── viewmodels/
    └── EventEditorViewModel.kt   (NEW)
```

### Files to Modify
```
- MainActivity.kt (add navigation routes)
- EventListScreen.kt (add "Create Event" button)
```

---

## Phase 2: Web Editor (Future)

### Why Web?
- Easier to type on keyboard
- Works on any device
- Can be hosted on GitHub Pages (free, no server)

### Tech Stack
- Static HTML/CSS/JS (no framework needed for MVP)
- Same EventEncoder logic (port to JS or use WASM)
- QR code generation via qrcode.js library

### Features
- Same flow as mobile but in browser
- Drag-and-drop timeline reordering
- Import from CSV/spreadsheet
- Save drafts to localStorage

---

## Timeline Estimate

### Phase 1 (Mobile Editor)
- CreateEventScreen: 2-3 hours
- EditActionsScreen: 2-3 hours
- ShareEventScreen: 1-2 hours
- ViewModel + wiring: 2-3 hours
- Testing: 2-3 hours
- **Total: ~12-15 hours of work**

### Phase 2 (Web Editor)
- Basic HTML/JS: 3-4 hours
- Port EventEncoder: 2-3 hours
- Polish: 2-3 hours
- **Total: ~8-10 hours of work**

---

## Questions for Todd

1. **Start time input**: Should it be:
   - Relative only ("in 5 minutes", "in 1 hour")
   - Specific time picker
   - Both options?

2. **Action timing**: Should users enter:
   - Relative to event start ("+30 seconds")
   - Relative to previous action ("+30 seconds after last")
   - Specific clock time
   - Combination?

3. **Haptic patterns**: Expose to users or keep hidden?
   - Simple: Just use defaults
   - Medium: Let users pick "normal" vs "emphasis"
   - Advanced: Full pattern customization

4. **Save drafts**: Should we save incomplete events locally?
   - Pro: Don't lose work if app closes
   - Con: More complexity

5. **Edit existing**: Should users be able to edit events they've created?
   - Would need to save "my events" separately from "joined events"
