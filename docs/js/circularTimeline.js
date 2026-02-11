/**
 * Conductor PWA - Circular Timeline Renderer
 * Ported from conductor-mobile/androidApp/.../CircularTimeline.kt
 *
 * "Guitar Hero" style circular timeline on HTML5 Canvas.
 * Actions rotate clockwise toward 12 o'clock (the trigger point).
 *
 * Requires: models.js, timingEngine.js
 */

// ─── Colors ─────────────────────────────────────────────────────────────────

const TimelineColors = Object.freeze({
    trackStroke:     'rgba(255, 255, 255, 0.15)',
    trackStrokeAlt:  'rgba(255, 255, 255, 0.08)',
    triggerRed:      '#FF3B3B',
    alertOrange:     '#FFA500',
    actionBlue:      '#4A9EFF',
    emphasisGold:    '#FFD700',
    textPrimary:     '#FFFFFF',
    textSecondary:   'rgba(255, 255, 255, 0.6)',
    textDim:         'rgba(255, 255, 255, 0.35)',
    markerLine:      'rgba(255, 255, 255, 0.25)',
    dotOutline:      'rgba(255, 255, 255, 0.8)',
    background:      '#1a1a2e',
    countdownYellow: '#FFD700',
});

// ─── Circular Timeline ──────────────────────────────────────────────────────

/**
 * Create a CircularTimeline renderer bound to a canvas element.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {CircularTimeline}
 */
