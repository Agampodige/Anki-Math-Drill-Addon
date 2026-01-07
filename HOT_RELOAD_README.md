# Math Drill Hot Reload System

This addon now includes automatic hot reload functionality that eliminates the need to restart Anki when developing or modifying the addon.

## How It Works

The hot reload system monitors:
- **Python backend files** (.py files in the addon root)
- **Web frontend files** (HTML, JS, CSS files in the `web/` directory)

When changes are detected:
- Python modules are automatically reloaded using `importlib.reload()`
- Web pages are automatically refreshed in the browser
- A subtle notification appears showing "🔥 Hot reloaded"

## Files Added/Modified

### New Files
- `hot_reload.py` - Core hot reload monitoring system
- `test_hot_reload.py` - Test script (requires Anki environment)
- `HOT_RELOAD_README.md` - This documentation

### Modified Files
- `__init__.py` - Added hot reload initialization and module watching
- `main_webengine.py` - Added hot reload integration and page reload functionality
- `web/index.html` - Added JavaScript hot reload notification handler

## Usage

### For Development
1. **Start Anki** with the addon loaded
2. **Open Math Drill** from the Tools menu
3. **Make changes** to any Python or web file
4. **Watch the console** for hot reload messages
5. **See changes immediately** without restarting Anki

### What Gets Monitored

#### Python Files:
- `main_webengine.py`
- `json_storage.py`
- `database.py`
- `database_api.py`
- `analytics.py`
- `gamification.py`
- `levels.py`
- `coach.py`

#### Web Files:
- `web/index.html`
- `web/script.js`
- `web/styles.css`
- `web/settings.html`
- `web/settings.js`
- `web/progress.html`
- `web/progress.js`
- `web/levels.html`
- `web/levels.js`
- `web/achievements.html`
- `web/achievements.js`
- `web/weakness.html`
- `web/weakness.js`

### Adding New Files to Monitor

To add new files to the hot reload system:

#### For Python files:
Edit `__init__.py` and add:
```python
import new_module_name
hot_reloader.add_module('new_module_name', new_module_name)
```

#### For web files:
Edit `__init__.py` and add to the `web_files` list:
```python
web_files = [
    # ... existing files ...
    'web/new_file.html',
    'web/new_file.js'
]
```

## Features

### Automatic Python Module Reloading
- Uses `importlib.reload()` to refresh Python modules
- Preserves existing object instances where possible
- Logs successful reloads to console

### Automatic Web Page Refreshing
- Detects changes to HTML, CSS, and JS files
- Automatically reloads the current page
- Preserves the current URL/state during reload
- Shows visual notification when reload occurs

### Visual Feedback
- Console messages showing which files changed
- Green notification toast in the web interface
- Non-intrusive, auto-dismissing after 2 seconds

## Performance Considerations

- **Check Interval**: Files are checked every 1 second
- **Low Overhead**: Uses file modification time stamps, efficient for development
- **Thread-Safe**: Runs in background thread, doesn't block UI
- **Memory Efficient**: Only tracks file modification times

## Troubleshooting

### Hot Reload Not Working
1. **Check Console**: Look for hot reload initialization messages
2. **File Permissions**: Ensure Anki can read/write to addon directory
3. **Restart Anki**: Sometimes a full restart is needed after initial installation

### Python Module Reload Issues
- Some modules with complex initialization may not reload perfectly
- Stateful objects might need manual refresh
- Check console for specific error messages

### Web Page Not Refreshing
- Ensure the Math Drill window is open
- Check browser console for JavaScript errors
- Verify the file is in the watched list

## Development Tips

### Best Practices
1. **Save frequently** - Hot reload triggers on file save
2. **Watch console** - Monitor for reload messages and errors
3. **Test changes** - Verify functionality after each reload
4. **Use F12** - Press F12 in Math Drill to open developer tools

### Common Development Workflow
1. Open Anki and Math Drill
2. Open your code editor
3. Make changes to Python or web files
4. Save the file (Ctrl+S)
5. Watch for "🔥 Hot reloaded" notification
6. Test your changes in Math Drill
7. Repeat!

## Technical Details

### Architecture
- **HotReloader Class**: Core monitoring system
- **File Watching**: Uses `os.path.getmtime()` for change detection
- **Signal System**: Uses Qt signals for communication
- **Thread Safety**: Background thread with proper synchronization

### Error Handling
- Graceful fallback if hot reload initialization fails
- Individual file monitoring continues even if some files fail
- Detailed error logging for debugging

## Future Enhancements

Potential improvements:
- Configurable check intervals
- Selective file watching (exclude patterns)
- Hot reload for configuration files
- Integration with external build tools
- Performance metrics and logging

---

**Note**: This hot reload system is designed for development use. For production deployments, consider disabling it to reduce overhead.
