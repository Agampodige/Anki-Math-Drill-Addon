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
            flags = Qt.WindowType.Window | Qt.WindowType.WindowCloseButtonHint | Qt.WindowType.WindowMinMaxButtonsHint
        else:
            flags = Qt.Window | Qt.WindowCloseButtonHint | Qt.WindowMinMaxButtonsHint
            
        self.setWindowFlags(flags)
        
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
        
        # Enable various web view features for better interaction
        try:
            settings = self.web.settings()
            # Enable JavaScript and other features
            if hasattr(QWebEngineSettings, 'WebAttribute'):
                settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
                settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
                settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
                settings.setAttribute(QWebEngineSettings.WebAttribute.AllowRunningInsecureContent, True)
                # Enable context menu
                settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanOpenWindows, True)
        except Exception as e:
            print(f"Error enabling web view features: {e}")
            
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
        
        # Ensure web view gets focus for proper event handling
        self.web.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        self.setFocusProxy(self.web)
        
        # Add F12 shortcut for developer tools
        self.f12_shortcut = QShortcut(QKeySequence("F12"), self)
        self.f12_shortcut.activated.connect(self.toggle_inspector)
        
        # Enable context menu for the web view
        self.web.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.web.customContextMenuRequested.connect(self.show_context_menu)
    
    def showEvent(self, event):
        """Override show event to ensure web view gets focus"""
        super().showEvent(event)
        # Give focus to web view after a short delay to ensure proper initialization
        from aqt.qt import QTimer
        QTimer.singleShot(100, lambda: self.web.setFocus())
        
    def show_context_menu(self, position):
        """Show custom context menu with inspector option"""
        menu = QMenu(self)
        
        # Add inspector action
        inspect_action = QAction("🔍 Open Developer Tools", self)
        inspect_action.triggered.connect(self.open_inspector_external)
        menu.addAction(inspect_action)
        
        # Add separator
        menu.addSeparator()
        
        # Add standard actions
        reload_action = QAction("🔄 Reload", self)
        reload_action.triggered.connect(self.web.reload)
        menu.addAction(reload_action)
        
        # Show the menu
        menu.popup(self.web.mapToGlobal(position))
    
    def open_inspector_external(self):
        """Open inspector in a proper Qt window"""
        try:
            # Check if inspector already exists
            if hasattr(self, 'inspector_window') and self.inspector_window is not None:
                if self.inspector_window.isVisible():
                    self.inspector_window.hide()
                else:
                    self.inspector_window.show()
                    self.inspector_window.raise_()
                    self.inspector_window.activateWindow()
                return
            
            # Create inspector window
            from aqt.qt import QDialog, QVBoxLayout, QWebEngineView, QPushButton, QHBoxLayout
            
            self.inspector_window = QDialog(self)
            self.inspector_window.setWindowTitle("Developer Tools - Math Drill")
            self.inspector_window.resize(1200, 800)
            
            # Set window flags for proper behavior
            if hasattr(Qt, "WindowType"):
                flags = (Qt.WindowType.Window | 
                        Qt.WindowType.WindowCloseButtonHint | 
                        Qt.WindowType.WindowMinMaxButtonsHint)
            else:
                flags = (Qt.Window | 
                        Qt.WindowCloseButtonHint | 
                        Qt.WindowMinMaxButtonsHint)
            self.inspector_window.setWindowFlags(flags)
            
            # Create layout
            layout = QVBoxLayout(self.inspector_window)
            
            # Create web view for inspector
            self.inspector_web = QWebEngineView()
            layout.addWidget(self.inspector_web)
            
            # Add button bar
            button_layout = QHBoxLayout()
            
            reload_btn = QPushButton("🔄 Reload Inspector")
            reload_btn.clicked.connect(self.reload_inspector)
            button_layout.addWidget(reload_btn)
            
            close_btn = QPushButton("❌ Close")
            close_btn.clicked.connect(self.inspector_window.hide)
            button_layout.addWidget(close_btn)
            
            layout.addLayout(button_layout)
            
            # Set up the inspector
            self.setup_inspector()
            
            # Show the window
            self.inspector_window.show()
            self.inspector_window.raise_()
            self.inspector_window.activateWindow()
            
        except Exception as e:
            from aqt.utils import showInfo
            showInfo(f"Could not create inspector: {e}")
            print(f"Inspector creation error: {e}")
    
    def setup_inspector(self):
        """Set up the inspector connection"""
        try:
            main_page = self.web.page()
            inspector_page = self.inspector_web.page()
            
            # Enable developer tools on both pages
            for page in [main_page, inspector_page]:
                try:
                    settings = page.settings()
                    if hasattr(QWebEngineSettings, 'WebAttribute') and hasattr(QWebEngineSettings.WebAttribute, 'DeveloperExtrasEnabled'):
                        settings.setAttribute(QWebEngineSettings.WebAttribute.DeveloperExtrasEnabled, True)
                    elif hasattr(QWebEngineSettings, 'DeveloperExtrasEnabled'):
                        settings.setAttribute(QWebEngineSettings.DeveloperExtrasEnabled, True)
                except:
                    pass
            
            # Try to connect inspector
            inspector_connected = False
            
            # Method 1: Modern QtWebEngine approach
            try:
                main_page.setDevToolsPage(inspector_page)
                inspector_connected = True
                print("Inspector connected using modern approach")
            except AttributeError:
                pass
            
            # Method 2: Alternative approach
            if not inspector_connected:
                try:
                    inspector_page.setInspectedPage(main_page)
                    inspector_connected = True
                    print("Inspector connected using alternative approach")
                except AttributeError:
                    pass
            
            # Method 3: Load inspector manually
            if not inspector_connected:
                try:
                    # Load Chrome DevTools manually
                    inspector_html = """
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>DevTools</title>
                        <style>
                            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
                            .info { background: #f0f0f0; padding: 15px; border-radius: 5px; }
                            .console { background: #000; color: #0f0; padding: 10px; margin: 10px 0; border-radius: 5px; font-family: monospace; height: 200px; overflow-y: auto; }
                            button { background: #007cba; color: white; border: none; padding: 10px 15px; margin: 5px; border-radius: 3px; cursor: pointer; }
                            button:hover { background: #005a87; }
                        </style>
                    </head>
                    <body>
                        <div class="info">
                            <h3>🔍 Math Drill Developer Tools</h3>
                            <p>Connected to main application. Use the console below to interact with the page.</p>
                        </div>
                        
                        <div>
                            <button onclick="inspectElement()">🔍 Inspect Element</button>
                            <button onclick="showConsole()">📝 Console</button>
                            <button onclick="reloadPage()">🔄 Reload Page</button>
                            <button onclick="clearConsole()">🗑️ Clear Console</button>
                        </div>
                        
                        <div id="console" class="console">
                            <div>Console ready. Type JavaScript commands here.</div>
                        </div>
                        
                        <input type="text" id="commandInput" style="width: 80%; padding: 5px;" placeholder="Enter JavaScript command..." onkeypress="if(event.key==='Enter') executeCommand()">
                        <button onclick="executeCommand()">Execute</button>
                        
                        <script>
                            let inspectedWindow = window.opener || window.parent;
                            
                            function log(message) {
                                const console = document.getElementById('console');
                                const div = document.createElement('div');
                                div.textContent = '> ' + message;
                                console.appendChild(div);
                                console.scrollTop = console.scrollHeight;
                            }
                            
                            function executeCommand() {
                                const input = document.getElementById('commandInput');
                                const command = input.value;
                                if (!command) return;
                                
                                log(command);
                                try {
                                    // Try to execute in the main window context
                                    if (inspectedWindow && inspectedWindow.eval) {
                                        const result = inspectedWindow.eval(command);
                                        log('Result: ' + JSON.stringify(result));
                                    } else {
                                        log('Cannot access main window context');
                                    }
                                } catch (e) {
                                    log('Error: ' + e.message);
                                }
                                input.value = '';
                            }
                            
                            function inspectElement() {
                                log('Click on an element in the main window to inspect it');
                                // This would require more complex implementation
                            }
                            
                            function showConsole() {
                                document.getElementById('console').scrollIntoView();
                            }
                            
                            function reloadPage() {
                                if (inspectedWindow && inspectedWindow.location) {
                                    inspectedWindow.location.reload();
                                    log('Page reloaded');
                                }
                            }
                            
                            function clearConsole() {
                                document.getElementById('console').innerHTML = '<div>Console cleared.</div>';
                            }
                            
                            // Capture console messages from main window
                            window.addEventListener('message', function(event) {
                                if (event.data.type === 'console') {
                                    log(event.data.message);
                                }
                            });
                        </script>
                    </body>
                    </html>
                    """
                    
                    self.inspector_web.setHtml(inspector_html)
                    inspector_connected = True
                    print("Inspector loaded with custom interface")
                except Exception as e:
                    print(f"Failed to load custom inspector: {e}")
            
            if not inspector_connected:
                print("Could not connect inspector - showing basic HTML")
                self.inspector_web.setHtml("<html><body><h2>Inspector could not be connected</h2></body></html>")
            
        except Exception as e:
            print(f"Inspector setup error: {e}")
    
    def reload_inspector(self):
        """Reload the inspector"""
        try:
            self.setup_inspector()
        except Exception as e:
            print(f"Error reloading inspector: {e}")
        
    def toggle_inspector(self):
        """Toggle the web inspector - opens in external browser"""
        try:
            # Get the current page and trigger devtools to open in external browser
            main_page = self.web.page()
            
            # Enable developer tools if not already enabled
            try:
                settings = main_page.settings()
                if hasattr(QWebEngineSettings, 'WebAttribute') and hasattr(QWebEngineSettings.WebAttribute, 'DeveloperExtrasEnabled'):
                    settings.setAttribute(QWebEngineSettings.WebAttribute.DeveloperExtrasEnabled, True)
                elif hasattr(QWebEngineSettings, 'DeveloperExtrasEnabled'):
                    settings.setAttribute(QWebEngineSettings.DeveloperExtrasEnabled, True)
            except:
                pass
            
            # Try to open devtools in external browser using JavaScript
            js_code = """
            (function() {
                // Try to open devtools in new window
                if (typeof window.open !== 'undefined') {
                    var devtoolsWindow = window.open('', '_blank', 'width=1200,height=800');
                    if (devtoolsWindow) {
                        devtoolsWindow.location.href = 'devtools://devtools/bundled/inspector.html?ws=' + window.location.host;
                        return true;
                    }
                }
                
                // Alternative: try right-click context menu approach
                if (document.createEvent) {
                    var event = document.createEvent('MouseEvent');
                    event.initMouseEvent('contextmenu', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 2, null);
                    document.dispatchEvent(event);
                }
                
                return false;
            })();
            """
            
            main_page.runJavaScript(js_code)
            
            # Show info to user
            from aqt.utils import showInfo
            showInfo("Developer tools should open in a new browser window. If it doesn't work, try right-clicking in the addon and selecting 'Inspect' from the context menu.")
            
        except Exception as e:
            from aqt.utils import showInfo
            showInfo(f"Could not open developer tools: {e}\n\nTry right-clicking in the addon and selecting 'Inspect' from the context menu.")

def show_addon_dialog(page="index.html"):
    """Show the addon dialog"""
    dialog = AddonDialog(page)
    dialog.exec()
