/* 药理闯关 · 节拍分拣的音乐：单独的音轨通道 + 调度器 + 专用曲子（和背景音乐完全分开）
 * - 自己的总线（音量跟“音乐”音量走），不进曲目表 / 歌单 / 随机播放，顶栏“下一首”也切不到；
 * - 每首曲子分 5 层：0 鼓 → 1 贝斯 → 2 和弦 → 3 旋律 → 4 高潮（琶音、闪光装饰音），连击越高打开的层越多；
 * - 所有音符都按音频时钟提前排好（向前看 0.25 秒），判定也以音频时钟为准，画面卡顿不影响节拍。
 * 第二版音色（像“真歌”而不是 8 bit）：
 * - 混音链：房间混响（自己生成的冲激响应）、立体声（每个和弦音由 5 个略微跑调的锯齿波左右分开叠成）、
 *   侧链“泵感”（每次底鼓响时，贝斯和和弦被压一下再弹回来）、总线压缩 + 限幅；
 * - 鼓：底鼓 = 音高下滑的正弦“咚” + 一下“咔”的冲击声；军鼓 / 拍手带房间混响；镲片、上升音效、低音冲击；
 * - 摇滚吉他：两个锯齿波经过失真（波形整形）做成强力和弦；
 * - 每首曲子有前奏 → 渐强 → 高潮 → 间奏 → 第二次高潮的结构。曲子全部原创。 */
import { reg } from "../core/registry.js";
import { cfg } from "../core/state.js";
import { AU, ensureAudio, mtof } from "./engine.js";
import { SAMPLES, SAMPLE_MIDI } from "./samples.js";

reg({ rhyFloor: () => rhyFloor, rhyPress: () => rhyPress, rhyLoad: () => rhyLoad, rhyReady: () => rhyReady, RHY: () => RHY, RHY_TRACKS: () => RHY_TRACKS, rhyStart: () => rhyStart, rhyStop: () => rhyStop, rhyLevel: () => rhyLevel, heardNow: () => heardNow, heardAt: () => heardAt, rhyClicks: () => rhyClicks, rhyHit: () => rhyHit, rhyRender: () => rhyRender });

/* ---------- 时钟：把“现在耳朵听到的是音频时钟的哪一刻”算准 ---------- */
const outLat = () => { const c = AU.ctx; return c ? (c.outputLatency || c.baseLatency || 0) : 0; };
export function heardAt(perfMs) {
  const c = AU.ctx; if (!c) return 0;
  try { const ts = c.getOutputTimestamp && c.getOutputTimestamp(); if (ts && ts.contextTime > 0 && ts.performanceTime > 0) return ts.contextTime + (perfMs - ts.performanceTime) / 1000; } catch (e) {}
  return c.currentTime - outLat() - (performance.now() - perfMs) / 1000;
}
export const heardNow = () => heardAt(performance.now());

/* ---------- 混音总线 ---------- */
export const RHY = { bus: null, layers: [], duck: null, timer: 0, t0: 0, beat: 0.5, d16: 0.125, step: 0, next: 0, total: 0, track: null, level: 0, onEnd: null, endT: 0 };
/* 房间混响的冲激响应：双声道、指数衰减的噪声，越往后越暗 */
function impulse(c, sec = 2.2) {
  const n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0;
    for (let i = 0; i < n; i++) { const t = i / n, k = 0.25 + 0.7 * t; lp += (Math.random() * 2 - 1 - lp) * (1 - k); d[i] = lp * Math.pow(1 - t, 3.2) * (i < c.sampleRate * 0.012 ? i / (c.sampleRate * 0.012) : 1); } }
  return b;
}
/* 五层各自的混响量：鼓少一点、和弦和高潮层多一点 */
const SEND = [0.1, 0.02, 0.32, 0.26, 0.42];
function makeBus(vol) {
  const c = AU.ctx;
  const clip = c.createWaveShaper(); clip.curve = curveOf(1.4); clip.connect(c.destination);   // 最后一道软削波：万一还有超过满幅的峰，削成圆滑的而不是刺耳的爆音
  const lim = c.createDynamicsCompressor(); lim.threshold.value = -6; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1; lim.connect(clip);
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2; comp.connect(lim);
  /* 高潮系统：sweep = 总低通（渐强时从闷到亮地“打开”），eng = 段落能量（主歌偏轻、高潮全开、高潮前半拍全部静音） */
  const eng = c.createGain(); eng.gain.value = 0.66; eng.connect(comp);
  const sweep = c.createBiquadFilter(); sweep.type = "lowpass"; sweep.frequency.value = 19000; sweep.Q.value = 0.9; sweep.connect(eng);
  const bus = c.createGain(); bus.gain.value = 0.0001; bus.connect(sweep);
  bus.gain.setTargetAtTime(Math.max(0.0001, vol == null ? cfg.music : vol) * 0.75, c.currentTime, 0.05);
  const rev = c.createConvolver(); rev.buffer = impulse(c); const revOut = c.createGain(); revOut.gain.value = 0.9; rev.connect(revOut); revOut.connect(bus);
  const duck = c.createGain(); duck.gain.value = 1; duck.connect(bus);
  const an = c.createAnalyser(); an.fftSize = 256; an.smoothingTimeConstant = 0.72; bus.connect(an);   // 给屏幕边缘的音浪用   // 侧链：贝斯、和弦、旋律、高潮经过这里，底鼓一响就被压一下
  const layers = [0, 1, 2, 3, 4].map(i => { const g = c.createGain(); g.gain.value = i === 0 ? 1 : 0; g.connect(i === 0 ? bus : duck); const s = c.createGain(); s.gain.value = SEND[i]; g.connect(s); s.connect(rev); return g; });
  return { bus, comp: clip, layers, duck, an, sweep, eng };
}
/* ---------- 高潮系统 ----------
 * 以前每一层都只看连击：连击一断，副歌听起来和前奏一样，整首歌没有起伏。现在每首歌标出“渐强”和“高潮”小节：
 * - 高潮里乐队至少 4 层全上（鼓、贝斯、和弦、旋律），连击只决定最上面那层闪光装饰；渐强段至少 3 层；
 * - 渐强：总低通从 600 Hz 一路打开到全频，音量慢慢推上去（配合曲子里的上升音效和军鼓滚奏）；
 * - 副歌一进来镲片 + 低音冲击一起砸下来（不留静音空拍，免得听起来像卡顿）；副歌整体比主歌响一截。 */
