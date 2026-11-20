/* 药理闯关 · 连线特效：电路板走线 + 流苏流光
 * 线像电路板上的铜线：只走方块之间的缝（列间竖缝、上下两块之间的横缝），横平竖直、拐角切 45°，两端是焊盘；
 * 每次按方块的实际位置现算路线，字数不同、手机 / 平板换了排版都能绕开方块。
 * 连上时，一道流光沿着走线从第一块跑到第二块，身后拖着一束会摆动、越往后越散越淡的流苏，走过的地方走线“通电”亮起；
 * 到达后火花炸开，走线和焊盘在半秒左右暗下去。画在网格里一张不挡点击的透明画布上（只有网格那么大，坐标就是网格坐标，页面滚动自然对齐）。
 * 只用自己的随机数（VR），不动游戏的 Math.random。
 * 对外只有两个函数：zap(a, c, 颜色, 延迟, { stop, bad }) 画一次连线、返回流光到达终点的毫秒数；clearLinks() 收掉所有正在画的线。
 * 什么时候画、配合方块锁定 / 涟漪 / 升档大字，由 combo.js 决定。 */
let cv = null, ctx = null, items = [], raf = 0;
const grid = () => document.querySelector("#mgrid");
/* 自己的随机数（流苏摆动、火花方向），不动游戏的 Math.random */
const VR = (() => { let s = (Date.now() ^ 0x51ed27a3) >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
const MG = 40;   // 画布比网格四周各大 40px（流苏会稍微甩出网格）
function canvas() {
  const G = grid(); if (!G) return null;
  if (!cv || cv.parentNode !== G) { cv && cv.remove(); cv = document.createElement("canvas"); cv.className = "cb-comet"; G.appendChild(cv); ctx = cv.getContext("2d"); }
  const dpr = Math.min(1.5, window.devicePixelRatio || 1), w = G.clientWidth + MG * 2, h = G.clientHeight + MG * 2;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + "px"; cv.style.height = h + "px"; }
  ctx.setTransform(dpr, 0, 0, dpr, MG * dpr, MG * dpr); return ctx;
}
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, a).toFixed(3)})`; };
const PAD = 2;   // 线离方块至少这么远
/* 网格里的障碍物：所有方块和列标题。用排版位置（offsetLeft 等），不受选中时放大 1.03 倍、抖动之类的变形影响——
   以前用屏幕位置，选中那块放大后会把缝堵死，找不到路就退成了直线 */
function box(el, G) {
  if (el.offsetParent === G) return { l: el.offsetLeft, t: el.offsetTop, r: el.offsetLeft + el.offsetWidth, b: el.offsetTop + el.offsetHeight };
  const g = G.getBoundingClientRect(), r = el.getBoundingClientRect(); return { l: r.left - g.left, t: r.top - g.top, r: r.right - g.left, b: r.bottom - g.top };
}
function obstacles(s) {
  return [...s.querySelectorAll(".tile, .match-col > h3")].map(el => ({ el, ...box(el, s) })).filter(o => o.r - o.l > 1 && o.b - o.t > 1);
}
/* 缝的中线：每块和它右边 / 下边最近一块之间的正中；再加上网格外围一圈 */
function channels(obs, W, H) {
  const xs = new Set([-9, W + 9]), ys = new Set([-9, H + 9]);
  for (const a of obs) {
    let nx = Infinity, ny = Infinity;
    for (const b of obs) {
      if (b === a) continue;
      if (b.l >= a.r - 0.5 && b.t < a.b && b.b > a.t) nx = Math.min(nx, b.l);
      if (b.t >= a.b - 0.5 && b.l < a.r && b.r > a.l) ny = Math.min(ny, b.t);
    }
    if (nx < Infinity) xs.add(Math.round((a.r + nx) * 5) / 10);
    if (ny < Infinity) ys.add(Math.round((a.b + ny) * 5) / 10);
  }
  return [xs, ys];
}
/* 一块的四个出线口：dir 0 右 / 1 下 / 2 左 / 3 上；上下出线稍微贵一点（尽量从左右边出线） */
function ports(o) {
  const cx = (o.l + o.r) / 2, cy = (o.t + o.b) / 2, d = PAD + 1.5;
  return [{ x: o.r + d, y: cy, ex: o.r, ey: cy, dir: 0, pen: 0 }, { x: cx, y: o.b + d, ex: cx, ey: o.b, dir: 1, pen: 26 }, { x: o.l - d, y: cy, ex: o.l, ey: cy, dir: 2, pen: 0 }, { x: cx, y: o.t - d, ex: cx, ey: o.t, dir: 3, pen: 26 }];
}
/* 最短走线（少拐弯优先）：在缝的中线组成的网格上做带方向的 Dijkstra */
function route(s, a, c, free) {
  const obs = obstacles(s), g = { width: s.clientWidth, height: s.clientHeight }, oa = obs.find(o => o.el === a), oc = obs.find(o => o.el === c);
  if (!oa || !oc) return null;
  /* 固定出线口：两块左右分开时，各自从朝向对方那条边的正中出线；在同一列（上下排列）时都从右边正中出线。
   这样同一块的线总是从同一个点出发、汇聚到同一个点，不会一会儿从上边、一会儿从右边出去 */
  const side = oc.l >= oa.r - 1 ? [0, 2] : oa.l >= oc.r - 1 ? [2, 0] : [0, 0];
  const [xs0, ys0] = channels(obs, g.width, g.height), pa = ports(oa).filter(p => free || p.dir === side[0]), pc = ports(oc).filter(p => free || p.dir === side[1]);
  for (const p of pa.concat(pc)) { xs0.add(p.x); ys0.add(p.y); }
  const xs = [...xs0].sort((m, n) => m - n), ys = [...ys0].sort((m, n) => m - n), NX = xs.length, NY = ys.length;
  const hit = (l, t, r, b) => obs.some(o => o.l - PAD < r && o.r + PAD > l && o.t - PAD < b && o.b + PAD > t);
  const ix = new Map(xs.map((v, i) => [v, i])), iy = new Map(ys.map((v, i) => [v, i]));
  const okH = new Uint8Array(NX * NY), okV = new Uint8Array(NX * NY);   // okH[i,j]：(i,j)→(i+1,j) 这段不碰方块
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    if (i + 1 < NX) okH[j * NX + i] = hit(xs[i], ys[j] - 0.01, xs[i + 1], ys[j] + 0.01) ? 0 : 1;
    if (j + 1 < NY) okV[j * NX + i] = hit(xs[i] - 0.01, ys[j], xs[i] + 0.01, ys[j + 1]) ? 0 : 1;
  }
  const N = NX * NY * 4, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), heap = [];
  const push = (k, d) => { heap.push([d, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (const p of pa) { if (hit(p.x - 0.01, p.y - 0.01, p.x + 0.01, p.y + 0.01)) continue; const k = (iy.get(p.y) * NX + ix.get(p.x)) * 4 + p.dir; if (p.pen < dist[k]) { dist[k] = p.pen; push(k, p.pen); } }
  const goal = new Map(); for (const p of pc) if (!hit(p.x - 0.01, p.y - 0.01, p.x + 0.01, p.y + 0.01)) goal.set(iy.get(p.y) * NX + ix.get(p.x), p);
  const BEND = 22, DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  let best = Infinity, bestK = -1, bestP = null;
  while (heap.length) {
    const [d, k] = pop(); if (d > dist[k] || d >= best) continue;
    const dir = k & 3, node = k >> 2, i = node % NX, j = (node / NX) | 0;
    const gp = goal.get(node);
    if (gp) { const t = d + gp.pen + (dir === (gp.dir + 2) % 4 ? 0 : BEND); if (t < best) { best = t; bestK = k; bestP = gp; } }
    for (let nd = 0; nd < 4; nd++) {
      if (nd === (dir + 2) % 4) continue;
      const ni = i + DX[nd], nj = j + DY[nd]; if (ni < 0 || nj < 0 || ni >= NX || nj >= NY) continue;
      const ok = nd === 0 ? okH[j * NX + i] : nd === 2 ? okH[j * NX + ni] : nd === 1 ? okV[j * NX + i] : okV[nj * NX + i];
      if (!ok) continue;
      const len = Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]), out = (ni < 1 || nj < 1 || ni > NX - 2 || nj > NY - 2) ? len * 0.6 : 0;   // 绕到网格外面多算一点
      const nk = ((nj * NX + ni) << 2) + nd, nd2 = d + len + out + (nd === dir ? 0 : BEND);
      if (nd2 < dist[nk]) { dist[nk] = nd2; prev[nk] = k; push(nk, nd2); }
    }
  }
  if (bestK < 0) return null;
  const pts = [[bestP.ex, bestP.ey]];
  let firstK = bestK; for (let k = bestK; k >= 0; k = prev[k]) { const node = k >> 2; pts.push([xs[node % NX], ys[(node / NX) | 0]]); firstK = k; }
  const fn = firstK >> 2, fx = xs[fn % NX], fy = ys[(fn / NX) | 0], sp = pa.find(p => p.x === fx && p.y === fy && p.dir === (firstK & 3)) || pa.find(p => p.x === fx && p.y === fy);
  if (sp) pts.push([sp.ex, sp.ey]);
  pts.reverse();
  return pts.filter((p, i, Z) => !(i > 0 && i < Z.length - 1 && ((Z[i - 1][0] === p[0] && p[0] === Z[i + 1][0]) || (Z[i - 1][1] === p[1] && p[1] === Z[i + 1][1]))));   // 去掉共线的点
}
/* 折线 → 拐角切 45°（电路板走线的拐法） */
function chamfer(pts, r = 7) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1], la = Math.hypot(x - px, y - py), lb = Math.hypot(nx - x, ny - y), c = Math.min(r, la / 2, lb / 2);
    out.push([x - (x - px) / la * c, y - (y - py) / la * c], [x + (nx - x) / lb * c, y + (ny - y) / lb * c]);
  }
  out.push(pts[pts.length - 1]); return out;
}
/* 每 3px 取一个点，记下累计长度和（平滑过的）法线，方便按长度取位置 */
function dense(pts) {
  const P = [];
  for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3)); for (let k = 0; k < n; k++) P.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]); }
  P.push(pts[pts.length - 1]);
  const S = [0]; for (let i = 1; i < P.length; i++) S.push(S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const N = P.map((_, i) => { const a = P[Math.max(0, i - 3)], b = P[Math.min(P.length - 1, i + 3)], dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1; return [-dy / m, dx / m]; });
  return { P, S, N, len: S[S.length - 1] || 1 };
}
function sample(T, s) {
  s = Math.max(0, Math.min(T.len, s)); let lo = 0, hi = T.S.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T.S[m] <= s) lo = m; else hi = m; }
  const seg = T.S[hi] - T.S[lo] || 1, f = (s - T.S[lo]) / seg, A = T.P[lo], B = T.P[hi], na = T.N[lo], nb = T.N[hi];
  return [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, na[0] + (nb[0] - na[0]) * f, na[1] + (nb[1] - na[1]) * f];
}
/* 算一条走线（网格内坐标）：先用固定出线口；万一堵住了再放开出线口；都不行才退回直线 */
function linkPath(a, c) {
  const g = grid(); let pts = null;
  try { pts = route(g, a, c) || route(g, a, c, true); } catch (e) {}
  if (!pts || pts.length < 2) { const A = box(a, g), C = box(c, g); pts = [[(A.l + A.r) / 2, (A.t + A.b) / 2], [(C.l + C.r) / 2, (C.t + C.b) / 2]]; }
  return dense(chamfer(pts));
}
/* 一次连线：电路走线随着流光一路“通电”亮起来，流光拖着一束流苏；到达后火花炸开，走线慢慢暗下去。o.stop < 1：走到半路就断（连错） */
export function zap(a, c, color, delay = 0, o = {}) {
  if (!grid()) return 0;
  const T = linkPath(a, c), dur = Math.round(Math.min(900, Math.max(380, 240 + T.len * 0.6)));
  const strands = [{ amp: 0, w: 8, glow: 1 }, { amp: 0, w: 2.6, core: 1 }];
  for (let i = 0; i < 8; i++) strands.push({ amp: (i % 2 ? 1 : -1) * (0.3 + VR() * 0.7), ph: VR() * 6.28, f: 4 + VR() * 5, w: 0.8 + VR() * 1 });
  items.push({ kind: "zap", T, a, c, color, cTrace: "#9fe8ff", cTraceBad: "#ff8095", t0: performance.now() + delay, dur, linger: o.bad ? 380 : 560, stop: o.stop || 1, bad: !!o.bad, strands, burst: false });
  start(); return delay + dur;
}
function start() { if (!raf) raf = requestAnimationFrame(tick); }
function drawZap(g, it, now) {
  const tau = now - it.t0; if (tau < 0) return true;
  if (!it.a.isConnected || !it.c.isConnected) return false;
  const T = it.T, fly = Math.min(1, tau / it.dur), post = Math.max(0, (tau - it.dur) / it.linger); if (post >= 1) return false;
  const head = ease(fly) * it.stop * T.len, fade = 1 - post * post, trace = it.bad ? it.cTraceBad : it.cTrace;
  /* 走线：从起点亮到流光所在的位置（二分找到位置，一次描完） */
  let lo = 0, hi = T.S.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T.S[m] <= head) lo = m; else hi = m; }
  const [hx0, hy0] = sample(T, head);
  g.beginPath(); for (let i = 0; i <= lo; i++) { const p = T.P[i]; i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.lineTo(hx0, hy0);
  g.strokeStyle = hexA(trace, 0.13 * fade); g.lineWidth = 6; g.stroke();
  g.strokeStyle = hexA(trace, 0.75 * fade); g.lineWidth = 1.8; g.stroke();
  /* 焊盘 */
  const pad = p => { g.fillStyle = hexA(trace, fade * 0.35); g.beginPath(); g.arc(p[0], p[1], 4.5, 0, 6.2832); g.fill(); g.strokeStyle = hexA(trace, fade); g.lineWidth = 1.4; g.beginPath(); g.arc(p[0], p[1], 3, 0, 6.2832); g.stroke(); };
  pad(T.P[0]); if (fly >= 1 && !it.bad) pad(T.P[T.P.length - 1]);
  /* 流光 + 流苏：越往后越散、越淡、轻轻摆动；到达后尾巴收拢。每根丝分 6 段描，每段一个透明度（比逐点描省很多） */
  const TL = Math.min(170, T.len * 0.55) * (1 - post) * Math.min(1, fly * 2), spread = 9 * (it.bad ? 1.5 : 1), droop = it.bad ? post * post * 24 : 0, K = 18, SEG = 6, pts = new Array(K + 1);
  if (TL > 1) for (const s of it.strands) {
    for (let j = 0; j <= K; j++) {
      const q = j / K, [x, y, nx, ny] = sample(T, head - q * TL);
      const wob = s.amp ? s.amp * spread * Math.pow(q, 1.2) * (0.7 + 0.3 * Math.sin(s.ph + q * s.f + now * 0.012)) * (1 + post * 2) : 0;
      pts[j] = [x + nx * wob, y + ny * wob + droop * q];
    }
    const per = K / SEG;
    for (let k = 0; k < SEG; k++) {
      const q = (k + 0.5) / SEG, al = Math.pow(1 - q, s.glow ? 1.1 : 1.5) * fade * (s.core ? 1 : s.glow ? 0.25 : 0.85);
      g.strokeStyle = s.core ? `rgba(255,255,255,${al.toFixed(3)})` : hexA(it.color, al); g.lineWidth = s.w * (1 - q * 0.75);
      g.beginPath(); const j0 = k * per; g.moveTo(pts[j0][0], pts[j0][1]); for (let j = j0 + 1; j <= j0 + per; j++) g.lineTo(pts[j][0], pts[j][1]); g.stroke();
    }
  }
  /* 流光的亮头 */
  const r = 13 * (1 + post * 0.5), ha = (it.bad ? 0.75 : 1) * (fly < 1 ? 1 : 1 - post);
  if (ha > 0.01) { const gr = g.createRadialGradient(hx0, hy0, 0, hx0, hy0, r); gr.addColorStop(0, `rgba(255,255,255,${ha.toFixed(3)})`); gr.addColorStop(0.35, hexA(it.color, ha * 0.8)); gr.addColorStop(1, hexA(it.color, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(hx0, hy0, r, 0, 6.2832); g.fill(); }
  /* 到达：火花炸开（网格坐标，不跟踪方块位置） */
  if (fly >= 1 && !it.burst && !it.bad) { it.burst = true;
    for (let i = 0; i < 10; i++) { const ang = (i / 10) * 6.2832 + VR() * 0.5, sp = 0.08 + VR() * 0.09; items.push({ kind: "spark", x: hx0, y: hy0, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, t0: now, life: 300 + VR() * 160, color: it.color }); } }
  return true;
}
function drawSpark(g, it, now) {
  const tau = now - it.t0, p = tau / it.life; if (p >= 1) return false;
  const d = tau * (1 - p * 0.5), a = (1 - p) * (1 - p);
  g.strokeStyle = hexA(it.color, a); g.lineWidth = 1.4 * (1 - p) + 0.3; g.beginPath(); g.moveTo(it.x + it.vx * d * 0.55, it.y + it.vy * d * 0.55); g.lineTo(it.x + it.vx * d, it.y + it.vy * d); g.stroke();
  return true;
}
function tick() {
  raf = 0; const g = canvas(); if (!g) { items = []; return; }
  const now = performance.now();
  g.clearRect(-MG, -MG, cv.width, cv.height); g.globalCompositeOperation = "lighter"; g.lineCap = "round"; g.lineJoin = "round";
  items = items.filter(it => it.kind === "zap" ? drawZap(g, it, now) : drawSpark(g, it, now));
  g.globalCompositeOperation = "source-over";
  if (items.length) raf = requestAnimationFrame(tick); else g.clearRect(-MG, -MG, cv.width, cv.height);
}
export function clearLinks() { items = []; }
