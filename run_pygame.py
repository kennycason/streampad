#!/usr/bin/env python3
"""
Simple launcher for StreamPad Pygame version
"""

import subprocess
import sys
import os

def main():
    # Get the directory of this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    venv_python = os.path.join(script_dir, 'venv', 'bin', 'python')
    streampad_script = os.path.join(script_dir, 'streampad_pygame.py')
    
    # Check if virtual environment exists
    if not os.path.exists(venv_python):
        print("❌ Virtual environment not found!")
        print("Please run: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt")
        sys.exit(1)
    
    # Check if streampad script exists
    if not os.path.exists(streampad_script):
        print("❌ StreamPad script not found!")
        sys.exit(1)
    
    print("🎮 Starting StreamPad Pygame...")
    
    try:
        # Run the pygame version using the virtual environment
        subprocess.run([venv_python, streampad_script], check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Error running StreamPad: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n👋 StreamPad closed by user")

if __name__ == "__main__":
    main()
