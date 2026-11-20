/* 药理闯关 · 合成乐器：古筝、笛子、古琴、琵琶、钢琴、合成器主奏等 */
import { PG, reg } from "../core/registry.js";
import { AU, mtof, noiseHit, voice } from "./engine.js";

reg({ zheng: () => zheng, flute: () => flute, qin: () => qin, woodblock: () => woodblock, bigdrum: () => bigdrum, gliss: () => gliss, sheng: () => sheng, chime: () => chime, huqin: () => huqin, suona: () => suona, gong: () => gong, cymbal: () => cymbal, VOWEL: () => VOWEL, vox: () => vox, piano: () => piano, trumpet: () => trumpet, sax: () => sax, gapOf: () => gapOf, grand: () => grand, warmLead: () => warmLead, pipa: () => pipa, pipaSlide: () => pipaSlide, pedalPiano: () => pedalPiano });

/* ——— 民族乐器音色（合成近似） ——— */
// 古筝 / 琵琶：拨弦，起音略高再落回，像指甲拨弦
export const zheng = (d, t, m, v = 0.07, dur = 1.6) => {
  const c = AU.ctx, f = mtof(m), o = c.createOscillator(), o2 = c.createOscillator(), g2 = c.createGain(), fl = c.createBiquadFilter(), g = c.createGain();
  o.type = "triangle"; o.frequency.setValueAtTime(f * 1.012, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
  o2.type = "sine"; o2.frequency.setValueAtTime(f * 2, t); g2.gain.value = 0.35;
  fl.type = "lowpass"; fl.frequency.setValueAtTime(5200, t); fl.frequency.exponentialRampToValueAtTime(1200, t + dur * 0.6);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.004);
  g.gain.exponentialRampToValueAtTime(v * 0.35, t + 0.18); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(fl); o2.connect(g2); g2.connect(fl); fl.connect(g); g.connect(d);
  o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
};
// 笛子 / 箫：正弦 + 渐入的颤音 + 二次谐波 + 一点气声
export const flute = (d, t, m, dur, v = 0.05, vib = 5.5, breath = 0.012) => {
  const c = AU.ctx, f = mtof(m), o = c.createOscillator(), o3 = c.createOscillator(), g3 = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(f, t);
  lfo.frequency.value = vib; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.4, dur * 0.5));
  lfo.connect(lg); lg.connect(o.frequency);
  o3.type = "sine"; o3.frequency.setValueAtTime(f * 2, t); g3.gain.value = 0.12; o3.connect(g3); g3.connect(g);
  const a = Math.min(0.09, dur * 0.3);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a);
  g.gain.setValueAtTime(v, Math.max(t + a, t + dur - 0.15)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(d);
  [o, o3, lfo].forEach(x => { x.start(t); x.stop(t + dur + 0.05); });
  if (breath) noiseHit(d, t, Math.min(0.25, dur), { ft: "bandpass", f: f * 2, q: 2, vol: breath });
};
// 古琴：低沉的拨弦，余音长，可带滑音（slide 为半音数）
export const qin = (d, t, m, v = 0.12, slide = 0) => {
  const c = AU.ctx, f = mtof(m), o = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain();
  o.type = "triangle"; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.linearRampToValueAtTime(f * Math.pow(2, slide / 12), t + 0.6);
  fl.type = "lowpass"; fl.frequency.setValueAtTime(1800, t); fl.frequency.exponentialRampToValueAtTime(500, t + 2.5);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
  o.connect(fl); fl.connect(g); g.connect(d); o.start(t); o.stop(t + 3.6);
};
export const woodblock = (d, t, v = 0.05) => { voice(d, t, 820, 0.07, { vol: v, a: 0.001 }); noiseHit(d, t, 0.03, { ft: "bandpass", f: 2400, q: 6, vol: v * 0.6 }); };
export const bigdrum = (d, t, v = 0.4) => { voice(d, t, 95, 0.6, { vol: v, glide: 45 }); noiseHit(d, t, 0.12, { ft: "lowpass", f: 300, vol: v * 0.2 }); };
export const gliss = (d, t, notes, v = 0.03, gap = 0.032) => notes.forEach((m, i) => zheng(d, t + i * gap, m, v, 1.0));   // 古筝刮奏
// 笙：簧管合奏，慢起音、像风琴一样的和声
export const sheng = (d, t, notes, dur, v = 0.02) => notes.forEach((m, i) => {
  voice(d, t + i * 0.012, mtof(m), dur, { type: "square", vol: v, a: 0.18, sustain: 1, r: 0.5, lp: 1700, detune: (i - 1) * 4 });
  voice(d, t + i * 0.012, mtof(m) * 2, dur, { type: "sine", vol: v * 0.5, a: 0.25, sustain: 1, r: 0.5 });
});
// 编钟：低沉的钟声，带不和谐泛音和敲击声
export const chime = (d, t, m, v = 0.07) => {
  const f = mtof(m);
  voice(d, t, f, 2.8, { vol: v, a: 0.003 }); voice(d, t, f * 2.4, 1.4, { vol: v * 0.45, a: 0.003 }); voice(d, t, f * 3.9, 0.7, { vol: v * 0.25, a: 0.003 });
  noiseHit(d, t, 0.05, { ft: "bandpass", f: f * 4, q: 3, vol: v * 0.6 });
};
// 胡琴：二胡（柔）、京胡（亮、尖），弓弦乐器：锯齿波 + 共鸣滤波 + 颤音，起音带滑音
export const huqin = (d, t, m, dur, v = 0.04, kind = "er") => {
  const c = AU.ctx, f = mtof(m), o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), bp = c.createBiquadFilter(), lp = c.createBiquadFilter(), g = c.createGain();
  o.type = "sawtooth"; o.frequency.setValueAtTime(f * (kind === "er" ? 0.94 : 0.97), t); o.frequency.exponentialRampToValueAtTime(f, t + (kind === "er" ? 0.12 : 0.05));
  lfo.frequency.value = kind === "er" ? 5.8 : 7; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * (kind === "er" ? 0.012 : 0.008), t + Math.min(0.3, dur * 0.5)); lfo.connect(lg); lg.connect(o.frequency);
  bp.type = "bandpass"; bp.frequency.value = kind === "er" ? 1100 : 2400; bp.Q.value = kind === "er" ? 0.9 : 1.6;
  lp.type = "lowpass"; lp.frequency.value = kind === "er" ? 3200 : 6000;
  const a = Math.min(0.08, dur * 0.3);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.setValueAtTime(v, Math.max(t + a, t + dur - 0.1)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(bp); bp.connect(lp); lp.connect(g); g.connect(d);
  [o, lfo].forEach(x => { x.start(t); x.stop(t + dur + 0.05); });
};
// 唢呐：嘹亮的双簧音色，鼻音重、颤音大
export const suona = (d, t, m, dur, v = 0.05) => {
  const c = AU.ctx, f = mtof(m), o = c.createOscillator(), o2 = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), bp = c.createBiquadFilter(), hp = c.createBiquadFilter(), g = c.createGain();
  o.type = "square"; o2.type = "sawtooth"; o.frequency.setValueAtTime(f, t); o2.frequency.setValueAtTime(f * 1.003, t);
  lfo.frequency.value = 6.3; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.014, t + Math.min(0.25, dur * 0.5)); lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
  bp.type = "peaking"; bp.frequency.value = 1600; bp.Q.value = 1.2; bp.gain.value = 9;
  hp.type = "highpass"; hp.frequency.value = 420;
  const a = Math.min(0.03, dur * 0.2);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.setValueAtTime(v * 0.85, Math.max(t + a, t + dur - 0.08)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(bp); o2.connect(bp); bp.connect(hp); hp.connect(g); g.connect(d);
  [o, o2, lfo].forEach(x => { x.start(t); x.stop(t + dur + 0.05); });
};
// 锣：大锣低沉绵长；small 为川剧小锣，音高往上翘
export const gong = (d, t, v = 0.3, small = false) => {
  if (small) { voice(d, t, 620, 0.5, { vol: v, glide: 820, a: 0.002 }); noiseHit(d, t, 0.2, { ft: "bandpass", f: 3000, q: 2, vol: v * 0.4 }); return; }
  voice(d, t, 110, 3, { vol: v * 0.6, glide: 82, a: 0.004 }); voice(d, t, 233, 2.2, { vol: v * 0.25, glide: 200, a: 0.004 });
  noiseHit(d, t, 2.4, { ft: "lowpass", f: 2600, vol: v * 0.35 });
};
export const cymbal = (d, t, v = 0.05, dur = 0.6) => noiseHit(d, t, dur, { f: 5200, vol: v });
// 人声（川江号子）：锯齿波 + 两个共振峰模拟元音，glide 为结尾滑音的半音数
export const VOWEL = { a: [800, 1200], o: [500, 880], ei: [420, 2000] };
export const vox = (d, t, m, dur, v = 0.06, vowel = "a", glide = 0) => {
  const c = AU.ctx, f = mtof(m), o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
  o.type = "sawtooth"; o.frequency.setValueAtTime(f * 0.96, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
  if (glide) { o.frequency.setValueAtTime(f, t + dur * 0.55); o.frequency.exponentialRampToValueAtTime(f * Math.pow(2, glide / 12), t + dur); }
  lfo.frequency.value = 5.2; lg.gain.value = f * 0.01; lfo.connect(lg); lg.connect(o.frequency);
  (VOWEL[vowel] || VOWEL.a).forEach((ff, i) => { const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = ff; bp.Q.value = 6; const bg = c.createGain(); bg.gain.value = i ? 0.6 : 1; o.connect(bp); bp.connect(bg); bg.connect(g); });
  const a = Math.min(0.06, dur * 0.2);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 4, t + a); g.gain.setValueAtTime(v * 4, Math.max(t + a, t + dur - 0.12)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  g.connect(d); [o, lfo].forEach(x => { x.start(t); x.stop(t + dur + 0.05); });
};
// 钢琴：短促的击弦，泛音很快衰减
export const piano = (d, t, m, v = 0.04, dur = 1.2) => { const f = mtof(m); voice(d, t, f, dur, { type: "triangle", vol: v, a: 0.003, lp: 3000 }); voice(d, t, f * 2, dur * 0.4, { type: "sine", vol: v * 0.3, a: 0.003 }); };
// 小号：亮的铜管，起音时滤波器打开
export const trumpet = (d, t, m, dur, v = 0.04) => {
  const c = AU.ctx, f = mtof(m), o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
  o.type = "sawtooth"; o.frequency.setValueAtTime(f, t);
  lp.type = "lowpass"; lp.frequency.setValueAtTime(700, t); lp.frequency.linearRampToValueAtTime(3200, t + 0.06); lp.frequency.linearRampToValueAtTime(2200, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.03); g.gain.setValueAtTime(v * 0.8, Math.max(t + 0.04, t + dur - 0.06)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(lp); lp.connect(g); g.connect(d); o.start(t); o.stop(t + dur + 0.05);
};
// 萨克斯：慵懒的簧片音色，带气声和颤音
export const sax = (d, t, m, dur, v = 0.045) => {
  const c = AU.ctx, f = mtof(m), o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), bp = c.createBiquadFilter(), g = c.createGain();
  o.type = "sawtooth"; o.frequency.setValueAtTime(f * 0.97, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
  lfo.frequency.value = 5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.009, t + Math.min(0.35, dur * 0.6)); lfo.connect(lg); lg.connect(o.frequency);
  bp.type = "bandpass"; bp.frequency.value = 950; bp.Q.value = 0.7;
  const a = Math.min(0.06, dur * 0.25);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.setValueAtTime(v * 0.9, Math.max(t + a, t + dur - 0.1)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(bp); bp.connect(g); g.connect(d); [o, lfo].forEach(x => { x.start(t); x.stop(t + dur + 0.05); });
  noiseHit(d, t, Math.min(0.2, dur), { ft: "bandpass", f: 1800, q: 1.5, vol: v * 0.25 });
};
export const gapOf = (row, b) => { let k = b + 1; while (k < 16 && row[k] == null) k++; return k - b; };
// 春江花月夜（古曲，原名《夕阳箫鼓》），1=F，4/4，72。依据苍强曲谱智能谱的播放数据，取前段（江楼钟鼓等主题），舍去后面录入有误的部分


/* 三角钢琴：基音 + 两个泛音，泛音衰减更快；低音区稍暗 */
export const grand = (d, t, m, v = 0.05, dur = 1.8) => {
  const f = mtof(m);
  voice(d, t, f, dur, { type: "triangle", vol: v, a: 0.002, lp: m < 52 ? 1800 : 3600 });
  voice(d, t, f * 2, dur * 0.45, { type: "sine", vol: v * 0.32, a: 0.002 });
  voice(d, t, f * 3, dur * 0.2, { type: "sine", vol: v * 0.1, a: 0.002 });
};
/* 温暖的合成器主奏：锯齿 + 三角波轻微失谐，低通柔化，长音带慢颤音 */
export const warmLead = (d, t, m, dur, v = 0.05) => {
  const c = AU.ctx, f = mtof(m), o1 = c.createOscillator(), o2 = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), lp = c.createBiquadFilter(), g = c.createGain();
  o1.type = "sawtooth"; o2.type = "triangle"; o1.frequency.value = f; o2.frequency.value = f; o1.detune.value = -6; o2.detune.value = 5;
  lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.45, dur * 0.7)); lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
  lp.type = "lowpass"; lp.frequency.value = 1900; lp.Q.value = 0.6;
  const a = Math.min(0.045, dur * 0.3), r = Math.min(0.16, dur * 0.4);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.setValueAtTime(v * 0.88, Math.max(t + a, t + dur - r)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(d); [o1, o2, lfo].forEach(x => { x.start(t); x.stop(t + dur + 0.05); });
};
/* 琵琶：拨弦起音亮、衰减快，带一点拨片噪声 */
export const pipa = (d, t, m, v = 0.06, dur = 0.9) => {
  const f = mtof(m);
  voice(d, t, f, dur, { type: "sawtooth", vol: v * 0.42, a: 0.002, lp: 2400 });
  voice(d, t, f, dur * 0.8, { type: "triangle", vol: v, a: 0.002 });
  voice(d, t, f * 2, dur * 0.28, { type: "sine", vol: v * 0.35, a: 0.001 });
  noiseHit(d, t, 0.02, { ft: "bandpass", f: 3200, q: 2, vol: v * 0.35 });
};
/* 琵琶上滑（推弦）：音高从 from 很快推到 to，没有新的拨弦声 */
export const pipaSlide = (d, t, from, to, v = 0.06, dur = 0.9) => {
  const c = AU.ctx, f0 = mtof(from), f1 = mtof(to);
  [["sawtooth", 0.42, 2400], ["triangle", 1, 0]].forEach(([type, k, lp]) => {
    const o = c.createOscillator(), g = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + 0.09);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * k * 0.85, t + 0.025); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = o; if (lp) { const fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = lp; o.connect(fl); n = fl; }
    n.connect(g); g.connect(d); o.start(t); o.stop(t + dur + 0.05);
  });
};
/* 踏板钢琴：events 为 [起点（16 分音符）, [MIDI…], 书面拍数, 踏板延音拍数, 0 右手 / 1 左手]；每个音延到小节末（踏板），下一小节换踏板 */
/* 钢琴音：按键后自然衰减（低音衰减慢、高音快），松键时很快收掉 */
export const pedalPiano = (d, t, m, v, hold) => {
  const c = AU.ctx, f = mtof(m), end = t + hold, tau = m < 55 ? 1.5 : m < 72 ? 1.0 : 0.75;
  [[f, "triangle", v, m < 52 ? 1800 : 3600], [f * 2, "sine", v * 0.3, 0], [f * 3, "sine", v * 0.08, 0]].forEach(([fr, type, vol, lp], i) => {
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = fr;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.setTargetAtTime(vol * 0.001, t + 0.004, tau / (i + 1));   // 自然衰减
    g.gain.setTargetAtTime(0.0001, end, 0.05);                        // 松键
    let n = o; if (lp) { const fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = lp; o.connect(fl); n = fl; }
    n.connect(g); g.connect(d); o.start(t); o.stop(end + 0.6);
  });
};
