// Disable right-click context menu and only allow refresh
document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
});

// Add keyboard shortcut for refresh (F5 or Ctrl+R)
document.addEventListener('keydown', function(e) {
    // F5 key or Ctrl+R
    if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        location.reload();
        return false;
    }
});
