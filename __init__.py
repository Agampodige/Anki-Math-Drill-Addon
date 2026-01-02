from aqt import mw
from aqt.qt import QAction, QMessageBox
import traceback

from .main_webengine import MathDrillWebEngine  # Use WebEngine version

def open_math_drill():
    try:
        dialog = MathDrillWebEngine(mw)
        dialog.show()
    except Exception as e:
        print("=== MathDrill Error ===")
        traceback.print_exc()
        QMessageBox.critical(mw, "MathDrill Error", str(e))

action = QAction("Math Drill", mw)
action.triggered.connect(open_math_drill)
mw.form.menuTools.addAction(action)
