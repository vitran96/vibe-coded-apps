// House audio: one SFX output (wraps House.play) and the shared BGM engine (Tone.js transport).
// Games choose their own chords, tempo and style through build(); everything else is common.
(() => {
  const H = (globalThis.House ??= {});
  let ctx = null, out = null;

  H.audio = {
    sfx: { on: true, vol: 0.7 }, // games write these from their Settings
    ctx() {
      if (!ctx) {
        const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        out = ctx.createGain();
        out.connect(ctx.destination);
      }
      return ctx;
    },
    play(name, ...args) {
      if (!H.audio.sfx.on) return;
      const c = H.audio.ctx();
      if (!c) return;
      out.gain.value = H.audio.sfx.vol;
      H.play(c, out, name, ...args);
    },
    // Browsers only start audio after a gesture; any first tap or key press unlocks both engines.
    unlock() {
      H.audio.ctx()?.resume?.();
      globalThis.Tone?.start().catch(() => {});
    },
  };
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, H.audio.unlock, { once: true, passive: true });

  // BGM: build(Tone, bus) runs once, on first play, and creates the game's synths and Loops on the Transport.
  H.bgm = ({ bpm = 74, swing = 0, build }) => {
    const T = () => globalThis.Tone;
    let bus = null, built = false, running = false, vol = 0.5;
    const applyVol = () => { if (bus) bus.volume.value = vol <= 0 ? -Infinity : 20 * Math.log10(vol); };

    document.addEventListener('visibilitychange', () => {
      if (!running || !built) return;
      if (document.hidden) T().Transport.pause();
      else T().Transport.start();
    });

    return {
      async set(on) {
        running = on;
        if (!T()) return; // Tone.js missing: stay silent
        if (!on) { T().Transport.stop(); return; }
        try { await T().start(); } catch { return; } // no gesture yet: stay silent
        if (!built) {
          T().Transport.bpm.value = bpm;
          T().Transport.swing = swing;
          bus = new (T().Volume)(0).toDestination();
          build(T(), bus);
          built = true;
          applyVol();
        }
        T().Transport.start();
      },
      volume(v) { vol = v; applyVol(); },
    };
  };
})();
