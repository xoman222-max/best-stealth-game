// SoundEngine: every sound in Shadow Courier is synthesised live with WebAudio.
// No audio files are loaded, so the game makes zero network requests.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ambientNodes = null;
  }

  // Browsers only allow audio after a user gesture; call from a key/click handler.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    } catch (err) {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(muted ? 0 : 0.5, this.ctx.currentTime);
    }
  }

  // One oscillator blip with an exponential decay envelope.
  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol || 0.2, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // A short burst of filtered noise, for footsteps and impacts.
  noiseBurst(dur, vol, filterFreq) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 800;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.15, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  footstep(sneaking) {
    if (sneaking) this.noiseBurst(0.05, 0.05, 500);
    else this.noiseBurst(0.07, 0.12, 700);
  }

  coinClink() {
    this.tone(2093, 0.12, 'sine', 0.16);
    this.tone(2637, 0.18, 'sine', 0.12, 2400);
    this.noiseBurst(0.04, 0.08, 4000);
  }

  coinLand() {
    this.tone(1568, 0.09, 'triangle', 0.18);
    this.tone(1175, 0.14, 'triangle', 0.12);
  }

  pickup() {
    this.tone(659, 0.09, 'sine', 0.2);
    setTimeout(() => this.tone(988, 0.14, 'sine', 0.2), 70);
  }

  suspicious() {
    this.tone(440, 0.12, 'square', 0.07);
    setTimeout(() => this.tone(554, 0.12, 'square', 0.07), 110);
  }

  alertSting() {
    this.tone(196, 0.16, 'sawtooth', 0.16, 392);
    setTimeout(() => this.tone(196, 0.2, 'sawtooth', 0.16, 440), 140);
  }

  caught() {
    this.tone(392, 0.18, 'sawtooth', 0.18, 196);
    setTimeout(() => this.tone(262, 0.3, 'sawtooth', 0.18, 110), 160);
  }

  doorOpen() {
    this.tone(330, 0.25, 'sine', 0.14, 660);
    this.noiseBurst(0.2, 0.06, 1200);
  }

  levelClear() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'sine', 0.2), i * 110));
  }

  gameWin() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'sine', 0.2), i * 130));
  }

  // A quiet low drone that runs under gameplay.
  startAmbient() {
    if (!this.ctx || this.ambientNodes) return;
    try {
      const oscA = this.ctx.createOscillator();
      const oscB = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      oscA.type = 'sine';
      oscA.frequency.value = 55;
      oscB.type = 'sine';
      oscB.frequency.value = 55.7;
      gain.gain.value = 0.045;
      lfo.frequency.value = 0.07;
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      oscA.connect(gain);
      oscB.connect(gain);
      gain.connect(this.master);
      oscA.start();
      oscB.start();
      lfo.start();
      this.ambientNodes = { oscA, oscB, lfo, gain };
    } catch (err) {
      this.ambientNodes = null;
    }
  }

  stopAmbient() {
    if (!this.ambientNodes) return;
    try {
      this.ambientNodes.oscA.stop();
      this.ambientNodes.oscB.stop();
      this.ambientNodes.lfo.stop();
    } catch (err) {}
    this.ambientNodes = null;
  }
}