function createCircularTimeline(canvas) {
    const ctx = canvas.getContext('2d');
    let animFrameId = null;
    let dpr = window.devicePixelRatio || 1;

    // State
    let event = null;
    let nowMs = Date.now();
    let windowSeconds = 60;
    let running = false;

    // Pulse animation state
    let pulsePhase = 0;

    // ─── Sizing ─────────────────────────────────────────────────

    /**
     * Resize canvas for crisp rendering at device pixel ratio.
     */
    function resize() {
        dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ─── Render ─────────────────────────────────────────────────

    /**
     * Main render function. Draws the full timeline for the current state.
     */
    function render() {
        const w = canvas.width / dpr;
        const h = canvas.height / dpr;
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(w, h) / 2.8;

        // Clear
        ctx.clearRect(0, 0, w, h);

        if (!event) {
            drawPlaceholder(cx, cy, radius);
            return;
        }

        const timeline = event.timeline;
        const currentAction = getCurrentAction(timeline, nowMs);
        const upcoming = getUpcomingActions(timeline, nowMs, windowSeconds);

        // 1. Track circle
        drawTrack(cx, cy, radius);

        // 2. Time markers (15s, 30s, 45s)
        drawTimeMarkers(cx, cy, radius, windowSeconds);

        // 3. Trigger indicator at 12 o'clock
        drawTriggerIndicator(cx, cy, radius);

        // 4. Action dots
        for (const action of upcoming) {
            const pos = calculatePosition(action, nowMs, windowSeconds);
            const secUntil = calculateTimeUntilPrecise(action, nowMs);
            const status = getActionStatus(action, nowMs);
            drawActionDot(action, pos, cx, cy, radius, secUntil, status);
        }

        // Also draw recently past actions (within 5s) so they don't pop out instantly
        for (const action of timeline) {
            const secUntil = calculateTimeUntilPrecise(action, nowMs);
            if (secUntil < 0 && secUntil > -5) {
                const pos = calculatePosition(action, nowMs, windowSeconds);
                const status = ActionStatus.PAST;
                drawActionDot(action, pos, cx, cy, radius, secUntil, status, true);
            }
        }

        // 5. Current action — pulsing rings at trigger point
        if (currentAction) {
            drawTriggerPulse(cx, cy, radius);
        }

        // 6. Center text
        drawCenterText(cx, cy, currentAction, timeline);

        // Advance pulse
        pulsePhase = (pulsePhase + 0.03) % (Math.PI * 2);
    }

    // ─── Drawing helpers ────────────────────────────────────────

    function drawPlaceholder(cx, cy, radius) {
        ctx.strokeStyle = TimelineColors.trackStroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = TimelineColors.textDim;
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No event loaded', cx, cy);
    }

    function drawTrack(cx, cy, radius) {
        // Outer track
        ctx.strokeStyle = TimelineColors.trackStroke;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner subtle track
        ctx.strokeStyle = TimelineColors.trackStrokeAlt;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.85, 0, Math.PI * 2);
        ctx.stroke();
    }

    function drawTriggerIndicator(cx, cy, radius) {
        const tipY = cy - radius - 18;
        const baseY = cy - radius - 4;
        const halfW = 10;

        // Triangle pointing down toward circle
        ctx.fillStyle = TimelineColors.triggerRed;
        ctx.beginPath();
        ctx.moveTo(cx, baseY);
        ctx.lineTo(cx - halfW, tipY);
        ctx.lineTo(cx + halfW, tipY);
        ctx.closePath();
        ctx.fill();

        // Small glow
        ctx.shadowColor = TimelineColors.triggerRed;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    function drawTimeMarkers(cx, cy, radius, winSec) {
        const markers = [15, 30, 45];

        for (const sec of markers) {
            if (sec >= winSec) continue;

            const degrees = 360 * sec / winSec;
            const rad = (degrees - 90) * Math.PI / 180; // -90 so 0° = top

            const innerR = radius - 6;
            const outerR = radius + 10;

            const x1 = cx + innerR * Math.cos(rad);
            const y1 = cy + innerR * Math.sin(rad);
            const x2 = cx + outerR * Math.cos(rad);
            const y2 = cy + outerR * Math.sin(rad);

            ctx.strokeStyle = TimelineColors.markerLine;
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Label
            const labelR = outerR + 14;
            const lx = cx + labelR * Math.cos(rad);
            const ly = cy + labelR * Math.sin(rad);

            ctx.fillStyle = TimelineColors.textDim;
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${sec}s`, lx, ly);
        }
    }

    function drawActionDot(action, positionDegrees, cx, cy, radius, secUntil, status, fading) {
        const rad = (positionDegrees - 90) * Math.PI / 180;
        const x = cx + radius * Math.cos(rad);
        const y = cy + radius * Math.sin(rad);

        // Color by style
        let color;
        switch (action.style) {
            case 'alert':    color = TimelineColors.triggerRed; break;
            case 'emphasis': color = TimelineColors.emphasisGold; break;
            default:         color = TimelineColors.actionBlue;
        }

        // Size grows as action approaches (proximity factor 0→1)
        const proximity = Math.max(0, Math.min(1, (windowSeconds - Math.max(0, secUntil)) / windowSeconds));
        const dotR = 5 + 7 * proximity;

        // Fading past actions
        let alpha = 1;
        if (fading && secUntil < 0) {
            alpha = Math.max(0, 1 + secUntil / 5); // Fade over 5s
        }

        ctx.globalAlpha = alpha;

        // Glow for imminent actions
        if (status === ActionStatus.IMMINENT) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 12;
        }

        // Dot fill
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fill();

        // Outline
        ctx.strokeStyle = TimelineColors.dotOutline;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // Action label (for larger dots only, to avoid clutter)
        if (dotR > 8 && action.action) {
            const labelText = action.action.length > 20
                ? action.action.substring(0, 18) + '...'
                : action.action;

            // Position label outside the circle
            const labelRad = radius + 28;
            const lx = cx + labelRad * Math.cos(rad);
            const ly = cy + labelRad * Math.sin(rad);

            ctx.fillStyle = TimelineColors.textSecondary;
            ctx.font = '11px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = alpha;
            ctx.fillText(labelText, lx, ly);
            ctx.globalAlpha = 1;
        }
    }

    function drawTriggerPulse(cx, cy, radius) {
        const trigX = cx;
        const trigY = cy - radius;

        // Animated expanding rings
        for (let i = 0; i < 3; i++) {
            const phase = (pulsePhase + i * Math.PI * 2 / 3) % (Math.PI * 2);
            const scale = 0.5 + 0.5 * Math.sin(phase);
            const ringR = 12 + 18 * scale;
            const alpha = 0.4 * (1 - scale);

            ctx.strokeStyle = TimelineColors.triggerRed;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(trigX, trigY, ringR, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Solid center
        ctx.fillStyle = TimelineColors.triggerRed;
        ctx.shadowColor = TimelineColors.triggerRed;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(trigX, trigY, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // White outline
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function drawCenterText(cx, cy, currentAction, timeline) {
        if (currentAction) {
            // "NOW" in big red
            ctx.fillStyle = TimelineColors.triggerRed;
            ctx.font = 'bold 28px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = TimelineColors.triggerRed;
            ctx.shadowBlur = 10;
            ctx.fillText('NOW', cx, cy - 12);
            ctx.shadowBlur = 0;

            // Action name below
            const name = currentAction.action.length > 28
                ? currentAction.action.substring(0, 25) + '...'
                : currentAction.action;
            ctx.fillStyle = TimelineColors.textSecondary;
            ctx.font = '13px monospace';
            ctx.fillText(name, cx, cy + 14);
        } else {
            // Find next upcoming action for countdown
            const nextActions = getUpcomingActions(timeline, nowMs, windowSeconds);
            if (nextActions.length > 0) {
                const next = nextActions[0];
                const secUntil = calculateTimeUntilPrecise(next, nowMs);
                const rounded = Math.ceil(secUntil);

                if (rounded <= 10 && rounded > 0) {
                    // Countdown number
                    ctx.fillStyle = TimelineColors.countdownYellow;
                    ctx.font = 'bold 36px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(String(rounded), cx, cy - 12);

                    // Action name
                    const name = next.action.length > 28
                        ? next.action.substring(0, 25) + '...'
                        : next.action;
                    ctx.fillStyle = TimelineColors.textSecondary;
                    ctx.font = '12px monospace';
                    ctx.fillText(name, cx, cy + 14);
                } else if (rounded > 0) {
                    // Time until next
                    ctx.fillStyle = TimelineColors.textPrimary;
                    ctx.font = '20px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(formatCountdown(rounded), cx, cy - 8);

                    ctx.fillStyle = TimelineColors.textDim;
                    ctx.font = '11px monospace';
                    ctx.fillText('until next action', cx, cy + 12);
                }
            } else {
                // No upcoming actions
                ctx.fillStyle = TimelineColors.textDim;
                ctx.font = '14px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('Waiting...', cx, cy);
            }
        }
    }

    function formatCountdown(seconds) {
        if (seconds < 60) return `${seconds}s`;
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    // ─── Animation loop ─────────────────────────────────────────

    function tick() {
        if (!running) return;
        nowMs = Date.now();
        render();
        animFrameId = requestAnimationFrame(tick);
    }

    // ─── Public API ─────────────────────────────────────────────

    return {
        /**
         * Set the event to display.
         * @param {Event} evt
         */
        setEvent(evt) {
            event = evt;
            // Auto-zoom based on upcoming action density
            if (evt && evt.timeline.length > 0) {
                const upcoming = getUpcomingActions(evt.timeline, nowMs, 120);
                windowSeconds = calculateOptimalZoom(upcoming, evt.timeWindowSeconds || 60);
            }
        },

        /**
         * Set current time (for testing or practice mode).
         * @param {number} ms - Epoch milliseconds
         */
        setNowMs(ms) {
            nowMs = ms;
        },

        /**
         * Set the window size in seconds.
         * @param {number} sec
         */
        setWindowSeconds(sec) {
            windowSeconds = sec;
        },

        /**
         * Get current window seconds.
         * @returns {number}
         */
        getWindowSeconds() {
            return windowSeconds;
        },

        /** Resize canvas (call on window resize). */
        resize,

        /** Render one frame (for testing without animation loop). */
        render,

        /**
         * Start the 60fps animation loop.
         */
        start() {
            if (running) return;
            running = true;
            resize();
            tick();
        },

        /**
         * Stop the animation loop.
         */
        stop() {
            running = false;
            if (animFrameId) {
                cancelAnimationFrame(animFrameId);
                animFrameId = null;
            }
        },

        /** @returns {boolean} */
        isRunning() { return running; },
    };
}
