/* 药理闯关 · 界面音效 */
import { PG, reg } from "../core/registry.js";
import { cfg } from "../core/state.js";
import { AU, ensureAudio, mtof, noiseHit, pressAt, voice } from "./engine.js";

reg({ SFX: () => SFX });

/* 五声音阶（G4 A4 C5 D5 E5 G5 A5，约 392～880 Hz）：连击、连线的音高阶梯 */
const PENTA = [67, 69, 72, 74, 76, 79, 81];
/* 钟声：正弦基音 + 很轻、衰减很快的高八度，起音 6 ms 避免“咔”的一声 */
function bell(o, t, m, dur, vol) { voice(o, t, mtof(m), dur, { vol, a: 0.006 }); voice(o, t, mtof(m + 12), dur * 0.35, { vol: vol * 0.25, a: 0.006 }); voice(o, t, mtof(m) * 0.5, dur * 0.8, { type: "triangle", vol: vol * 0.35, a: 0.01, lp: 1200 }); }
/* ---------- 答题音效（第二版）----------
 * 依据：界面声音要分层级（按键最轻最短、判定次之、庆祝最少用，Material Sound）；按下到出声 20～70 ms 内（Kaaresoja 触屏按钮研究）；
 * 不用方波 / 锯齿波、滤掉 4 kHz 以上（降低尖锐度），也不让两个很接近的音同时响（会产生 15～300 Hz 的“拍”，就是蜂鸣器那种嗡嗡的粗糙感）；
 * 常响的声音每次在音高 / 音量上有一点点随机变化，免得听腻，但旋律走向固定，一听就知道对错（Brewster 的 earcon 指南：靠走向和节奏区分）。
 * 随机数用自己的（不动游戏的 Math.random）。 */
