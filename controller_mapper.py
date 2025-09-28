#!/usr/bin/env python3
"""
Controller Mapping Tool
Simple program to map physical controller buttons to pygame indices
"""

import pygame
import sys
import time
from enum import Enum

class ButtonTest:
    def __init__(self, name, description):
        self.name = name
        self.description = description
        self.pygame_index = None
        self.event_type = None  # 'button', 'hat', 'axis'
        self.completed = False

def main():
    print("🎮 Controller Mapping Tool")
    print("=" * 50)
    
    # Initialize pygame
    pygame.init()
    pygame.joystick.init()
    
    # Create a small window for keyboard input (required for key events)
    screen = pygame.display.set_mode((400, 200))
    pygame.display.set_caption("Controller Mapper - Press buttons or SPACE to skip")
    
    # Check for controllers
    if pygame.joystick.get_count() == 0:
        print("❌ No controllers detected! Please connect a controller and try again.")
        return
    
    # Use first controller
    controller = pygame.joystick.Joystick(0)
    controller.init()
    
    print(f"✅ Controller detected: {controller.get_name()}")
    print(f"   Buttons: {controller.get_numbuttons()}")
    print(f"   Axes: {controller.get_numaxes()}")
    print(f"   Hats: {controller.get_numhats()}")
    print()
    
    # Define buttons to test
    tests = [
        ButtonTest("DPAD_UP", "D-pad UP"),
        ButtonTest("DPAD_DOWN", "D-pad DOWN"), 
        ButtonTest("DPAD_LEFT", "D-pad LEFT"),
        ButtonTest("DPAD_RIGHT", "D-pad RIGHT"),
        ButtonTest("L1", "Left shoulder button (L1/LB)"),
        ButtonTest("R1", "Right shoulder button (R1/RB)"),
        ButtonTest("L2", "Left trigger (L2/LT/ZL)"),
        ButtonTest("R2", "Right trigger (R2/RT/ZR)"),
        ButtonTest("A", "A button (bottom face button)"),
        ButtonTest("B", "B button (right face button)"),
        ButtonTest("X", "X button (left face button)"),
        ButtonTest("Y", "Y button (top face button)"),
        ButtonTest("SELECT", "Select/Back/Minus button"),
        ButtonTest("START", "Start/Menu/Plus button"),
        ButtonTest("L3", "Left stick click (L3/LS)"),
        ButtonTest("R3", "Right stick click (R3/RS)"),
    ]
    
    current_test = 0
    
    print("🎯 Instructions:")
    print("- Press the requested button when prompted")
    print("- Press SPACE to skip a button if it doesn't exist")
    print("- Press ESC to quit")
    print("- Press R to restart current test")
    print()
    
    clock = pygame.time.Clock()
    font = pygame.font.Font(None, 24)
    
    while current_test < len(tests):
        test = tests[current_test]
        
        if not test.completed:
            print(f"📍 Test {current_test + 1}/{len(tests)}: Press {test.description}")
            print("   (SPACE=skip, R=restart, ESC=quit)")
        
        # Update display
        screen.fill((30, 30, 30))  # Dark gray background
        
        if current_test < len(tests):
            # Show current test
            text1 = font.render(f"Test {current_test + 1}/{len(tests)}", True, (255, 255, 255))
            text2 = font.render(f"Press: {tests[current_test].description}", True, (255, 255, 255))
            text3 = font.render("SPACE=skip  R=restart  ESC=quit", True, (200, 200, 200))
            
            screen.blit(text1, (10, 50))
            screen.blit(text2, (10, 80))
            screen.blit(text3, (10, 140))
        
        pygame.display.flip()
        
        # Event handling
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return
            
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    print("\n👋 Exiting...")
                    return
                elif event.key == pygame.K_SPACE:
                    print(f"   ⏭️  Skipped {test.name}")
                    test.completed = True
                    current_test += 1
                    print()
                elif event.key == pygame.K_r:
                    print(f"   🔄 Restarting {test.name}")
                    test.completed = False
                    test.pygame_index = None
                    test.event_type = None
            
            elif event.type == pygame.JOYBUTTONDOWN:
                if not test.completed:
                    test.pygame_index = event.button
                    test.event_type = 'button'
                    test.completed = True
                    print(f"   ✅ {test.name}: BUTTON {event.button}")
                    current_test += 1
                    print()
            
            elif event.type == pygame.JOYHATMOTION:
                if not test.completed and event.value != (0, 0):
                    test.pygame_index = f"hat{event.hat}_{event.value}"
                    test.event_type = 'hat'
                    test.completed = True
                    print(f"   ✅ {test.name}: HAT {event.hat} value {event.value}")
                    current_test += 1
                    print()
            
            elif event.type == pygame.JOYAXISMOTION:
                # Only register significant axis movement (for triggers)
                if not test.completed and abs(event.value) > 0.5:
                    test.pygame_index = f"axis{event.axis}_{event.value:.2f}"
                    test.event_type = 'axis'
                    test.completed = True
                    print(f"   ✅ {test.name}: AXIS {event.axis} value {event.value:.2f}")
                    current_test += 1
                    print()
        
        clock.tick(60)
    
    # Generate results
    print("\n" + "=" * 50)
    print("🎯 MAPPING RESULTS")
    print("=" * 50)
    
    controller_name = controller.get_name()
    print(f"Controller: {controller_name}")
    print()
    
    # Group by event type
    buttons = []
    hats = []
    axes = []
    
    for test in tests:
        if test.completed and test.event_type:
            if test.event_type == 'button':
                buttons.append((test.name, test.pygame_index))
            elif test.event_type == 'hat':
                hats.append((test.name, test.pygame_index))
            elif test.event_type == 'axis':
                axes.append((test.name, test.pygame_index))
    
    # Print results
    if buttons:
        print("🔘 BUTTON MAPPING:")
        for name, index in buttons:
            print(f"   {name:12} → pygame button {index}")
        print()
    
    if hats:
        print("🎩 HAT MAPPING:")
        for name, index in hats:
            print(f"   {name:12} → pygame {index}")
        print()
    
    if axes:
        print("📊 AXIS MAPPING:")
        for name, index in axes:
            print(f"   {name:12} → pygame {index}")
        print()
    
    # Generate code snippet for SNES controller
    print("💾 SNES CONTROLLER MAPPING CODE:")
    print("=" * 40)
    print("# Add this to your SNES controller mapping in streampad_pygame.py:")
    print("elif self.controller_type == ControllerType.SNES_SWITCH:")
    print("    mapping.update({")
    
    # Create mapping based on results
    button_map = {}
    for name, index in buttons:
        if name == "DPAD_UP":
            button_map[index] = "'12'"
        elif name == "DPAD_DOWN":
            button_map[index] = "'13'"
        elif name == "DPAD_LEFT":
            button_map[index] = "'14'"
        elif name == "DPAD_RIGHT":
            button_map[index] = "'15'"
        elif name == "L1":
            button_map[index] = "'4'"
        elif name == "R1":
            button_map[index] = "'5'"
        elif name == "A":
            button_map[index] = "'1'"
        elif name == "B":
            button_map[index] = "'0'"
        elif name == "X":
            button_map[index] = "'2'"
        elif name == "Y":
            button_map[index] = "'3'"
        elif name == "SELECT":
            button_map[index] = "'8'"
        elif name == "START":
            button_map[index] = "'9'"
        elif name == "L3":
            button_map[index] = "'10'"
        elif name == "R3":
            button_map[index] = "'11'"
    
    for pygame_idx, button_id in button_map.items():
        print(f"        {pygame_idx}: {button_id},  # {name}")
    
    print("    })")
    print()
    
    # Handle HAT mappings
    if hats:
        print("# HAT mappings (add to handle_joystick_hat method):")
        for name, hat_info in hats:
            print(f"# {name} → {hat_info}")
    
    print()
    print("✅ Mapping complete! Copy the code above into your streampad_pygame.py file.")
    
    # Cleanup
    pygame.quit()

if __name__ == "__main__":
    main()
