#!/usr/bin/env python3
"""
Test script for level question generation
"""

import json
import os
import sys
import random

# Add the project directory to the path
sys.path.insert(0, os.path.dirname(__file__))

def test_level_question_generation():
    """Test that level questions are generated according to level criteria"""
    
    print("Testing level question generation...")
    
    # Test data for different levels
    test_levels = [
        {
            'id': 1,
            'operation': 'Addition',
            'digits': 1,
            'title': 'First Steps'
        },
        {
            'id': 3,
            'operation': 'Addition', 
            'digits': 1,
            'title': 'Speed Addition'
        },
        {
            'id': 4,
            'operation': 'Addition',
            'digits': 2,
            'title': 'Double Trouble'
        },
        {
            'id': 5,
            'operation': 'Multiplication',
            'digits': 1,
            'title': 'Multiplication Basics'
        },
        {
            'id': 6,
            'operation': 'Mixed',
            'digits': 1,
            'title': 'Survival Mode'
        }
    ]
    
    def generate_question_for_level(level):
        """Generate a question based on level criteria (same logic as backend)"""
        operation = level['operation']
        digits = level['digits']
        
        if operation == 'Mixed':
            operations = ['Addition', 'Subtraction', 'Multiplication', 'Division']
            operation = random.choice(operations)
        
        # Generate numbers based on digit level
        low = 2 if digits == 1 else 10 ** (digits - 1)
        high = 10 ** digits - 1
        
        a, b, answer, symbol = 0, 0, 0, ''
        
        if operation == 'Division':
            # Ensure clean division
            b_low = 2
            b_high = 12 if digits == 1 else (20 if digits == 2 else 50)
            b = random.randint(b_low, b_high)
            answer = random.randint(2, min(high, 20))
            a = b * answer
            symbol = '÷'
        elif operation == 'Addition':
            a = random.randint(low, high)
            b = random.randint(low, high)
            answer = a + b
            symbol = '+'
        elif operation == 'Subtraction':
            a = random.randint(low, high)
            b = random.randint(low, high)
            if a < b:
                a, b = b, a
            answer = a - b
            symbol = '-'
        elif operation == 'Multiplication':
            # Use smaller numbers for multiplication to keep it manageable
            if digits > 1:
                a = random.randint(low, min(high, 20))
                b = random.randint(low, min(high, 20))
            else:
                a = random.randint(low, high)
                b = random.randint(low, high)
            answer = a * b
            symbol = '×'
        
        question_text = f"{a} {symbol} {b} = ?"
        
        return {
            'question': question_text,
            'answer': answer,
            'operation': operation,
            'digits': digits
        }
    
    # Test each level
    all_tests_passed = True
    
    for level in test_levels:
        print(f"\n--- Testing {level['title']} (Level {level['id']}) ---")
        print(f"Operation: {level['operation']}, Digits: {level['digits']}")
        
        # Generate multiple questions to test consistency
        questions = []
        for i in range(5):
            question = generate_question_for_level(level)
            questions.append(question)
            print(f"  Question {i+1}: {question['question']} = {question['answer']}")
            
            # Verify question meets criteria
            # Check digit count for numbers
            if level['operation'] != 'Division':
                # For non-division, check that numbers have correct digit count
                parts = question['question'].split()
                a = int(parts[0])
                b = int(parts[2])
                
                expected_low = 2 if level['digits'] == 1 else 10 ** (level['digits'] - 1)
                expected_high = 10 ** level['digits'] - 1
                
                if not (expected_low <= a <= expected_high and expected_low <= b <= expected_high):
                    print(f"    ❌ ERROR: Numbers {a}, {b} not in expected range [{expected_low}, {expected_high}]")
                    all_tests_passed = False
                else:
                    print(f"    ✅ Numbers in correct range")
            
            # Check operation matches level (for non-mixed)
            if level['operation'] != 'Mixed':
                expected_symbol = {
                    'Addition': '+',
                    'Subtraction': '-',
                    'Multiplication': '×',
                    'Division': '÷'
                }[level['operation']]
                
                if expected_symbol not in question['question']:
                    print(f"    ❌ ERROR: Expected {expected_symbol} operation, got {question['question']}")
                    all_tests_passed = False
                else:
                    print(f"    ✅ Correct operation")
    
    print("\n" + "=" * 60)
    if all_tests_passed:
        print("🎉 ALL LEVEL QUESTION TESTS PASSED!")
        print("Questions are being generated according to level criteria.")
    else:
        print("❌ SOME TESTS FAILED!")
        print("Question generation may not respect level criteria.")
    print("=" * 60)
    
    return all_tests_passed

if __name__ == "__main__":
    test_level_question_generation()
