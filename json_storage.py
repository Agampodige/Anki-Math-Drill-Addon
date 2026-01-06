"""
JSON-based storage system for Math Drill Pro
"""

import os
import json
import threading
from datetime import date, datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

# === Logging Setup ===
try:
    # Try to use the same logger as main_webengine
    import sys
    if hasattr(sys, 'stdout') and hasattr(sys.stdout, 'log_js_message'):
        # File logger is already set up
        pass
    else:
        # Set up a simple file logger for json_storage
        LOG_FILE = os.path.join(os.path.dirname(__file__), "math_drill_debug.log")
        
        class SimpleLogger:
            def __init__(self, log_file):
                self.log_file = log_file
            
            def _write_log(self, message):
                timestamp = datetime.now().strftime('%H:%M:%S.%f')[:-3]
                try:
                    with open(self.log_file, 'a', encoding='utf-8') as f:
                        f.write(f"[{timestamp}] JSON_STORAGE: {message}\n")
                except:
                    pass
            
            def log_message(self, message):
                self._write_log(message)
        
        # Create simple logger instance
        json_logger = SimpleLogger(LOG_FILE)
        
        # Add logging functions to builtins for use in this module
        import builtins
        original_print = builtins.print
        
        def json_print(*args, **kwargs):
            message = ' '.join(str(arg) for arg in args)
            json_logger.log_message(message)
            original_print(*args, **kwargs)  # Also print to console
        
        builtins.print = json_print
        
except Exception as e:
    # If logging setup fails, continue without it
    print(f"Warning: Could not set up json_storage logging: {e}")

# Get addon's data directory for proper storage
try:
    from aqt import mw
    # In Anki, get the actual addon directory path
    # The addon is installed as 'math_drill' in the addons folder
    addon_base_dir = mw.pm.addonFolder()
    addon_name = "math_drill"
    ADDON_DIR = os.path.join(addon_base_dir, addon_name)
    
    # Use the data subdirectory within the addon folder
    DATA_DIR = os.path.join(ADDON_DIR, "data")
    print(f"Using Anki addon data directory: {DATA_DIR}")
except ImportError:
    # Fallback for standalone testing
    DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
    print(f"Using standalone data directory: {DATA_DIR}")
except Exception as e:
    # Additional fallback for any other import issues
    DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
    print(f"Error accessing Anki data directory, using fallback: {e}")
    print(f"Using fallback data directory: {DATA_DIR}")

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

# JSON file paths
ATTEMPTS_FILE = os.path.join(DATA_DIR, "attempts.json")
SESSIONS_FILE = os.path.join(DATA_DIR, "sessions.json")
ACHIEVEMENTS_FILE = os.path.join(DATA_DIR, "achievements.json")
WEAKNESS_TRACKING_FILE = os.path.join(DATA_DIR, "weakness_tracking.json")
USER_SETTINGS_FILE = os.path.join(DATA_DIR, "user_settings.json")
DAILY_GOALS_FILE = os.path.join(DATA_DIR, "daily_goals.json")
ADAPTIVE_DIFFICULTY_FILE = os.path.join(DATA_DIR, "adaptive_difficulty.json")

# Thread-safe file writing lock
_file_lock = threading.Lock()

def _load_json_file(file_path: str, default: Any = None) -> Any:
    """Load data from JSON file with thread safety"""
    try:
        with _file_lock:
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            else:
                # Create file with default data
                _save_json_file(file_path, default if default is not None else [])
                return default if default is not None else []
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error loading {file_path}: {e}")
        return default if default is not None else []

def _save_json_file(file_path: str, data: Any) -> bool:
    """Save data to JSON file with thread safety"""
    try:
        with _file_lock:
            # Ensure directory exists
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            return True
    except (IOError, TypeError) as e:
        print(f"Error saving {file_path}: {e}")
        return False

