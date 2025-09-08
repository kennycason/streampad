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
        this.activeNotes = new Map(); // Map of currently growing notes
        this.noteColors = {
            '14': '#FF1493', // LEFT - Pink
            '12': '#00FFFF', // UP - Cyan
            '15': '#32CD32', // RIGHT - Green
            '13': '#FFFF00', // DOWN - Yellow
            '4': '#FF4500',  // L1 - Orange
            '5': '#4B0082',  // R1 - Purple
            '8': '#0080FF',  // SELECT - Blue
            '9': '#FF69B4',  // START - Hot Pink
            '3': '#0080FF',  // Y - Blue (swapped with X)
            '2': '#FFFF00',  // X - Yellow (swapped with Y)
            '0': '#32CD32',  // B - Green (SNES Switch controller)
            '1': '#FF1493'   // A - Pink (SNES Switch controller)
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
                    down: { min: 0.1, max: 0.3 },
                    up: { min: -1.0, max: -0.5 } // Try UP on horizontal axis too
                },
                verticalAxis: {
                    down: { min: 0.3 },
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
        
        // Debug axis values occasionally
        if (Math.random() < 0.01) {
            console.log('Axis values - H:', axes[config.axes.horizontal]?.toFixed(3), 'V:', axes[config.axes.vertical]?.toFixed(3));
            // Also log all button states for debugging
            const pressedButtons = [];
            for (let i = 0; i < gamepad.buttons.length; i++) {
                if (gamepad.buttons[i].pressed) {
                    pressedButtons.push(i);
                }
            }
            if (pressedButtons.length > 0) {
                console.log('Pressed buttons:', pressedButtons);
            }
        }
        
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
            
            // Check for UP on horizontal axis (some controllers map it here)
            if (config.axisMapping.up && hValue >= config.axisMapping.up.min && hValue <= config.axisMapping.up.max) {
                if (!this.lastGamepadAxes.upHorizontal) {
                    console.log('D-pad UP detected via horizontal axis:', hValue);
                    this.onButtonPress('12', currentTime); // D-pad up
                    this.lastGamepadAxes.upHorizontal = true;
                }
            } else {
                // Always check for release when not in UP range
                if (this.lastGamepadAxes.upHorizontal) {
                    console.log('D-pad UP released (horizontal axis)');
                    this.onButtonRelease('12');
                    this.lastGamepadAxes.upHorizontal = false;
                }
            }
        }
        
        // Handle vertical axis
        if (axes[config.axes.vertical] !== undefined) {
            const vValue = axes[config.axes.vertical];
            
            // Check for up - try both vertical axis and button
            if (config.verticalAxis && vValue <= config.verticalAxis.up.min) {
                if (!this.lastGamepadAxes.up) {
                    console.log('D-pad UP detected via axis:', vValue);
                    this.onButtonPress('12', currentTime); // D-pad up
                    this.lastGamepadAxes.up = true;
                }
            } else {
                // Always check for release when not in UP range
                if (this.lastGamepadAxes.up) {
                    console.log('D-pad UP released (vertical axis)');
                    this.onButtonRelease('12');
                    this.lastGamepadAxes.up = false;
                }
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
        
        // Also check D-pad buttons directly (fallback) - only check actual D-pad button indices
        const buttons = gamepad.buttons;
        const upButtonIndices = [config.buttons.up, 12]; // Only check D-pad specific buttons, not face buttons
        
        let upDetected = false;
        for (const buttonIndex of upButtonIndices) {
            if (buttons[buttonIndex] && buttons[buttonIndex].pressed) {
                if (!this.lastGamepadAxes.upButton) {
                    console.log('D-pad UP detected via button index:', buttonIndex);
                    this.onButtonPress('12', currentTime);
                    this.lastGamepadAxes.upButton = true;
                }
                upDetected = true;
                break;
            }
        }
        
        // Always check for button release when no UP button is detected
        if (!upDetected && this.lastGamepadAxes.upButton) {
            console.log('D-pad UP released (button fallback)');
            this.onButtonRelease('12');
            this.lastGamepadAxes.upButton = false;
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
        
        // Vibration effects removed for cleaner experience
    }
    
    onButtonRelease(buttonId) {
        console.log('🎮 Button', buttonId, 'released');
        this.deactivateButton(buttonId);
        
        // End DDR note
        this.endDDRNote(buttonId);
        
        // Clear from gamepad state tracking
        delete this.lastGamepadState[buttonId];
    }
    
    activateButton(buttonId) {
        // Activate DDR lane button with enhanced glow
        const lane = this.lanes[buttonId];
        if (lane) {
            lane.button.classList.add('active');
            const color = this.noteColors[buttonId];
            lane.button.style.background = color;
            lane.button.style.borderColor = color;
            lane.button.style.boxShadow = `0 0 35px ${color}, 0 0 60px ${color}`; // Enhanced glow
            lane.button.style.color = '#000'; // Black text for visibility
            lane.button.style.transform = 'scale(1.15)';
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
        note.style.height = '25px'; // Initial height
        note.style.bottom = '5px'; // Start much closer to button
        
        // No text content - just color
        
        // Position the note in the lane track
        lane.track.appendChild(note);
        
        // Store note info for tracking
        const noteData = {
            element: note,
            buttonId,
            startTime: timestamp,
            endTime: null,
            isGrowing: true
        };
        
        this.ddrNotes.set(noteId, noteData);
        this.activeNotes.set(buttonId, noteData); // Track as active/growing
        
        // Start the growth and movement animation
        this.startNoteAnimation(noteData);
    }
    
    startNoteAnimation(noteData) {
        const startTime = Date.now();
        const scrollSpeed = 0.15; // pixels per millisecond (slower scroll)
        const growthRate = 0.08; // height increase per millisecond while held
        let initialBottom = 5;
        let grownHeight = 0;
        
        const animate = () => {
            if (!noteData.element.parentNode) return; // Note was removed
            
            const elapsed = Date.now() - startTime;
            
            // If still growing (button held), increase height downward
            if (noteData.isGrowing) {
                grownHeight = elapsed * growthRate;
                const newHeight = 25 + grownHeight;
                noteData.element.style.height = `${newHeight}px`;
                // Keep bottom position fixed while growing
                noteData.element.style.bottom = `${initialBottom}px`;
            } else {
                // Once released, start moving upward while maintaining height
                const newBottom = initialBottom + ((elapsed - (grownHeight / growthRate)) * scrollSpeed);
                noteData.element.style.bottom = `${newBottom}px`;
            }
            
            // Remove note when it goes off screen
            const trackHeight = noteData.element.parentNode.offsetHeight;
            const currentBottom = parseFloat(noteData.element.style.bottom) || initialBottom;
            if (currentBottom > trackHeight + 100) {
                if (noteData.element.parentNode) {
                    noteData.element.parentNode.removeChild(noteData.element);
                }
                this.ddrNotes.delete(`${noteData.buttonId}-${noteData.startTime}`);
                return;
            }
            
            // Continue animation
            requestAnimationFrame(animate);
        };
        
        requestAnimationFrame(animate);
    }
    
    endDDRNote(buttonId) {
        // Stop growing the active note for this button
        const activeNote = this.activeNotes.get(buttonId);
        if (activeNote) {
            activeNote.isGrowing = false;
            activeNote.endTime = Date.now();
            this.activeNotes.delete(buttonId);
            
            // Add extra glow for the final note
            const duration = activeNote.endTime - activeNote.startTime;
            if (duration > 500) {
                activeNote.element.style.boxShadow = `0 0 20px ${this.noteColors[buttonId]}`;
            }
        }
    }
    
    updateDDRNotes() {
        // This function can be used for any real-time DDR note updates if needed
        // Currently, notes are handled by CSS animations and timers
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
    
    // Emergency cleanup method to fix stuck buttons
    emergencyCleanup() {
        console.log('🧹 Emergency cleanup - clearing all stuck states');
        
        // Clear all axis tracking
        this.lastGamepadAxes = {};
        
        // Clear all button states
        this.lastGamepadState = {};
        
        // End all active DDR notes
        Object.keys(this.activeDDRNotes).forEach(buttonId => {
            this.endDDRNote(buttonId);
        });
        
        // Remove active classes from all buttons
        document.querySelectorAll('.lane-button.active').forEach(button => {
            button.classList.remove('active');
            button.style.background = '';
            button.style.borderColor = '';
            button.style.boxShadow = '';
            button.style.color = '';
            button.style.transform = '';
        });
        
        console.log('✅ Emergency cleanup completed');
    }
}

// Initialize the controller logger when the page loads
window.addEventListener('load', () => {
    window.controllerLogger = new ControllerInputLogger();
    console.log('🎮 DDR-Style Controller Input Logger loaded!');
    console.log('🌈 Connect a controller and start pressing buttons!');
});

// Add some fun console commands and emergency cleanup
window.addEventListener('load', () => {
    console.log('💡 Fun commands to try in console:');
    console.log('   controllerLogger.switchView("ddr") - Switch to DDR view');
    console.log('   controllerLogger.switchView("button") - Switch to button view');
    console.log('   controllerLogger.buttonPressCount - See button press counts');
    console.log('   controllerLogger.gamepadType - Current controller type');
    console.log('   Press ESCAPE key to fix stuck buttons');
    
    // Add emergency cleanup on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            window.controllerLogger.emergencyCleanup();
        }
    });
});