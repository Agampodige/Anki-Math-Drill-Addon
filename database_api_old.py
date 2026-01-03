"""
Enhanced Database API Layer for Math Drill Pro
Provides a clean interface between the frontend and database operations
"""

import sqlite3
import os
import json
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from contextlib import contextmanager

# Get the addon's data directory for proper database storage
try:
    from aqt import mw
    ADDON_DIR = os.path.dirname(os.path.dirname(__file__))
    DB_NAME = os.path.join(mw.pm.addonFolder(), "math_drill.db")
except ImportError:
    # Fallback for standalone testing
    DB_NAME = "math_drill.db"


class DatabaseAPI:
    """Enhanced database API with connection pooling and comprehensive error handling"""
    
    def __init__(self):
        self._connection_pool = []
        self._max_pool_size = 5
        self._init_database()
    
    def _init_database(self):
        """Initialize database with enhanced schema"""
        try:
            try:
                from .database import init_db
            except ImportError:
                from database import init_db
            init_db()
        except Exception as e:
            print(f"Warning: Database initialization failed: {e}")
            # Try to continue with basic functionality
            pass
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections with connection pooling"""
        conn = None
        try:
            # Try to get connection from pool
            if self._connection_pool:
                conn = self._connection_pool.pop()
            else:
                conn = sqlite3.connect(DB_NAME, check_same_thread=False)
                conn.execute("PRAGMA journal_mode=WAL")
                conn.execute("PRAGMA synchronous=NORMAL")
                conn.execute("PRAGMA cache_size=10000")
                conn.execute("PRAGMA temp_store=MEMORY")
            
            yield conn
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if conn:
                # Return connection to pool if not full
                if len(self._connection_pool) < self._max_pool_size:
                    self._connection_pool.append(conn)
                else:
                    conn.close()
    
    # === Session Management ===
    
    def create_session(self, mode: str, operation: str, digits: int, target_value: int = None) -> int:
        """Create a new practice session"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO sessions (mode, operation, digits, target_value, total_attempts, correct_count, avg_speed)
                VALUES (?, ?, ?, ?, 0, 0, 0.0)
            """, (mode, operation, digits, target_value))
            session_id = cursor.lastrowid
            conn.commit()
            return session_id
    
    def update_session(self, session_id: int, total_attempts: int, correct_count: int, avg_speed: float) -> bool:
        """Update session statistics"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE sessions 
                SET total_attempts = ?, correct_count = ?, avg_speed = ?
                WHERE id = ?
            """, (total_attempts, correct_count, avg_speed, session_id))
            conn.commit()
            return cursor.rowcount > 0
    
    def get_session_stats(self, session_id: int) -> Optional[Dict]:
        """Get detailed statistics for a specific session"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT s.*, COUNT(a.id) as attempt_count
                FROM sessions s
                LEFT JOIN attempts a ON s.id = a.session_id
                WHERE s.id = ?
                GROUP BY s.id
            """, (session_id,))
            row = cursor.fetchone()
            
            if row:
                columns = [desc[0] for desc in cursor.description]
                return dict(zip(columns, row))
            return None
    
    # === Attempt Management ===
    
    def log_attempt(self, session_id: Optional[int], operation: str, digits: int, 
                    correct: bool, time_taken: float, question_text: str = None,
                    user_answer: int = None, correct_answer: int = None,
                    difficulty_level: int = 1) -> int:
        """Log a practice attempt with enhanced tracking"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO attempts 
                (session_id, operation, digits, correct, time_taken, created, 
                 question_text, user_answer, correct_answer, difficulty_level)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (session_id, operation, digits, int(correct), time_taken, 
                  date.today().isoformat(), question_text, user_answer, 
                  correct_answer, difficulty_level))
            attempt_id = cursor.lastrowid
            conn.commit()
            return attempt_id
    
    def get_attempts_by_session(self, session_id: int) -> List[Dict]:
        """Get all attempts for a specific session"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM attempts 
                WHERE session_id = ?
                ORDER BY id ASC
            """, (session_id,))
            rows = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in rows]
    
    def get_recent_attempts(self, days: int = 7, limit: int = 100) -> List[Dict]:
        """Get recent attempts for analysis"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM attempts 
                WHERE created >= date('now', '-{} days')
                ORDER BY created DESC, id DESC
                LIMIT ?
            """.format(days), (limit,))
            rows = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in rows]
    
    # === Analytics and Statistics ===
    
    def get_comprehensive_stats(self, period: str = 'all') -> Dict[str, Any]:
        """Get comprehensive statistics for the frontend"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Time filter
            time_filter = ""
            if period == 'week':
                time_filter = "WHERE created >= date('now', '-7 days')"
            elif period == 'month':
                time_filter = "WHERE created >= date('now', '-30 days')"
            elif period == 'year':
                time_filter = "WHERE created >= date('now', '-365 days')"
            
            # Basic stats
            cursor.execute(f"""
                SELECT 
                    COUNT(*) as total_attempts,
                    SUM(correct) as total_correct,
                    AVG(time_taken) as avg_time,
                    COUNT(DISTINCT created) as practice_days
                FROM attempts {time_filter}
            """)
            basic_stats = dict(zip([desc[0] for desc in cursor.description], cursor.fetchone()))
            
            # Operation breakdown
            cursor.execute(f"""
                SELECT 
                    operation,
                    COUNT(*) as count,
                    SUM(correct) as correct,
                    AVG(time_taken) as avg_time
                FROM attempts {time_filter}
                GROUP BY operation
            """)
            operation_stats = [dict(zip([desc[0] for desc in cursor.description], row)) 
                             for row in cursor.fetchall()]
            
            # Difficulty progression
            cursor.execute(f"""
                SELECT 
                    digits,
                    COUNT(*) as count,
                    SUM(correct) as correct,
                    AVG(time_taken) as avg_time
                FROM attempts {time_filter}
                GROUP BY digits
                ORDER BY digits
            """)
            difficulty_stats = [dict(zip([desc[0] for desc in cursor.description], row)) 
                              for row in cursor.fetchall()]
            
            # Recent activity (last 30 days)
            cursor.execute("""
                SELECT 
                    created,
                    COUNT(*) as questions,
                    SUM(correct) as correct,
                    AVG(time_taken) as avg_time
                FROM attempts 
                WHERE created >= date('now', '-30 days')
                GROUP BY created
                ORDER BY created DESC
                LIMIT 30
            """)
            recent_activity = [dict(zip([desc[0] for desc in cursor.description], row)) 
                             for row in cursor.fetchall()]
            
            return {
                'basic_stats': basic_stats,
                'operation_breakdown': operation_stats,
                'difficulty_progression': difficulty_stats,
                'recent_activity': recent_activity,
                'period': period
            }
    
    def get_performance_trends(self, days: int = 30) -> Dict[str, List]:
        """Get performance trends for charts"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Daily performance
            cursor.execute("""
                SELECT 
                    created,
                    COUNT(*) as questions,
                    SUM(correct) as correct,
                    AVG(time_taken) as avg_time,
                    ROUND((SUM(correct) * 100.0 / COUNT(*)), 2) as accuracy
                FROM attempts 
                WHERE created >= date('now', '-{} days')
                GROUP BY created
                ORDER BY created ASC
            """.format(days))
            
            daily_data = []
            for row in cursor.fetchall():
                daily_data.append({
                    'date': row[0],
                    'questions': row[1],
                    'correct': row[2],
                    'avg_time': row[3] or 0,
                    'accuracy': row[4] or 0
                })
            
            # Weekly averages
            cursor.execute("""
                SELECT 
                    strftime('%Y-%W', created) as week,
                    COUNT(*) as questions,
                    SUM(correct) as correct,
                    AVG(time_taken) as avg_time,
                    ROUND((SUM(correct) * 100.0 / COUNT(*)), 2) as accuracy
                FROM attempts 
                WHERE created >= date('now', '-{} days')
                GROUP BY week
                ORDER BY week ASC
            """.format(days))
            
            weekly_data = []
            for row in cursor.fetchall():
                weekly_data.append({
                    'week': row[0],
                    'questions': row[1],
                    'correct': row[2],
                    'avg_time': row[3] or 0,
                    'accuracy': row[4] or 0
                })
            
            return {
                'daily': daily_data,
                'weekly': weekly_data
            }
    
    # === Weakness Analysis ===
    
    def get_weakness_analysis(self) -> List[Dict]:
        """Get detailed weakness analysis"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT 
                    wt.*,
                    COUNT(a.id) as recent_attempts,
                    SUM(a.correct) as recent_correct,
                    AVG(a.time_taken) as recent_avg_time
                FROM weakness_tracking wt
                LEFT JOIN attempts a ON wt.operation = a.operation AND wt.digits = a.digits 
                    AND a.created >= date('now', '-14 days')
                WHERE wt.weakness_score > 20
                ORDER BY wt.weakness_score DESC, wt.last_practiced ASC
            """)
            
            weaknesses = []
            for row in cursor.fetchall():
                weaknesses.append({
                    'operation': row[0],
                    'digits': row[1],
                    'weakness_score': row[2],
                    'consecutive_correct': row[3],
                    'last_practiced': row[4],
                    'mastery_level': row[5],
                    'total_attempts': row[6],
                    'total_correct': row[7],
                    'avg_time': row[8],
                    'first_practiced': row[9],
                    'recent_attempts': row[10],
                    'recent_correct': row[11],
                    'recent_avg_time': row[12] or 0
                })
            
            return weaknesses
    
    def update_weakness_tracking(self, operation: str, digits: int, correct: bool) -> None:
        """Update weakness tracking for a specific skill"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Get recent performance
            cursor.execute("""
                SELECT correct, time_taken 
                FROM attempts 
                WHERE operation = ? AND digits = ? 
                ORDER BY created DESC, id DESC 
                LIMIT 10
            """, (operation, digits))
            
            recent_attempts = cursor.fetchall()
            
            # Calculate weakness score
            if len(recent_attempts) < 3:
                weakness_score = 80.0
                mastery_level = "Novice"
            else:
                recent_correct = sum(1 for attempt in recent_attempts if attempt[0])
                recent_accuracy = recent_correct / len(recent_attempts)
                recent_avg_time = sum(attempt[1] for attempt in recent_attempts if attempt[1]) / len(recent_attempts)
                
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
            if correct:
                cursor.execute("""
                    SELECT consecutive_correct FROM weakness_tracking 
                    WHERE operation = ? AND digits = ?
                """, (operation, digits))
                result = cursor.fetchone()
                consecutive = (result[0] + 1) if result else 1
            else:
                consecutive = 0
            
            # Get overall stats
            cursor.execute("""
                SELECT COUNT(*), SUM(correct), AVG(time_taken)
                FROM attempts 
                WHERE operation = ? AND digits = ?
            """, (operation, digits))
            total_attempts, total_correct, avg_time = cursor.fetchone()
            
            # Insert or update
            cursor.execute("""
                INSERT OR REPLACE INTO weakness_tracking 
                (operation, digits, weakness_score, consecutive_correct, last_practiced, 
                 mastery_level, total_attempts, total_correct, avg_time, first_practiced)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 
                    COALESCE((SELECT first_practiced FROM weakness_tracking 
                              WHERE operation = ? AND digits = ?), ?))
            """, (operation, digits, weakness_score, consecutive, date.today().isoformat(),
                  mastery_level, total_attempts, total_correct, avg_time, operation, digits, date.today().isoformat()))
            
            conn.commit()
    
    # === Achievement Management ===
    
    def unlock_achievement(self, code: str, name: str, description: str = None, category: str = 'general') -> bool:
        """Unlock a new achievement"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute("""
                    INSERT INTO achievements (code, name, description, category)
                    VALUES (?, ?, ?, ?)
                """, (code, name, description, category))
                conn.commit()
                return True
            except sqlite3.IntegrityError:
                return False
    
    def get_achievements(self, category: str = None) -> List[Dict]:
        """Get all achievements, optionally filtered by category"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            if category:
                cursor.execute("""
                    SELECT * FROM achievements 
                    WHERE category = ?
                    ORDER BY unlocked_at DESC
                """, (category,))
            else:
                cursor.execute("""
                    SELECT * FROM achievements 
                    ORDER BY unlocked_at DESC
                """)
            
            rows = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in rows]
    
    # === User Settings ===
    
    def set_setting(self, key: str, value: str) -> None:
        """Set a user setting"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO user_settings (key, value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            """, (key, value))
            conn.commit()
    
    def get_setting(self, key: str, default: str = None) -> Optional[str]:
        """Get a user setting"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM user_settings WHERE key = ?", (key,))
            result = cursor.fetchone()
            return result[0] if result else default
    
    def get_all_settings(self) -> Dict[str, str]:
        """Get all user settings"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM user_settings")
            return dict(cursor.fetchall())
    
    # === Daily Goals ===
    
    def set_daily_goal(self, target_questions: int = 20, target_time_minutes: int = 10) -> None:
        """Set today's daily goal"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            today = date.today().isoformat()
            cursor.execute("""
                INSERT OR REPLACE INTO daily_goals 
                (date, target_questions, target_time_minutes, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            """, (today, target_questions, target_time_minutes))
            conn.commit()
    
    def update_daily_progress(self, questions_completed: int = None, time_spent_minutes: float = None) -> None:
        """Update today's progress"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            today = date.today().isoformat()
            
            # Get current progress
            cursor.execute("""
                SELECT questions_completed, time_spent_minutes FROM daily_goals 
                WHERE date = ?
            """, (today,))
            result = cursor.fetchone()
            
            if result:
                current_questions, current_time = result
                new_questions = questions_completed if questions_completed is not None else current_questions
                new_time = time_spent_minutes if time_spent_minutes is not None else current_time
                
                # Check if goals are achieved
                cursor.execute("""
                    SELECT target_questions, target_time_minutes FROM daily_goals 
                    WHERE date = ?
                """, (today,))
                targets = cursor.fetchone()
                
                achieved = 0
                if targets and new_questions >= targets[0] and new_time >= targets[1]:
                    achieved = 1
                
                cursor.execute("""
                    UPDATE daily_goals 
                    SET questions_completed = ?, time_spent_minutes = ?, achieved = ?
                    WHERE date = ?
                """, (new_questions, new_time, achieved, today))
            else:
                # Create new goal entry
                cursor.execute("""
                    INSERT INTO daily_goals 
                    (date, questions_completed, time_spent_minutes, achieved)
                    VALUES (?, ?, ?, 0)
                """, (today, questions_completed or 0, time_spent_minutes or 0))
            
            conn.commit()
    
    def get_daily_goal_status(self) -> Dict[str, Any]:
        """Get today's goal status"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            today = date.today().isoformat()
            cursor.execute("""
                SELECT * FROM daily_goals WHERE date = ?
            """, (today,))
            
            row = cursor.fetchone()
            if row:
                columns = [desc[0] for desc in cursor.description]
                result = dict(zip(columns, row))
                
                # Calculate progress percentages
                result['question_progress'] = min(100, (result['questions_completed'] / result['target_questions']) * 100) if result['target_questions'] > 0 else 0
                result['time_progress'] = min(100, (result['time_spent_minutes'] / result['target_time_minutes']) * 100) if result['target_time_minutes'] > 0 else 0
                
                return result
            else:
                # Return default goal
                return {
                    'date': today,
                    'target_questions': 20,
                    'target_time_minutes': 10,
                    'questions_completed': 0,
                    'time_spent_minutes': 0,
                    'achieved': 0,
                    'question_progress': 0,
                    'time_progress': 0
                }
    
    def get_goal_history(self, days: int = 30) -> List[Dict]:
        """Get daily goal history"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM daily_goals 
                WHERE date >= date('now', '-{} days')
                ORDER BY date DESC
            """.format(days))
            
            rows = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in rows]
    
    # === Data Export/Import ===
    
    def export_data(self, include_attempts: bool = True, include_sessions: bool = True) -> Dict[str, Any]:
        """Export user data for backup"""
        export_data = {
            'export_date': datetime.now().isoformat(),
            'version': '1.0',
            'data': {}
        }
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            if include_attempts:
                cursor.execute("SELECT * FROM attempts")
                columns = [desc[0] for desc in cursor.description]
                export_data['data']['attempts'] = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
            if include_sessions:
                cursor.execute("SELECT * FROM sessions")
                columns = [desc[0] for desc in cursor.description]
                export_data['data']['sessions'] = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
            cursor.execute("SELECT * FROM achievements")
            columns = [desc[0] for desc in cursor.description]
            export_data['data']['achievements'] = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
            cursor.execute("SELECT * FROM user_settings")
            columns = [desc[0] for desc in cursor.description]
            export_data['data']['settings'] = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        return export_data
    
    def import_data(self, data: Dict[str, Any], merge: bool = True) -> bool:
        """Import user data from backup"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                if not merge:
                    # Clear existing data
                    cursor.execute("DELETE FROM attempts")
                    cursor.execute("DELETE FROM sessions")
                    cursor.execute("DELETE FROM achievements")
                    cursor.execute("DELETE FROM user_settings")
                
                # Import attempts
                if 'attempts' in data.get('data', {}):
                    for attempt in data['data']['attempts']:
                        cursor.execute("""
                            INSERT OR REPLACE INTO attempts 
                            (id, operation, digits, correct, time_taken, created, session_id,
                             question_text, user_answer, correct_answer, difficulty_level)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (attempt.get('id'), attempt.get('operation'), attempt.get('digits'),
                              attempt.get('correct'), attempt.get('time_taken'), attempt.get('created'),
                              attempt.get('session_id'), attempt.get('question_text'),
                              attempt.get('user_answer'), attempt.get('correct_answer'),
                              attempt.get('difficulty_level', 1)))
                
                # Import sessions
                if 'sessions' in data.get('data', {}):
                    for session in data['data']['sessions']:
                        cursor.execute("""
                            INSERT OR REPLACE INTO sessions 
                            (id, mode, operation, digits, target_value, total_attempts, 
                             correct_count, avg_speed, created)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (session.get('id'), session.get('mode'), session.get('operation'),
                              session.get('digits'), session.get('target_value'),
                              session.get('total_attempts'), session.get('correct_count'),
                              session.get('avg_speed'), session.get('created')))
                
                # Import achievements
                if 'achievements' in data.get('data', {}):
                    for achievement in data['data']['achievements']:
                        cursor.execute("""
                            INSERT OR REPLACE INTO achievements 
                            (id, code, name, description, category, unlocked_at)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """, (achievement.get('id'), achievement.get('code'), achievement.get('name'),
                              achievement.get('description'), achievement.get('category', 'general'),
                              achievement.get('unlocked_at')))
                
                # Import settings
                if 'settings' in data.get('data', {}):
                    for setting in data['data']['settings']:
                        cursor.execute("""
                            INSERT OR REPLACE INTO user_settings 
                            (key, value, updated_at)
                            VALUES (?, ?, ?)
                        """, (setting.get('key'), setting.get('value'), setting.get('updated_at')))
                
                conn.commit()
                return True
                
        except Exception as e:
            print(f"Error importing data: {e}")
            return False


class AdaptiveLearning:
    """Advanced adaptive learning system for personalized math practice"""
    
    def __init__(self, db_api_instance=None):
        self.db = db_api_instance or db_api
    
    def get_adaptive_difficulty(self, operation: str, digits: int) -> Dict[str, Any]:
        """Get current adaptive difficulty settings for a skill"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT current_difficulty, success_rate, avg_response_time, 
                       total_attempts, recent_performance, last_adjusted
                FROM adaptive_difficulty 
                WHERE operation = ? AND digits = ?
            """, (operation, digits))
            result = cursor.fetchone()
            
            if result:
                return {
                    'current_difficulty': result[0],
                    'success_rate': result[1],
                    'avg_response_time': result[2],
                    'total_attempts': result[3],
                    'recent_performance': result[4],
                    'last_adjusted': result[5]
                }
            else:
                # Initialize new skill
                return {
                    'current_difficulty': 1.0,
                    'success_rate': 0.5,
                    'avg_response_time': 0.0,
                    'total_attempts': 0,
                    'recent_performance': None,
                    'last_adjusted': None
                }
    
    def update_adaptive_performance(self, operation: str, digits: int, 
                                   correct: bool, time_taken: float) -> Dict[str, Any]:
        """Update adaptive difficulty based on performance and return new settings"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            
            # Get current data
            cursor.execute("""
                SELECT current_difficulty, success_rate, avg_response_time, 
                       total_attempts, recent_performance
                FROM adaptive_difficulty 
                WHERE operation = ? AND digits = ?
            """, (operation, digits))
            result = cursor.fetchone()
            
            if result:
                current_difficulty, success_rate, avg_response_time, total_attempts, recent_perf = result
                total_attempts += 1
                
                # Update recent performance
                import json
                if recent_perf:
                    recent_data = json.loads(recent_perf)
                else:
                    recent_data = []
                
                recent_data.append({
                    'correct': correct,
                    'time_taken': time_taken,
                    'timestamp': date.today().isoformat()
                })
                
                # Keep only last 10 attempts for adaptive learning
                if len(recent_data) > 10:
                    recent_data = recent_data[-10:]
                
                # Calculate new metrics
                recent_correct = sum(1 for attempt in recent_data if attempt['correct'])
                new_success_rate = recent_correct / len(recent_data)
                
                # Update average response time with exponential smoothing
                if avg_response_time == 0:
                    new_avg_time = time_taken
                else:
                    new_avg_time = (avg_response_time * 0.8) + (time_taken * 0.2)
                
                # Intelligent difficulty adjustment
                difficulty_change = self._calculate_difficulty_adjustment(
                    new_success_rate, time_taken, current_difficulty
                )
                
                # Apply bounds and update
                new_difficulty = max(0.5, min(3.0, current_difficulty + difficulty_change))
                
                # Update database
                cursor.execute("""
                    UPDATE adaptive_difficulty 
                    SET current_difficulty = ?, success_rate = ?, avg_response_time = ?,
                        total_attempts = ?, recent_performance = ?, last_adjusted = CURRENT_TIMESTAMP
                    WHERE operation = ? AND digits = ?
                """, (new_difficulty, new_success_rate, new_avg_time, total_attempts,
                      json.dumps(recent_data), operation, digits))
                
                conn.commit()
                
                return {
                    'old_difficulty': current_difficulty,
                    'new_difficulty': new_difficulty,
                    'difficulty_change': difficulty_change,
                    'success_rate': new_success_rate,
                    'avg_response_time': new_avg_time,
                    'total_attempts': total_attempts,
                    'performance_trend': self._analyze_performance_trend(recent_data)
                }
            else:
                # Create new skill entry
                import json
                initial_performance = json.dumps([{
                    'correct': correct,
                    'time_taken': time_taken,
                    'timestamp': date.today().isoformat()
                }])
                
                cursor.execute("""
                    INSERT INTO adaptive_difficulty 
                    (operation, digits, current_difficulty, success_rate, avg_response_time, 
                     total_attempts, recent_performance)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (operation, digits, 1.0, 1.0 if correct else 0.0, time_taken, 1,
                      initial_performance))
                
                conn.commit()
                
                return {
                    'old_difficulty': 1.0,
                    'new_difficulty': 1.0,
                    'difficulty_change': 0.0,
                    'success_rate': 1.0 if correct else 0.0,
                    'avg_response_time': time_taken,
                    'total_attempts': 1,
                    'performance_trend': 'new_skill'
                }
    
    def _calculate_difficulty_adjustment(self, success_rate: float, time_taken: float, 
                                       current_difficulty: float) -> float:
        """Calculate intelligent difficulty adjustment based on performance"""
        base_factor = 0.1
        
        # Performance-based adjustments
        if success_rate > 0.9 and time_taken < 2.0:
            # Excellent performance - increase difficulty more
            return base_factor * 2.0
        elif success_rate > 0.85 and time_taken < 3.0:
            # Very good performance
            return base_factor * 1.5
        elif success_rate > 0.75:
            # Good performance
            return base_factor
        elif success_rate < 0.3:
            # Very poor performance - decrease difficulty significantly
            return -base_factor * 2.0
        elif success_rate < 0.5:
            # Poor performance - decrease difficulty
            return -base_factor * 1.5
        elif success_rate < 0.65:
            # Below average - slight decrease
            return -base_factor * 0.8
        else:
            # Optimal difficulty zone (65-75% success rate)
            return 0.0
    
    def _analyze_performance_trend(self, recent_data: List[Dict]) -> str:
        """Analyze performance trend from recent attempts"""
        if len(recent_data) < 3:
            return 'insufficient_data'
        
        # Compare recent performance to older performance
        recent_half = recent_data[-len(recent_data)//2:]
        older_half = recent_data[:len(recent_data)//2]
        
        recent_accuracy = sum(1 for attempt in recent_half if attempt['correct']) / len(recent_half)
        older_accuracy = sum(1 for attempt in older_half if attempt['correct']) / len(older_half)
        
        recent_avg_time = sum(attempt['time_taken'] for attempt in recent_half) / len(recent_half)
        older_avg_time = sum(attempt['time_taken'] for attempt in older_half) / len(older_half)
        
        if recent_accuracy > older_accuracy + 0.1 and recent_avg_time < older_avg_time:
            return 'improving_rapidly'
        elif recent_accuracy > older_accuracy + 0.05:
            return 'improving'
        elif recent_accuracy < older_accuracy - 0.1:
            return 'declining'
        elif recent_accuracy < older_accuracy - 0.05:
            return 'slight_decline'
        else:
            return 'stable'
    
    def get_personalized_recommendations(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Get personalized learning recommendations based on adaptive data"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT operation, digits, current_difficulty, success_rate, 
                       avg_response_time, total_attempts, last_adjusted
                FROM adaptive_difficulty 
                WHERE total_attempts >= 3
                ORDER BY 
                    CASE 
                        WHEN success_rate < 0.5 THEN 1
                        WHEN success_rate < 0.7 THEN 2
                        WHEN success_rate < 0.85 THEN 3
                        ELSE 4
                    END,
                    success_rate ASC,
                    last_adjusted ASC
                LIMIT ?
            """, (limit,))
            
            recommendations = []
            for row in cursor.fetchall():
                operation, digits, difficulty, success_rate, avg_time, attempts, last_adjusted = row
                
                # Determine priority and recommendation type
                if success_rate < 0.5:
                    priority = "High Priority"
                    recommendation_type = "remedial_practice"
                    message = f"Focus on {operation} with {digits}-digit numbers - struggling with {success_rate:.1%} accuracy"
                elif success_rate < 0.7:
                    priority = "Medium Priority"
                    recommendation_type = "targeted_practice"
                    message = f"Continue practicing {operation} ({digits}-digit) - {success_rate:.1%} accuracy, improving needed"
                elif success_rate < 0.85:
                    priority = "Low Priority"
                    recommendation_type = "maintenance"
                    message = f"Maintain {operation} ({digits}-digit) skills - {success_rate:.1%} accuracy"
                else:
                    priority = "Challenge Ready"
                    recommendation_type = "advance"
                    message = f"Consider advancing {operation} difficulty - mastered at {success_rate:.1%} accuracy"
                
                recommendations.append({
                    'operation': operation,
                    'digits': digits,
                    'current_difficulty': difficulty,
                    'success_rate': success_rate,
                    'avg_response_time': avg_time,
                    'total_attempts': attempts,
                    'priority': priority,
                    'recommendation_type': recommendation_type,
                    'message': message,
                    'last_practiced': last_adjusted
                })
            
            return recommendations
    
    def get_learning_path(self, target_operation: str = None) -> Dict[str, Any]:
        """Generate personalized learning path based on current adaptive data"""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            
            if target_operation:
                cursor.execute("""
                    SELECT digits, current_difficulty, success_rate, total_attempts
                    FROM adaptive_difficulty 
                    WHERE operation = ? AND total_attempts >= 1
                    ORDER BY digits
                """, (target_operation,))
            else:
                cursor.execute("""
                    SELECT operation, digits, current_difficulty, success_rate, total_attempts
                    FROM adaptive_difficulty 
                    WHERE total_attempts >= 1
                    ORDER BY 
                        CASE operation
                            WHEN 'Addition' THEN 1
                            WHEN 'Subtraction' THEN 2
                            WHEN 'Multiplication' THEN 3
                            WHEN 'Division' THEN 4
                            ELSE 5
                        END,
                        digits
                """)
            
            skills = cursor.fetchall()
            
            if not skills:
                return {'message': 'No adaptive data available yet. Start practicing to generate learning path!'}
            
            learning_path = []
            current_stage = 0
            
            for skill in skills:
                if target_operation:
                    operation, digits, difficulty, success_rate, attempts = target_operation, skill[0], skill[1], skill[2], skill[3]
                else:
                    operation, digits, difficulty, success_rate, attempts = skill
                
                # Determine mastery level
                if success_rate >= 0.85 and attempts >= 10:
                    mastery = 'Mastered'
                    stage = 3
                elif success_rate >= 0.7:
                    mastery = 'Developing'
                    stage = 2
                elif success_rate >= 0.5:
                    mastery = 'Learning'
                    stage = 1
                else:
                    mastery = 'Introduction'
                    stage = 0
                
                learning_path.append({
                    'operation': operation,
                    'digits': digits,
                    'difficulty': difficulty,
                    'success_rate': success_rate,
                    'attempts': attempts,
                    'mastery_level': mastery,
                    'stage': stage,
                    'next_step': self._get_next_step(mastery, operation, digits)
                })
            
            # Sort by stage and difficulty
            learning_path.sort(key=lambda x: (x['stage'], x['digits']))
            
            return {
                'learning_path': learning_path,
                'current_focus': learning_path[0] if learning_path else None,
                'next_milestone': self._find_next_milestone(learning_path),
                'overall_progress': self._calculate_overall_progress(learning_path)
            }
    
    def _get_next_step(self, mastery: str, operation: str, digits: int) -> str:
        """Get next learning step based on mastery level"""
        if mastery == 'Introduction':
            return f"Practice basic {operation} with {digits}-digit numbers"
        elif mastery == 'Learning':
            return f"Continue {operation} practice to build confidence"
        elif mastery == 'Developing':
            return f"Focus on speed and accuracy with {operation}"
        else:  # Mastered
            next_digits = digits + 1
            return f"Ready for {operation} with {next_digits}-digit numbers"
    
    def _find_next_milestone(self, learning_path: List[Dict]) -> Dict[str, Any]:
        """Find the next learning milestone"""
        for skill in learning_path:
            if skill['mastery_level'] != 'Mastered':
                return skill
        return {'message': 'All skills mastered! Consider advanced challenges.'}
    
    def _calculate_overall_progress(self, learning_path: List[Dict]) -> Dict[str, Any]:
        """Calculate overall learning progress"""
        if not learning_path:
            return {'percentage': 0, 'mastered': 0, 'total': 0}
        
        mastered = sum(1 for skill in learning_path if skill['mastery_level'] == 'Mastered')
        total = len(learning_path)
        percentage = (mastered / total) * 100
        
        return {
            'percentage': percentage,
            'mastered': mastered,
            'total': total,
            'developing': sum(1 for skill in learning_path if skill['mastery_level'] == 'Developing'),
            'learning': sum(1 for skill in learning_path if skill['mastery_level'] == 'Learning'),
            'introduction': sum(1 for skill in learning_path if skill['mastery_level'] == 'Introduction')
        }


# Global database API instance
db_api = DatabaseAPI()

# Global adaptive learning instance
adaptive_learning = AdaptiveLearning(db_api)
