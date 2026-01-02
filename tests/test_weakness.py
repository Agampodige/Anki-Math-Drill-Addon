#!/usr/bin/env python3
"""
Test script for the weakness tracking feature
"""

import sys
import os

# Add parent directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import init_db, update_weakness_tracking, get_weakest_area, get_weakness_areas
from coach import SmartCoach

def test_weakness_tracking():
    print("Testing weakness tracking feature...")
    
    # Initialize database
    init_db()
    print("✓ Database initialized")
    
    # Test weakness tracking updates
    print("\n--- Testing weakness tracking updates ---")
    
    # Simulate some practice attempts for different skills
    test_attempts = [
        ("Addition", 1, True),   # Good at 1-digit addition
        ("Addition", 1, True),
        ("Addition", 1, True),
        ("Subtraction", 2, False),  # Struggling with 2-digit subtraction
        ("Subtraction", 2, False),
        ("Subtraction", 2, True),
        ("Multiplication", 2, False),  # Really struggling with 2-digit multiplication
        ("Multiplication", 2, False),
        ("Multiplication", 2, False),
        ("Division", 1, True),   # Okay at 1-digit division
        ("Division", 1, False),
    ]
    
    for operation, digits, correct in test_attempts:
        update_weakness_tracking(operation, digits, correct)
        print(f"Updated: {operation} {digits}-digit - {'Correct' if correct else 'Wrong'}")
    
    # Test getting weakest area
    print("\n--- Testing weakness analysis ---")
    weakest = get_weakest_area()
    if weakest:
        print(f"Weakest area: {weakest['operation']} {weakest['digits']} digits")
        print(f"Weakness score: {weakest['weakness_score']:.1f}")
        print(f"Mastery level: {weakest['mastery_level']}")
        print(f"Consecutive correct: {weakest['consecutive_correct']}")
    else:
        print("No weak areas found")
    
    # Test getting all weakness areas
    print("\n--- All weakness areas ---")
    weaknesses = get_weakness_areas()
    for w in weaknesses:
        print(f"- {w['operation']} {w['digits']} digits: Score {w['weakness_score']:.1f}, Level {w['mastery_level']}")
    
    # Test SmartCoach integration
    print("\n--- Testing SmartCoach ---")
    coach = SmartCoach()
    recommendation, reason = coach.get_recommendation()
    print(f"Coach recommends: {recommendation[0]} {recommendation[1]} digits")
    print(f"Reason: {reason}")
    
    focus_areas = coach.get_weakness_focus_areas()
    print(f"Found {len(focus_areas)} focus areas")
    
    print("\n✓ All tests completed successfully!")

if __name__ == "__main__":
    test_weakness_tracking()
