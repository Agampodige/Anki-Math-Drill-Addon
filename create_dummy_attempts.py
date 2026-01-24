#!/usr/bin/env python3
"""
Script to create dummy attempts data for testing the Math Drill addon.
"""

import json
import os
from datetime import datetime, timedelta
import random

def create_dummy_attempts():
    """Create realistic dummy attempts data"""
    
    # Generate dates for the last 30 days
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    attempts = []
    current_id = 1
    
    # Generate 200-300 attempts over the last 30 days
    num_attempts = random.randint(200, 300)
    
    for i in range(num_attempts):
        # Random date within the last 30 days
        random_days = random.randint(0, 30)
        random_hours = random.randint(0, 23)
        random_minutes = random.randint(0, 59)
        attempt_date = start_date + timedelta(days=random_days, hours=random_hours, minutes=random_minutes)
        
        # Random operation
        operations = ['addition', 'subtraction', 'multiplication', 'division']
        operation = random.choice(operations)
        
        # Generate numbers based on operation and difficulty
        if operation == 'addition':
            num1 = random.randint(1, 99)
            num2 = random.randint(1, 99)
            correct_answer = num1 + num2
        elif operation == 'subtraction':
            num1 = random.randint(10, 99)
            num2 = random.randint(1, num1)
            correct_answer = num1 - num2
        elif operation == 'multiplication':
            num1 = random.randint(1, 12)
            num2 = random.randint(1, 12)
            correct_answer = num1 * num2
        else:  # division
            num2 = random.randint(1, 12)
            correct_answer = random.randint(1, 12)
            num1 = num2 * correct_answer
        
        # Determine digits
        max_num = max(num1, num2, correct_answer)
        if max_num < 10:
            digits = 1
        elif max_num < 100:
            digits = 2
        elif max_num < 1000:
            digits = 3
        else:
            digits = 4
        
        # 75% correct rate with some variation
        is_correct = random.random() < 0.75
        
        if is_correct:
            user_answer = correct_answer
            time_taken = random.uniform(2.0, 15.0)  # 2-15 seconds for correct answers
        else:
            # Generate wrong answers that are plausible
            if operation == 'addition':
                user_answer = correct_answer + random.choice([-1, 1, -10, 10, -5, 5])
            elif operation == 'subtraction':
                user_answer = correct_answer + random.choice([-1, 1, -10, 10])
            elif operation == 'multiplication':
                user_answer = correct_answer + random.choice([num1, num2, -num1, -num2, 1, -1])
            else:  # division
                user_answer = correct_answer + random.choice([1, -1, 2, -2])
            time_taken = random.uniform(5.0, 25.0)  # 5-25 seconds for wrong answers
        
        # Create question string
        if operation == 'addition':
            question = f"{num1} + {num2}"
        elif operation == 'subtraction':
            question = f"{num1} - {num2}"
        elif operation == 'multiplication':
            question = f"{num1} × {num2}"
        else:  # division
            question = f"{num1} ÷ {num2}"
        
        attempt = {
            "id": current_id,
            "timestamp": attempt_date.isoformat(),
            "operation": operation,
            "digits": digits,
            "question": question,
            "userAnswer": user_answer,
            "correctAnswer": correct_answer,
            "isCorrect": is_correct,
            "timeTaken": round(time_taken, 1)
        }
        
        attempts.append(attempt)
        current_id += 1
    
    return attempts

def save_dummy_attempts():
    """Save dummy attempts to the data directory"""
    
    # Get the addon directory
    addon_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(addon_dir, "data", "user")
    
    # Create directory if it doesn't exist
    os.makedirs(data_dir, exist_ok=True)
    
    # Generate dummy attempts
    attempts = create_dummy_attempts()
    
    # Create the data structure
    data = {
        "lastId": len(attempts),
        "attempts": attempts,
        "lastSaved": datetime.now().isoformat(),
        "totalAttempts": len(attempts)
    }
    
    # Save to file
    attempts_file = os.path.join(data_dir, "attempts.json")
    with open(attempts_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"Created {len(attempts)} dummy attempts")
    print(f"Saved to: {attempts_file}")
    print(f"Date range: {attempts[0]['timestamp'][:10]} to {attempts[-1]['timestamp'][:10]}")
    
    # Print some statistics
    correct_count = sum(1 for a in attempts if a['isCorrect'])
    accuracy = (correct_count / len(attempts)) * 100
    
    print(f"Correct answers: {correct_count}/{len(attempts)} ({accuracy:.1f}%)")
    
    # Breakdown by operation
    operations = {}
    for attempt in attempts:
        op = attempt['operation']
        if op not in operations:
            operations[op] = {'total': 0, 'correct': 0}
        operations[op]['total'] += 1
        if attempt['isCorrect']:
            operations[op]['correct'] += 1
    
    print("\nBy operation:")
    for op, stats in operations.items():
        acc = (stats['correct'] / stats['total']) * 100
        print(f"  {op}: {stats['correct']}/{stats['total']} ({acc:.1f}%)")

if __name__ == "__main__":
    save_dummy_attempts()
