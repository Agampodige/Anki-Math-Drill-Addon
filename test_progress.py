#!/usr/bin/env python3
"""
Test script to debug progress data generation
"""

import json
import sys
import os
from datetime import date, datetime, timedelta

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Import json_storage directly
import json_storage

def test_fallback_progress_data():
    """Test the fallback progress data generation method"""
    print("=== Testing Fallback Progress Data Generation ===")
    
    # Load attempts
    attempts = json_storage._load_json_file(json_storage.ATTEMPTS_FILE, [])
    print(f"Loaded {len(attempts)} attempts from JSON")
    
    if attempts:
        print("Sample attempt:", attempts[0])
    
    # Calculate basic stats
    total = len(attempts)
    correct = sum(1 for a in attempts if a.get('correct', False))
    total_time_db = sum(a.get('time_taken', 0) for a in attempts)
    
    accuracy = (correct / total) * 100 if total and total > 0 else 0
    avg_speed = total_time_db / total if total and total > 0 else 0
    
    print(f"Basic stats: {total} attempts, {correct} correct, {accuracy:.1f}% accuracy, {avg_speed:.2f}s avg speed")
    
    # Get recent activity (last 7 days)
    seven_days_ago = (date.today() - timedelta(days=6)).isoformat()
    recent_attempts = [a for a in attempts if a.get('created', '') >= seven_days_ago]
    print(f"Recent attempts (last 7 days): {len(recent_attempts)}")
    
    # Group by date
    daily_stats = {}
    for attempt in recent_attempts:
        created = attempt.get('created', '')
        if created not in daily_stats:
            daily_stats[created] = {'count': 0, 'correct': 0, 'time_sum': 0}
        daily_stats[created]['count'] += 1
        if attempt.get('correct', False):
            daily_stats[created]['correct'] += 1
        daily_stats[created]['time_sum'] += attempt.get('time_taken', 0)
    
    print(f"Daily stats: {daily_stats}")
    
    # Prepare data structures
    recent_activity = []
    chart_data = []
    today = date.today()
    
    for created_date in sorted(daily_stats.keys()):
        stats = daily_stats[created_date]
        count = stats['count']
        correct_sum = stats['correct']
        time_sum = stats['time_sum']
        
        if count and count > 0:
            created_dt = datetime.strptime(created_date, '%Y-%m-%d').date()
            delta = today - created_dt
            if delta.days == 0:
                time_ago = "Today"
            elif delta.days == 1:
                time_ago = "Yesterday"
            else:
                time_ago = f"{delta.days} days ago"

            # Recent activity
            recent_activity.append({
                'date': created_date,
                'timeAgo': time_ago,
                'questions': count,
                'accuracy': (correct_sum / count) * 100 if correct_sum else 0,
                'avgSpeed': time_sum / count if time_sum else 0
            })
            
            # Chart data
            chart_data.append({
                'label': created_dt.strftime('%a'),
                'accuracy': (correct_sum / count) * 100 if correct_sum else 0,
                'speed': time_sum / count if time_sum else 0
            })
    
    # Fallback progress data
    progress_data = {
        'stats': {
            'totalQuestions': total,
            'avgAccuracy': accuracy,
            'avgSpeed': avg_speed,
            'currentStreak': 0
        },
        'chartData': chart_data,
        'recentActivity': list(reversed(recent_activity)),
        'mastery': {},
        'weaknesses': [],
        'achievements': [],
        'personalBests': {}
    }
    
    print(f"\n=== Generated Progress Data ===")
    print(f"Stats: {progress_data['stats']}")
    print(f"Chart data points: {len(progress_data['chartData'])}")
    print(f"Recent activity entries: {len(progress_data['recentActivity'])}")
    
    if progress_data['recentActivity']:
        print("Sample recent activity:", progress_data['recentActivity'][0])
    
    if progress_data['chartData']:
        print("Sample chart data:", progress_data['chartData'][0])
    
    return progress_data

if __name__ == "__main__":
    try:
        data = test_fallback_progress_data()
        print(f"\n✅ Test completed successfully!")
        print(f"📊 Generated data with {data['stats']['totalQuestions']} total questions")
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
