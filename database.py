"""
Database interface for Math Drill Pro - JSON Storage Version
Provides backward compatibility while using JSON file storage
"""

import os
from datetime import date, datetime
from typing import Dict, List, Optional, Any
try:
    from . import json_storage
except ImportError:
    import json_storage

# Initialize JSON storage on import
json_storage.init_json_storage()

def init_db():
    """Initialize database (backward compatibility)"""
    json_storage.init_json_storage()

# === Achievement Functions ===

def unlock_achievement(code: str, name: str) -> bool:
    """Unlock an achievement"""
    return json_storage.unlock_achievement(code, name)

def get_unlocked_achievements() -> set:
    """Get unlocked achievement codes"""
    return json_storage.get_achievement_codes()

# === Basic Statistics Functions ===

def get_total_attempts_count() -> int:
    """Get total number of attempts"""
    return json_storage.get_attempts_count()

def get_operation_stats(operation: str) -> tuple:
    """Get stats for specific operation"""
    attempts = json_storage._load_json_file(json_storage.ATTEMPTS_FILE, [])
    operation_attempts = [a for a in attempts if a.get('operation') == operation]
    total = len(operation_attempts)
    correct = sum(1 for a in operation_attempts if a.get('correct', False))
    return total, correct

def get_digit_stats(digits: int) -> tuple:
    """Get stats for specific digit count"""
    attempts = json_storage._load_json_file(json_storage.ATTEMPTS_FILE, [])
    digit_attempts = [a for a in attempts if a.get('digits') == digits]
    total = len(digit_attempts)
    avg_time = sum(a.get('time_taken', 0) for a in digit_attempts) / total if total > 0 else 0
    return total, avg_time

def get_session_count_by_mode(mode_pattern: str) -> int:
    """Get session count by mode pattern"""
    return json_storage.get_sessions_by_mode(mode_pattern)

def get_unique_play_days() -> int:
    """Get number of unique days played"""
    sessions = json_storage._load_json_file(json_storage.SESSIONS_FILE, [])
    unique_days = set()
    for session in sessions:
        created_date = session.get('created', '')[:10]  # Get date part
        if created_date:
            unique_days.add(created_date)
    return len(unique_days)

def get_total_practice_time() -> float:
    """Get total practice time in minutes"""
    sessions = json_storage._load_json_file(json_storage.SESSIONS_FILE, [])
    total_seconds = sum(
        s.get('total_attempts', 0) * s.get('avg_speed', 0) 
        for s in sessions
    )
    return total_seconds / 60  # Convert to minutes

def get_sessions_by_time_of_day(hour: int, comparison: str) -> int:
    """Get sessions by time of day"""
    sessions = json_storage._load_json_file(json_storage.SESSIONS_FILE, [])
    count = 0
    for session in sessions:
        created_time = session.get('created', '')
        if created_time:
            try:
                # Parse ISO datetime and get hour
                session_hour = int(created_time[11:13]) if len(created_time) > 13 else 0
                if comparison == 'before' and session_hour < hour:
                    count += 1
                elif comparison != 'before' and session_hour >= hour:
                    count += 1
            except (ValueError, IndexError):
                continue
    return count

def get_weekend_sessions() -> int:
    """Get weekend session count"""
    sessions = json_storage._load_json_file(json_storage.SESSIONS_FILE, [])
    count = 0
    for session in sessions:
        created_time = session.get('created', '')
        if created_time:
            try:
                # Parse ISO datetime and get weekday (0=Monday, 6=Sunday)
                dt = datetime.fromisoformat(created_time.replace('Z', '+00:00'))
                if dt.weekday() >= 5:  # Saturday or Sunday
                    count += 1
            except (ValueError, IndexError):
                continue
    return count

def get_perfectionist_sessions() -> int:
    """Get sessions with 100% accuracy"""
    sessions = json_storage._load_json_file(json_storage.SESSIONS_FILE, [])
    return sum(1 for s in sessions 
              if s.get('correct_count', 0) >= s.get('total_attempts', 0) and 
              s.get('total_attempts', 0) >= 10)

# === Session Management ===

def log_session(mode: str, op: str, digits: int, target: Optional[int], 
                total: int, correct: int, avg_speed: float) -> int:
    """Log a practice session"""
    return json_storage.log_session(mode, op, digits, target, total, correct, avg_speed)

