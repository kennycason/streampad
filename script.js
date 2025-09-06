// DDR-Style Controller Input Logger
// Enhanced with improved controller detection and DDR note movement

class ControllerInputLogger {
    constructor() {
        // Controller state
        this.gamepadIndex = null;
        this.gamepadType = null;
        this.currentControllerConfig = null;
        this.lastGamepadState = {};
        this.lastGamepadAxes = {};
        this.gamepadDeadzone = 0.1;
        
        // Input tracking
        this.buttonPressCount = {};
        this.buttonPressHistory = {};
        this.totalPresses = 0;
        this.sessionStartTime = Date.now();
        this.lastUpdateTime = Date.now();
        
        // Frequency calculation
        this.frequencyWindow = 2000; // 2 second window for frequency calculation
        this.frequencyUpdateInterval = 100; // Update frequency every 100ms
        
        // Visual elements
        this.buttons = {};
        this.lanes = {};
        this.currentView = 'ddr'; // Always DDR view
        
        // DDR specific
        this.ddrNotes = new Map(); // Map of active notes
        this.noteColors = {
            '14': '#FF1493', // LEFT - Pink
            '12': '#00FFFF', // UP - Cyan
            '15': '#32CD32', // RIGHT - Green
            '13': '#FFFF00', // DOWN - Yellow
            '4': '#FF4500',  // L1 - Orange
            '5': '#4B0082',  // R1 - Purple
            '8': '#0080FF',  // SELECT - Blue
            '9': '#FF69B4',  // START - Hot Pink
            '2': '#0080FF',  // X - Blue
            '3': '#FFFF00',  // Y - Yellow
            '1': '#FF1493',  // B - Pink
            '0': '#32CD32'   // A - Green
        };
        
        this.init();
    }
    