def _append_to_json_file(file_path: str, item: Dict) -> bool:
    """Append a new item to JSON array file"""
    try:
        print(f"=== Attempting to append to {file_path} ===")
        print(f"Item data: {item}")
        
        data = _load_json_file(file_path, [])
        print(f"Current data count: {len(data)}")
        
        data.append(item)
        result = _save_json_file(file_path, data)
        
        if result:
            print(f"✅ Successfully saved to {file_path}")
            # Verify the save
            verify_data = _load_json_file(file_path, [])
            print(f"Verification: new count = {len(verify_data)}")
        else:
            print(f"❌ Failed to save to {file_path}")
        
        return result
    except Exception as e:
        print(f"❌ Error appending to {file_path}: {e}")
        import traceback
        traceback.print_exc()
        return False

def _update_in_json_file(file_path: str, key_func, update_func) -> bool:
    """Update items in JSON file based on key function"""
    try:
        data = _load_json_file(file_path, [])
        updated = False
        
        for item in data:
            if key_func(item):
                update_func(item)
                updated = True
        
        if updated:
            return _save_json_file(file_path, data)
        return False
    except Exception as e:
        print(f"Error updating {file_path}: {e}")
        return False

def init_json_storage():
    """Initialize JSON storage files with empty structures"""
    print("Initializing JSON storage system...")
    
    # Initialize all data files
    files_and_defaults = {
        ATTEMPTS_FILE: [],
        SESSIONS_FILE: [],
        ACHIEVEMENTS_FILE: [],
        WEAKNESS_TRACKING_FILE: [],
        USER_SETTINGS_FILE: {},
        DAILY_GOALS_FILE: {},
        ADAPTIVE_DIFFICULTY_FILE: []
    }
    
    for file_path, default_data in files_and_defaults.items():
        if not os.path.exists(file_path):
            _save_json_file(file_path, default_data)
            print(f"Created {os.path.basename(file_path)}")

# === Attempts Management ===

def log_attempt(operation: str, digits: int, correct: bool, time_taken: float, 
                session_id: Optional[int] = None, question_text: Optional[str] = None,
                user_answer: Optional[int] = None, correct_answer: Optional[int] = None,
                difficulty_level: int = 1) -> bool:
    """Log a practice attempt"""
    attempt_data = {
        'id': len(_load_json_file(ATTEMPTS_FILE)) + 1,
        'operation': operation,
        'digits': digits,
        'correct': correct,
        'time_taken': time_taken,
        'created': date.today().isoformat(),
        'session_id': session_id,
        'question_text': question_text,
        'user_answer': user_answer,
        'correct_answer': correct_answer,
        'difficulty_level': difficulty_level,
        'timestamp': datetime.now().isoformat()
    }
    
    return _append_to_json_file(ATTEMPTS_FILE, attempt_data)

def get_attempts_count() -> int:
    """Get total number of attempts"""
    attempts = _load_json_file(ATTEMPTS_FILE)
    return len(attempts)

def get_today_attempts_count() -> int:
    """Get today's attempts count"""
    attempts = _load_json_file(ATTEMPTS_FILE)
    today = date.today().isoformat()
    return len([a for a in attempts if a.get('created') == today])

def get_attempts_by_date_range(start_date: str, end_date: str) -> List[Dict]:
    """Get attempts within a date range"""
    attempts = _load_json_file(ATTEMPTS_FILE)
    return [a for a in attempts if start_date <= a.get('created', '') <= end_date]

def get_attempts_by_operation_digits(operation: str, digits: int, limit: int = 10) -> List[Dict]:
    """Get recent attempts for specific operation and digits"""
    attempts = _load_json_file(ATTEMPTS_FILE)
    filtered = [a for a in attempts if a.get('operation') == operation and a.get('digits') == digits]
    # Sort by timestamp descending and return latest
    filtered.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    return filtered[:limit]

# === Sessions Management ===

