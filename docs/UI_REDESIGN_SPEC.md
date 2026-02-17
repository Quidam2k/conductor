# Conductor UI Redesign Spec

> Written during Phase 1 of the UI Review & Redesign cascade.
> This file is the single source of truth for Phases 2-4. It survives context clearing.

---

## 1. Design Direction: "Luminous Depth"

**Concept:** The app feels like a darkened concert hall with stage lighting. Backgrounds have subtle depth (gradients, not flat). Interactive elements glow with their contextual color. The overall impression is alive, pulsing, and ready to coordinate.

**Personality:** Dramatic but not flashy. Trustworthy but not boring. The kind of app that makes you feel like something exciting is about to happen.

**Key differentiators from generic dark theme:**
- Backgrounds use subtle gradients for depth, not flat solid colors
- Interactive elements have colored glow (box-shadow) on hover/focus
- Headers have gradient backgrounds with subtle bottom border glow
- Typography uses extreme weight/spacing contrast for hierarchy
- Screen transitions are directional (forward/back) slide + fade
- The app feels like it "breathes" — LIVE badge pulses, focused elements glow

**Constraints (unchanged):**
- System fonts only (zero download) — compensate with weight, spacing, and size contrast
- Vanilla CSS, no build step
- Single-column mobile-first layout
- Touch-friendly (48px min buttons)
- Must not break any of the 110+ Playwright tests

---

## 2. Color System

### CSS Variables (Phase 2 will replace the existing `:root` block)

```css
:root {
    /* ─── Backgrounds (layered depth, darkest → lightest) ─── */
    --bg-deep: #08081a;
    --bg: #0f0f23;
    --bg-surface: #171733;
    --bg-elevated: #1f1f42;
    --bg-input: #0b0b1e;

    /* ─── Text (warm white, not cold blue-white) ─── */
    --text: #e8e6e3;
    --text-secondary: rgba(232, 230, 227, 0.7);
    --text-dim: rgba(232, 230, 227, 0.4);

    /* ─── Accent colors (semantic, slightly refined) ─── */
    --accent-blue: #5ba3ff;
    --accent-green: #34d399;
    --accent-red: #ff4757;
    --accent-gold: #f0b429;
    --accent-purple: #a78bfa;

    /* ─── Glow effects (box-shadow values for hover/focus) ─── */
    --glow-blue: 0 0 20px rgba(91, 163, 255, 0.2);
    --glow-green: 0 0 20px rgba(52, 211, 153, 0.2);
    --glow-red: 0 0 20px rgba(255, 71, 87, 0.25);
    --glow-gold: 0 0 20px rgba(240, 180, 41, 0.2);
    --glow-purple: 0 0 20px rgba(167, 139, 250, 0.2);

    /* ─── Borders ─── */
    --border-subtle: rgba(255, 255, 255, 0.06);
    --border-medium: rgba(255, 255, 255, 0.12);

    /* ─── Radii ─── */
    --radius: 12px;
    --radius-sm: 8px;
    --radius-lg: 16px;
}
```

### Body background
```css
body {
    background: var(--bg-deep);
    /* Subtle radial gradient — slightly lighter center for depth */
    background: radial-gradient(ellipse at 50% 30%, var(--bg) 0%, var(--bg-deep) 70%);
}
```

### Header gradients (replace flat colors)
```css
.header-input   { background: linear-gradient(135deg, #0d1b3e, #0a1530); border-bottom: 1px solid rgba(91,163,255,0.08); }
.header-preview { background: linear-gradient(135deg, #0d1b3e, #0a1530); border-bottom: 1px solid rgba(91,163,255,0.08); }
.header-practice { background: linear-gradient(135deg, #0a2e1a, #071f12); border-bottom: 1px solid rgba(52,211,153,0.1); }
.header-live     { background: linear-gradient(135deg, #3b0a0a, #2a0505); border-bottom: 1px solid rgba(255,71,87,0.12); }
.header-done     { background: linear-gradient(135deg, #0d1b3e, #0a1530); border-bottom: 1px solid rgba(91,163,255,0.08); }
.header-editor   { background: linear-gradient(135deg, #1a0d3e, #120830); border-bottom: 1px solid rgba(167,139,250,0.1); }
.header-packs    { background: linear-gradient(135deg, #1a2e0d, #121f08); border-bottom: 1px solid rgba(240,180,41,0.08); }
```