const inR = (rs, b) => !!rs && rs.some(([a, z]) => b >= a && b < z);
function floorAt(t) { let f = 1; for (const x of RHY.floors) if (x.t <= t + 1e-4) f = x.f; return f; }
export const rhyFloor = t => floorAt(t == null ? (AU.ctx ? AU.ctx.currentTime : 0) : t);
function applyLayers(at) {
  const eff = t => Math.min(4, Math.max(RHY.combo, floorAt(t)));
  RHY.layers.forEach((g, i) => { if (!i) return; g.gain.cancelScheduledValues(at);
    const lv = eff(at); g.gain.setTargetAtTime(i <= lv ? 1 : 0, at, i <= lv ? 0.04 : 0.12);
    RHY.floors.forEach(x => { if (x.t > at + 1e-4) { const l2 = eff(x.t); g.gain.setTargetAtTime(i <= l2 ? 1 : 0, x.t, i <= l2 ? 0.015 : 0.12); } }); });
  RHY.level = eff(at);
}
function barAuto(bar, t) {
  const tr = RHY.track, d = RHY.d16; if (!tr || !tr.hi || !RHY.sweep) return;
  const hi = inR(tr.hi, bar), rise = tr.rise.find(([a, z]) => bar >= a && bar < z), low = inR(tr.low, bar);
  const now = AU.ctx.currentTime; RHY.floors = RHY.floors.filter((x, k, A) => x.t > now || !A[k + 1] || A[k + 1].t > now);
  RHY.floors.push({ t, f: hi ? 3 : rise ? 2 : 1 }); applyLayers(t);
  const sw = RHY.sweep.frequency, en = RHY.eng.gain, end = t + 16 * d;
  if (rise) {
    const k0 = (bar - rise[0]) / (rise[1] - rise[0]), k1 = (bar + 1 - rise[0]) / (rise[1] - rise[0]), fq = k => 600 * Math.pow(30, k);
    sw.cancelScheduledValues(t); sw.setValueAtTime(fq(k0), t); sw.exponentialRampToValueAtTime(fq(k1), end);
    en.cancelScheduledValues(t); en.setValueAtTime(0.66 + 0.26 * k0, t); en.linearRampToValueAtTime(0.66 + 0.26 * k1, end);   // 不再在副歌前留半拍静音：玩家听起来像卡住了
  } else {
    sw.cancelScheduledValues(t); sw.setValueAtTime(19000, t);
    en.cancelScheduledValues(t);
    if (hi && inR(tr.rise, bar - 1)) en.linearRampToValueAtTime(1, t + d); else en.setTargetAtTime(hi ? 1 : low ? 0.58 : 0.66, t, 0.25);   // 主歌、间奏明显轻一截，副歌一进来才“炸”
  }
}
/* 侧链泵感：t 时刻压到 depth，再在半拍里弹回来 */
function pump(t, depth = 0.32) { const g = RHY.duck && RHY.duck.gain; if (!g) return; g.setTargetAtTime(depth, t, 0.004); g.setTargetAtTime(1, t + 0.03, RHY.beat * 0.16); }
export function rhyLevel(lv) {
  if (!RHY.bus || !AU.ctx) return; lv = Math.max(0, Math.min(4, lv)); if (lv === RHY.combo) return;
  RHY.combo = lv; applyLayers(Math.max(AU.ctx.currentTime, RHY.next - RHY.d16));
}
export function rhyStart(track, onEnd) {
  if (!ensureAudio()) return null;
  rhyStop(true);
  const c = AU.ctx, b = makeBus(); Object.assign(RHY, b);
  RHY.track = track; RHY.beat = 60 / track.bpm; RHY.d16 = RHY.beat / 4; RHY.level = 0; RHY.combo = 0; RHY.floors = []; RHY.onEnd = onEnd;
  RHY.t0 = c.currentTime + 0.35 + 4 * RHY.beat; RHY.step = 0; RHY.next = RHY.t0; RHY.total = track.bars * 16;
  for (let k = 0; k < 4; k++) click(RHY.bus, RHY.t0 - (4 - k) * RHY.beat, k === 0);
  RHY.endT = RHY.t0 + RHY.total * RHY.d16;
  RHY.timer = setInterval(sched, 25); sched();
  return { t0: RHY.t0, beat: RHY.beat };
}
function sched() {
  const c = AU.ctx; if (!c || !RHY.track) return;
  while (RHY.next < c.currentTime + 0.25 && RHY.step < RHY.total) { if (RHY.step % 16 === 0) barAuto(RHY.step / 16, RHY.next); RHY.track.play(RHY.step, RHY.next, RHY.d16, RHY.layers); RHY.step++; RHY.next += RHY.d16; }
  if (RHY.step >= RHY.total && c.currentTime > RHY.endT + 1.2) { const f = RHY.onEnd; RHY.onEnd = null; clearInterval(RHY.timer); RHY.timer = 0; if (f) f(); }
}
export function rhyStop(quiet) {
  if (RHY.timer) clearInterval(RHY.timer); RHY.timer = 0; RHY.onEnd = null; RHY.track = null;
  const c = AU.ctx, bus = RHY.bus, comp = RHY.comp; RHY.bus = null; RHY.layers = []; RHY.duck = null; RHY.an = null;
  if (c && bus) { try { bus.gain.cancelScheduledValues(c.currentTime); bus.gain.setTargetAtTime(0.0001, c.currentTime, quiet ? 0.01 : 0.1); setTimeout(() => { try { bus.disconnect(); comp.disconnect(); } catch (e) {} }, quiet ? 150 : 900); } catch (e) {} }
}
/* 离线渲染整首（所有层都开着），给试听 / 导出 WAV 用。返回 AudioBuffer */
export async function rhyRender(track, vol = 0.7) {
  const sec = track.bars * 16 * (60 / track.bpm / 4) + 3, oc = new OfflineAudioContext(2, Math.ceil(44100 * sec), 44100);
  const saved = { ctx: AU.ctx, R: { ...RHY } };
  ensureAudio();   // 噪声采样（AU.noise）要先有
  await rhyLoad();
  AU.ctx = oc;
  try {
    const b = makeBus(vol); Object.assign(RHY, b); RHY.track = track; RHY.beat = 60 / track.bpm; RHY.d16 = RHY.beat / 4; RHY.combo = 4; RHY.floors = [];
    b.layers.forEach(g => { g.gain.value = 1; });
  } finally { AU.ctx = saved.ctx; }
  /* 和现场播放一样“边放边排”：每到半秒暂停一下，把接下来 0.75 秒的音符排进去（一次全排进去会让渲染慢很多倍） */
  let s = 0, t = 0.2; const total = track.bars * 16;
  const fill = until => { AU.ctx = oc; try { while (s < total && t < until) { if (s % 16 === 0) barAuto(s / 16, t); track.play(s, t, RHY.d16, RHY.layers); s++; t += RHY.d16; } } finally { AU.ctx = saved.ctx; } };
  fill(0.95);
  for (let k = 0.5; k < sec - 0.5; k += 0.5) { const at = k; oc.suspend(at).then(() => { fill(at + 0.75); oc.resume(); }); }
  const out = await oc.startRendering(); Object.assign(RHY, saved.R); return out;
}

