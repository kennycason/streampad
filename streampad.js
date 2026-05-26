// StreamPad - Neon DDR-Style Controller Visualizer
// Enhanced with visual effects controllable via query params

// ===== EFFECTS ENGINE =====
class EffectsEngine {
    constructor() {
        this.params = new URLSearchParams(window.location.search);
        this.starfieldCanvas = document.getElementById('starfield');
        this.starfieldCtx = this.starfieldCanvas ? this.starfieldCanvas.getContext('2d') : null;
        this.stars = [];
        this.matrixDrops = [];
        this.lightning = new LightningEngine();
        this.applyEffects();
    }

    applyEffects() {
        // Toggle CSS effect classes based on query params
        // Usage: ?glow=true&pulse=true&flash=true&rainbow=true&scanlines=true&vaporwave=true&matrix=true&stars=true
        const effects = ['glow', 'pulse', 'flash', 'rainbow', 'scanlines', 'vaporwave', 'matrix'];

        // If ?all=true, enable everything
        const enableAll = this.params.get('all') === 'true';

        for (const fx of effects) {
            if (enableAll || this.params.get(fx) === 'true') {
                document.body.classList.add(`fx-${fx}`);
            }
        }

        // Spacing between lanes: ?spacing=10
        const spacing = this.params.get('spacing');
        if (spacing !== null) {
            document.documentElement.style.setProperty('--lane-spacing', spacing + 'px');
        }

        // Lightning effect: ?lightning=true, ?lightningMaxAngle=25
        if (enableAll || this.params.get('lightning') === 'true') {
            const maxAngle = parseInt(this.params.get('lightningMaxAngle')) || 25;
            this.lightning.enable(Math.max(1, Math.min(90, maxAngle)));
        }

        // Stars/starfield background - enabled by default, disable with ?stars=false
        const starsEnabled = this.params.get('stars') !== 'false';
        const matrixEnabled = enableAll || this.params.get('matrix') === 'true';

        if (this.starfieldCanvas && this.starfieldCtx) {
            if (matrixEnabled) {
                this.initMatrix();
            } else if (starsEnabled) {
                this.initStarfield();
            }
        }
    }

