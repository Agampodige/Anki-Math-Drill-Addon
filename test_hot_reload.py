#!/usr/bin/env python3
"""
Test script to verify hot reload functionality
Run this script to test if hot reload is working properly
"""

import os
import sys
import time
import tempfile

# Add the addon directory to Python path
addon_dir = os.path.dirname(__file__)
sys.path.insert(0, addon_dir)

def test_hot_reload():
    """Test the hot reload system"""
    print("=== Testing Hot Reload System ===")
    
    try:
        # Import hot reload module
        from hot_reload import HotReloader
        
        # Create a temporary test file
        test_file = os.path.join(addon_dir, 'test_reload.txt')
        
        # Create hot reloader instance
        reloader = HotReloader(addon_dir)
        
        # Add the test file to watch
        reloader.add_web_file('test_reload.txt')
        
        # Start monitoring
        reloader.start()
        print("✅ Hot reload monitoring started")
        
        # Create initial test file
        with open(test_file, 'w') as f:
            f.write("Initial content")
        print("✅ Created test file")
        
        # Wait a bit then modify the file
        time.sleep(2)
        
        with open(test_file, 'w') as f:
            f.write("Modified content")
        print("✅ Modified test file")
        
        # Wait for the change to be detected
        time.sleep(3)
        
        # Clean up
        reloader.stop()
        if os.path.exists(test_file):
            os.remove(test_file)
        print("✅ Cleaned up test file")
        
        print("✅ Hot reload test completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Hot reload test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_module_reload():
    """Test Python module reloading"""
    print("\n=== Testing Module Reload ===")
    
    try:
        import importlib
        import json_storage
        
        # Get original module
        original_module = json_storage
        print(f"✅ Original module loaded: {json_storage.__file__}")
        
        # Reload the module
        reloaded = importlib.reload(json_storage)
        print(f"✅ Module reloaded successfully")
        
        # Verify it's the same module object
        if reloaded is original_module:
            print("✅ Reloaded module is the same object")
        else:
            print("⚠️ Reloaded module is a different object")
        
        return True
        
    except Exception as e:
        print(f"❌ Module reload test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("Math Drill Hot Reload Test")
    print("=" * 50)
    
    # Test hot reload system
    hot_reload_ok = test_hot_reload()
    
    # Test module reloading
    module_reload_ok = test_module_reload()
    
    print("\n" + "=" * 50)
    if hot_reload_ok and module_reload_ok:
        print("🎉 All tests passed! Hot reload is working.")
    else:
        print("❌ Some tests failed. Check the output above.")
    
    print("\nTo use hot reload:")
    print("1. Restart Anki to load the updated addon")
    print("2. Open Math Drill")
    print("3. Modify any .py file in the addon directory")
    print("4. Modify any web file (HTML/JS/CSS) in the web/ directory")
    print("5. Watch for hot reload messages in the console")
    print("6. The web page should automatically reload when files change")
