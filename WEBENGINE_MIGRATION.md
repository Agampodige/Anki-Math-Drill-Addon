# Math Drill WebEngine Migration

## Overview

This document describes the migration from native Qt widgets to a modern web-based UI using PyQt6-WebEngine, including a separate progress page.

## What Changed

### New Architecture
- **Frontend**: Modern HTML/CSS/JavaScript interface
- **Backend**: Python with WebEngine integration
- **Communication**: QWebChannel bridge between Python and JavaScript
- **Progress Page**: Separate dedicated progress tracking interface

### Files Added
- `web/index.html` - Main HTML structure
- `web/styles.css` - Modern CSS styling with CSS variables
- `web/script.js` - JavaScript application logic
- `web/progress.html` - Dedicated progress page HTML
- `web/progress.js` - Progress page JavaScript logic
- `main_webengine.py` - WebEngine integration and Python bridge
- `test_webengine.py` - Test script for the new interface
- `test_progress.py` - Test script for progress page

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

### Separate Progress Page
- **Dedicated Window**: Progress opens in its own window for better focus
- **Comprehensive Analytics**: Detailed progress tracking with multiple views
- **Time Period Filters**: View progress by Last 7 Days, Last 30 Days, or All Time
- **Interactive Charts**: Visual performance trends over time
- **Mastery Grid**: Enhanced skill mastery visualization
- **Weakness Analysis**: Detailed areas needing improvement
- **Recent Activity**: Timeline of practice sessions
- **Achievement Progress**: Track achievement unlock progress
- **Personal Bests**: View personal records across different modes

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
- Separate progress page with advanced analytics

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

Test the progress page specifically:
```bash
python test_progress.py
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

### Progress Page Integration
The progress page uses a separate WebEngine window with its own bridge:

```python
def open_progress_page(self):
    # Opens progress.html in a new dialog window
```

### Communication Flow
1. JavaScript calls `sendToPython()`
2. Python bridge receives the request
3. Python processes the request
4. Python sends response back to JavaScript
5. JavaScript updates the UI

## Progress Page Features

### Overview Section
- Total questions answered
- Average accuracy percentage
- Average solving speed
- Current streak counter

### Performance Chart
- Visual trend of accuracy and speed over time
- Canvas-based chart rendering
- Responsive to window resizing

### Skills Mastery Grid
- Color-coded mastery levels (Novice → Apprentice → Pro → Master)
- Interactive cells with hover effects
- Detailed statistics for each skill combination

### Weakness Analysis
- Prioritized list of areas needing improvement
- Color-coded by weakness severity
- Actionable suggestions for each weakness

### Recent Activity
- Timeline of practice sessions
- Daily statistics and performance metrics
- Easy-to-read activity feed

### Achievement Progress
- Progress bars for locked achievements
- Visual indication of unlocked achievements
- Motivational progress tracking

### Personal Bests
- Best times for different modes
- High score tracking
- Performance benchmarks

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
- `P` - **Open progress page (new window)**
- `W` - Open weakness analysis
- `Esc` - Clear input/reset session
- `Ctrl+Q` - End session
- `Enter` - Submit answer

### Progress Page Shortcuts
- `Esc` - Close progress page and return to main app

## Fallback

If WebEngine fails to load, the system automatically falls back to the original Qt-based interface. This ensures compatibility across different environments.

## Performance

The WebEngine version offers:
- Faster UI updates
- Smoother animations
- Better memory management
- Modern rendering engine
- Separate progress window for better multitasking

## Troubleshooting

### WebEngine Not Available
If WebEngine fails to load:
1. Ensure PyQt6-WebEngine is installed
2. Check if running in a supported environment
3. The system will automatically fall back to Qt version

### Progress Page Issues
If the progress page doesn't open:
1. Check that `web/progress.html` exists
2. Verify the Python bridge is working
3. Check console for JavaScript errors

### Console Messages
JavaScript console messages are printed to Python console for debugging.

### Sound Issues
Sound effects use the same pygame implementation as the original version.

## Development

### Modifying the Main UI
- HTML: `web/index.html`
- CSS: `web/styles.css`  
- JavaScript: `web/script.js`

### Modifying the Progress Page
- HTML: `web/progress.html`
- CSS: `web/progress.html` (embedded styles)
- JavaScript: `web/progress.js`

### Modifying Backend Logic
- Python bridge: `main_webengine.py`
- Database: `database.py`
- Analytics: `analytics.py`
- Coach: `coach.py`
- Gamification: `gamification.py`

### Adding New Features
1. Add UI elements in HTML/CSS
2. Add JavaScript handlers in `script.js` or `progress.js`
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
- More advanced charting libraries
- Export functionality for progress data
