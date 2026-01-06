"""
Enhanced Database API Layer for Math Drill Pro - JSON Storage Version
Provides a clean interface between the frontend and JSON file operations
"""

import os
import json
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
try:
    from . import json_storage
    from .levels import LevelManager
except ImportError:
    import json_storage
    from levels import LevelManager

class DatabaseAPI:
    """Enhanced database API with JSON file storage"""
    
    def __init__(self):
        self._init_database()
        self.level_manager = LevelManager()
    
    def _init_database(self):
        """Initialize JSON storage"""
        try:
            json_storage.init_json_storage()
        except Exception as e:
            print(f"Warning: JSON storage initialization failed: {e}")
    
    # === Session Management ===
    
    def create_session(self, mode: str, operation: str, digits: int, target_value: int = None) -> int:
        """Create a new practice session"""
        return json_storage.log_session(mode, operation, digits, target_value, 0, 0, 0.0)
    
    def update_session(self, session_id: int, total_attempts: int = None, correct_count: int = None, avg_speed: float = None, **kwargs) -> bool:
        """Update session statistics"""
        # Support alternative parameter names
        total = kwargs.get('total', total_attempts)
        correct = kwargs.get('correct', correct_count)
        
        sessions = json_storage._load_json_file(json_storage.SESSIONS_FILE, [])
        for session in sessions:
            if session.get('id') == session_id:
                update_data = {}
                if total is not None: update_data['total_attempts'] = total
                if correct is not None: update_data['correct_count'] = correct
                if avg_speed is not None: update_data['avg_speed'] = avg_speed
                if 'mistakes_data' in kwargs: update_data['mistakes'] = kwargs['mistakes_data']
                
                session.update(update_data)
                return json_storage._save_json_file(json_storage.SESSIONS_FILE, sessions)
        return False
    
    def get_session_stats(self, session_id: int) -> Optional[Dict]:
        """Get detailed statistics for a specific session"""
        sessions = json_storage._load_json_file(json_storage.SESSIONS_FILE, [])
        for session in sessions:
            if session.get('id') == session_id:
                return session
        return None
    
    def get_recent_sessions(self, limit: int = 10) -> List[Dict]:
        """Get recent practice sessions"""
        sessions = json_storage._load_json_file(json_storage.SESSIONS_FILE, [])
        sessions.sort(key=lambda x: x.get('created', ''), reverse=True)
        return sessions[:limit]
    
    # === Attempt Management ===
    
    def create_attempt(self, operation: str, digits: int, correct: bool, time_taken: float,
                      session_id: Optional[int] = None, question_text: Optional[str] = None,
                      user_answer: Optional[int] = None, correct_answer: Optional[int] = None,
                      difficulty_level: int = 1) -> int:
        """Create a new attempt record and return its ID"""
        # Get the next ID
        attempts = json_storage._load_json_file(json_storage.ATTEMPTS_FILE, [])
        attempt_id = len(attempts) + 1
        
        # Create attempt data with ID
        attempt_data = {
            'id': attempt_id,
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
        
        # Append to file
        success = json_storage._append_to_json_file(json_storage.ATTEMPTS_FILE, attempt_data)
        return attempt_id if success else 0
    
    def get_attempts_by_session(self, session_id: int) -> List[Dict]:
        """Get all attempts for a specific session"""
        attempts = json_storage._load_json_file(json_storage.ATTEMPTS_FILE, [])
        return [a for a in attempts if a.get('session_id') == session_id]
    
    def get_attempts_by_date_range(self, start_date: str, end_date: str) -> List[Dict]:
        """Get attempts within a date range"""
        return json_storage.get_attempts_by_date_range(start_date, end_date)
    
    def get_attempts_by_operation(self, operation: str, limit: int = 100) -> List[Dict]:
        """Get attempts for a specific operation"""
        attempts = json_storage._load_json_file(json_storage.ATTEMPTS_FILE, [])
        operation_attempts = [a for a in attempts if a.get('operation') == operation]
        operation_attempts.sort(key=lambda x: x.get('created', ''), reverse=True)
        return operation_attempts[:limit]
    
    # === Achievement Management ===
    
    def unlock_achievement(self, code: str, name: str, description: str = "", category: str = "general") -> bool:
        """Unlock an achievement"""
        return json_storage.unlock_achievement(code, name, description, category)
    
    def get_unlocked_achievements(self):
        """Get all unlocked achievements with details"""
        return get_unlocked_achievements_data()

    # === Level System Methods ===
    
    def get_all_levels(self):
        """Get all levels with progress"""
        return self.level_manager.get_all_levels()
        
    def get_level_details(self, level_id):
        """Get details for a specific level"""
        return self.level_manager.get_level_by_id(level_id)
        
    def complete_level(self, level_id, session_stats):
        """Check level completion and save progress"""
        return self.level_manager.complete_level(level_id, session_stats)
    
    def check_achievement_unlocked(self, code: str) -> bool:
        """Check if an achievement is unlocked"""
        achievement_codes = json_storage.get_achievement_codes()
        return code in achievement_codes
    
    # === Statistics and Analytics ===
    
    def get_basic_stats(self) -> Dict:
        """Get basic statistics"""
        attempts = json_storage._load_json_file(json_storage.ATTEMPTS_FILE, [])
        sessions = json_storage._load_json_file(json_storage.SESSIONS_FILE, [])
        
        total_attempts = len(attempts)
        total_correct = sum(1 for a in attempts if a.get('correct', False))
        total_sessions = len(sessions)
        
        # Calculate average time
        avg_time = 0
        if total_attempts > 0:
            total_time = sum(a.get('time_taken', 0) or 0 for a in attempts)
            avg_time = total_time / total_attempts
        
        # Calculate practice days (distinct days with attempts)
        practice_days = len(set(a.get('created', '') for a in attempts if a.get('created')))
        
        return {
            'total_attempts': total_attempts,
            'total_correct': total_correct,
            'total_sessions': total_sessions,
            'accuracy': (total_correct / total_attempts * 100) if total_attempts > 0 else 0,
            'avg_time': avg_time,
            'practice_days': practice_days
        }
    
    def get_comprehensive_stats(self, period: str = 'all') -> Dict:
        """Get comprehensive statistics for a period"""
        attempts = json_storage._load_json_file(json_storage.ATTEMPTS_FILE, [])
        sessions = json_storage._load_json_file(json_storage.SESSIONS_FILE, [])
        
        # Filter by period
        if period == 'week':
            week_ago = (date.today() - timedelta(days=7)).isoformat()
            attempts = [a for a in attempts if a.get('created', '') >= week_ago]
            sessions = [s for s in sessions if s.get('created', '')[:10] >= week_ago[:10]]
        elif period == 'month':
            month_ago = (date.today() - timedelta(days=30)).isoformat()
            attempts = [a for a in attempts if a.get('created', '') >= month_ago]
            sessions = [s for s in sessions if s.get('created', '')[:10] >= month_ago[:10]]
        
        # Basic stats
        total_attempts = len(attempts)
        total_correct = sum(1 for a in attempts if a.get('correct', False))
        total_sessions = len(sessions)
        
        # Operation breakdown
        operation_stats = {}
        for attempt in attempts:
            op = attempt.get('operation', 'Unknown')
            if op not in operation_stats:
                operation_stats[op] = {'count': 0, 'correct': 0, 'time_total': 0}
            operation_stats[op]['count'] += 1
            if attempt.get('correct', False):
                operation_stats[op]['correct'] += 1
            operation_stats[op]['time_total'] += attempt.get('time_taken', 0) or 0
        
        operation_breakdown = []
        for op, stats in operation_stats.items():
            count = stats['count']
            accuracy = (stats['correct'] / count * 100) if count > 0 else 0
            avg_time = stats['time_total'] / count if count > 0 else 0
            operation_breakdown.append({
                'operation': op,
                'count': count,
                'correct': stats['correct'],
                'accuracy': accuracy,
                'avg_time': avg_time
            })
        
        # Difficulty progression
        difficulty_stats = {}
        for attempt in attempts:
            digits = attempt.get('digits', 1)
            if digits not in difficulty_stats:
                difficulty_stats[digits] = {'count': 0, 'correct': 0, 'time_total': 0}
            difficulty_stats[digits]['count'] += 1
            if attempt.get('correct', False):
                difficulty_stats[digits]['correct'] += 1
            difficulty_stats[digits]['time_total'] += attempt.get('time_taken', 0) or 0
        
        difficulty_progression = []
        for digits, stats in sorted(difficulty_stats.items()):
            count = stats['count']
            accuracy = (stats['correct'] / count * 100) if count > 0 else 0
            avg_time = stats['time_total'] / count if count > 0 else 0
            difficulty_progression.append({
                'digits': digits,
                'count': count,
                'correct': stats['correct'],
                'accuracy': accuracy,
                'avg_time': avg_time
            })
        
        # Calculate practice days (distinct days with attempts)
        practice_days = len(set(a.get('created', '') for a in attempts if a.get('created')))
        
        # Group by date for recent activity
        daily_stats = {}
        for attempt in attempts:
            created_date = attempt.get('created', '')
            if created_date not in daily_stats:
                daily_stats[created_date] = {'count': 0, 'correct': 0, 'time_total': 0}
            daily_stats[created_date]['count'] += 1
            if attempt.get('correct', False):
                daily_stats[created_date]['correct'] += 1
            daily_stats[created_date]['time_total'] += attempt.get('time_taken', 0) or 0
        
        # Generate recent activity data
        recent_activity = []
        for date_str in sorted(daily_stats.keys(), reverse=True)[:7]:  # Last 7 days
            stats = daily_stats[date_str]
            count = stats['count']
            recent_activity.append({
                'date': date_str,
                'questions': count,
                'correct': stats['correct'],
                'avg_time': stats['time_total'] / count if count > 0 else 0
            })
        
        return {
            'basic_stats': {
                'total_attempts': total_attempts,
                'total_correct': total_correct,
                'total_sessions': total_sessions,
                'accuracy': (total_correct / total_attempts * 100) if total_attempts > 0 else 0,
                'avg_time': sum(a.get('time_taken', 0) or 0 for a in attempts) / total_attempts if total_attempts > 0 else 0,
                'practice_days': practice_days
            },
            'operation_breakdown': operation_breakdown,
            'difficulty_progression': difficulty_progression,
            'recent_activity': recent_activity
        }
    
    def get_performance_trends(self, days: int = 30) -> List[Dict]:
        """Get performance trends over time"""
        attempts = json_storage._load_json_file(json_storage.ATTEMPTS_FILE, [])
        
        # Filter for specified period
        start_date = (date.today() - timedelta(days=days)).isoformat()
        recent_attempts = [a for a in attempts if a.get('created', '') >= start_date]
        
        # Group by date
        daily_stats = {}
        for attempt in recent_attempts:
            created_date = attempt.get('created', '')
            if created_date not in daily_stats:
                daily_stats[created_date] = {'count': 0, 'correct': 0, 'time_total': 0}
            daily_stats[created_date]['count'] += 1
            if attempt.get('correct', False):
                daily_stats[created_date]['correct'] += 1
            daily_stats[created_date]['time_total'] += attempt.get('time_taken', 0) or 0
        
        # Convert to trend data
        trends = []
        for date_str in sorted(daily_stats.keys()):
            stats = daily_stats[date_str]
            count = stats['count']
            accuracy = (stats['correct'] / count * 100) if count > 0 else 0
            avg_time = stats['time_total'] / count if count > 0 else 0
            
            trends.append({
                'date': date_str,
                'attempts': count,
                'correct': stats['correct'],
                'accuracy': accuracy,
                'avg_time': avg_time
            })
        
        return trends
    
    # === Weakness Analysis ===
    
    def get_weakness_analysis(self) -> List[Dict]:
        """Get detailed weakness analysis"""
        weakness_data = json_storage.get_weakness_areas()
        
        # Enhance with additional analytics
        for weakness in weakness_data:
            operation = weakness.get('operation')
            digits = weakness.get('digits')
            
            # Get recent attempts for more detailed analysis
            recent_attempts = json_storage.get_attempts_by_operation_digits(operation, digits, 20)
            
            if recent_attempts:
                # Calculate recent performance metrics
                recent_correct = sum(1 for a in recent_attempts if a.get('correct', False))
                recent_accuracy = recent_correct / len(recent_attempts)
                recent_avg_time = sum(a.get('time_taken', 0) or 0 for a in recent_attempts) / len(recent_attempts)
                
                # Calculate improvement trend
                if len(recent_attempts) >= 10:
                    early_attempts = recent_attempts[-10:-5]  # Earlier 5 attempts
                    late_attempts = recent_attempts[-5:]      # Latest 5 attempts
                    
                    early_accuracy = sum(1 for a in early_attempts if a.get('correct', False)) / len(early_attempts)
                    late_accuracy = sum(1 for a in late_attempts if a.get('correct', False)) / len(late_attempts)
                    
                    improvement_trend = late_accuracy - early_accuracy
                else:
                    improvement_trend = 0
                
                weakness.update({
                    'recent_attempts': len(recent_attempts),
                    'recent_correct': recent_correct,
                    'recent_accuracy': recent_accuracy,
                    'recent_avg_time': recent_avg_time,
                    'improvement_trend': improvement_trend
                })
            else:
                # Set default values if no recent attempts
                weakness.update({
                    'recent_attempts': 0,
                    'recent_correct': 0,
                    'recent_accuracy': 0,
                    'recent_avg_time': 0,
                    'improvement_trend': 0
                })
        
        return weakness_data
    
    def get_weakest_area(self) -> Optional[Dict]:
        """Get the single weakest area"""
        return json_storage.get_weakest_area()
    
    # === Adaptive Learning ===
    
    def get_adaptive_recommendations(self, limit: int = 5) -> List[Dict]:
        """Get adaptive learning recommendations"""
        from .database import get_adaptive_recommendations
        return get_adaptive_recommendations(limit)
    
    def update_adaptive_difficulty(self, operation: str, digits: int, correct: bool, time_taken: float) -> bool:
        """Update adaptive difficulty"""
        return json_storage.update_adaptive_difficulty(operation, digits, correct, time_taken)
    
    def get_adaptive_insights(self) -> Dict:
        """Get adaptive learning insights"""
        from .database import get_adaptive_learning_insights
        return get_adaptive_learning_insights()
    
    # === User Settings ===
    
    def set_setting(self, key: str, value: Any) -> bool:
        """Set a user setting"""
        return json_storage.set_user_setting(key, value)
    
    def get_setting(self, key: str, default: Any = None) -> Any:
        """Get a user setting"""
        return json_storage.get_user_setting(key, default)
    
    # === Daily Goals ===
    
    def set_daily_goal(self, target_questions: int, target_time_minutes: int) -> bool:
        """Set daily goals"""
        return json_storage.set_daily_goal(target_questions, target_time_minutes)
    
    def get_daily_goal_status(self) -> Dict:
        """Get daily goal status"""
        return json_storage.get_daily_goal_status()
    
    def update_daily_progress(self, questions_completed: int, time_spent_minutes: float) -> bool:
        """Update daily progress"""
        return json_storage.update_daily_progress(questions_completed, time_spent_minutes)
    
    def get_goal_history(self, days: int = 30) -> List[Dict]:
        """Get goal history"""
        goals = json_storage._load_json_file(json_storage.DAILY_GOALS_FILE, {})
        
        history = []
        for date_str, goal_data in goals.items():
            if len(date_str) == 10:  # Valid date format
                # Calculate days ago
                try:
                    goal_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                    days_ago = (date.today() - goal_date).days
                    
                    if days_ago <= days:
                        history.append({
                            'date': date_str,
                            'days_ago': days_ago,
                            'target_questions': goal_data.get('target_questions', 20),
                            'target_time_minutes': goal_data.get('target_time_minutes', 10),
                            'questions_completed': goal_data.get('questions_completed', 0),
                            'time_spent_minutes': goal_data.get('time_spent_minutes', 0),
                            'achieved': goal_data.get('achieved', False)
                        })
                except ValueError:
                    continue
        
        history.sort(key=lambda x: x['date'], reverse=True)
        return history
    
    # === Data Export/Import ===
    
    def export_data(self, include_attempts: bool = True, include_sessions: bool = True) -> Dict:
        """Export data for backup"""
        all_data = json_storage.export_all_data()
        
        export_data = {
            'export_timestamp': all_data['export_timestamp']
        }
        
        if include_attempts:
            export_data['attempts'] = all_data['attempts']
        if include_sessions:
            export_data['sessions'] = all_data['sessions']
        
        # Always include achievements and settings
        export_data['achievements'] = all_data['achievements']
        export_data['user_settings'] = all_data['user_settings']
        
        return export_data
    
    def import_data(self, data: Dict, merge: bool = True) -> bool:
        """Import data from backup"""
        return json_storage.import_all_data(data, merge)
    
    # === Maintenance ===
    
    def cleanup_old_data(self, days_to_keep: int = 90) -> bool:
        """Clean up old data beyond specified days"""
        cutoff_date = (date.today() - timedelta(days=days_to_keep)).isoformat()
        
        try:
            # Clean old attempts
            attempts = json_storage._load_json_file(json_storage.ATTEMPTS_FILE, [])
            filtered_attempts = [a for a in attempts if a.get('created', '') >= cutoff_date]
            json_storage._save_json_file(json_storage.ATTEMPTS_FILE, filtered_attempts)
            
            # Clean old sessions
            sessions = json_storage._load_json_file(json_storage.SESSIONS_FILE, [])
            filtered_sessions = [s for s in sessions if s.get('created', '')[:10] >= cutoff_date[:10]]
            json_storage._save_json_file(json_storage.SESSIONS_FILE, filtered_sessions)
            
            return True
        except Exception as e:
            print(f"Error cleaning up old data: {e}")
            return False
    
    def get_storage_stats(self) -> Dict:
        """Get storage statistics"""
        files = {
            'attempts': json_storage.ATTEMPTS_FILE,
            'sessions': json_storage.SESSIONS_FILE,
            'achievements': json_storage.ACHIEVEMENTS_FILE,
            'weakness_tracking': json_storage.WEAKNESS_TRACKING_FILE,
            'user_settings': json_storage.USER_SETTINGS_FILE,
            'daily_goals': json_storage.DAILY_GOALS_FILE,
            'adaptive_difficulty': json_storage.ADAPTIVE_DIFFICULTY_FILE
        }
        
        stats = {}
        total_size = 0
        
        for name, file_path in files.items():
            if os.path.exists(file_path):
                size = os.path.getsize(file_path)
                data = json_storage._load_json_file(file_path, [])
                stats[name] = {
                    'file_path': file_path,
                    'size_bytes': size,
                    'size_kb': round(size / 1024, 2),
                    'record_count': len(data) if isinstance(data, list) else len(data.keys()) if isinstance(data, dict) else 0
                }
                total_size += size
            else:
                stats[name] = {
                    'file_path': file_path,
                    'size_bytes': 0,
                    'size_kb': 0,
                    'record_count': 0
                }
        
        stats['total'] = {
            'size_bytes': total_size,
            'size_kb': round(total_size / 1024, 2),
            'size_mb': round(total_size / (1024 * 1024), 2)
        }
        
        return stats

# Global instance for easy access
db_api = DatabaseAPI()

# Create simple adaptive learning instance to avoid circular imports
# Create simple adaptive learning instance to avoid circular imports
class AdaptiveLearning:
    def __init__(self):
        try:
            from .adaptive_analytics import adaptive_analytics
        except ImportError:
            from adaptive_analytics import adaptive_analytics
            
        self.adaptive_analytics = adaptive_analytics
        self.level_manager = LevelManager()
    
    def update_adaptive_performance(self, operation, digits, correct, time_taken):
        """Update adaptive performance"""
        return self.db_api.update_adaptive_difficulty(operation, digits, correct, time_taken)
    
    @property
    def db_api(self):
        # Access global db_api dynamically
        return db_api
    
    def get_personalized_recommendations(self, limit=5):
        """Get personalized recommendations"""
        return self.db_api.get_adaptive_recommendations(limit)
    
    def get_learning_path(self):
        """Get learning path"""
        return []

adaptive_learning = AdaptiveLearning()
