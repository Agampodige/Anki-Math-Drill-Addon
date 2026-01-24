from aqt.qt import QObject, pyqtSignal, QWebChannel, pyqtSlot
from aqt.utils import showInfo, askUser, tooltip
from aqt import mw
import json
import os
import shutil
from datetime import datetime

class Bridge(QObject):
    """Bridge for communication between Python and JavaScript"""
    
    def __init__(self, parent=None, attempts_manager=None, levels_manager=None, backup_manager=None):
        super().__init__(parent)
        self.channel = QWebChannel()
        self.channel.registerObject("pybridge", self)
        self.attempts_manager = attempts_manager
        self.levels_manager = levels_manager
        self.backup_manager = backup_manager
    
    # Signals to JavaScript
    messageReceived = pyqtSignal(str)
    
    @pyqtSlot(str)
    def sendMessage(self, message):
        """Receive message from JavaScript"""
        try:
            print(f"DEBUG: Bridge received message: {message}")
            data = json.loads(message)
            msg_type = data.get('type', '')
            payload = data.get('payload', {})
            
            print(f"DEBUG: Received message type: {msg_type}")
            print(f"DEBUG: Message payload: {payload}")
            
            if msg_type == 'hello':
                self._handle_hello(payload)
            elif msg_type == 'get_cards':
                self._handle_get_cards(payload)
            elif msg_type == 'show_info':
                self._handle_show_info(payload)
            elif msg_type == 'save_attempts':
                self._handle_save_attempts(payload)
            elif msg_type == 'get_attempts':
                self._handle_get_attempts(payload)
            elif msg_type == 'load_attempts':
                self._handle_load_attempts(payload)
            elif msg_type == 'get_statistics':
                self._handle_get_statistics(payload)
            elif msg_type == 'load_levels':
                self._handle_load_levels(payload)
            elif msg_type == 'get_level':
                self._handle_get_level(payload)
            elif msg_type == 'complete_level':
                self._handle_complete_level(payload)
            elif msg_type == 'get_level_progress':
                self._handle_get_level_progress(payload)
            elif msg_type == 'save_settings':
                print(f"DEBUG: Routing to _handle_save_settings")
                self._handle_save_settings(payload)
            elif msg_type == 'load_settings':
                self._handle_load_settings(payload)
            elif msg_type == 'get_weaknesses':
                self._handle_get_weaknesses(payload)
            elif msg_type == 'export_data':
                self.export_data()
            elif msg_type == 'import_data':
                self.import_data(message)
            elif msg_type == 'perform_backup':
                self.perform_backup(payload)
            elif msg_type == 'open_backup_location':
                self.open_backup_location()
            elif msg_type == 'open_url':
                self.open_url(message)
            elif msg_type == 'save_session':
                self._handle_save_session(payload)
            elif msg_type == 'load_sessions':
                self._handle_load_sessions(payload)
            elif msg_type == 'clear_sessions':
                self._handle_clear_sessions(payload)
            else:
                print(f"DEBUG: Unknown message type: {msg_type}")
                self.messageReceived.emit(json.dumps({
                    'type': 'error',
                    'payload': {'message': f'Unknown message type: {msg_type}'}
                }))
                
        except Exception as e:
            print(f"DEBUG: Exception in sendMessage: {e}")
            import traceback
            traceback.print_exc()
            self.messageReceived.emit(json.dumps({
                'type': 'error',
                'payload': {'message': f'Error processing message: {str(e)}'}
            }))
    
    @pyqtSlot(str)
    def perform_backup(self, payload_str=None):
        """Handle manual backup request"""
        try:
            if not self.backup_manager:
                raise Exception('Backup manager not initialized')
            
            # Use max_backups from settings if available
            max_backups = 5
            addon_folder = os.path.dirname(__file__)
            settings_file = os.path.join(addon_folder, "data", "user", "setting.json")
            if os.path.exists(settings_file):
                with open(settings_file, 'r', encoding='utf-8') as f:
                    try:
                        settings_data = json.load(f)
                        max_backups = settings_data.get('maxBackups', 5)
                    except:
                        pass
            
            success, result = self.backup_manager.perform_backup(max_backups=max_backups)
            
            response = {
                'type': 'perform_backup_response',
                'payload': {
                    'success': success,
                    'message': f"Backup created successfully!" if success else f"Backup failed: {result}"
                }
            }
            self.messageReceived.emit(json.dumps(response))
        except Exception as e:
            response = {
                'type': 'error',
                'payload': {
                    'message': f'Error performing backup: {str(e)}'
                }
            }
            self.messageReceived.emit(json.dumps(response))

    def _handle_hello(self, payload):
        """Handle hello message from JS"""
        name = payload.get('name', 'World')
        response = {
            'type': 'hello_response',
            'payload': {
                'message': f'Hello, {name}! This is Python responding.',
                'timestamp': str(mw.col.time.time())
            }
        }
        self.messageReceived.emit(json.dumps(response))
    
    def _handle_get_cards(self, payload):
        """Handle get cards request"""
        try:
            cards = mw.col.find_cards("")
            card_count = len(cards)
            response = {
                'type': 'cards_response',
                'payload': {
                    'count': card_count,
                    'message': f'Found {card_count} cards in collection'
                }
            }
            self.messageReceived.emit(json.dumps(response))
        except Exception as e:
            response = {
                'type': 'error',
                'payload': {
                    'message': f'Error getting cards: {str(e)}'
                }
            }
            self.messageReceived.emit(json.dumps(response))
    
    def _handle_show_info(self, payload):
        """Handle show info request"""
        message = payload.get('message', 'No message provided')
        showInfo(message)
        
        response = {
            'type': 'info_shown',
            'payload': {
                'message': 'Info dialog shown successfully'
            }
        }
        self.messageReceived.emit(json.dumps(response))
    
    def _handle_save_attempts(self, payload):
        """Handle save attempts request"""
        try:
            if not self.attempts_manager:
                raise Exception('Attempts manager not initialized')
            
            attempts_data = payload.get('attempts', {})
            result = self.attempts_manager.save_attempts(attempts_data)
            
            response = {
                'type': 'save_attempts_response',
                'payload': result
            }
            self.messageReceived.emit(json.dumps(response))
        except Exception as e:
            response = {
                'type': 'error',
                'payload': {
                    'message': f'Error saving attempts: {str(e)}'
                }
            }
            self.messageReceived.emit(json.dumps(response))
    
    def _handle_get_attempts(self, payload):
        """Handle get attempts request for home stats"""
        try:
            if not self.attempts_manager:
                raise Exception('Attempts manager not initialized')
            
            data = self.attempts_manager.load_attempts()
            attempts = data.get('attempts', [])
            
            response = {
                'type': 'get_attempts_response',
                'payload': {
                    'attempts': attempts,
                    'success': True
                }
            }
            self.messageReceived.emit(json.dumps(response))
        except Exception as e:
            response = {
                'type': 'error',
                'payload': {
                    'message': f'Error getting attempts: {str(e)}'
                }
            }
            self.messageReceived.emit(json.dumps(response))
    
    def _handle_load_attempts(self, payload):
        """Handle load attempts request"""
        try:
            if not self.attempts_manager:
                raise Exception('Attempts manager not initialized')
            
            data = self.attempts_manager.load_attempts()
            
            response = {
                'type': 'load_attempts_response',
                'payload': data
            }
            self.messageReceived.emit(json.dumps(response))
        except Exception as e:
            response = {
                'type': 'error',
                'payload': {
                    'message': f'Error loading attempts: {str(e)}'
                }
            }
            self.messageReceived.emit(json.dumps(response))
    
    def _handle_get_weaknesses(self, payload):
        """Handle get weaknesses request"""
        try:
            if not self.attempts_manager:
                raise Exception('Attempts manager not initialized')
            
            operation = payload.get('operation')
            digits = payload.get('digits')
            
            weaknesses = self.attempts_manager.get_weaknesses(operation, digits)
            
            response = {
                'type': 'get_weaknesses_response',
                'payload': {
                    'weaknesses': weaknesses,
                    'success': True
                }
            }
            self.messageReceived.emit(json.dumps(response))
        except Exception as e:
            response = {
                'type': 'error',
                'payload': {
                    'message': f'Error getting weaknesses: {str(e)}'
                }
            }
            self.messageReceived.emit(json.dumps(response))

    def _handle_get_statistics(self, payload):
        """Handle get statistics request"""
        try:
            if not self.attempts_manager:
                raise Exception('Attempts manager not initialized')
            
            stats = self.attempts_manager.get_attempt_statistics()
            
            response = {
                'type': 'statistics_response',
                'payload': stats
            }
            self.messageReceived.emit(json.dumps(response))
        except Exception as e:
            response = {
                'type': 'error',
                'payload': {
                    'message': f'Error getting statistics: {str(e)}'
                }
            }
            self.messageReceived.emit(json.dumps(response))
    
    def _handle_load_levels(self, payload):
        """Handle load all levels request"""
        try:
            if not self.levels_manager:
                raise Exception('Levels manager not initialized')
            
            compact = payload.get('compact', False)
            levels = self.levels_manager.get_all_levels(compact=compact)
            stats = self.levels_manager.get_progression_stats()
            
            print(f"DEBUG: Loading levels (compact={compact}) - found {len(levels)} levels")
            print(f"DEBUG: Stats: {stats}")
            
            response = {
                'type': 'load_levels_response',
                'payload': {
                    'levels': levels,
                    'stats': stats
                }
            }
            
            # Ensure response is JSON serializable
            response_json = json.dumps(response)
            print(f"DEBUG: Response JSON length: {len(response_json)}")
            self.messageReceived.emit(response_json)
            
        except Exception as e:
            import traceback
            print(f"ERROR in _handle_load_levels: {e}")
            traceback.print_exc()
            response = {
                'type': 'error',
                'payload': {
                    'message': f'Error loading levels: {str(e)}'
                }
            }
            self.messageReceived.emit(json.dumps(response))
    
    def _handle_get_level(self, payload):
        """Handle get specific level request"""
        try:
            if not self.levels_manager:
                raise Exception('Levels manager not initialized')
            
            level_id = payload.get('levelId')
            print(f"DEBUG: Getting level {level_id}")
            level = self.levels_manager.get_level(level_id)
            
            if not level:
                raise Exception(f'Level {level_id} not found')
            
            print(f"DEBUG: Found level: {level.get('name')}")
            
            # Ensure level data is JSON serializable
            try:
                # Test serialization first
                test_json = json.dumps(level)
                print(f"DEBUG: JSON serialization test passed, length: {len(test_json)}")
            except Exception as json_error:
                print(f"DEBUG: JSON serialization failed: {json_error}")
                # Try to clean the level data
                level = self._clean_level_data(level)
                test_json = json.dumps(level)
                print(f"DEBUG: Cleaned JSON serialization passed, length: {len(test_json)}")
            
            response = {
                'type': 'get_level_response',
                'payload': level
            }
            
            print(f"DEBUG: Sending response...")
            response_json = json.dumps(response)
            print(f"DEBUG: Response JSON length: {len(response_json)}")
            self.messageReceived.emit(response_json)
            print(f"DEBUG: Response sent successfully")
            
        except Exception as e:
            import traceback
            print(f"ERROR in _handle_get_level: {e}")
            traceback.print_exc()
            response = {
                'type': 'error',
                'payload': {
                    'message': f'Error getting level: {str(e)}'
                }
            }
            try:
                self.messageReceived.emit(json.dumps(response))
                print(f"DEBUG: Error response sent")
            except Exception as emit_error:
                print(f"DEBUG: Failed to send error response: {emit_error}")
    
    def _clean_level_data(self, level):
        """Clean level data to ensure JSON serializability"""
        try:
            # Create a clean copy with only JSON-serializable data
            clean_level = {}
            
            # Copy basic string/number fields
            for key, value in level.items():
                if isinstance(value, (str, int, float, bool, type(None))):
                    clean_level[key] = value
                elif isinstance(value, list):
                    # Clean list items
                    clean_level[key] = [self._clean_value(item) for item in value]
                elif isinstance(value, dict):
                    # Clean dict items
                    clean_level[key] = {k: self._clean_value(v) for k, v in value.items()}
                else:
                    # Convert other types to string
                    clean_level[key] = str(value)
            
            return clean_level
        except Exception as e:
            print(f"DEBUG: Error cleaning level data: {e}")
            # Return minimal safe data if cleaning fails
            return {
                'id': level.get('id', 0),
                'name': str(level.get('name', 'Unknown')),
                'description': str(level.get('description', '')),
                'operation': str(level.get('operation', 'addition')),
                'digits': int(level.get('digits', 1)),
                'requirements': {
                    'totalQuestions': 10,
                    'minCorrect': 7
                }
            }
    
    def _clean_value(self, value):
        """Clean a single value for JSON serialization"""
        if isinstance(value, (str, int, float, bool, type(None))):
            return value
        elif isinstance(value, list):
            return [self._clean_value(item) for item in value]
        elif isinstance(value, dict):
            return {k: self._clean_value(v) for k, v in value.items()}
        else:
            return str(value)
    
    def _handle_complete_level(self, payload):
        """Handle level completion"""
        try:
            if not self.levels_manager:
                raise Exception('Levels manager not initialized')
            
            level_id = payload.get('levelId')
            correct_answers = payload.get('correctAnswers', 0)
            total_questions = payload.get('totalQuestions', 0)
            time_taken = payload.get('timeTaken', 0)
            
            print(f"DEBUG: Completing level {level_id} - {correct_answers}/{total_questions} correct, {time_taken}s")
            
            result = self.levels_manager.complete_level(
                level_id, correct_answers, total_questions, time_taken
            )
            
            print(f"DEBUG: Level completion result: {result}")
            
            response = {
                'type': 'complete_level_response',
                'payload': result
            }
            self.messageReceived.emit(json.dumps(response))
        except Exception as e:
            import traceback
            print(f"ERROR in _handle_complete_level: {e}")
            traceback.print_exc()
            response = {
                'type': 'error',
                'payload': {
                    'message': f'Error completing level: {str(e)}'
                }
            }
            self.messageReceived.emit(json.dumps(response))
    
    def _handle_get_level_progress(self, payload):
        """Handle get level progression stats"""
        try:
            if not self.levels_manager:
                raise Exception('Levels manager not initialized')
            
            stats = self.levels_manager.get_progression_stats()
            
            response = {
                'type': 'get_level_progress_response',
                'payload': stats
            }
            self.messageReceived.emit(json.dumps(response))
        except Exception as e:
            response = {
                'type': 'error',
                'payload': {
                    'message': f'Error getting level progress: {str(e)}'
                }
            }
            self.messageReceived.emit(json.dumps(response))
    
    @pyqtSlot()
    def testConnection(self):
        """Test connection from JavaScript"""
        tooltip("Bridge connection successful!")
        self.messageReceived.emit(json.dumps({
            'type': 'connection_test',
            'payload': {'status': 'success'}
        }))

    def _handle_save_settings(self, payload):
        """Handle save settings request"""
        try:
            print(f"DEBUG: _handle_save_settings called with payload: {payload}")
            settings_data = payload.get('settings', {})
            print(f"DEBUG: Extracted settings_data: {settings_data}")
            
            # Get the settings file path
            addon_folder = os.path.dirname(__file__)
            settings_file = os.path.join(addon_folder, "data", "user", "setting.json")
            print(f"DEBUG: Settings file path: {settings_file}")
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(settings_file), exist_ok=True)
            print(f"DEBUG: Directory ensured")
            
            # Save settings to JSON file
            with open(settings_file, 'w', encoding='utf-8') as f:
                json.dump(settings_data, f, indent=2, ensure_ascii=False)
            
            print(f"DEBUG: Settings saved to {settings_file}")
            
            response = {
                'type': 'save_settings_response',
                'payload': {
                    'success': True,
                    'message': 'Settings saved successfully'
                }
            }
            print(f"DEBUG: Sending response: {response}")
            self.messageReceived.emit(json.dumps(response))
        except Exception as e:
            import traceback
            print(f"ERROR in _handle_save_settings: {e}")
            traceback.print_exc()
            response = {
                'type': 'error',
                'payload': {
                    'message': f'Error saving settings: {str(e)}'
                }
            }
            print(f"DEBUG: Sending error response: {response}")
            self.messageReceived.emit(json.dumps(response))
    
    def _handle_load_settings(self, payload):
        """Handle load settings request"""
        try:
            addon_folder = os.path.dirname(__file__)
            settings_file = os.path.join(addon_folder, "data", "user", "setting.json")
            
            settings_data = {}
            
            # Load settings if file exists
            if os.path.exists(settings_file):
                with open(settings_file, 'r', encoding='utf-8') as f:
                    settings_data = json.load(f)
                print(f"DEBUG: Settings loaded from {settings_file}")
            else:
                print(f"DEBUG: Settings file not found at {settings_file}, returning empty")
            
            response = {
                'type': 'load_settings_response',
                'payload': {
                    'settings': settings_data,
                    'success': True
                }
            }
            self.messageReceived.emit(json.dumps(response))
        except Exception as e:
            import traceback
            print(f"ERROR in _handle_load_settings: {e}")
            traceback.print_exc()
            response = {
                'type': 'error',
                'payload': {
                    'message': f'Error loading settings: {str(e)}'
                }
            }
            self.messageReceived.emit(json.dumps(response))

    @pyqtSlot(str)
    def export_data(self, payload_str=None):
        """Handle export data request with file dialog"""
        try:
            from aqt.qt import QFileDialog
            from aqt import mw
            
            # Ask user for save location
            file_path, _ = QFileDialog.getSaveFileName(
                mw, 
                "Export Math Drill Data", 
                f"math_drill_backup_{datetime.now().strftime('%Y-%m-%d')}.json", 
                "JSON Files (*.json)"
            )
            
            if not file_path:
                self.messageReceived.emit(json.dumps({
                    'type': 'export_data_response',
                    'payload': {'success': False, 'message': 'Export cancelled'}
                }))
                return

            addon_folder = os.path.dirname(__file__)
            user_data_dir = os.path.join(addon_folder, "data", "user")
            
            data_to_export = {}
            if os.path.exists(user_data_dir):
                for filename in os.listdir(user_data_dir):
                    if filename.endswith(".json"):
                        file_path_src = os.path.join(user_data_dir, filename)
                        try:
                            with open(file_path_src, 'r', encoding='utf-8') as f:
                                data_to_export[filename] = json.load(f)
                        except Exception as fe:
                            print(f"DEBUG: Could not read {filename}: {fe}")
            
            # Save to chosen path
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data_to_export, f, indent=4, ensure_ascii=False)
            
            response = {
                'type': 'export_data_response',
                'payload': {
                    'success': True,
                    'message': f'Data exported to {file_path}',
                    'path': file_path
                }
            }
            self.messageReceived.emit(json.dumps(response))
            tooltip(f"Data exported successfully to {os.path.basename(file_path)}")
            
        except Exception as e:
            print(f"ERROR in export_data: {e}")
            response = {
                'type': 'error',
                'payload': {'message': f'Export failed: {str(e)}'}
            }
            self.messageReceived.emit(json.dumps(response))

    @pyqtSlot(str)
    def import_data(self, payload_str):
        """Handle import data request"""
        try:
            print(f"DEBUG: Import received payload: {payload_str}")
            payload = json.loads(payload_str)
            # Fix payload extraction
            import_data = payload.get('payload', {}).get('data') or payload.get('data', {})
            
            print(f"DEBUG: Extracted import_data: {import_data}")
            
            if not import_data:
                raise Exception("No data found in import request")

            addon_folder = os.path.dirname(__file__)
            user_data_dir = os.path.join(addon_folder, "data", "user")
            
            print(f"DEBUG: User data dir: {user_data_dir}")
            
            if not os.path.exists(user_data_dir):
                os.makedirs(user_data_dir, exist_ok=True)
            
            # Perform backup before importing
            if self.backup_manager:
                backup_success, backup_result = self.backup_manager.perform_backup(max_backups=5)
                if not backup_success:
                    print(f"WARNING: Backup failed before import: {backup_result}")
                else:
                    print(f"Backup created before import: {backup_result}")
            
            success_files = []
            for filename, content in import_data.items():
                if filename.endswith(".json"):
                    file_path = os.path.join(user_data_dir, filename)
                    print(f"DEBUG: Writing to {file_path} with content: {content}")
                    
                    with open(file_path, 'w', encoding='utf-8') as f:
                        json.dump(content, f, indent=4, ensure_ascii=False)
                    success_files.append(filename)
                    
                    # Verify file was written correctly
                    with open(file_path, 'r', encoding='utf-8') as f:
                        verify_content = json.load(f)
                    print(f"DEBUG: Verification - file content after write: {verify_content}")
            
            # Try to reload managers if they have a reload method or we re-init
            if self.attempts_manager and hasattr(self.attempts_manager, 'load_attempts'):
                self.attempts_manager.attempts_data = self.attempts_manager.load_attempts()
            
            if self.levels_manager and hasattr(self.levels_manager, '_load_data'):
                self.levels_manager._load_data()

            response = {
                'type': 'import_data_response',
                'payload': {
                    'success': True,
                    'imported_files': success_files
                }
            }
            self.messageReceived.emit(json.dumps(response))
            tooltip("Data imported successfully. Please restart the addon for full effect.")
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"ERROR in import_data: {e}")
            response = {
                'type': 'error',
                'payload': {'message': f'Import failed: {str(e)}'}
            }
            self.messageReceived.emit(json.dumps(response))

    @pyqtSlot()
    def open_backup_location(self):
        """Open the backup location in the system file manager"""
        try:
            if not self.backup_manager:
                raise Exception('Backup manager not initialized')
            
            backup_dir = self.backup_manager.backup_dir
            
            # Ensure backup directory exists
            if not os.path.exists(backup_dir):
                os.makedirs(backup_dir, exist_ok=True)
            
            # Open the folder using system file manager
            import subprocess
            import platform
            
            system = platform.system()
            if system == "Windows":
                os.startfile(backup_dir)
            elif system == "Darwin":  # macOS
                subprocess.run(["open", backup_dir])
            else:  # Linux and others
                subprocess.run(["xdg-open", backup_dir])
            
            response = {
                'type': 'open_backup_location_response',
                'payload': {
                    'success': True,
                    'message': f'Opened backup location: {backup_dir}'
                }
            }
            self.messageReceived.emit(json.dumps(response))
            tooltip(f"Opened backup folder")
            
        except Exception as e:
            print(f"ERROR in open_backup_location: {e}")
            response = {
                'type': 'error',
                'payload': {
                    'message': f'Failed to open backup location: {str(e)}'
                }
            }
            self.messageReceived.emit(json.dumps(response))

    @pyqtSlot(str)
    def open_url(self, payload_str):
        """Open URL in system default browser"""
        try:
            print(f"DEBUG: open_url received payload_str: {payload_str}")
            print(f"DEBUG: Type of payload_str: {type(payload_str)}")
            
            payload = json.loads(payload_str)
            print(f"DEBUG: Parsed payload: {payload}")
            print(f"DEBUG: Payload type: {type(payload)}")
            
            url = payload.get('url', '')
            print(f"DEBUG: Extracted URL: {url}")
            
            if not url:
                # Try to get URL from nested payload structure
                if 'payload' in payload and 'url' in payload['payload']:
                    url = payload['payload']['url']
                    print(f"DEBUG: Extracted URL from nested payload: {url}")
                
                if not url:
                    raise Exception('No URL provided')
            
            print(f"DEBUG: Attempting to open URL: {url}")
            
            # Try multiple methods to open URL
            import webbrowser
            import subprocess
            import platform
            
            # Method 1: Try webbrowser module
            try:
                webbrowser.open(url)
                print(f"DEBUG: webbrowser.open() succeeded for {url}")
            except Exception as e1:
                print(f"DEBUG: webbrowser.open() failed: {e1}")
                
                # Method 2: Try platform-specific commands
                system = platform.system()
                try:
                    if system == "Windows":
                        os.startfile(url)
                        print(f"DEBUG: os.startfile() succeeded for {url}")
                    elif system == "Darwin":  # macOS
                        subprocess.run(["open", url], check=True)
                        print(f"DEBUG: subprocess open (macOS) succeeded for {url}")
                    else:  # Linux
                        subprocess.run(["xdg-open", url], check=True)
                        print(f"DEBUG: subprocess xdg-open (Linux) succeeded for {url}")
                except Exception as e2:
                    print(f"DEBUG: Platform-specific command failed: {e2}")
                    raise Exception(f"Both webbrowser and system commands failed: {e1}, {e2}")
            
            response = {
                'type': 'open_url_response',
                'payload': {
                    'success': True,
                    'message': f'Opened URL: {url}'
                }
            }
            self.messageReceived.emit(json.dumps(response))
            tooltip(f"Opening in browser...")
            
        except Exception as e:
            print(f"ERROR in open_url: {e}")
            import traceback
            traceback.print_exc()
            response = {
                'type': 'error',
                'payload': {
                    'message': f'Failed to open URL: {str(e)}'
                }
            }
            self.messageReceived.emit(json.dumps(response))

    def _handle_save_session(self, payload):
        """Handle saving session data"""
        try:
            addon_folder = os.path.dirname(__file__)
            sessions_file = os.path.join(addon_folder, "data", "user", "sessions.json")
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(sessions_file), exist_ok=True)
            
            # Load existing sessions
            sessions = []
            if os.path.exists(sessions_file):
                with open(sessions_file, 'r', encoding='utf-8') as f:
                    sessions = json.load(f)
            
            # Add new session
            if isinstance(payload, dict):
                sessions.append(payload)
            
            # Save sessions
            with open(sessions_file, 'w', encoding='utf-8') as f:
                json.dump(sessions, f, indent=2, ensure_ascii=False)
            
            response = {
                'type': 'save_session_response',
                'payload': {
                    'success': True,
                    'message': 'Session saved successfully'
                }
            }
            self.messageReceived.emit(json.dumps(response))
            
        except Exception as e:
            print(f"ERROR in save_session: {e}")
            response = {
                'type': 'error',
                'payload': {
                    'message': f'Failed to save session: {str(e)}'
                }
            }
            self.messageReceived.emit(json.dumps(response))

    def _handle_load_sessions(self, payload):
        """Handle loading session data"""
        try:
            addon_folder = os.path.dirname(__file__)
            sessions_file = os.path.join(addon_folder, "data", "user", "sessions.json")
            
            sessions = []
            if os.path.exists(sessions_file):
                with open(sessions_file, 'r', encoding='utf-8') as f:
                    sessions = json.load(f)
            
            response = {
                'type': 'load_sessions_response',
                'payload': {
                    'sessions': sessions,
                    'count': len(sessions)
                }
            }
            self.messageReceived.emit(json.dumps(response))
            
        except Exception as e:
            print(f"ERROR in load_sessions: {e}")
            response = {
                'type': 'error',
                'payload': {
                    'message': f'Failed to load sessions: {str(e)}'
                }
            }
            self.messageReceived.emit(json.dumps(response))

    def _handle_clear_sessions(self, payload):
        """Handle clearing session data"""
        try:
            addon_folder = os.path.dirname(__file__)
            sessions_file = os.path.join(addon_folder, "data", "user", "sessions.json")
            
            if os.path.exists(sessions_file):
                os.remove(sessions_file)
            
            response = {
                'type': 'clear_sessions_response',
                'payload': {
                    'success': True,
                    'message': 'Sessions cleared successfully'
                }
            }
            self.messageReceived.emit(json.dumps(response))
            
        except Exception as e:
            print(f"ERROR in clear_sessions: {e}")
            response = {
                'type': 'error',
                'payload': {
                    'message': f'Failed to clear sessions: {str(e)}'
                }
            }
            self.messageReceived.emit(json.dumps(response))
