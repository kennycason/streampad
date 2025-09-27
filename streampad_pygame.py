#!/usr/bin/env python3
"""
StreamPad - DDR-Style Controller Input Logger (Pygame Version)
A visual controller input display for streaming overlays
"""

import pygame
import sys
import time
import math
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum

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
    '4': 'L1', '5': 'R1', '8': 'SLCT', '9': 'STRT',
    '2': 'X', '3': 'Y', '0': 'B', '1': 'A'
}

BUTTON_ORDER = ['14', '12', '15', '13', '4', '5', '8', '9', '2', '3', '0', '1']

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
        # Initialize display
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("StreamPad - DDR Controller Input Logger")
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
        
        # DDR lanes
        self.lane_width = SCREEN_WIDTH // len(BUTTON_ORDER)
        self.lane_height = SCREEN_HEIGHT - 100
        self.button_height = 80
        
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
        
        # Initialize controller detection (safe initial scan)
        self.initial_controller_scan()
        
        print("🎮 StreamPad Pygame initialized!")
        print(f"🎯 Screen: {SCREEN_WIDTH}x{SCREEN_HEIGHT}")
        print(f"🎮 Controllers detected: {len(self.controllers)}")
    
    def initial_controller_scan(self):
        """Initial safe controller scan (no quit/init cycle)"""
        try:
            controller_count = pygame.joystick.get_count()
            print(f"🔍 Scanning for controllers... Found: {controller_count}")
            
            # Initialize each controller
            for i in range(controller_count):
                try:
                    controller = pygame.joystick.Joystick(i)
                    controller.init()
                    self.controllers[i] = controller
                    
                    print(f"   Controller {i}: {controller.get_name()}")
                    
                    # Auto-select first controller if none selected
                    if self.active_controller is None:
                        self.active_controller = controller
                        self.controller_type = self.detect_controller_type(controller)
                        print(f"✅ Active controller: {controller.get_name()}")
                        print(f"   Type: {self.controller_type.value}")
                        print(f"   Buttons: {controller.get_numbuttons()}")
                        print(f"   Axes: {controller.get_numaxes()}")
                
                except pygame.error as e:
                    print(f"❌ Error initializing controller {i}: {e}")
                    
        except Exception as e:
            print(f"❌ Error in initial controller scan: {e}")
    
    def detect_controllers(self):
        """Detect and initialize connected controllers (ultra-safe version)"""
        print("🔄 Refreshing controller detection...")
        
        try:
            # Clear button states first to prevent stuck buttons
            self.emergency_cleanup()
            
            # Store current active controller info
            current_active_name = None
            if self.active_controller:
                try:
                    current_active_name = self.active_controller.get_name()
                except:
                    pass
            
            # Clear existing controllers safely
            for controller in list(self.controllers.values()):
                try:
                    if controller.get_init():
                        controller.quit()
                except:
                    pass
            self.controllers.clear()
            self.active_controller = None
            
            # Get fresh controller count
            controller_count = pygame.joystick.get_count()
            print(f"🔍 Found {controller_count} controllers")
            
            # Initialize each controller
            for i in range(controller_count):
                try:
                    controller = pygame.joystick.Joystick(i)
                    if not controller.get_init():
                        controller.init()
                    self.controllers[i] = controller
                    
                    print(f"   Controller {i}: {controller.get_name()}")
                    
                    # Try to reselect the same controller if it was active before
                    if current_active_name and controller.get_name() == current_active_name:
                        self.active_controller = controller
                        self.controller_type = self.detect_controller_type(controller)
                        print(f"✅ Reselected: {controller.get_name()}")
                    
                    # Auto-select first controller if none selected
                    elif self.active_controller is None:
                        self.active_controller = controller
                        self.controller_type = self.detect_controller_type(controller)
                        print(f"✅ Active controller: {controller.get_name()}")
                        print(f"   Type: {self.controller_type.value}")
                        print(f"   Buttons: {controller.get_numbuttons()}")
                        print(f"   Axes: {controller.get_numaxes()}")
                
                except pygame.error as e:
                    print(f"❌ Error initializing controller {i}: {e}")
                    
        except Exception as e:
            print(f"❌ Error in controller detection: {e}")
            # Fallback: ensure we have a clean state
            self.controllers.clear()
            self.active_controller = None
    
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
            12: '12', # D-pad UP
            13: '13', # D-pad DOWN
            14: '14', # D-pad LEFT
            15: '15', # D-pad RIGHT
        }
        
        # Switch Pro Controller specific mapping (completely different layout!)
        if self.controller_type == ControllerType.SWITCH_PRO:
            mapping = {
                0: '0',   # B (Nintendo layout - right button)
                1: '1',   # A (Nintendo layout - bottom button)
                2: '3',   # Y (Nintendo layout - left button)
                3: '2',   # X (Nintendo layout - top button)
                4: '4',   # L (left shoulder)
                5: '5',   # R (right shoulder)
                6: '4',   # ZL -> L1 (alternative)
                7: '5',   # ZR -> R1 (alternative)
                8: '8',   # Minus/SELECT
                9: '9',   # Plus/START
                10: '4',  # L stick click -> L1 (alternative)
                11: '5',  # R stick click -> R1 (alternative)
                12: '12', # D-pad UP
                13: '13', # D-pad DOWN
                14: '14', # D-pad LEFT
                15: '15', # D-pad RIGHT
                16: '9',  # Home -> START (alternative)
                17: '8',  # Capture -> SELECT (alternative)
            }
        
        # SNES Controller specific mapping
        elif self.controller_type == ControllerType.SNES_SWITCH:
            mapping.update({
                0: '0',   # B (SNES layout)
                1: '1',   # A (SNES layout)
                2: '2',   # X (SNES layout)
                3: '3',   # Y (SNES layout)
            })
        
        return mapping.get(pygame_button)
    
    def handle_events(self):
        """Handle pygame events"""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return False
            
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    self.emergency_cleanup()
                elif event.key == pygame.K_r:
                    self.detect_controllers()  # Refresh controllers
                elif event.key == pygame.K_TAB:
                    self.switch_active_controller()  # Switch between controllers
                elif event.key == pygame.K_h:
                    self.show_help = not self.show_help  # Toggle help
            
            elif event.type == pygame.JOYBUTTONDOWN:
                try:
                    if self.active_controller and event.joy == self.active_controller.get_instance_id():
                        button_id = self.get_button_mapping(event.button)
                        if button_id:
                            self.on_button_press(button_id)
                except (pygame.error, AttributeError):
                    pass  # Ignore errors from disconnected controllers
            
            elif event.type == pygame.JOYBUTTONUP:
                try:
                    if self.active_controller and event.joy == self.active_controller.get_instance_id():
                        button_id = self.get_button_mapping(event.button)
                        if button_id:
                            self.on_button_release(button_id)
                except (pygame.error, AttributeError):
                    pass  # Ignore errors from disconnected controllers
            
            elif event.type == pygame.JOYDEVICEADDED:
                print(f"🎮 Controller connected: {event.device_index}")
                print("   Press R to refresh controller list")
            
            elif event.type == pygame.JOYDEVICEREMOVED:
                print(f"🎮 Controller disconnected: {event.instance_id}")
                try:
                    # Safely handle controller removal
                    to_remove = []
                    for idx, controller in self.controllers.items():
                        try:
                            if controller.get_instance_id() == event.instance_id:
                                to_remove.append(idx)
                        except:
                            to_remove.append(idx)  # Remove if we can't check
                    
                    for idx in to_remove:
                        if idx in self.controllers:
                            del self.controllers[idx]
                    
                    # If active controller was removed, find a new one
                    if self.active_controller:
                        try:
                            if self.active_controller.get_instance_id() == event.instance_id:
                                self.active_controller = None
                        except:
                            self.active_controller = None
                    
                    # Select new active controller if available
                    if not self.active_controller and self.controllers:
                        self.active_controller = list(self.controllers.values())[0]
                        self.controller_type = self.detect_controller_type(self.active_controller)
                        
                except Exception as e:
                    print(f"❌ Error handling controller removal: {e}")
        
        # Handle joystick axes for diagonal detection (cool feature!)
        if self.active_controller:
            self.handle_joystick_axes()
        
        return True
    
    def switch_active_controller(self):
        """Switch to the next available controller"""
        if len(self.controllers) <= 1:
            print("🎮 Only one controller available")
            return
        
        # Find current controller index
        current_idx = None
        for idx, controller in self.controllers.items():
            if controller == self.active_controller:
                current_idx = idx
                break
        
        # Switch to next controller
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
        
        # Clear states to prevent stuck buttons
        self.emergency_cleanup()
    
    def handle_joystick_axes(self):
        """Handle joystick axes for diagonal D-pad detection (cool feature!)"""
        if not self.active_controller:
            return
        
        # Skip axis detection for SNES controllers (they have faulty axis readings)
        if self.controller_type == ControllerType.SNES_SWITCH:
            return
        
        # Get left stick axes (usually axes 0 and 1)
        try:
            if not self.active_controller.get_init():
                return
            
            # Check if we have enough axes
            if self.active_controller.get_numaxes() < 2:
                return
                
            x_axis = self.active_controller.get_axis(0)  # Horizontal
            y_axis = self.active_controller.get_axis(1)  # Vertical
        except (pygame.error, AttributeError):
            return
        
        # Deadzone threshold (larger to prevent false positives)
        deadzone = 0.5
        
        # Check for diagonal movements and treat as D-pad presses
        # Left stick left
        left_pressed = x_axis < -deadzone
        if left_pressed != self.last_axis_states.get('left', False):
            if left_pressed:
                self.on_button_press('14')  # D-pad left
            else:
                self.on_button_release('14')
            self.last_axis_states['left'] = left_pressed
        
        # Left stick right  
        right_pressed = x_axis > deadzone
        if right_pressed != self.last_axis_states.get('right', False):
            if right_pressed:
                self.on_button_press('15')  # D-pad right
            else:
                self.on_button_release('15')
            self.last_axis_states['right'] = right_pressed
        
        # Left stick up
        up_pressed = y_axis < -deadzone
        if up_pressed != self.last_axis_states.get('up', False):
            if up_pressed:
                self.on_button_press('12')  # D-pad up
            else:
                self.on_button_release('12')
            self.last_axis_states['up'] = up_pressed
        
        # Left stick down
        down_pressed = y_axis > deadzone
        if down_pressed != self.last_axis_states.get('down', False):
            if down_pressed:
                self.on_button_press('13')  # D-pad down
            else:
                self.on_button_release('13')
            self.last_axis_states['down'] = down_pressed
    
    def on_button_press(self, button_id: str):
        """Handle button press"""
        if button_id in self.button_states and self.button_states[button_id]:
            return  # Already pressed
        
        print(f"🎮 Button {button_id} ({BUTTON_NAMES.get(button_id, button_id)}) pressed")
        
        self.button_states[button_id] = True
        self.button_press_count[button_id] = self.button_press_count.get(button_id, 0) + 1
        self.total_presses += 1
        
        # Create DDR note
        self.create_ddr_note(button_id)
    
    def on_button_release(self, button_id: str):
        """Handle button release"""
        if button_id not in self.button_states or not self.button_states[button_id]:
            return  # Already released
        
        print(f"🎮 Button {button_id} ({BUTTON_NAMES.get(button_id, button_id)}) released")
        
        self.button_states[button_id] = False
        
        # End DDR note growth
        self.end_ddr_note(button_id)
    
    def create_ddr_note(self, button_id: str):
        """Create a new DDR note (matching web version exactly)"""
        if button_id not in BUTTON_ORDER:
            return
        
        lane_index = BUTTON_ORDER.index(button_id)
        x = lane_index * self.lane_width + 5
        width = self.lane_width - 10
        height = self.min_note_height  # 8px initial height
        
        # Start position: 5px from bottom (matching web version)
        y = self.lane_height - self.initial_bottom - height
        
        color = COLORS['button_colors'].get(button_id, (255, 255, 255))
        
        note = DDRNote(
            x=x, y=y, width=width, height=height,
            color=color, button_id=button_id,
            start_time=time.time(),
            initial_bottom=self.lane_height - self.initial_bottom  # Fixed bottom position
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
                # Grow downward while button is held (matching web version)
                elapsed_ms = (current_time - note.start_time) * 1000  # Convert to milliseconds
                grown_height = elapsed_ms * (self.growth_rate / 1000)  # 0.08 pixels per millisecond
                new_height = self.min_note_height + grown_height
                note.height = new_height
                # Keep bottom position fixed while growing (grow downward)
                note.y = note.initial_bottom - note.height
            else:
                # Move upward after button release (matching web version)
                if note.end_time:
                    elapsed_since_release_ms = (current_time - note.end_time) * 1000
                    # 0.15 pixels per millisecond upward movement
                    upward_movement = elapsed_since_release_ms * (self.note_speed / 1000)
                    note.y = note.initial_bottom - note.height - upward_movement
                
                # Remove if off screen (matching web version logic)
                if note.y + note.height < -100:  # Give some buffer like web version
                    notes_to_remove.append(note)
        
        # Remove off-screen notes
        for note in notes_to_remove:
            if note in self.notes:
                self.notes.remove(note)
    
    def draw_lanes(self):
        """Draw the DDR lanes and buttons"""
        for i, button_id in enumerate(BUTTON_ORDER):
            x = i * self.lane_width
            
            # Draw lane background
            lane_rect = pygame.Rect(x, 0, self.lane_width, self.lane_height)
            pygame.draw.rect(self.screen, COLORS['lane_bg'], lane_rect)
            pygame.draw.rect(self.screen, COLORS['lane_border'], lane_rect, 2)
            
            # Draw button at bottom
            button_rect = pygame.Rect(x + 5, self.lane_height, self.lane_width - 10, self.button_height)
            button_color = COLORS['lane_border']
            
            # Highlight if pressed
            if self.button_states.get(button_id, False):
                button_color = COLORS['button_colors'].get(button_id, (255, 255, 255))
            
            pygame.draw.rect(self.screen, button_color, button_rect)
            pygame.draw.rect(self.screen, COLORS['lane_border'], button_rect, 3)
            
            # Draw button content (triangles for D-pad, text for others)
            text_color = (0, 0, 0) if self.button_states.get(button_id, False) else COLORS['text']
            
            if button_id in ['12', '13', '14', '15']:  # D-pad buttons
                self.draw_triangle(button_rect, button_id, text_color)
            else:
                button_text = self.font.render(BUTTON_NAMES.get(button_id, button_id), True, text_color)
                text_rect = button_text.get_rect(center=button_rect.center)
                self.screen.blit(button_text, text_rect)
    
    def draw_triangle(self, button_rect: pygame.Rect, button_id: str, color: tuple):
        """Draw triangle arrows for D-pad buttons"""
        center_x = button_rect.centerx
        center_y = button_rect.centery
        size = min(button_rect.width, button_rect.height) // 4  # Triangle size
        
        if button_id == '12':  # UP
            points = [
                (center_x, center_y - size),      # Top point
                (center_x - size, center_y + size//2),  # Bottom left
                (center_x + size, center_y + size//2)   # Bottom right
            ]
        elif button_id == '13':  # DOWN
            points = [
                (center_x, center_y + size),      # Bottom point
                (center_x - size, center_y - size//2),  # Top left
                (center_x + size, center_y - size//2)   # Top right
            ]
        elif button_id == '14':  # LEFT
            points = [
                (center_x - size, center_y),      # Left point
                (center_x + size//2, center_y - size),  # Top right
                (center_x + size//2, center_y + size)   # Bottom right
            ]
        elif button_id == '15':  # RIGHT
            points = [
                (center_x + size, center_y),      # Right point
                (center_x - size//2, center_y - size),  # Top left
                (center_x - size//2, center_y + size)   # Bottom left
            ]
        else:
            return
        
        pygame.draw.polygon(self.screen, color, points)
    
    def draw_ddr_notes(self):
        """Draw all DDR notes with glow effects (matching web version feel)"""
        for note in self.notes:
            note_rect = pygame.Rect(note.x, note.y, note.width, note.height)
            
            # Add glow effect for long notes (matching web version)
            if note.height > 50:
                # Create multiple glow layers for better effect
                for i in range(3):
                    glow_size = (i + 1) * 2
                    glow_alpha = 60 - (i * 15)  # Fade out each layer
                    glow_color = (*note.color, glow_alpha)
                    glow_rect = pygame.Rect(
                        note.x - glow_size, note.y - glow_size, 
                        note.width + glow_size * 2, note.height + glow_size * 2
                    )
                    # Create surface for alpha blending
                    glow_surface = pygame.Surface((glow_rect.width, glow_rect.height), pygame.SRCALPHA)
                    pygame.draw.rect(glow_surface, glow_color, (0, 0, glow_rect.width, glow_rect.height), 2)
                    self.screen.blit(glow_surface, (glow_rect.x, glow_rect.y))
            
            # Draw main note
            pygame.draw.rect(self.screen, note.color, note_rect)
            
            # Add border for definition (matching web version style)
            pygame.draw.rect(self.screen, note.color, note_rect, 1)
    
    def draw_ui(self):
        """Draw UI elements"""
        if self.show_help:
            # Controller status
            if self.active_controller:
                status_text = f"Controller: {self.active_controller.get_name()} ({self.controller_type.value})"
                status_color = (0, 255, 0)
            else:
                status_text = "No Controller Connected - Press R to refresh"
                status_color = (255, 100, 100)
            
            status_surface = self.small_font.render(status_text, True, status_color)
            self.screen.blit(status_surface, (10, 10))
            
            # Stats
            stats_text = f"Total Presses: {self.total_presses}"
            stats_surface = self.small_font.render(stats_text, True, COLORS['text'])
            self.screen.blit(stats_surface, (10, 35))
            
            # Instructions
            instructions = [
                "H: Toggle help",
                "ESC: Emergency cleanup",
                "R: Refresh controllers", 
                "TAB: Switch controller",
                "Left stick: D-pad (diagonal = both!)"
            ]
            
            for i, instruction in enumerate(instructions):
                inst_surface = self.small_font.render(instruction, True, COLORS['text'])
                self.screen.blit(inst_surface, (SCREEN_WIDTH - 280, 10 + i * 25))
        else:
            # Minimal UI - just show help hint
            help_text = "Press H for help"
            help_surface = self.small_font.render(help_text, True, (100, 100, 100))
            self.screen.blit(help_surface, (SCREEN_WIDTH - 120, 10))
    
    def emergency_cleanup(self):
        """Clear all stuck states and notes"""
        print("🧹 Emergency cleanup - clearing all stuck states")
        self.button_states.clear()
        self.last_button_states.clear()
        self.last_axis_states.clear()  # Clear joystick states too
        self.active_notes.clear()
        self.notes.clear()
    
    def run(self):
        """Main game loop"""
        running = True
        
        while running:
            dt = self.clock.tick(FPS) / 1000.0  # Delta time in seconds
            
            # Handle events
            running = self.handle_events()
            
            # Update
            self.update_ddr_notes(dt)
            
            # Draw
            self.screen.fill(COLORS['background'])
            self.draw_lanes()
            self.draw_ddr_notes()
            self.draw_ui()
            
            pygame.display.flip()
        
        pygame.quit()
        sys.exit()

def main():
    """Main entry point"""
    try:
        app = StreamPadPygame()
        app.run()
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
        pygame.quit()
        sys.exit()

if __name__ == "__main__":
    main()
