#!/usr/bin/env python3
"""
Read actual weakness data from database and generate real recommendations
"""

import sys
import os

# Add parent directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import init_db, get_weakness_areas, get_performance_breakdown
from coach import SmartCoach

def read_real_data():
    print("=== Reading Real Database Data ===")
    
    # Initialize database
    init_db()
    
    # Read actual weakness tracking data
    print("\n📊 Current Weakness Tracking Data:")
    print("=" * 50)
    weaknesses = get_weakness_areas()
    
    if not weaknesses:
        print("No weakness data found in database.")
        print("This means no practice sessions have been completed yet.")
        return
    
    for w in weaknesses:
        print(f"🔸 {w['operation']} ({w['digits']} digits)")
        print(f"   Weakness Score: {w['weakness_score']:.1f}")
        print(f"   Mastery Level: {w['mastery_level']}")
        print(f"   Consecutive Correct: {w['consecutive_correct']}")
        print(f"   Last Practiced: {w['last_practiced']}")
        print()
    
    # Get performance breakdown for more detailed analysis
    print("\n📈 Performance Breakdown:")
    print("=" * 50)
    performance = get_performance_breakdown()
    
    if not performance:
        print("No performance data found.")
        return
    
    for record in performance:
        op, digits, count, correct, avg_time = record
        if count > 0:
            accuracy = (correct / count) * 100
            print(f"🔸 {op} ({digits} digits)")
            print(f"   Attempts: {count}")
            print(f"   Accuracy: {accuracy:.1f}%")
            print(f"   Avg Time: {avg_time:.1f}s" if avg_time else "   Avg Time: N/A")
            print()
    
    # Generate real recommendations
    print("\n🎯 Smart Coach Recommendations:")
    print("=" * 50)
    coach = SmartCoach()
    
    # Get primary recommendation
    (op, digits), reason = coach.get_recommendation()
    print(f"📍 Primary Focus: {op} ({digits} digits)")
    print(f"📝 Reason: {reason}")
    
    # Get all weakness focus areas
    print("\n🎯 All Focus Areas (sorted by priority):")
    focus_areas = coach.get_weakness_focus_areas(10)
    
    for i, area in enumerate(focus_areas, 1):
        print(f"{i}. {area['operation']} ({area['digits']} digits)")
        print(f"   Level: {area['level']}")
        print(f"   Weakness Score: {area['weakness_score']:.1f}")
        print(f"   Accuracy: {area['accuracy']:.1f}%")
        print(f"   Speed: {area['speed']:.1f}s")
        if 'suggestions' in area and area['suggestions']:
            print(f"   💡 Tips: {' | '.join(area['suggestions'])}")
        print()
    
    # Show learning path
    print("\n🛤️  Learning Path Priority:")
    print("=" * 50)
    for i, skill in enumerate(coach.learning_path[:5], 1):
        print(f"{i}. {skill['operation']} ({skill['digits']} digits)")
        print(f"   Priority Score: {skill['priority']:.1f}")
        print(f"   Current Level: {skill['level']}")
        print(f"   Current Score: {skill['current_score']:.1f}")
        print()

if __name__ == "__main__":
    read_real_data()