---

## 3. Typography

### Font stack (keep system fonts, add Georgia for serif option)
```css
/* Primary — system sans (unchanged, this is fine) */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;

/* Mono — for time codes, technical data */
font-family: 'SF Mono', 'Cascadia Code', 'Consolas', 'Courier New', monospace;
```

### Type Scale (using weight and spacing for drama)

| Role | Size | Weight | Letter-spacing | Transform | Usage |
|------|------|--------|----------------|-----------|-------|
| Display | 32px | 800 | 4px | uppercase | App name on input screen |
| Screen title | 18px | 600 | 0.5px | none | H1 in headers |
| Section title | 20px | 600 | 0 | none | H2 (event title, etc.) |
| Body | 15px | 400 | 0 | none | Main content text |
| Small body | 14px | 400 | 0 | none | Action list, descriptions |
| Label | 11px | 600 | 1.5px | uppercase | Field labels, section markers, hints |
| Mono data | 13px | 400 | 0 | none | Time codes, speed values |

### Key typography changes from current:
- `.app-logo h2`: Increase to 32px, weight 800, letter-spacing 4px (currently 28px, 700, 2px)
- `.field-label`: Add `text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;` (currently just dim 13px)
- `.badge`: Increase letter-spacing to 1.5px (currently 1px)
- `.separator` text: Already 12px dim — add uppercase + 1px letter-spacing
- Time displays (`.action-time`, `.speed-val`): Use mono font stack

---

## 4. Surfaces & Cards

### Card elevation system
```css
/* Base surface — cards, info panels */
.event-info, .ed-action-card, .pack-card, .draft-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* Elevated surface — overlays, modals */
.qr-overlay {
    background: var(--bg);
}
```

### Action list items — add colored left accent
```css
.action-list li {
    border-left: 3px solid transparent;
    padding-left: 10px;
}
/* Color set via inline style or class from JS based on action style */
/* normal → --accent-blue, emphasis → --accent-gold, alert → --accent-red */
```

---

## 5. Interactive Elements

### Buttons — add glow on hover/focus
```css
button {
    transition: opacity 0.15s, transform 0.1s, box-shadow 0.2s;
}

.btn-primary:hover, .btn-primary:focus-visible { box-shadow: var(--glow-blue); }
.btn-green:hover, .btn-green:focus-visible { box-shadow: var(--glow-green); }
.btn-red:hover, .btn-red:focus-visible { box-shadow: var(--glow-red); }
.btn-outline:hover, .btn-outline:focus-visible {
    border-color: rgba(255,255,255,0.25);
    color: var(--text);
}
```

### Focus-visible (accessibility — replaces current `:focus { outline: none }`)
```css
/* Remove the outline-suppression on focus for inputs/textarea */
/* Instead, use focus-visible for keyboard navigation */
:focus-visible {
    outline: 2px solid var(--accent-blue);
    outline-offset: 2px;
}
button:focus:not(:focus-visible) { outline: none; }
textarea:focus-visible, .field-input:focus-visible, .field-textarea:focus-visible, .field-select:focus-visible {
    outline: none;
    border-color: var(--accent-blue);
    box-shadow: 0 0 0 3px rgba(91, 163, 255, 0.15);
}
```

### Form inputs — subtle glow on focus
```css
.field-input:focus, .field-textarea:focus, .field-select:focus, textarea:focus {
    border-color: var(--accent-blue);
    box-shadow: 0 0 0 3px rgba(91, 163, 255, 0.1);
}
```

---

## 6. Animations & Transitions

### Screen transitions (Phase 2 — CSS + minor JS change)

**CSS keyframes:**
```css
@keyframes screen-slide-in {
    from { opacity: 0; transform: translateX(40px); }
    to { opacity: 1; transform: translateX(0); }
}
@keyframes screen-slide-in-back {
    from { opacity: 0; transform: translateX(-40px); }
    to { opacity: 1; transform: translateX(0); }
}
```