def get_personal_best(mode: str, op: str, digits: int) -> Optional[float]:
    """Get personal best for mode/operation/digits"""
    return json_storage.get_personal_best(mode, op, digits)

# === Attempt Management ===

def log_attempt(operation: str, digits: int, correct: bool, time_taken: float, 
                session_id: Optional[int] = None) -> bool:
    """Log a practice attempt"""
    return json_storage.log_attempt(operation, digits, correct, time_taken, session_id)

def get_performance_breakdown() -> List[tuple]:
    """Get performance breakdown by operation and digits"""
    attempts = json_storage._load_json_file(json_storage.ATTEMPTS_FILE, [])
    
    # Filter for last 30 days
    thirty_days_ago = (date.today() - datetime.timedelta(days=30)).isoformat()
    recent_attempts = [a for a in attempts if a.get('created', '') >= thirty_days_ago]
    
    # Group by operation and digits
    breakdown = {}
    for attempt in recent_attempts:
        key = (attempt.get('operation'), attempt.get('digits'))
        if key not in breakdown:
            breakdown[key] = {'count': 0, 'correct': 0, 'time_total': 0}
        breakdown[key]['count'] += 1
        if attempt.get('correct', False):
            breakdown[key]['correct'] += 1
        breakdown[key]['time_total'] += attempt.get('time_taken', 0)
    
    # Convert to tuples
    result = []
    for (operation, digits), stats in breakdown.items():
        count = stats['count']
        correct = stats['correct']
        avg_time = stats['time_total'] / count if count > 0 else 0
        result.append((operation, digits, count, correct, avg_time))
    
    return result

def get_last_7_days_stats() -> List[tuple]:
    """Get stats for last 7 days"""
    attempts = json_storage._load_json_file(json_storage.ATTEMPTS_FILE, [])
    
    # Get last 7 days including today
    seven_days_ago = (date.today() - datetime.timedelta(days=6)).isoformat()
    recent_attempts = [a for a in attempts if a.get('created', '') >= seven_days_ago]
    
    # Group by date
    daily_stats = {}
    for attempt in recent_attempts:
        created_date = attempt.get('created', '')
        if created_date not in daily_stats:
            daily_stats[created_date] = {'count': 0, 'correct': 0}
        daily_stats[created_date]['count'] += 1
        if attempt.get('correct', False):
            daily_stats[created_date]['correct'] += 1
    
    # Convert to tuples and sort by date
    result = []
    for date_str in sorted(daily_stats.keys()):
        stats = daily_stats[date_str]
        result.append((date_str, stats['count'], stats['correct']))
    
    return result

def get_today_attempts_count() -> int:
    """Get today's attempts count"""
    return json_storage.get_today_attempts_count()

# === Weakness Tracking ===

def update_weakness_tracking(operation: str, digits: int, correct: bool) -> None:
    """Update weakness tracking"""
    json_storage.update_weakness_tracking(operation, digits, correct)

def get_weakness_areas() -> List[Dict]:
    """Get weakness areas"""
    return json_storage.get_weakness_areas()

def get_weakest_area() -> Optional[Dict]:
    """Get weakest area"""
    return json_storage.get_weakest_area()

# === Adaptive Learning System ===

def get_adaptive_difficulty(operation: str, digits: int) -> Dict:
    """Get adaptive difficulty"""
    return json_storage.get_adaptive_difficulty(operation, digits)

def update_adaptive_difficulty(operation: str, digits: int, correct: bool, time_taken: float) -> None:
    """Update adaptive difficulty"""
    json_storage.update_adaptive_difficulty(operation, digits, correct, time_taken)

