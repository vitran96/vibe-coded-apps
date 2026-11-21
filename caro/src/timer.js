'use strict';
// 09 Game Timer
// ============================================================
class GameTimer {
  constructor(onTimeout) {
    this.onTimeout = onTimeout;
    this.enabled = false;
    this.duration = 30;
    this.remaining = 30;
    this.running = false;
    this.paused = false;
    this.lastTime = 0;
    this.activePlayer = 1;
    this.lastSecWarn = -1;
    this.rafId = null;
    this.updateHUD = this.updateHUD.bind(this);
  }

  start(player, duration, remaining = null) {
    this.activePlayer = player;
    this.duration = duration;
    this.remaining = remaining !== null ? remaining : duration;
    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();
    this.lastSecWarn = -1;
    this.tick();
  }

  pause() {
    this.paused = true;
  }

  resume() {
    if (!this.running) return;
    this.paused = false;
    this.lastTime = performance.now();
    this.tick();
  }

  stop() {
    this.running = false;
    this.paused = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.resetHUD();
  }

  tick() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (!this.running) return;

    const now = performance.now();
    if (!this.paused) {
      const dt = (now - this.lastTime) / 1000;
      this.remaining = Math.max(0, this.remaining - dt);

      const secInt = Math.ceil(this.remaining);
      if (secInt <= 5 && secInt > 0 && secInt !== this.lastSecWarn) {
        this.lastSecWarn = secInt;
        App.audio.playWarning();
        if (navigator.vibrate) navigator.vibrate(30);
      }

      this.updateHUD();

      if (this.remaining <= 0) {
        this.running = false;
        if (this.onTimeout) this.onTimeout(this.activePlayer);
        return;
      }
    }
    this.lastTime = now;
    this.rafId = requestAnimationFrame(() => this.tick());
  }

  updateHUD() {
    const chip1 = $('#chip-1');
    const chip2 = $('#chip-2');
    const p1Ring = $('#chip-1 .prog');
    const p2Ring = $('#chip-2 .prog');
    const p1Time = $('#chip-1 .ptime');
    const p2Time = $('#chip-2 .ptime');

    const totalLen = 106.8;
    const progress = clamp(this.remaining / this.duration, 0, 1);
    const offset = totalLen * (1 - progress);
    const isWarn = this.remaining <= 5 && this.remaining > 0;
    const txt = Math.ceil(this.remaining) + 's';

    if (this.activePlayer === 1) {
      if (p1Ring) p1Ring.style.strokeDashoffset = offset;
      if (p1Time) p1Time.textContent = txt;
      if (chip1) chip1.classList.toggle('warn', isWarn);
      if (p2Ring) p2Ring.style.strokeDashoffset = totalLen;
      if (p2Time) p2Time.textContent = '';
      if (chip2) chip2.classList.remove('warn');
    } else {
      if (p2Ring) p2Ring.style.strokeDashoffset = offset;
      if (p2Time) p2Time.textContent = txt;
      if (chip2) chip2.classList.toggle('warn', isWarn);
      if (p1Ring) p1Ring.style.strokeDashoffset = totalLen;
      if (p1Time) p1Time.textContent = '';
      if (chip1) chip1.classList.remove('warn');
    }
  }

  resetHUD() {
    const chip1 = $('#chip-1');
    const chip2 = $('#chip-2');
    const p1Ring = $('#chip-1 .prog');
    const p2Ring = $('#chip-2 .prog');
    const p1Time = $('#chip-1 .ptime');
    const p2Time = $('#chip-2 .ptime');
    if (chip1) chip1.classList.remove('warn');
    if (chip2) chip2.classList.remove('warn');
    if (p1Ring) p1Ring.style.strokeDashoffset = '106.8';
    if (p2Ring) p2Ring.style.strokeDashoffset = '106.8';
    if (p1Time) p1Time.textContent = '';
    if (p2Time) p2Time.textContent = '';
  }
}

// ============================================================
