# StreamPad - Pygame Version

A DDR-style controller input logger built with Pygame for streaming overlays and controller testing.

![StreamPad Pygame](screenshot_pygame.png)

## Features

🎮 **Controller Support**
- Nintendo Switch Pro Controller
- SNES/Switch Controllers  
- PlayStation 4/5 Controllers
- Xbox Controllers
- Generic USB Controllers

🎵 **DDR-Style Visualization**
- Colored rectangles for each button
- Notes grow downward while held
- Notes move upward after release
- Unique vibrant colors for each button
- Real-time visual feedback

✨ **Visual Effects**
- Button highlight on press
- Glow effects for long notes
- Smooth animations at 60 FPS
- Clean, minimal interface

## Installation

### Prerequisites
- Python 3.7+
- A compatible game controller

### Setup
```bash
# Clone or navigate to the project directory
cd input_logger

# Create virtual environment (if not already created)
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Usage

### Method 1: Direct Run
```bash
# Activate virtual environment
source venv/bin/activate

# Run the application
python streampad_pygame.py
```

### Method 2: Launcher Script
```bash
# Simply run the launcher (handles venv automatically)
python run_pygame.py
```

## Controls

### Keyboard Controls
- **ESC**: Emergency cleanup (clear stuck buttons/notes)
- **R**: Refresh controller detection

### Controller Support
The application automatically detects and maps buttons for:

| Button | Display | Color |
|--------|---------|-------|
| D-pad Left | ◀ | Deep Pink |
| D-pad Up | ▲ | Cyan |
| D-pad Right | ▶ | Lime Green |
| D-pad Down | ▼ | Gold |
| L1/LB | L1 | Orange Red |
| R1/RB | R1 | Violet |
| Select/Back | SLCT | Dodger Blue |
| Start/Menu | STRT | Hot Pink |
| X/Square | X | Yellow |
| Y/Triangle | Y | Royal Blue |
| B/Circle | B | Spring Green |
| A/Cross | A | Tomato Red |

## Troubleshooting

### Controller Not Detected
1. Make sure your controller is properly connected
2. Press **R** to refresh controller detection
3. Try pressing buttons on the controller to activate it
4. Check that the controller works in other applications

### Performance Issues
- The application runs at 60 FPS by default
- Close other applications if experiencing lag
- Ensure your system meets the minimum requirements

### Stuck Buttons
- Press **ESC** for emergency cleanup
- This clears all button states and removes stuck notes

## Technical Details

### Architecture
- **Pygame**: Graphics and input handling
- **Real-time Processing**: 60 FPS update loop
- **Controller Mapping**: Automatic detection and button mapping
- **Note Physics**: Growth and movement animations

### File Structure
```
input_logger/
├── streampad_pygame.py     # Main Pygame application
├── run_pygame.py          # Launcher script
├── requirements.txt       # Python dependencies
├── venv/                 # Virtual environment
├── index.html            # Web version (preserved)
├── script.js             # Web version (preserved)
└── style.css             # Web version (preserved)
```

## Comparison with Web Version

| Feature | Web Version | Pygame Version |
|---------|-------------|----------------|
| Platform | Browser | Desktop App |
| Performance | Good | Excellent |
| Controller Support | Gamepad API | Pygame Joystick |
| Customization | CSS/JS | Python Code |
| Deployment | Web Server | Executable |
| Latency | Higher | Lower |

## Development

### Adding New Controllers
Edit the `detect_controller_type()` and `get_button_mapping()` methods in `streampad_pygame.py`.

### Customizing Colors
Modify the `COLORS['button_colors']` dictionary in the constants section.

### Adjusting Physics
Change these constants:
- `note_speed`: How fast notes move upward
- `growth_rate`: How fast notes grow while held
- `min_note_height`: Minimum note size

## License

Same as the web version - open source for streaming and educational use.

---

**Enjoy your DDR-style controller visualization!** 🎮✨