def log_session(mode: str, operation: str, digits: int, target_value: Optional[int],
                total_attempts: int, correct_count: int, avg_speed: float) -> int:
    """Log a practice session"""
    sessions = _load_json_file(SESSIONS_FILE)
    session_id = len(sessions) + 1
    
    session_data = {
        'id': session_id,
        'mode': mode,
        'operation': operation,
        'digits': digits,
        'target_value': target_value,
        'total_attempts': total_attempts,
        'correct_count': correct_count,
        'avg_speed': avg_speed,
        'created': datetime.now().isoformat()
    }
    
    if _append_to_json_file(SESSIONS_FILE, session_data):
        return session_id
    return 0

def get_sessions_count() -> int:
    """Get total number of sessions"""
    sessions = _load_json_file(SESSIONS_FILE)
    return len(sessions)

def get_sessions_by_mode(mode_pattern: str) -> int:
    """Get session count by mode pattern"""
    sessions = _load_json_file(SESSIONS_FILE)
    return len([s for s in sessions if mode_pattern in s.get('mode', '')])

def get_personal_best(mode: str, operation: str, digits: int) -> Optional[float]:
    """Get personal best for a specific mode and operation"""
    sessions = _load_json_file(SESSIONS_FILE)
    filtered = [s for s in sessions if 
                mode in s.get('mode', '') and 
                s.get('operation') == operation and 
                s.get('digits') == digits]
    
    if not filtered:
        return None
    
    if "Drill" in mode:
        # PB is lowest total time (total_attempts * avg_speed)
        valid_sessions = [s for s in filtered if s.get('correct_count', 0) >= s.get('total_attempts', 0)]
        if valid_sessions:
            return min(s.get('total_attempts', 0) * s.get('avg_speed', 0) for s in valid_sessions)
    elif "Sprint" in mode:
        # PB is highest correct_count
        return max(s.get('correct_count', 0) for s in filtered)
    
    return None

# === Achievements Management ===

def unlock_achievement(code: str, name: str, description: str = "", category: str = "general") -> bool:
    """Unlock an achievement"""
    achievements = _load_json_file(ACHIEVEMENTS_FILE)
    
    # Check if already unlocked
    for achievement in achievements:
        if achievement.get('code') == code:
            return False  # Already unlocked
    
    achievement_data = {
        'id': len(achievements) + 1,
        'code': code,
        'name': name,
        'description': description,
        'category': category,
        'unlocked_at': datetime.now().isoformat()
    }
    
    return _append_to_json_file(ACHIEVEMENTS_FILE, achievement_data)

def get_unlocked_achievements() -> List[Dict]:
    """Get all unlocked achievements"""
    return _load_json_file(ACHIEVEMENTS_FILE)

def get_achievement_codes() -> set:
    """Get set of unlocked achievement codes"""
    achievements = _load_json_file(ACHIEVEMENTS_FILE)
    return {achievement.get('code') for achievement in achievements}

# === Weakness Tracking ===