const SR = (() => { let x = 0x2f6b9a1d; return () => { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
const jit = (c = 12) => (SR() - 0.5) * 2 * c;              // 音高随机 ±c 音分
const jv = v => v * (0.85 + SR() * 0.3);                    // 音量随机约 ±1.5 dB
/* 马林巴：正弦基音 + 很快消失的第 4 泛音（木琴片的特征）+ 一点点槌头敲击的噪声；起音 2 ms，干净不刺耳 */
function marimba(o, t, m, dur, vol, cents = 0) {
  const f = mtof(m) * Math.pow(2, cents / 1200);
  voice(o, t, f, dur, { vol, a: 0.002 });
  voice(o, t, f * 3.99, dur * 0.22, { vol: vol * 0.16, a: 0.002, lp: 3800 });
  voice(o, t, f * 0.5, dur * 0.6, { type: "triangle", vol: vol * 0.22, a: 0.004, lp: 900 });
  noiseHit(o, t, 0.012, { off: 0.21, ft: "bandpass", f: 1800, q: 1.5, vol: vol * 0.25 });
}
/* 木鱼：短促、带一点音高下滑的闷响（答错用，低沉但不吓人） */
function woodblock(o, t, m, dur, vol) {
  const f = mtof(m);
  voice(o, t, f, dur, { type: "triangle", vol, a: 0.002, glide: f * 0.86, lp: 1100 });
  noiseHit(o, t, 0.02, { off: 0.33, ft: "bandpass", f: 900, q: 2, vol: vol * 0.35 });
}
/* 无尽上行（谢泼德音阶）：同一个音同时在几个八度上响，按音高给钟形权重（中音区最响、两头很轻）。
 * 每连对一题往上走一级五声音阶；走满一个八度时，最高那层已经淡出、最低处新的一层淡进来，所以听起来一直在往上爬，
 * 但永远不会尖到刺耳，也没有“到顶”的那一刻。答错连对清零，从最低一级重新爬。 */
const PENT5 = [0, 2, 4, 7, 9];
const shW = m => Math.exp(-0.5 * Math.pow((m - 74) / 9, 2));
function shepard(step) {
  const s = Math.max(0, step), m0 = 55 + PENT5[s % 5], out = [];
  for (let k = 0; k < 4; k++) { const m = m0 + 12 * k, w = shW(m); if (w > 0.08) out.push([m, w]); }
  const sum = out.reduce((a, x) => a + x[1], 0) || 1; return out.map(([m, w]) => [m, w / sum]);
}
/* 按钮音效的几种候选（开发者版里可以试听、挑一个）：都没有“咔”的噪声起音，听起来不会“嗒嗒嗒” */
const CLICK = {
  bubble: (o, t) => voice(o, t, 520 * Math.pow(2, jit(25) / 1200), 0.07, { vol: jv(0.06), a: 0.004, glide: 760, lp: 2000 }),          // 泡泡：往上的轻“啵”
  drop: (o, t) => voice(o, t, 700 * Math.pow(2, jit(25) / 1200), 0.05, { vol: jv(0.045), a: 0.003, glide: 1250, lp: 2600 }),           // 水滴
  soft: (o, t) => voice(o, t, 420 * Math.pow(2, jit(20) / 1200), 0.06, { type: "triangle", vol: jv(0.08), a: 0.006, glide: 360, lp: 1200 }),   // 轻触：很闷的“噗”
  ding: (o, t) => { const f = 1320 * Math.pow(2, jit(15) / 1200); voice(o, t, f, 0.09, { vol: jv(0.028), a: 0.003 }); voice(o, t, f / 2, 0.06, { vol: jv(0.02), a: 0.004 }); }   // 小叮
};
export const CLICK_STYLES = Object.keys(CLICK);
const clickStyle = () => (window.PG_DEV && window.PG_DEV.clickStyle) || "bubble";
/* 选项对应的音：A B C D E… 依次是五声音阶 G4 A4 C5 D5 E5 G5 */
const OPT_NOTE = [67, 69, 72, 74, 76, 79, 81];
/* 音效 */
export const SFX = {
  _(fn) { if (!ensureAudio() || cfg.sfx <= 0) return; fn(AU.ctx.currentTime, AU.sfx); },
  // 按下时已经由全局监听播过按键音，松开后触发的 click/pick 就不再重复播放
  /* 普通按钮：很轻的木质“嗒”（以前是方波“哔”，所有按钮一个声） */
  click() { if (performance.now() - pressAt < 450) return; this._((t, o) => (CLICK[clickStyle()] || CLICK.bubble)(o, t)); },
  clickAs(k) { this._((t, o) => (CLICK[k] || CLICK.bubble)(o, t)); },
  /* 多选题勾选 / 取消：勾上是往上的小“嘀”，取消往下；不带参数时当成勾上 */
  pick(on = true) { if (performance.now() - pressAt < 450) return; this._((t, o) => { const c = jit(8); if (on) { marimba(o, t, 74, 0.14, jv(0.1), c); marimba(o, t + 0.045, 79, 0.16, jv(0.08), c); } else { marimba(o, t, 76, 0.12, jv(0.08), c); marimba(o, t + 0.045, 71, 0.14, jv(0.06), c); } }); },
  /* 排序题：第几个就往上走几级，点完正好走完一段音阶 */
  rank(k) { this._((t, o) => marimba(o, t, OPT_NOTE[Math.min(Math.max(k - 1, 0), OPT_NOTE.length - 1)], 0.22, jv(0.12), jit(6))); },
  /* 记不清：一个中性的单音，往下轻轻落一点，没有惩罚感 */
  dunno() { this._((t, o) => voice(o, t, mtof(69), 0.32, { vol: 0.09, a: 0.01, glide: mtof(67) })); },
  /* 答对：柔和的两声“叮咚”，正弦 + 三角，压在中音区（约 600～1000 Hz），不再有 2 kHz 以上的高音 */
  /* 答对：马林巴两音上行（大三度），第二个音长一点；连对越多整体越高（五声音阶，到 E5 封顶），每次细节略有不同 */
  /* combo：这一题之后的连对数（0 = 不是连对类玩法，就用最低一级）。每对一题往上一级、无尽上行；连对 12 起多一个五度音，20 起再多一点高处的闪光 */
  right(combo = 0) { this._((t, o) => { const c = jit(10), step = Math.max(combo - 1, 0), v = jv(1);
    for (const [m, w] of shepard(step)) { marimba(o, t, m, 0.2, 0.15 * w * v, c); marimba(o, t + 0.075, m + 4, 0.42, 0.17 * w * v, c); if (combo >= 12) marimba(o, t + 0.15, m + 7, 0.36, 0.1 * w * v, c); }
    if (combo >= 20) { voice(o, t + 0.15, mtof(91), 0.5, { vol: 0.018, a: 0.01 }); voice(o, t + 0.22, mtof(96), 0.45, { vol: 0.012, a: 0.01 }); } }); },
  /* 答错：木鱼两音下行（小三度），低沉、短，音量比答对小一点；以前是锯齿波 + 方波叠在一起的蜂鸣器（两个音差 12 Hz，嗡嗡的拍音很刺耳） */
  wrong() { this._((t, o) => { woodblock(o, t, 59, 0.16, jv(0.11)); woodblock(o, t + 0.11, 56, 0.24, jv(0.1)); voice(o, t, 110, 0.18, { vol: 0.05, a: 0.004, glide: 80 }); }); },
  /* 连击：五声音阶一级级往上走（连得越多音越高），到 A5（约 880 Hz）封顶；单音、柔和的钟声 */
  combo(n) { this._((t, o) => { for (const [m, w] of shepard(n - 1)) bell(o, t + 0.12, m + 7, 0.4, 0.12 * w); }); },   // 跟答对声同一个无尽上行（高五度），不再在第 9 次封顶
  /* 连线连对：拨弦感的单音，同样沿五声音阶上行 */
  /* 连线连对：拨弦感的单音，和答对声一样无尽上行（以前到第 7 次封顶）；连错清零重新爬 */
  link(n) { this._((t, o) => { const c = jit(8); for (const [m, w] of shepard(Math.max(n - 1, 0) + 2)) { const f = mtof(m) * Math.pow(2, c / 1200); voice(o, t, f, 0.28, { type: "triangle", vol: 0.17 * w, a: 0.004, lp: 2000 }); voice(o, t, f * 2, 0.12, { vol: 0.045 * w, a: 0.004 }); } }); },
  /* 连线连错：软软的闷响，不刺耳 */
  linkWrong() { this._((t, o) => { voice(o, t, 180, 0.22, { type: "triangle", vol: 0.16, glide: 95, lp: 700 }); noiseHit(o, t, 0.1, { off: 0.13, ft: "lowpass", f: 500, vol: 0.08 }); }); },
  /* 光球飞进进度条：很轻的“嗖” */
  swoosh() { this._((t, o) => noiseHit(o, t, 0.18, { off: 0.13, ft: "bandpass", f: 900, q: 1.2, vol: 0.05 })); },
  /* 连击升档：一个温暖的和弦从低到高铺开 + 底下一声低沉的“咚”（冲击感靠低频，不靠高频）；档位越高和弦越满 */
  tier(k) { this._((t, o) => {
    voice(o, t, 110, 0.35, { vol: 0.22, glide: 55, a: 0.003 });                                    // 低频冲击
    const root = 60 + [0, 2, 4, 5, 7, 7, 9][Math.min(k, 6)], ch = [0, 7, 12, 16, 19].slice(0, 3 + Math.min(k, 2));
    ch.forEach((s, i) => bell(o, t + 0.03 + i * 0.06, root + s, 0.7 + k * 0.05, 0.07));
  }); },
  /* 连击中断：柔和的下滑“咚——”（以前是碎玻璃声，太尖） */
  shatter() { this._((t, o) => { voice(o, t, 330, 0.38, { vol: 0.13, glide: 150, a: 0.01 }); voice(o, t, 247, 0.38, { type: "triangle", vol: 0.06, glide: 110, lp: 900 }); noiseHit(o, t, 0.2, { off: 0.13, ft: "lowpass", f: 600, vol: 0.06 }); }); },
  /* 解锁成就：钟声琶音（G4–C5–E5–G5），尾音柔和 */
  ach() { this._((t, o) => { [67, 72, 76, 79].forEach((m, i) => bell(o, t + i * 0.09, m, 0.8, 0.08)); voice(o, t, 98, 0.5, { vol: 0.12, glide: 65 }); }); },
  /* 一轮结束：按星级奏和弦，3 星多一个高八度的钟声 */
  roundClear(stars) { this._((t, o) => { [[60, 67], [60, 64, 67], [60, 64, 67, 72]][Math.max(0, stars - 1)].forEach((m, i) => bell(o, t + i * 0.07, m + 7, 0.9, 0.07)); if (stars >= 3) bell(o, t + 0.35, 79, 1, 0.06); }); },
  /* 新闪卡亮相：上滑的闪光 + 明亮和弦 */
  reveal() { this._((t, o) => { voice(o, t, 520, 0.5, { vol: 0.05, glide: 1050, a: 0.05 }); [67, 71, 74, 79].forEach((m, i) => bell(o, t + 0.25 + i * 0.05, m, 1.1, 0.07)); }); },
  tick() { this._((t, o) => voice(o, t, 1250, 0.035, { vol: 0.08 })); },
  beep() { this._((t, o) => voice(o, t, 980, 0.07, { vol: 0.05 })); },
  flatline() { this._((t, o) => voice(o, t, 980, 1.6, { vol: 0.08, sustain: 1, r: 0.3 })); },
  win() { this._((t, o) => [60, 64, 67, 72, 76, 79].forEach((m, i) => bell(o, t + i * 0.085, m, 0.6, 0.085))); },   // 结算：钟声琶音（以前是方波，偏尖）
  lose() { this._((t, o) => [67, 63, 60, 55].forEach((m, i) => voice(o, t + i * 0.16, mtof(m), 0.3, { type: "triangle", vol: 0.15 }))); },
  drawer() { this._((t, o) => { noiseHit(o, t, 0.12, { ft: "lowpass", f: 900, vol: 0.18 }); voice(o, t, 160, 0.08, { type: "triangle", vol: 0.15 }); }); }
};
