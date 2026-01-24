// Internationalization (i18n) System
class I18n {
    constructor() {
        this.currentLanguage = 'en';
        this.translations = {};
        this.fallbackLanguage = 'en';
        this.supportedLanguages = {
            'en': { name: 'English', nativeName: 'English' },
            'es': { name: 'Spanish', nativeName: 'Español' },
            'fr': { name: 'French', nativeName: 'Français' },
            'de': { name: 'German', nativeName: 'Deutsch' },
            'zh': { name: 'Chinese', nativeName: '中文' },
            'ja': { name: 'Japanese', nativeName: '日本語' },
            'pt': { name: 'Portuguese', nativeName: 'Português' },
            'ru': { name: 'Russian', nativeName: 'Русский' },
            'hi': { name: 'Hindi', nativeName: 'हिन्दी' },
            'ar': { name: 'Arabic', nativeName: 'العربية' }
        };
    }

    async init() {
        // Load saved language preference
        const savedLanguage = localStorage.getItem('mathDrillLanguage') || 'en';
        await this.setLanguage(savedLanguage);
    }

    async loadTranslations(language) {
        try {
            const response = await fetch(`locales/${language}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load translations for ${language}`);
            }
            this.translations[language] = await response.json();
        } catch (error) {
            console.warn(`Could not load translations for ${language}:`, error);
            // Fallback to English if language not found
            if (language !== this.fallbackLanguage) {
                await this.loadTranslations(this.fallbackLanguage);
            }
        }
    }

    async setLanguage(language) {
        if (!this.supportedLanguages[language]) {
            console.warn(`Language ${language} not supported, falling back to English`);
            language = this.fallbackLanguage;
        }

        // Load translations if not already loaded
        if (!this.translations[language]) {
            await this.loadTranslations(language);
        }

        this.currentLanguage = language;
        localStorage.setItem('mathDrillLanguage', language);
        
        // Update HTML lang attribute
        document.documentElement.lang = language;
        
        // Update all translatable elements
        this.updateUI();
        
        // Update document direction for RTL languages
        if (language === 'ar') {
            document.documentElement.dir = 'rtl';
        } else {
            document.documentElement.dir = 'ltr';
        }
    }

    translate(key, params = {}) {
        const translation = this.getTranslation(key, this.currentLanguage);
        return this.interpolate(translation, params);
    }

    getTranslation(key, language) {
        const keys = key.split('.');
        let translation = this.translations[language];
        
        for (const k of keys) {
            if (translation && typeof translation === 'object' && translation[k] !== undefined) {
                translation = translation[k];
            } else {
                // Fallback to fallback language
                if (language !== this.fallbackLanguage) {
                    return this.getTranslation(key, this.fallbackLanguage);
                }
                return key; // Return key if no translation found
            }
        }
        
        return translation;
    }

    interpolate(text, params) {
        if (typeof text !== 'string') return text;
        
        return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return params[key] !== undefined ? params[key] : match;
        });
    }

    updateUI() {
        // Update elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.translate(key);
            
            if (element.tagName === 'INPUT' && (element.type === 'text' || element.type === 'number')) {
                element.placeholder = translation;
            } else if (element.tagName === 'INPUT' && element.type === 'submit') {
                element.value = translation;
            } else if (element.tagName === 'OPTION') {
                element.textContent = translation;
            } else {
                element.textContent = translation;
            }
        });

        // Update elements with data-i18n-placeholder attribute
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.translate(key);
        });

        // Update elements with data-i18n-html attribute (for HTML content)
        document.querySelectorAll('[data-i18n-html]').forEach(element => {
            const key = element.getAttribute('data-i18n-html');
            element.innerHTML = this.translate(key);
        });

        // Update elements with data-i18n-title attribute (for tooltips)
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.translate(key);
        });

        // Update elements with data-i18n-aria-label attribute (for accessibility)
        document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
            const key = element.getAttribute('data-i18n-aria-label');
            element.setAttribute('aria-label', this.translate(key));
        });

        // Update page titles
        const titleElement = document.querySelector('title');
        if (titleElement) {
            const titleKey = titleElement.getAttribute('data-i18n');
            if (titleKey) {
                titleElement.textContent = this.translate(titleKey);
            }
        }
    }

    getSupportedLanguages() {
        return this.supportedLanguages;
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }
}

// Create global i18n instance
const i18n = new I18n();

// Initialize i18n when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    i18n.init().then(() => {
        // Trigger a custom event when i18n is ready
        window.dispatchEvent(new CustomEvent('i18n-ready'));
    });
});

// Make i18n globally available
window.i18n = i18n;

// Helper function for safe translation
window.t = function(key, params = {}) {
    if (window.i18n && window.i18n.translate) {
        return window.i18n.translate(key, params);
    }
    return key; // Fallback to key if i18n not ready
};
