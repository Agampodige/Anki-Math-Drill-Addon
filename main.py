from aqt import mw
from aqt.qt import QDialog, QVBoxLayout, QWebEngineView, QUrl, QWebEngineSettings, QShortcut, QKeySequence
from .bridge import Bridge
from .attempts_manager import AttemptsManager
from .levels_manager import LevelsManager
import os

class AddonDialog(QDialog):
    def __init__(self, page="index.html"):
        super().__init__(mw)
        self.setWindowTitle("Math Drill")
        self.setMinimumSize(3, 600)
        
        # Create layout
        layout = QVBoxLayout(self)
        
        # Create web view
        self.web = QWebEngineView()
        try:
            # Try to enable developer tools - handles different PyQt versions/Anki environments
            settings = self.web.settings()
            if hasattr(QWebEngineSettings, 'WebAttribute') and hasattr(QWebEngineSettings.WebAttribute, 'DeveloperExtrasEnabled'):
                settings.setAttribute(QWebEngineSettings.WebAttribute.DeveloperExtrasEnabled, True)
            elif hasattr(QWebEngineSettings, 'DeveloperExtrasEnabled'):
                settings.setAttribute(QWebEngineSettings.DeveloperExtrasEnabled, True)
            else:
                print("Warning: Could not find DeveloperExtrasEnabled attribute")
                # print(f"Available attributes on QWebEngineSettings: {dir(QWebEngineSettings)}")
        except Exception as e:
            print(f"Error enabling developer tools: {e}")
        layout.addWidget(self.web)
        
        # Initialize managers
        addon_folder = os.path.dirname(__file__)
        self.attempts_manager = AttemptsManager(addon_folder)
        self.levels_manager = LevelsManager(addon_folder)
        
        # Set up bridge with both managers
        self.bridge = Bridge(self, self.attempts_manager, self.levels_manager)
        self.web.page().setWebChannel(self.bridge.channel)
        
        # Load HTML file
        html_path = os.path.join(addon_folder, "web", page)
        self.web.load(QUrl.fromLocalFile(html_path))
        
        self.setLayout(layout)
        
        # Add F12 shortcut for developer tools
        self.f12_shortcut = QShortcut(QKeySequence("F12"), self)
        self.f12_shortcut.activated.connect(self.toggle_inspector)
        
    def toggle_inspector(self):
        """Toggle the web inspector in a separate window"""
        if not hasattr(self, "inspector"):
            self.inspector = QWebEngineView()
            self.web.page().setDevToolsPage(self.inspector.page())
        
        if self.inspector.isVisible():
            self.inspector.hide()
        else:
            self.inspector.setWindowTitle(f"Inspector - {self.windowTitle()}")
            self.inspector.resize(1000, 700)
            self.inspector.show()
            self.inspector.raise_()
            self.inspector.activateWindow()

def show_addon_dialog(page="index.html"):
    """Show the addon dialog"""
    dialog = AddonDialog(page)
    dialog.exec()
