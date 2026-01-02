#!/usr/bin/env python3
"""
Simple test for the progress modal functionality
"""

import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

try:
    from aqt.qt import QApplication
    from main_webengine import MathDrillWebEngine
    
    def main():
        print("🧪 Testing Simple Progress Modal")
        print("=" * 40)
        print("1. Application will start with main window")
        print("2. Click the 📊 Progress button or press [P]")
        print("3. Progress modal should open with sample data")
        print("4. No external files or complex bridges needed")
        print("=" * 40)
        
        app = QApplication(sys.argv)
        
        try:
            window = MathDrillWebEngine()
            window.show()
            
            print("✅ Application started successfully!")
            print("📊 Click the Progress button to test the modal")
            
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