**JS change to `transitionTo()`:** Add animation class to new screen's `.content` div:
```js
// In transitionTo(), after making screen active:
const content = screens[newMode].querySelector('.content') || screens[newMode];
content.style.animation = 'none'; // reset
void content.offsetHeight; // force reflow
content.style.animation = isBackNavigation ? 'screen-slide-in-back 0.25s ease-out' : 'screen-slide-in 0.25s ease-out';
```

**Back-navigation detection:** Track a simple depth map:
```js
const screenDepth = { 'input': 0, 'packs': 1, 'preview': 1, 'practice': 2, 'live': 3, 'completed': 4, 'editor-info': 1, 'editor-timeline': 2, 'editor-review': 3 };
// isBackNavigation = screenDepth[newMode] < screenDepth[state.mode]
```

### Micro-interactions
```css
/* Success flash — for "Copied!" feedback, draft saved, etc. */
@keyframes flash-success {
    0% { opacity: 0; transform: translateY(4px); }
    20% { opacity: 1; transform: translateY(0); }
    80% { opacity: 1; }
    100% { opacity: 0; }
}

/* Error shake — for validation errors */
@keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-4px); }
    40%, 80% { transform: translateX(4px); }
}
.shake { animation: shake 0.3s ease-out; }

/* Fade-in for dynamically added content */
@keyframes fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}
```

### Reduced motion (accessibility)
```css
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}
```

---

## 7. UX Issues (Prioritized)

### P0 — Critical (affects usability)

1. **No ARIA landmarks** — Screen readers can't navigate by region.
   - Fix (Phase 3): Add `role="main"` to `.content` divs, `role="banner"` to headers, `role="navigation"` where appropriate.

2. **No ARIA labels on icon buttons** — Audio toggle (speaker emoji), share button (box emoji) have no accessible names.
   - Fix (Phase 3): Add `aria-label` to `btn-audio-toggle`, `btn-audio-toggle-live`, `btn-share-qr-practice`, `btn-share-qr-preview`.

3. **Focus suppressed globally** — `outline: none` on `:focus` for inputs means keyboard users have no focus indicator.
   - Fix (Phase 2): Replace with `:focus-visible` pattern (see Section 5).

4. **No live stop confirmation** — Pressing "Stop" during a live event immediately exits with no warning. Could be accidental.
   - Fix (Phase 3): Add `confirm('Stop the live event? This cannot be undone.')` to `btn-live-stop` click handler.

### P1 — Important (affects first impression / flow)

5. **Value proposition hidden** — "What is this?" in a `<details>` tag means most users never see it.
   - Fix (Phase 3): Make the short tagline more descriptive and always visible. Keep `<details>` for the longer explanation but style the summary more prominently.

6. **Input screen button overload** — 6+ buttons with 5 "or" separators is visually noisy and overwhelming.
   - Fix (Phase 3): Group related actions. Primary group: paste/load + scan QR. Secondary group: create + demo. Utility: packs + share app. Reduce separators.

7. **No screen transition animations** — Screens swap instantly, which feels jarring and loses spatial context.
   - Fix (Phase 2): Add directional slide+fade (see Section 6).

8. **Step indicator in editor is plain text** — "Step 1 of 3" as text doesn't provide visual progress.
   - Fix (Phase 3): Replace with dot-based step indicator (●○○ / ●●○ / ●●●) alongside text.

### P2 — Nice to have (polish)

9. **No loading states for async operations** — Pack import, file loading, QR scanning show minimal feedback.
   - Fix (Phase 3): Add spinner or progress text for pack import (already partially done). Ensure consistent pattern.

10. **Completed screen is generic** — Just a green checkmark emoji and "Event Completed". Could be warmer.
    - Fix (Phase 2): Style the checkmark area with a subtle radial glow. Maybe use a CSS checkmark instead of emoji for consistency.

11. **Speed slider has no visual context** — Just "Speed" label, a slider, and "1x". No indication of what speeds mean.
    - Decision: Keep as-is. It's self-explanatory. Adding more text would clutter the practice screen.

