(function () {
    function getTheme() {
        // Try to get from main settings object first
        try {
            const settings = JSON.parse(localStorage.getItem('mathDrillSettings') || '{}');
            if (settings.theme) return settings.theme;
        } catch (e) { }

        // Fallback to simple key or legacy
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) return savedTheme;

        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }

    function applyColor(color) {
        if (!color) return;

        const colors = {
            green: {
                primary: '#10B981',
                primaryHover: '#059669',
                primaryLight: '#D1FAE5',
                gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
            },
            blue: {
                primary: '#3B82F6',
                primaryHover: '#2563EB',
                primaryLight: '#DBEAFE',
                gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
            },
            purple: {
                primary: '#8B5CF6',
                primaryHover: '#7C3AED',
                primaryLight: '#EDE9FE',
                gradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)'
            },
            red: {
                primary: '#EF4444',
                primaryHover: '#DC2626',
                primaryLight: '#FEE2E2',
                gradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
            }
        };

        const selected = colors[color] || colors.green;
        const root = document.documentElement;

        root.style.setProperty('--primary', selected.primary);
        root.style.setProperty('--primary-hover', selected.primaryHover);
        root.style.setProperty('--primary-light', selected.primaryLight);
        root.style.setProperty('--primary-gradient', selected.gradient);
    }

    // Get settings once
    let settings = {};
    try {
        settings = JSON.parse(localStorage.getItem('mathDrillSettings') || '{}');
    } catch (e) { }

    // Apply immediately
    applyTheme(getTheme());
    if (settings.themeColor) {
        applyColor(settings.themeColor);
    }

    // Listen for storage changes (cross-tab sync)
    window.addEventListener('storage', (e) => {
        if (e.key === 'mathDrillSettings') {
            try {
                const newSettings = JSON.parse(e.newValue);
                if (newSettings.theme) applyTheme(newSettings.theme);
                if (newSettings.themeColor) applyColor(newSettings.themeColor);
            } catch (err) { }
        }
    });
})();