def update_weakness_tracking(operation: str, digits: int, correct: bool) -> bool:
    """Update weakness tracking for operation/digits combination"""
    weakness_data = _load_json_file(WEAKNESS_TRACKING_FILE)
    
    # Get recent attempts for this skill
    recent_attempts = get_attempts_by_operation_digits(operation, digits, 10)
    
    # Calculate weakness score
    if len(recent_attempts) < 3:
        weakness_score = 80.0
        mastery_level = "Novice"
    else:
        recent_correct = sum(1 for a in recent_attempts if a.get('correct', False))
        recent_accuracy = recent_correct / len(recent_attempts)
        recent_avg_time = sum(a.get('time_taken', 0) for a in recent_attempts) / len(recent_attempts)
        
        if recent_accuracy >= 0.9 and recent_avg_time < 4.0:
            weakness_score = 10.0
            mastery_level = "Master"
        elif recent_accuracy >= 0.8:
            weakness_score = 30.0
            mastery_level = "Pro"
        elif recent_accuracy >= 0.6:
            weakness_score = 60.0
            mastery_level = "Apprentice"
        else:
            weakness_score = 90.0
            mastery_level = "Novice"
    
    # Update consecutive correct
    existing_entry = None
    for entry in weakness_data:
        if entry.get('operation') == operation and entry.get('digits') == digits:
            existing_entry = entry
            break
    
    if correct:
        consecutive = (existing_entry.get('consecutive_correct', 0) + 1) if existing_entry else 1
    else:
        consecutive = 0
    
    # Calculate totals
    all_attempts = get_attempts_by_operation_digits(operation, digits, 1000)  # Get all history
    total_attempts = len(all_attempts)
    total_correct = sum(1 for a in all_attempts if a.get('correct', False))
    avg_time = sum(a.get('time_taken', 0) or 0 for a in all_attempts) / len(all_attempts) if all_attempts else 0
    
    weakness_entry = {
        'id': existing_entry.get('id') if existing_entry else len(weakness_data) + 1,
        'operation': operation,
        'digits': digits,
        'weakness_score': weakness_score,
        'consecutive_correct': consecutive,
        'last_practiced': date.today().isoformat(),
        'mastery_level': mastery_level,
        'total_attempts': total_attempts,
        'total_correct': total_correct,
        'avg_time': avg_time,
        'first_practiced': existing_entry.get('first_practiced') if existing_entry else date.today().isoformat()
    }
    
    if existing_entry:
        # Update existing entry
        for key, value in weakness_entry.items():
            existing_entry[key] = value
        return _save_json_file(WEAKNESS_TRACKING_FILE, weakness_data)
    else:
        # Add new entry
        return _append_to_json_file(WEAKNESS_TRACKING_FILE, weakness_entry)

def get_weakness_areas() -> List[Dict]:
    """Get weakness areas sorted by weakness score"""
    weakness_data = _load_json_file(WEAKNESS_TRACKING_FILE)
    filtered = [w for w in weakness_data if w.get('weakness_score', 0) > 20]
    filtered.sort(key=lambda x: (x.get('weakness_score', 0), x.get('last_practiced', '')), reverse=True)
    return filtered

def get_weakest_area() -> Optional[Dict]:
    """Get the single weakest area"""
    weaknesses = get_weakness_areas()
    return weaknesses[0] if weaknesses else None

# === User Settings ===

def set_user_setting(key: str, value: Any) -> bool:
    """Set a user setting"""
    settings = _load_json_file(USER_SETTINGS_FILE, {})
    settings[key] = {
        'value': value,
        'updated_at': datetime.now().isoformat()
    }
    return _save_json_file(USER_SETTINGS_FILE, settings)

def get_user_setting(key: str, default: Any = None) -> Any:
    """Get a user setting"""
    settings = _load_json_file(USER_SETTINGS_FILE, {})
    entry = settings.get(key, {})
    return entry.get('value', default)

# === Daily Goals ===

def set_daily_goal(target_questions: int, target_time_minutes: int) -> bool:
    """Set daily goal for today"""
    goals = _load_json_file(DAILY_GOALS_FILE, {})
    today = date.today().isoformat()
    
    goals[today] = {
        'target_questions': target_questions,
        'target_time_minutes': target_time_minutes,
        'questions_completed': 0,
        'time_spent_minutes': 0.0,
        'achieved': False,
        'created_at': datetime.now().isoformat()
    }
    
    return _save_json_file(DAILY_GOALS_FILE, goals)

def update_daily_progress(questions_completed: int, time_spent_minutes: float) -> bool:
    """Update today's daily goal progress"""
    goals = _load_json_file(DAILY_GOALS_FILE, {})
    today = date.today().isoformat()
    
    if today in goals:
        goals[today]['questions_completed'] += questions_completed
        goals[today]['time_spent_minutes'] += time_spent_minutes
        
        # Check if achieved
        goal = goals[today]
        goal['achieved'] = (goal['questions_completed'] >= goal['target_questions'] and 
                           goal['time_spent_minutes'] >= goal['target_time_minutes'])
        
        return _save_json_file(DAILY_GOALS_FILE, goals)
    
    return False

