#!/usr/bin/env python3
"""
Test that adaptive coach focuses on weakest areas across all operations
"""

import sys
import os

# Add parent directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import init_db, update_weakness_tracking
from coach import SmartCoach

def test_adaptive_focus():
    print("Testing adaptive coach focus across all operations...")
    
    # Initialize database
    init_db()
    print("✓ Database initialized")
    
    # Create test data with different weakness levels
    # Addition: Strong (should NOT be recommended)
    for _ in range(10):
        update_weakness_tracking("Addition", 1, True)
        update_weakness_tracking("Addition", 2, True)
    
    # Subtraction: Medium weakness (should be recommended)
    update_weakness_tracking("Subtraction", 1, True)
    update_weakness_tracking("Subtraction", 1, False)
    update_weakness_tracking("Subtraction", 1, False)
    update_weakness_tracking("Subtraction", 2, False)
    update_weakness_tracking("Subtraction", 2, False)
    
    # Multiplication: Very weak (should be TOP priority)
    for _ in range(8):
        update_weakness_tracking("Multiplication", 1, False)
    update_weakness_tracking("Multiplication", 1, True)
    
    # Division: Medium weakness (should be recommended)
    update_weakness_tracking("Division", 1, True)
    update_weakness_tracking("Division", 1, False)
    update_weakness_tracking("Division", 1, False)
    
    # Test coach recommendations
    coach = SmartCoach()
    
    print("\n=== Coach Analysis ===")
    (op, digits), reason = coach.get_recommendation()
    print(f"Primary Recommendation: {op} {digits} digits")
    print(f"Reason: {reason}")
    
    print("\n=== All Weakness Areas ===")
    weaknesses = coach.get_weakness_focus_areas(10)
    for i, w in enumerate(weaknesses):
        print(f"{i+1}. {w['operation']} {w['digits']} digits - Score: {w['weakness_score']:.1f} - Level: {w['level']}")
    
    print("\n=== Expected vs Actual ===")
    print("Expected: Multiplication should be top priority (weakest)")
    print(f"Actual: {op} is recommended")
    
    if op == "Multiplication":
        print("✅ SUCCESS: Coach correctly identified weakest area!")
    else:
        print("❌ ISSUE: Coach not focusing on weakest area")
    
    # Test multiple recommendations
    print("\n=== Multiple Recommendations ===")
    for i in range(5):
        (op, digits), reason = coach.get_recommendation()
        print(f"{i+1}. {op} {digits} digits - {reason}")

if __name__ == "__main__":
    test_adaptive_focus()
