from aqt import mw
from aqt.qt import QDialog, QVBoxLayout, QWebEngineView, QUrl, QWebEngineSettings
from .bridge import Bridge
from .attempts_manager import AttemptsManager
from .levels_manager import LevelsManager
import os

class AddonDialog(QDialog):
    def __init__(self, page="index.html"):
        super().__init__(mw)
        self.setWindowTitle("Math Drill")
        self.setMinimumSize(800, 600)
        
        # Create layout
        layout = QVBoxLayout(self)
        
        # Create web view
        self.web = QWebEngineView()
        self.web.settings().setAttribute(QWebEngineSettings.DeveloperExtrasEnabled, True)
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

def show_addon_dialog(page="index.html"):
    """Show the addon dialog"""
    dialog = AddonDialog(page)
    dialog.exec()
