#!/usr/bin/env python3
"""
Test full flow: log attempts then check weakness tracking
"""

import sys
import os

# Add parent directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import init_db, log_attempt, update_weakness_tracking, get_weakness_areas
from coach import SmartCoach

def test_full_flow():
    print("Testing full flow with attempts logging...")
    
    # Initialize database
    init_db()
    print("✓ Database initialized")
    
    # Log actual attempts (not just weakness tracking)
    print("\n=== Logging Attempts ===")
    
    # Addition: Strong performance
    for i in range(10):
        log_attempt("Addition", 1, True, 2.5)
        log_attempt("Addition", 2, True, 4.0)
    print("✓ Addition: 20 attempts, all correct, fast")
    
    # Subtraction: Medium performance  
    for i in range(5):
        log_attempt("Subtraction", 1, True, 4.0)
        log_attempt("Subtraction", 1, False, 5.0)
    print("✓ Subtraction: 10 attempts, 50% accuracy")
    
    # Multiplication: Poor performance (should be weakest)
    for i in range(10):
        log_attempt("Multiplication", 1, False, 8.0)
    log_attempt("Multiplication", 1, True, 6.0)
    print("✓ Multiplication: 11 attempts, 9% accuracy, slow")
    
    # Division: Mixed performance
    for i in range(3):
        log_attempt("Division", 1, True, 5.0)
    for i in range(3):
        log_attempt("Division", 1, False, 7.0)
    print("✓ Division: 6 attempts, 50% accuracy")
    
    # Now update weakness tracking based on these attempts
    print("\n=== Updating Weakness Tracking ===")
    update_weakness_tracking("Addition", 1, True)
    update_weakness_tracking("Addition", 2, True)
    update_weakness_tracking("Subtraction", 1, True)
    update_weakness_tracking("Multiplication", 1, True)
    update_weakness_tracking("Division", 1, True)
    
    # Check weakness data
    print("\n=== Weakness Areas ===")
    weaknesses = get_weakness_areas()
    for w in weaknesses:
        print(f"{w['operation']} {w['digits']} digits - Score: {w['weakness_score']:.1f} - Level: {w['mastery_level']}")
    
    # Test coach recommendation
    print("\n=== Coach Recommendation ===")
    coach = SmartCoach()
    (op, digits), reason = coach.get_recommendation()
    print(f"Recommendation: {op} {digits} digits")
    print(f"Reason: {reason}")
    
    # Check if it's focusing on weakest area
    weakest = max(weaknesses, key=lambda x: x['weakness_score'])
    print(f"\nWeakest area: {weakest['operation']} {weakest['digits']} digits (Score: {weakest['weakness_score']:.1f})")
    
    if op == weakest['operation'] and digits == weakest['digits']:
        print("✅ SUCCESS: Coach correctly identified weakest area!")
    else:
        print("❌ ISSUE: Coach not focusing on weakest area")

if __name__ == "__main__":
    test_full_flow()
