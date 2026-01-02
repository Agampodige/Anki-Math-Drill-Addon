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
    
    def send_to_js(self, action, data, callback_id):
        """Send data back to JavaScript"""
        if hasattr(self.parent_dialog, 'web_view') and self.parent_dialog.web_view:
            script = f"""
                if (window.pythonBridge && window.pythonBridge.callbacks && window.pythonBridge.callbacks['{callback_id}']) {{
                    window.pythonBridge.callbacks['{callback_id}']({json.dumps(data)});
                    delete window.pythonBridge.callbacks['{callback_id}'];
                }}
            """
            self.parent_dialog.web_view.page().runJavaScript(script)


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
        
        # Settings and achievements
        self.settings_manager = AppSettings()
        self.achievements = AchievementManager()
        
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
    
    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        
        # Create web view
        self.web_view = QWebEngineView()
        
        # Set up custom page with bridge
        self.web_page = WebEnginePage(self)
        self.web_view.setPage(self.web_page)
        
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
    
    def update_stats_from_timer(self):
        """Periodically update stats in the web view"""
        if self.web_view:
            script = "if (window.updateFromPython) window.updateFromPython('updateStats', {});"
            self.web_view.page().runJavaScript(script)
    
    def closeEvent(self, event):
        """Handle close event"""
        self.update_timer.stop()
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
