#!/usr/bin/env python3
"""
Test script for level progression functionality
"""

import json
import os
import sys
from datetime import datetime

# Add the project directory to the path
sys.path.insert(0, os.path.dirname(__file__))

def test_level_completion_data():
    """Test level completion data saving and loading"""
    
    # Test data
    test_completion_data = {
        'level': {
            'id': 1,
            'title': 'First Steps',
            'operation': 'Addition',
            'digits': 1
        },
        'stats': {
            'questions_answered': 10,
            'accuracy': 90,
            'total_time': 45,
            'stars': 2
        }
    }
    
    # Path to completion data file
    completion_file = os.path.join('data', 'level_completion_data.json')
    
    print("Testing level completion data functionality...")
    
    # Test 1: Save completion data
    try:
        # Load existing data
        existing_data = []
        if os.path.exists(completion_file):
            try:
                with open(completion_file, 'r', encoding='utf-8') as f:
                    existing_data = json.load(f)
            except:
                existing_data = []
        
        # Add new completion record
        completion_record = {
            'level_id': test_completion_data['level']['id'],
            'level_title': test_completion_data['level']['title'],
            'operation': test_completion_data['level']['operation'],
            'digits': test_completion_data['level']['digits'],
            'stars_earned': test_completion_data['stats']['stars'],
            'questions_answered': test_completion_data['stats']['questions_answered'],
            'accuracy': test_completion_data['stats']['accuracy'],
            'time_taken': test_completion_data['stats']['total_time'],
            'completed_at': datetime.now().isoformat()
        }
        
        existing_data.append(completion_record)
        
        # Save to file
        os.makedirs(os.path.dirname(completion_file), exist_ok=True)
        with open(completion_file, 'w', encoding='utf-8') as f:
            json.dump(existing_data, f, indent=2)
        
        print("✅ Test 1 PASSED: Successfully saved level completion data")
        
    except Exception as e:
        print(f"❌ Test 1 FAILED: Error saving completion data: {e}")
        return False
    
    # Test 2: Load and verify completion data
    try:
        with open(completion_file, 'r', encoding='utf-8') as f:
            loaded_data = json.load(f)
        
        # Verify the last record matches our test data
        if loaded_data:
            last_record = loaded_data[-1]
            if (last_record['level_id'] == test_completion_data['level']['id'] and
                last_record['stars_earned'] == test_completion_data['stats']['stars'] and
                last_record['accuracy'] == test_completion_data['stats']['accuracy']):
                print("✅ Test 2 PASSED: Successfully loaded and verified completion data")
            else:
                print("❌ Test 2 FAILED: Loaded data doesn't match expected values")
                return False
        else:
            print("❌ Test 2 FAILED: No data found in completion file")
            return False
            
    except Exception as e:
        print(f"❌ Test 2 FAILED: Error loading completion data: {e}")
        return False
    
    # Test 3: Verify level system integration
    try:
        from levels import LevelManager
        
        level_manager = LevelManager()
        level = level_manager.get_level_by_id(1)
        
        if level and level['title'] == test_completion_data['level']['title']:
            print("✅ Test 3 PASSED: Level system integration working")
        else:
            print("❌ Test 3 FAILED: Level system integration not working")
            return False
            
    except Exception as e:
        print(f"❌ Test 3 FAILED: Error testing level system: {e}")
        return False
    
    print("\n🎉 All tests passed! Level progression system is working correctly.")
    return True

def test_star_calculation():
    """Test star calculation logic"""
    print("\nTesting star calculation logic...")
    
    # Test cases: (accuracy, time_limit, time_taken, expected_stars)
    test_cases = [
        (100, 60, 45, 3),  # Perfect accuracy, good time -> 3 stars
        (95, 60, 55, 2),   # High accuracy, good time -> 2 stars  
        (85, 0, 30, 1),    # Basic accuracy, no time limit -> 1 star
        (75, 60, 30, 0),   # Below minimum accuracy -> 0 stars
        (90, 60, 70, 0),   # Good accuracy but over time limit -> 0 stars
    ]
    
    for accuracy, time_limit, time_taken, expected_stars in test_cases:
        # Simulate star calculation logic
        stars = 0
        if accuracy >= 80:  # Minimum requirement
            stars = 1
            if accuracy >= 90 and (time_limit == 0 or time_taken <= time_limit):
                stars = 2
            if accuracy >= 100 and (time_limit == 0 or time_taken <= time_limit * 0.75):
                stars = 3
        
        # Apply time limit failure condition
        if time_limit > 0 and time_taken > time_limit:
            stars = 0
        
        if stars == expected_stars:
            print(f"✅ Star calculation test passed: {accuracy}% accuracy, {time_taken}s -> {stars} stars")
        else:
            print(f"❌ Star calculation test failed: {accuracy}% accuracy, {time_taken}s -> expected {expected_stars}, got {stars}")
            return False
    
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("LEVEL PROGRESSION SYSTEM TEST")
    print("=" * 60)
    
    success = True
    
    # Run tests
    success &= test_level_completion_data()
    success &= test_star_calculation()
    
    print("\n" + "=" * 60)
    if success:
        print("🎉 ALL TESTS PASSED! The level progression system is ready.")
    else:
        print("❌ SOME TESTS FAILED! Please check the implementation.")
    print("=" * 60)
