/* 药理闯关 · 心电监护（生命 / 连击） */
import { PG, reg } from "../core/registry.js";
import { frameSlot } from "./power.js";

reg({ ECG: () => ECG });

/* ================= 心电监护（生命 / 连击） ================= */
export const ECG = {
  cv: null, cx: null, buf: [], phase: 0, bpm: 72, alarm: 0, flat: false, last: 0, raf: 0,
  mount(cv) {
    this.cv = cv; this.cx = cv.getContext("2d"); this.buf = []; this.flat = false; this.alarm = 0; this.phase = 0;
    const dpr = Math.min(1.5, devicePixelRatio || 1), r = cv.getBoundingClientRect();
    cv.style.backgroundImage = "linear-gradient(90deg,rgba(95,214,168,.08) 1px,transparent 1px),linear-gradient(rgba(95,214,168,.08) 1px,transparent 1px)"; cv.style.backgroundSize = "12px 12px";
    cv.width = Math.max(100, r.width) * dpr; cv.height = r.height * dpr; this.cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = Math.max(100, r.width); this.h = r.height;
    cancelAnimationFrame(this.raf); this.last = performance.now(); this.raf = requestAnimationFrame(t => this.loop(t));
  },
  wave(p) {
    const g = (c, w, h) => h * Math.exp(-((p - c) ** 2) / (2 * w * w));
    return g(.12, .025, .12) - g(.24, .008, .12) + g(.27, .011, 1) - g(.30, .01, .28) + g(.52, .045, .24);
  },
  loop(t) {
    if (!this.cv || !this.cv.isConnected) return;
    if (document.hidden || frameSlot(t) === this.slot) { this.raf = requestAnimationFrame(tt => this.loop(tt)); return; }   // 降帧：30 帧（省电 20 帧）
    this.slot = frameSlot(t);
    const dt = Math.min(120, t - this.last); this.last = t;
    const steps = Math.max(1, Math.round(dt / 16.7));
    for (let k = 0; k < steps; k++) {
      const prev = this.phase;
      this.phase = (this.phase + this.bpm / 60 / 60) % 1;
      if (prev > this.phase && !this.flat && this.bpm > 100) { /* 心跳很快时不播放提示音，避免吵 */ }
      let v = this.flat ? 0 : this.wave(this.phase);
      if (this.alarm > 0) { v += (Math.random() - 0.5) * 0.5; this.alarm--; }
      this.buf.push(v);
    }
    const max = Math.floor(this.w / 2); while (this.buf.length > max) this.buf.shift();
    const cx = this.cx, w = this.w, h = this.h; cx.clearRect(0, 0, w, h);
    const col = (this.alarm > 0 || this.flat) ? "#ff6b81" : "#5fd6a8";
    cx.beginPath(); this.buf.forEach((v, i) => { const x = i * 2, y = h * 0.66 - v * h * 0.55; i ? cx.lineTo(x, y) : cx.moveTo(x, y); });
    cx.strokeStyle = col; cx.globalAlpha = 0.25; cx.lineWidth = 6; cx.stroke();   // 宽而淡的一层代替 shadowBlur 发光
    cx.globalAlpha = 1; cx.lineWidth = 2; cx.stroke();
    if (this.buf.length) { const i = this.buf.length - 1; cx.fillStyle = col; cx.beginPath(); cx.arc(i * 2, h * 0.66 - this.buf[i] * h * 0.55, 3, 0, 7); cx.fill(); }
    this.raf = requestAnimationFrame(tt => this.loop(tt));
  }
};
