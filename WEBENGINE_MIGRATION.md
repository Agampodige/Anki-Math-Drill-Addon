# Math Drill WebEngine Migration

## Overview

This document describes the migration from native Qt widgets to a modern web-based UI using PyQt6-WebEngine.

## What Changed

### New Architecture
- **Frontend**: Modern HTML/CSS/JavaScript interface
- **Backend**: Python with WebEngine integration
- **Communication**: QWebChannel bridge between Python and JavaScript

### Files Added
- `web/index.html` - Main HTML structure
- `web/styles.css` - Modern CSS styling with CSS variables
- `web/script.js` - JavaScript application logic
- `main_webengine.py` - WebEngine integration and Python bridge
- `test_webengine.py` - Test script for the new interface

### Files Modified
- `requirements.txt` - Added PyQt6-WebEngine dependency
- `__init__.py` - Updated to use WebEngine version
- `main.py` - Kept as fallback (original Qt implementation)

## Features

### Modern Web UI
- Clean, responsive design with modern CSS
- Smooth animations and transitions
- Better typography and spacing
- Mobile-friendly responsive layout

### All Original Features Preserved
- ✅ All math operations (Addition, Subtraction, Multiplication, Division)
- ✅ All game modes (Free Play, Drill, Sprint, Adaptive Coach)
- ✅ Statistics and analytics
- ✅ Achievement system
- ✅ Weakness analysis
- ✅ Mastery grid
- ✅ Sound effects
- ✅ Keyboard shortcuts
- ✅ Session management
- ✅ Retake mistakes feature

### Enhanced Features
- Better visual feedback with CSS animations
- Improved modal dialogs
- More responsive interface
- Modern color scheme with CSS variables

## Installation

### Requirements
```bash
pip install PyQt6 PyQt6-WebEngine pygame
```

### Testing
Run the test script to verify the WebEngine interface:
```bash
python test_webengine.py
```

## Architecture

### Python Bridge
The `PythonBridge` class handles communication between Python and JavaScript:

```python
@pyqtSlot(str, str, str)
def send(self, action, data_str, callback_id):
    # Handle JavaScript requests
```

### JavaScript Interface
The `MathDrillWeb` class handles the frontend logic:

```javascript
sendToPython(action, data, callback) {
    // Send requests to Python
    window.pythonBridge.send(action, JSON.stringify(data), callbackId);
}
```

### Communication Flow
1. JavaScript calls `sendToPython()`
2. Python bridge receives the request
3. Python processes the request
4. Python sends response back to JavaScript
5. JavaScript updates the UI

## CSS Variables

The interface uses CSS variables for consistent theming:

```css
:root {
    --dark-bg: #0B0E0B;
    --card-bg: #1A201A;
    --accent-color: #2ECC71;
    --success-color: #2ECC71;
    --error-color: #FF6B6B;
    --text-color: #ECF0F1;
    --muted-color: #4B5E4B;
}
```

## Keyboard Shortcuts

All original keyboard shortcuts are preserved:

- `M` - Cycle through modes
- `O` - Cycle through operations  
- `F1-F3` - Select digit level
- `S` - Open settings
- `A` - Open achievements
- `P` - Open progress/mastery
- `W` - Open weakness analysis
- `Esc` - Clear input/reset session
- `Ctrl+Q` - End session
- `Enter` - Submit answer

## Fallback

If WebEngine fails to load, the system automatically falls back to the original Qt-based interface. This ensures compatibility across different environments.

## Performance

The WebEngine version offers:
- Faster UI updates
- Smoother animations
- Better memory management
- Modern rendering engine

## Troubleshooting

### WebEngine Not Available
If WebEngine fails to load:
1. Ensure PyQt6-WebEngine is installed
2. Check if running in a supported environment
3. The system will automatically fall back to Qt version

### Console Messages
JavaScript console messages are printed to Python console for debugging.

### Sound Issues
Sound effects use the same pygame implementation as the original version.

## Development

### Modifying the UI
- HTML: `web/index.html`
- CSS: `web/styles.css`  
- JavaScript: `web/script.js`

### Modifying Backend Logic
- Python bridge: `main_webengine.py`
- Database: `database.py`
- Analytics: `analytics.py`
- Coach: `coach.py`
- Gamification: `gamification.py`

### Adding New Features
1. Add UI elements in HTML/CSS
2. Add JavaScript handlers in `script.js`
3. Add Python bridge methods in `main_webengine.py`
4. Update backend logic as needed

## Browser Compatibility

The WebEngine uses Chromium under the hood, ensuring:
- Modern JavaScript features
- CSS3 support
- HTML5 capabilities
- Consistent rendering across platforms

## Future Enhancements

The web-based architecture enables future improvements:
- Web-based deployment options
- Remote analytics
- Cloud synchronization
- Progressive Web App (PWA) capabilities
- Enhanced accessibility features
