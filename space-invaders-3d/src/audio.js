export const Sfx = {
  ctx: null,
  init() { if (this.ctx) return; const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); },
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },
  tone({ freq = 440, type = "square", dur = 0.12, gain = 0.16, slideTo = null }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, osc = this.ctx.createOscillator(), g = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.ctx.destination); osc.start(t); osc.stop(t + dur);
  },
  laser() { this.tone({ freq: 900, slideTo: 240, type: "square", dur: 0.10, gain: 0.07 }); },
  explosion() { this.tone({ freq: 200, slideTo: 45, type: "sawtooth", dur: 0.28, gain: 0.14 }); },
  impact() { this.tone({ freq: 90, slideTo: 28, type: "sawtooth", dur: 0.5, gain: 0.22 }); },
  playerHit() { this.tone({ freq: 150, slideTo: 40, type: "square", dur: 0.35, gain: 0.18 }); },
  hit() { this.tone({ freq: 320, slideTo: 120, type: "triangle", dur: 0.16, gain: 0.12 }); },
  lock() { this.tone({ freq: 660, type: "triangle", dur: 0.06, gain: 0.1 }); setTimeout(() => this.tone({ freq: 990, type: "triangle", dur: 0.08, gain: 0.1 }), 70); },
  boost() { this.tone({ freq: 180, slideTo: 520, type: "sawtooth", dur: 0.35, gain: 0.08 }); },
  waveClear() { this.tone({ freq: 523, type: "triangle", dur: 0.12, gain: 0.13 }); setTimeout(() => this.tone({ freq: 784, type: "triangle", dur: 0.18, gain: 0.13 }), 120); },
};
