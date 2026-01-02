#!/usr/bin/env python3
"""
Test the weakness dialog fix
"""

import sys
import os

# Add parent directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import init_db, update_weakness_tracking
from coach import SmartCoach

def test_weakness_dialog_data():
    print("Testing weakness dialog data structure...")
    
    # Initialize database
    init_db()
    print("✓ Database initialized")
    
    # Add some test data
    test_attempts = [
        ("Addition", 1, True),
        ("Addition", 1, True),
        ("Addition", 1, True),  # Good at addition
        ("Subtraction", 2, False),
        ("Subtraction", 2, False),
        ("Subtraction", 2, True),   # Struggling with subtraction
        ("Multiplication", 2, False),
        ("Multiplication", 2, False),
        ("Multiplication", 2, False),  # Really struggling with multiplication
        ("Division", 1, True),
        ("Division", 1, False),   # Mixed results with division
    ]
    
    for operation, digits, correct in test_attempts:
        update_weakness_tracking(operation, digits, correct)
    
    # Test the new coach method
    coach = SmartCoach()
    
    # Debug: Check what's in knowledge_map
    print(f"\nKnowledge map contains {len(coach.knowledge_map)} skills:")
    for key, skill in coach.knowledge_map.items():
        print(f"  {key}: score={skill.get('score', 'N/A'):.1f}, level={skill.get('level', 'N/A')}")
    
    weaknesses = coach.get_weakness_focus_areas()
    
    print(f"\nFound {len(weaknesses)} weakness areas:")
    for i, w in enumerate(weaknesses):
        print(f"\n{i+1}. {w['operation']} {w['digits']} digits")
        print(f"   Level: {w['level']}")
        print(f"   Weakness Score: {w['weakness_score']:.1f}")
        print(f"   Accuracy: {w['accuracy']:.1f}%")
        print(f"   Speed: {w['speed']:.1f}s")
        print(f"   Count: {w['count']}")
        if 'suggestions' in w:
            print(f"   Suggestions: {w['suggestions']}")
    
    print("\n✓ Test completed successfully!")

if __name__ == "__main__":
    test_weakness_dialog_data()
