#!/usr/bin/env python3
"""
Debug script for testing the progress button functionality
"""

import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

try:
    from aqt.qt import QApplication
    from main_webengine import MathDrillWebEngine
    
    def main():
        print("🔍 Debug: Testing Progress Button Functionality")
        print("=" * 50)
        print("1. Application will start with main window")
        print("2. Click the 📊 Progress button or press [P]")
        print("3. Check the console output for debugging messages")
        print("4. Progress page should open in separate window")
        print("=" * 50)
        
        app = QApplication(sys.argv)
        
        try:
            window = MathDrillWebEngine()
            window.show()
            
            print("✅ Main application started successfully!")
            print("🔍 Debug info:")
            print("   - Check browser console (F12) for JavaScript logs")
            print("   - Check Python console for bridge logs")
            print("   - Try clicking the progress button now")
            
            return app.exec()
            
        except Exception as e:
            print(f"❌ Failed to create application: {e}")
            import traceback
            traceback.print_exc()
            return 1
    
    if __name__ == "__main__":
        sys.exit(main())
        
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("\n📦 Required packages:")
    print("   pip install PyQt6 PyQt6-WebEngine pygame")
    sys.exit(1)
