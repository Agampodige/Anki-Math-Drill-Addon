// Sound Effects Manager for Practice Mode
// Uses Web Audio API to generate simple tones without external files

class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = this.loadSoundPreference();
        this.volume = 0.3; // Default volume (0.0 to 1.0)

        // Initialize audio context on first user interaction
        this.initialized = false;
    }

    initAudioContext() {
        if (!this.initialized && this.enabled) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.initialized = true;
            } catch (e) {
                console.warn('Web Audio API not supported:', e);
                this.enabled = false;
            }
        }
    }

    loadSoundPreference() {
        const saved = localStorage.getItem('mathDrillSoundEnabled');
        return saved === null ? true : saved === 'true'; // Default to enabled
    }

    saveSoundPreference() {
        localStorage.setItem('mathDrillSoundEnabled', this.enabled.toString());
    }

    toggle() {
        this.enabled = !this.enabled;
        this.saveSoundPreference();
        if (this.enabled) {
            this.initAudioContext();
        }
        return this.enabled;
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
    }

    // Play a simple tone
    playTone(frequency, duration, type = 'sine') {
        if (!this.enabled) return;

        this.initAudioContext();
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        // Envelope for smooth sound
        const now = this.audioContext.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(this.volume, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

        oscillator.start(now);
        oscillator.stop(now + duration);
    }

    // Play a chord (multiple frequencies)
    playChord(frequencies, duration, type = 'sine') {
        if (!this.enabled) return;

        this.initAudioContext();
        if (!this.audioContext) return;

        frequencies.forEach(freq => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.value = freq;
            oscillator.type = type;

            const now = this.audioContext.currentTime;
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(this.volume / frequencies.length, now + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

            oscillator.start(now);
            oscillator.stop(now + duration);
        });
    }

    // Correct answer sound - pleasant ascending chord (C-E-G major)
    playCorrect() {
        const C4 = 261.63;
        const E4 = 329.63;
        const G4 = 392.00;
        this.playChord([C4, E4, G4], 0.3, 'sine');
    }

    // Incorrect answer sound - gentle descending tone
    playIncorrect() {
        if (!this.enabled) return;

        this.initAudioContext();
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = 'sine';

        const now = this.audioContext.currentTime;

        // Descending frequency
        oscillator.frequency.setValueAtTime(400, now);
        oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.2);

        // Envelope
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(this.volume * 0.5, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        oscillator.start(now);
        oscillator.stop(now + 0.2);
    }

    // Milestone celebration sound - fanfare
    playMilestone() {
        if (!this.enabled) return;

        this.initAudioContext();
        if (!this.audioContext) return;

        // Play a sequence of ascending notes
        const notes = [
            { freq: 523.25, time: 0 },      // C5
            { freq: 659.25, time: 0.1 },    // E5
            { freq: 783.99, time: 0.2 },    // G5
            { freq: 1046.50, time: 0.3 }    // C6
        ];

        notes.forEach(note => {
            setTimeout(() => {
                this.playTone(note.freq, 0.15, 'triangle');
            }, note.time * 1000);
        });

        // Add a final chord
        setTimeout(() => {
            this.playChord([523.25, 659.25, 783.99], 0.5, 'sine');
        }, 400);
    }

    // Streak sound - quick positive beep
    playStreak() {
        this.playTone(880, 0.1, 'sine'); // A5 note
    }

    // Button click sound - subtle
    playClick() {
        this.playTone(800, 0.05, 'sine');
    }
}

// Create global instance
window.soundManager = new SoundManager();
