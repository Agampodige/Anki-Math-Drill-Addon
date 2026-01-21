"""
Analytics module for Math Drill Pro - JSON Storage Version
Provides statistical analysis functions
"""

try:
    from . import json_storage
except ImportError:
    import json_storage
from datetime import date, timedelta

def get_today_stats():
    """Get today's practice statistics"""
    attempts = json_storage._load_json_file(json_storage.ATTEMPTS_FILE, [])
    today_str = date.today().isoformat()
    
    today_attempts = [a for a in attempts if a.get('created') == today_str]
    
    if not today_attempts:
        return {
            'attempts': 0,
            'correct': 0,
            'accuracy': 0,
            'avg_time': 0,
            'total_time': 0
        }
    
    total_attempts = len(today_attempts)
    correct_attempts = sum(1 for a in today_attempts if a.get('correct', False))
    total_time = sum(a.get('time_taken', 0) for a in today_attempts)
    
    return {
        'attempts': total_attempts,
        'correct': correct_attempts,
        'accuracy': (correct_attempts / total_attempts * 100) if total_attempts > 0 else 0,
        'avg_time': total_time / total_attempts if total_attempts > 0 else 0,
        'total_time': total_time
    }

def get_overall_stats():
    """Get overall practice statistics"""
    attempts = json_storage._load_json_file(json_storage.ATTEMPTS_FILE, [])
    sessions = json_storage._load_json_file(json_storage.SESSIONS_FILE, [])
    
    if not attempts:
        return {
            'total_attempts': 0,
            'total_correct': 0,
            'overall_accuracy': 0,
            'total_sessions': 0,
            'unique_days': 0,
            'total_time': 0
        }
    
    total_attempts = len(attempts)
    correct_attempts = sum(1 for a in attempts if a.get('correct', False))
    total_time = sum(a.get('time_taken', 0) for a in attempts)
    
    # Calculate unique days played
    unique_days = set()
    for attempt in attempts:
        created_date = attempt.get('created', '')
        if created_date:
            unique_days.add(created_date)
    
    return {
        'total_attempts': total_attempts,
        'total_correct': correct_attempts,
        'overall_accuracy': (correct_attempts / total_attempts * 100) if total_attempts > 0 else 0,
        'total_sessions': len(sessions),
        'unique_days': len(unique_days),
        'total_time': total_time
    }

def get_weekly_stats():
    """Get weekly practice statistics"""
    attempts = json_storage._load_json_file(json_storage.ATTEMPTS_FILE, [])
    
    # Get last 7 days including today
    week_ago = (date.today() - timedelta(days=6)).isoformat()
    recent_attempts = [a for a in attempts if a.get('created', '') >= week_ago]
    
    if not recent_attempts:
        return {
            'weekly_attempts': 0,
            'weekly_correct': 0,
            'weekly_accuracy': 0,
            'weekly_avg_time': 0,
            'daily_breakdown': []
        }
    
    total_attempts = len(recent_attempts)
    correct_attempts = sum(1 for a in recent_attempts if a.get('correct', False))
    total_time = sum(a.get('time_taken', 0) for a in recent_attempts)
    
    # Daily breakdown
    daily_stats = {}
    for attempt in recent_attempts:
        created_date = attempt.get('created', '')
        if created_date not in daily_stats:
            daily_stats[created_date] = {'attempts': 0, 'correct': 0, 'time': 0}
        daily_stats[created_date]['attempts'] += 1
        if attempt.get('correct', False):
            daily_stats[created_date]['correct'] += 1
        daily_stats[created_date]['time'] += attempt.get('time_taken', 0)
    
    daily_breakdown = []
    for date_str in sorted(daily_stats.keys()):
        stats = daily_stats[date_str]
        accuracy = (stats['correct'] / stats['attempts'] * 100) if stats['attempts'] > 0 else 0
        daily_breakdown.append({
            'date': date_str,
            'attempts': stats['attempts'],
            'correct': stats['correct'],
            'accuracy': accuracy,
            'avg_time': stats['time'] / stats['attempts'] if stats['attempts'] > 0 else 0
        })
    
    return {
        'weekly_attempts': total_attempts,
        'weekly_correct': correct_attempts,
        'weekly_accuracy': (correct_attempts / total_attempts * 100) if total_attempts > 0 else 0,
        'weekly_avg_time': total_time / total_attempts if total_attempts > 0 else 0,
        'daily_breakdown': daily_breakdown
    }

