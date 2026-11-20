/* 药理闯关 · 背景：漂浮的分子结构 */
import { PG } from "../core/registry.js";
import { $, clamp, pick, reduceMotion, rnd } from "../core/utils.js";
import { cfg } from "../core/state.js";

/* ================= 背景：漂浮的分子结构 ================= */
(() => {
  const cv = $("#bg"), cx = cv.getContext("2d"); let W, H, mols = [];
  let raf = 0, lastT = 0;
  function size() { const dpr = 1; W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); }   // 淡淡的背景线条，1 倍像素看不出差别
  function make() {
    mols = Array.from({ length: Math.round(clamp(W * H / 90000, 6, 16)) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 14 + Math.random() * 20,
      a: Math.random() * 6, va: (Math.random() - 0.5) * 0.003, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15,
      arms: Array.from({ length: 1 + rnd(3) }, () => rnd(6)), c: pick(["#86cbff", "#5fd6a8", "#f4bf4f"]) }));
  }
  function hex(m) {
    cx.save(); cx.translate(m.x, m.y); cx.rotate(m.a); cx.strokeStyle = m.c; cx.globalAlpha = 0.09; cx.lineWidth = 1.6;
    cx.beginPath(); for (let i = 0; i <= 6; i++) { const t = i * Math.PI / 3; cx[i ? "lineTo" : "moveTo"](Math.cos(t) * m.r, Math.sin(t) * m.r); } cx.stroke();
    cx.beginPath(); for (let i = 0; i <= 6; i++) { const t = i * Math.PI / 3; cx[i ? "lineTo" : "moveTo"](Math.cos(t) * m.r * 0.7, Math.sin(t) * m.r * 0.7); if (i % 2) cx.moveTo(Math.cos(t + Math.PI / 3) * m.r * 0.7, Math.sin(t + Math.PI / 3) * m.r * 0.7); } cx.stroke();
    m.arms.forEach(k => { const t = k * Math.PI / 3, x1 = Math.cos(t) * m.r, y1 = Math.sin(t) * m.r, x2 = Math.cos(t) * m.r * 1.9, y2 = Math.sin(t) * m.r * 1.9;
      cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke(); cx.beginPath(); cx.arc(x2, y2, 3, 0, 7); cx.fillStyle = m.c; cx.fill(); });
    cx.restore();
  }
  const still = () => reduceMotion || (cfg.eco && (cfg.ecoOpts || {}).bg !== 0) || document.hidden;   // 省电模式里“背景静止”这一项
  function draw(k) {
    cx.clearRect(0, 0, W, H);
    mols.forEach(m => { m.x += m.vx * k; m.y += m.vy * k; m.a += m.va * k; if (m.x < -60) m.x = W + 60; if (m.x > W + 60) m.x = -60; if (m.y < -60) m.y = H + 60; if (m.y > H + 60) m.y = -60; hex(m); });
  }
  function frame(t) {
    raf = 0; if (still()) return;
    if (t - lastT >= 32) { draw(Math.min(4, (t - lastT) / 16.7 || 1)); lastT = t; }   // 约 30 帧，移动速度不变
    raf = requestAnimationFrame(frame);
  }
  window.bgAnim = () => { if (raf) cancelAnimationFrame(raf); raf = 0; if (still()) { if (!document.hidden) draw(0); } else { lastT = performance.now(); raf = requestAnimationFrame(frame); } };
  addEventListener("resize", () => { size(); make(); draw(0); });
  document.addEventListener("visibilitychange", () => window.bgAnim());
  size(); make(); draw(0); window.bgAnim();
})();
