#!/usr/bin/env python3
"""
StreamPad - DDR-Style Controller Input Logger (Pygame Version)
A visual controller input display for streaming overlays
"""

import os
# allow joystick events + polling while window is not focused
os.environ.setdefault("SDL_JOYSTICK_ALLOW_BACKGROUND_EVENTS", "1")

import pygame
import sys
import time
import math
import threading
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum

# For global input detection
try:
    from pynput import mouse, keyboard
    PYNPUT_AVAILABLE = True
except ImportError:
    PYNPUT_AVAILABLE = False
    print("⚠️ pynput not available - only detecting inputs when window is active")

# Initialize Pygame
pygame.init()
pygame.joystick.init()

# Constants
SCREEN_WIDTH = 1200
SCREEN_HEIGHT = 600
FPS = 60

# Colors (matching the web version)
COLORS = {
    'background': (20, 20, 30),
    'lane_bg': (40, 40, 50),
    'lane_border': (60, 60, 70),
    'text': (255, 255, 255),
    'button_colors': {
        '14': (255, 20, 147),   # LEFT - Deep Pink
        '12': (0, 255, 255),    # UP - Cyan
        '15': (50, 205, 50),    # RIGHT - Lime Green
        '13': (255, 215, 0),    # DOWN - Gold
        '4': (255, 69, 0),      # L1 - Orange Red
        '5': (148, 0, 211),     # R1 - Violet
        '6': (255, 140, 0),     # ZL - Dark Orange
        '7': (138, 43, 226),    # ZR - Blue Violet
        '8': (30, 144, 255),    # SELECT - Dodger Blue
        '9': (255, 105, 180),   # START - Hot Pink
        '2': (255, 255, 0),     # X - Yellow
        '3': (65, 105, 225),    # Y - Royal Blue
        '0': (0, 255, 127),     # B - Spring Green
        '1': (255, 99, 71)      # A - Tomato Red
    }
}

# Button mappings - arrows will be drawn as triangles
BUTTON_NAMES = {
    '14': 'LEFT', '12': 'UP', '15': 'RIGHT', '13': 'DOWN',  # Will draw triangles
    '4': 'L1', '5': 'R1', '6': 'ZL', '7': 'ZR',  # Added ZL/ZR (L2/R2)
    '8': 'SLCT', '9': 'STRT',
    '2': 'X', '3': 'Y', '0': 'B', '1': 'A'
}

BUTTON_ORDER = ['14', '12', '15', '13',  '2', '3', '0', '1',  '4', '5', '6', '7',  '8', '9',]

@dataclass
class DDRNote:
    """Represents a DDR note moving up the screen"""
    x: float
    y: float
    width: float
    height: float
    color: Tuple[int, int, int]
    button_id: str
    start_time: float
    end_time: Optional[float] = None
    is_growing: bool = True
    initial_bottom: float = 0

class ControllerType(Enum):
    SWITCH_PRO = "switch_pro"
    SNES_SWITCH = "snes_switch"
    PS4 = "ps4"
    PS5 = "ps5"
    XBOX = "xbox"
    GENERIC = "generic"

