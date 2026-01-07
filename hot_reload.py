import os
import sys
import time
import threading
import importlib
from datetime import datetime
from aqt.qt import QObject, pyqtSignal

class HotReloader(QObject):
    """Hot reload system for Python modules and web files"""
    
    file_changed = pyqtSignal(str)  # Signal emitted when a file changes
    
    def __init__(self, addon_dir):
        super().__init__()
        self.addon_dir = addon_dir
        self.watched_modules = {}
        self.watched_files = {}
        self.last_check = {}
        self.running = False
        self.check_interval = 1.0  # Check every second
        
    def add_module(self, module_name, module_obj):
        """Add a Python module to watch for changes"""
        if hasattr(module_obj, '__file__') and module_obj.__file__:
            file_path = module_obj.__file__
            self.watched_modules[module_name] = {
                'module': module_obj,
                'file_path': file_path,
                'last_mtime': os.path.getmtime(file_path)
            }
            print(f"Hot Reload: Watching module {module_name} -> {file_path}")
    
    def add_web_file(self, file_path):
        """Add a web file to watch for changes"""
        full_path = os.path.join(self.addon_dir, file_path)
        if os.path.exists(full_path):
            self.watched_files[file_path] = {
                'full_path': full_path,
                'last_mtime': os.path.getmtime(full_path)
            }
            print(f"Hot Reload: Watching web file {file_path}")
    
    def start(self):
        """Start the hot reload monitoring thread"""
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
            self.thread.start()
            print("Hot Reload: Monitoring started")
    
    def stop(self):
        """Stop the hot reload monitoring"""
        self.running = False
        if hasattr(self, 'thread'):
            self.thread.join(timeout=2)
        print("Hot Reload: Monitoring stopped")
    
    def _monitor_loop(self):
        """Main monitoring loop"""
        while self.running:
            try:
                self._check_modules()
                self._check_web_files()
                time.sleep(self.check_interval)
            except Exception as e:
                print(f"Hot Reload Error: {e}")
                time.sleep(self.check_interval)
    
    def _check_modules(self):
        """Check for changes in Python modules"""
        for module_name, info in list(self.watched_modules.items()):
            try:
                current_mtime = os.path.getmtime(info['file_path'])
                if current_mtime > info['last_mtime']:
                    print(f"Hot Reload: Module {module_name} changed, reloading...")
                    info['last_mtime'] = current_mtime
                    
                    # Reload the module
                    try:
                        importlib.reload(info['module'])
                        print(f"Hot Reload: Successfully reloaded {module_name}")
                        self.file_changed.emit(f"module:{module_name}")
                    except Exception as e:
                        print(f"Hot Reload: Failed to reload {module_name}: {e}")
                        
            except FileNotFoundError:
                print(f"Hot Reload: Module file not found: {info['file_path']}")
            except Exception as e:
                print(f"Hot Reload: Error checking module {module_name}: {e}")
    
    def _check_web_files(self):
        """Check for changes in web files"""
        for file_path, info in list(self.watched_files.items()):
            try:
                current_mtime = os.path.getmtime(info['full_path'])
                if current_mtime > info['last_mtime']:
                    print(f"Hot Reload: Web file {file_path} changed")
                    info['last_mtime'] = current_mtime
                    self.file_changed.emit(f"web:{file_path}")
                    
            except FileNotFoundError:
                print(f"Hot Reload: Web file not found: {info['full_path']}")
            except Exception as e:
                print(f"Hot Reload: Error checking web file {file_path}: {e}")

# Global hot reloader instance
_hot_reloader = None

def init_hot_reload(addon_dir):
    """Initialize the hot reload system"""
    global _hot_reloader
    if _hot_reloader is None:
        _hot_reloader = HotReloader(addon_dir)
        _hot_reloader.start()
        return _hot_reloader
    return _hot_reloader

def get_hot_reloader():
    """Get the global hot reloader instance"""
    return _hot_reloader

def stop_hot_reload():
    """Stop the hot reload system"""
    global _hot_reloader
    if _hot_reloader:
        _hot_reloader.stop()
        _hot_reloader = None