def get_daily_goal_status() -> Dict:
    """Get current daily goal status"""
    goals = _load_json_file(DAILY_GOALS_FILE, {})
    today = date.today().isoformat()
    
    if today in goals:
        return goals[today]
    else:
        # Return default goal
        return {
            'target_questions': 20,
            'target_time_minutes': 10,
            'questions_completed': 0,
            'time_spent_minutes': 0.0,
            'achieved': False
        }

def get_goal_history(days: int = 30) -> List[Dict]:
    """Get daily goal history for the last X days"""
    goals = _load_json_file(DAILY_GOALS_FILE, {})
    
    start_date = (date.today() - timedelta(days=days)).isoformat()
    history = []
    
    for date_str, goal_data in goals.items():
        if date_str >= start_date:
            history.append({
                'date': date_str,
                'questions_completed': goal_data.get('questions_completed', 0),
                'time_spent': goal_data.get('time_spent_minutes', 0.0),
                'achieved': goal_data.get('achieved', False)
            })
    
    # Sort by date
    history.sort(key=lambda x: x['date'])
    return history

# === Adaptive Difficulty ===

def get_adaptive_difficulty(operation: str, digits: int) -> Dict:
    """Get adaptive difficulty for operation/digits combination"""
    adaptive_data = _load_json_file(ADAPTIVE_DIFFICULTY_FILE)
    
    for entry in adaptive_data:
        if entry.get('operation') == operation and entry.get('digits') == digits:
            return entry
    
    # Return default values for new entries
    return {
        'current_difficulty': 1.0,
        'success_rate': 0.5,
        'avg_response_time': 0.0,
        'total_attempts': 0,
        'recent_performance': []
    }

def update_adaptive_difficulty(operation: str, digits: int, correct: bool, time_taken: float) -> bool:
    """Update adaptive difficulty based on performance"""
    adaptive_data = _load_json_file(ADAPTIVE_DIFFICULTY_FILE)
    
    # Find existing entry
    existing_entry = None
    for entry in adaptive_data:
        if entry.get('operation') == operation and entry.get('digits') == digits:
            existing_entry = entry
            break
    
    if existing_entry:
        # Update existing entry
        recent_perf = existing_entry.get('recent_performance', [])
        recent_perf.append({
            'correct': correct,
            'time_taken': time_taken,
            'timestamp': date.today().isoformat()
        })
        
        # Keep only last 10 attempts
        if len(recent_perf) > 10:
            recent_perf = recent_perf[-10:]
        
        # Calculate new success rate
        recent_correct = sum(1 for p in recent_perf if p.get('correct', False))
        new_success_rate = recent_correct / len(recent_perf)
        
        # Update average response time
        current_avg = existing_entry.get('avg_response_time', 0)
        if current_avg == 0:
            new_avg_time = time_taken
        else:
            new_avg_time = (current_avg * 0.8) + (time_taken * 0.2)
        
        # Adaptive difficulty adjustment
        adjustment_factor = 0.1
        
        if new_success_rate > 0.85 and time_taken < 3.0:
            difficulty_change = adjustment_factor * 1.5
        elif new_success_rate > 0.75:
            difficulty_change = adjustment_factor
        elif new_success_rate < 0.4:
            difficulty_change = -adjustment_factor * 1.2
        elif new_success_rate < 0.6:
            difficulty_change = -adjustment_factor * 0.8
        else:
            difficulty_change = 0
        
        current_difficulty = existing_entry.get('current_difficulty', 1.0)
        new_difficulty = max(0.5, min(3.0, current_difficulty + difficulty_change))
        
        # Update entry
        existing_entry.update({
            'current_difficulty': new_difficulty,
            'success_rate': new_success_rate,
            'avg_response_time': new_avg_time,
            'total_attempts': existing_entry.get('total_attempts', 0) + 1,
            'recent_performance': recent_perf,
            'last_adjusted': datetime.now().isoformat()
        })
        
        return _save_json_file(ADAPTIVE_DIFFICULTY_FILE, adaptive_data)
    else:
        # Create new entry
        new_entry = {
            'id': len(adaptive_data) + 1,
            'operation': operation,
            'digits': digits,
            'current_difficulty': 1.0,
            'success_rate': 1.0 if correct else 0.0,
            'avg_response_time': time_taken,
            'total_attempts': 1,
            'recent_performance': [{
                'correct': correct,
                'time_taken': time_taken,
                'timestamp': date.today().isoformat()
            }],
            'last_adjusted': datetime.now().isoformat()
        }
        
        return _append_to_json_file(ADAPTIVE_DIFFICULTY_FILE, new_entry)