12. **"Share This App" button position** — Buried at bottom of input screen below the fold on small screens.
    - Fix (Phase 3): Keep position but ensure it's visible when scrolling.

13. **Editor cancel has no confirmation** — "Cancel" on editor Step 1 exits without warning if fields have data.
    - Fix (Phase 3): Add confirmation if any field has been filled in.

---

## 8. Screen-by-Screen Redesign Notes

### 8.1 Input Screen (`screen-input`)

**Phase 2 (CSS only):**
- App logo: 32px, 800 weight, 4px letter-spacing for "CONDUCTOR"
- Tagline: `--text-secondary` color (brighter than current dim)
- Button spacing: Increase gap between button groups to 12px
- Reduce separator visual weight (thinner line, more transparent)
- Style the "What is this?" summary link with a subtle underline

**Phase 3 (HTML):**
- Group buttons: Primary actions (Load Event, Scan QR) | Creation (Create New, Demo) | Utilities (Packs, Share App)
- Reduce "or" separators from 5 to 2 (between each group)
- Make tagline slightly more descriptive: "Coordinate groups in real time with shared timed cues. No accounts, no servers, no app required."
- Add `role="main"` to content div
- Add `aria-label` to the import file input button

### 8.2 Preview Screen (`screen-preview`)

**Phase 2 (CSS only):**
- Event info card: Add border + shadow per card elevation system
- Action list items: Add colored left border based on action style
- Better visual separation between event info and action list
- Pack hint box: Already styled well, keep as-is

**Phase 3 (HTML):**
- Add `role="main"` to content div
- Ensure all interactive elements have accessible names

### 8.3 Practice Screen (`screen-practice`)

**Phase 2 (CSS only):**
- Controls area: Slightly darker background to separate from canvas
- Speed slider: Accent color already green, add subtle glow to value
- Button row: Icon buttons get glow effect on hover
- Add a subtle top border to controls section (green-tinted)

**Phase 3 (HTML):**
- Add `aria-label="Toggle audio"` to audio toggle (currently has title but no aria-label)
- Add `aria-label="Share via QR code"` to share button
- Add `role="main"` to canvas-wrap
- Add `aria-label` with speed value to the slider (dynamically updated)

### 8.4 Live Screen (`screen-live`)

**Phase 2 (CSS only):**
- More dramatic red atmosphere — controls area darker red-tinted
- LIVE badge pulse animation — keep existing, maybe slow down slightly (1.5s instead of 1.2s)
- Controls: Subtle red-tinted top border

**Phase 3 (HTML):**
- Add `confirm()` to Stop button
- Add `aria-label` to audio toggle
- Add `role="main"` to canvas-wrap

### 8.5 Completed Screen (`screen-completed`)

**Phase 2 (CSS only):**
- Replace emoji checkmark with CSS-drawn checkmark in a circle (more refined)
- Add subtle radial glow behind the checkmark (warm gold or green)
- "Event Completed" heading: Slightly larger, weight 700
- Button: Standard styling, nothing special needed

**Phase 3 (HTML):**
- Add `role="main"` to content div

### 8.6 Editor Step 1 — Event Info (`screen-editor-info`)

**Phase 2 (CSS only):**
- Field labels: Uppercase, tracked, 600 weight (see Typography section)
- Form inputs: Add focus glow (see Section 5)
- Purple accent atmosphere from header

**Phase 3 (HTML):**
- Replace "Step 1 of 3" text with dot-based step indicator: `<span class="step-dots"><span class="step-dot active"></span><span class="step-dot"></span><span class="step-dot"></span></span>`
- Add confirmation to Cancel button if fields have been filled
- Add `role="main"` to content div

Step indicator CSS (Phase 2):
```css
.step-dots {
    display: flex;
    gap: 6px;
    align-items: center;
}
.step-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    transition: background 0.2s, box-shadow 0.2s;
}
.step-dot.active {
    background: var(--accent-purple);
    box-shadow: 0 0 8px rgba(167, 139, 250, 0.4);
}
.step-dot.completed {
    background: var(--accent-purple);
}
```

