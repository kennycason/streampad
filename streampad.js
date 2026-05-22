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
        };
        resize();
        window.addEventListener('resize', resize);

        const columns = Math.floor(canvas.width / 14);
        this.matrixDrops = new Array(columns).fill(0);
        const chars = 'ABXY0123456789@#$%&*<>[]{}';

        const animate = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = 'rgba(0, 255, 100, 0.4)';
            ctx.font = '12px monospace';

            for (let i = 0; i < this.matrixDrops.length; i++) {
                const char = chars[Math.floor(Math.random() * chars.length)];
                ctx.fillText(char, i * 14, this.matrixDrops[i] * 14);

                if (this.matrixDrops[i] * 14 > canvas.height && Math.random() > 0.975) {
                    this.matrixDrops[i] = 0;
                }
                this.matrixDrops[i]++;
            }

            requestAnimationFrame(animate);
        };
        animate();
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
        this.setupGamepadSupport();
        this.startMainLoop();
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

        if (this.gamepadType === 'switch-pro') {
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
    }

    onButtonRelease(buttonId) {
        this.deactivateButton(buttonId);
        this.endDDRNote(buttonId);
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
