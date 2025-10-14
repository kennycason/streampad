# Stream Pad

A web-based controller input visualizer that displays real-time button presses in a DDR/Guitar Hero style with colorful scrolling rectangles.

![DDR Controller Logger](screenshot.png)

## ✨ Features

- **DDR-Style Visualization** - Button presses create colorful rectangles that scroll upward
- **Real-time Input** - Instant visual feedback with rectangle length matching press duration
- **Multiple Controller Support** - Works with Switch, Xbox, PlayStation, and more
- **Zero Dependencies** - Pure HTML/CSS/JS implementation

## 🚀 Quick Start

1. Open `index.html` in a modern web browser
2. Connect your controller via USB or Bluetooth
3. Press any button to see colorful rectangles scroll upward
4. Hold buttons longer to create longer rectangles!

## 🎮 How It Works

- **Tap a button** → Short colored rectangle appears and scrolls up
- **Hold a button** → Rectangle grows longer while held, then scrolls up when released
- **Each button** has its own unique vibrant color
- **Press ESCAPE** to fix any stuck buttons

## 🎯 Supported Controllers

### Fully Tested & Working
- **Nintendo Switch Pro Controller** - Full button mapping, D-pad via buttons
- **Nintendo SNES Controller (USB/Switch Online)** - Full button mapping, D-pad via axes
- **PlayStation 4 (DualShock 4)** - Standard mapping
- **PlayStation 5 (DualSense)** - Standard mapping
- **Xbox Controllers** - Standard mapping
- **8BitDo SN30 Pro** - Standard mapping

### Controller Issues?

If your controller isn't working correctly or shows phantom button presses:

1. **Use the Debug Tool**: Open `controller_debug.html` to see exactly what your controller reports
   - Check button indices when pressing each button
   - Check axis values for D-pad movement
   - Use this info to understand your controller's layout

2. **Check Browser Compatibility**: 
   - Chrome/Edge: Best support
   - Firefox: Good support
   - Safari: May have quirks with some controllers

3. **Try Different Connection Methods**:
   - USB vs Bluetooth can report differently
   - Some controllers need specific modes (e.g., D-pad vs X-input mode)

## 🔧 Troubleshooting

### Phantom Button Presses (Pro Controller Issue)
If you see buttons being pressed when nothing is touched:
- This was a mapping issue that's now fixed in the latest version
- The Pro Controller uses buttons 11-14 for D-pad, not axes
- Make sure you're using the latest `script.js`

### Controller Not Detected
- Try unplugging and replugging the controller
- Refresh the page after connecting
- Check browser console for error messages

### Stuck Buttons
- Press **ESCAPE** key to clear all stuck states
- This is an emergency cleanup that resets everything