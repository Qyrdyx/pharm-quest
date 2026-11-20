/* 药理闯关 · 粒子特效与连击提示 */
import { PG, reg } from "../core/registry.js";
import { $, pick, reduceMotion, rnd } from "../core/utils.js";

reg({ FX: () => FX, comboPop: () => comboPop });

/* ================= 粒子特效 ================= */
export const FX = (() => {
  const cv = $("#fx"), cx = cv.getContext("2d"); let W, H, dpr, parts = [], running = false;
  const pal = ["#ef6a52", "#f4bf4f", "#5fd6a8", "#86cbff", "#f7ecd9", "#ff6b81"];
  function size() { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  addEventListener("resize", size); size();
  function add(p) { parts.push(p); if (!running) { running = true; requestAnimationFrame(loop); } }
  /* R：可选的随机数函数。连击特效传自己的随机源，不消耗游戏的 Math.random（否则会改变后面抽到的题，对照测试也会对不上） */
  function burst(x, y, kind = "pill", n = 18, R) {
    if (reduceMotion) n = Math.min(n, 6);
    if (R) { const pk = a => a[Math.floor(R() * a.length)];
      for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, sp = 2 + R() * (kind === "shard" ? 3 : 6);
        add({ kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, g: 0.22, rot: R() * 6, vr: (R() - 0.5) * 0.4, life: 0, max: 50 + Math.floor(R() * 30), c1: pk(pal), c2: pk(pal), s: kind === "spark" ? 2 + R() * 3 : 5 + R() * 4 }); }
      return; }
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * (kind === "shard" ? 3 : 6);
      add({ kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, g: 0.22, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        life: 0, max: 50 + rnd(30), c1: pick(pal), c2: pick(pal), s: kind === "spark" ? 2 + Math.random() * 3 : 5 + Math.random() * 4 });
    }
  }
  function rain(n = 70, R) {
    if (R) { const pk = a => a[Math.floor(R() * a.length)]; for (let i = 0; i < (reduceMotion ? 12 : n); i++) add({ kind: i % 3 ? "pill" : "cross", x: R() * W, y: -20 - R() * H * 0.6, vx: (R() - 0.5) * 1.5, vy: 2 + R() * 3, g: 0.05, rot: R() * 6, vr: (R() - 0.5) * 0.2, life: 0, max: 200, c1: pk(pal), c2: pk(pal), s: 6 + R() * 4 }); return; }
    for (let i = 0; i < (reduceMotion ? 12 : n); i++) add({ kind: i % 3 ? "pill" : "cross", x: Math.random() * W, y: -20 - Math.random() * H * 0.6, vx: (Math.random() - 0.5) * 1.5, vy: 2 + Math.random() * 3, g: 0.05,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.2, life: 0, max: 200, c1: pick(pal), c2: pick(pal), s: 6 + Math.random() * 4 });
  }
  function draw(p) {
    cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot);
    cx.globalAlpha = Math.max(0, 1 - p.life / p.max);
    const s = p.s;
    if (p.kind === "pill") {
      cx.beginPath(); cx.roundRect(-s * 1.4, -s * 0.6, s * 1.4, s * 1.2, [s * 0.6, 0, 0, s * 0.6]); cx.fillStyle = p.c1; cx.fill();
      cx.beginPath(); cx.roundRect(0, -s * 0.6, s * 1.4, s * 1.2, [0, s * 0.6, s * 0.6, 0]); cx.fillStyle = "#f7ecd9"; cx.fill();
    } else if (p.kind === "cross") {
      cx.fillStyle = p.c1; const w = s * 0.5; cx.fillRect(-s, -w / 2, s * 2, w); cx.fillRect(-w / 2, -s, w, s * 2);
    } else if (p.kind === "shard") {
      cx.fillStyle = "#ff6b81"; cx.fillRect(-s / 2, -s / 2, s, s * 0.6);
    } else { cx.fillStyle = p.c1; cx.beginPath(); cx.arc(0, 0, s, 0, 7); cx.fill(); }
    cx.restore();
  }
  function loop() {
    cx.clearRect(0, 0, W, H);
    parts = parts.filter(p => { p.life++; p.vy += p.g; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; if (p.life < p.max && p.y < H + 40) { draw(p); return true; } return false; });
    if (parts.length) requestAnimationFrame(loop); else { running = false; cx.clearRect(0, 0, W, H); }
  }
  /* silent：不画粒子，但照样消耗同样多的随机数（连线改成克制的能量线后不再撒粒子，又要保持游戏随机数序列不变） */
  function at(el, kind, n, silent) {
    if (silent) { const m = reduceMotion ? Math.min(n, 6) : n; for (let i = 0; i < m; i++) { Math.random(); Math.random(); Math.random(); Math.random(); rnd(30); pick(pal); pick(pal); Math.random(); } return; }
    const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, kind, n);
  }
  return { burst, rain, at };
})();
export function comboPop(text, el) {
  const r = el.getBoundingClientRect(), d = document.createElement("div");
  d.className = "combo-pop"; d.textContent = text; d.style.left = (r.left + r.width / 2) + "px"; d.style.top = (r.top - 10) + "px";
  document.body.appendChild(d); setTimeout(() => d.remove(), 1000);
}
