#!/usr/bin/env python3
"""
Test runner for Math Drill addon
"""

import sys
import os
import subprocess

# Add parent directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def run_test(test_file):
    """Run a single test file"""
    print(f"\n{'='*60}")
    print(f"Running {test_file}")
    print('='*60)
    
    try:
        result = subprocess.run([sys.executable, test_file], 
                              capture_output=False, 
                              text=True,
                              cwd=os.path.dirname(__file__))
        return result.returncode == 0
    except Exception as e:
        print(f"Error running {test_file}: {e}")
        return False

def main():
    """Run all test files"""
    print("Math Drill Test Suite")
    print("="*60)
    
    # Get all test files
    test_files = [
        'test_weakness.py',
        'test_adaptive_focus.py', 
        'test_full_flow.py',
        'read_real_data.py',
        'debug_weakness.py',
        'test_dialog_fix.py'
    ]
    
    results = {}
    
    for test_file in test_files:
        results[test_file] = run_test(test_file)
    
    # Summary
    print(f"\n{'='*60}")
    print("TEST SUMMARY")
    print('='*60)
    
    passed = sum(1 for success in results.values() if success)
    total = len(results)
    
    for test_file, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_file}")
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed!")
    else:
        print("⚠️  Some tests failed. Check output above for details.")

if __name__ == "__main__":
    main()