    init() {
        console.log('🎮 Initializing DDR-Style Controller Input Logger...');
        
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeComponents();
            });
        } else {
            this.initializeComponents();
        }
    }
    
    initializeComponents() {
        // Cache DOM elements
        this.cacheElements();
        
        // Setup gamepad support
        this.setupGamepadSupport();
        
        // Start the main loop
        this.startMainLoop();
        
        // Update stats periodically
        setInterval(() => this.updateStats(), 1000);
        
        console.log('✅ Controller Input Logger initialized!');
    }
    
    cacheElements() {
        // Controller status elements
        this.statusIndicator = document.getElementById('statusIndicator');
        
        // DDR view element
        this.ddrView = document.getElementById('ddrView');
        
        // Cache DDR lanes
        const lanes = document.querySelectorAll('.ddr-lane');
        
        lanes.forEach(lane => {
            const buttonId = lane.getAttribute('data-button');
            const track = lane.querySelector('.lane-track');
            const button = lane.querySelector('.lane-button');
            
            this.lanes[buttonId] = {
                element: lane,
                track: track,
                button: button
            };
            
            // Initialize press count
            this.buttonPressCount[buttonId] = 0;
            this.buttonPressHistory[buttonId] = [];
        });
    }
    
    
    setupGamepadSupport() {
        // Gamepad connection events
        window.addEventListener('gamepadconnected', (e) => {
            console.log('🎮 Gamepad connected:', e.gamepad.id);
            this.gamepadIndex = e.gamepad.index;
            
            // Detect controller type and configure
            const controllerInfo = this.getControllerConfig(e.gamepad.id);
            this.gamepadType = controllerInfo.type;
            this.currentControllerConfig = controllerInfo.config;
            
            this.updateControllerStatus(controllerInfo.name, controllerInfo.type, true);
            console.log(`✅ Controller detected: ${controllerInfo.name} (Type: ${controllerInfo.type})`);
        });
        
        window.addEventListener('gamepaddisconnected', (e) => {
            console.log('🎮 Gamepad disconnected');
            if (e.gamepad.index === this.gamepadIndex) {
                this.gamepadIndex = null;
                this.gamepadType = null;
                this.currentControllerConfig = null;
                this.updateControllerStatus('No Controller Detected', 'Connect a controller to begin', false);
            }
        });
        
        // Check for existing gamepads
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                console.log('🎮 Found existing gamepad:', gamepads[i].id);
                this.gamepadIndex = i;
                
                // Detect controller type and configure
                const controllerInfo = this.getControllerConfig(gamepads[i].id);
                this.gamepadType = controllerInfo.type;
                this.currentControllerConfig = controllerInfo.config;
                
                this.updateControllerStatus(controllerInfo.name, controllerInfo.type, true);
                console.log(`✅ Controller detected: ${controllerInfo.name} (Type: ${controllerInfo.type})`);
                break;
            }
        }
    }
    
    // Controller configurations for different gamepad types
    getControllerConfig(gamepadId) {
        console.log(`🔍 Detecting controller ID: "${gamepadId}"`);
        
        const id = gamepadId.toLowerCase();
        
        // Nintendo Switch Pro Controller (improved detection)
        if (id.includes('pro controller') || id.includes('switch pro') ||
            (id.includes('vendor: 057e') && id.includes('product: 2009')) ||
            id.includes('nintendo switch pro controller')) {
            console.log(`✅ Nintendo Switch Pro Controller detected!`);
            return {
                type: 'switch-pro',
                name: 'Nintendo Switch Pro Controller',
                config: this.getSwitchProConfig()
            };
        }
        
        // SNES/Switch USB Controller (broader detection)
        else if (id.includes('nintendo') || id.includes('switch') || 
                id.includes('snes') || id.includes('057e') ||
                id.includes('hori') || id.includes('pokken') ||
                (id.includes('wireless controller') && id.includes('057e'))) {
            console.log(`✅ SNES/Switch controller detected!`);
            return {
                type: 'snes-switch',
                name: 'SNES/Switch Controller',
                config: this.getSNESSwitchConfig()
            };
        }
        
        // PlayStation 4 Controller (DualShock 4)
        else if (id.includes('ps4') || id.includes('playstation 4') || id.includes('dualshock')) {
            return {
                type: 'ps4',
                name: 'PlayStation 4 Controller',
                config: this.getPS4Config()
            };
        }
        
        // PlayStation 5 Controller (DualSense)
        else if (id.includes('dualsense') || id.includes('ps5') || id.includes('playstation 5')) {
            return {
                type: 'ps5',
                name: 'PlayStation 5 DualSense Controller',
                config: this.getPS5Config()
            };
        }
        
        // 8BitDo SN30 Pro
        else if (id.includes('8bitdo') || id.includes('sn30') || 
                id.includes('2dc8') || id.includes('8bitdo sn30 pro') ||
                (id.includes('045e') && id.includes('028e'))) {
            console.log(`✅ 8BitDo SN30 Pro controller detected!`);
            return {
                type: '8bitdo-sn30-pro',
                name: '8BitDo SN30 Pro',
                config: this.get8BitDoSN30ProConfig()
            };
        }
        
        // Xbox Controllers
        else if (id.includes('xbox') || id.includes('microsoft') ||
                (id.includes('045e') && !id.includes('028e'))) {
            console.log(`✅ Xbox controller detected!`);
            return {
                type: 'xbox',
                name: 'Xbox Controller',
                config: this.getXboxConfig()
            };
        }
        
        // Default fallback
        else {
            console.log(`⚠️ Unknown controller detected, using fallback mapping for: "${gamepadId}"`);
            return {
                type: 'fallback',
                name: 'Generic USB Controller',
                config: this.getSwitchProConfig() // Use Switch Pro as fallback since it's more standard
            };
        }
    }
    
    // SNES/Switch controller configuration (preserve existing working logic)
    getSNESSwitchConfig() {
        return {
            dpad: {
                useAxes: true,
                axes: {
                    horizontal: 9,
                    vertical: 10
                },
                axisMapping: {
                    left: { min: 0.5, max: 1.0 },
                    right: { min: -0.6, max: -0.2 },
                    down: { min: 0.1, max: 0.3 }
                },
                verticalAxis: {
                    down: { min: 0.3 },
                    up: { min: -0.3 }
                },
                buttons: {
                    up: 12,
                    down: 13,
                    left: 14,
                    right: 15
                }
            }
        };
    }
    
    getSwitchProConfig() {
        return {
            dpad: {
                useAxes: true,
                axes: {
                    horizontal: 0,
                    vertical: 1
                },
                axisMapping: {
                    left: { min: -1.0, max: -0.5 },
                    right: { min: 0.5, max: 1.0 },
                    down: { min: 0.5, max: 1.0 }
                },
                verticalAxis: {
                    down: { min: 0.5 },
                    up: { min: -0.5 }
                },
                buttons: {
                    up: 12,
                    down: 13,
                    left: 14,
                    right: 15
                }
            }
        };
    }
    
    getPS4Config() {
        return {
            dpad: {
                useAxes: true,
                axes: {
                    horizontal: 0,
                    vertical: 1
                },
                axisMapping: {
                    left: { min: -1.0, max: -0.5 },
                    right: { min: 0.5, max: 1.0 },
                    down: { min: 0.5, max: 1.0 }
                },
                verticalAxis: {
                    down: { min: 0.5 },
                    up: { min: -0.5 }
                },
                buttons: {
                    up: 12,
                    down: 13,
                    left: 14,
                    right: 15
                }
            }
        };
    }
    
    getPS5Config() {
        return {
            dpad: {
                useAxes: true,
                axes: {
                    horizontal: 0,
                    vertical: 1
                },
                axisMapping: {
                    left: { min: -1.0, max: -0.5 },
                    right: { min: 0.5, max: 1.0 },
                    down: { min: 0.5, max: 1.0 }
                },
                verticalAxis: {
                    down: { min: 0.5 },
                    up: { min: -0.5 }
                },
                buttons: {
                    up: 12,
                    down: 13,
                    left: 14,
                    right: 15
                }
            }
        };
    }
    
    get8BitDoSN30ProConfig() {
        return {
            dpad: {
                useAxes: true,
                axes: {
                    horizontal: 0,
                    vertical: 1
                },
                axisMapping: {
                    left: { min: -1.0, max: -0.5 },
                    right: { min: 0.5, max: 1.0 },
                    down: { min: 0.5, max: 1.0 }
                },
                verticalAxis: {
                    down: { min: 0.5 },
                    up: { min: -0.5 }
                },
                buttons: {
                    up: 12,
                    down: 13,
                    left: 14,
                    right: 15
                }
            }
        };
    }
    
    getXboxConfig() {
        return {
            dpad: {
                useAxes: true,
                axes: {
                    horizontal: 0,
                    vertical: 1
                },
                axisMapping: {
                    left: { min: -1.0, max: -0.5 },
                    right: { min: 0.5, max: 1.0 },
                    down: { min: 0.5, max: 1.0 }
                },
                verticalAxis: {
                    down: { min: 0.5 },
                    up: { min: -0.5 }
                },
                buttons: {
                    up: 12,
                    down: 13,
                    left: 14,
                    right: 15
                }
            }
        };
    }
    
    updateControllerStatus(name, type, isConnected) {
        if (isConnected) {
            this.statusIndicator.classList.remove('disconnected');
        } else {
            this.statusIndicator.classList.add('disconnected');
        }
    }
    
    startMainLoop() {
        const loop = () => {
            this.updateGamepad();
            this.updateDDRNotes();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
    
    updateGamepad() {
        if (this.gamepadIndex === null || !this.currentControllerConfig) return;
        
        const gamepad = navigator.getGamepads()[this.gamepadIndex];
        if (!gamepad) return;
        
        const currentTime = Date.now();
        
        // Update button states
        for (let i = 0; i < gamepad.buttons.length; i++) {
            const isPressed = gamepad.buttons[i].pressed;
            const wasPressed = this.lastGamepadState[i] || false;
            
            // Button press detected
            if (isPressed && !wasPressed) {
                this.onButtonPress(i.toString(), currentTime);
            }
            
            // Button release detected
            if (!isPressed && wasPressed) {
                this.onButtonRelease(i.toString());
            }
            
            this.lastGamepadState[i] = isPressed;
        }
        
        // Handle D-pad via axes if configured
        if (this.currentControllerConfig.dpad && this.currentControllerConfig.dpad.useAxes) {
            this.updateDpadFromAxes(gamepad);
        }
        
        this.lastUpdateTime = currentTime;
    }
    
    updateDpadFromAxes(gamepad) {
        const config = this.currentControllerConfig.dpad;
        const axes = gamepad.axes;
        const currentTime = Date.now();
        
        // Handle horizontal axis
        if (axes[config.axes.horizontal] !== undefined) {
            const hValue = axes[config.axes.horizontal];
            
            // Check for left
            if (hValue >= config.axisMapping.left.min && hValue <= config.axisMapping.left.max) {
                if (!this.lastGamepadAxes.left) {
                    this.onButtonPress('14', currentTime); // D-pad left
                    this.lastGamepadAxes.left = true;
                }
            } else if (this.lastGamepadAxes.left) {
                this.onButtonRelease('14');
                this.lastGamepadAxes.left = false;
            }
            
            // Check for right
            if (hValue >= config.axisMapping.right.min && hValue <= config.axisMapping.right.max) {
                if (!this.lastGamepadAxes.right) {
                    this.onButtonPress('15', currentTime); // D-pad right
                    this.lastGamepadAxes.right = true;
                }
            } else if (this.lastGamepadAxes.right) {
                this.onButtonRelease('15');
                this.lastGamepadAxes.right = false;
            }
        }
        
        // Handle vertical axis
        if (axes[config.axes.vertical] !== undefined) {
            const vValue = axes[config.axes.vertical];
            
            // Check for up
            if (config.verticalAxis && vValue <= config.verticalAxis.up.min) {
                if (!this.lastGamepadAxes.up) {
                    this.onButtonPress('12', currentTime); // D-pad up
                    this.lastGamepadAxes.up = true;
                }
            } else if (this.lastGamepadAxes.up) {
                this.onButtonRelease('12');
                this.lastGamepadAxes.up = false;
            }
            
            // Check for down
            if (config.verticalAxis && vValue >= config.verticalAxis.down.min) {
                if (!this.lastGamepadAxes.down) {
                    this.onButtonPress('13', currentTime); // D-pad down
                    this.lastGamepadAxes.down = true;
                }
            } else if (this.lastGamepadAxes.down) {
                this.onButtonRelease('13');
                this.lastGamepadAxes.down = false;
            }
        }
        
        // For SNES/Switch special handling
        if (this.gamepadType === 'snes-switch' && axes[config.axes.horizontal] !== undefined) {
            const hValue = axes[config.axes.horizontal];
            
            // Special SNES down detection from horizontal axis
            if (hValue >= config.axisMapping.down.min && hValue <= config.axisMapping.down.max) {
                if (!this.lastGamepadAxes.downSpecial) {
                    this.onButtonPress('13', currentTime); // D-pad down
                    this.lastGamepadAxes.downSpecial = true;
                }
            } else if (this.lastGamepadAxes.downSpecial) {
                this.onButtonRelease('13');
                this.lastGamepadAxes.downSpecial = false;
            }
        }
    }
    
    onButtonPress(buttonId, timestamp) {
        console.log(`🎮 Button ${buttonId} pressed`);
        
        // Update press count
        this.buttonPressCount[buttonId] = (this.buttonPressCount[buttonId] || 0) + 1;
        this.totalPresses++;
        
        // Add to press history for frequency calculation
        if (!this.buttonPressHistory[buttonId]) {
            this.buttonPressHistory[buttonId] = [];
        }
        this.buttonPressHistory[buttonId].push(timestamp);
        
        // Clean old history (keep only last 2 seconds)
        this.cleanPressHistory(buttonId, timestamp);
        
        // Visual feedback
        this.activateButton(buttonId);
        
        // Create DDR note
        this.createDDRNote(buttonId, timestamp);
        
        // Add vibration effect based on press frequency
        this.addVibrationEffect(buttonId);
    }
    
    onButtonRelease(buttonId) {
        this.deactivateButton(buttonId);
        
        // End DDR note
        this.endDDRNote(buttonId);
    }
    
    activateButton(buttonId) {
        // Activate DDR lane button
        const lane = this.lanes[buttonId];
        if (lane) {
            lane.button.classList.add('active');
            const color = this.noteColors[buttonId];
            lane.button.style.background = color;
            lane.button.style.borderColor = color;
            lane.button.style.boxShadow = `0 0 25px ${color}`;
            lane.button.style.color = '#000'; // Black text for visibility
            lane.button.style.transform = 'scale(1.1)';
        }
    }
    
    deactivateButton(buttonId) {
        // Deactivate DDR lane button
        const lane = this.lanes[buttonId];
        if (lane) {
            lane.button.classList.remove('active');
            lane.button.style.background = '';
            lane.button.style.borderColor = '';
            lane.button.style.boxShadow = '';
            lane.button.style.color = '';
            lane.button.style.transform = '';
        }
    }
    
    cleanPressHistory(buttonId, currentTime) {
        if (!this.buttonPressHistory[buttonId]) return;
        
        const cutoffTime = currentTime - this.frequencyWindow;
        this.buttonPressHistory[buttonId] = this.buttonPressHistory[buttonId].filter(
            timestamp => timestamp > cutoffTime
        );
    }
    
    createDDRNote(buttonId, timestamp) {
        const lane = this.lanes[buttonId];
        if (!lane || !lane.track) {
            return;
        }
        
        const noteId = `${buttonId}-${timestamp}`;
        const note = document.createElement('div');
        note.className = 'ddr-note';
        note.style.background = this.noteColors[buttonId] || '#FFFFFF';
        note.style.borderColor = this.noteColors[buttonId] || '#FFFFFF';
        note.style.color = '#000'; // Black text for visibility
        note.style.height = '30px'; // Initial height
        
        // Add button label to the note
        const buttonLabels = {
            '14': '◀', '12': '▲', '15': '▶', '13': '▼',
            '4': 'L1', '5': 'R1', '8': 'SLCT', '9': 'STRT',
            '2': 'X', '3': 'Y', '1': 'B', '0': 'A'
        };
        note.textContent = buttonLabels[buttonId] || buttonId;
        
        // Position the note in the lane track
        lane.track.appendChild(note);
        
        // Store note info for tracking
        this.ddrNotes.set(noteId, {
            element: note,
            buttonId,
            startTime: timestamp,
            endTime: null
        });
        
        // Calculate animation duration - now that tracks have proper height
        const duration = 4000; // 4 seconds to scroll from bottom to top
        
        // Set animation duration
        note.style.animationDuration = `${duration}ms`;
        
        // Remove note after animation completes
        setTimeout(() => {
            if (note.parentNode) {
                note.parentNode.removeChild(note);
            }
            this.ddrNotes.delete(noteId);
        }, duration);
    }
    
    endDDRNote(buttonId) {
        const currentTime = Date.now();
        
        // Find the most recent active note for this button
        let mostRecentNote = null;
        let mostRecentTime = 0;
        
        for (let [noteId, noteData] of this.ddrNotes) {
            if (noteData.buttonId === buttonId && noteData.endTime === null && noteData.startTime > mostRecentTime) {
                mostRecentNote = noteData;
                mostRecentTime = noteData.startTime;
            }
        }
        
        if (mostRecentNote) {
            mostRecentNote.endTime = currentTime;
            const duration = currentTime - mostRecentNote.startTime;
            
            // Extend note height based on press duration
            const minHeight = 25;
            const maxHeight = 150;
            const heightMultiplier = Math.min(duration / 1000, 4); // Max 4 seconds for scaling
            const newHeight = minHeight + (heightMultiplier * (maxHeight - minHeight) / 4);
            
            mostRecentNote.element.style.height = `${newHeight}px`;
            
            // Add extra glow for long presses
            if (duration > 1000) {
                mostRecentNote.element.style.boxShadow = `0 0 25px ${this.noteColors[buttonId]}`;
            }
        }
    }
    
    updateDDRNotes() {
        // This function can be used for any real-time DDR note updates if needed
        // Currently, notes are handled by CSS animations and timers
    }
    
    addVibrationEffect(buttonId) {
        const currentTime = Date.now();
        this.cleanPressHistory(buttonId, currentTime);
        
        const pressCount = this.buttonPressHistory[buttonId].length;
        const frequency = pressCount / (this.frequencyWindow / 1000);
        
        // Add vibration based on frequency
        if (frequency > 6) {
            document.body.classList.add('mega-vibration');
            setTimeout(() => document.body.classList.remove('mega-vibration'), 300);
        } else if (frequency > 3) {
            document.body.classList.add('intense-vibration');
            setTimeout(() => document.body.classList.remove('intense-vibration'), 200);
        }
        
        // Also check for really long presses
        const currentNote = Array.from(this.ddrNotes.values()).find(note => 
            note.buttonId === buttonId && note.endTime === null
        );
        
        if (currentNote) {
            const pressDuration = currentTime - currentNote.startTime;
            if (pressDuration > 2000) { // Really long press (2+ seconds)
                document.body.classList.add('mega-vibration');
                setTimeout(() => document.body.classList.remove('mega-vibration'), 200);
            }
        }
    }
    
    updateStats() {
        // Stats removed for minimal interface
        // Could be re-added as overlay if needed
    }
    
    getButtonName(buttonId) {
        const buttonNames = {
            '0': 'A',
            '1': 'B', 
            '2': 'X',
            '3': 'Y',
            '4': 'L1',
            '5': 'R1',
            '6': 'L2',
            '7': 'R2',
            '8': 'SELECT',
            '9': 'START',
            '10': 'L3',
            '11': 'R3',
            '12': 'D-UP',
            '13': 'D-DOWN',
            '14': 'D-LEFT',
            '15': 'D-RIGHT',
            '16': 'HOME'
        };
        
        return buttonNames[buttonId] || `BTN${buttonId}`;
    }
}

// Initialize the controller logger when the page loads
window.addEventListener('load', () => {
    window.controllerLogger = new ControllerInputLogger();
    console.log('🎮 DDR-Style Controller Input Logger loaded!');
    console.log('🌈 Connect a controller and start pressing buttons!');
});

// Add some fun console commands
window.addEventListener('load', () => {
    console.log('💡 Fun commands to try in console:');
    console.log('   controllerLogger.switchView("ddr") - Switch to DDR view');
    console.log('   controllerLogger.switchView("button") - Switch to button view');
    console.log('   controllerLogger.buttonPressCount - See button press counts');
    console.log('   controllerLogger.gamepadType - Current controller type');
});