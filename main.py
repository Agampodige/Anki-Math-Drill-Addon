from aqt import mw
from aqt.qt import QDialog, QVBoxLayout, QWebEngineView, QUrl, QWebEngineSettings, QShortcut, QKeySequence, Qt, QMenu, QAction, QPushButton, QHBoxLayout
from .bridge import Bridge
from .attempts_manager import AttemptsManager
from .levels_manager import LevelsManager
import os

class AddonDialog(QDialog):
    def __init__(self, page="index.html"):
        super().__init__(mw)
        self.setWindowTitle("Math Drill")
        self.resize(900, 700)  # Set proper initial size instead of minimum
        
        # Use proper window flags for better event handling
        if hasattr(Qt, "WindowType"):
            flags = (Qt.WindowType.Window | 
                    Qt.WindowType.WindowCloseButtonHint | 
                    Qt.WindowType.WindowMinMaxButtonsHint)
        else:
            flags = (Qt.Window | 
                    Qt.WindowCloseButtonHint | 
                    Qt.WindowMinMaxButtonsHint)
            
        self.setWindowFlags(flags)
        
        # Create layout
        layout = QVBoxLayout(self)
        
        # Create web view
        self.web = QWebEngineView()
        # Disable developer tools for production
        try:
            settings = self.web.settings()
            if hasattr(QWebEngineSettings, 'WebAttribute') and hasattr(QWebEngineSettings.WebAttribute, 'DeveloperExtrasEnabled'):
                settings.setAttribute(QWebEngineSettings.WebAttribute.DeveloperExtrasEnabled, False)
            elif hasattr(QWebEngineSettings, 'DeveloperExtrasEnabled'):
                settings.setAttribute(QWebEngineSettings.DeveloperExtrasEnabled, False)
        except Exception as e:
            print(f"Error disabling developer tools: {e}")
        
        # Enable various web view features for better interaction
        try:
            settings = self.web.settings()
            # Enable JavaScript and other features
            if hasattr(QWebEngineSettings, 'WebAttribute'):
                settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
                settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
                settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
                settings.setAttribute(QWebEngineSettings.WebAttribute.AllowRunningInsecureContent, True)
                # Disable context menu for production
                settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanOpenWindows, False)
        except Exception as e:
            print(f"Error enabling web view features: {e}")
            
        layout.addWidget(self.web)
        
        # Initialize managers
        addon_folder = os.path.dirname(__file__)
        self.attempts_manager = AttemptsManager(addon_folder)
        self.levels_manager = LevelsManager(addon_folder)
        
        # Initialize Backup Manager
        from .backup_manager import BackupManager
        self.backup_manager = BackupManager(addon_folder)
        
        # Set up bridge with all managers
        self.bridge = Bridge(self, self.attempts_manager, self.levels_manager, self.backup_manager)
        self.web.page().setWebChannel(self.bridge.channel)
        
        # Trigger automatic backup if enabled
        self._trigger_auto_backup()
        
        # Load HTML file
        html_path = os.path.join(addon_folder, "web", page)
        self.web.load(QUrl.fromLocalFile(html_path))
        
        self.setLayout(layout)
        
        # Ensure web view gets focus for proper event handling
        self.web.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        self.setFocusProxy(self.web)
        
        
    def _trigger_auto_backup(self):
        """Perform automatic backup if enabled in settings"""
        try:
            addon_folder = os.path.dirname(__file__)
            settings_file = os.path.join(addon_folder, "data", "user", "setting.json")
            
            auto_backup = True
            max_backups = 5
            
            if os.path.exists(settings_file):
                import json
                with open(settings_file, 'r', encoding='utf-8') as f:
                    settings = json.load(f)
                    auto_backup = settings.get('autoBackup', True)
                    max_backups = settings.get('maxBackups', 5)
            
            if auto_backup:
                self.backup_manager.perform_backup(max_backups=max_backups)
        except Exception as e:
            print(f"Auto backup trigger error: {e}")
    
    def showEvent(self, event):
        """Override show event to ensure web view gets focus"""
        super().showEvent(event)
        # Give focus to web view after a short delay to ensure proper initialization
        from aqt.qt import QTimer
        QTimer.singleShot(100, lambda: self.web.setFocus())
        

def show_addon_dialog(page="index.html"):
    """Show the addon dialog"""
    dialog = AddonDialog(page)
    dialog.exec()