def get_operation_breakdown():
    """Get performance breakdown by operation"""
    attempts = json_storage._load_json_file(json_storage.ATTEMPTS_FILE, [])
    
    operation_stats = {}
    for attempt in attempts:
        operation = attempt.get('operation', 'Unknown')
        if operation not in operation_stats:
            operation_stats[operation] = {'attempts': 0, 'correct': 0, 'time': 0}
        operation_stats[operation]['attempts'] += 1
        if attempt.get('correct', False):
            operation_stats[operation]['correct'] += 1
        operation_stats[operation]['time'] += attempt.get('time_taken', 0)
    
    breakdown = []
    for operation, stats in operation_stats.items():
        accuracy = (stats['correct'] / stats['attempts'] * 100) if stats['attempts'] > 0 else 0
        avg_time = stats['time'] / stats['attempts'] if stats['attempts'] > 0 else 0
        breakdown.append({
            'operation': operation,
            'attempts': stats['attempts'],
            'correct': stats['correct'],
            'accuracy': accuracy,
            'avg_time': avg_time
        })
    
    # Sort by attempts descending
    breakdown.sort(key=lambda x: x['attempts'], reverse=True)
    return breakdown

def get_difficulty_progression():
    """Get performance progression by difficulty (digits)"""
    attempts = json_storage._load_json_file(json_storage.ATTEMPTS_FILE, [])
    
    difficulty_stats = {}
    for attempt in attempts:
        digits = attempt.get('digits', 1)
        if digits not in difficulty_stats:
            difficulty_stats[digits] = {'attempts': 0, 'correct': 0, 'time': 0}
        difficulty_stats[digits]['attempts'] += 1
        if attempt.get('correct', False):
            difficulty_stats[digits]['correct'] += 1
        difficulty_stats[digits]['time'] += attempt.get('time_taken', 0)
    
    progression = []
    for digits in sorted(difficulty_stats.keys()):
        stats = difficulty_stats[digits]
        accuracy = (stats['correct'] / stats['attempts'] * 100) if stats['attempts'] > 0 else 0
        avg_time = stats['time'] / stats['attempts'] if stats['attempts'] > 0 else 0
        progression.append({
            'digits': digits,
            'attempts': stats['attempts'],
            'correct': stats['correct'],
            'accuracy': accuracy,
            'avg_time': avg_time
        })
    
    return progression

def get_learning_velocity(days: int = 30) -> dict:
    """Calculate learning velocity over specified period"""
    attempts = json_storage._load_json_file(json_storage.ATTEMPTS_FILE, [])
    
    # Filter for specified period
    start_date = (date.today() - timedelta(days=days)).isoformat()
    recent_attempts = [a for a in attempts if a.get('created', '') >= start_date]
    
    if len(recent_attempts) < 10:
        return {
            'velocity_score': 0,
            'improvement_rate': 0,
            'consistency_score': 0,
            'trend': 'insufficient_data'
        }
    
    # Split into two halves for comparison
    mid_point = len(recent_attempts) // 2
    early_attempts = recent_attempts[:mid_point]
    late_attempts = recent_attempts[mid_point:]
    
    # Calculate accuracy for each half
    early_accuracy = sum(1 for a in early_attempts if a.get('correct', False)) / len(early_attempts)
    late_accuracy = sum(1 for a in late_attempts if a.get('correct', False)) / len(late_attempts)
    
    # Calculate improvement rate
    improvement_rate = (late_accuracy - early_accuracy) * 100
    
    # Calculate consistency (variance in daily performance)
    daily_stats = {}
    for attempt in recent_attempts:
        created_date = attempt.get('created', '')
        if created_date not in daily_stats:
            daily_stats[created_date] = {'correct': 0, 'total': 0}
        daily_stats[created_date]['total'] += 1
        if attempt.get('correct', False):
            daily_stats[created_date]['correct'] += 1
    
    daily_accuracies = [
        (stats['correct'] / stats['total']) * 100 
        for stats in daily_stats.values() if stats['total'] > 0
    ]
    
    if daily_accuracies:
        avg_accuracy = sum(daily_accuracies) / len(daily_accuracies)
        variance = sum((acc - avg_accuracy) ** 2 for acc in daily_accuracies) / len(daily_accuracies)
        consistency_score = max(0, 100 - variance)  # Lower variance = higher consistency
    else:
        consistency_score = 0
    
    # Calculate overall velocity score
    velocity_score = (improvement_rate * 0.6) + (consistency_score * 0.4)
    
    # Determine trend
    if improvement_rate > 5:
        trend = 'improving'
    elif improvement_rate < -5:
        trend = 'declining'
    else:
        trend = 'stable'
    
    return {
        'velocity_score': round(velocity_score, 2),
        'improvement_rate': round(improvement_rate, 2),
        'consistency_score': round(consistency_score, 2),
        'trend': trend
    }