    initStarfield() {
        const canvas = this.starfieldCanvas;
        const ctx = this.starfieldCtx;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        // Create stars
        for (let i = 0; i < 120; i++) {
            this.stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 0.3 + 0.05,
                brightness: Math.random(),
                hue: Math.random() * 60 + 250 // Purple-blue range
            });
        }

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (const star of this.stars) {
                star.brightness += (Math.random() - 0.5) * 0.05;
                star.brightness = Math.max(0.2, Math.min(1, star.brightness));
                star.y -= star.speed;
                if (star.y < -5) {
                    star.y = canvas.height + 5;
                    star.x = Math.random() * canvas.width;
                }

                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${star.hue}, 80%, 70%, ${star.brightness * 0.6})`;
                ctx.fill();
            }

            requestAnimationFrame(animate);
        };
        animate();
    }

    initMatrix() {
        const canvas = this.starfieldCanvas;
        const ctx = this.starfieldCtx;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            // Recalculate columns on resize
            const newCols = Math.floor(canvas.width / maxSize);
            while (this.matrixDrops.length < newCols) this.matrixDrops.push(0);
            this.matrixDrops.length = newCols;
        };

        // Parse params
        const speed = Math.max(1, Math.min(100, parseInt(this.params.get('matrixSpeed')) || 20));
        const charsParam = this.params.get('matrixChars');
        const chars = charsParam ? [...charsParam] : [...'ABXY0123456789@#$%&*<>[]{}'];
        const maxSize = Math.max(8, Math.min(72, parseInt(this.params.get('matrixCharsMaxSize')) || 14));

        resize();
        window.addEventListener('resize', resize);

        const columns = Math.floor(canvas.width / maxSize);
        this.matrixDrops = new Array(columns).fill(0);
        const preserveOrder = this.params.get('matrixPreserveOrder') === 'true';
        // Each column gets its own character index, starting at a random offset
        const colCharIndex = new Array(columns).fill(0).map(() => Math.floor(Math.random() * chars.length));

        // speed=1 is very slow, speed=100 is original fast. Map to frame skip.
        // At speed=100, run every frame. At speed=1, run every ~6 frames.
        const frameInterval = Math.max(1, Math.round(6 - (speed / 100) * 5));
        let frameCount = 0;

        const animate = () => {
            frameCount++;
            if (frameCount % frameInterval === 0) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.fillStyle = 'rgba(0, 255, 100, 0.4)';
                ctx.font = `${maxSize}px monospace`;

                for (let i = 0; i < this.matrixDrops.length; i++) {
                    let char;
                    if (preserveOrder) {
                        if (colCharIndex[i] === undefined) colCharIndex[i] = Math.floor(Math.random() * chars.length);
                        char = chars[colCharIndex[i] % chars.length] || ' ';
                        colCharIndex[i]++;
                    } else {
                        char = chars[Math.floor(Math.random() * chars.length)] || ' ';
                    }
                    if (!char || char === 'undefined') char = ' ';
                    ctx.fillText(char, i * maxSize, this.matrixDrops[i] * maxSize);

                    if (this.matrixDrops[i] * maxSize > canvas.height && Math.random() > 0.975) {
                        this.matrixDrops[i] = 0;
                        // Reset to a new random start position in the sequence
                        if (preserveOrder) colCharIndex[i] = Math.floor(Math.random() * chars.length);
                    }
                    this.matrixDrops[i]++;
                }
            }

            requestAnimationFrame(animate);
        };
        animate();
    }
}


// ===== LIGHTNING ENGINE =====
// Ghostbusters-style persistent energy beams that lock onto notes and chain between them.
// While a button is held, electricity crackles around the button and beams track rising notes.
class LightningEngine {
    constructor() {
        this.canvas = document.getElementById('lightning');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.enabled = false;
        this.activeBeams = new Map(); // buttonId -> beam state
        this.fadeBolts = []; // One-shot fading bolts (release flash)
        this.maxAngle = 25; // degrees - default jitter angle for stochastic segments
        this.lanes = {};
        this.noteColors = {};

        if (this.canvas && this.ctx) {
            const resize = () => {
                this.canvas.width = window.innerWidth;
                this.canvas.height = window.innerHeight;
            };
            resize();
            window.addEventListener('resize', resize);
            this.animate();
        }
    }

    enable(maxAngle) {
        this.enabled = true;
        if (maxAngle !== undefined) this.maxAngle = maxAngle;
    }

    setRefs(lanes, noteColors) {
        this.lanes = lanes;
        this.noteColors = noteColors;
    }

    // Called on button press - start a persistent beam
    startBeam(buttonId) {
        if (!this.enabled) return;
        this.activeBeams.set(buttonId, { startTime: Date.now() });
    }

    // Called on button release - stop the beam, leave a fading flash
    endBeam(buttonId) {
        if (!this.enabled) return;
        const beam = this.activeBeams.get(buttonId);
        if (beam && beam.lastSegments) {
            this.fadeBolts.push({
                segments: beam.lastSegments,
                color: this.noteColors[buttonId] || '#fff',
                life: 1.0
            });
        }
        this.activeBeams.delete(buttonId);
    }

    // Get all visible note rectangles in viewport coords with full corner info
    getActiveNoteRects() {
        const rects = [];
        for (const note of document.querySelectorAll('.ddr-note')) {
            const r = note.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
                rects.push({
                    x: r.left + r.width / 2, y: r.top + r.height / 2,
                    w: r.width, h: r.height,
                    left: r.left, right: r.right, top: r.top, bottom: r.bottom,
                    corners: [
                        { x: r.left, y: r.top },       // TL
                        { x: r.right, y: r.top },      // TR
                        { x: r.right, y: r.bottom },   // BR
                        { x: r.left, y: r.bottom }      // BL
                    ]
                });
            }
        }
        return rects;
    }

    // Get the 4 corners of a button element
    getButtonCorners(btnRect) {
        return [
            { x: btnRect.left, y: btnRect.top },
            { x: btnRect.right, y: btnRect.top },
            { x: btnRect.right, y: btnRect.bottom },
            { x: btnRect.left, y: btnRect.bottom }
        ];
    }

    // Find the closest corner of a rect to a given point
    closestCorner(corners, px, py) {
        let best = corners[0], bestDist = Infinity;
        for (const c of corners) {
            const d = Math.hypot(c.x - px, c.y - py);
            if (d < bestDist) { bestDist = d; best = c; }
        }
        return best;
    }

    // Find the corner index
    cornerIndex(corners, corner) {
        for (let i = 0; i < corners.length; i++) {
            if (corners[i].x === corner.x && corners[i].y === corner.y) return i;
        }
        return 0;
    }

    // Generate stochastic path that hugs the perimeter of a rectangle
    // Walks from arriveCorner around the edges with jitter, exits at exitCorner
    generatePerimeterPath(rect, arriveCornerIdx, exitCornerIdx) {
        const corners = rect.corners;
        const segments = [];
        const maxAngleRad = (this.maxAngle * Math.PI) / 180;

        // Walk around the perimeter from arrive to exit (shortest direction)
        let idx = arriveCornerIdx;
        const steps = [];

        // Try both directions, pick shorter
        let cwSteps = 0, ccwSteps = 0;
        let ti = arriveCornerIdx;
        while (ti !== exitCornerIdx) { ti = (ti + 1) % 4; cwSteps++; }
        ti = arriveCornerIdx;
        while (ti !== exitCornerIdx) { ti = (ti + 3) % 4; ccwSteps++; }

        const dir = cwSteps <= ccwSteps ? 1 : 3; // 1=CW, 3=CCW
        const totalEdges = Math.min(cwSteps, ccwSteps);

        // If arrive === exit, walk the full perimeter
        const edgeCount = totalEdges === 0 ? 4 : totalEdges;

        let cur = corners[arriveCornerIdx];
        for (let e = 0; e < edgeCount; e++) {
            const nextIdx = (idx + dir) % 4;
            const next = corners[nextIdx];

            // Walk this edge with stochastic jitter
            const edgeDist = Math.hypot(next.x - cur.x, next.y - cur.y);
            const edgeSteps = Math.max(2, Math.floor(edgeDist / 10));
            const edgeAngle = Math.atan2(next.y - cur.y, next.x - cur.x);
            const perpAngle = edgeAngle + Math.PI / 2;

            let prev = cur;
            for (let s = 1; s <= edgeSteps; s++) {
                const t = s / edgeSteps;
                const baseX = cur.x + (next.x - cur.x) * t;
                const baseY = cur.y + (next.y - cur.y) * t;

                let jitter = 0;
                if (s < edgeSteps) {
                    // Jitter outward from the rect center
                    jitter = (Math.random() - 0.3) * Math.tan(maxAngleRad) * 8;
                }

                const px = baseX + Math.cos(perpAngle) * jitter;
                const py = baseY + Math.sin(perpAngle) * jitter;
                segments.push({ x1: prev.x, y1: prev.y, x2: px, y2: py });
                prev = { x: px, y: py };
            }

            idx = nextIdx;
            cur = next;
        }

        return segments;
    }

    // Generate a stochastic beam path from point A to point B (free space jump)
    generateBeamPath(x1, y1, x2, y2) {
        const maxAngleRad = (this.maxAngle * Math.PI) / 180;
        const points = [{ x: x1, y: y1 }];
        const dist = Math.hypot(x2 - x1, y2 - y1);
        const segLen = 12;
        const steps = Math.max(2, Math.floor(dist / segLen));
        const baseAngle = Math.atan2(y2 - y1, x2 - x1);

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const idealX = x1 + (x2 - x1) * t;
            const idealY = y1 + (y2 - y1) * t;
            const perpAngle = baseAngle + Math.PI / 2;
            const wanderAmount = (Math.random() - 0.5) * 2 * Math.tan(maxAngleRad) * segLen;
            const blend = Math.sin(t * Math.PI);

            if (i < steps) {
                points.push({
                    x: idealX + Math.cos(perpAngle) * wanderAmount * blend,
                    y: idealY + Math.sin(perpAngle) * wanderAmount * blend
                });
            } else {
                points.push({ x: x2, y: y2 });
            }
        }

        return points;
    }

    // Generate crackle segments hugging a rectangle's perimeter
    generateCrackle(cx, cy, w, h, color, intensity) {
        const segments = [];
        const count = 3 + Math.floor(Math.random() * 3 * intensity);
        const maxAngleRad = (this.maxAngle * Math.PI) / 180;

        for (let i = 0; i < count; i++) {
            // Pick a random start point on the perimeter
            const perim = 2 * (w + h);
            let d = Math.random() * perim;
            let sx, sy, edgeAngle;

            if (d < w) {                            // top edge
                sx = cx - w/2 + d; sy = cy - h/2; edgeAngle = 0;
            } else if (d < w + h) {                 // right edge
                d -= w; sx = cx + w/2; sy = cy - h/2 + d; edgeAngle = Math.PI/2;
            } else if (d < 2*w + h) {               // bottom edge
                d -= w + h; sx = cx + w/2 - d; sy = cy + h/2; edgeAngle = Math.PI;
            } else {                                 // left edge
                d -= 2*w + h; sx = cx - w/2; sy = cy + h/2 - d; edgeAngle = -Math.PI/2;
            }

            // Walk along the edge with jitter for a short stretch
            const perpAngle = edgeAngle + Math.PI / 2;
            const walkLen = 10 + Math.random() * 25 * intensity;
            const walkSteps = 3 + Math.floor(Math.random() * 3);
            let px = sx, py = sy;

            for (let j = 0; j < walkSteps; j++) {
                const stepLen = walkLen / walkSteps;
                const jitter = (Math.random() - 0.3) * Math.tan(maxAngleRad) * 6;
                const nx = px + Math.cos(edgeAngle) * stepLen + Math.cos(perpAngle) * jitter;
                const ny = py + Math.sin(edgeAngle) * stepLen + Math.sin(perpAngle) * jitter;
                segments.push({ x1: px, y1: py, x2: nx, y2: ny });
                px = nx; py = ny;
            }
        }
        return segments;
    }

    animate() {
        const ctx = this.ctx;

        const loop = () => {
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            if (this.enabled) {
                const allNotes = this.getActiveNoteRects();

                // Draw active beams (held buttons)
                for (const [buttonId, beam] of this.activeBeams) {
                    const lane = this.lanes[buttonId];
                    if (!lane) continue;

                    const color = this.noteColors[buttonId] || '#FFFFFF';
                    const btnRect = lane.button.getBoundingClientRect();
                    const btnCx = btnRect.left + btnRect.width / 2;
                    const btnCy = btnRect.top + btnRect.height / 2;
                    const btnTop = btnRect.top;

                    const holdTime = (Date.now() - beam.startTime) / 1000;
                    const intensity = Math.min(1, holdTime * 2); // Ramp up over 0.5s

                    // 1. Crackle hugging the button perimeter
                    const crackle = this.generateCrackle(btnCx, btnCy, btnRect.width, btnRect.height, color, intensity);
                    this.drawSegments(ctx, crackle, color, 0.6 * intensity, 6);

                    // 2. Find ALL notes above this button, sorted by distance
                    const targets = allNotes
                        .filter(n => n.y < btnTop + 10);

                    // Build ordered chain via greedy nearest-neighbor
                    const chain = []; // Each entry: { rect, arriveCorner }
                    const used = new Set();
                    const btnCorners = this.getButtonCorners(btnRect);

                    // Start from the button's top-center area - pick closest button corner to first note
                    let curPos = { x: btnCx, y: btnTop };

                    while (used.size < targets.length) {
                        let best = null;
                        let bestDist = Infinity;
                        for (const t of targets) {
                            if (used.has(t)) continue;
                            // Distance from current position to nearest corner of this note
                            const nearest = this.closestCorner(t.corners, curPos.x, curPos.y);
                            const d = Math.hypot(nearest.x - curPos.x, nearest.y - curPos.y);
                            if (d < bestDist) { bestDist = d; best = t; }
                        }
                        if (!best) break;
                        used.add(best);

                        const arriveCorner = this.closestCorner(best.corners, curPos.x, curPos.y);
                        chain.push({ rect: best, arriveCorner });

                        // Current position becomes a random corner on the far side of this note
                        // (to encourage the beam to wrap around before jumping)
                        const arriveIdx = this.cornerIndex(best.corners, arriveCorner);
                        // Exit from the opposite-ish corner (2 corners away)
                        const exitIdx = (arriveIdx + 2) % 4;
                        curPos = best.corners[exitIdx];
                    }

                    // 3. Generate the full beam: button -> chain of notes -> off screen
                    const allSegments = [];

                    // Start from button corner closest to the first target
                    let beamPos;
                    if (chain.length > 0) {
                        beamPos = this.closestCorner(btnCorners, chain[0].arriveCorner.x, chain[0].arriveCorner.y);
                    } else {
                        beamPos = { x: btnCx, y: btnTop };
                    }

                    for (let i = 0; i < chain.length; i++) {
                        const { rect, arriveCorner } = chain[i];
                        const arriveIdx = this.cornerIndex(rect.corners, arriveCorner);

                        // Jump beam from current position to the arrive corner
                        const jumpPath = this.generateBeamPath(beamPos.x, beamPos.y, arriveCorner.x, arriveCorner.y);
                        for (let j = 0; j < jumpPath.length - 1; j++) {
                            allSegments.push({ x1: jumpPath[j].x, y1: jumpPath[j].y, x2: jumpPath[j+1].x, y2: jumpPath[j+1].y });
                        }

                        // Pick exit corner: the one closest to the NEXT target, or opposite if last
                        let exitIdx;
                        if (i < chain.length - 1) {
                            const nextArrive = chain[i + 1].arriveCorner;
                            const exitCorner = this.closestCorner(rect.corners, nextArrive.x, nextArrive.y);
                            exitIdx = this.cornerIndex(rect.corners, exitCorner);
                        } else {
                            // Last note - exit from the topmost corner
                            exitIdx = rect.corners[0].y <= rect.corners[1].y ? 0 : 1;
                        }

                        // Flow around the rectangle perimeter from arrive to exit
                        const perimSegs = this.generatePerimeterPath(rect, arriveIdx, exitIdx);
                        allSegments.push(...perimSegs);

                        beamPos = rect.corners[exitIdx];
                    }

                    // Continue beam off the top of the screen
                    if (beamPos.y > -50) {
                        const drift = (Math.random() - 0.5) * 60;
                        const midPath = this.generateBeamPath(beamPos.x, beamPos.y, beamPos.x + drift * 0.5, beamPos.y * 0.5);
                        for (let j = 0; j < midPath.length - 1; j++) {
                            allSegments.push({ x1: midPath[j].x, y1: midPath[j].y, x2: midPath[j+1].x, y2: midPath[j+1].y });
                        }
                        const topPath = this.generateBeamPath(beamPos.x + drift * 0.5, beamPos.y * 0.5, beamPos.x + drift, -20);
                        for (let j = 0; j < topPath.length - 1; j++) {
                            allSegments.push({ x1: topPath[j].x, y1: topPath[j].y, x2: topPath[j+1].x, y2: topPath[j+1].y });
                        }
                    }

                    beam.lastSegments = allSegments;

                    // Draw the beam with 3 layers
                    this.drawSegments(ctx, allSegments, color, 0.85 * intensity, 10 + intensity * 6);
                }
            }

            // Draw fading bolts (release flashes)
            for (let i = this.fadeBolts.length - 1; i >= 0; i--) {
                const bolt = this.fadeBolts[i];
                bolt.life -= 0.04;
                if (bolt.life <= 0) {
                    this.fadeBolts.splice(i, 1);
                    continue;
                }
                this.drawSegments(ctx, bolt.segments, bolt.color, bolt.life * 0.6, 8);
            }

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    // Draw segments with 3-layer glow: outer glow, colored mid, white core
    drawSegments(ctx, segments, color, alpha, glowSize) {
        if (segments.length === 0) return;

        // Outer glow
        ctx.save();
        ctx.globalAlpha = alpha * 0.25;
        ctx.strokeStyle = color;
        ctx.lineWidth = glowSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = color;
        ctx.shadowBlur = glowSize * 1.5;
        ctx.beginPath();
        for (const s of segments) { ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }
        ctx.stroke();
        ctx.restore();

        // Colored mid line
        ctx.save();
        ctx.globalAlpha = alpha * 0.7;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, glowSize * 0.3);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (const s of segments) { ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }
        ctx.stroke();
        ctx.restore();

        // White core
        ctx.save();
        ctx.globalAlpha = alpha * 0.9;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        for (const s of segments) { ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }
        ctx.stroke();
        ctx.restore();
    }
}


// ===== SNI gRPC-web CLIENT =====
// Reads SNES controller input from real hardware via SNI's gRPC-web interface.
// SNI exposes gRPC-web on port 8190 by default.
// Since $4218 (joypad registers) can't be read directly via FxPak Pro cart bus,
// we read the game's joypad mirror in WRAM (FxPakPro address space $F50000+offset).

class SNIClient {
    constructor(logger) {
        this.logger = logger;
        this.params = new URLSearchParams(window.location.search);
        this.url = this.params.get('sniUrl') || 'http://localhost:8190';
        this.deviceUri = null;
        this.polling = false;
        this.pollTimer = null;
        this.lastButtons = 0;
        // FxPakPro WRAM base (maps to SNES $7E:0000)
        this.FXPAK_WRAM = 0xF50000;
        // Default joypad offset - will be auto-detected from ROM title
        this.joypadOffset = 0x8B;
        // SNES button bit layout (16-bit LE from WRAM):
        // lo byte ($4218): A(7) X(6) L(5) R(4)
        // hi byte ($4219): B(7) Y(6) Sel(5) Sta(4) Up(3) Down(2) Left(1) Right(0)
        this.SNI_BUTTON_MAP = {
            'B':  { byte: 1, bit: 7, laneId: '0' },
            'Y':  { byte: 1, bit: 6, laneId: '2' },
            'Sel':{ byte: 1, bit: 5, laneId: '8' },
            'Sta':{ byte: 1, bit: 4, laneId: '9' },
            'Up': { byte: 1, bit: 3, laneId: '12' },
            'Dn': { byte: 1, bit: 2, laneId: '13' },
            'Lt': { byte: 1, bit: 1, laneId: '14' },
            'Rt': { byte: 1, bit: 0, laneId: '15' },
            'A':  { byte: 0, bit: 7, laneId: '1' },
            'X':  { byte: 0, bit: 6, laneId: '3' },
            'L':  { byte: 0, bit: 5, laneId: '4' },
            'R':  { byte: 0, bit: 4, laneId: '5' },
        };
    }

    // --- Minimal protobuf encoder ---
    _varint(val) {
        const out = [];
        val = val >>> 0;
        do { let b = val & 0x7f; val >>>= 7; if (val > 0) b |= 0x80; out.push(b); } while (val > 0);
        return out;
    }
    _tagVarint(f, v) { return [...this._varint((f << 3) | 0), ...this._varint(v)]; }
    _tagString(f, s) {
        const b = new TextEncoder().encode(s);
        return [...this._varint((f << 3) | 2), ...this._varint(b.length), ...b];
    }
    _tagBytes(f, b) { return [...this._varint((f << 3) | 2), ...this._varint(b.length), ...b]; }

    // --- Minimal protobuf decoder ---
    _readVarint(data, pos) {
        let r = 0, s = 0;
        while (pos < data.length) {
            const b = data[pos++]; r |= (b & 0x7f) << s;
            if (!(b & 0x80)) break; s += 7;
        }
        return [r >>> 0, pos];
    }
    _decodeFields(data) {
        const fields = []; let pos = 0;
        while (pos < data.length) {
            const [tag, p1] = this._readVarint(data, pos); pos = p1;
            const fn = tag >>> 3, wt = tag & 7;
            let val;
            if (wt === 0) { [val, pos] = this._readVarint(data, pos); }
            else if (wt === 2) { const [len, p2] = this._readVarint(data, pos); pos = p2; val = data.slice(pos, pos + len); pos += len; }
            else if (wt === 1) { val = data.slice(pos, pos + 8); pos += 8; }
            else if (wt === 5) { val = data.slice(pos, pos + 4); pos += 4; }
            else return fields;
            fields.push({ fn, wt, val });
        }
        return fields;
    }

    // --- gRPC-web transport ---
    async _grpc(path, reqBytes, quiet) {
        const frame = new Uint8Array(5 + reqBytes.length);
        frame[0] = 0x00;
        new DataView(frame.buffer).setUint32(1, reqBytes.length, false);
        frame.set(reqBytes, 5);

        const resp = await fetch(`${this.url}/${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/grpc-web+proto', 'X-Grpc-Web': '1' },
            body: frame,
        });

        const gs = resp.headers.get('Grpc-Status');
        const gm = resp.headers.get('Grpc-Message');
        if (gs && gs !== '0') throw new Error(`gRPC ${gs}: ${gm ? decodeURIComponent(gm) : ''}`);

        const buf = new Uint8Array(await resp.arrayBuffer());
        const frames = [];
        let p = 0;
        while (p + 5 <= buf.length) {
            const flags = buf[p];
            const len = new DataView(buf.buffer, p + 1, 4).getUint32(0, false);
            p += 5;
            if (p + len > buf.length) break;
            const payload = buf.slice(p, p + len); p += len;
            if (flags & 0x80) {
                const txt = new TextDecoder().decode(payload);
                const st = txt.match(/grpc-status:\s*(\d+)/);
                const msg = txt.match(/grpc-message:\s*(.+)/);
                if (st && st[1] !== '0') throw new Error(`gRPC ${st[1]}: ${msg ? decodeURIComponent(msg[1].trim()) : ''}`);
            } else {
                frames.push(payload);
            }
        }
        return frames;
    }

    // --- SNI API calls ---
    async listDevices() {
        const frames = await this._grpc('Devices/ListDevices', new Uint8Array(0));
        const devices = [];
        for (const frame of frames) {
            for (const f of this._decodeFields(frame)) {
                if (f.fn === 1 && f.wt === 2) {
                    const dev = {};
                    for (const df of this._decodeFields(f.val)) {
                        if (df.fn === 1 && df.wt === 2) dev.uri = new TextDecoder().decode(df.val);
                        if (df.fn === 2 && df.wt === 2) dev.displayName = new TextDecoder().decode(df.val);
                        if (df.fn === 3 && df.wt === 2) dev.kind = new TextDecoder().decode(df.val);
                    }
                    devices.push(dev);
                }
            }
        }
        return devices;
    }

    async readMemory(addr, size) {
        // ReadMemoryRequest: field1=address, field2=addrSpace(0=FxPakPro), field3=size
        const readReq = [...this._tagVarint(1, addr), ...this._tagVarint(2, 0), ...this._tagVarint(3, size)];
        const req = new Uint8Array([...this._tagString(1, this.deviceUri), ...this._tagBytes(2, readReq)]);
        const frames = await this._grpc('DeviceMemory/SingleRead', req, true);
        for (const frame of frames) {
            for (const f of this._decodeFields(frame)) {
                if (f.fn === 2 && f.wt === 2) {
                    for (const rf of this._decodeFields(f.val)) {
                        if (rf.fn === 5 && rf.wt === 2) return rf.val;
                    }
                }
            }
        }
        return null;
    }

    async detectGame() {
        const header = await this.readMemory(0x007FC0, 21);
        if (header) {
            const title = new TextDecoder('ascii', { fatal: false }).decode(header).replace(/[^\x20-\x7E]/g, '').trim();
            if (title.length > 2) return title;
        }
        const hiHeader = await this.readMemory(0x00FFC0, 21);
        if (hiHeader) {
            const title = new TextDecoder('ascii', { fatal: false }).decode(hiHeader).replace(/[^\x20-\x7E]/g, '').trim();
            if (title.length > 2) return title;
        }
        return 'Unknown';
    }

    getJoypadOffset(title) {
        // Known joypad held-buttons WRAM offsets
        if (title.includes('Super Metroid')) return 0x8B;
        if (title.includes('LINK') || title.includes('ZELDA')) return 0xF0;
        return 0x8B; // reasonable default for many games
    }

    // --- Connect and start polling ---
    async connect() {
        console.log(`[SNI] Connecting to ${this.url}...`);
        const devices = await this.listDevices();
        if (devices.length === 0) throw new Error('No SNI devices found. Is a game running?');

        this.deviceUri = devices[0].uri;
        console.log(`[SNI] Connected: ${devices[0].displayName} (${devices[0].kind})`);

        const game = await this.detectGame();
        this.joypadOffset = this.getJoypadOffset(game);
        console.log(`[SNI] Game: "${game}" | Joypad WRAM: $7E:${this.joypadOffset.toString(16).padStart(4, '0')}`);

        // Build SNES-style lanes
        this.logger.gamepadType = 'snes-sni';
        this.logger.rebuildLanesForController();

        this.polling = true;
        this.lastButtons = 0;
        this.pollLoop();
    }

    async pollLoop() {
        if (!this.polling) return;
        try {
            const data = await this.readMemory(this.FXPAK_WRAM + this.joypadOffset, 2);
            if (data && data.length >= 2) {
                const buttons = data[0] | (data[1] << 8);
                this.processButtons(buttons);
            }
        } catch (e) {
            console.warn('[SNI] Read error:', e.message);
            await new Promise(r => setTimeout(r, 500));
        }
        if (this.polling) {
            this.pollTimer = setTimeout(() => this.pollLoop(), 16);
        }
    }

    processButtons(buttons) {
        const now = Date.now();
        const changed = buttons ^ this.lastButtons;
        if (changed === 0) return;

        for (const [name, { byte: byteIdx, bit, laneId }] of Object.entries(this.SNI_BUTTON_MAP)) {
            const bitPos = byteIdx * 8 + bit;
            if (!(changed & (1 << bitPos))) continue;

            const pressed = !!(buttons & (1 << bitPos));
            if (pressed) {
                this.logger.onButtonPress(laneId, now);
            } else {
                this.logger.onButtonRelease(laneId);
            }
        }
        this.lastButtons = buttons;
    }

    stop() {
        this.polling = false;
        if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = null; }
    }
}