### 8.7 Editor Step 2 — Timeline (`screen-editor-timeline`)

**Phase 2 (CSS only):**
- Action cards: Apply card elevation system
- "Add Action" dashed button: Keep dashed style but increase border-radius to match --radius
- Toggle buttons (.ed-toggle-btn): Slightly larger padding for touch
- Draft saved indicator: Use success flash animation

**Phase 3 (HTML):**
- Step indicator (●●○)
- Add `role="main"` to content div

### 8.8 Editor Step 3 — Review & Share (`screen-editor-review`)

**Phase 2 (CSS only):**
- Share section buttons: Group visually with slightly different background
- Share feedback text: Use success flash animation

**Phase 3 (HTML):**
- Step indicator (●●●)
- Add `role="main"` to content div

### 8.9 Pack Manager (`screen-packs`)

**Phase 2 (CSS only):**
- Pack cards: Apply card elevation system
- Delete button: Add glow-red on hover
- Import status messages: Already styled well, keep

**Phase 3 (HTML):**
- Add `role="main"` to content div
- Delete confirmation already exists (✓)

### 8.10 QR Overlays (Scanner + Display)

**Phase 2 (CSS only):**
- QR scanner: Subtle glow on the blue frame border (animated)
- QR display: Slightly larger canvas, centered with more padding
- Overlay backgrounds: Use --bg-deep for more contrast with the QR code

**Phase 3 (HTML):**
- Both already have `aria-label` on close buttons (✓)
- Add `role="dialog"` and `aria-modal="true"` to both overlays
- Add `aria-labelledby` pointing to the overlay title

---

## 9. Accessibility Improvements Summary (Phase 3)

### ARIA Landmarks
- All `.content` divs → `role="main"`
- All `.header` divs → `role="banner"`
- QR overlays → `role="dialog"` + `aria-modal="true"` + `aria-labelledby`

### ARIA Labels (missing)
- `btn-audio-toggle` → `aria-label="Toggle audio"`
- `btn-audio-toggle-live` → `aria-label="Toggle audio"`
- `btn-share-qr-practice` → `aria-label="Share via QR code"`
- `btn-share-qr-preview` → `aria-label="Share via QR code"`
- `btn-import-event` → `aria-label="Import event from file"`
- `btn-manage-packs` → `aria-label="Manage resource packs"`

### Dynamic ARIA
- Speed slider: `aria-label` updated on change (e.g., "Speed: 1.5x")
- Audio toggle: `aria-pressed` state tracking mute status
- Step indicators: `aria-current="step"` on active step

### Focus Management
- Already handled: heading focus on screen transition (✓)
- Add: `focus-visible` styling (Phase 2)
- Add: Focus trap in QR overlays (Phase 3)

### Reduced Motion
- Add `prefers-reduced-motion` media query (Phase 2)

---

## 10. Implementation Checklist

### Phase 2: CSS & Layout Overhaul
- [ ] Replace `:root` CSS variables with new color system
- [ ] Update body background to radial gradient
- [ ] Update all header backgrounds to gradients with border-bottom glow
- [ ] Update typography: logo, labels, badges, monospace
- [ ] Add card elevation styles (border + shadow)
- [ ] Add button glow effects on hover/focus
- [ ] Replace `:focus { outline: none }` with `:focus-visible` pattern
- [ ] Add focus glow to form inputs
- [ ] Add screen transition keyframes + JS modification to `transitionTo()`
- [ ] Add micro-interaction keyframes (flash-success, shake, fade-in)
- [ ] Add `prefers-reduced-motion` media query
- [ ] Add step-dot CSS (used by Phase 3 HTML changes)
- [ ] Add action-list left-border colored accent
- [ ] Update completed screen checkmark (CSS-drawn instead of emoji)
- [ ] Style controls sections (practice/live) with subtle top border
- [ ] Run full Playwright test suite — all tests must pass
- [ ] Bump SW version if needed (probably not for CSS-only changes)

