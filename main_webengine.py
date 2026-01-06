import sys
import os
import json
import threading
import time
from datetime import date, datetime
from aqt.qt import (
    QDialog, QVBoxLayout, QApplication, QUrl, Qt,
    QWebEngineView, QWebEnginePage, QWebChannel, QWebEngineSettings
)
from PyQt6.QtCore import QObject, pyqtSlot, QTimer, pyqtSignal

# === Logging Setup ===
LOG_FILE = os.path.join(os.path.dirname(__file__), "math_drill_debug.log")

class FileLogger:
    """Redirect all prints and JS console messages to a log file"""
    
    def __init__(self, log_file):
        self.log_file = log_file
        self.original_stdout = sys.stdout
        self.original_stderr = sys.stderr
        self.encoding = 'utf-8' # Required by aqt.webview
        
        # Create log file with timestamp
        self._write_log(f"\n{'='*60}")
        self._write_log(f"Math Drill Debug Log Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self._write_log(f"Log file: {self.log_file}")
        self._write_log(f"{'='*60}\n")
    
    def _write_log(self, message):
        """Write message to log file with timestamp"""
        timestamp = datetime.now().strftime('%H:%M:%S.%f')[:-3]
        try:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write(f"[{timestamp}] {message}\n")
        except Exception as e:
            # Fallback to original stdout if file writing fails
            self.original_stdout.write(f"LOG ERROR: {e}\n[{timestamp}] {message}\n")
    
    def write(self, message):
        """Intercept stdout writes"""
        if message.strip():  # Only log non-empty messages
            self._write_log(f"PYTHON: {message.rstrip()}")
        # Also write to original stdout for Anki console
        self.original_stdout.write(message)
    
    def flush(self):
        """Flush both log file and original stdout"""
        try:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.flush()
        except:
            pass
        self.original_stdout.flush()
    
    def log_js_message(self, level, message, line_number, source_id):
        """Log JavaScript console messages"""
        self._write_log(f"JS [{level}]: {message} (line {line_number}, source: {source_id})")
    
    def log_error(self, message):
        """Log error messages"""
        self._write_log(f"ERROR: {message}")
        self.original_stderr.write(f"ERROR: {message}\n")

# Initialize file logger
file_logger = FileLogger(LOG_FILE)

# Redirect stdout and stderr
sys.stdout = file_logger
sys.stderr = file_logger

try:
    from .database import init_db, log_attempt, log_session, get_last_7_days_stats, get_personal_best, get_total_attempts_count, get_today_attempts_count, update_weakness_tracking
except ImportError:
    from database import init_db, log_attempt, log_session, get_last_7_days_stats, get_personal_best, get_total_attempts_count, get_today_attempts_count, update_weakness_tracking

try:
    from .database_api import db_api
except ImportError:
    from database_api import db_api

try:
    from .database_api import adaptive_learning
except ImportError:
    from database_api import adaptive_learning

try:
    from .analytics import get_today_stats, get_learning_velocity
except ImportError:
    from analytics import get_today_stats, get_learning_velocity

try:
    from .coach import SmartCoach
except ImportError:
    from coach import SmartCoach

try:
    from .gamification import AchievementManager, AppSettings
except ImportError:
    from gamification import AchievementManager, AppSettings


class PythonBridge(QObject):
    progress_data_ready = pyqtSignal(dict, str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.parent_dialog = parent
        self.settings_manager = AppSettings()
        self.achievements = AchievementManager()
        self.coach = SmartCoach()
        self.adaptive_learning = adaptive_learning
        
        self.progress_data_ready.connect(self._handle_progress_data_ready)
        
        # Real-time sync subscribers
        self._sync_subscribers = set()
        self._last_sync_data = {}
        
    @pyqtSlot(str, str, str)
    def send(self, action, data_str, callback_id):
        """Handle messages from JavaScript"""
        print(f"=== PythonBridge.send called ===")
        print(f"Action: {action}")
        print(f"Data: {data_str}")
        print(f"Callback ID: {callback_id}")
        print(f"Bridge available: True")
        
        try:
            data = json.loads(data_str) if data_str else {}
            
            if action == 'reset_session':
                self.reset_session(data, callback_id)
            elif action == 'start_session':
                self.start_session(data, callback_id)
            elif action == 'test_direct_log':
                print("=== Testing direct attempt logging ===")
                test_data = {
                    'operation': 'Test',
                    'digits': 1,
                    'correct': True,
                    'time_taken': 1.0,
                    'question_text': '1+1',
                    'user_answer': 2,
                    'correct_answer': 2
                }
                self.log_attempt(test_data)
                self.send_to_js('test_direct_log_result', {'status': 'success', 'message': 'Direct logging test completed'}, callback_id)
            elif action == 'test_bridge':
                print("=== Test bridge action received ===")
                self.send_to_js('test_bridge_result', {'status': 'success', 'message': 'Bridge working!'}, callback_id)
            elif action == 'log_attempt':
                print("=== Handling log_attempt action ===")
                self.log_attempt(data, callback_id)
            elif action == 'end_session':
                self.end_session(data, callback_id)
            elif action == 'play_sound':
                self.play_sound(data)
            elif action == 'get_stats':
                self.get_stats(callback_id)
            elif action == 'get_settings':
                self.get_settings(callback_id)
            elif action == 'toggle_sound':
                self.toggle_sound(callback_id)
            elif action == 'get_achievements':
                self.get_achievements(callback_id)
            elif action == 'get_weakness':
                self.get_weakness(callback_id)
            elif action == 'get_mastery':
                self.get_mastery(callback_id)
            elif action == 'get_coach_recommendation':
                self.get_coach_recommendation(callback_id)
            elif action == 'get_progress_data':
                self.get_progress_data_instant(data, callback_id)
            elif action == 'open_progress_page':
                print("Python bridge received open_progress_page request")
                self.open_progress_page()
            elif action == 'navigate_to_progress':
                print("Python bridge received navigate_to_progress request")
                self.navigate_to_progress()
            elif action == 'navigate_to_main':
                print("Python bridge received navigate_to_main request")
                self.navigate_to_main()
            elif action == 'subscribe_realtime':
                self.subscribe_realtime(data, callback_id)
            elif action == 'unsubscribe_realtime':
                self.unsubscribe_realtime(callback_id)
            elif action == 'get_daily_goals':
                self.get_daily_goals(callback_id)
            elif action == 'set_daily_goals':
                self.set_daily_goals(data, callback_id)
            elif action == 'export_data':
                self.export_user_data(data, callback_id)
            elif action == 'import_data':
                self.import_user_data(data, callback_id)
            elif action == 'get_level_question':
                self.get_level_question(callback_id)
            elif action == 'get_levels':
                self.get_levels(callback_id)
            elif action == 'get_level_details':
                self.get_level_details(data, callback_id)
            elif action == 'complete_level':
                self.complete_level(data, callback_id)
            elif action == 'get_current_level':
                self.get_current_level(callback_id)
            elif action == 'get_level_completion_data':
                self.get_level_completion_data(callback_id)
            elif action == 'save_level_completion':
                self.save_level_completion(data, callback_id)
            elif action == 'navigate_to_levels':
                self.navigate_to_levels(callback_id)
            elif action == 'navigate_to_level_progress':
                self.navigate_to_level_progress(callback_id)
            elif action == 'navigate_to_level_complete':
                self.navigate_to_level_complete(callback_id)
            elif action == 'retry_level':
                self.retry_level(callback_id)
            elif action == 'time_up':
                self.handle_time_up(callback_id)
            elif action == 'navigate_to_main':
                self.navigate_to_main(callback_id)
            elif action == 'get_adaptive_difficulty':
                self.get_adaptive_difficulty(data, callback_id)
            elif action == 'update_adaptive_performance':
                self.update_adaptive_performance(data, callback_id)
            elif action == 'get_adaptive_recommendations':
                self.get_adaptive_recommendations(callback_id)
            elif action == 'get_learning_path':
                self.get_learning_path(data, callback_id)
            elif action == 'get_adaptive_insights':
                self.get_adaptive_insights(callback_id)
            elif action == 'get_active_session':
                self.get_active_session(callback_id)
            elif action == 'end_session':
                self.end_session(data, callback_id)
            elif action == 'get_stats':
                self.get_stats(callback_id)
            elif action == 'play_sound':
                self.play_sound(data)
            elif action == 'log_attempt':
                self.log_attempt(data, callback_id)
            elif action == 'get_adaptive_recommendations_summary':
                self.get_adaptive_recommendations_summary(callback_id)
            elif action == 'export_adaptive_data':
                self.export_adaptive_data(callback_id)
            elif action == 'get_storage_stats':
                self.get_storage_stats(callback_id)
            elif action == 'export_data':
                self.export_user_data(data, callback_id)
            elif action == 'import_data':
                self.import_user_data(data, callback_id)
            elif action == 'get_settings':
                self.get_settings(callback_id)
            elif action == 'save_settings':
                self.save_settings(data, callback_id)
            elif action == 'get_achievements':
                self.get_achievements(callback_id)
            elif action == 'get_daily_goals':
                self.get_daily_goals(callback_id)
            elif action == 'set_daily_goals':
                self.set_daily_goals(data, callback_id)
        except Exception as e:
            print(f"Error handling action {action}: {e}")
    
    def reset_session(self, data, callback_id=None):
        """Handle session reset"""
        # Clear local bridge session ID
        if hasattr(self, 'current_session_id'):
            self.current_session_id = None
            
        if hasattr(self.parent_dialog, 'reset_session'):
            self.parent_dialog.reset_session()
            
        if callback_id:
            self.send_to_js('reset_session_result', {'success': True}, callback_id)
    
    def log_attempt(self, data, callback_id=None):
        """Log a practice attempt with adaptive learning integration"""
        print(f"=== Python log_attempt called ===")
        print(f"Received data: {data}")
        print(f"Data directory being used: {os.path.dirname(__file__)}")
        
        try:
            operation = data.get('operation')
            digits = data.get('digits')
            correct = data.get('correct')
            time_taken = data.get('time') or data.get('time_taken')
            session_id = getattr(self, 'current_session_id', None)
            question_text = data.get('question_text')
            user_answer = data.get('user_answer')
            correct_answer = data.get('correct_answer')
            
            print(f"Parsed: operation={operation}, digits={digits}, correct={correct}, time_taken={time_taken}, session_id={session_id}")
            
            # Update level session stats if this is a level session
            if hasattr(self.parent_dialog, 'session_stats') and self.parent_dialog.session_stats.get('level_id'):
                self.parent_dialog.session_stats['questions_answered'] += 1
                if correct:
                    self.parent_dialog.session_stats['correct_answers'] += 1
                self.parent_dialog.session_stats['total_time'] += time_taken
                
                # Calculate current accuracy
                accuracy = (self.parent_dialog.session_stats['correct_answers'] / 
                           self.parent_dialog.session_stats['questions_answered']) * 100
                
                # Update level progress page if it's active
                if hasattr(self.parent_dialog, 'current_page') and self.parent_dialog.current_page == "level_progress":
                    progress_script = f"""
                    if (window.updateProgress) {{
                        updateProgress({self.parent_dialog.session_stats['questions_answered']}, 
                                     {self.parent_dialog.session_stats['total_time']});
                    }}
                    """
                    self.parent_dialog.web_view.page().runJavaScript(progress_script)
            
            # Test database API connection
            try:
                print("Testing database API connection...")
                test_count = db_api.get_basic_stats()
                print(f"Database API test successful: {test_count}")
            except Exception as db_test_e:
                print(f"❌ Database API test failed: {db_test_e}")
                return
            
            # Log to database
            print("Attempting to create attempt in database...")
            attempt_id = db_api.create_attempt(
                operation=operation,
                digits=digits,
                correct=correct,
                time_taken=time_taken,
                session_id=session_id,
                question_text=question_text,
                user_answer=user_answer,
                correct_answer=correct_answer
            )
            
            print(f"Attempt created with ID: {attempt_id}")
            
            if attempt_id > 0:
                print("✅ Successfully logged attempt to database")
            else:
                print("❌ Failed to log attempt - returned ID 0")
            
            # Update adaptive learning system
            try:
                print("Updating adaptive learning...")
                self.adaptive_learning.update_adaptive_performance(
                    operation, digits, correct, time_taken
                )
                print("✅ Adaptive learning updated")
            except Exception as e:
                print(f"❌ Error updating adaptive performance: {e}")
            
            # Update weakness tracking
            try:
                print("Updating weakness tracking...")
                update_weakness_tracking(operation, digits, correct)
                print("✅ Weakness tracking updated")
            except Exception as e:
                print(f"❌ Error updating weakness tracking: {e}")
            
            # Update daily goals
            try:
                print("Updating daily progress...")
                db_api.update_daily_progress(questions_completed=1, time_spent_minutes=time_taken/60)
                print("✅ Daily progress updated")
            except Exception as e:
                print(f"❌ Error updating daily progress: {e}")
            
            # Trigger real-time sync
            try:
                print("Triggering real-time sync...")
                self._trigger_realtime_sync('attempt_logged', {
                    'operation': operation,
                    'digits': digits,
                    'correct': correct,
                    'time_taken': time_taken
                })
                print("✅ Real-time sync triggered")
            except Exception as e:
                print(f"❌ Error triggering real-time sync: {e}")
            
            print("✅ All logging operations completed successfully")
            if callback_id:
                self.send_to_js('log_attempt_result', {'status': 'success'}, callback_id)
            
        except Exception as e:
            print(f"❌ Critical error logging attempt: {e}")
            import traceback
            traceback.print_exc()
    
    def start_session(self, data, callback_id):
        """Handle session start"""
        if hasattr(self.parent_dialog, 'start_session'):
            self.parent_dialog.start_session(data['mode'], data['operation'], data['digits'])
            # Create and store session ID
            session_id = db_api.create_session(
                mode=data['mode'], 
                operation=data['operation'], 
                digits=data['digits'],
                target_value=data.get('target_value', 0)
            )
            self.current_session_id = session_id
            
            # If this is a Level session, store the level ID and criteria in the parent
            if data.get('mode') == 'Level':
                if hasattr(self.parent_dialog, 'active_level_id'):
                    self.parent_dialog.active_level_id = data.get('level_id')
                    print(f"Started Level Session: {self.parent_dialog.active_level_id}")
                
                # Initialize session stats for level tracking
                if hasattr(self.parent_dialog, 'session_stats'):
                    self.parent_dialog.session_stats = {
                        'level_id': data.get('level_id'),
                        'questions_answered': 0,
                        'correct_answers': 0,
                        'total_time': 0,
                        'start_time': time.time(),
                        'criteria': data.get('criteria', {})
                    }
                else:
                    # Add session_stats attribute if it doesn't exist
                    setattr(self.parent_dialog, 'session_stats', {
                        'level_id': data.get('level_id'),
                        'questions_answered': 0,
                        'correct_answers': 0,
                        'total_time': 0,
                        'start_time': time.time(),
                        'criteria': data.get('criteria', {})
                    })
            
            self.send_to_js('start_session_result', {'success': True, 'session_id': session_id}, callback_id)

    def get_active_session(self, callback_id):
        """Get current active session details if any"""
        if hasattr(self, 'current_session_id') and self.current_session_id:
            session_data = db_api.get_session_stats(self.current_session_id)
            if session_data:
                # Add level_id if available
                if hasattr(self.parent_dialog, 'active_level_id'):
                    session_data['level_id'] = self.parent_dialog.active_level_id
                
                self.send_to_js('active_session_result', {'active': True, 'session': session_data}, callback_id)
                return
        
        self.send_to_js('active_session_result', {'active': False}, callback_id)
    
    def end_session(self, data, callback_id):
        """Handle session end and return results"""
        # Always use MathDrillWebEngine's end_session for unified logic
        if hasattr(self.parent_dialog, 'end_session'):
            result = self.parent_dialog.end_session(data)
            self.send_to_js('end_session_result', result, callback_id)
        else:
            self.send_to_js('end_session_result', {'success': False, 'error': 'Parent dialog end_session not found'}, callback_id)
    
    def play_sound(self, data):
        """Play sound effect"""
        if hasattr(self.parent_dialog, 'play_sound'):
            self.parent_dialog.play_sound(data['success'])
    
    def get_stats(self, callback_id):
        """Get current statistics using enhanced API"""
        try:
            session_count = len(getattr(self.parent_dialog, 'session_attempts', []))
            
            # Get comprehensive stats from database API
            stats_data = db_api.get_comprehensive_stats('today')
            basic_stats = stats_data['basic_stats']
            
            # Get daily goal status
            daily_goals = db_api.get_daily_goal_status()
            
            stats = {
                'session': session_count,
                'today': basic_stats['total_attempts'],
                'lifetime': basic_stats['total_attempts'],  # Will be updated with all-time stats
                'accuracy': (basic_stats['total_correct'] / basic_stats['total_attempts'] * 100) if basic_stats['total_attempts'] > 0 else 0,
                'avgSpeed': basic_stats['avg_time'] or 0,
                'totalTime': basic_stats['total_attempts'] * (basic_stats['avg_time'] or 0),
                'daily_goals': daily_goals,
                'practice_days': basic_stats['practice_days']
            }
            
            # Get lifetime stats separately
            lifetime_stats = db_api.get_comprehensive_stats('all')
            stats['lifetime'] = lifetime_stats['basic_stats']['total_attempts']
            
            self.send_to_js('stats_result', stats, callback_id)
        except Exception as e:
            print(f"Error getting stats: {e}")
            self.send_to_js('stats_result', {}, callback_id)
    
    def get_settings(self, callback_id):
        """Get current settings"""
        settings = self.settings_manager.get_all()
        # Ensure backward compatibility for soundEnabled
        settings['soundEnabled'] = settings.get('sound', True)
        self.send_to_js('settings_result', settings, callback_id)

    def save_settings(self, data, callback_id):
        """Save settings from frontend"""
        try:
            settings_dict = data if isinstance(data, dict) else json.loads(data)
            success = self.settings_manager.save_settings(settings_dict)
            self.send_to_js('save_settings_result', {'success': success}, callback_id)
        except Exception as e:
            print(f"Error saving settings: {e}")
            self.send_to_js('save_settings_result', {'success': False, 'error': str(e)}, callback_id)
    
    def toggle_sound(self, callback_id):
        """Toggle sound settings"""
        self.settings_manager.sound_enabled = not self.settings_manager.sound_enabled
        settings = self.settings_manager.get_all()
        settings['soundEnabled'] = self.settings_manager.sound_enabled
        self.send_to_js('settings_result', settings, callback_id)
    
    def get_achievements(self, callback_id):
        """Get achievements data"""
        try:
            badges = self.achievements.get_all_badges_status()
            achievements_data = []
            
            for badge in badges:
                achievements_data.append({
                    'name': badge['name'],
                    'desc': badge['desc'],
                    'unlocked': badge['unlocked']
                })
            
            self.send_to_js('achievements_result', achievements_data, callback_id)
        except Exception as e:
            print(f"Error getting achievements: {e}")
            self.send_to_js('achievements_result', [], callback_id)
    
    def get_weakness(self, callback_id):
        """Get weakness analysis data using enhanced API"""
        try:
            weaknesses = db_api.get_weakness_analysis()
            
            # Transform data for frontend compatibility
            weakness_data = []
            for weakness in weaknesses:
                weakness_data.append({
                    'operation': weakness['operation'],
                    'digits': weakness['digits'],
                    'level': weakness['mastery_level'],
                    'accuracy': (weakness['recent_correct'] / weakness['recent_attempts'] * 100) if weakness['recent_attempts'] > 0 else 0,
                    'speed': weakness['recent_avg_time'],
                    'weaknessScore': weakness['weakness_score'],
                    'practiced': True,
                    'suggestions': self._generate_weakness_suggestions(weakness)
                })
            
            self.send_to_js('weakness_result', weakness_data, callback_id)
        except Exception as e:
            print(f"Error getting weakness data: {e}")
            self.send_to_js('weakness_result', [], callback_id)
    
    def get_mastery(self, callback_id):
        """Get mastery grid data"""
        try:
            data = self.coach.get_mastery_grid_data()
            mastery_data = {}
            
            for (op, digits), stats in data.items():
                key = f"{op}-{digits}"
                mastery_data[key] = {
                    'level': stats['level'],
                    'acc': stats['acc'],
                    'speed': stats['speed'],
                    'count': stats['count']
                }
            
            self.send_to_js('mastery_result', mastery_data, callback_id)
        except Exception as e:
            print(f"Error getting mastery data: {e}")
            self.send_to_js('mastery_result', {}, callback_id)
    
    def get_coach_recommendation(self, callback_id):
        """Get coach recommendation"""
        try:
            if hasattr(self.parent_dialog, 'current_focus_area') and hasattr(self.parent_dialog, 'focus_session_count'):
                current_focus = self.parent_dialog.current_focus_area
                focus_count = self.parent_dialog.focus_session_count
                
                if current_focus and self.coach.should_continue_focus(current_focus[0], current_focus[1]):
                    target = current_focus
                    reason = f"CONTINUE FOCUS: {target[0]} ({target[1]} digits) - {focus_count + 1} questions"
                else:
                    target, reason = self.coach.get_recommendation()
                    self.parent_dialog.current_focus_area = target
                    self.parent_dialog.focus_session_count = 0
            else:
                target, reason = self.coach.get_recommendation()
            
            result = {
                'target': target,
                'reason': reason
            }
            
            self.send_to_js('coach_result', result, callback_id)
        except Exception as e:
            print(f"Error getting coach recommendation: {e}")
            self.send_to_js('coach_result', {}, callback_id)
    
    def _handle_progress_data_ready(self, data, callback_id):
        """Handle progress data generated from background thread."""
        # This is now only called by the background worker. callback_id will be None.
        
        # PUSH the newly generated fast data to the frontend.
        print("Pushing newly generated fast data to frontend.")
        if hasattr(self.parent_dialog, 'web_view') and self.parent_dialog.web_view:
            update_script = f"""
                if (window.progressPage && window.progressPage.updateFastData) {{
                    window.progressPage.updateFastData({json.dumps(data)});
                }}
            """
            self.parent_dialog.web_view.page().runJavaScript(update_script)

        # Now, trigger the heavy data update in the background.
        QTimer.singleShot(100, lambda: self._update_progress_data())

    def get_progress_data_instant(self, data, callback_id):
        """Get progress data"""
        try:
            period = data.get('period', 'week')
            
            print("Generating fresh progress data...")
            streak = getattr(self.parent_dialog, 'streak', 0)
            
            # Generate fresh data in a background thread
            threading.Thread(
                target=self._generate_progress_worker,
                args=(period, streak, callback_id),
                daemon=True
            ).start()
            
            # Send immediate empty response to prevent JS timeout
            if callback_id:
                self.send_to_js('progress_data_result', {}, callback_id)
            
        except Exception as e:
            print(f"Error in instant progress data: {e}")
            self.send_to_js('progress_data_result', {}, callback_id)
    
    def _generate_progress_worker(self, period, streak, callback_id):
        """Worker method to run in background thread"""
        try:
            data = self._generate_fast_progress_data_static(period, streak)
            # The callback_id passed here will be None.
            self.progress_data_ready.emit(data, None)
        except Exception as e:
            print(f"Error in progress worker: {e}")
            # Send empty data on error to stop loading spinner
            self.progress_data_ready.emit({}, None)

    @staticmethod
    def _generate_fast_progress_data_static(period, streak):
        """Static method to generate progress data using enhanced database API"""
        try:
            from .database_api import db_api
        except ImportError:
            from database_api import db_api
        from datetime import date, datetime, timedelta
        
        try:
            # Get comprehensive stats using enhanced API
            if period == 'week':
                stats_data = db_api.get_comprehensive_stats('week')
            elif period == 'month':
                stats_data = db_api.get_comprehensive_stats('month')
            else:  # year or any other period
                stats_data = db_api.get_comprehensive_stats('all')
            basic_stats = stats_data['basic_stats']
            recent_activity = stats_data['recent_activity']
            
            # Get performance trends for charts
            trends_data = db_api.get_performance_trends(days=7)
            daily_data = trends_data
            
            # Prepare chart data from real daily performance
            chart_data = []
            today = date.today()
            
            # Create chart data for last 7 days
            for i in range(6, -1, -1):
                chart_date = today - timedelta(days=i)
                date_str = chart_date.isoformat()
                
                # Find matching daily data
                day_data = next((d for d in daily_data if d['date'] == date_str), None)
                
                if day_data and day_data['attempts'] > 0:
                    chart_data.append({
                        'label': chart_date.strftime('%a'),
                        'accuracy': day_data['accuracy'],
                        'speed': day_data['avg_time'],
                        'questions': day_data['attempts']
                    })
                else:
                    chart_data.append({
                        'label': chart_date.strftime('%a'),
                        'accuracy': 0,
                        'speed': 0,
                        'questions': 0
                    })
            
            # Prepare recent activity data
            recent_activity_formatted = []
            # Take more days for month/year views
            days_to_show = 30 if period == 'week' else 90  # 30 days for week, 90 for month/year
            for activity in recent_activity[:days_to_show]:
                if activity['questions'] > 0:
                    created_date = datetime.strptime(activity['date'], '%Y-%m-%d').date()
                    delta = today - created_date
                    if delta.days == 0:
                        time_ago = "Today"
                    elif delta.days == 1:
                        time_ago = "Yesterday"
                    else:
                        time_ago = f"{delta.days} days ago"

                    recent_activity_formatted.append({
                        'date': activity['date'],
                        'timeAgo': time_ago,
                        'questions': activity['questions'],
                        'accuracy': activity['correct'] / activity['questions'] * 100 if activity['questions'] > 0 else 0,
                        'avgSpeed': activity['avg_time'] or 0
                    })
            
            # Get additional analytical data
            learning_velocity = get_learning_velocity(days=30)
            adaptive_insights = db_api.get_adaptive_insights()
            goal_history = db_api.get_goal_history(days=30)
            
            # Fast progress data with real statistics
            progress_data = {
                'stats': {
                    'totalQuestions': basic_stats['total_attempts'],
                    'avgAccuracy': (basic_stats['total_correct'] / basic_stats['total_attempts'] * 100) if basic_stats['total_attempts'] > 0 else 0,
                    'avgSpeed': basic_stats['avg_time'] or 0,
                    'currentStreak': streak,
                    'practiceDays': basic_stats['practice_days']
                },
                'chartData': chart_data,
                'recentActivity': list(reversed(recent_activity_formatted)),
                'mastery': {},  # Will be filled by background update
                'weaknesses': [],  # Will be filled by background update
                'achievements': [],  # Will be filled by background update
                'personalBests': {},  # Will be filled by background update
                'operationBreakdown': stats_data['operation_breakdown'],
                'difficultyProgression': stats_data['difficulty_progression'],
                'learningVelocity': learning_velocity,
                'adaptiveInsights': adaptive_insights,
                'goalHistory': goal_history
            }
            
            print(f"Real progress data generated: {basic_stats['total_attempts']} total, {(basic_stats['total_correct'] / basic_stats['total_attempts'] * 100) if basic_stats['total_attempts'] > 0 else 0:.1f}% accuracy")
            return progress_data
            
        except Exception as e:
            print(f"Error generating real progress data: {e}")
            # Fallback to basic implementation
            return PythonBridge._generate_fallback_progress_data(period, streak)
    
    @staticmethod
    def _generate_fallback_progress_data(period, streak):
        """Fallback method using JSON storage"""
        try:
            from . import json_storage
        except ImportError:
            import json_storage
        from datetime import date, datetime, timedelta
        
        try:
            # Get basic stats quickly
            attempts = json_storage._load_json_file(json_storage.ATTEMPTS_FILE, [])
            lifetime_count = len(attempts)
            
            today_str = date.today().isoformat()
            today_count = len([a for a in attempts if a.get('created') == today_str])
            
            # Get overall stats
            total = len(attempts)
            correct = sum(1 for a in attempts if a.get('correct', False))
            total_time_db = sum(a.get('time_taken', 0) or 0 for a in attempts)
            
            accuracy = (correct / total) * 100 if total and total > 0 else 0
            avg_speed = total_time_db / total if total and total > 0 else 0
            
            # Get recent activity (last 7 days)
            seven_days_ago = (date.today() - timedelta(days=6)).isoformat()
            recent_attempts = [a for a in attempts if a.get('created', '') >= seven_days_ago]
            
            # Group by date
            daily_stats = {}
            for attempt in recent_attempts:
                created = attempt.get('created', '')
                if created not in daily_stats:
                    daily_stats[created] = {'count': 0, 'correct': 0, 'time_sum': 0}
                daily_stats[created]['count'] += 1
                if attempt.get('correct', False):
                    daily_stats[created]['correct'] += 1
                daily_stats[created]['time_sum'] += attempt.get('time_taken', 0) or 0
            
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
                    'totalQuestions': lifetime_count,
                    'avgAccuracy': accuracy,
                    'avgSpeed': avg_speed,
                    'currentStreak': streak
                },
                'chartData': chart_data,
                'recentActivity': list(reversed(recent_activity)),
                'mastery': {},  # Will be filled by background update
                'weaknesses': [],  # Will be filled by background update
                'achievements': [],  # Will be filled by background update
                'personalBests': {}  # Will be filled by background update
            }
            
            print(f"Fallback progress data generated: {lifetime_count} total, {accuracy:.1f}% accuracy")
            return progress_data
            
        except Exception as e:
            print(f"Error in fallback progress data generation: {e}")
            # Return minimal data structure
            return {
                'stats': {
                    'totalQuestions': 0,
                    'avgAccuracy': 0,
                    'avgSpeed': 0,
                    'currentStreak': streak
                },
                'chartData': [],
                'recentActivity': [],
                'mastery': {},
                'weaknesses': [],
                'achievements': [],
                'personalBests': {}
            }
    
    def _update_progress_data(self):
        """Update progress data with heavy data components in background"""
        try:
            print("Updating progress data with heavy data components...")
            
            # Get mastery data using enhanced API
            mastery = {}
            try:
                # Get comprehensive stats for mastery calculation
                stats_data = db_api.get_comprehensive_stats('all')
                operation_breakdown = stats_data['operation_breakdown']
                difficulty_progression = stats_data['difficulty_progression']
                
                # Create mastery grid from real data
                operations = ['Addition', 'Subtraction', 'Multiplication', 'Division']
                digits = [1, 2, 3]
                
                for op in operations:
                    for digit in digits:
                        # Find matching data from operation breakdown
                        op_data = next((d for d in operation_breakdown if d['operation'] == op), None)
                        digit_data = next((d for d in difficulty_progression if d['digits'] == digit), None)
                        
                        if op_data and digit_data:
                            # Calculate mastery level based on performance
                            accuracy = (op_data['correct'] / op_data['count'] * 100) if op_data['count'] > 0 else 0
                            avg_time = op_data['avg_time'] or 0
                            total_count = op_data['count']
                            
                            # Determine mastery level
                            if accuracy >= 90 and avg_time < 3.0:
                                level = 'Master'
                            elif accuracy >= 80 and avg_time < 5.0:
                                level = 'Pro'
                            elif accuracy >= 70:
                                level = 'Apprentice'
                            else:
                                level = 'Novice'
                            
                            key = f"{op}-{digit}"
                            mastery[key] = {
                                'level': level,
                                'acc': accuracy,
                                'speed': avg_time,
                                'count': total_count
                            }
                        else:
                            # No data for this combination
                            key = f"{op}-{digit}"
                            mastery[key] = {
                                'level': 'Novice',
                                'acc': 0,
                                'speed': 0,
                                'count': 0
                            }
            except Exception as e:
                print(f"Error generating mastery data: {e}")
                pass
            
            # Get weakness data using enhanced API
            weaknesses = []
            try:
                weakness_data = db_api.get_weakness_analysis()
                for weakness in weakness_data:
                    weaknesses.append({
                        'operation': weakness['operation'],
                        'digits': weakness['digits'],
                        'level': weakness['mastery_level'],
                        'accuracy': (weakness['recent_correct'] / weakness['recent_attempts'] * 100) if weakness['recent_attempts'] > 0 else 0,
                        'speed': weakness['recent_avg_time'],
                        'weaknessScore': weakness['weakness_score'],
                        'practiced': weakness['total_attempts'] > 0,
                        'suggestions': self._generate_weakness_suggestions(weakness)
                    })
            except Exception as e:
                print(f"Error getting weakness data: {e}")
                pass
            
            # Get achievements using enhanced API
            achievements = []
            try:
                achievement_data = db_api.get_achievements()
                for achievement in achievement_data:
                    achievements.append({
                        'name': achievement['name'],
                        'desc': achievement.get('description', 'Achievement unlocked!'),
                        'unlocked': True,
                        'progress': 100
                    })
            except Exception as e:
                print(f"Error getting achievements: {e}")
                pass
            
            # Get personal bests using enhanced API
            personal_bests = {}
            try:
                # Get best drill times
                stats_data = db_api.get_comprehensive_stats('all')
                
                # Calculate personal bests from real data
                if stats_data['basic_stats']['total_attempts'] > 0:
                    personal_bests['accuracy'] = (stats_data['basic_stats']['total_correct'] / stats_data['basic_stats']['total_attempts'] * 100)
                    personal_bests['speed'] = stats_data['basic_stats']['avg_time'] or 0
                
                # Get session-based personal bests
                try:
                    from .database import get_personal_best
                except ImportError:
                    from database import get_personal_best
                drill_best = get_personal_best('Drill (20 Qs)', 'Mixed', 2)
                sprint_best = get_personal_best('Sprint (60s)', 'Mixed', 2)
                
                if drill_best:
                    personal_bests['drill'] = drill_best
                if sprint_best:
                    personal_bests['sprint'] = sprint_best
                    
            except Exception as e:
                print(f"Error getting personal bests: {e}")
                pass
            
            # Prepare progress data with heavy data
            progress_data = {
                'mastery': mastery,
                'weaknesses': weaknesses,
                'achievements': achievements,
                'personalBests': personal_bests
            }
            
            print("Progress data updated with heavy data components")
            
            # Notify JavaScript about the update
            if hasattr(self.parent_dialog, 'web_view') and self.parent_dialog.web_view:
                update_script = f"if(window.progressPage && window.progressPage.updateHeavyData) {{ window.progressPage.updateHeavyData({json.dumps(progress_data)}); }}"
                self.parent_dialog.web_view.page().runJavaScript(update_script)
                
        except Exception as e:
            print(f"Error updating progress data with heavy data: {e}")
    
    def open_progress_page(self):
        """Open the progress page in a new window"""
        print(f"PythonBridge.open_progress_page called, parent_dialog: {self.parent_dialog}")
        if hasattr(self.parent_dialog, 'open_progress_page'):
            print("Calling parent_dialog.open_progress_page()")
            self.parent_dialog.open_progress_page()
        else:
            print("parent_dialog does not have open_progress_page method")
    
    def navigate_to_progress(self):
        """Navigate to progress page in the same window"""
        print(f"PythonBridge.navigate_to_progress called, parent_dialog: {self.parent_dialog}")
        if hasattr(self.parent_dialog, 'navigate_to_progress'):
            print("Calling parent_dialog.navigate_to_progress()")
            self.parent_dialog.navigate_to_progress()
        else:
            print("parent_dialog does not have navigate_to_progress method")
    
    def navigate_to_main(self):
        """Navigate back to main page in the same window"""
        print(f"PythonBridge.navigate_to_main called, parent_dialog: {self.parent_dialog}")
        if hasattr(self.parent_dialog, 'navigate_to_main'):
            print("Calling parent_dialog.navigate_to_main()")
            self.parent_dialog.navigate_to_main()
        else:
            print("parent_dialog does not have navigate_to_main method")
    
    def send_to_js(self, action, data, callback_id):
        """Send data back to JavaScript"""
        print(f"send_to_js called: action={action}, callback_id={callback_id}")
        print(f"Data type: {type(data)}, size: {len(str(data)) if data else 0}")
        
        if hasattr(self.parent_dialog, 'web_view') and self.parent_dialog.web_view:
            # Log the actual data being sent
            import json
            try:
                data_json = json.dumps(data, indent=2, ensure_ascii=False)
                print(f"Data being sent to JavaScript:\n{data_json}")
            except (TypeError, ValueError) as e:
                print(f"Error serializing data: {e}")
                data_json = str(data)
            
            # Create a script that directly executes the callback
            script = f'''
                (function() {{
                    console.log('Python bridge script executing for callback: {callback_id}');
                    console.log('Checking pythonBridge availability:', typeof window.pythonBridge);
                    
                    if (window.pythonBridge && window.pythonBridge.callbacks && window.pythonBridge.callbacks['{callback_id}']) {{
                        console.log('Executing callback directly for:', '{callback_id}');
                        
                        try {{
                            var data = {data_json};
                            var callback = window.pythonBridge.callbacks['{callback_id}'];
                            console.log('Calling callback with data:', data);
                            callback(data);
                            console.log('Callback executed successfully');
                            
                            // Clean up
                            delete window.pythonBridge.callbacks['{callback_id}'];
                        }} catch(e) {{
                            console.error('Error executing callback:', e);
                        }}
                    }} else {{
                        console.error('Callback not found for:', '{callback_id}');
                        console.log('Available callbacks:', window.pythonBridge ? Object.keys(window.pythonBridge.callbacks || {{}}) : 'pythonBridge not available');
                    }}
                }})();
            '''
            
            print("Executing JavaScript in web view...")
            self.parent_dialog.web_view.page().runJavaScript(script)
        else:
            print("No web_view available in parent_dialog")
    
    def _generate_weakness_suggestions(self, weakness):
        """Generate practice suggestions based on weakness analysis"""
        suggestions = []
        
        if weakness['weakness_score'] > 70:
            suggestions.append("Focus on basic fundamentals")
            suggestions.append("Practice with easier problems first")
        elif weakness['weakness_score'] > 40:
            suggestions.append("Mixed practice with review")
            suggestions.append("Try timed practice sessions")
        else:
            suggestions.append("Challenge yourself with harder problems")
            suggestions.append("Focus on speed improvement")
        
        return suggestions
    
    def _trigger_realtime_sync(self, event_type, data):
        """Trigger real-time synchronization to all subscribers"""
        sync_data = {
            'event_type': event_type,
            'data': data,
            'timestamp': datetime.now().isoformat()
        }
        
        self._last_sync_data = sync_data
        
        # Send to all subscribers
        if hasattr(self.parent_dialog, 'web_view') and self.parent_dialog.web_view:
            script = f"""
                if (window.realtimeManager && window.realtimeManager.handleSync) {{
                    window.realtimeManager.handleSync({json.dumps(sync_data)});
                }}
            """
            self.parent_dialog.web_view.page().runJavaScript(script)
    
    def subscribe_realtime(self, data, callback_id):
        """Subscribe to real-time updates"""
        try:
            subscriber_id = data.get('subscriber_id', 'default')
            self._sync_subscribers.add(subscriber_id)
            
            print(f"Subscribing to realtime: subscriber_id={subscriber_id}, callback_id={callback_id}")
            
            # Send current state immediately
            response_data = {
                'subscriber_id': subscriber_id,
                'last_data': self._last_sync_data
            }
            
            print(f"Sending subscription response: {response_data}")
            self.send_to_js('realtime_subscribed', response_data, callback_id)
            return True
            
        except Exception as e:
            print(f"Error subscribing to realtime: {e}")
            self.send_to_js('realtime_subscribed', {'error': str(e)}, callback_id)
            return False
    
    def unsubscribe_realtime(self, callback_id):
        """Unsubscribe from real-time updates"""
        try:
            # Clear all subscribers (simplified for single-page app)
            self._sync_subscribers.clear()
            self.send_to_js('realtime_unsubscribed', {}, callback_id)
        except Exception as e:
            print(f"Error unsubscribing from realtime: {e}")
    
    def get_daily_goals(self, callback_id):
        """Get daily goals status"""
        try:
            daily_goals = db_api.get_daily_goal_status()
            goal_history = db_api.get_goal_history(days=7)
            
            result = {
                'current': daily_goals,
                'history': goal_history
            }
            
            self.send_to_js('daily_goals_result', result, callback_id)
        except Exception as e:
            print(f"Error getting daily goals: {e}")
            self.send_to_js('daily_goals_result', {}, callback_id)
    
    def set_daily_goals(self, data, callback_id):
        """Set daily goals"""
        try:
            target_questions = data.get('target_questions', 20)
            target_time_minutes = data.get('target_time_minutes', 10)
            
            db_api.set_daily_goal(target_questions, target_time_minutes)
            
            # Get updated status
            daily_goals = db_api.get_daily_goal_status()
            
            self.send_to_js('daily_goals_set', daily_goals, callback_id)
        except Exception as e:
            print(f"Error setting daily goals: {e}")
            self.send_to_js('daily_goals_set', {}, callback_id)
    
    def export_user_data(self, data, callback_id):
        """Export user data for backup"""
        try:
            include_attempts = data.get('include_attempts', True)
            include_sessions = data.get('include_sessions', True)
            
            export_data = db_api.export_data(include_attempts, include_sessions)
            
            self.send_to_js('export_data_result', export_data, callback_id)
        except Exception as e:
            print(f"Error exporting data: {e}")
            self.send_to_js('export_data_result', {'error': str(e)}, callback_id)

    def import_user_data(self, data, callback_id):
        """Import user data from backup"""
        try:
            import_data = data.get('data', {})
            merge = data.get('merge', True)
            
            success = db_api.import_data(import_data, merge)
            
            if success:
                # Trigger real-time sync
                self._trigger_realtime_sync('data_imported', {
                    'merge': merge,
                    'timestamp': datetime.now().isoformat()
                })
            
            self.send_to_js('import_data_result', {'success': success}, callback_id)
        except Exception as e:
            print(f"Error importing data: {e}")
            self.send_to_js('import_data_result', {'success': False, 'error': str(e)}, callback_id)
    
    # === Navigation Methods ===
    def navigate_to_main(self, callback_id=None):
        """Navigate back to main page"""
        if hasattr(self.parent_dialog, 'navigate_to_main'):
            self.parent_dialog.navigate_to_main()
            if callback_id:
                self.send_to_js('navigation_result', {'success': True}, callback_id)
        elif callback_id:
            self.send_to_js('navigation_result', {'success': False}, callback_id)

    def navigate_to_levels(self, callback_id=None):
        """Navigate to levels page"""
        if hasattr(self.parent_dialog, 'navigate_to_levels'):
            self.parent_dialog.navigate_to_levels()
            if callback_id:
                self.send_to_js('navigation_result', {'success': True}, callback_id)
        elif callback_id:
            self.send_to_js('navigation_result', {'success': False}, callback_id)

    def navigate_to_level_progress(self, callback_id=None):
        """Navigate to level progress page"""
        if hasattr(self.parent_dialog, 'navigate_to_level_progress'):
            self.parent_dialog.navigate_to_level_progress()
            if callback_id:
                self.send_to_js('navigation_result', {'success': True}, callback_id)
        elif callback_id:
            self.send_to_js('navigation_result', {'success': False}, callback_id)

    def navigate_to_level_complete(self, callback_id=None):
        """Navigate to level completion page"""
        if hasattr(self.parent_dialog, 'navigate_to_level_complete'):
            self.parent_dialog.navigate_to_level_complete()
            if callback_id:
                self.send_to_js('navigation_result', {'success': True}, callback_id)
        elif callback_id:
            self.send_to_js('navigation_result', {'success': False}, callback_id)

    def navigate_to_progress(self, callback_id=None):
        """Navigate to progress page"""
        if hasattr(self.parent_dialog, 'navigate_to_progress'):
            self.parent_dialog.navigate_to_progress()
            if callback_id:
                self.send_to_js('navigation_result', {'success': True}, callback_id)
        elif callback_id:
            self.send_to_js('navigation_result', {'success': False}, callback_id)

    def get_adaptive_insights(self, callback_id):
        """Get comprehensive adaptive insights"""
        try:
            from .adaptive_analytics import adaptive_analytics
            insights = adaptive_analytics.get_comprehensive_adaptive_report()
            self.send_to_js('adaptive_insights_result', insights, callback_id)
        except Exception as e:
            print(f"Error getting adaptive insights: {e}")
            self.send_to_js('adaptive_insights_result', {}, callback_id)

    def get_adaptive_report(self, callback_id):
        """Get detailed adaptive report"""
        try:
            from .adaptive_analytics import adaptive_analytics
            report = adaptive_analytics.get_comprehensive_adaptive_report()
            self.send_to_js('adaptive_report_result', report, callback_id)
        except Exception as e:
            print(f"Error getting adaptive report: {e}")
            self.send_to_js('adaptive_report_result', {}, callback_id)

    def get_adaptive_recommendations_summary(self, callback_id):
        """Get summary of adaptive recommendations"""
        try:
            from .adaptive_analytics import adaptive_analytics
            summary = adaptive_analytics.get_adaptive_recommendations_summary()
            self.send_to_js('adaptive_recommendations_summary_result', summary, callback_id)
        except Exception as e:
            print(f"Error getting adaptive recommendations summary: {e}")
            self.send_to_js('adaptive_recommendations_summary_result', {}, callback_id)

    def export_adaptive_data(self, callback_id):
        """Export adaptive learning data"""
        try:
            from .adaptive_analytics import adaptive_analytics
            export_data = adaptive_analytics.export_adaptive_data()
            self.send_to_js('export_adaptive_data_result', export_data, callback_id)
        except Exception as e:
            print(f"Error exporting adaptive data: {e}")
            self.send_to_js('export_adaptive_data_result', {}, callback_id)

    # === Level System Methods ===
    def get_levels(self, callback_id):
        """Get all levels with progress"""
        try:
            levels = db_api.get_all_levels()
            self.send_to_js('levels_result', levels, callback_id)
        except Exception as e:
            print(f"Error getting levels: {e}")
            self.send_to_js('levels_result', [], callback_id)

    def get_level_details(self, data, callback_id):
        """Get details for a specific level"""
        try:
            level_id = data.get('level_id')
            level = db_api.get_level_details(level_id)
            self.send_to_js('level_details_result', level, callback_id)
        except Exception as e:
            print(f"Error getting level details: {e}")
            self.send_to_js('level_details_result', {}, callback_id)

    def complete_level(self, data, callback_id):
        """Complete a level attempt"""
        try:
            level_id = data.get('level_id')
            session_stats = data.get('stats')
            result = db_api.complete_level(level_id, session_stats)
            self.send_to_js('level_complete_result', result, callback_id)
        except Exception as e:
            print(f"Error completing level: {e}")
            self.send_to_js('level_complete_result', {'success': False, 'message': str(e)}, callback_id)

    def get_current_level(self, callback_id):
        """Get current level data for progress page"""
        try:
            # Get the active level from the parent dialog
            if hasattr(self.parent_dialog, 'active_level_id'):
                level_id = self.parent_dialog.active_level_id
                level = db_api.get_level_details(level_id)
                self.send_to_js('current_level_result', level, callback_id)
            else:
                self.send_to_js('current_level_result', {}, callback_id)
        except Exception as e:
            print(f"Error getting current level: {e}")
            self.send_to_js('current_level_result', {}, callback_id)

    def get_level_question(self, callback_id):
        """Generate a question for the current level session"""
        try:
            # Get the active level session data
            if hasattr(self.parent_dialog, 'active_level_id') and hasattr(self.parent_dialog, 'session_stats'):
                level_id = self.parent_dialog.active_level_id
                level = db_api.get_level_details(level_id)
                
                if level:
                    # Generate question based on level criteria
                    operation = level['operation']
                    digits = level['digits']
                    
                    # Import the question generation logic
                    import random
                    
                    if operation == 'Mixed':
                        operations = ['Addition', 'Subtraction', 'Multiplication', 'Division']
                        operation = random.choice(operations)
                    
                    # Generate numbers based on digit level
                    low = 2 if digits == 1 else 10 ** (digits - 1)
                    high = 10 ** digits - 1
                    
                    a, b, answer, symbol = 0, 0, 0, ''
                    
                    if operation == 'Division':
                        # Ensure clean division with appropriate digit levels
                        b_low = 2
                        b_high = 12 if digits == 1 else (20 if digits == 2 else 50)
                        b = random.randint(b_low, b_high)
                        answer = random.randint(2, min(high, 20))
                        a = b * answer
                        
                        # Ensure the dividend (a) also respects digit level
                        max_dividend = min(high, 99)  # Cap at 99 to keep it reasonable
                        if a > max_dividend:
                            # Recalculate with smaller numbers
                            b = random.randint(b_low, min(b_high, 9))
                            answer = random.randint(2, min(max_dividend // b, 20))
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
                    
                    result = {
                        'question': question_text,
                        'answer': answer,
                        'operation': operation,
                        'digits': digits
                    }
                    
                    self.send_to_js('level_question_result', result, callback_id)
                else:
                    self.send_to_js('level_question_result', {}, callback_id)
            else:
                self.send_to_js('level_question_result', {}, callback_id)
        except Exception as e:
            print(f"Error generating level question: {e}")
            self.send_to_js('level_question_result', {}, callback_id)

    def get_level_completion_data(self, callback_id):
        """Get level completion data for completion page"""
        try:
            if hasattr(self.parent_dialog, 'active_level_id') and hasattr(self.parent_dialog, 'session_stats'):
                level_id = self.parent_dialog.active_level_id
                level = db_api.get_level_details(level_id)
                session_stats = self.parent_dialog.session_stats
                
                completion_data = {
                    'level': level,
                    'stats': session_stats
                }
                self.send_to_js('level_completion_data_result', completion_data, callback_id)
            else:
                self.send_to_js('level_completion_data_result', {}, callback_id)
        except Exception as e:
            print(f"Error getting level completion data: {e}")
            self.send_to_js('level_completion_data_result', {}, callback_id)

    def save_level_completion(self, data, callback_id):
        """Save level completion data to JSON file"""
        try:
            completion_file = os.path.join(os.path.dirname(__file__), 'data', 'level_completion_data.json')
            
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
                'level_id': data['level']['id'],
                'level_title': data['level']['title'],
                'operation': data['level']['operation'],
                'digits': data['level']['digits'],
                'stars_earned': data['stats']['stars'],
                'questions_answered': data['stats']['questions_answered'],
                'accuracy': data['stats']['accuracy'],
                'time_taken': data['stats']['total_time'],
                'completed_at': datetime.now().isoformat()
            }
            
            existing_data.append(completion_record)
            
            # Save to file
            os.makedirs(os.path.dirname(completion_file), exist_ok=True)
            with open(completion_file, 'w', encoding='utf-8') as f:
                json.dump(existing_data, f, indent=2)
            
            self.send_to_js('save_level_completion_result', {'success': True}, callback_id)
        except Exception as e:
            print(f"Error saving level completion: {e}")
            self.send_to_js('save_level_completion_result', {'success': False, 'message': str(e)}, callback_id)

    def retry_level(self):
        """Retry the current level"""
        try:
            if hasattr(self.parent_dialog, 'active_level_id'):
                level_id = self.parent_dialog.active_level_id
                level = db_api.get_level_details(level_id)
                
                # Start a new session with the same level settings
                session_data = {
                    'mode': 'Level',
                    'operation': level['operation'],
                    'digits': level['digits'],
                    'target_value': level['criteria']['questions'],
                    'level_id': level['id'],
                    'criteria': level['criteria']
                }
                
                self.start_session(session_data, '')
                self.navigate_to_level_progress()
        except Exception as e:
            print(f"Error retrying level: {e}")

    def handle_time_up(self):
        """Handle time up event"""
        try:
            # End the current session and navigate to completion
            if hasattr(self.parent_dialog, 'session_stats'):
                # Mark as failed due to time
                self.parent_dialog.session_stats['time_up'] = True
                self.end_session({}, '')
                self.navigate_to_level_complete()
        except Exception as e:
            print(f"Error handling time up: {e}")



class WebEnginePage(QWebEnginePage):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.bridge = PythonBridge(parent)
        
        # Enable developer tools and other features
        settings = self.settings()
        
        # Define attributes to set with their fallback behavior
        attributes_config = [
            # (attribute_name, description, critical_for_functionality)
            ('JavascriptEnabled', 'Core JavaScript', True),
            ('LocalStorageEnabled', 'Local storage', True),
            ('LocalContentCanAccessFileUrls', 'File URL access', False),
            ('AllowWindowActivationFromJavaScript', 'Window activation', False),
            ('JavascriptCanOpenWindows', 'Popup windows', False),
            ('JavascriptCanAccessClipboard', 'Clipboard access', False),
            ('DeveloperExtrasEnabled', 'Developer tools', False)
        ]
        
        print("Configuring WebEngine settings...")
        
        for attr_name, description, critical in attributes_config:
            try:
                # Get the attribute enum value
                attr_value = getattr(QWebEngineSettings.WebAttribute, attr_name)
                # Set the attribute to True
                settings.setAttribute(attr_value, True)
                print(f"✅ {attr_name} ({description}) - Enabled")
            except AttributeError:
                print(f"⚠️ {attr_name} ({description}) - Not available in this Qt version")
                if critical:
                    print(f"❌ CRITICAL: {description} is not available - may cause issues")
            except Exception as e:
                print(f"❌ Error setting {attr_name}: {e}")
                if critical:
                    print(f"❌ CRITICAL: Failed to set {description} - may cause issues")
        
        print("✅ WebEngine page configured with developer tools enabled")
    
    def javaScriptConsoleMessage(self, level, message, line_number, source_id):
        """Handle JavaScript console messages for debugging"""
        # Use file logger instead of print
        file_logger.log_js_message(level, message, line_number, source_id)
    
    # Override to enable developer tools
    def triggerAction(self, action, checked=False):
        """Override trigger action to handle developer tools"""
        if action == QWebEnginePage.WebAction.InspectElement:
            print("🔧 Attempting to open developer tools...")
            try:
                super().triggerAction(action, checked)
                print("✅ Developer tools trigger sent")
            except Exception as e:
                print(f"❌ Failed to trigger developer tools: {e}")
        else:
            super().triggerAction(action, checked)


class MathDrillWebEngine(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        init_db()
        
        # Session state
        self.session_mode = "Free Play"
        self.session_target = 0
        self.session_active = False
        self.session_attempts = []
        self.session_mistakes = []
        self.session_start_time = None
        self.retake_active = False
        self.retake_queue = []
        self.retake_mastery = {}
        self.current_focus_area = None
        self.focus_session_count = 0
        self.current_pb = None
        self.current_pb = None
        self.streak = 0
        self.active_level_id = None # Track active level
        
        # Settings and achievements
        self.settings_manager = AppSettings()
        self.achievements = AchievementManager()
        
        # Progress window
        self.progress_window = None
        
        # Page navigation
        self.current_page = "main"  # "main" or "progress"
        
        # UI setup
        self.setWindowFlags(Qt.WindowType.Window)
        self.setWindowTitle("Math Drill Pro")
        self.setMinimumSize(500, 750)
        self.resize(550, 850)
        
        self.init_ui()
        
        # Timer for periodic updates
        self.update_timer = QTimer(self)
        self.update_timer.timeout.connect(self.update_stats_from_timer)
        self.update_timer.start(5000)  # Update every 5 seconds
        
    def keyPressEvent(self, event):
        """Handle key press events including F12 for developer tools"""
        key = event.key()
        
        # F12 - Open Developer Tools/Inspection
        if key == Qt.Key.Key_F12:
            self.open_dev_tools()
            return
            
        # Let parent handle other keys
        super().keyPressEvent(event)
    
    def open_dev_tools(self):
        """Open developer tools for web inspection"""
        print("🔧 F12 pressed - attempting to open developer tools...")
        
        try:
            # Method 1: Try to trigger inspection
            print("Trying method 1: InspectElement action...")
            self.web_view.page().triggerAction(QWebEnginePage.WebAction.InspectElement)
            print("✅ Developer tools opened via InspectElement")
            return
            
        except Exception as e1:
            print(f"❌ Method 1 failed: {e1}")
            
            try:
                # Method 2: Try right-click context menu simulation
                print("Trying method 2: Reload and inspect...")
                self.web_view.page().triggerAction(QWebEnginePage.WebAction.Reload)
                # Wait a moment then try inspection again
                QTimer.singleShot(1000, lambda: self._retry_inspection())
                return
                
            except Exception as e2:
                print(f"❌ Method 2 failed: {e2}")
                
                try:
                    # Method 3: Try using JavaScript to open console
                    print("Trying method 3: JavaScript console...")
                    js_code = """
                        if (typeof console !== 'undefined') {
                            console.log('Developer tools request received');
                            console.clear();
                            console.log('=== Math Drill Debug Console ===');
                            console.log('Bridge available:', !!window.pythonBridge);
                            if (window.pythonBridge) {
                                console.log('Bridge methods:', Object.getOwnPropertyNames(window.pythonBridge));
                            }
                            console.log('Current page:', window.location.href);
                            console.log('=== End Debug Info ===');
                        }
                    """
                    self.web_view.page().runJavaScript(js_code)
                    print("✅ JavaScript debug console activated")
                    
                except Exception as e3:
                    print(f"❌ Method 3 failed: {e3}")
                    print("❌ All developer tools methods failed")
                    
                    # Show user a message
                    self._show_devtools_error()
    
    def _retry_inspection(self):
        """Retry inspection after reload"""
        try:
            print("Retrying inspection after reload...")
            self.web_view.page().triggerAction(QWebEnginePage.WebAction.InspectElement)
            print("✅ Developer tools opened on retry")
        except Exception as e:
            print(f"❌ Retry failed: {e}")
    
    def _show_devtools_error(self):
        """Show error message to user"""
        try:
            # Show a simple message in the web view
            error_js = """
                if (typeof document !== 'undefined') {
                    const errorDiv = document.createElement('div');
                    errorDiv.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: #ff4444;
                        color: white;
                        padding: 10px;
                        border-radius: 5px;
                        z-index: 9999;
                        font-family: monospace;
                    `;
                    errorDiv.textContent = 'F12: Developer tools not available in this environment';
                    document.body.appendChild(errorDiv);
                    setTimeout(() => errorDiv.remove(), 5000);
                }
            """
            self.web_view.page().runJavaScript(error_js)
        except:
            pass  # If even this fails, just give up
        
    
    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        
        # Create web view
        self.web_view = QWebEngineView()
        
        # Set up custom page with bridge
        self.web_page = WebEnginePage(self)
        self.web_view.setPage(self.web_page)
        
        # IMPORTANT: Set the parent_dialog reference for the bridge
        self.web_page.bridge.parent_dialog = self
        
        # Set up web channel
        self.channel = QWebChannel()
        self.channel.registerObject("pythonBridge", self.web_page.bridge)
        self.web_view.page().setWebChannel(self.channel)
        
        # Load the HTML file
        html_path = os.path.join(os.path.dirname(__file__), "web", "index.html")
        file_url = QUrl.fromLocalFile(os.path.abspath(html_path))
        self.web_view.load(file_url)
        
        layout.addWidget(self.web_view)
    
    def reset_session(self):
        """Reset session state"""
        self.session_active = False
        self.session_attempts = []
        self.session_mistakes = []
        self.session_start_time = None
        self.retake_active = False
        self.current_focus_area = None
        self.focus_session_count = 0
        self.current_pb = None
        self.active_level_id = None  # Clear level ID on reset
    
    def start_session(self, mode, operation, digits):
        """Start a new session"""
        self.session_mode = mode
        self.session_active = True
        self.session_attempts = []
        self.session_mistakes = []
        self.session_start_time = datetime.now()
        
        # Get personal best for ghost line
        self.current_pb = get_personal_best(mode, operation, digits)
    
    def end_session(self, data):
        """End session and log to database"""
        try:
            # Use current session ID if available, otherwise create new
            sid = getattr(self.web_page.bridge, 'current_session_id', None)
            if not sid:
                sid = db_api.create_session(
                    mode=data['mode'], 
                    operation=data['operation'], 
                    digits=data['digits'], 
                    target_value=self.session_target
                )
            
            # If this was a level, check for completion
            level_completed = False
            level_stars = 0
            if data.get('mode') == 'Level' and (self.active_level_id or (hasattr(self, 'session_stats') and self.session_stats.get('level_id'))):
                level_id = self.active_level_id or self.session_stats.get('level_id')
                print(f"Checking level completion for Level {level_id}")
                
                # Use data from frontend for completion check
                level_result = db_api.complete_level(level_id, {
                    'questions': data['total'],
                    'accuracy': (data['correct'] / data['total'] * 100) if data['total'] > 0 else 0,
                    'total_time': data.get('totalTime', 0),
                    'timestamp': datetime.now().isoformat()
                })
                
                if level_result['success']:
                    level_completed = True
                    level_stars = level_result.get('stars', 0)
                    print(f"Level Completed! Stars: {level_stars}")
                    
                # Store results in session_stats for Completion Page
                if hasattr(self, 'session_stats'):
                    self.session_stats.update({
                        'accuracy': round((data['correct'] / data['total'] * 100) if data['total'] > 0 else 0, 1),
                        'stars': level_stars,
                        'success': level_completed,
                        'questions_answered': data['total'],
                        'correct_answers': data['correct'],
                        'total_time': data.get('totalTime', 0)
                    })
            
            # Update session with actual stats in database
            db_api.update_session(
                session_id=sid,
                correct=data['correct'],
                total=data['total'],
                total_time=data.get('totalTime', 0),
                mistakes_data=data.get('mistakes', [])
            )
            
            # Check for badges
            new_badges = self.achievements.check_achievements({
                'mode': data['mode'],
                'total': data['total'],
                'correct': data['correct'],
                'avg_speed': data.get('totalTime', 0) / data['total'] if data['total'] > 0 else 0,
                'total_time': data.get('totalTime', 0),
                'mistakes': data['total'] - data['correct'],
                'operation': data['operation'],
                'digits': data['digits'],
                'max_streak': data.get('maxStreak', 0)
            })
            
            # Navigate to level complete page if it's a level
            if data.get('mode') == 'Level':
                self.navigate_to_level_complete()
            
            # Reset session state (but don't clear session_stats yet if we need it for completion page)
            self.session_active = False
            if hasattr(self.web_page.bridge, 'current_session_id'):
                self.web_page.bridge.current_session_id = None
            
            return {
                'success': True,
                'newBadges': new_badges,
                'levelCompleted': level_completed,
                'levelStars': level_stars
            }
        except Exception as e:
            print(f"Error ending session: {e}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'error': str(e)
            }
    
    def play_sound(self, success):
        """Play sound effect"""
        if not self.settings_manager.sound_enabled:
            return
            
        def worker():
            try:
                import pygame.mixer
                pygame.mixer.init()
                
                if success:
                    sound_file = os.path.join(os.path.dirname(__file__), "sfx", "correct.mp3")
                else:
                    sound_file = os.path.join(os.path.dirname(__file__), "sfx", "error.mp3")
                
                if os.path.exists(sound_file):
                    pygame.mixer.music.load(sound_file)
                    pygame.mixer.music.play()
                    while pygame.mixer.music.get_busy():
                        pygame.time.Clock().tick(10)
                pygame.mixer.quit()
            except Exception as e:
                pass  # Silently fail if audio doesn't work
        
        threading.Thread(target=worker, daemon=True).start()
    
    def update_stats_from_timer(self):
        """Update stats periodically"""
        script = "if (window.updateFromPython) window.updateFromPython('updateStats', {});"
        self.web_view.page().runJavaScript(script)
    
    def navigate_to_progress(self):
        """Navigate to progress page in the same window"""
        print("Navigating to progress page...")
        self.current_page = "progress"
        
        # Load the progress HTML file
        progress_html_path = os.path.join(os.path.dirname(__file__), "web", "progress.html")
        print(f"Loading progress HTML from: {progress_html_path}")
        
        if os.path.exists(progress_html_path):
            file_url = QUrl.fromLocalFile(os.path.abspath(progress_html_path))
            self.web_view.load(file_url)
            
            # Update window title
            self.setWindowTitle("Math Drill - Progress")
            
            # Use the SAME bridge for progress page - don't create a new one
            # The existing bridge already has the proper parent_dialog reference
            self.channel.registerObject("pythonBridge", self.web_page.bridge)
            self.web_view.page().setWebChannel(self.channel)
            
            print("Progress page loaded successfully with existing bridge")
            
            # Test bridge after a short delay to ensure page is loaded
            QTimer.singleShot(1000, self.test_progress_bridge)
        else:
            print(f"Progress HTML file not found: {progress_html_path}")
    
    def test_progress_bridge(self):
        """Test if the bridge is working on the progress page"""
        print("Testing progress page bridge...")
        test_script = """
            console.log('Testing bridge on progress page...');
            console.log('pythonBridge available:', !!window.pythonBridge);
            if (window.pythonBridge) {
                console.log('Bridge methods:', Object.getOwnPropertyNames(window.pythonBridge));
                console.log('Bridge send method:', typeof window.pythonBridge.send);
            }
        """
        self.web_view.page().runJavaScript(test_script)
    
    def navigate_to_main(self):
        """Navigate back to main page"""
        print("Navigating to main page...")
        self.current_page = "main"
        
        # Load the main HTML file
        main_html_path = os.path.join(os.path.dirname(__file__), "web", "index.html")
        print(f"Loading main HTML from: {main_html_path}")
        
        if os.path.exists(main_html_path):
            file_url = QUrl.fromLocalFile(os.path.abspath(main_html_path))
            self.web_view.load(file_url)
            
            # Update window title
            self.setWindowTitle("Math Drill Pro")
            
            # Re-set up bridge for main page
            self.channel.registerObject("pythonBridge", self.web_page.bridge)
            self.web_view.page().setWebChannel(self.channel)
            
            print("Main page loaded successfully")
        else:
            print(f"Main HTML file not found: {main_html_path}")

    def navigate_to_levels(self):
        """Navigate to levels page"""
        print("Navigating to levels page...")
        self.current_page = "levels"
        
        # Load the levels HTML file
        levels_html_path = os.path.join(os.path.dirname(__file__), "web", "levels.html")
        print(f"Loading levels HTML from: {levels_html_path}")
        
        if os.path.exists(levels_html_path):
            file_url = QUrl.fromLocalFile(os.path.abspath(levels_html_path))
            self.web_view.load(file_url)
            
            # Update window title
            self.setWindowTitle("Math Drill - Levels")
            
            # Re-set up bridge for levels page
            self.channel.registerObject("pythonBridge", self.web_page.bridge)
            self.web_view.page().setWebChannel(self.channel)
            
            print("Levels page loaded successfully")
        else:
            print(f"Levels HTML file not found: {levels_html_path}")

    def navigate_to_level_progress(self):
        """Navigate to level progress page"""
        print("Navigating to level progress page...")
        self.current_page = "level_progress"
        
        # Load the level progress HTML file
        progress_html_path = os.path.join(os.path.dirname(__file__), "web", "level_progress.html")
        print(f"Loading level progress HTML from: {progress_html_path}")
        
        if os.path.exists(progress_html_path):
            # Add level ID as URL parameter if available
            file_url = QUrl.fromLocalFile(os.path.abspath(progress_html_path))
            if hasattr(self, 'active_level_id'):
                file_url.setQuery(f"level_id={self.active_level_id}")
                print(f"Setting level_id parameter: {self.active_level_id}")
            
            self.web_view.load(file_url)
            
            # Update window title
            self.setWindowTitle("Math Drill - Level Progress")
            
            # Re-set up bridge for progress page
            self.channel.registerObject("pythonBridge", self.web_page.bridge)
            self.web_view.page().setWebChannel(self.channel)
            
            print("Level progress page loaded successfully")
        else:
            print(f"Level progress HTML file not found: {progress_html_path}")

    def navigate_to_level_complete(self):
        """Navigate to level completion page"""
        print("Navigating to level completion page...")
        self.current_page = "level_complete"
        
        # Load the level completion HTML file
        complete_html_path = os.path.join(os.path.dirname(__file__), "web", "level_complete.html")
        print(f"Loading level completion HTML from: {complete_html_path}")
        
        if os.path.exists(complete_html_path):
            file_url = QUrl.fromLocalFile(os.path.abspath(complete_html_path))
            self.web_view.load(file_url)
            
            # Update window title
            self.setWindowTitle("Math Drill - Level Complete!")
            
            # Re-set up bridge for completion page
            self.channel.registerObject("pythonBridge", self.web_page.bridge)
            self.web_view.page().setWebChannel(self.channel)
            
            print("Level completion page loaded successfully")
        else:
            print(f"Level completion HTML file not found: {complete_html_path}")

    def open_progress_page(self):
        """Open the progress page in a window"""
        if not self.progress_window or not self.progress_window.isVisible():
            self.progress_window = QDialog(self)
            self.progress_window.setWindowTitle("Math Drill - Progress")
            self.progress_window.setMinimumSize(1200, 800)
            self.progress_window.resize(1400, 900)
            
            layout = QVBoxLayout(self.progress_window)
            layout.setContentsMargins(0, 0, 0, 0)
            
            # Create web view for progress page
            progress_web_view = QWebEngineView()
            
            # Set up web channel for progress page
            progress_channel = QWebChannel()
            progress_bridge = PythonBridge(self.progress_window)
            progress_bridge.parent_dialog = self.progress_window
            progress_channel.registerObject("pythonBridge", progress_bridge)
            progress_web_view.page().setWebChannel(progress_channel)
            
            # Load the progress HTML file
            progress_html_path = os.path.join(os.path.dirname(__file__), "web", "progress.html")
            print(f"Loading progress HTML from: {progress_html_path}")
            file_url = QUrl.fromLocalFile(os.path.abspath(progress_html_path))
            progress_web_view.load(file_url)
            
            layout.addWidget(progress_web_view)
            
            # Store reference
            self.progress_window.web_view = progress_web_view
            self.progress_window.bridge = progress_bridge
            
            # Show the window
            print("Showing progress window")
            self.progress_window.show()
            
            # Center relative to main window
            if self.isVisible():
                main_rect = self.geometry()
                progress_rect = self.progress_window.geometry()
                x = main_rect.x() + (main_rect.width() - progress_rect.width()) // 2
                y = main_rect.y() + (main_rect.height() - progress_rect.height()) // 2
                self.progress_window.move(x, y)
        else:
            print("Progress window already exists, bringing to front")
            # Bring existing window to front
            self.progress_window.raise_()
            self.progress_window.activateWindow()
    



    def closeEvent(self, event):
        """Handle close event"""
        self.update_timer.stop()
        
        # Close progress window if open
        if self.progress_window and self.progress_window.isVisible():
            self.progress_window.close()
        
        super().closeEvent(event)


# Keep the original Qt-based class as fallback
class MathDrill(QDialog):
    """Original Qt-based implementation - kept as fallback"""
    def __init__(self, parent=None):
        super().__init__(parent)
        # This would contain the original Qt implementation
        # For now, just show a message directing to web version
        from aqt.qt import QLabel, QVBoxLayout
        
        layout = QVBoxLayout(self)
        label = QLabel("Math Drill is now using WebEngine!\nPlease use the web-based version for the best experience.")
        label.setStyleSheet("font-size: 16px; padding: 20px; text-align: center;")
        layout.addWidget(label)


def show_math_drill():
    """Main function to show the math drill application"""
    app = QApplication.instance()
    if app is None:
        app = QApplication(sys.argv)
        app.setApplicationName("MathDrill")
        app.setOrganizationName("Sene")
    
    # Try to use WebEngine version first
    try:
        window = MathDrillWebEngine()
        window.show()
        return window
    except Exception as e:
        print(f"Failed to load WebEngine version: {e}")
        print("Falling back to Qt version...")
        
        # Fallback to Qt version
        window = MathDrill()
        window.show()
        return window


if __name__ == "__main__":
    window = show_math_drill()
    sys.exit(app.exec())