# === Data Export/Import ===

def export_all_data() -> Dict:
    """Export all data for backup"""
    return {
        'attempts': _load_json_file(ATTEMPTS_FILE),
        'sessions': _load_json_file(SESSIONS_FILE),
        'achievements': _load_json_file(ACHIEVEMENTS_FILE),
        'weakness_tracking': _load_json_file(WEAKNESS_TRACKING_FILE),
        'user_settings': _load_json_file(USER_SETTINGS_FILE),
        'daily_goals': _load_json_file(DAILY_GOALS_FILE),
        'adaptive_difficulty': _load_json_file(ADAPTIVE_DIFFICULTY_FILE),
        'export_timestamp': datetime.now().isoformat()
    }

def import_all_data(data: Dict, merge: bool = True) -> bool:
    """Import data from backup"""
    try:
        success = True
        
        if not merge:
            # Replace all data
            success &= _save_json_file(ATTEMPTS_FILE, data.get('attempts', []))
            success &= _save_json_file(SESSIONS_FILE, data.get('sessions', []))
            success &= _save_json_file(ACHIEVEMENTS_FILE, data.get('achievements', []))
            success &= _save_json_file(WEAKNESS_TRACKING_FILE, data.get('weakness_tracking', []))
            success &= _save_json_file(USER_SETTINGS_FILE, data.get('user_settings', {}))
            success &= _save_json_file(DAILY_GOALS_FILE, data.get('daily_goals', {}))
            success &= _save_json_file(ADAPTIVE_DIFFICULTY_FILE, data.get('adaptive_difficulty', []))
        else:
            # Merge data
            existing_attempts = _load_json_file(ATTEMPTS_FILE)
            existing_sessions = _load_json_file(SESSIONS_FILE)
            existing_achievements = _load_json_file(ACHIEVEMENTS_FILE)
            
            # Merge attempts (avoid duplicates by checking timestamp)
            imported_attempts = data.get('attempts', [])
            for attempt in imported_attempts:
                if not any(a.get('timestamp') == attempt.get('timestamp') for a in existing_attempts):
                    existing_attempts.append(attempt)
            
            # Merge sessions
            imported_sessions = data.get('sessions', [])
            for session in imported_sessions:
                if not any(s.get('created') == session.get('created') for s in existing_sessions):
                    existing_sessions.append(session)
            
            # Merge achievements (avoid duplicates by code)
            imported_achievements = data.get('achievements', [])
            existing_codes = {a.get('code') for a in existing_achievements}
            for achievement in imported_achievements:
                if achievement.get('code') not in existing_codes:
                    existing_achievements.append(achievement)
            
            # Save merged data
            success &= _save_json_file(ATTEMPTS_FILE, existing_attempts)
            success &= _save_json_file(SESSIONS_FILE, existing_sessions)
            success &= _save_json_file(ACHIEVEMENTS_FILE, existing_achievements)
            
            # Replace other data (they're typically single-record or time-based)
            success &= _save_json_file(WEAKNESS_TRACKING_FILE, data.get('weakness_tracking', []))
            success &= _save_json_file(USER_SETTINGS_FILE, data.get('user_settings', {}))
            success &= _save_json_file(DAILY_GOALS_FILE, data.get('daily_goals', {}))
            success &= _save_json_file(ADAPTIVE_DIFFICULTY_FILE, data.get('adaptive_difficulty', []))
        
        return success
    except Exception as e:
        print(f"Error importing data: {e}")
        return False
