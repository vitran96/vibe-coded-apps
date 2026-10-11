// audio.js — SFX synthesizers and procedural Tone.js lofi BGM
(() => {
  let audioCtx = null;
  let masterGain = null;
  let sfxGain = null;
  let musicGain = null;
  let unlocked = false;
  let toneLoaded = false;
  let bgmRunning = false;
  let bgmSynth = null, bassSynth = null, chordLoop = null;

  const NOTE = {
    C3: 130.81, D3: 146.83, E3: 164.81, G3: 196.00, A3: 220.00,
    C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00, A4: 440.00,
    C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
    C6: 1046.5
  };

  function initAudio() {
    if (audioCtx) return audioCtx;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    audioCtx = new AudioContextClass();
    masterGain = audioCtx.createGain();
    sfxGain = audioCtx.createGain();
    musicGain = audioCtx.createGain();

    sfxGain.connect(masterGain);
    musicGain.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    // Register game-specific SFX on House.SFX
    if (window.House && window.House.SFX) {
      function pluckNote(ctx, out, freq, at, dur = 0.2, gain = 0.5) {
        const g = ctx.createGain();
        g.connect(out);
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(gain, at + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        for (const [mult, level] of [[1, 1], [4, 0.12]]) {
          const o = ctx.createOscillator(), og = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = freq * mult;
          og.gain.value = level;
          o.connect(og);
          og.connect(g);
          o.start(at);
          o.stop(at + dur + 0.05);
        }
      }

      window.House.SFX.capture = (c, o, t) => {
        pluckNote(c, o, NOTE.D5, t, 0.12, 0.5);
        pluckNote(c, o, NOTE.G5, t + 0.06, 0.2, 0.55);
      };

      window.House.SFX.check = (c, o, t) => {
        pluckNote(c, o, NOTE.A5, t, 0.1, 0.45);
        pluckNote(c, o, NOTE.C6, t + 0.08, 0.18, 0.45);
      };

      window.House.SFX.select = (c, o, t) => {
        pluckNote(c, o, NOTE.E5, t, 0.06, 0.2);
      };

      window.House.SFX.countdown = (c, o, t, n = 5) => {
        const notes = { 5: NOTE.C5, 4: NOTE.D5, 3: NOTE.E5, 2: NOTE.G5, 1: NOTE.A5 };
        const subNotes = { 5: NOTE.C4, 4: NOTE.D4, 3: NOTE.E4, 2: NOTE.G4, 1: NOTE.A4 };
        const freq = notes[n] || NOTE.C5;
        const subFreq = subNotes[n] || NOTE.C4;
        pluckNote(c, o, freq, t, 0.14, 0.5);
        pluckNote(c, o, subFreq, t, 0.18, 0.2);
      };
    }

    return audioCtx;
  }

  function unlockAudio() {
    if (unlocked) return;
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    unlocked = true;
    const chip = document.getElementById('audio-unlock-chip');
    if (chip) chip.style.display = 'none';
  }

  // Set up first gesture unlock
  ['pointerdown', 'keydown'].forEach(evt => {
    window.addEventListener(evt, unlockAudio, { once: true, passive: true });
  });

  const Audio = {
    init: initAudio,
    unlock: unlockAudio,

    play(name, ...args) {
      if (!audioCtx) initAudio();
      const settings = window.XQ.Storage ? window.XQ.Storage.loadSettings() : { sfx: { on: true, vol: 0.7 } };
      if (!settings.sfx.on || !window.House) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      sfxGain.gain.setValueAtTime(settings.sfx.vol, audioCtx.currentTime);
      window.House.play(audioCtx, sfxGain, name, ...args);
    },

    setSfxVolume(vol) {
      if (sfxGain && audioCtx) {
        sfxGain.gain.setValueAtTime(vol, audioCtx.currentTime);
      }
    },

    setMusicVolume(vol) {
      if (musicGain && audioCtx) {
        musicGain.gain.setValueAtTime(vol, audioCtx.currentTime);
      }
    },

    async setMusicEnabled(enabled) {
      if (!enabled) {
        if (window.Tone && window.Tone.Transport) {
          window.Tone.Transport.stop();
        }
        bgmRunning = false;
        return;
      }

      unlockAudio();
      if (!toneLoaded) {
        await this.loadTone();
      }
      if (!window.Tone) return;

      await window.Tone.start();
      if (!bgmSynth) {
        this.setupBgmTrack();
      }

      const settings = window.XQ.Storage ? window.XQ.Storage.loadSettings() : { music: { on: true, vol: 0.5 } };
      if (musicGain) {
        musicGain.gain.setValueAtTime(settings.music.vol, audioCtx.currentTime);
      }
      window.Tone.Transport.start();
      bgmRunning = true;
    },

    loadTone() {
      if (window.Tone) {
        toneLoaded = true;
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tone@15.0.4/build/Tone.js';
        script.onload = () => {
          toneLoaded = true;
          resolve();
        };
        script.onerror = () => resolve();
        document.head.appendChild(script);
      });
    },

    setupBgmTrack() {
      if (!window.Tone) return;
      window.Tone.Transport.bpm.value = 74;
      window.Tone.Transport.swing = 0.12;

      // FM Synth for chords
      const poly = new window.Tone.PolySynth(window.Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.04, decay: 0.6, sustain: 0.5, release: 1.2 }
      });
      const filter = new window.Tone.Filter(1800, 'lowpass');
      const reverb = new window.Tone.Reverb({ decay: 2.5, preDelay: 0.05, wet: 0.3 });
      poly.chain(filter, reverb, window.Tone.Destination);

      // Bass synth
      const bass = new window.Tone.MonoSynth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.02, decay: 0.4, sustain: 0.4, release: 0.8 }
      }).toDestination();

      // Transposed progressions in key G
      const progA = [
        ['G3', 'Bb3', 'D4', 'F4', 'A4'], // Gm9
        ['C3', 'E3', 'G3', 'Bb3', 'D4'], // C9
        ['F3', 'A3', 'C4', 'E4'],        // Fmaj7
        ['Bb2', 'D3', 'F3', 'A3']        // Bbmaj7
      ];
      const bassA = ['G2', 'C2', 'F2', 'Bb1'];

      let step = 0;
      chordLoop = new window.Tone.Loop((time) => {
        const chord = progA[step % progA.length];
        const bNote = bassA[step % bassA.length];
        poly.triggerAttackRelease(chord, '2n', time, 0.4);
        bass.triggerAttackRelease(bNote, '2n', time, 0.5);
        step++;
      }, '1m').start(0);

      bgmSynth = poly;
      bassSynth = bass;
    }
  };

  // Pause on hidden tab, resume on return if music on
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (bgmRunning && window.Tone && window.Tone.Transport) {
        window.Tone.Transport.pause();
      }
    } else {
      if (bgmRunning && window.Tone && window.Tone.Transport) {
        window.Tone.Transport.start();
      }
    }
  });

  window.XQ = window.XQ || {};
  window.XQ.Audio = Audio;
})();
