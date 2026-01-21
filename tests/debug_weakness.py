#!/usr/bin/env python3
"""
Debug weakness tracking data
"""

import sys
import os

# Add parent directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import init_db, update_weakness_tracking, get_weakness_areas

def debug_weakness_data():
    print("Debugging weakness tracking data...")
    
    # Initialize database
    init_db()
    
    # Create test data with different weakness levels
    print("\n=== Creating Test Data ===")
    
    # Addition: Strong (should NOT be recommended)
    for i in range(10):
        update_weakness_tracking("Addition", 1, True)
        update_weakness_tracking("Addition", 2, True)
    print("✓ Addition: 10 correct each (strong)")
    
    # Multiplication: Very weak (should be TOP priority)
    for i in range(8):
        update_weakness_tracking("Multiplication", 1, False)
    update_weakness_tracking("Multiplication", 1, True)
    print("✓ Multiplication: 8 wrong, 1 correct (very weak)")
    
    # Check raw weakness data
    print("\n=== Raw Weakness Data ===")
    weaknesses = get_weakness_areas()
    for w in weaknesses:
        print(f"{w['operation']} {w['digits']} digits:")
        print(f"  Weakness Score: {w['weakness_score']}")
        print(f"  Mastery Level: {w['mastery_level']}")
        print(f"  Consecutive Correct: {w['consecutive_correct']}")
        print(f"  Last Practiced: {w['last_practiced']}")

if __name__ == "__main__":
    debug_weakness_data()
