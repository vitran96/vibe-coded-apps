// audio.js — this game's sounds and its lofi background track, on the shared House audio engine (house-audio.js).
(() => {
  const H = window.House;
  const NOTE = {
    C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00, A4: 440.00,
    C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
    C6: 1046.5
  };

  // Soft wooden pluck, same character as the house sounds (house-kit does not export its helper yet).
  function pluck(ctx, out, freq, at, dur = 0.2, gain = 0.5) {
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

  H.SFX.capture = (c, o, t) => { pluck(c, o, NOTE.D5, t, 0.12, 0.5); pluck(c, o, NOTE.G5, t + 0.06, 0.2, 0.55); };
  H.SFX.check = (c, o, t) => { pluck(c, o, NOTE.A5, t, 0.1, 0.45); pluck(c, o, NOTE.C6, t + 0.08, 0.18, 0.45); };
  H.SFX.select = (c, o, t) => { pluck(c, o, NOTE.E5, t, 0.06, 0.2); };
  H.SFX.countdown = (c, o, t, n = 5) => {
    const high = { 5: NOTE.C5, 4: NOTE.D5, 3: NOTE.E5, 2: NOTE.G5, 1: NOTE.A5 };
    const low = { 5: NOTE.C4, 4: NOTE.D4, 3: NOTE.E4, 2: NOTE.G4, 1: NOTE.A4 };
    pluck(c, o, high[n] || NOTE.C5, t, 0.14, 0.5);
    pluck(c, o, low[n] || NOTE.C4, t, 0.18, 0.2);
  };

  // Background track: chords and bass on the shared transport (bpm and swing from the house engine).
  const bgm = H.bgm({
    bpm: 74,
    swing: 0.12,
    build(Tone, bus) {
      const poly = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.04, decay: 0.6, sustain: 0.5, release: 1.2 }
      });
      poly.chain(new Tone.Filter(1800, 'lowpass'), new Tone.Reverb({ decay: 2.5, preDelay: 0.05, wet: 0.3 }), bus);
      const bass = new Tone.MonoSynth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.02, decay: 0.4, sustain: 0.4, release: 0.8 }
      });
      bass.connect(bus);

      // Progression in G
      const chords = [
        ['G3', 'Bb3', 'D4', 'F4', 'A4'], // Gm9
        ['C3', 'E3', 'G3', 'Bb3', 'D4'], // C9
        ['F3', 'A3', 'C4', 'E4'],        // Fmaj7
        ['Bb2', 'D3', 'F3', 'A3']        // Bbmaj7
      ];
      const roots = ['G2', 'C2', 'F2', 'Bb1'];
      let step = 0;
      new Tone.Loop((time) => {
        poly.triggerAttackRelease(chords[step % chords.length], '2n', time, 0.4);
        bass.triggerAttackRelease(roots[step % roots.length], '2n', time, 0.5);
        step++;
      }, '1m').start(0);
    }
  });

  // Sound settings live in the game's storage; the house engine reads them from H.audio.sfx.
  window.XQ = window.XQ || {};
  window.XQ.Audio = {
    play(name, ...args) {
      Object.assign(H.audio.sfx, window.XQ.Storage.loadSettings().sfx);
      H.audio.play(name, ...args);
    },
    setMusicEnabled(on) { return bgm.set(on); },
    setMusicVolume(v) { bgm.volume(v); }
  };
})();