### Phase 3: HTML Structure & Accessibility
- [ ] Add ARIA landmarks (`role="main"`, `role="banner"`)
- [ ] Add missing `aria-label` attributes on icon buttons
- [ ] Add `role="dialog"` + `aria-modal` to QR overlays
- [ ] Replace "Step X of 3" text with dot-based step indicators
- [ ] Add `confirm()` to live stop button
- [ ] Add `confirm()` to editor cancel (if fields filled)
- [ ] Restructure input screen button groups (reduce separators)
- [ ] Update input screen tagline text (more descriptive)
- [ ] Add `aria-pressed` to audio toggle buttons
- [ ] Add dynamic `aria-label` to speed slider
- [ ] Add focus trap to QR overlays
- [ ] Run full Playwright test suite

### Phase 4: Code Simplification & Final Verification
- [ ] Run simplify agent on CSS
- [ ] Run simplify agent on JS
- [ ] Address any findings
- [ ] Run full Playwright test suite (both browsers)
- [ ] Update SW version if needed
- [ ] Update MEMORY.md with new line counts/state

---

## 11. CSS Variable Migration Map

Old variable → New variable (for find-and-replace):

| Old | New | Notes |
|-----|-----|-------|
| `--bg: #1a1a2e` | `--bg: #0f0f23` | Darker base |
| `--bg-surface: #16213e` | `--bg-surface: #171733` | Warmer tone |
| `--bg-input: #0f1626` | `--bg-input: #0b0b1e` | Darker input fields |
| `--text: #e0e0e0` | `--text: #e8e6e3` | Warmer white |
| `--text-dim: rgba(255,255,255,0.45)` | `--text-dim: rgba(232,230,227,0.4)` | Warmer dim |
| `--accent-blue: #4A9EFF` | `--accent-blue: #5ba3ff` | Slightly warmer |
| `--accent-green: #34d399` | `--accent-green: #34d399` | Unchanged |
| `--accent-red: #FF3B3B` | `--accent-red: #ff4757` | Slightly more pink |
| `--accent-gold: #FFD700` | `--accent-gold: #f0b429` | Less harsh, warmer |
| `--radius: 10px` | `--radius: 12px` | Slightly rounder |
| (new) | `--bg-deep: #08081a` | New deepest background |
| (new) | `--bg-elevated: #1f1f42` | New elevated surface |
| (new) | `--text-secondary: rgba(232,230,227,0.7)` | New mid-brightness text |
| (new) | `--accent-purple: #a78bfa` | Explicit purple variable |
| (new) | `--glow-*` | Glow box-shadow values |
| (new) | `--border-subtle` | Standardized border |
| (new) | `--border-medium` | Standardized border |
| (new) | `--radius-sm: 8px` | Small radius |
| (new) | `--radius-lg: 16px` | Large radius |

---

## 12. Test Considerations

### What might break:
- Tests that check exact colors (unlikely — tests check functionality, not styling)
- Tests that check element visibility timing (screen transitions add 250ms animation)
  - **Mitigation:** The animation is on `.content` only, the `.screen.active` class swap is still instant. Elements are immediately present in DOM. Tests should be fine since they check for `.active` class and element visibility, which are synchronous.
- Tests that check `confirm()` dialogs (new confirmations in Phase 3)
  - **Mitigation:** Phase 3 must update tests that trigger live-stop to handle the confirmation dialog

### What should NOT break:
- All screen transition tests (class swap is synchronous)
- All event loading/sharing tests (no JS logic changes)
- All pack manager tests (no logic changes)
- All editor tests (no logic changes in Phase 2)
- All unit harness tests (modules are untouched)

---

## 13. Files Modified Per Phase

### Phase 2 (CSS + minor JS)
- `docs/index.html` — CSS variables, styles, 3-line JS change in `transitionTo()`
- No other files modified

### Phase 3 (HTML + JS)
- `docs/index.html` — HTML attributes, button groups, confirmations
- `tests/integration.spec.js` — Handle new `confirm()` dialogs in live-stop tests

### Phase 4 (Cleanup)
- `docs/index.html` — simplify agent changes
- `docs/sw.js` — version bump if needed