/* ---------- 基础发声单元 ---------- */
const C = () => AU.ctx;
/* 包络：0 → peak（a 秒）→ 衰减到 peak*sus（d 秒）→ 保持到 dur → 释放 r 秒 */
function envGain(g, t, peak, a, d, sus, dur, r) { const p = g.gain; p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(peak, t + a); p.setTargetAtTime(Math.max(0.0001, peak * sus), t + a, d / 3); p.setTargetAtTime(0.0001, t + Math.max(a, dur), r / 4); }
/* 失真：每个音自己一个波形整形节点（只缓存曲线）。以前共用一个节点，结果每个音都把之前所有的声音又叠了一遍 */
const CURVES = {};
function curveOf(k) { if (CURVES[k]) return CURVES[k]; const n = 1024, curve = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(k * x) / Math.tanh(k); } return (CURVES[k] = curve); }
function shaper(k) { const w = C().createWaveShaper(); w.curve = curveOf(k); return w; }
/* 噪声：滤波类型 / 频率（可以扫频）/ 包络 / 声像 */
function noise(dest, t, dur, o = {}) {
  const c = C(), s = c.createBufferSource(); s.buffer = AU.noise; s.loop = true;
  const f = c.createBiquadFilter(); f.type = o.type || "highpass"; f.frequency.setValueAtTime(o.f || 6000, t); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur); f.Q.value = o.q || 0.7;
  const g = c.createGain(); const vol = o.vol ?? 0.1;
  if (o.swell) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur); g.gain.setTargetAtTime(0.0001, t + dur, 0.01); }
  else { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.a || 0.001)); g.gain.setTargetAtTime(0.0001, t + (o.a || 0.001), (o.decay || dur) / 4); }
  let n = g; if (o.pan) { const p = c.createStereoPanner(); p.pan.value = o.pan; g.connect(p); n = p; }
  s.connect(f); f.connect(g); n.connect(dest); s.start(t, o.off ?? (t * 7.13) % 0.8); s.stop(t + dur + (o.decay || dur) + 0.05);
}
/* 一个振荡器音：音高包络（glide）、滤波包络、失真、声像都可选 */
function tone(dest, t, f, dur, o = {}) {
  const c = C(), osc = c.createOscillator(); osc.type = o.type || "sine"; osc.frequency.setValueAtTime(f, t);
  if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, t + (o.glideT || dur)); if (o.det) osc.detune.value = o.det;
  if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vib[0]; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(o.vib[1], t + Math.min(dur, 0.25)); l.connect(lg); lg.connect(osc.detune); l.start(t); l.stop(t + dur + 0.4); }
  let n = osc;
  if (o.drive) { const w = shaper(o.drive); n.connect(w); n = w; }
  if (o.lp) { const fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.Q.value = o.q || 0.8; fl.frequency.setValueAtTime(o.lp, t); if (o.lp2) fl.frequency.exponentialRampToValueAtTime(o.lp2, t + (o.lpT || dur)); n.connect(fl); n = fl; }
  const g = c.createGain(); envGain(g, t, o.vol ?? 0.1, o.a ?? 0.003, o.d ?? dur, o.sus ?? 0, dur, o.r ?? 0.06); n.connect(g); n = g;
  if (o.pan) { const p = c.createStereoPanner(); p.pan.value = o.pan; n.connect(p); n = p; }
  n.connect(dest); osc.start(t); osc.stop(t + dur + (o.r ?? 0.06) + 0.1);
}
/* 超级锯齿波：每个音 5 个略微跑调的锯齿波，分别送到左 / 中 / 右，再经过同一个滤波器和包络 */
function saws(dest, t, notes, dur, o = {}) {
  const c = C(), V = o.voices || 3, spread = o.spread ?? 18, wid = o.width ?? 0.8;
  const pans = [-wid, 0, wid].map(v => { const p = c.createStereoPanner(); p.pan.value = v; return p; });
  const fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.Q.value = o.q || 0.6; fl.frequency.setValueAtTime(o.cut || 3000, t); if (o.cut2) fl.frequency.exponentialRampToValueAtTime(o.cut2, t + (o.cutT || dur));
  const g = c.createGain(); envGain(g, t, o.vol ?? 0.05, o.a ?? 0.01, o.d ?? dur, o.sus ?? 1, dur, o.r ?? 0.15);
  pans.forEach(p => p.connect(fl)); fl.connect(g); g.connect(dest);
  let vibL = null; if (o.vib) { vibL = c.createGain(); const l = c.createOscillator(); l.frequency.value = o.vib[0]; vibL.gain.value = o.vib[1]; l.connect(vibL); l.start(t); l.stop(t + dur + (o.r ?? 0.15) + 0.2); }
  notes.forEach(m => { for (let v = 0; v < V; v++) { const osc = c.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = mtof(m); osc.detune.value = (v - (V - 1) / 2) / ((V - 1) / 2) * spread + (o.det || 0); if (vibL) vibL.connect(osc.detune);
    osc.connect(pans[v === (V - 1) / 2 ? 1 : v < (V - 1) / 2 ? 0 : 2]); osc.start(t); osc.stop(t + dur + (o.r ?? 0.15) + 0.2); } });
  if (o.sub) tone(dest, t, mtof(notes[0] - 12), dur, { vol: o.sub, a: o.a ?? 0.01, sus: 1, r: o.r ?? 0.15 });
}

