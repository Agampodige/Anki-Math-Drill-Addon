// Allow right-click context menu for developer tools access
// Note: Context menu is now enabled for web inspection purposes

// Add keyboard shortcut for refresh (F5 or Ctrl+R)
document.addEventListener('keydown', function(e) {
    // F5 key or Ctrl+R
    if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        location.reload();
        return false;
    }
});
