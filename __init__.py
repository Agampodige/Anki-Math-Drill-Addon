from aqt import mw
from aqt.qt import QAction
from aqt.utils import showInfo
from .main import show_addon_dialog

# Initialize the addon
def init():
    # Create the submenu
    math_drill_menu = mw.form.menuTools.addMenu("Mathdrill")
    
    # Practice Mode Action
    action_practice = QAction("Practice mod", mw)
    action_practice.triggered.connect(lambda: show_addon_dialog("practice_mode.html"))
    math_drill_menu.addAction(action_practice)

    # Levels Action
    action_levels = QAction("Levels", mw)
    action_levels.triggered.connect(lambda: show_addon_dialog("levels.html"))
    math_drill_menu.addAction(action_levels)
    
    showInfo("Math Drill addon loaded successfully!")

# Call init to register the addon
init()