/* ---------- 真实乐器采样（CC0，见 samples.js）：解码一次，之后所有音频环境（包括离线渲染）共用 ---------- */
const BUF = {}; let loading = null, ready = false;
export const rhyReady = () => ready;
export function rhyLoad() {
  if (loading) return loading;
  if (!ensureAudio()) return Promise.resolve(false);
  const c = AU.ctx;
  loading = Promise.all(Object.entries(SAMPLES).map(([k, b]) => { const bin = Uint8Array.from(atob(b), ch => ch.charCodeAt(0));
    return new Promise((ok, no) => c.decodeAudioData(bin.buffer, ok, no)).then(buf => { BUF[k] = buf; }); }))
    .then(() => (ready = true), e => { console.warn("节拍分拣的采样解码失败，改用合成音色", e); loading = null; return false; });
  return loading;
}
/* 播放一个采样：rate = 变速变调；dur = 截断（带 25 ms 淡出）；可选低通 / 高通 / 失真 / 声像 */
function smp(dest, t, name, o = {}) {
  const b = BUF[name]; if (!b) return false;
  const c = C(), s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = o.rate || 1;
  let n = s;
  if (o.hp) { const h = c.createBiquadFilter(); h.type = "highpass"; h.frequency.value = o.hp; n.connect(h); n = h; }
  if (o.drive) { const w = shaper(o.drive); n.connect(w); n = w; }
  if (o.lp) { const l = c.createBiquadFilter(); l.type = "lowpass"; l.frequency.value = o.lp; l.Q.value = o.q || 0.7; n.connect(l); n = l; }
  const g = c.createGain(), v = o.vol ?? 1; g.gain.setValueAtTime(v, t);
  if (o.dur) { g.gain.setValueAtTime(v, t + o.dur); g.gain.linearRampToValueAtTime(0.0001, t + o.dur + 0.025); }
  n.connect(g); n = g;
  if (o.pan) { const p = c.createStereoPanner(); p.pan.value = o.pan; n.connect(p); n = p; }
  n.connect(dest); s.start(t); s.stop(t + (o.dur ? o.dur + 0.05 : b.duration / (o.rate || 1) + 0.05));
  return true;
}
/* 带音高的采样：挑最近的一个，变速到目标音（rate = 2^(半音差/12)） */
function pitched(prefix, m) { let best = null, bd = 1e9; for (const [k, base] of Object.entries(SAMPLE_MIDI)) if (k.startsWith(prefix) && Math.abs(m - base) < bd) { bd = Math.abs(m - base); best = k; } return best ? [best, Math.pow(2, (m - SAMPLE_MIDI[best]) / 12)] : null; }
let rr = 0; const alt = (a, b) => (rr++ % 2 ? a : b);   // 轮流用两个采样，避免“机关枪”一样的重复感


/* ---------- 鼓和效果音 ---------- */
/* 电子底鼓（合成，冲击力强）+ 一点真鼓的质感；rock = 纯真鼓 */
function kick(d, t, v = 0.9, punch = 1) { tone(d, t, 160 * punch, 0.42, { vol: v, glide: 46, glideT: 0.09, a: 0.0015, d: 0.4, sus: 0 }); tone(d, t, 52, 0.38, { vol: v * 0.45, a: 0.005, d: 0.35 }); noise(d, t, 0.008, { type: "bandpass", f: 4200, q: 1, vol: v * 0.28 }); smp(d, t, "kickS", { vol: v * 0.35 }); pump(t); }
function kickR(d, t, v = 1) { if (!smp(d, t, alt("kick1", "kick2"), { vol: v * 1.1 })) kick(d, t, v * 0.9); else pump(t, 0.5); }
function snare(d, t, v = 0.32) { if (smp(d, t, "snareS", { vol: v * 1.6 })) { noise(d, t, 0.12, { type: "highpass", f: 6000, vol: v * 0.3, decay: 0.1 }); return; } noise(d, t, 0.22, { type: "bandpass", f: 2100, q: 0.7, vol: v, decay: 0.2 }); noise(d, t, 0.12, { type: "highpass", f: 6000, vol: v * 0.5, decay: 0.1 }); tone(d, t, 210, 0.12, { type: "triangle", vol: v * 0.6, glide: 165, d: 0.1 }); }
/* 摇滚反拍：边击（rim shot）军鼓，整首最响、最有存在感的一下 */
function snareR(d, t, v = 1) { if (!smp(d, t, alt("snare1", "snare2"), { vol: v * 1.25 })) snare(d, t, v * 0.38); }
function clap(d, t, v = 0.3) { [0, 0.011, 0.023].forEach((o, i) => noise(d, t + o, 0.02, { type: "bandpass", f: 1300 + i * 200, q: 1.4, vol: v * (i === 2 ? 1 : 0.7), decay: 0.02, pan: (i - 1) * 0.15 })); noise(d, t + 0.025, 0.18, { type: "bandpass", f: 1400, q: 1, vol: v * 0.5, decay: 0.16 }); }
function hat(d, t, v = 0.08, open, pan = 0.25) { if (smp(d, t, open ? "hatO" : v < 0.045 ? "hatS" : alt("hat1", "hat2"), { vol: Math.min(1, v * (open ? 6 : 8)), pan, dur: open ? 0.5 : undefined })) return; noise(d, t, open ? 0.26 : 0.035, { type: "highpass", f: 8500, vol: v, decay: open ? 0.24 : 0.03, pan }); }
function crash(d, t, v = 0.22) { if (smp(d, t, "crash", { vol: v * 3.6, pan: -0.25 })) return; noise(d, t, 1.8, { type: "highpass", f: 5200, vol: v, decay: 1.7, pan: -0.2 }); noise(d, t, 1.4, { type: "bandpass", f: 9000, q: 0.8, vol: v * 0.6, decay: 1.3, pan: 0.25 }); }
function ride(d, t, v = 0.06) { if (smp(d, t, "ride", { vol: v * 7, pan: 0.35, dur: 0.9 })) return; noise(d, t, 0.45, { type: "bandpass", f: 7000, q: 2, vol: v, decay: 0.4, pan: 0.35 }); tone(d, t, 3300, 0.3, { vol: v * 0.25, d: 0.25 }); }
function tom(d, t, f, v = 0.4) { if (smp(d, t, f >= 160 ? "tomH" : f >= 115 ? "tomM" : "tomL", { vol: v * 2.2, pan: f >= 160 ? -0.3 : f >= 115 ? 0 : 0.3 })) return; tone(d, t, f * 1.6, 0.35, { vol: v, glide: f, glideT: 0.12, d: 0.3 }); noise(d, t, 0.05, { type: "bandpass", f: 900, vol: v * 0.2 }); }
function riser(d, t, dur, v = 0.12) { noise(d, t, dur, { type: "bandpass", f: 300, f2: 9000, q: 1.2, vol: v, swell: true }); tone(d, t, 110, dur, { type: "sawtooth", vol: v * 0.25, glide: 880, a: dur * 0.9, sus: 1, lp: 600, lp2: 5000, r: 0.02 }); }
function impact(d, t, v = 0.5) { tone(d, t, 70, 1.4, { vol: v, glide: 36, glideT: 1, d: 1.2 }); noise(d, t, 1, { type: "lowpass", f: 900, vol: v * 0.35, decay: 0.9 }); }
function revCym(d, t, dur, v = 0.12) { noise(d, t, dur, { type: "highpass", f: 4000, vol: v, swell: true }); }
/* 808 低音：带一点失真的正弦，音高可以滑 */
function b808(d, t, m, dur, v = 0.3, slideTo) { tone(d, t, mtof(m), dur, { vol: v, a: 0.004, d: dur, sus: 0.8, r: 0.12, drive: 2.2, glide: slideTo ? mtof(slideTo) : undefined, glideT: 0.12 }); }
/* 合成贝斯：锯齿 + 正弦打底，低通 */
function bass(d, t, m, dur, v = 0.2, cut = 900) { tone(d, t, mtof(m), dur, { type: "sawtooth", vol: v, a: 0.004, d: dur * 0.8, sus: 0.6, r: 0.06, lp: cut, lp2: cut * 0.5, lpT: dur }); tone(d, t, mtof(m - 12), dur, { vol: v * 0.9, a: 0.004, sus: 0.9, d: dur, r: 0.06 }); }
/* 失真吉他强力和弦：根音 + 五度 + 八度，每个音两个略微跑调的锯齿 → 失真 → 低通；mute = 闷音（短、暗） */
/* 失真吉他强力和弦：真吉他采样（根音 + 五度 + 八度）→ 高增益失真 → 箱体模拟（低切 + 高切）；左右各录一遍（双轨），略微错开音高和时间，这是摇滚吉他“厚”的来源 */
function gtr(d, t, root, dur, v = 0.07, mute, pan = 0) {
  if (BUF.gtrE) { [[-0.62, 1, 0], [0.62, 1.003, 0.011]].forEach(([p, det, dly]) => [0, 7, 12].forEach((iv, k) => { const ps = pitched("gtr", root + iv); if (!ps) return;
    smp(d, t + dly, ps[0], { rate: ps[1] * det, vol: v * (k === 0 ? 4.2 : 3.2), drive: mute ? 14 : 18, hp: 110, lp: mute ? 1500 : 4200, q: mute ? 0.9 : 1.1, dur: mute ? Math.min(dur, 0.14) : dur, pan: p + pan }); }));
    return; }
  [0, 7].forEach((iv, k) => [-9, 9].forEach(dt => tone(d, t, mtof(root + iv), dur, { type: "sawtooth", det: dt, vol: v * (k === 0 ? 1 : 0.8), a: 0.003, d: mute ? dur * 0.6 : dur, sus: mute ? 0.2 : 0.85, r: mute ? 0.03 : 0.2, drive: 9, lp: mute ? 1400 : 3600, pan: pan + (dt > 0 ? 0.35 : -0.35) }))); }