// ===== CONTROLLER INPUT LOGGER =====
class ControllerInputLogger {
    constructor() {
        this.gamepadIndex = null;
        this.gamepadType = null;
        this.currentControllerConfig = null;
        this.lastGamepadState = {};
        this.lastGamepadAxes = {};
        this.gamepadDeadzone = 0.1;

        this.buttonPressCount = {};
        this.buttonPressHistory = {};
        this.totalPresses = 0;
        this.sessionStartTime = Date.now();
        this.lastUpdateTime = Date.now();

        this.frequencyWindow = 2000;

        this.lanes = {};
        this.ddrNotes = new Map();
        this.activeNotes = new Map();
        this.hatReleaseTimers = new Map();

        this.noteColors = {
            '14': '#FF1493', '12': '#00FFFF', '15': '#32CD32', '13': '#FFD700',
            '4': '#FF4500', '5': '#9400D3', '8': '#1E90FF', '9': '#FF69B4',
            '2': '#FFFF00', '3': '#4169E1', '0': '#00FF7F', '1': '#FF6347'
        };

        this.sniClient = null;
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeComponents());
        } else {
            this.initializeComponents();
        }
    }

    initializeComponents() {
        this.cacheElements();

        const params = new URLSearchParams(window.location.search);
        if (params.get('sni') === 'true') {
            // SNI mode: read from real SNES hardware via gRPC-web
            this.sniClient = new SNIClient(this);
            this.sniClient.connect().catch(e => {
                console.error('[SNI] Connection failed:', e.message);
            });
            // Still start the main loop for note animations
            this.startMainLoop();
        } else {
            // Standard mode: browser Gamepad API
            this.setupGamepadSupport();
            this.startMainLoop();
        }
    }

    cacheElements() {
        this.statusIndicator = document.getElementById('statusIndicator');
        this.ddrView = document.getElementById('ddrView');
        this.cacheLanes();
    }

    cacheLanes() {
        this.lanes = {};
        this.buttonPressCount = {};
        this.buttonPressHistory = {};

        document.querySelectorAll('.ddr-lane').forEach(lane => {
            const buttonId = lane.getAttribute('data-button');
            this.lanes[buttonId] = {
                element: lane,
                track: lane.querySelector('.lane-track'),
                button: lane.querySelector('.lane-button')
            };
            this.buttonPressCount[buttonId] = 0;
            this.buttonPressHistory[buttonId] = [];
        });
    }

    rebuildLanesForController() {
        const ddrLanes = document.querySelector('.ddr-lanes');
        ddrLanes.innerHTML = '';

        let laneConfig;

        if (this.gamepadType === 'snes-sni') {
            // Real SNES via SNI - same layout as snes-switch but no ZL/ZR
            laneConfig = [
                { id: '14', symbol: '\u25C0', color: '#FF1493' },
                { id: '12', symbol: '\u25B2', color: '#00FFFF' },
                { id: '15', symbol: '\u25B6', color: '#32CD32' },
                { id: '13', symbol: '\u25BC', color: '#FFD700' },
                { id: '1', symbol: 'A', color: '#FF6347' },
                { id: '0', symbol: 'B', color: '#00FF7F' },
                { id: '3', symbol: 'X', color: '#4169E1' },
                { id: '2', symbol: 'Y', color: '#FFFF00' },
                { id: '4', symbol: 'L', color: '#FF4500' },
                { id: '5', symbol: 'R', color: '#9400D3' },
                { id: '8', symbol: 'SL', color: '#1E90FF' },
                { id: '9', symbol: 'ST', color: '#FF69B4' }
            ];
        } else if (this.gamepadType === 'switch-pro') {
            laneConfig = [
                { id: '14', symbol: '\u25C0', color: '#FF1493' },
                { id: '12', symbol: '\u25B2', color: '#00FFFF' },
                { id: '15', symbol: '\u25B6', color: '#32CD32' },
                { id: '13', symbol: '\u25BC', color: '#FFD700' },
                { id: '1', symbol: 'A', color: '#FF6347' },
                { id: '0', symbol: 'B', color: '#00FF7F' },
                { id: '3', symbol: 'X', color: '#4169E1' },
                { id: '2', symbol: 'Y', color: '#FFFF00' },
                { id: '6', symbol: 'ZL', color: '#FF8C00' },
                { id: '7', symbol: 'ZR', color: '#8A2BE2' },
                { id: '4', symbol: 'L', color: '#FF4500' },
                { id: '5', symbol: 'R', color: '#9400D3' },
                { id: '8', symbol: 'SL', color: '#1E90FF' },
                { id: '9', symbol: 'ST', color: '#FF69B4' }
            ];
        } else {
            laneConfig = [
                { id: '14', symbol: '\u25C0', color: '#FF1493' },
                { id: '12', symbol: '\u25B2', color: '#00FFFF' },
                { id: '15', symbol: '\u25B6', color: '#32CD32' },
                { id: '13', symbol: '\u25BC', color: '#FFD700' },
                { id: '1', symbol: 'A', color: '#FF6347' },
                { id: '0', symbol: 'B', color: '#00FF7F' },
                { id: '3', symbol: 'X', color: '#4169E1' },
                { id: '2', symbol: 'Y', color: '#FFFF00' },
                { id: '4', symbol: 'L', color: '#FF4500' },
                { id: '5', symbol: 'R', color: '#9400D3' },
                { id: '8', symbol: 'SL', color: '#1E90FF' },
                { id: '9', symbol: 'ST', color: '#FF69B4' }
            ];
        }

        laneConfig.forEach(config => {
            const lane = document.createElement('div');
            lane.className = 'ddr-lane';
            lane.setAttribute('data-button', config.id);

            const track = document.createElement('div');
            track.className = 'lane-track';
            track.id = `track-${config.id}`;

            const button = document.createElement('div');
            button.className = 'lane-button';
            button.setAttribute('data-color', config.color);
            button.textContent = config.symbol;

            lane.appendChild(track);
            lane.appendChild(button);
            ddrLanes.appendChild(lane);
        });

        this.noteColors = {};
        laneConfig.forEach(config => {
            this.noteColors[config.id] = config.color;
        });

        this.cacheLanes();
    }

    setupGamepadSupport() {
        window.addEventListener('gamepadconnected', (e) => {
            console.log('Gamepad connected:', e.gamepad.id);
            this.gamepadIndex = e.gamepad.index;

            const controllerInfo = this.getControllerConfig(e.gamepad.id);
            this.gamepadType = controllerInfo.type;
            this.currentControllerConfig = controllerInfo.config;
            this.updateControllerStatus(controllerInfo.name, controllerInfo.type, true);
            this.rebuildLanesForController();
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            if (e.gamepad.index === this.gamepadIndex) {
                this.gamepadIndex = null;
                this.gamepadType = null;
                this.currentControllerConfig = null;
                this.updateControllerStatus('No Controller Detected', '', false);
            }
        });

        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                this.gamepadIndex = i;
                const controllerInfo = this.getControllerConfig(gamepads[i].id);
                this.gamepadType = controllerInfo.type;
                this.currentControllerConfig = controllerInfo.config;
                this.updateControllerStatus(controllerInfo.name, controllerInfo.type, true);
                this.rebuildLanesForController();
                break;
            }
        }
    }

    getControllerConfig(gamepadId) {
        const id = gamepadId.toLowerCase();

        if (id.includes('pro controller') || id.includes('switch pro') ||
            (id.includes('vendor: 057e') && id.includes('product: 2009')) ||
            id.includes('nintendo switch pro controller')) {
            return { type: 'switch-pro', name: 'Nintendo Switch Pro Controller', config: this.getSwitchProConfig() };
        } else if (id.includes('nintendo') || id.includes('switch') ||
                id.includes('snes') || id.includes('057e') ||
                id.includes('hori') || id.includes('pokken') ||
                (id.includes('wireless controller') && id.includes('057e'))) {
            return { type: 'snes-switch', name: 'SNES/Switch Controller', config: this.getSNESSwitchConfig() };
        } else if (id.includes('ps4') || id.includes('playstation 4') || id.includes('dualshock')) {
            return { type: 'ps4', name: 'PlayStation 4 Controller', config: this.getStandardConfig() };
        } else if (id.includes('dualsense') || id.includes('ps5') || id.includes('playstation 5')) {
            return { type: 'ps5', name: 'PlayStation 5 DualSense Controller', config: this.getStandardConfig() };
        } else if (id.includes('8bitdo') || id.includes('sn30') || id.includes('2dc8') ||
                (id.includes('045e') && id.includes('028e'))) {
            return { type: '8bitdo-sn30-pro', name: '8BitDo SN30 Pro', config: this.getStandardConfig() };
        } else if (id.includes('xbox') || id.includes('microsoft') ||
                (id.includes('045e') && !id.includes('028e'))) {
            return { type: 'xbox', name: 'Xbox Controller', config: this.getStandardConfig() };
        } else {
            return { type: 'fallback', name: 'Generic USB Controller', config: this.getSwitchProConfig() };
        }
    }

    getSNESSwitchConfig() {
        return {
            dpad: {
                useAxes: true,
                axes: { horizontal: 9, vertical: 10 },
                axisMapping: {
                    left: { min: 0.5, max: 1.0 },
                    right: { min: -0.6, max: -0.2 },
                    down: { min: 0.1, max: 0.3 },
                    up: { min: -1.0, max: -0.5 }
                },
                verticalAxis: { down: { min: 0.3 }, up: { min: -0.5 } },
                buttons: { up: 12, down: 13, left: 14, right: 15 }
            }
        };
    }

    getSwitchProConfig() {
        return {
            dpad: {
                useAxes: true, useButtons: false, useHats: true,
                axes: { horizontal: 0, vertical: 1 },
                axisMapping: {
                    left: { min: -1.0, max: -0.5 },
                    right: { min: 0.5, max: 1.0 },
                    down: { min: 0.5, max: 1.0 }
                },
                verticalAxis: { down: { min: 0.5 }, up: { min: -0.5 } },
                hatMapping: {
                    up: { x: 0, y: 1 }, down: { x: 0, y: -1 },
                    left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
                }
            },
            buttonMapping: {
                0: '0', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5',
                6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: '11'
            }
        };
    }

    getStandardConfig() {
        return {
            dpad: {
                useAxes: true,
                axes: { horizontal: 0, vertical: 1 },
                axisMapping: {
                    left: { min: -1.0, max: -0.5 },
                    right: { min: 0.5, max: 1.0 },
                    down: { min: 0.5, max: 1.0 }
                },
                verticalAxis: { down: { min: 0.5 }, up: { min: -0.5 } },
                buttons: { up: 12, down: 13, left: 14, right: 15 }
            }
        };
    }

    updateControllerStatus(name, type, isConnected) {
        if (this.statusIndicator) {
            this.statusIndicator.classList.toggle('disconnected', !isConnected);
        }
    }

    startMainLoop() {
        const loop = () => {
            this.updateGamepad();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    updateGamepad() {
        if (this.sniClient) return; // SNI mode handles input via its own polling
        if (this.gamepadIndex === null || !this.currentControllerConfig) return;

        const gamepad = navigator.getGamepads()[this.gamepadIndex];
        if (!gamepad) return;

        const currentTime = Date.now();

        for (let i = 0; i < gamepad.buttons.length; i++) {
            const isPressed = gamepad.buttons[i].pressed;
            const wasPressed = this.lastGamepadState[i] || false;

            if (this.currentControllerConfig.dpad && (this.currentControllerConfig.dpad.useButtons || this.currentControllerConfig.dpad.useHats)) {
                if (this.currentControllerConfig.dpad.useHats && [12, 13, 14, 15].includes(i)) {
                    this.lastGamepadState[i] = isPressed;
                    continue;
                }
                if (this.currentControllerConfig.dpad.useButtons) {
                    const dpadButtons = [
                        this.currentControllerConfig.dpad.buttons.up,
                        this.currentControllerConfig.dpad.buttons.down,
                        this.currentControllerConfig.dpad.buttons.left,
                        this.currentControllerConfig.dpad.buttons.right
                    ];
                    if (dpadButtons.includes(i)) {
                        this.lastGamepadState[i] = isPressed;
                        continue;
                    }
                }
            }

            let buttonId = i.toString();
            if (this.currentControllerConfig.buttonMapping && this.currentControllerConfig.buttonMapping[i]) {
                buttonId = this.currentControllerConfig.buttonMapping[i];
            }

            if (isPressed && !wasPressed) this.onButtonPress(buttonId, currentTime);
            if (!isPressed && wasPressed) this.onButtonRelease(buttonId);

            this.lastGamepadState[i] = isPressed;
        }

        if (this.currentControllerConfig.dpad && (this.currentControllerConfig.dpad.useAxes || this.currentControllerConfig.dpad.useHats)) {
            this.updateDpadFromAxes(gamepad);
        }

        this.lastUpdateTime = currentTime;
    }

    updateDpadFromButtons(gamepad) {
        const config = this.currentControllerConfig.dpad;
        const buttons = gamepad.buttons;
        const currentTime = Date.now();

        const dpadMapping = [
            { btnIndex: config.buttons.up, id: '12', name: 'UP' },
            { btnIndex: config.buttons.down, id: '13', name: 'DOWN' },
            { btnIndex: config.buttons.left, id: '14', name: 'LEFT' },
            { btnIndex: config.buttons.right, id: '15', name: 'RIGHT' }
        ];

        for (const mapping of dpadMapping) {
            if (buttons[mapping.btnIndex]) {
                const isPressed = buttons[mapping.btnIndex].pressed;
                const wasPressed = this.lastGamepadState[`dpad_${mapping.id}`] || false;

                if (isPressed && !wasPressed) {
                    this.onButtonPress(mapping.id, currentTime);
                    this.lastGamepadState[`dpad_${mapping.id}`] = true;
                } else if (!isPressed && wasPressed) {
                    this.onButtonRelease(mapping.id);
                    this.lastGamepadState[`dpad_${mapping.id}`] = false;
                }
            }
        }
    }

    updateDpadFromHats(gamepad) {
        const buttons = gamepad.buttons;
        const currentTime = Date.now();

        const hatMapping = [
            { btnIndex: 12, id: '12', name: 'UP' },
            { btnIndex: 13, id: '13', name: 'DOWN' },
            { btnIndex: 14, id: '14', name: 'LEFT' },
            { btnIndex: 15, id: '15', name: 'RIGHT' }
        ];

        let anyHatPressed = false;
        const currentHatStates = {};

        for (const mapping of hatMapping) {
            if (buttons[mapping.btnIndex]) {
                const isPressed = buttons[mapping.btnIndex].pressed;
                currentHatStates[mapping.id] = isPressed;
                if (isPressed) anyHatPressed = true;
            }
        }

        if (!anyHatPressed) {
            for (const mapping of hatMapping) {
                const wasPressed = this.lastGamepadState[`hat_${mapping.id}`] || false;
                if (wasPressed) {
                    if (!this.hatReleaseTimers.has(mapping.id)) {
                        this.hatReleaseTimers.set(mapping.id, setTimeout(() => {
                            this.onButtonRelease(mapping.id);
                            this.lastGamepadState[`hat_${mapping.id}`] = false;
                            this.hatReleaseTimers.delete(mapping.id);
                        }, 100));
                    }
                }
            }
            return true;
        }

        for (const mapping of hatMapping) {
            if (this.hatReleaseTimers.has(mapping.id)) {
                clearTimeout(this.hatReleaseTimers.get(mapping.id));
                this.hatReleaseTimers.delete(mapping.id);
            }
        }

        for (const mapping of hatMapping) {
            const isPressed = currentHatStates[mapping.id] || false;
            const wasPressed = this.lastGamepadState[`hat_${mapping.id}`] || false;

            if (isPressed && !wasPressed) {
                this.onButtonPress(mapping.id, currentTime);
                this.lastGamepadState[`hat_${mapping.id}`] = true;
            } else if (!isPressed && wasPressed) {
                this.onButtonRelease(mapping.id);
                this.lastGamepadState[`hat_${mapping.id}`] = false;
            }
        }

        return true;
    }

    updateDpadFromAxes(gamepad) {
        const config = this.currentControllerConfig.dpad;
        const currentTime = Date.now();

        if (config.useButtons) { this.updateDpadFromButtons(gamepad); return; }
        if (config.useHats) { const ok = this.updateDpadFromHats(gamepad); if (ok) return; }

        const axes = gamepad.axes;

        if (axes[config.axes.horizontal] !== undefined) {
            const hValue = axes[config.axes.horizontal];

            if (hValue >= config.axisMapping.left.min && hValue <= config.axisMapping.left.max) {
                if (!this.lastGamepadAxes.left) { this.onButtonPress('14', currentTime); this.lastGamepadAxes.left = true; }
            } else if (this.lastGamepadAxes.left) { this.onButtonRelease('14'); this.lastGamepadAxes.left = false; }

            if (hValue >= config.axisMapping.right.min && hValue <= config.axisMapping.right.max) {
                if (!this.lastGamepadAxes.right) { this.onButtonPress('15', currentTime); this.lastGamepadAxes.right = true; }
            } else if (this.lastGamepadAxes.right) { this.onButtonRelease('15'); this.lastGamepadAxes.right = false; }

            if (config.axisMapping.up && hValue >= config.axisMapping.up.min && hValue <= config.axisMapping.up.max) {
                if (!this.lastGamepadAxes.upHorizontal) { this.onButtonPress('12', currentTime); this.lastGamepadAxes.upHorizontal = true; }
            } else if (this.lastGamepadAxes.upHorizontal) { this.onButtonRelease('12'); this.lastGamepadAxes.upHorizontal = false; }
        }

        if (axes[config.axes.vertical] !== undefined) {
            const vValue = axes[config.axes.vertical];

            if (config.verticalAxis && vValue <= config.verticalAxis.up.min) {
                if (!this.lastGamepadAxes.up) { this.onButtonPress('12', currentTime); this.lastGamepadAxes.up = true; }
            } else if (this.lastGamepadAxes.up) { this.onButtonRelease('12'); this.lastGamepadAxes.up = false; }

            if (config.verticalAxis && vValue >= config.verticalAxis.down.min) {
                if (!this.lastGamepadAxes.down) { this.onButtonPress('13', currentTime); this.lastGamepadAxes.down = true; }
            } else if (this.lastGamepadAxes.down) { this.onButtonRelease('13'); this.lastGamepadAxes.down = false; }
        }

        // Fallback: D-pad button check
        const buttons = gamepad.buttons;
        let upDetected = false;
        if (buttons[12] && buttons[12].pressed) {
            if (!this.lastGamepadAxes.upButton) { this.onButtonPress('12', currentTime); this.lastGamepadAxes.upButton = true; }
            upDetected = true;
        }
        if (!upDetected && this.lastGamepadAxes.upButton) { this.onButtonRelease('12'); this.lastGamepadAxes.upButton = false; }

        // SNES special down detection
        if (this.gamepadType === 'snes-switch' && axes[config.axes.horizontal] !== undefined) {
            const hValue = axes[config.axes.horizontal];
            if (hValue >= config.axisMapping.down.min && hValue <= config.axisMapping.down.max) {
                if (!this.lastGamepadAxes.downSpecial) { this.onButtonPress('13', currentTime); this.lastGamepadAxes.downSpecial = true; }
            } else if (this.lastGamepadAxes.downSpecial) { this.onButtonRelease('13'); this.lastGamepadAxes.downSpecial = false; }
        }
    }

    onButtonPress(buttonId, timestamp) {
        this.buttonPressCount[buttonId] = (this.buttonPressCount[buttonId] || 0) + 1;
        this.totalPresses++;

        if (!this.buttonPressHistory[buttonId]) this.buttonPressHistory[buttonId] = [];
        this.buttonPressHistory[buttonId].push(timestamp);

        const cutoffTime = timestamp - this.frequencyWindow;
        this.buttonPressHistory[buttonId] = this.buttonPressHistory[buttonId].filter(t => t > cutoffTime);

        this.activateButton(buttonId);
        this.createDDRNote(buttonId, timestamp);

        // Start lightning beam while button is held
        if (window.effects && window.effects.lightning) {
            window.effects.lightning.setRefs(this.lanes, this.noteColors);
            window.effects.lightning.startBeam(buttonId);
        }
    }

    onButtonRelease(buttonId) {
        this.deactivateButton(buttonId);
        this.endDDRNote(buttonId);

        // End lightning beam
        if (window.effects && window.effects.lightning) {
            window.effects.lightning.endBeam(buttonId);
        }
    }

    activateButton(buttonId) {
        const lane = this.lanes[buttonId];
        if (lane) {
            const color = this.noteColors[buttonId];
            lane.button.classList.add('active');
            lane.button.style.background = color;
            lane.button.style.borderColor = color;
            lane.button.style.color = '#000';
            lane.button.style.boxShadow = `0 0 15px ${color}, 0 0 30px ${color}80`;
        }
    }

    deactivateButton(buttonId) {
        const lane = this.lanes[buttonId];
        if (lane) {
            lane.button.classList.remove('active');
            lane.button.style.background = '';
            lane.button.style.borderColor = '';
            lane.button.style.boxShadow = '';
            lane.button.style.color = '';
        }
    }

    createDDRNote(buttonId, timestamp) {
        const lane = this.lanes[buttonId];
        if (!lane || !lane.track) return;

        const noteId = `${buttonId}-${timestamp}`;
        const note = document.createElement('div');
        note.className = 'ddr-note';
        note.style.background = this.noteColors[buttonId] || '#FFFFFF';
        note.style.borderColor = this.noteColors[buttonId] || '#FFFFFF';
        note.style.height = '8px';
        note.style.bottom = '5px';

        lane.track.appendChild(note);

        const noteData = {
            element: note,
            buttonId,
            startTime: timestamp,
            endTime: null,
            isGrowing: true
        };

        this.ddrNotes.set(noteId, noteData);
        this.activeNotes.set(buttonId, noteData);
        this.startNoteAnimation(noteData);
    }

    startNoteAnimation(noteData) {
        const startTime = Date.now();
        const scrollSpeed = 0.15;
        const growthRate = 0.08;
        let initialBottom = 5;
        let grownHeight = 0;

        const animate = () => {
            if (!noteData.element.parentNode) return;

            const elapsed = Date.now() - startTime;

            if (noteData.isGrowing) {
                grownHeight = elapsed * growthRate;
                noteData.element.style.height = `${8 + grownHeight}px`;
                noteData.element.style.bottom = `${initialBottom}px`;
            } else {
                const newBottom = initialBottom + ((elapsed - (grownHeight / growthRate)) * scrollSpeed);
                noteData.element.style.bottom = `${newBottom}px`;
            }

            const trackHeight = noteData.element.parentNode.offsetHeight;
            const currentBottom = parseFloat(noteData.element.style.bottom) || initialBottom;
            if (currentBottom > trackHeight + 100) {
                noteData.element.parentNode.removeChild(noteData.element);
                this.ddrNotes.delete(`${noteData.buttonId}-${noteData.startTime}`);
                return;
            }

            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }

    endDDRNote(buttonId) {
        const activeNote = this.activeNotes.get(buttonId);
        if (activeNote) {
            activeNote.isGrowing = false;
            activeNote.endTime = Date.now();
            this.activeNotes.delete(buttonId);

            const duration = activeNote.endTime - activeNote.startTime;
            if (duration > 500) {
                activeNote.element.style.boxShadow = `0 0 20px ${this.noteColors[buttonId]}, 0 0 40px ${this.noteColors[buttonId]}`;
            }
        }
    }

    emergencyCleanup() {
        this.lastGamepadAxes = {};
        this.lastGamepadState = {};
        this.hatReleaseTimers.forEach(timer => clearTimeout(timer));
        this.hatReleaseTimers.clear();
        if (this.sniClient) this.sniClient.lastButtons = 0;
        this.activeNotes.forEach((noteData, buttonId) => this.endDDRNote(buttonId));

        document.querySelectorAll('.lane-button.active').forEach(button => {
            button.classList.remove('active');
            button.style.background = '';
            button.style.borderColor = '';
            button.style.boxShadow = '';
            button.style.color = '';
        });
    }
}


// ===== INIT =====
window.addEventListener('load', () => {
    window.effects = new EffectsEngine();
    window.controllerLogger = new ControllerInputLogger();

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') window.controllerLogger.emergencyCleanup();
    });
});
