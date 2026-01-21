#!/usr/bin/env python3
"""
Test script for the WebEngine-based Math Drill UI
Run this script to test the new web-based interface
"""

import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

try:
    from aqt.qt import QApplication, QMessageBox
    from main_webengine import MathDrillWebEngine
    
    def main():
        print("Starting Math Drill WebEngine Test...")
        print("This will launch the new web-based interface")
        print("Close the window to exit the test")
        
        app = QApplication(sys.argv)
        
        try:
            window = MathDrillWebEngine()
            window.show()
            
            print("✅ WebEngine window opened successfully!")
            print("🔧 Testing features:")
            print("   - Interface should load with modern web UI")
            print("   - All buttons and controls should be responsive")
            print("   - Try entering answers and pressing Enter")
            print("   - Check keyboard shortcuts (M, O, F1-F3, etc.)")
            
            return app.exec()
            
        except Exception as e:
            print(f"❌ Failed to create WebEngine window: {e}")
            QMessageBox.critical(None, "WebEngine Test Failed", 
                                f"Failed to load WebEngine interface:\n{str(e)}\n\n"
                                "Make sure PyQt6-WebEngine is installed:\n"
                                "pip install PyQt6-WebEngine")
            return 1
    
    if __name__ == "__main__":
        sys.exit(main())
        
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("\n📦 Required packages:")
    print("   pip install PyQt6 PyQt6-WebEngine pygame")
    print("\n🔧 For Anki integration, ensure this is running within Anki environment")
    sys.exit(1)
