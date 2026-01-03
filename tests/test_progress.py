#!/usr/bin/env python3
"""
Test script for the separate progress page
Run this script to test the progress page functionality
"""

import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

try:
    from aqt.qt import QApplication, QMessageBox
    from main_webengine import MathDrillWebEngine
    
    def main():
        print("Testing Math Drill Progress Page...")
        print("This will launch the main application with progress page functionality")
        print("🔧 Testing features:")
        print("   - Click the 📊 Progress button or press [P] to open progress page")
        print("   - Progress page should open in a separate window")
        print("   - Test the different time period filters")
        print("   - Verify all progress sections load correctly")
        print("   - Close windows to exit the test")
        
        app = QApplication(sys.argv)
        
        try:
            window = MathDrillWebEngine()
            window.show()
            
            print("✅ Main application opened successfully!")
            print("📊 Click the Progress button or press [P] to test the progress page")
            
            return app.exec()
            
        except Exception as e:
            print(f"❌ Failed to create application: {e}")
            QMessageBox.critical(None, "Test Failed", 
                                f"Failed to load application:\n{str(e)}\n\n"
                                "Make sure all dependencies are installed:\n"
                                "pip install PyQt6 PyQt6-WebEngine pygame")
            return 1
    
    if __name__ == "__main__":
        sys.exit(main())
        
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("\n📦 Required packages:")
    print("   pip install PyQt6 PyQt6-WebEngine pygame")
    print("\n🔧 For Anki integration, ensure this is running within Anki environment")
    sys.exit(1)
