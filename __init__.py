from aqt import mw
from aqt.qt import QAction
from aqt.utils import showInfo
from .main import show_addon_dialog

# Initialize the addon
def init():
    # Create a single action in the Tools menu
    action = QAction("Anki Math Drill", mw)
    action.triggered.connect(lambda: show_addon_dialog("index.html"))
    mw.form.menuTools.addAction(action)
    
    # print("Math Drill addon menu entry registered")

# Call init to register the addon
init()
