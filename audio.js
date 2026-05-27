/**
 * Digital Thoran Ambiance Synthesizer
 * Generates meditative background sounds: a deep temple drone, random chimes, and a procedural flute.
 * Uses Web Audio API - no external assets required.
 */
class ThoranAudio {
    constructor() {
        this.ctx = null;
        this.masterVolume = null;
        this.analyser = null;
        this.isPlaying = false;
        
        // Viridu playback state
        this.isViriduPlaying = false;
        this.viriduTimer = null;
        this.speechUtterance = null;
        
        // Audio node references for stopping
        this.droneOscs = [];
        this.droneFilter = null;
        this.melodyTimer = null;
        this.bellTimer = null;
        
        // Pentatonic Scale (A minor pentatonic: A3, C4, D4, E4, G4, A4, C5, D5, E5, G5)
        this.scale = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99];
        this.lastNoteIndex = -1;
    }

    /**
     * Initialize Audio Context
     */
    init() {
        if (this.ctx) return;
        
        // Handle cross-browser AudioContext
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
        
        // Master Gain
        this.masterVolume = this.ctx.createGain();
        this.masterVolume.gain.setValueAtTime(0.5, this.ctx.currentTime);
        
        // Analyser Node for sound-reactive light patterns
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        
        // Connections: Synth -> Master Gain -> Analyser -> Output
        this.masterVolume.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
    }

    /**
     * Start the synthesizers
     */
    start() {
        this.init();
        
        if (this.isPlaying) return;
        
        // Resume context if suspended (browser security)
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        
        this.isPlaying = true;
        
        // Ramps volume in smoothly
        this.masterVolume.gain.setValueAtTime(0, this.ctx.currentTime);
        this.masterVolume.gain.linearRampToValueAtTime(parseFloat(document.getElementById('slider-volume').value) / 100, this.ctx.currentTime + 1.5);
        
        this.startDrone();
        this.startMelodyLoop();
        this.startBellLoop();
    }

    /**
     * Stop all audio generators
     */
    stop() {
        if (!this.isPlaying) return;
        
        // Ramp down volume, then terminate nodes
        const stopTime = this.ctx.currentTime + 1.0;
        this.masterVolume.gain.linearRampToValueAtTime(0, stopTime);
        
        setTimeout(() => {
            if (this.isPlaying) return; // In case it was restarted quickly
            
            // Stop drone oscillators
            this.droneOscs.forEach(osc => {
                try { osc.stop(); } catch(e) {}
            });
            this.droneOscs = [];
            
            // Clear loops
            clearTimeout(this.melodyTimer);
            clearTimeout(this.bellTimer);
            this.melodyTimer = null;
            this.bellTimer = null;
        }, 1100);
        
        this.isPlaying = false;
    }

    /**
     * Set master volume
     */
    setVolume(value) {
        if (!this.ctx) return;
        const volume = parseFloat(value) / 100;
        if (this.isPlaying) {
            this.masterVolume.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.1);
        }
    }

    /**
     * Meditative Deep Drone (Temple chanting / singing bowl simulator)
     */
    startDrone() {
        this.droneOscs = [];
        
        // Lowpass filter to keep it warm and deep
        this.droneFilter = this.ctx.createBiquadFilter();
        this.droneFilter.type = 'lowpass';
        this.droneFilter.frequency.setValueAtTime(140, this.ctx.currentTime);
        this.droneFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);
        this.droneFilter.connect(this.masterVolume);
        
        // Osc 1: Deep Fundamental (triangle)
        const osc1 = this.ctx.createOscillator();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(108.0, this.ctx.currentTime); // Sacred 108Hz frequency
        
        // Osc 2: Slightly detuned fundamental to create natural beating chorus
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(108.3, this.ctx.currentTime);
        
        // Osc 3: Fifth harmonic (162Hz) for a rich, warm layer
        const osc3 = this.ctx.createOscillator();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(162.0, this.ctx.currentTime);
        
        // Node gains
        const g1 = this.ctx.createGain();
        const g2 = this.ctx.createGain();
        const g3 = this.ctx.createGain();
        
        g1.gain.setValueAtTime(0.4, this.ctx.currentTime);
        g2.gain.setValueAtTime(0.08, this.ctx.currentTime); // Sawtooth lower volume
        g3.gain.setValueAtTime(0.2, this.ctx.currentTime);
        
        // Connections
        osc1.connect(g1);
        osc2.connect(g2);
        osc3.connect(g3);
        
        g1.connect(this.droneFilter);
        g2.connect(this.droneFilter);
        g3.connect(this.droneFilter);
        
        // Start playing
        osc1.start(0);
        osc2.start(0);
        osc3.start(0);
        
        this.droneOscs.push(osc1, osc2, osc3);
        
        // LFO to slowly sweep filter frequency (creates breathing sensation)
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.05, this.ctx.currentTime); // very slow: 20 seconds cycle
        
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(30, this.ctx.currentTime); // sweep filter +- 30Hz
        
        lfo.connect(lfoGain);
        lfoGain.connect(this.droneFilter.frequency);
        
        lfo.start(0);
        this.droneOscs.push(lfo);
    }

    /**
     * Meditative Procedural Flute (Bansuri style)
     */
    playFluteNote(freq) {
        if (!this.isPlaying) return;
        
        const now = this.ctx.currentTime;
        const noteDuration = 2.5 + Math.random() * 2; // Long notes
        
        // Main Oscillator
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle'; // Warm woodwind sound
        osc.frequency.setValueAtTime(freq, now);
        
        // Vibrato: Low Frequency Oscillator (LFO)
        const vibrato = this.ctx.createOscillator();
        vibrato.frequency.setValueAtTime(5.5 + Math.random() * 2, now); // ~6.5Hz vibrato
        
        const vibratoGain = this.ctx.createGain();
        vibratoGain.gain.setValueAtTime(freq * 0.015, now); // Pitch deviation
        
        vibrato.connect(vibratoGain);
        vibratoGain.connect(osc.frequency);
        
        // Gain Envelope for slow attack/release (wind-like)
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.08, now + 0.8); // 800ms attack
        gainNode.gain.setValueAtTime(0.08, now + noteDuration - 1.2);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + noteDuration); // 1.2s release
        
        // Soft lowpass filter to remove triangle harshness and isolate frequencies
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 2.2, now); // dynamic cutoff
        
        // Connections
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterVolume);
        
        vibrato.start(now);
        osc.start(now);
        
        // Clean up node when finished
        vibrato.stop(now + noteDuration);
        osc.stop(now + noteDuration);
    }

    /**
     * Procedural Flute Melody Loop
     */
    startMelodyLoop() {
        if (!this.isPlaying) return;
        
        // Choose note from pentatonic scale (avoid repeating same note consecutively)
        let idx;
        do {
            idx = Math.floor(Math.random() * this.scale.length);
        } while (idx === this.lastNoteIndex);
        
        this.lastNoteIndex = idx;
        const noteFreq = this.scale[idx];
        
        // Play note
        this.playFluteNote(noteFreq);
        
        // Schedule next note in 4 to 8 seconds
        const nextTime = 4000 + Math.random() * 4000;
        this.melodyTimer = setTimeout(() => this.startMelodyLoop(), nextTime);
    }

    /**
     * Realistic Acoustic Temple Bell (Chime)
     */
    playBell(freq = 523.25) {
        if (!this.isPlaying) return;
        
        const now = this.ctx.currentTime;
        const decay = 6.0; // Long decay time
        
        // Bell sound has several inharmonic partials
        // Standard bell frequency ratios: 1 (prime), 1.2 (minor third), 1.5 (fifth), 2 (octave), 2.5 (octave + major third)
        const partials = [
            { ratio: 1.00, gain: 0.12, decayMult: 1.0 },
            { ratio: 1.20, gain: 0.08, decayMult: 0.8 },
            { ratio: 1.50, gain: 0.06, decayMult: 0.7 },
            { ratio: 2.00, gain: 0.05, decayMult: 0.5 },
            { ratio: 2.65, gain: 0.04, decayMult: 0.4 },
            { ratio: 3.20, gain: 0.03, decayMult: 0.3 },
            { ratio: 4.10, gain: 0.02, decayMult: 0.2 }
        ];
        
        // Master bell mix gain node
        const bellMix = this.ctx.createGain();
        bellMix.connect(this.masterVolume);
        
        partials.forEach(p => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq * p.ratio, now);
            
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(p.gain, now + 0.01); // Instant strike
            g.gain.exponentialRampToValueAtTime(0.0001, now + (decay * p.decayMult));
            
            osc.connect(g);
            g.connect(bellMix);
            
            osc.start(now);
            osc.stop(now + decay);
        });
    }

    /**
     * Random Temple Bell Loop
     */
    startBellLoop() {
        if (!this.isPlaying) return;
        
        // Pick high bell frequency (e.g., A4, E5, A5)
        const bellNotes = [440.00, 659.25, 880.00, 987.77, 1318.51];
        const randomNote = bellNotes[Math.floor(Math.random() * bellNotes.length)];
        
        // Strike bell
        this.playBell(randomNote);
        
        // Schedule next bell in 8 to 18 seconds
        const nextTime = 8000 + Math.random() * 10000;
        this.bellTimer = setTimeout(() => this.startBellLoop(), nextTime);
    }

    /**
     * Synthesizes Raban low strike "Dom"
     */
    playDom(time) {
        if (!this.ctx) return;
        
        const now = time || this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'sine';
        // Pitch sweep
        osc.frequency.setValueAtTime(115, now);
        osc.frequency.exponentialRampToValueAtTime(75, now + 0.18);
        
        // Volume envelope
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.55, now + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        
        // Lowpass filter to keep it bassy
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(180, now);
        
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterVolume);
        
        osc.start(now);
        osc.stop(now + 0.25);
    }

    /**
     * Synthesizes Raban high strike "Tak"
     */
    playTak(time) {
        if (!this.ctx) return;
        
        const now = time || this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'triangle';
        // Pitch sweep (higher frequency, shorter decay)
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);
        
        // Volume envelope (sharp, clicky)
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.3, now + 0.002);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        
        // Bandpass filter to make it sound hollow
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600, now);
        filter.Q.setValueAtTime(2.0, now);
        
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterVolume);
        
        osc.start(now);
        osc.stop(now + 0.07);
    }

    /**
     * Starts the Raban drumbeat sequencer
     */
    startRabanSequencer() {
        if (!this.isViriduPlaying) return;
        
        let step = 0;
        const tempo = 250; // ms per step (120 BPM eighth notes)
        
        const drumLoop = () => {
            if (!this.isViriduPlaying) return;
            
            const now = this.ctx.currentTime;
            
            // Traditional 8-step Viridu Raban beat
            if (step === 0 || step === 4) {
                this.playDom(now);
            } else if (step === 1 || step === 2 || step === 5 || step === 6) {
                this.playTak(now);
            } else if (step === 3) {
                this.playTak(now);
                this.playTak(now + 0.12); // quick double tap
            } else if (step === 7) {
                this.playDom(now);
                this.playTak(now + 0.12);
            }
            
            step = (step + 1) % 8;
            this.viriduTimer = setTimeout(drumLoop, tempo);
        };
        
        drumLoop();
    }

    /**
     * Triggers Viridu drumbeat and speech synthesis
     */
    startViridu() {
        this.init();
        
        if (this.isViriduPlaying) return;
        
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        
        this.isViriduPlaying = true;
        
        // Ramps volume
        this.masterVolume.gain.setValueAtTime(0, this.ctx.currentTime);
        this.masterVolume.gain.linearRampToValueAtTime(parseFloat(document.getElementById('slider-volume').value) / 100, this.ctx.currentTime + 0.5);
        
        // Start Raban drumbeat loop
        this.startRabanSequencer();
    }

    /**
     * Stops Viridu drumbeat and speech synthesis
     */
    stopViridu() {
        if (!this.isViriduPlaying) return;
        
        this.isViriduPlaying = false;
        
        // Stop drum loops
        clearTimeout(this.viriduTimer);
        this.viriduTimer = null;
        
        // Cancel Speech
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    }

    /**
     * SpeechSynthesis Chanting for Sinhala Viridu Kavi (rhythmically aligned)
     */
    speakSinhalaVerse(text, onEndCallback) {
        if (!window.speechSynthesis) {
            if (onEndCallback) setTimeout(onEndCallback, 8000); // fallback wait
            return;
        }
        
        window.speechSynthesis.cancel();
        
        // Clean text of html tags
        const cleanText = text.replace(/<br>/g, " ");
        
        this.speechUtterance = new SpeechSynthesisUtterance(cleanText);
        this.speechUtterance.lang = 'si-LK';
        this.speechUtterance.rate = 0.72; // slow and chanting
        this.speechUtterance.pitch = 0.95; // slightly chanting pitch
        
        // Find Sinhala Voice if available
        const voices = window.speechSynthesis.getVoices();
        const siVoice = voices.find(v => v.lang.startsWith('si') || v.name.toLowerCase().includes('sinhala'));
        if (siVoice) {
            this.speechUtterance.voice = siVoice;
        }
        
        if (onEndCallback) {
            this.speechUtterance.onend = onEndCallback;
            this.speechUtterance.onerror = onEndCallback;
        }
        
        window.speechSynthesis.speak(this.speechUtterance);
    }
}

// Export global instance
window.ThoranAudio = new ThoranAudio();
