from aqt.qt import QObject, pyqtSignal, QWebChannel, pyqtSlot
from aqt.utils import showInfo, askUser, tooltip
from aqt import mw
import json
import os

class Bridge(QObject):
    """Bridge for communication between Python and JavaScript"""
    
    def __init__(self, parent=None, attempts_manager=None, levels_manager=None):
        super().__init__(parent)
        self.channel = QWebChannel()
        self.channel.registerObject("pybridge", self)
        self.attempts_manager = attempts_manager
        self.levels_manager = levels_manager
    
    # Signals to JavaScript
    messageReceived = pyqtSignal(str)
    
    @pyqtSlot(str)
    def sendMessage(self, message):
        """Receive message from JavaScript"""
        try:
            data = json.loads(message)
            msg_type = data.get('type', '')
            payload = data.get('payload', {})
            
            print(f"DEBUG: Received message type: {msg_type}")
            
            if msg_type == 'hello':
                self._handle_hello(payload)
            elif msg_type == 'get_cards':
                self._handle_get_cards(payload)
            elif msg_type == 'show_info':
                self._handle_show_info(payload)
            elif msg_type == 'save_attempts':
                self._handle_save_attempts(payload)
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
                self._handle_save_settings(payload)
            elif msg_type == 'load_settings':
                self._handle_load_settings(payload)
            elif msg_type == 'export_data':
                self.export_data()
            elif msg_type == 'import_data':
                self.import_data(message)
            else:
                self.messageReceived.emit(json.dumps({
                    'type': 'error',
                    'payload': {'message': f'Unknown message type: {msg_type}'}
                }))
                
        except Exception as e:
            self.messageReceived.emit(json.dumps({
                'type': 'error',
                'payload': {'message': f'Error processing message: {str(e)}'}
            }))
    
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
            
            levels = self.levels_manager.get_all_levels()
            stats = self.levels_manager.get_progression_stats()
            
            print(f"DEBUG: Loading levels - found {len(levels)} levels")
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
            
            response = {
                'type': 'get_level_response',
                'payload': level
            }
            self.messageReceived.emit(json.dumps(response))
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
            self.messageReceived.emit(json.dumps(response))
    
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
            if not self.levels_manager:
                raise Exception('Levels manager not initialized')
            
            settings_data = payload.get('settings', {})
            
            # Get the settings file path
            addon_folder = os.path.dirname(__file__)
            settings_file = os.path.join(addon_folder, "data", "user", "setting.json")
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(settings_file), exist_ok=True)
            
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
        """Handle export data request"""
        try:
            addon_folder = os.path.dirname(__file__)
            user_data_dir = os.path.join(addon_folder, "data", "user")
            
            data_to_export = {}
            if os.path.exists(user_data_dir):
                for filename in os.listdir(user_data_dir):
                    if filename.endswith(".json"):
                        file_path = os.path.join(user_data_dir, filename)
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                data_to_export[filename] = json.load(f)
                        except Exception as fe:
                            print(f"DEBUG: Could not read {filename}: {fe}")
            
            response = {
                'type': 'export_data_response',
                'payload': {
                    'data': data_to_export,
                    'success': True
                }
            }
            # Note: Using sendMessage for response consistency if needed, 
            # but usually slots emit messageReceived signals
            self.messageReceived.emit(json.dumps(response))
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
            payload = json.loads(payload_str)
            import_data = payload.get('data', {})
            
            addon_folder = os.path.dirname(__file__)
            user_data_dir = os.path.join(addon_folder, "data", "user")
            
            if not os.path.exists(user_data_dir):
                os.makedirs(user_data_dir, exist_ok=True)
            
            success_files = []
            for filename, content in import_data.items():
                if filename.endswith(".json"):
                    file_path = os.path.join(user_data_dir, filename)
                    # Create backup
                    if os.path.exists(file_path):
                        shutil.copy2(file_path, file_path + ".bak")
                    
                    with open(file_path, 'w', encoding='utf-8') as f:
                        json.dump(content, f, indent=4)
                    success_files.append(filename)
            
            response = {
                'type': 'import_data_response',
                'payload': {
                    'success': True,
                    'imported_files': success_files
                }
            }
            self.messageReceived.emit(json.dumps(response))
            # Optional: Refresh managers if needed, or user can restart
            tooltip("Data imported successfully. Please restart the addon to apply changes.")
        except Exception as e:
            print(f"ERROR in import_data: {e}")
            response = {
                'type': 'error',
                'payload': {'message': f'Import failed: {str(e)}'}
            }
            self.messageReceived.emit(json.dumps(response))
