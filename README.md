# 🎮 Controller Input Logger

A web-based controller input visualizer with DDR-style neon aesthetics. Displays real-time controller input with glowing effects, frequency tracking, and support for multiple controller types.

## ✨ Features

- **Real-time Controller Detection** - Automatically detects and configures multiple controller types
- **DDR-Style Visual Effects** - Neon colors, glowing buttons, and pulsing effects
- **Button Frequency Tracking** - Shows presses-per-second with progressive glow intensity
- **Multiple Controller Support** - Xbox, PlayStation, Nintendo Switch, 8BitDo, and more
- **Responsive Design** - Works on desktop and mobile browsers
- **Zero Dependencies** - Pure HTML/CSS/JS implementation

## 🎯 Supported Controllers

- Xbox Controllers (One, Series X/S, 360)
- PlayStation Controllers (DualShock 4, DualSense)
- Nintendo Switch Pro Controller
- Nintendo SNES/Switch USB Controllers
- 8BitDo Controllers (SN30 Pro, etc.)
- Generic USB gamepads with fallback mapping

## 🚀 Quick Start

1. Open `index.html` in a modern web browser
2. Connect your controller via USB or Bluetooth
3. Press any button to start tracking
4. Watch the neon magic happen! ✨

## 🎨 Visual Effects

- **Button Press Glow** - Buttons light up with neon colors when pressed
- **Frequency Intensity** - Higher press frequency = brighter glow
- **Analog Stick Visualization** - Real-time stick position with trails
- **D-Pad Direction Indicators** - Directional arrows with glow effects
- **Controller Status Display** - Shows connected controller name and type

## 🔧 Technical Details

- Uses the **Gamepad API** for controller input
- **60 FPS** real-time updates
- **CSS animations** for smooth visual effects
- **Frequency calculation** with rolling averages
- **Automatic controller type detection** based on vendor/product IDs

## 🎮 Button Layout

The visualizer displays a standard controller layout with:
- **D-Pad** (Left, Up, Right, Down)
- **Face Buttons** (A, B, X, Y)
- **Shoulder Buttons** (L1/LB, R1/RB, L2/LT, R2/RT)
- **System Buttons** (Start, Select/Back, Home)
- **Analog Sticks** (Left Stick, Right Stick with click)

## 🌈 Color Scheme

- **Cyan/Aqua** (#00FFFF) - Primary neon color
- **Hot Pink** (#FF1493) - Secondary accent
- **Electric Blue** (#0080FF) - Tertiary highlights
- **Lime Green** (#32CD32) - Success/active states
- **Deep Purple** (#4B0082) - Background elements
- **Pure Black** (#000000) - Background

## 📱 Browser Compatibility

- Chrome 21+ ✅
- Firefox 29+ ✅
- Safari 10.1+ ✅
- Edge 12+ ✅

## 🎯 Use Cases

- **Controller Testing** - Verify all buttons and sticks work
- **Input Lag Analysis** - Visual feedback for timing tests
- **Streaming Overlay** - Show controller input to viewers
- **Accessibility Testing** - Ensure controller accessibility
- **Gaming Setup Validation** - Confirm controller configuration

## 🔮 Future Enhancements

- Multiple controller simultaneous tracking
- Input recording and playback
- Custom button mapping
- Export input data to JSON
- Haptic feedback testing
- Controller calibration tools

---

*Built with ❤️ for the gaming community*
