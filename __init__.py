from aqt import mw
from aqt.qt import QAction, QMessageBox
import traceback
import sys
import os

from .main_webengine import MathDrillWebEngine  # Use WebEngine version
from .json_storage import init_json_storage  # Initialize settings storage
from .hot_reload import init_hot_reload, get_hot_reloader

# Initialize settings storage when addon loads
try:
    init_json_storage()
    print("Math Drill: Settings storage initialized")
except Exception as e:
    print(f"Math Drill: Warning - Could not initialize settings storage: {e}")

# Initialize hot reload system
try:
    addon_dir = os.path.dirname(__file__)
    hot_reloader = init_hot_reload(addon_dir)
    
    # Watch main Python modules
    import main_webengine
    import json_storage
    import database
    import database_api
    import analytics
    import gamification
    import levels
    import coach
    
    hot_reloader.add_module('main_webengine', main_webengine)
    hot_reloader.add_module('json_storage', json_storage)
    hot_reloader.add_module('database', database)
    hot_reloader.add_module('database_api', database_api)
    hot_reloader.add_module('analytics', analytics)
    hot_reloader.add_module('gamification', gamification)
    hot_reloader.add_module('levels', levels)
    hot_reloader.add_module('coach', coach)
    
    # Watch web files
    web_files = [
        'web/index.html', 'web/script.js', 'web/styles.css',
        'web/settings.html', 'web/settings.js',
        'web/progress.html', 'web/progress.js',
        'web/levels.html', 'web/levels.js',
        'web/achievements.html', 'web/achievements.js',
        'web/weakness.html', 'web/weakness.js'
    ]
    
    for web_file in web_files:
        hot_reloader.add_web_file(web_file)
    
    print("Math Drill: Hot reload system initialized")
except Exception as e:
    print(f"Math Drill: Warning - Could not initialize hot reload: {e}")

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
