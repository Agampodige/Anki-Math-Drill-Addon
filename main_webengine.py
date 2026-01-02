import sys
import os
import json
import threading
import time
from datetime import date, datetime
from aqt.qt import (
    QDialog, QVBoxLayout, QApplication, QUrl, Qt,
    QWebEngineView, QWebEnginePage, QWebChannel
)
from PyQt6.QtCore import QObject, pyqtSlot, QTimer

from .database import init_db, log_attempt, log_session, get_last_7_days_stats, get_personal_best, get_total_attempts_count, get_today_attempts_count, update_weakness_tracking
from .analytics import get_today_stats
from .coach import SmartCoach
from .gamification import AchievementManager, AppSettings


class PythonBridge(QObject):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.parent_dialog = parent
        self.settings_manager = AppSettings()
        self.achievements = AchievementManager()
        self.coach = SmartCoach()
        
        # Cache for instant progress data loading
        self._progress_cache = {}
        self._cache_timestamp = None
        self._cache_valid_duration = 30  # Cache valid for 30 seconds
        
    @pyqtSlot(str, str, str)
    def send(self, action, data_str, callback_id):
        """Handle messages from JavaScript"""
        try:
            data = json.loads(data_str) if data_str else {}
            
            if action == 'reset_session':
                self.reset_session(data)
            elif action == 'start_session':
                self.start_session(data)
            elif action == 'log_attempt':
                self.log_attempt(data)
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
        except Exception as e:
            print(f"Error handling action {action}: {e}")
    
    def reset_session(self, data):
        """Handle session reset"""
        if hasattr(self.parent_dialog, 'reset_session'):
            self.parent_dialog.reset_session()
    
    def start_session(self, data):
        """Handle session start"""
        if hasattr(self.parent_dialog, 'start_session'):
            self.parent_dialog.start_session(data['mode'], data['operation'], data['digits'])
    
    def log_attempt(self, data):
        """Log an attempt to the database"""
        log_attempt(data['operation'], data['digits'], int(data['correct']), data['time'])
        update_weakness_tracking(data['operation'], data['digits'], data['correct'])
        
        # Invalidate cache when new data is added
        self.invalidate_cache()
    
    def end_session(self, data, callback_id):
        """Handle session end and return results"""
        if hasattr(self.parent_dialog, 'end_session'):
            result = self.parent_dialog.end_session(data)
            self.send_to_js('end_session_result', result, callback_id)
    
    def play_sound(self, data):
        """Play sound effect"""
        if hasattr(self.parent_dialog, 'play_sound'):
            self.parent_dialog.play_sound(data['success'])
    
    def get_stats(self, callback_id):
        """Get current statistics"""
        try:
            session_count = len(getattr(self.parent_dialog, 'session_attempts', []))
            today_count = get_today_attempts_count()
            lifetime_count = get_total_attempts_count()
            
            # Get detailed stats for today
            if today_count > 0:
                import sqlite3
                from .database import DB_NAME
                conn = sqlite3.connect(DB_NAME)
                c = conn.cursor()
                c.execute("SELECT COUNT(*), SUM(correct), SUM(time_taken) FROM attempts WHERE created = ?", (date.today().isoformat(),))
                total, correct, total_time = c.fetchone()
                conn.close()
                
                accuracy = (correct / total) * 100 if total and total > 0 else 0
                avg_speed = total_time / total if total and total > 0 else 0
                total_time = total_time or 0
            else:
                accuracy = 0
                avg_speed = 0
                total_time = 0
            
            stats = {
                'session': session_count,
                'today': today_count,
                'lifetime': lifetime_count,
                'accuracy': accuracy,
                'avgSpeed': avg_speed,
                'totalTime': total_time
            }
            
            self.send_to_js('stats_result', stats, callback_id)
        except Exception as e:
            print(f"Error getting stats: {e}")
            self.send_to_js('stats_result', {}, callback_id)
    
    def get_settings(self, callback_id):
        """Get current settings"""
        settings = {
            'soundEnabled': self.settings_manager.sound_enabled
        }
        self.send_to_js('settings_result', settings, callback_id)
    
    def toggle_sound(self, callback_id):
        """Toggle sound settings"""
        self.settings_manager.sound_enabled = not self.settings_manager.sound_enabled
        settings = {
            'soundEnabled': self.settings_manager.sound_enabled
        }
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
        """Get weakness analysis data"""
        try:
            weaknesses = self.coach.get_weakness_focus_areas()
            weakness_data = []
            
            for weakness in weaknesses:
                weakness_data.append({
                    'operation': weakness['operation'],
                    'digits': weakness['digits'],
                    'level': weakness['level'],
                    'accuracy': weakness.get('accuracy', 0),
                    'speed': weakness.get('speed', 0),
                    'weaknessScore': weakness.get('weakness_score', 0),
                    'practiced': weakness.get('practiced', True),
                    'suggestions': weakness.get('suggestions', [])
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
    
    def get_progress_data_instant(self, data, callback_id):
        """Get progress data instantly using cache or fast loading"""
        try:
            period = data.get('period', 'week')
            current_time = time.time()
            
            # Check if we have valid cached data
            if (self._cache_timestamp and 
                current_time - self._cache_timestamp < self._cache_valid_duration and
                self._progress_cache):
                
                print("Using cached progress data for instant response")
                cached_data = self._progress_cache.copy()
                self.send_to_js('progress_data_result', cached_data, callback_id)
                return
            
            print("Cache miss or expired, generating fresh data...")
            
            # Generate fresh data quickly
            fresh_data = self._generate_fast_progress_data(period)
            
            # Update cache
            self._progress_cache = fresh_data.copy()
            self._cache_timestamp = current_time
            
            # Send data immediately
            self.send_to_js('progress_data_result', fresh_data, callback_id)
            
            # Update heavy data in background for next time
            QTimer.singleShot(100, lambda: self._update_cache_with_heavy_data())
            
        except Exception as e:
            print(f"Error in instant progress data: {e}")
            self.send_to_js('progress_data_result', {}, callback_id)
    
    def _generate_fast_progress_data(self, period):
        """Generate progress data quickly using optimized queries"""
        import sqlite3
        from .database import DB_NAME
        from datetime import date
        
        # Single database connection for all queries
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        
        try:
            # Get basic stats quickly
            c.execute("SELECT COUNT(*) FROM attempts")
            lifetime_count = c.fetchone()[0]
            
            c.execute("SELECT COUNT(*) FROM attempts WHERE created = ?", (date.today().isoformat(),))
            today_count = c.fetchone()[0]
            
            # Get overall stats
            c.execute("SELECT COUNT(*), SUM(correct), SUM(time_taken) FROM attempts")
            total, correct, total_time_db = c.fetchone()
            
            accuracy = (correct / total) * 100 if total and total > 0 else 0
            avg_speed = total_time_db / total if total and total > 0 else 0
            
            # Get recent activity (last 7 days)
            c.execute("""
                SELECT created, COUNT(*), SUM(correct), SUM(time_taken) 
                FROM attempts 
                WHERE created >= date('now', '-7 days')
                GROUP BY created
                ORDER BY created DESC
                LIMIT 7
            """)
            
            period_data = c.fetchall()
            
            # Prepare data structures
            recent_activity = []
            chart_data = []
            
            for i, row in enumerate(period_data):
                count, correct_sum, time_sum, created = row
                if count and count > 0:
                    # Recent activity
                    recent_activity.append({
                        'date': created,
                        'timeAgo': f'{i+1} day{"s" if i+1 > 1 else ""} ago',
                        'questions': count,
                        'accuracy': (correct_sum / count) * 100 if correct_sum else 0,
                        'avgSpeed': time_sum / count if time_sum else 0
                    })
                    
                    # Chart data
                    chart_data.append({
                        'label': created,
                        'accuracy': (correct_sum / count) * 100 if correct_sum else 0,
                        'speed': time_sum / count if time_sum else 0
                    })
            
            # Fast progress data
            progress_data = {
                'stats': {
                    'totalQuestions': lifetime_count,
                    'avgAccuracy': accuracy,
                    'avgSpeed': avg_speed,
                    'currentStreak': getattr(self.parent_dialog, 'streak', 0)
                },
                'chartData': chart_data,
                'recentActivity': recent_activity,
                'mastery': {},  # Will be filled by background update
                'weaknesses': [],  # Will be filled by background update
                'achievements': [],  # Will be filled by background update
                'personalBests': {}  # Will be filled by background update
            }
            
            print(f"Fast progress data generated: {lifetime_count} total, {accuracy:.1f}% accuracy")
            return progress_data
            
        finally:
            conn.close()
    
    def _update_cache_with_heavy_data(self):
        """Update cache with heavy data components in background"""
        try:
            print("Updating cache with heavy data components...")
            
            # Get mastery data
            mastery = {}
            try:
                mastery_data = self.coach.get_mastery_grid_data()
                for (op, digits), stats in mastery_data.items():
                    key = f"{op}-{digits}"
                    mastery[key] = {
                        'level': stats['level'],
                        'acc': stats['acc'],
                        'speed': stats['speed'],
                        'count': stats['count']
                    }
            except:
                pass
            
            # Get weakness data
            weaknesses = []
            try:
                weakness_data = self.coach.get_weakness_focus_areas()
                for weakness in weakness_data:
                    weaknesses.append({
                        'operation': weakness['operation'],
                        'digits': weakness['digits'],
                        'level': weakness['level'],
                        'accuracy': weakness.get('accuracy', 0),
                        'speed': weakness.get('speed', 0),
                        'weaknessScore': weakness.get('weakness_score', 0),
                        'practiced': weakness.get('practiced', True),
                        'suggestions': weakness.get('suggestions', [])
                    })
            except:
                pass
            
            # Get achievements
            achievements = []
            try:
                badges = self.achievements.get_all_badges_status()
                for badge in badges:
                    achievements.append({
                        'name': badge['name'],
                        'desc': badge['desc'],
                        'unlocked': badge['unlocked'],
                        'progress': badge.get('progress', 100 if badge['unlocked'] else 0)
                    })
            except:
                pass
            
            # Get personal bests
            personal_bests = {}
            try:
                from .database import get_personal_best
                personal_bests['drill'] = get_personal_best('Drill (20 Qs)', 'Mixed', 2)
                personal_bests['sprint'] = get_personal_best('Sprint (60s)', 'Mixed', 2)
                personal_bests['accuracy'] = 95.0
                personal_bests['speed'] = 2.5
            except:
                pass
            
            # Update cache with heavy data
            if self._progress_cache:
                self._progress_cache.update({
                    'mastery': mastery,
                    'weaknesses': weaknesses,
                    'achievements': achievements,
                    'personalBests': personal_bests
                })
            
            print("Cache updated with heavy data components")
            
            # Notify JavaScript about the update
            if hasattr(self.parent_dialog, 'web_view') and self.parent_dialog.web_view:
                update_script = f"""
                    if (window.progressPage && window.progressPage.updateHeavyData) {{
                        window.progressPage.updateHeavyData({{
                            'mastery': {json.dumps(mastery)},
                            'weaknesses': {json.dumps(weaknesses)},
                            'achievements': {json.dumps(achievements)},
                            'personalBests': {json.dumps(personal_bests)}
                        }});
                    }}
                """
                self.parent_dialog.web_view.page().runJavaScript(update_script)
                
        except Exception as e:
            print(f"Error updating cache with heavy data: {e}")
    
    def invalidate_cache(self):
        """Invalidate the progress data cache"""
        self._progress_cache = {}
        self._cache_timestamp = None
        print("Progress data cache invalidated")
    
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
            data_json = json.dumps(data, indent=2)
            print(f"Data being sent to JavaScript:\n{data_json}")
            
            script = f"""
                console.log('Python bridge script executing for callback: {callback_id}');
                console.log('Checking pythonBridge availability:', typeof window.pythonBridge);
                console.log('Available callbacks:', Object.keys(window.pythonBridge.callbacks || {{}});
                
                if (window.pythonBridge && window.pythonBridge.callbacks && window.pythonBridge.callbacks['{callback_id}']) {{
                    console.log('Found callback, executing with data:');
                    var data = {data_json};
                    console.log('Parsed data:', data);
                    console.log('Data stats section:', data.stats);
                    
                    try {{
                        window.pythonBridge.callbacks['{callback_id}'](data);
                        delete window.pythonBridge.callbacks['{callback_id}'];
                        console.log('Callback executed and deleted successfully');
                    }} catch(e) {{
                        console.error('Error executing callback:', e);
                        console.error('Stack:', e.stack);
                    }}
                }} else {{
                    console.log('Callback not found for ID: {callback_id}');
                    console.log('pythonBridge exists:', !!window.pythonBridge);
                    console.log('callbacks exists:', !!(window.pythonBridge && window.pythonBridge.callbacks));
                    if (window.pythonBridge && window.pythonBridge.callbacks) {{
                        console.log('Available callback IDs:', Object.keys(window.pythonBridge.callbacks));
                    }}
                }}
            """
            print("Executing JavaScript in web view...")
            self.parent_dialog.web_view.page().runJavaScript(script)
        else:
            print("No web_view available in parent_dialog")


class WebEnginePage(QWebEnginePage):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.bridge = PythonBridge(parent)
    
    def javaScriptConsoleMessage(self, level, message, line_number, source_id):
        """Handle JavaScript console messages for debugging"""
        print(f"JS Console [{level}]: {message} (line {line_number}, {source_id})")


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
        self.streak = 0
        
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
        
        # Pre-load progress data cache for instant loading
        QTimer.singleShot(1000, self.preload_progress_cache)
    
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
            # Log session to database
            sid = log_session(
                data['mode'], 
                data['operation'], 
                data['digits'], 
                self.session_target, 
                data['total'], 
                data['correct'], 
                data['avgSpeed']
            )
            
            # Check achievements
            session_data = {
                'mode': data['mode'],
                'total': data['total'],
                'correct': data['correct'],
                'avg_speed': data['avgSpeed'],
                'total_time': data['totalTime'],
                'mistakes': len(data['mistakes']),
                'operation': data['operation'],
                'digits': data['digits'],
                'max_streak': data.get('maxStreak', 0)
            }
            
            new_badges = self.achievements.check_achievements(session_data)
            
            # Reset session
            self.reset_session()
            
            return {
                'success': True,
                'newBadges': new_badges
            }
        except Exception as e:
            print(f"Error ending session: {e}")
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
    
    def preload_progress_cache(self):
        """Pre-load progress data cache for instant loading"""
        print("Pre-loading progress data cache...")
        try:
            # Generate cache data in background
            cache_data = self.web_page.bridge._generate_fast_progress_data('week')
            self.web_page.bridge._progress_cache = cache_data
            self.web_page.bridge._cache_timestamp = time.time()
            
            # Update heavy data in background
            QTimer.singleShot(500, self.web_page.bridge._update_cache_with_heavy_data)
            
            print("Progress data cache pre-loaded successfully")
        except Exception as e:
            print(f"Error pre-loading cache: {e}")
    
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
    
    def open_progress_page(self):
        """Open the progress page in a new window"""
        print("MathDrillWebEngine.open_progress_page called")
        if self.progress_window is None or not self.progress_window.isVisible():
            print("Creating new progress window")
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