class StreamPadPygame:
    def __init__(self):
        # Initialize display (resizable)
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.RESIZABLE)
        pygame.display.set_caption("StreamPad - DDR Controller Input Logger")
        
        # Track current screen dimensions
        self.current_width = SCREEN_WIDTH
        self.current_height = SCREEN_HEIGHT
        self.clock = pygame.time.Clock()
        self.font = pygame.font.Font(None, 36)
        self.small_font = pygame.font.Font(None, 24)
        
        # Controller state
        self.controllers: Dict[int, pygame.joystick.Joystick] = {}
        self.active_controller: Optional[pygame.joystick.Joystick] = None
        self.controller_type: ControllerType = ControllerType.GENERIC
        self.button_states: Dict[str, bool] = {}
        self.last_button_states: Dict[str, bool] = {}
        self.last_axis_states: Dict[str, bool] = {}  # For joystick diagonal detection
        self.last_hat_state: Tuple[int, int] = (0, 0)  # dpad hat last state
        
        # DDR lanes
        # DDR layout (will be updated dynamically)
        self.button_height = 80
        self.update_layout_dimensions()
        
        # DDR notes
        self.notes: List[DDRNote] = []
        self.active_notes: Dict[str, DDRNote] = {}  # Currently growing notes
        
        # Animation settings (matching web version exactly)
        self.note_speed = 0.15 * 1000  # 0.15 pixels per millisecond = 150 pixels per second
        self.growth_rate = 0.08 * 1000  # 0.08 pixels per millisecond = 80 pixels per second
        self.min_note_height = 8  # Initial height matches web version
        self.initial_bottom = 5  # Start position matches web version
        
        # Stats
        self.button_press_count: Dict[str, int] = {btn: 0 for btn in BUTTON_ORDER}
        self.total_presses = 0
        
        # UI state
        self.show_help = False  # Toggle help with H key
        
        # device quirk handling
        self.nintendo_hat_only = False
        self.last_hat_event_time = 0.0
        self.hat_button_debounce_ms = 30  # ignore button events within 30ms of a hat move
        self.raw_dump = False  # press 'C' to toggle raw event dump
        
        # Global input detection
        self.global_input_enabled = True
        self.global_input_thread = None
        self.last_global_button_states: Dict[int, bool] = {}
        self.last_global_hat_state: Tuple[int, int] = (0, 0)
        self.global_input_lock = threading.Lock()
        
        # Initialize controller detection (safe initial scan)
        self.initial_controller_scan()
        
        # Start global input monitoring
        self.start_global_input_monitoring()
        
        print("🎮 StreamPad Pygame initialized!")
        print(f"🎯 Screen: {SCREEN_WIDTH}x{SCREEN_HEIGHT}")
        print(f"🎮 Controllers detected: {len(self.controllers)}")
        if self.global_input_enabled:
            print("🌍 Global input monitoring enabled - works even when window is not active!")
    
    def start_global_input_monitoring(self):
        """Start background thread for global controller monitoring"""
        if not self.global_input_enabled:
            return
            
        self.global_input_thread = threading.Thread(
            target=self.global_input_monitor_loop, 
            daemon=True  # Dies when main program exits
        )
        self.global_input_thread.start()
        
    def global_input_monitor_loop(self):
        """Background loop that monitors controller input globally"""
        while self.global_input_enabled:
            try:
                if self.active_controller and self.active_controller.get_init():
                    self.check_global_controller_input()
                time.sleep(1/120)  # 120 FPS polling for responsive input
            except Exception:
                time.sleep(0.1)
                
    def check_global_controller_input(self):
        """Check controller input globally (works when window not active)"""
        try:
            gamepad = self.active_controller
            if not gamepad or not gamepad.get_init():
                return
            
            # Skip global input if pygame window has focus (prevent double processing)
            if pygame.display.get_active():
                return
                
            # buttons
            suppress_buttons = self.nintendo_hat_only and self._hat_debounce_active()
            
            for i in range(gamepad.get_numbuttons()):
                try:
                    is_pressed = bool(gamepad.get_button(i))
                    was_pressed = self.last_global_button_states.get(i, False)
                    
                    if suppress_buttons:
                        # ignore any button transitions during hat debounce window
                        self.last_global_button_states[i] = is_pressed
                        continue
                    if self.nintendo_hat_only and i in (12, 13, 14, 15):
                        self.last_global_button_states[i] = is_pressed
                        continue
                    
                    if is_pressed and not was_pressed:
                        button_id = self.get_button_mapping(i)
                        if button_id:
                            with self.global_input_lock:
                                self.on_button_press(button_id)
                    
                    if not is_pressed and was_pressed:
                        button_id = self.get_button_mapping(i)
                        if button_id:
                            with self.global_input_lock:
                                self.on_button_release(button_id)
                    
                    self.last_global_button_states[i] = is_pressed
                except pygame.error:
                    break  # controller changed
                    
            # hat (D-pad) — many Nintendo pads present D-pad here
            self.check_global_hat()
            
            # axes for dpad (left stick fallback) + triggers
            if self.controller_type != ControllerType.SNES_SWITCH:
                self.check_global_joystick_axes()
            self.check_global_trigger_axes()
                
        except Exception:
            pass
            
    def check_global_hat(self):
        """Poll D-pad hat globally and convert to presses."""
        try:
            if not self.active_controller or not self.active_controller.get_init():
                return
            if self.active_controller.get_numhats() <= 0:
                return
            hx, hy = self.active_controller.get_hat(0)  # (-1/0/1, -1/0/1)
            # map to button IDs
            desired = {
                '14': hx < 0,  # LEFT
                '15': hx > 0,  # RIGHT
                '12': hy > 0,  # UP
                '13': hy < 0,  # DOWN
            }
            previous = {
                '14': self.last_hat_state[0] < 0,
                '15': self.last_hat_state[0] > 0,
                '12': self.last_hat_state[1] > 0,
                '13': self.last_hat_state[1] < 0,
            }
            for bid in ['14', '15', '12', '13']:
                if desired[bid] and not previous[bid]:
                    with self.global_input_lock:
                        self.on_button_press(bid)
                if (not desired[bid]) and previous[bid]:
                    with self.global_input_lock:
                        self.on_button_release(bid)
            self.last_hat_state = (hx, hy)
            self.last_global_hat_state = (hx, hy)
            self.last_hat_event_time = time.time()  # stamp for debounce
        except Exception:
            pass

    def check_global_trigger_axes(self):
        """Map analog triggers to ZL/ZR when they are axes on some controllers."""
        try:
            if not self.active_controller or not self.active_controller.get_init():
                return
            axes = self.active_controller.get_numaxes()
            if axes <= 2:
                return
            # Heuristic: common layouts
            # PS pads: L2 ~ axis 4, R2 ~ axis 5 in [-1..1] (pressed -> +1)
            # XInput: triggers may be combined or separate; leave as-is unless obvious
            threshold = 0.5

            def press_release(flag_key: str, pressed: bool, button_id: str):
                was = self.last_axis_states.get(flag_key, False)
                if pressed != was:
                    if pressed:
                        self.on_button_press(button_id)
                    else:
                        self.on_button_release(button_id)
                    self.last_axis_states[flag_key] = pressed

            if axes >= 5:
                l2 = self.active_controller.get_axis(4)
                press_release('zl_axis', l2 > threshold, '6')
            if axes >= 6:
                r2 = self.active_controller.get_axis(5)
                press_release('zr_axis', r2 > threshold, '7')
        except Exception:
            pass
            
    def check_global_joystick_axes(self):
        """Check joystick axes globally (similar to handle_joystick_axes)"""
        try:
            if not self.active_controller or not self.active_controller.get_init():
                return
            
            if self.active_controller.get_numaxes() < 2:
                return
                
            x_axis = self.active_controller.get_axis(0)
            y_axis = self.active_controller.get_axis(1)
            
            deadzone = 0.5
            
            directions = [
                ('left', x_axis < -deadzone, '14'),
                ('right', x_axis > deadzone, '15'), 
                ('up', y_axis < -deadzone, '12'),
                ('down', y_axis > deadzone, '13')
            ]
            
            for direction, pressed, button_id in directions:
                was_pressed = self.last_axis_states.get(direction, False)
                if pressed != was_pressed:
                    with self.global_input_lock:
                        if pressed:
                            self.on_button_press(button_id)
                        else:
                            self.on_button_release(button_id)
                    self.last_axis_states[direction] = pressed
                    
        except Exception:
            pass
    
    def update_layout_dimensions(self):
        """Update layout dimensions based on current screen size"""
        self.lane_width = self.current_width // len(BUTTON_ORDER)
        self.lane_height = self.current_height - 100
    
    def initial_controller_scan(self):
        """Initial safe controller scan (no quit/init cycle)"""
        try:
            controller_count = pygame.joystick.get_count()
            print(f"🔍 Scanning for controllers... Found: {controller_count}")
            
            for i in range(controller_count):
                try:
                    controller = pygame.joystick.Joystick(i)
                    controller.init()
                    self.controllers[i] = controller
                    
                    print(f"   Controller {i}: {controller.get_name()}")
                    print(f"      Buttons: {controller.get_numbuttons()} | Axes: {controller.get_numaxes()} | Hats: {controller.get_numhats()}")
                    
                    if self.active_controller is None:
                        self.active_controller = controller
                        self.controller_type = self.detect_controller_type(controller)
                        print(f"✅ Active controller: {controller.get_name()}")
                        print(f"   Type: {self.controller_type.value}")
                        
                        # set nintendo_hat_only if device has a hat
                        try:
                            has_hat = self.active_controller.get_numhats() > 0
                        except Exception:
                            has_hat = False
                        self.nintendo_hat_only = has_hat and (
                            "nintendo" in self.active_controller.get_name().lower()
                            or "switch" in self.active_controller.get_name().lower()
                        )
                        print(f"   nintendo_hat_only={self.nintendo_hat_only}")
                        
                        # Auto-enable raw dump for debugging Nintendo controllers
                        if self.nintendo_hat_only:
                            self.raw_dump = True
                            print("🧪 Auto-enabled raw dump for Nintendo controller debugging")
                
                except pygame.error as e:
                    print(f"❌ Error initializing controller {i}: {e}")
                    
        except Exception as e:
            print(f"❌ Error in initial controller scan: {e}")
    
    def detect_controllers(self):
        """Detect and initialize connected controllers (ultra-safe version)"""
        print("🔄 Refreshing controller detection...")
        
        try:
            self.emergency_cleanup()
            
            current_active_name = None
            if self.active_controller:
                try:
                    current_active_name = self.active_controller.get_name()
                except:
                    pass
            
            for controller in list(self.controllers.values()):
                try:
                    if controller.get_init():
                        controller.quit()
                except:
                    pass
            self.controllers.clear()
            self.active_controller = None
            
            controller_count = pygame.joystick.get_count()
            print(f"🔍 Found {controller_count} controllers")
            
            for i in range(controller_count):
                try:
                    controller = pygame.joystick.Joystick(i)
                    if not controller.get_init():
                        controller.init()
                    self.controllers[i] = controller
                    
                    print(f"   Controller {i}: {controller.get_name()}")
                    print(f"      Buttons: {controller.get_numbuttons()} | Axes: {controller.get_numaxes()} | Hats: {controller.get_numhats()}")
                    
                    if current_active_name and controller.get_name() == current_active_name:
                        self.active_controller = controller
                        self.controller_type = self.detect_controller_type(controller)
                        print(f"✅ Reselected: {controller.get_name()}")
                    elif self.active_controller is None:
                        self.active_controller = controller
                        self.controller_type = self.detect_controller_type(controller)
                        print(f"✅ Active controller: {controller.get_name()}")
                        print(f"   Type: {self.controller_type.value}")
                        
                        # set nintendo_hat_only if device has a hat
                        try:
                            has_hat = self.active_controller.get_numhats() > 0
                        except Exception:
                            has_hat = False
                        self.nintendo_hat_only = has_hat and (
                            "nintendo" in self.active_controller.get_name().lower()
                            or "switch" in self.active_controller.get_name().lower()
                        )
                        print(f"   nintendo_hat_only={self.nintendo_hat_only}")
                        
                        # Auto-enable raw dump for debugging Nintendo controllers
                        if self.nintendo_hat_only:
                            self.raw_dump = True
                            print("🧪 Auto-enabled raw dump for Nintendo controller debugging")
                
                except pygame.error as e:
                    print(f"❌ Error initializing controller {i}: {e}")
                    
        except Exception as e:
            print(f"❌ Error in controller detection: {e}")
            self.controllers.clear()
            self.active_controller = None
    
    def _hat_debounce_active(self) -> bool:
        return (time.time() - self.last_hat_event_time) * 1000.0 <= self.hat_button_debounce_ms
    
    def detect_controller_type(self, controller: pygame.joystick.Joystick) -> ControllerType:
        """Detect controller type based on name and properties"""
        name = controller.get_name().lower()
        
        if "pro controller" in name or "switch pro" in name:
            return ControllerType.SWITCH_PRO
        elif "nintendo" in name or "switch" in name or "snes" in name:
            return ControllerType.SNES_SWITCH
        elif "ps4" in name or "dualshock" in name:
            return ControllerType.PS4
        elif "ps5" in name or "dualsense" in name:
            return ControllerType.PS5
        elif "xbox" in name or "microsoft" in name:
            return ControllerType.XBOX
        else:
            return ControllerType.GENERIC
    
    def get_button_mapping(self, pygame_button: int) -> Optional[str]:
        """Map pygame button index to our internal button ID"""
        # Default mapping for most controllers
        mapping = {
            0: '1',   # A (bottom face button)
            1: '0',   # B (right face button)
            2: '2',   # X (left face button)
            3: '3',   # Y (top face button)
            4: '4',   # L1/LB (left shoulder)
            5: '5',   # R1/RB (right shoulder)
            6: '8',   # SELECT/Back/Share
            7: '9',   # START/Options/Menu
            8: '8',   # SELECT (alternative mapping)
            9: '9',   # START (alternative mapping)
            10: '4',  # L1 (alternative mapping)
            11: '5',  # R1 (alternative mapping)
            # D-pad often NOT buttons; handled via hat.
            # Keeping these for devices that *do* expose as buttons:
            12: '12', # UP
            13: '13', # DOWN
            14: '14', # LEFT
            15: '15', # RIGHT
        }
        
        # Switch Pro Controller specific mapping (FIXED based on testing data!)
        if self.controller_type == ControllerType.SWITCH_PRO:
            # From your test: Physical → Log showed → Should show → Pygame index
            # DPAD UP → R1 → UP → pygame 5
            # DPAD RIGHT → LEFT → RIGHT → pygame 14  
            # DPAD DOWN → UP → DOWN → pygame 12
            # DPAD LEFT → DOWN → LEFT → pygame 13
            # L1 → STRT → L1 → pygame 9
            # R1 → L1 → R1 → pygame 4 (conflicts with MINUS!)
            # ZL → ZL → ZL → pygame 6 (conflicts with PLUS!)
            # ZR → ZR → ZR → pygame 7 ✓  
            # Y → Y → Y → pygame 3 ✓
            # X → X → X → pygame 2 ✓
            # B → A → B → pygame 1
            # A → B → A → pygame 0
            # MINUS → L1 (twice!) → SELECT → pygame 4 (same as R1!)
            # PLUS → ZL → START → pygame 6 (same as ZL!)
            
            mapping = {
                # Face buttons (A/B swapped - working correctly!)
                0: '1',   # pygame 0 → B → should be A
                1: '0',   # pygame 1 → A → should be B
                2: '2',   # pygame 2 → X → correct ✅
                3: '3',   # pygame 3 → Y → correct ✅
                
                # Shoulders/triggers/system (CORRECTED with mapping tool results!)
                4: '8',   # pygame 4 → SELECT ✅
                6: '9',   # pygame 6 → START ✅
                7: '10',  # pygame 7 → L3 (stick click)
                8: '11',  # pygame 8 → R3 (stick click)
                9: '4',   # pygame 9 → L1 ✅
                10: '5',  # pygame 10 → R1 ✅ (FOUND IT!)
                
                # ZL/ZR are on axes, not buttons - handle separately
                
                # D-pad (CORRECTED with mapping tool results!)
                11: '12', # pygame 11 → UP ✅
                12: '13', # pygame 12 → DOWN ✅
                13: '14', # pygame 13 → LEFT ✅
                14: '15', # pygame 14 → RIGHT ✅
            }
        
        # SNES Controller specific mapping (from controller_mapper.py results)
        elif self.controller_type == ControllerType.SNES_SWITCH:
            mapping.update({
                # D-pad buttons
                11: '12',  # DPAD_UP
                12: '13',  # DPAD_DOWN
                13: '14',  # DPAD_LEFT
                14: '15',  # DPAD_RIGHT
                
                # Shoulder buttons
                9: '4',    # L1
                10: '5',   # R1
                
                # Face buttons (SNES layout)
                0: '1',    # A button
                1: '0',    # B button
                2: '2',    # X button
                3: '3',    # Y button
                
                # System buttons
                4: '8',    # SELECT
                6: '9',    # START
            })
        
        return mapping.get(pygame_button)
    
    def handle_events(self):
        """Handle pygame events"""
        for event in pygame.event.get():
            if self.raw_dump:
                print(f"RAW: {event}")
                
            if event.type == pygame.QUIT:
                return False
            
            elif event.type == pygame.VIDEORESIZE:
                # Handle window resize
                self.current_width = event.w
                self.current_height = event.h
                self.screen = pygame.display.set_mode((self.current_width, self.current_height), pygame.RESIZABLE)
                self.update_layout_dimensions()
                print(f"🔄 Window resized to {self.current_width}x{self.current_height}")
            
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    self.emergency_cleanup()
                elif event.key == pygame.K_r:
                    self.detect_controllers()  # Refresh controllers
                elif event.key == pygame.K_TAB:
                    self.switch_active_controller()  # Switch between controllers
                elif event.key == pygame.K_h:
                    self.show_help = not self.show_help  # Toggle help
                elif event.key == pygame.K_c:
                    self.raw_dump = not self.raw_dump
                    print(f"🧪 raw dump {'ON' if self.raw_dump else 'OFF'}")
                elif event.key == pygame.K_v:
                    print("🔧 Manual button state validation...")
                    self.validate_button_states()
            
            elif event.type == pygame.JOYBUTTONDOWN:
                try:
                    if self.active_controller and event.joy == self.active_controller.get_instance_id():
                        # TEMPORARILY DISABLED suppression to see all raw events
                        # if self.nintendo_hat_only and event.button in (12, 13, 14, 15):
                        #     if self.raw_dump:
                        #         print(f"RAW: suppressed dpad button {event.button} due to hat-only mode")
                        #     continue
                        # if self.nintendo_hat_only and self._hat_debounce_active():
                        #     if self.raw_dump:
                        #         print(f"RAW: suppressed button {event.button} (hat debounce)")
                        #     continue

                        button_id = self.get_button_mapping(event.button)
                        if button_id:
                            self.on_button_press(button_id)
                except (pygame.error, AttributeError):
                    pass  # Ignore errors from disconnected controllers
            
            elif event.type == pygame.JOYBUTTONUP:
                try:
                    if self.active_controller and event.joy == self.active_controller.get_instance_id():
                        # TEMPORARILY DISABLED suppression for button up events too
                        # if self.nintendo_hat_only and event.button in (12, 13, 14, 15):
                        #     if self.raw_dump:
                        #         print(f"RAW: suppressed dpad button {event.button} up due to hat-only mode")
                        #     continue
                        # if self.nintendo_hat_only and self._hat_debounce_active():
                        #     if self.raw_dump:
                        #         print(f"RAW: suppressed button {event.button} up (hat debounce)")
                        #     continue

                        button_id = self.get_button_mapping(event.button)
                        if button_id:
                            self.on_button_release(button_id)
                except (pygame.error, AttributeError):
                    pass  # Ignore errors from disconnected controllers

            elif event.type == pygame.JOYHATMOTION:
                self.last_hat_event_time = time.time()
                # Convert hat x/y into d-pad button presses
                try:
                    if self.active_controller and event.joy == self.active_controller.get_instance_id():
                        hx, hy = event.value  # (-1/0/1, -1/0/1)
                        # compare to previous
                        prevx, prevy = self.last_hat_state
                        desired = {
                            '14': hx < 0,
                            '15': hx > 0,
                            '12': hy > 0,
                            '13': hy < 0,
                        }
                        previous = {
                            '14': prevx < 0,
                            '15': prevx > 0,
                            '12': prevy > 0,
                            '13': prevy < 0,
                        }
                        for bid in ['14', '15', '12', '13']:
                            if desired[bid] and not previous[bid]:
                                self.on_button_press(bid)
                            if (not desired[bid]) and previous[bid]:
                                self.on_button_release(bid)
                        self.last_hat_state = (hx, hy)
                except Exception:
                    pass
            
            elif event.type == pygame.JOYDEVICEADDED:
                print(f"🎮 Controller connected: {event.device_index}")
                print("   Press R to refresh controller list")
            
            elif event.type == pygame.JOYDEVICEREMOVED:
                print(f"🎮 Controller disconnected: {event.instance_id}")
                try:
                    to_remove = []
                    for idx, controller in self.controllers.items():
                        try:
                            if controller.get_instance_id() == event.instance_id:
                                to_remove.append(idx)
                        except:
                            to_remove.append(idx)
                    
                    for idx in to_remove:
                        if idx in self.controllers:
                            del self.controllers[idx]
                    
                    if self.active_controller:
                        try:
                            if self.active_controller.get_instance_id() == event.instance_id:
                                self.active_controller = None
                        except:
                            self.active_controller = None
                    
                    if not self.active_controller and self.controllers:
                        self.active_controller = list(self.controllers.values())[0]
                        self.controller_type = self.detect_controller_type(self.active_controller)
                        
                except Exception as e:
                    print(f"❌ Error handling controller removal: {e}")
        
        # Handle joystick axes for diagonal detection (cool feature!)
        if self.active_controller:
            self.handle_joystick_axes()
            self.handle_trigger_axes()
        
        return True
    
    def switch_active_controller(self):
        """Switch to the next available controller"""
        if len(self.controllers) <= 1:
            print("🎮 Only one controller available")
            return
        
        current_idx = None
        for idx, controller in self.controllers.items():
            if controller == self.active_controller:
                current_idx = idx
                break
        
        controller_indices = sorted(self.controllers.keys())
        if current_idx is not None:
            current_pos = controller_indices.index(current_idx)
            next_pos = (current_pos + 1) % len(controller_indices)
            next_idx = controller_indices[next_pos]
        else:
            next_idx = controller_indices[0]
        
        self.active_controller = self.controllers[next_idx]
        self.controller_type = self.detect_controller_type(self.active_controller)
        
        print(f"🔄 Switched to controller: {self.active_controller.get_name()}")
        print(f"   Type: {self.controller_type.value}")
        
        self.emergency_cleanup()
    
    def handle_joystick_axes(self):
        """Handle joystick axes for diagonal D-pad detection (cool feature!)"""
        if not self.active_controller:
            return
        
        # Skip axis -> dpad for SNES controllers (they use hats; axes can be noisy)
        if self.controller_type == ControllerType.SNES_SWITCH:
            return
        
        try:
            if not self.active_controller.get_init():
                return
            if self.active_controller.get_numaxes() < 2:
                return
                
            x_axis = self.active_controller.get_axis(0)  # Horizontal
            y_axis = self.active_controller.get_axis(1)  # Vertical
        except (pygame.error, AttributeError):
            return
        
        deadzone = 0.5
        
        left_pressed  = x_axis < -deadzone
        right_pressed = x_axis > deadzone
        up_pressed    = y_axis < -deadzone
        down_pressed  = y_axis > deadzone

        for key, pressed, bid in [
            ('left', left_pressed, '14'),
            ('right', right_pressed, '15'),
            ('up', up_pressed, '12'),
            ('down', down_pressed, '13'),
        ]:
            if pressed != self.last_axis_states.get(key, False):
                if pressed:
                    self.on_button_press(bid)
                else:
                    self.on_button_release(bid)
                self.last_axis_states[key] = pressed

    def handle_trigger_axes(self):
        """Handle ZL/ZR when they are axes on some controllers (local event loop)."""
        try:
            if not self.active_controller or not self.active_controller.get_init():
                return
            axes = self.active_controller.get_numaxes()
            if axes <= 2:
                return
            threshold = 0.5

            def press_release(flag_key: str, pressed: bool, button_id: str):
                was = self.last_axis_states.get(flag_key, False)
                if pressed != was:
                    if pressed:
                        self.on_button_press(button_id)
                    else:
                        self.on_button_release(button_id)
                    self.last_axis_states[flag_key] = pressed

            if axes >= 5:
                l2 = self.active_controller.get_axis(4)
                press_release('zl_axis', l2 > threshold, '6')
            if axes >= 6:
                r2 = self.active_controller.get_axis(5)
                press_release('zr_axis', r2 > threshold, '7')
        except Exception:
            pass
    
    def on_button_press(self, button_id: str):
        """Handle button press (thread-safe)"""
        with self.global_input_lock:
            if button_id in self.button_states and self.button_states[button_id]:
                return  # Already pressed
            
            print(f"🎮 Button {button_id} ({BUTTON_NAMES.get(button_id, button_id)}) pressed [Thread: {threading.current_thread().name}]")
            
            self.button_states[button_id] = True
            self.button_press_count[button_id] = self.button_press_count.get(button_id, 0) + 1
            self.total_presses += 1
            
            self.create_ddr_note(button_id)
    
    def on_button_release(self, button_id: str):
        """Handle button release (thread-safe)"""
        with self.global_input_lock:
            if button_id not in self.button_states or not self.button_states[button_id]:
                return  # Already released
            
            print(f"🎮 Button {button_id} ({BUTTON_NAMES.get(button_id, button_id)}) released [Thread: {threading.current_thread().name}]")
            
            self.button_states[button_id] = False
            self.end_ddr_note(button_id)
    
    def create_ddr_note(self, button_id: str):
        """Create a new DDR note (matching web version exactly)"""
        if button_id not in BUTTON_ORDER:
            return
        
        lane_index = BUTTON_ORDER.index(button_id)
        x = lane_index * self.lane_width + 5
        width = self.lane_width - 10
        height = self.min_note_height
        
        y = self.lane_height - self.initial_bottom - height
        
        color = COLORS['button_colors'].get(button_id, (255, 255, 255))
        
        note = DDRNote(
            x=x, y=y, width=width, height=height,
            color=color, button_id=button_id,
            start_time=time.time(),
            initial_bottom=self.lane_height - self.initial_bottom
        )
        
        self.notes.append(note)
        self.active_notes[button_id] = note
    
    def end_ddr_note(self, button_id: str):
        """End the growth of a DDR note"""
        if button_id in self.active_notes:
            note = self.active_notes[button_id]
            note.is_growing = False
            note.end_time = time.time()
            del self.active_notes[button_id]
    
    def update_ddr_notes(self, dt: float):
        """Update DDR note positions and sizes (matching web version exactly)"""
        notes_to_remove = []
        current_time = time.time()
        
        for note in self.notes:
            if note.is_growing:
                elapsed_ms = (current_time - note.start_time) * 1000
                grown_height = elapsed_ms * (self.growth_rate / 1000)
                new_height = self.min_note_height + grown_height
                note.height = new_height
                note.y = note.initial_bottom - note.height
            else:
                if note.end_time:
                    elapsed_since_release_ms = (current_time - note.end_time) * 1000
                    upward_movement = elapsed_since_release_ms * (self.note_speed / 1000)
                    note.y = note.initial_bottom - note.height - upward_movement
                
                if note.y + note.height < -100:
                    notes_to_remove.append(note)
        
        for note in notes_to_remove:
            if note in self.notes:
                self.notes.remove(note)
    
    def draw_lanes(self):
        """Draw the DDR lanes and buttons"""
        for i, button_id in enumerate(BUTTON_ORDER):
            x = i * self.lane_width
            
            lane_rect = pygame.Rect(x, -10, self.lane_width, self.lane_height)
            pygame.draw.rect(self.screen, COLORS['lane_bg'], lane_rect)
            pygame.draw.rect(self.screen, COLORS['lane_border'], lane_rect, 2)
            
            button_rect = pygame.Rect(x + 5, self.lane_height, self.lane_width - 10, self.button_height)
            button_color = COLORS['lane_border']
            
            if self.button_states.get(button_id, False):
                button_color = COLORS['button_colors'].get(button_id, (255, 255, 255))
            
            pygame.draw.rect(self.screen, button_color, button_rect)
            pygame.draw.rect(self.screen, COLORS['lane_border'], button_rect, 3)
            
            text_color = (0, 0, 0) if self.button_states.get(button_id, False) else COLORS['text']
            
            if button_id in ['12', '13', '14', '15']:
                self.draw_triangle(button_rect, button_id, text_color)
            else:
                button_text = self.font.render(BUTTON_NAMES.get(button_id, button_id), True, text_color)
                text_rect = button_text.get_rect(center=button_rect.center)
                self.screen.blit(button_text, text_rect)
    
    def draw_triangle(self, button_rect: pygame.Rect, button_id: str, color: tuple):
        """Draw triangle arrows for D-pad buttons"""
        center_x = button_rect.centerx
        center_y = button_rect.centery
        size = min(button_rect.width, button_rect.height) // 4
        
        if button_id == '12':  # UP
            points = [
                (center_x, center_y - size),
                (center_x - size, center_y + size//2),
                (center_x + size, center_y + size//2)
            ]
        elif button_id == '13':  # DOWN
            points = [
                (center_x, center_y + size),
                (center_x - size, center_y - size//2),
                (center_x + size, center_y - size//2)
            ]
        elif button_id == '14':  # LEFT
            points = [
                (center_x - size, center_y),
                (center_x + size//2, center_y - size),
                (center_x + size//2, center_y + size)
            ]
        elif button_id == '15':  # RIGHT
            points = [
                (center_x + size, center_y),
                (center_x - size//2, center_y - size),
                (center_x - size//2, center_y + size)
            ]
        else:
            return
        
        pygame.draw.polygon(self.screen, color, points)
    
    def draw_ddr_notes(self):
        """Draw all DDR notes with glow effects (matching web version feel)"""
        for note in self.notes:
            note_rect = pygame.Rect(note.x, note.y, note.width, note.height)
            
            if note.height > 50:
                for i in range(3):
                    glow_size = (i + 1) * 2
                    glow_alpha = 60 - (i * 15)
                    glow_color = (*note.color, glow_alpha)
                    glow_rect = pygame.Rect(
                        note.x - glow_size, note.y - glow_size, 
                        note.width + glow_size * 2, note.height + glow_size * 2
                    )
                    glow_surface = pygame.Surface((glow_rect.width, glow_rect.height), pygame.SRCALPHA)
                    pygame.draw.rect(glow_surface, glow_color, (0, 0, glow_rect.width, glow_rect.height), 2)
                    self.screen.blit(glow_surface, (glow_rect.x, glow_rect.y))
            
            pygame.draw.rect(self.screen, note.color, note_rect)
            pygame.draw.rect(self.screen, note.color, note_rect, 1)
    
    def draw_ui(self):
        """Draw UI elements"""
        if self.show_help:
            if self.active_controller:
                status_text = f"Controller: {self.active_controller.get_name()} ({self.controller_type.value})"
                status_color = (0, 255, 0)
            else:
                status_text = "No Controller Connected - Press R to refresh"
                status_color = (255, 100, 100)
            
            status_surface = self.small_font.render(status_text, True, status_color)
            self.screen.blit(status_surface, (10, 10))
            
            stats_text = f"Total Presses: {self.total_presses}"
            stats_surface = self.small_font.render(stats_text, True, COLORS['text'])
            self.screen.blit(stats_surface, (10, 35))
            
            instructions = [
                "H: Toggle help",
                "ESC: Emergency cleanup",
                "R: Refresh controllers", 
                "TAB: Switch controller",
                "C: Raw dump on/off",
                f"D-pad via HAT: {'ON' if self.nintendo_hat_only else 'OFF'}"
            ]
            
            for i, instruction in enumerate(instructions):
                inst_surface = self.small_font.render(instruction, True, COLORS['text'])
                self.screen.blit(inst_surface, (SCREEN_WIDTH - 320, 10 + i * 25))
        else:
            help_text = "" # "Press H for help"
            help_surface = self.small_font.render(help_text, True, (100, 100, 100))
            self.screen.blit(help_surface, (SCREEN_WIDTH - 120, 10))
    
    def emergency_cleanup(self):
        """Clear all stuck states and notes"""
        print("🧹 Emergency cleanup - clearing all stuck states")
        
        # Use thread lock for safety
        with self.global_input_lock:
            # Clear all button states
            self.button_states.clear()
            self.last_button_states.clear()
            self.last_axis_states.clear()
            self.last_global_button_states.clear()
            
            # Clear hat states
            self.last_hat_state = (0, 0)
            self.last_global_hat_state = (0, 0)
            self.last_hat_event_time = 0.0
            
            # Clear all notes
            self.active_notes.clear()
            self.notes.clear()
            
            # Force end any stuck notes
            for button_id in list(self.active_notes.keys()):
                self.on_button_release(button_id)
        
        print("✅ Emergency cleanup completed")
    
    def validate_button_states(self):
        """Validate button states against actual controller state to prevent stuck buttons"""
        if not self.active_controller or not self.active_controller.get_init():
            return
            
        try:
            with self.global_input_lock:
                # Check each button that we think is pressed
                stuck_buttons = []
                for button_id, is_pressed in self.button_states.items():
                    if is_pressed:
                        # Get the actual pygame button index for this button
                        pygame_button = None
                        button_mapping = self.get_button_mapping()
                        for pygame_idx, mapped_id in button_mapping.items():
                            if mapped_id == button_id:
                                pygame_button = pygame_idx
                                break
                        
                        # Check if the physical button is actually pressed
                        if pygame_button is not None and pygame_button < self.active_controller.get_numbuttons():
                            actual_pressed = self.active_controller.get_button(pygame_button)
                            if not actual_pressed:
                                stuck_buttons.append(button_id)
                
                # Release any stuck buttons
                for button_id in stuck_buttons:
                    print(f"🔧 Auto-fixing stuck button: {button_id}")
                    self.on_button_release(button_id)
                    
        except Exception as e:
            # If validation fails, just do emergency cleanup
            if stuck_buttons:
                print(f"⚠️ Button validation failed, doing emergency cleanup: {e}")
                self.emergency_cleanup()
        
    def cleanup(self):
        """Clean shutdown - stop global monitoring"""
        print("🔄 Shutting down StreamPad...")
        self.global_input_enabled = False
        if self.global_input_thread and self.global_input_thread.is_alive():
            self.global_input_thread.join(timeout=1.0)
    
    def run(self):
        """Main game loop"""
        running = True
        validation_timer = 0
        validation_interval = 2.0  # Validate button states every 2 seconds
        
        while running:
            dt = self.clock.tick(FPS) / 1000.0
            
            running = self.handle_events()
            self.update_ddr_notes(dt)
            
            # Periodic validation to prevent stuck buttons
            validation_timer += dt
            if validation_timer >= validation_interval:
                self.validate_button_states()
                validation_timer = 0
            
            self.screen.fill(COLORS['background'])
            self.draw_lanes()
            self.draw_ddr_notes()
            self.draw_ui()
            
            pygame.display.flip()
        
        self.cleanup()
        pygame.quit()
        sys.exit()

def main():
    """Main entry point"""
    app = None
    try:
        app = StreamPadPygame()
        app.run()
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
        if app:
            app.cleanup()
        pygame.quit()
        sys.exit()
    except Exception as e:
        print(f"❌ Error: {e}")
        if app:
            app.cleanup()
        pygame.quit()
        sys.exit(1)

if __name__ == "__main__":
    main()