'use strict';
// 08 Audio Engine (Tone.js peaceful spa ambient music & synthesized SFX)
// ============================================================
class AudioEngine {
  constructor() {
    this.unlocked = false;
    this.musicEnabled = false;
    this.sfxEnabled = true;
    this.musicVolume = 45;
    this.sfxVolume = 75;
    this.musicGain = null;
    this.sfxGain = null;
    this.limiter = null;
    this.isMutedByTab = false;
    this.spaRunning = false;
    this.initNodes();
  }

  initNodes() {
    if (typeof Tone === 'undefined') return;
    try {
      this.limiter = new Tone.Limiter(-1).toDestination();
      this.musicGain = new Tone.Gain(0).connect(this.limiter);
      this.sfxGain = new Tone.Gain(0.7).connect(this.limiter);

      // SFX Synths
      this.stoneSynth = new Tone.MembraneSynth({
        pitchDecay: 0.04,
        octaves: 3,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }
      }).connect(this.sfxGain);

      this.blipSynth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.08, sustain: 0, release: 0.05 }
      }).connect(this.sfxGain);

      this.polySfx = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.4 }
      }).connect(this.sfxGain);

      // Spa Relaxing Ambient Nodes (Lush Reverb & Warm Lowpass Filter)
      this.spaReverb = new Tone.Reverb({ decay: 6.5, wet: 0.55 }).connect(this.musicGain);
      this.spaFilter = new Tone.Filter(850, 'lowpass').connect(this.spaReverb);

      // Soothing warm ambient pad
      this.padSynth = new Tone.PolySynth(Tone.Synth, {
        volume: -6,
        oscillator: { type: 'sine' },
        envelope: { attack: 1.8, decay: 2.5, sustain: 0.8, release: 3.5 }
      }).connect(this.spaFilter);

      // Gentle meditation bell / spa chime
      this.chimeSynth = new Tone.PolySynth(Tone.Synth, {
        volume: -10,
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.08, decay: 3.2, sustain: 0.1, release: 3.0 }
      }).connect(this.spaReverb);

      this.setupSpaPatterns();

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.musicEnabled) {
            this.isMutedByTab = true;
            this.stopSpaTransport();
          }
        } else {
          if (this.isMutedByTab && this.musicEnabled) {
            this.isMutedByTab = false;
            this.startSpaTransport();
          }
        }
      });
    } catch {
      // Audio init fallback
    }
  }

  setupSpaPatterns() {
    // Calming spa pentatonic & suspended chords
    const spaChords = [
      ['D3', 'A3', 'E4', 'F#4'],  // Dadd9 (Serene, warm)
      ['G3', 'D4', 'A4', 'B4'],   // Gmaj9 (Floating)
      ['B2', 'F#3', 'D4', 'A4'],  // Bm7 (Peaceful)
      ['A2', 'E3', 'A3', 'C#4']   // A (Gentle resolution)
    ];
    const chimeNotes = ['A5', 'F#5', 'D5', 'E5', 'B4', 'D6'];

    Tone.getTransport().bpm.value = 44;

    let bar = 0;
    Tone.getTransport().scheduleRepeat((time) => {
      try {
        const chord = spaChords[bar % spaChords.length];
        this.padSynth.triggerAttackRelease(chord, '1m', time, 0.45);

        // Occasional gentle chime
        const chime = chimeNotes[bar % chimeNotes.length];
        const chimeOffset = bar % 2 === 0 ? 1.4 : 2.8;
        this.chimeSynth.triggerAttackRelease(chime, '2n', time + chimeOffset, 0.22);
      } catch {
        // Audio error caught
      }
      bar++;
    }, '1m');
  }

  async unlock() {
    if (this.unlocked || typeof Tone === 'undefined') return;
    try {
      await Tone.start();
      if (Tone.getContext().state !== 'running') {
        await Tone.getContext().resume();
      }
      this.unlocked = true;
      const hint = $('#sound-hint');
      if (hint) hint.hidden = true;
      this.applySettings();
    } catch {
      // Audio context unlock error
    }
  }

  applySettings() {
    const s = App.settings.audio;
    this.musicEnabled = !!s.musicOn;
    this.sfxEnabled = !!s.sfxOn;
    this.musicVolume = s.musicVol;
    this.sfxVolume = s.sfxVol;

    if (!this.unlocked || !this.musicGain || !this.sfxGain) return;

    const sfxVal = this.sfxEnabled ? clamp(this.sfxVolume / 100, 0, 1) : 0;
    this.sfxGain.gain.rampTo(sfxVal, 0.05);

    const musicVal = this.musicEnabled ? clamp(this.musicVolume / 100, 0, 1) : 0;
    if (this.musicEnabled && !this.isMutedByTab) {
      this.musicGain.gain.rampTo(musicVal * 0.4, 0.8);
      this.startSpaTransport();
    } else {
      this.musicGain.gain.rampTo(0, 0.4);
      this.stopSpaTransport();
    }
  }

  startSpaTransport() {
    if (this.spaRunning || !this.unlocked) return;
    try {
      Tone.getTransport().start();
      this.spaRunning = true;
    } catch {
      // Transport error caught
    }
  }

  stopSpaTransport() {
    if (!this.spaRunning) return;
    try {
      Tone.getTransport().pause();
      this.spaRunning = false;
    } catch {
      // Transport pause caught
    }
  }

  playPlace(player) {
    if (!this.unlocked || !this.sfxEnabled || !this.stoneSynth) return;
    try {
      const note = player === 1 ? 'A1' : 'E2';
      this.stoneSynth.triggerAttackRelease(note, '16n');
    } catch {}
  }

  playInvalid() {
    if (!this.unlocked || !this.sfxEnabled || !this.blipSynth) return;
    try {
      this.blipSynth.triggerAttackRelease('A2', '32n');
    } catch {}
  }

  playPreview() {
    if (!this.unlocked || !this.sfxEnabled || !this.hatSynth) return;
    try {
      this.hatSynth.triggerAttackRelease('64n', undefined, 0.15);
    } catch {}
  }

  playWarning() {
    if (!this.unlocked || !this.sfxEnabled || !this.stoneSynth) return;
    try {
      this.stoneSynth.triggerAttackRelease('F3', '64n', undefined, 0.3);
    } catch {}
  }

  playTimeout() {
    if (!this.unlocked || !this.sfxEnabled || !this.polySfx) return;
    try {
      const now = Tone.now();
      this.polySfx.triggerAttackRelease('F3', '16n', now);
      this.polySfx.triggerAttackRelease('C3', '16n', now + 0.12);
    } catch {}
  }

  playWin() {
    if (!this.unlocked || !this.sfxEnabled || !this.polySfx) return;
    try {
      const now = Tone.now();
      const notes = ['C4', 'E4', 'G4', 'B4', 'C5'];
      notes.forEach((n, idx) => {
        this.polySfx.triggerAttackRelease(n, '8n', now + idx * 0.08, 0.7);
      });
    } catch {}
  }

  playLose() {
    if (!this.unlocked || !this.sfxEnabled || !this.polySfx) return;
    try {
      const now = Tone.now();
      this.polySfx.triggerAttackRelease('Eb4', '8n', now, 0.6);
      this.polySfx.triggerAttackRelease('Bb3', '4n', now + 0.14, 0.6);
    } catch {}
  }

  playDraw() {
    if (!this.unlocked || !this.sfxEnabled || !this.polySfx) return;
    try {
      this.polySfx.triggerAttackRelease(['C4', 'Eb4', 'G4'], '4n');
    } catch {}
  }

  playClick() {
    if (!this.unlocked || !this.sfxEnabled || !this.blipSynth) return;
    try {
      this.blipSynth.triggerAttackRelease('C5', '64n', undefined, 0.2);
    } catch {}
  }
}

// ============================================================