/* 真贝斯：采样变调 + 一点推子失真，让它在失真吉他里也听得清 */
function bassR(d, t, m, dur, v = 0.5) { const ps = pitched("bass", m); if (!ps || !smp(d, t, ps[0], { rate: ps[1], vol: v * 1.4, drive: 1.6, lp: 2400, dur })) bass(d, t, m + 12, dur, v * 0.35, 800); }
/* 吉他主音：失真 + 揉弦 */
function gtrLead(d, t, m, dur, v = 0.07) { tone(d, t, mtof(m), dur, { type: "sawtooth", vol: v, a: 0.01, d: dur, sus: 0.85, r: 0.15, drive: 7, lp: 3000, vib: [5.5, 22] }); tone(d, t, mtof(m), dur, { type: "square", det: 6, vol: v * 0.4, a: 0.01, sus: 0.85, d: dur, r: 0.15, drive: 4, lp: 2400, pan: 0.2 }); }
/* 亮晶晶的拨弦 / 钟声（高潮层） */
function bell(d, t, m, v = 0.05, pan = 0) { tone(d, t, mtof(m), 0.6, { vol: v, a: 0.002, d: 0.5, pan }); tone(d, t, mtof(m) * 2.01, 0.25, { vol: v * 0.3, a: 0.002, d: 0.2, pan: -pan }); }
function pluck(d, t, m, dur, v = 0.06, pan = 0) { tone(d, t, mtof(m), dur, { type: "sawtooth", vol: v * 1.6, a: 0.002, d: dur * 0.7, sus: 0.1, r: 0.1, lp: 4200, lp2: 900, lpT: dur, pan }); }
/* 预备拍 / 校准用的“嗒” */
function click(d, t, accent) { tone(d, t, accent ? 1500 : 1100, 0.06, { vol: accent ? 0.35 : 0.25, a: 0.001, d: 0.05, glide: accent ? 1000 : 800 }); noise(d, t, 0.012, { type: "bandpass", f: 3000, q: 1.5, vol: 0.1 }); }
export function rhyClicks(n, bpm) {
  if (!ensureAudio()) return null;
  rhyStop(true);
  const c = AU.ctx, b = makeBus(); Object.assign(RHY, b);
  const beat = 60 / bpm, t0 = c.currentTime + 0.5 + 2 * beat;
  for (let k = -2; k < n; k++) click(RHY.bus, t0 + k * beat, k % 4 === 0);
  return { t0, beat };
}
/* ---------- 按键音 ----------
 * 依据：声音比画面更适合当节拍参照（听觉在计时上有优势），按下没有任何声音会让人觉得“没按到”；
 * 但按键音如果花哨、带音高、或者因为设备延迟比手指晚到，反而会干扰节奏——很多音游玩家会把它关掉，主流音游都把它单独做音量、可以完全关闭。
 * 所以这里只用一个：短（约 30 ms）、中性（不带音高，不会和曲子的和弦打架）、每次都一模一样的轻“嗒”（真踩镲的轻击），音量偏小；
 * 判定结果不再额外配声音（结果交给画面），可以在入口页选“开 / 轻 / 关”。 */
const sfxOn = () => AU.ctx && AU.sfx && cfg.sfx > 0;
const KEYVOL = [0, 0.32, 0.6];   // 关 / 轻 / 开
export function rhyPress() {
  const lv = cfg.rhKey == null ? 1 : cfg.rhKey; if (!sfxOn() || !lv) return;
  const t = AU.ctx.currentTime, v = KEYVOL[lv];
  if (!smp(AU.sfx, t, "hatS", { vol: v, hp: 2500, dur: 0.05 })) noise(AU.sfx, t, 0.03, { type: "bandpass", f: 3200, q: 1.2, vol: v * 0.2 });
}
/* 判定后不再加声音（保留接口，免得别处调用出错） */
export function rhyHit() {}

/* 旋律表 [开始位置（16 分音符，4 小节内 0–63）, 长度, 音] → 某一步要发的音 */
const melAt = (mel, pos) => mel.filter(x => x[0] === pos);

/* ==================== 曲子 1：简单 · 100 BPM · Future Bass「复苏」 ====================
 * F 大调，B♭maj7 – C – Am7 – Dm7；半拍感的鼓（军鼓 / 拍手在第 3 拍），808 低音，带揉音的超级锯齿和弦按切分节奏“剁”开 */
