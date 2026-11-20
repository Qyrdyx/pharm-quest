/* 药理闯关 · 音频引擎：AudioContext、基础音色合成、鼓 */
import { PG, reg } from "../core/registry.js";
import { cfg } from "../core/state.js";

reg({ AU: () => AU, pressAt: () => pressAt, wakeAudio: () => wakeAudio, rebuildAudio: () => rebuildAudio, ensureAudio: () => ensureAudio, mtof: () => mtof, voice: () => voice, noiseHit: () => noiseHit, kick: () => kick, snare: () => snare, hat: () => hat, pad: () => pad, bell: () => bell }, { pressAt: v => { pressAt = v; } });

/* ================= 音频：音乐 + 音效（Web Audio 实时合成） ================= */
export const AU = { ctx: null, playing: false, step: 0, next: 0, timer: null };
export let pressAt = 0;   // 最近一次“按下按钮就播放按键音”的时间
/* 唤醒音频引擎。resume 失败（iOS 从后台回来常见）就记下来，等下一次点屏幕时重建 */
export function wakeAudio(gesture) {
  const c = AU.ctx; if (!c) return;
  if (c.state === "closed" || (gesture && AU.broken)) return rebuildAudio();
  if (c.state === "running") return;
  let p; try { p = c.resume(); } catch (e) { AU.broken = true; return; }
  if (p && p.then) p.then(() => {
    if (c !== AU.ctx) return;
    if (c.state !== "running") { AU.broken = true; return; }
    AU.broken = false;
    if (AU.playing && AU.next < c.currentTime) AU.next = c.currentTime + 0.05;   // 时间在后台走了的话，从现在接着排
  }, () => { if (c === AU.ctx) AU.broken = true; });
}
/* 丢掉坏掉的引擎，新建一个；原来在放音乐就接着放 */
export function rebuildAudio() {
  const old = AU.ctx, wasPlaying = AU.playing;
  if (AU.timer) clearInterval(AU.timer); AU.timer = null;
  AU.ctx = null; AU.broken = false;
  try { old && old.state !== "closed" && old.close().catch(() => {}); } catch (e) {}
  if (!ensureAudio()) return;
  try { const b = AU.ctx.createBufferSource(); b.buffer = AU.ctx.createBuffer(1, 1, 22050); b.connect(AU.ctx.destination); b.start(0); } catch (e) {}
  if (wasPlaying) PG.startMusic();
}
export function ensureAudio() {
  if (AU.ctx) { if (AU.ctx.state !== "running") wakeAudio(); return true; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  const c = AU.ctx = new AC({ latencyHint: "interactive" });
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4;
  comp.connect(c.destination);
  AU.music = c.createGain(); AU.music.gain.value = cfg.music;
  AU.sfx = c.createGain(); AU.sfx.gain.value = cfg.sfx;
  // 简单回声，给音乐一点空间感
  const dl = c.createDelay(); dl.delayTime.value = 0.27;
  const fb = c.createGain(); fb.gain.value = 0.28;
  const wet = c.createGain(); wet.gain.value = 0.18;
  // 音乐：一个默认不起作用（0 dB）的高架滤波器，连击“狂热”时轻轻提亮；音效：低通 5 kHz，削掉刺耳的高频
  AU.shelf = c.createBiquadFilter(); AU.shelf.type = "highshelf"; AU.shelf.frequency.value = 2500; AU.shelf.gain.value = 0;
  AU.music.connect(AU.shelf); AU.shelf.connect(comp); AU.music.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(comp);
  AU.sfxTone = c.createBiquadFilter(); AU.sfxTone.type = "lowpass"; AU.sfxTone.frequency.value = 5000; AU.sfxTone.Q.value = 0.5;
  AU.sfx.connect(AU.sfxTone); AU.sfxTone.connect(comp);
  const buf = c.createBuffer(1, c.sampleRate, c.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  AU.noise = buf;
  return true;
}
export const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
export function voice(dest, t, f, dur, o = {}) {
  const c = AU.ctx, type = o.type || "sine", vol = o.vol ?? 0.2, a = o.a ?? 0.005;
  const osc = c.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(f, t);
  if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, t + dur);
  if (o.detune) osc.detune.value = o.detune;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  if (o.sustain) { g.gain.setValueAtTime(vol, Math.max(t + a, t + dur - (o.r ?? 0.3))); g.gain.linearRampToValueAtTime(0.0001, t + dur); }
  else g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let n = osc;
  if (o.lp) { const fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = o.lp; fl.Q.value = o.q || 0.7; osc.connect(fl); n = fl; }
  n.connect(g); g.connect(dest);
  osc.start(t); osc.stop(t + dur + 0.05);
}
export function noiseHit(dest, t, dur, o = {}) {
  const c = AU.ctx, s = c.createBufferSource(); s.buffer = AU.noise;
  const f = c.createBiquadFilter(); f.type = o.ft || "highpass"; f.frequency.value = o.f || 7000; f.Q.value = o.q || 0.8;
  const g = c.createGain(); g.gain.setValueAtTime(o.vol ?? 0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t, o.off != null ? o.off : Math.random() * 0.5); s.stop(t + dur + 0.02);   // o.off：固定起点（新音效用，不消耗游戏随机数）
}
export const kick = (d, t, v = 0.55) => voice(d, t, 140, 0.28, { vol: v, glide: 42 });
export const snare = (d, t, v = 0.18) => { noiseHit(d, t, 0.18, { ft: "bandpass", f: 1800, vol: v }); voice(d, t, 190, 0.1, { type: "triangle", vol: v * 0.6 }); };
export const hat = (d, t, v = 0.05) => noiseHit(d, t, 0.04, { f: 8000, vol: v });
export const pad = (d, t, notes, dur, v = 0.035, lp = 1100) => notes.forEach((m, i) => {
  voice(d, t, mtof(m), dur, { type: "sawtooth", vol: v, a: 0.35, sustain: 1, r: 0.6, lp, detune: -6 + i * 3 });
  voice(d, t, mtof(m), dur, { type: "triangle", vol: v * 0.8, a: 0.35, sustain: 1, r: 0.6, detune: 7 });
});
export const bell = (d, t, m, v = 0.06) => { voice(d, t, mtof(m), 2.4, { vol: v, a: 0.004 }); voice(d, t, mtof(m) * 3.01, 0.9, { vol: v * 0.25, a: 0.004 }); };
