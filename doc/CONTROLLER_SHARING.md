# Controller Input Sharing Issues & Solutions

## The Problem

When multiple applications try to access the same game controller simultaneously, they can interfere with each other. This is what you're experiencing:

1. **Emulator + streampad.py**: When you start streampad.py after your emulator is running, the emulator stops receiving controller input
2. **Steam/BG3 + streampad.py**: Similar issue - only one application receives input at a time
3. **Web version works fine**: The browser-based version doesn't have this problem

## Why This Happens

### pygame/SDL (streampad.py)
- Uses low-level OS APIs to read controller input
- On macOS, this can create exclusive or semi-exclusive access to the controller
- Even with `SDL_JOYSTICK_ALLOW_BACKGROUND_EVENTS`, pygame's aggressive polling can interfere with other apps
- The background polling thread (running at 60-120 FPS) constantly reads controller state

### Browser Gamepad API (index.html)
- Uses a higher-level, OS-mediated API designed for sharing
- The browser acts as a mediator, allowing multiple apps to coexist
- Non-exclusive by design

## Solutions

### Solution 1: Use the Web Version (Recommended ✅)

The web version (`index.html`) is the best solution because:
- Works perfectly alongside other applications
- Can be used as a browser source in OBS
- No installation or dependencies needed
- Guaranteed to not interfere with games/emulators
- **Now fully supports Nintendo Switch Pro Controller!** (fixed button mapping)

**Supported Controllers:**
- ✅ Nintendo Switch Pro Controller (D-pad via buttons 11-14)
- ✅ Nintendo SNES Controller (D-pad via axes)
- ✅ PlayStation 4/5 Controllers
- ✅ Xbox Controllers
- ✅ 8BitDo Controllers

**How to use:**
1. Open `index.html` in your browser (Chrome, Firefox, Edge, Safari)
2. Connect your controller
3. Use it as a browser source in OBS or just keep the browser window open
4. Your games/emulators will continue to receive input normally

**Debug Tool:**
If your controller isn't working correctly, open `controller_debug.html` to see exactly what button indices and axes your controller reports. This helps identify mapping issues.

### Solution 2: Modified streampad.py (Partial Fix)

I've made changes to `streampad.py` to be less aggressive:

**Changes made:**
1. Added SDL environment variables to hint we want non-exclusive access:
   - `SDL_HINT_JOYSTICK_ALLOW_BACKGROUND_EVENTS=1`
   - `SDL_JOYSTICK_THREAD=1`

2. Reduced polling frequency from 120 FPS to 60 FPS in the background thread

**Limitations:**
- This may help but won't completely solve the issue on all systems
- macOS's HID (Human Interface Device) layer can still cause conflicts
- Some games/emulators may still not receive input properly

### Solution 3: Use streampad.py Only When Needed

If you prefer the pygame version:
- Start your game/emulator first
- Only start streampad.py when you need to display inputs
- Close streampad.py when you're done streaming/recording
- The controller should return to normal for the game

### Solution 4: Virtual Controller Passthrough (Advanced)

For advanced users, you could:
1. Use a virtual gamepad driver
2. Have streampad.py read from the physical controller
3. Create a virtual controller that passes input to games
4. This is complex and OS-specific

## Recommendation

**Use the web version (`index.html`)** - it's the most reliable solution and works perfectly with OBS browser sources. The pygame version (`streampad.py`) was created as an alternative for systems without browsers, but if you have a browser, the web version is superior for this use case.

## Testing Your Setup

1. **Test with web version:**
   - Open `index.html` in browser
   - Open your emulator/game
   - Press controller buttons
   - ✅ Both should respond

2. **Test with pygame version:**
   - Close web browser
   - Start your emulator/game
   - Start `streampad.py`
   - Press controller buttons
   - ⚠️ May only work in one application

## Technical Details

The core issue is that on macOS (and Linux to some extent), the IOKit/HIDManager APIs that SDL/pygame use can create locks on HID devices. When pygame initializes a joystick with `controller.init()`, it opens a handle to the device that may prevent other applications from reading from it simultaneously.

Windows has better support for shared controller access through XInput and DirectInput APIs, but even there, conflicts can occur.

The Gamepad API in browsers was specifically designed to solve this problem by having the browser act as a mediator, using OS-level APIs that support multiple readers.