const C1 = [[46, [58, 62, 65, 69]], [48, [60, 64, 67, 72]], [45, [57, 60, 64, 67]], [50, [62, 65, 69, 72]]];
const M1 = [[0, 2, 77], [2, 2, 76], [4, 4, 72], [8, 2, 74], [10, 2, 72], [12, 4, 69], [16, 2, 72], [18, 2, 74], [20, 4, 76], [24, 4, 79], [28, 4, 76],
  [32, 2, 76], [34, 2, 77], [36, 4, 76], [40, 2, 74], [42, 2, 72], [44, 4, 69], [48, 4, 74], [52, 2, 72], [54, 2, 74], [56, 8, 77]];
const CHOP1 = "x..x..x...x..x..";
/* 副歌和声：在旋律音下面找一个和弦音（至少低小三度），叠成两部和声，副歌听起来更“满” */
const harm = (m, ch) => { let best = m - 5; for (const c of ch) for (let o = -24; o <= 24; o += 12) { const x = c + o; if (x <= m - 3 && x > best) best = x; } return best; };
/* 副歌主唱：超级锯齿（像合唱一样宽）+ 高八度正弦 + 下方和声 */
function hook(L, t, m, dur, ch, v = 0.05, oct = false) {
  saws(L, t, [m], dur * 0.94, { voices: 5, spread: 18, width: 0.7, vol: v, a: 0.008, sus: 0.9, cut: 5200, r: 0.16 });
  saws(L, t, [harm(m, ch)], dur * 0.94, { voices: 3, spread: 14, width: 0.5, vol: v * 0.55, a: 0.01, sus: 0.85, cut: 3600, r: 0.16 });
  tone(L, t, mtof(m + 12), dur * 0.9, { vol: v * (oct ? 0.75 : 0.45), a: 0.008, sus: 0.85, d: dur, r: 0.12 });
}

/* 副歌（高潮）和主歌分开写：副歌换一套更“往上走”的和弦进行（vi–IV–I–V 这类流行副歌最常用的进行），
 * 配一段音更高、音更长、反复出现的主旋律（hook），乐队全开：长音铺底和弦 + 剁开的和弦 + 两部和声 + 每 4 小节一次镲片。
 * 主歌（渐强段）用原来那段旋律，音量和音域都低一些，这样副歌一进来有明显的“炸开”的感觉。 */
/* 曲子 1 的副歌：Dm – B♭ – F – C；hook 在 A5–C6 一带唱，长音落在强拍 */
const P1 = [[50, [62, 65, 69, 74]], [46, [58, 62, 65, 70]], [41, [60, 65, 69, 72]], [48, [60, 64, 67, 72]]];
const H1 = [[0, 6, 81], [6, 2, 79], [8, 4, 77], [12, 4, 76], [16, 6, 77], [22, 2, 76], [24, 4, 74], [28, 4, 77],
  [32, 4, 81], [36, 4, 84], [40, 8, 81], [48, 4, 79], [52, 4, 77], [56, 8, 76]];
const T1 = {
  id: "revive", name: ["复苏", "Revive"], style: ["Future Bass · 100 BPM", "Future bass · 100 BPM"], bpm: 100, bars: 40, lanes: 2, level: ["简单", "Easy"],
  hi: [[16, 32], [36, 40]], rise: [[12, 16], [34, 36]], low: [[32, 34]],   // 副歌 / 渐强 / 间奏小节
  chord(bar) { return (inR(this.hi, bar) ? P1 : C1)[bar % 4][1]; },
  play(s, t, d, L) {
    const bar = Math.floor(s / 16), i = s % 16, hi = inR(this.hi, bar), [root, ch] = (hi ? P1 : C1)[bar % 4];
    const intro = bar < 8, verse = bar >= 8 && bar < 16, brk = bar >= 32 && bar < 36, pre = bar === 15 || bar === 35, lift = (bar >= 24 && bar < 32) || bar >= 36;
    /* 0 鼓 */
    if (intro) { if (i === 0 || i === 8) kick(L[0], t, 0.6); if (i % 4 === 2) hat(L[0], t, 0.04); }
    if (verse) { if (i === 0 || i === 6 || i === 8) kick(L[0], t, 0.75); if (i === 8) clap(L[0], t, 0.25); hat(L[0], t, i % 2 ? 0.03 : 0.05); if (bar >= 14) { if (i % (bar === 15 ? 1 : 2) === 0) snare(L[0], t, 0.08 + (i / 16) * 0.18); } }
    if (hi) { if (i === 0 || i === 7 || (i === 10 && bar % 2)) kick(L[0], t, 1); if (i === 8) { snare(L[0], t, 0.34); clap(L[0], t, 0.32); }
      if (i % 4 === 2) hat(L[0], t, 0.09, true); else hat(L[0], t, i % 2 ? 0.035 : 0.06);
      if (bar % 4 === 3 && i >= 12) snare(L[0], t, 0.12 + (i - 12) * 0.05);
      if (bar % 4 === 0 && i === 0) crash(L[0], t, 0.24); }
    if (brk) { if (i === 0) kick(L[0], t, 0.5); if (i % 4 === 2) hat(L[0], t, 0.03); }
    if (bar === 34 || bar === 35) { if (i % (bar === 35 ? 1 : 2) === 0) snare(L[0], t, 0.08 + ((bar - 34) * 16 + i) / 32 * 0.22); if (bar === 34 && i === 0) riser(L[0], t, d * 32, 0.1); }
    if ((bar === 16 || bar === 36) && i === 0) impact(L[0], t, 0.5);
    if (pre && i === 0) riser(L[0], t, d * 16, 0.12);
    if (pre && i === 8) revCym(L[0], t, d * 8, 0.1);
    /* 1 808 */
    if (verse && i === 0) b808(L[1], t, root - 12, d * 7, 0.3);
    if (hi && (i === 0 || i === 10)) b808(L[1], t, root - 12, d * (i ? 5 : 9), 0.32, i && bar % 4 === 3 ? root - 10 : undefined);
    if (brk && i === 0) b808(L[1], t, root - 12, d * 15, 0.25);
    /* 2 和弦 */
    if (intro && i === 0) saws(L[2], t, ch, d * 16, { vol: 0.035, a: 0.4, cut: 900 + bar * 120, r: 0.4 });
    if (verse && i % 4 === 0) saws(L[2], t, ch, d * 3.6, { vol: 0.04, a: 0.01, cut: 1200 + (bar - 8) * 300, r: 0.08 });
    if (hi && CHOP1[i] === "x") saws(L[2], t, ch, d * 2.2, { vol: 0.045, a: 0.004, d: d * 2, sus: 0.7, cut: 5200, r: 0.1, vib: [5, 14] });
    if (hi && i === 0) saws(L[2], t, ch.map(m => m - 12), d * 16, { vol: 0.03, a: 0.06, cut: 2600, r: 0.5, spread: 30 });   // 铺底长音
    if (brk && i === 0) saws(L[2], t, ch, d * 16, { vol: 0.04, a: 0.5, cut: 2000, r: 0.6, vib: [4.5, 10] });
    /* 3 旋律：主歌 = 原来的拨弦旋律（低八度）；副歌 = 新写的 hook（后半段加高八度点缀） */
    const pos = (bar % 4) * 16 + i;
    if (verse || brk) melAt(M1, pos).forEach(([, len, m]) => pluck(L[3], t, m - (brk ? 0 : 12), d * len, 0.05));
    if (hi) melAt(H1, pos).forEach(([, len, m]) => { hook(L[3], t, m, d * len, ch, 0.05, lift); if (lift) bell(L[3], t, m + 12, 0.025, 0.3); });
    /* 4 闪光：琶音 */
    if (hi) { if (i % 2 === 0) bell(L[4], t, ch[(i / 2) % ch.length] + 12, 0.026, i % 4 ? 0.5 : -0.5); if (i === 0) bell(L[4], t, ch[0] + 24, 0.04); }
  }
};