def get_adaptive_recommendations(limit: int = 5) -> List[Dict]:
    """Get adaptive recommendations"""
    adaptive_data = json_storage._load_json_file(json_storage.ADAPTIVE_DIFFICULTY_FILE, [])
    
    # Filter for entries with sufficient attempts
    qualified_entries = [e for e in adaptive_data if e.get('total_attempts', 0) >= 3]
    
    # Sort by priority (low success rate first)
    qualified_entries.sort(key=lambda x: (
        1 if x.get('success_rate', 0) < 0.6 else
        2 if x.get('success_rate', 0) < 0.8 else 3,
        x.get('success_rate', 0),
        x.get('last_adjusted', '')
    ))
    
    recommendations = []
    for entry in qualified_entries[:limit]:
        success_rate = entry.get('success_rate', 0)
        
        if success_rate < 0.6:
            priority = "High Priority - Needs Practice"
            reason = f"Low success rate ({success_rate:.1%})"
        elif success_rate < 0.8:
            priority = "Medium Priority - Improving"
            reason = f"Moderate success rate ({success_rate:.1%})"
        else:
            priority = "Low Priority - Maintenance"
            reason = f"Good success rate ({success_rate:.1%})"
        
        recommendations.append({
            'operation': entry.get('operation'),
            'digits': entry.get('digits'),
            'difficulty': entry.get('current_difficulty', 1.0),
            'priority': priority,
            'reason': reason,
            'success_rate': success_rate,
            'avg_time': entry.get('avg_response_time', 0)
        })
    
    return recommendations

def get_adaptive_learning_insights() -> Dict:
    """Get adaptive learning insights"""
    adaptive_data = json_storage._load_json_file(json_storage.ADAPTIVE_DIFFICULTY_FILE, [])
    
    # Filter for qualified entries
    qualified_entries = [e for e in adaptive_data if e.get('total_attempts', 0) >= 5]
    
    if not qualified_entries:
        return {
            'overall_stats': {
                'total_adaptive_skills': 0,
                'avg_success_rate': 0,
                'avg_difficulty': 0,
                'mastered_skills': 0,
                'struggling_skills': 0
            },
            'operation_trends': [],
            'difficulty_progression': []
        }
    
    # Overall stats
    total_skills = len(qualified_entries)
    avg_success_rate = sum(e.get('success_rate', 0) for e in qualified_entries) / total_skills
    avg_difficulty = sum(e.get('current_difficulty', 0) for e in qualified_entries) / total_skills
    mastered_skills = sum(1 for e in qualified_entries if e.get('success_rate', 0) >= 0.8)
    struggling_skills = sum(1 for e in qualified_entries if e.get('success_rate', 0) < 0.6)
    
    # Operation trends
    operation_stats = {}
    for entry in qualified_entries:
        op = entry.get('operation')
        if op not in operation_stats:
            operation_stats[op] = {'success_sum': 0, 'difficulty_sum': 0, 'count': 0}
        operation_stats[op]['success_sum'] += entry.get('success_rate', 0)
        operation_stats[op]['difficulty_sum'] += entry.get('current_difficulty', 0)
        operation_stats[op]['count'] += 1
    
    operation_trends = []
    for op, stats in operation_stats.items():
        operation_trends.append({
            'operation': op,
            'avg_success': stats['success_sum'] / stats['count'],
            'avg_difficulty': stats['difficulty_sum'] / stats['count'],
            'skill_count': stats['count']
        })
    
    operation_trends.sort(key=lambda x: x['avg_success'], reverse=True)
    
    # Difficulty progression
    difficulty_stats = {}
    for entry in qualified_entries:
        digits = entry.get('digits')
        if digits not in difficulty_stats:
            difficulty_stats[digits] = {'success_sum': 0, 'difficulty_sum': 0, 'count': 0}
        difficulty_stats[digits]['success_sum'] += entry.get('success_rate', 0)
        difficulty_stats[digits]['difficulty_sum'] += entry.get('current_difficulty', 0)
        difficulty_stats[digits]['count'] += 1
    
    difficulty_progression = []
    for digits, stats in sorted(difficulty_stats.items()):
        difficulty_progression.append({
            'digits': digits,
            'avg_success': stats['success_sum'] / stats['count'],
            'avg_difficulty': stats['difficulty_sum'] / stats['count'],
            'skill_count': stats['count']
        })
    
    return {
        'overall_stats': {
            'total_adaptive_skills': total_skills,
            'avg_success_rate': avg_success_rate,
            'avg_difficulty': avg_difficulty,
            'mastered_skills': mastered_skills,
            'struggling_skills': struggling_skills
        },
        'operation_trends': operation_trends,
        'difficulty_progression': difficulty_progression,
        'suggestions': get_adaptive_recommendations(limit=3)
    }