/* ==================== 曲子 2：普通 · 126 BPM · Progressive House「强心剂」 ====================
 * 主歌 F – C – G – Am；副歌 Am – F – C – G，赞歌式的 hook，第二次副歌再升高八度 */
const C2 = [[41, [57, 60, 65, 69]], [36, [55, 60, 64, 67]], [43, [55, 59, 62, 67]], [45, [57, 60, 64, 69]]];
const M2 = [[0, 3, 72], [3, 1, 72], [4, 2, 74], [6, 2, 76], [8, 4, 77], [12, 4, 76], [16, 3, 74], [19, 1, 72], [20, 4, 72], [24, 2, 71], [26, 2, 72], [28, 4, 74],
  [32, 3, 74], [35, 1, 74], [36, 2, 76], [38, 2, 79], [40, 4, 79], [44, 4, 77], [48, 3, 76], [51, 1, 74], [52, 4, 72], [56, 8, 69]];
const P2 = [[45, [57, 60, 64, 69]], [41, [57, 60, 65, 69]], [36, [55, 60, 64, 67]], [43, [55, 59, 62, 67]]];
const H2 = [[0, 4, 76], [4, 4, 76], [8, 2, 74], [10, 2, 72], [12, 4, 76], [16, 8, 77], [24, 4, 76], [28, 4, 72],
  [32, 4, 79], [36, 4, 79], [40, 2, 77], [42, 2, 76], [44, 4, 79], [48, 6, 79], [54, 2, 77], [56, 8, 74]];
const T2 = {
  id: "adrenaline", name: ["强心剂", "Adrenaline"], style: ["Progressive House · 126 BPM", "Progressive house · 126 BPM"], bpm: 126, bars: 48, lanes: 2, level: ["普通", "Normal"],
  hi: [[16, 32], [40, 48]], rise: [[12, 16], [36, 40]], low: [[32, 36]],
  chord(bar) { return (inR(this.hi, bar) ? P2 : C2)[bar % 4][1]; },
  play(s, t, d, L) {
    const bar = Math.floor(s / 16), i = s % 16, hi = inR(this.hi, bar), [root, ch] = (hi ? P2 : C2)[bar % 4];
    const intro = bar < 8, verse = bar >= 8 && bar < 16, brk = bar >= 32 && bar < 36, build2 = bar >= 36 && bar < 40, ch2 = bar >= 40;
    /* 0 鼓 */
    if (i % 4 === 0 && !(brk && i)) kick(L[0], t, brk ? 0.55 : intro ? 0.75 : hi ? 1 : 0.9);
    if ((hi || verse || build2) && (i === 4 || i === 12)) clap(L[0], t, hi ? 0.34 : 0.28);
    if (!brk) { if (i % 4 === 2) hat(L[0], t, hi ? 0.11 : 0.06, hi); else if (hi && i % 2) hat(L[0], t, 0.03, false, -0.3); }
    if (hi && i % 4 === 0) ride(L[0], t, 0.045);
    if ((bar === 14 || bar === 15 || bar === 38 || bar === 39)) { const step = (bar === 15 || bar === 39) ? 1 : 2; if (i % step === 0) snare(L[0], t, 0.06 + ((bar % 2) * 16 + i) / 32 * 0.22); }
    if (hi && bar % 4 === 0 && i === 0) crash(L[0], t, 0.24);
    if ((bar === 16 || bar === 40) && i === 0) impact(L[0], t, 0.45);
    if ((bar === 12 || bar === 36) && i === 0) riser(L[0], t, d * 64, 0.1);
    if ((bar === 15 || bar === 39) && i === 8) revCym(L[0], t, d * 8, 0.12);
    /* 1 贝斯 */
    if ((verse || build2) && i % 2 === 0) bass(L[1], t, root + (i % 4 === 2 ? 12 : 0) + 12, d * 1.7, i % 4 === 2 ? 0.18 : 0.12, 700);
    if (hi && i % 2 === 0) bass(L[1], t, root + (i % 4 === 2 ? 12 : 0) + 12, d * 1.7, i % 4 === 2 ? 0.22 : 0.16, 1300);
    if (brk && i === 0) bass(L[1], t, root + 12, d * 15, 0.12, 500);
    /* 2 和弦 */
    if (intro && i % 2 === 0) pluck(L[2], t, ch[(i / 2) % 4] + 12, d * 1.5, 0.05);
    if ((verse || build2) && i % 4 === 2) saws(L[2], t, ch, d * 1.8, { vol: 0.038, a: 0.004, d: d * 1.5, sus: 0.5, cut: 1500 + (bar % 8) * 400, r: 0.08 });
    if (hi && i % 4 === 2) saws(L[2], t, ch, d * 1.9, { vol: 0.055, a: 0.003, d: d * 1.6, sus: 0.6, cut: 6000, r: 0.08 });
    if ((hi || brk) && i === 0) saws(L[2], t, hi ? ch.map(m => m - 12) : ch, d * 16, { vol: brk ? 0.05 : 0.032, a: brk ? 0.6 : 0.05, cut: brk ? 1800 : 2800, r: 0.4, spread: 30 });
    /* 3 旋律：主歌 / 间奏 = 原旋律（低八度、轻）；副歌 = hook（第二次副歌高八度） */
    const pos = (bar % 4) * 16 + i;
    if (verse || brk) melAt(M2, pos).forEach(([, len, m]) => saws(L[3], t, [m - 12], d * len * 0.92, { voices: 3, spread: 12, width: 0.5, vol: 0.032, a: 0.006, sus: 0.8, cut: 2600, r: 0.12 }));
    if (hi) melAt(H2, pos).forEach(([, len, m]) => hook(L[3], t, m + (ch2 ? 12 : 0), d * len, ch.map(x => x + (ch2 ? 12 : 0)), ch2 ? 0.045 : 0.05, ch2));
    /* 4 闪光：十六分音符琶音 */
    if (hi) pluck(L[4], t, ch[i % 4] + 24, d * 0.9, 0.03, i % 2 ? 0.5 : -0.5);
  }
};

/* ==================== 曲子 3：困难 · 140 BPM · 电子摇滚「电除颤」 ====================
 * 主歌 Em – C – G – D（闷音吉他）；副歌 C – G – D – Em（摇滚副歌的经典进行），长音强力和弦 + 吉他主音 hook + 合成和声 */
const C3 = [[40, [52, 59, 64]], [36, [48, 55, 60]], [43, [55, 62, 67]], [38, [50, 57, 62]]];
const M3 = [[0, 4, 76], [4, 2, 79], [6, 2, 78], [8, 6, 76], [14, 2, 74], [16, 4, 72], [20, 2, 76], [22, 2, 79], [24, 8, 84],
  [32, 4, 83], [36, 2, 81], [38, 2, 79], [40, 6, 78], [46, 2, 79], [48, 4, 78], [52, 2, 76], [54, 2, 74], [56, 8, 74]];
const P3 = [[36, [48, 55, 60]], [43, [55, 62, 67]], [38, [50, 57, 62]], [40, [52, 59, 64]]];
const H3 = [[0, 6, 79], [6, 2, 76], [8, 8, 76], [16, 4, 74], [20, 4, 79], [24, 8, 83], [32, 6, 81], [38, 2, 79], [40, 4, 78], [44, 4, 74], [48, 12, 76], [60, 4, 79]];
const T3 = {
  id: "defib", name: ["电除颤", "Defibrillator"], style: ["电子摇滚 · 140 BPM", "Electro-rock · 140 BPM"], bpm: 140, bars: 52, lanes: 3, level: ["困难", "Hard"],
  hi: [[16, 32], [40, 52]], rise: [[12, 16], [36, 40]], low: [[32, 36]],
  chord(bar) { return (inR(this.hi, bar) ? P3 : C3)[bar % 4][1]; },
  play(s, t, d, L) {
    const bar = Math.floor(s / 16), i = s % 16, hi = inR(this.hi, bar), [root, ch] = (hi ? P3 : C3)[bar % 4];
    const intro = bar < 4, verse = bar >= 4 && bar < 12, pre = bar >= 12 && bar < 16, brk = bar >= 32 && bar < 36, build = bar >= 36 && bar < 40, ch2 = bar >= 40;
    /* 0 鼓 */
    if (!intro) {
      if (brk) { if (i === 0) kickR(L[0], t, 0.9); if (i === 8) snareR(L[0], t, 1); }
      else { if (i === 0 || i === 8 || i === 6 || (i === 10 && hi)) kickR(L[0], t, i === 0 || i === 8 ? 1 : 0.8); if (i === 4 || i === 12) snareR(L[0], t, 1); }
      if (hi) { if (i % 2 === 0) ride(L[0], t, 0.055); if (i % 4 === 2) hat(L[0], t, 0.07, true, -0.3); } else if (!brk) hat(L[0], t, i % 2 ? 0.035 : 0.07, false, -0.3);
    } else if (i % 2 === 0) hat(L[0], t, 0.05, false, -0.3);
    if (pre && bar === 12 && i === 0) riser(L[0], t, d * 64, 0.08);
    if (pre && bar === 14 && i % 2 === 0) snareR(L[0], t, 0.25 + i / 16 * 0.3);
    if (pre && bar === 15 && i < 8) snareR(L[0], t, 0.55 + i / 8 * 0.35);
    if (pre && bar === 15) { if (i >= 8) tom(L[0], t, [180, 180, 150, 150, 120, 120, 95, 95][i - 8], 0.4); }
    if (build) { const step = bar === 39 ? 1 : 2; if (i % step === 0) snareR(L[0], t, 0.25 + ((bar - 36) * 16 + i) / 64 * 0.7); if (i === 0) kickR(L[0], t, 0.9); if (bar === 36 && i === 0) riser(L[0], t, d * 64, 0.08); }
    if (hi && bar % 4 === 0 && i === 0) crash(L[0], t, 0.28);
    if ((bar === 16 || bar === 40) && i === 0) impact(L[0], t, 0.4);
    /* 1 贝斯 */
    if (!intro && i % 2 === 0) bassR(L[1], t, root, d * 1.8, brk ? 0.32 : hi ? 0.55 : 0.45);
    /* 2 吉他：主歌闷音八分；副歌长音强力和弦 + 合成铺底 */
    const gr = hi ? [48, 43, 50, 40][bar % 4] : [40, 48, 43, 50][bar % 4];
    if ((intro || verse) && i % 2 === 0) gtr(L[2], t, gr, d * 1.6, 0.055, true);
    if (pre && i % 8 === 0) gtr(L[2], t, gr, d * 7.5, 0.06, false);
    if (hi && (i === 0 || i === 6 || i === 12)) gtr(L[2], t, gr, d * (i === 12 ? 3.6 : 5.6), 0.07, false);
    if (hi && i === 0) saws(L[2], t, ch.map(m => m + 12), d * 16, { vol: 0.026, a: 0.2, cut: 2600, r: 0.3, spread: 28 });
    if (brk && (i === 0 || i === 3 || i === 6 || i === 10)) gtr(L[2], t, gr, d * 2, 0.06, true);
    /* 3 旋律：主歌后半 = 原旋律（低八度吉他）；副歌 = hook（吉他主音 + 合成和声，第二次副歌高八度） */
    const pos = (bar % 4) * 16 + i;
    if (verse && bar >= 8) melAt(M3, pos).forEach(([, len, m]) => gtrLead(L[3], t, m - 24, d * len * 0.95, 0.045));
    if (hi) melAt(H3, pos).forEach(([, len, m]) => { const mm = m - 12 + (ch2 ? 12 : 0); gtrLead(L[3], t, mm, d * len * 0.95, 0.07); saws(L[3], t, [harm(mm, ch)], d * len * 0.92, { voices: 3, spread: 14, width: 0.5, vol: 0.025, a: 0.01, sus: 0.85, cut: 3000, r: 0.14 }); });
    /* 4 闪光：合成琶音 */
    if (hi) pluck(L[4], t, ch[i % 3] + 24 + (i % 6 >= 3 ? 12 : 0), d * 0.9, ch2 ? 0.035 : 0.025, i % 2 ? 0.55 : -0.55);
  }
};

export const RHY_TRACKS = [T1, T2, T3];
