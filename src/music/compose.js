/* 药理闯关 · 乐谱解析与编曲：简谱、五线谱事件、自动配和声 */
import { PG, reg } from "../core/registry.js";
import { mtof, pad, voice } from "./engine.js";
import { pedalPiano, qin, woodblock, zheng } from "./instruments.js";

reg({ parseScore: () => parseScore, scoreTrack: () => scoreTrack, pentaAccomp: () => pentaAccomp, harmonize: () => harmonize, F_CHORDS: () => F_CHORDS, noteMidi: () => noteMidi, multiScoreTrack: () => multiScoreTrack, jianpuMidi: () => jianpuMidi, jianpuTrack: () => jianpuTrack, eventTrack: () => eventTrack, A_CHORDS: () => A_CHORDS, pedalTrack: () => pedalTrack, _: () => _ });
   // 到下一个音还有几步

/* ——— 按谱播放：notes 为 [MIDI 音高（0 为休止）, 拍数]，按 32 分音符精度排程，节奏与原谱一致 ——— */
export const parseScore = s => s.trim().split(/\s+/).map(x => { const [m, b] = x.split(":"); return [+m, +b]; });
export function scoreTrack(o) {
  const ev = {}; let pos = 0;
  o.notes.forEach(([m, b]) => { if (m) ev[Math.round(pos * 8)] = [m, b]; pos += b; });
  const passes = o.passes || 1, one = Math.round(pos * 8), tail = (o.tailBeats ?? 2) * 8, bpb = o.beatsPerBar || 4;
  return { name: o.name, desc: o.desc, gain: o.gain, bpm: o.bpm * 2, len: one * passes + tail,
    play(s, t, d, out) {
      if (s >= one * passes) return;                       // 曲尾留一点空白再循环
      const pass = Math.floor(s / one), st = s % one, beat = st / 8, beatSec = d * 8;
      if (st % 8 === 0) o.accomp && o.accomp(out, t, Math.floor(beat) % bpb, Math.floor(beat / bpb), pass, beatSec, st === 0);
      const e = ev[st];
      if (e) o.lead(out, t, e[0], e[1] * beatSec, pass, e[1]);
    } };
}
// 五声音阶伴奏：持续低音落在调式主音上，古筝在主音、五度、八度之间分解，不会和旋律打架
export function pentaAccomp(final, opt = {}) {
  const arp = [0, 7, 12, 14, 19, 12, 7, 12];
  return (out, t, bi, bar, pass, beatSec, first) => {
    if (bi === 0) {
      if (bar % 2 === 0 || first) { qin(out, t, final - 24, opt.qin ?? 0.12); voice(out, t, mtof(final - 12), beatSec * 8, { type: "sine", vol: 0.08, a: 0.1, sustain: 1, r: 0.8 }); }
      if (opt.pad) pad(out, t, [final, final + 7, final + 12], beatSec * 4, opt.pad, 1100);
    }
    zheng(out, t, final + arp[(bar * 4 + bi) % 8] - 12, opt.zheng ?? 0.022, beatSec * 2.2);
    if (opt.wood && (bi === 1 || bi === 3)) woodblock(out, t, opt.wood);
  };
}
/* 自动配和声：每半小节（2 拍）按旋律落在和弦音上的时值打分，选最合适的和弦 */
export function harmonize(notes, chords, step = 2) {
  const seg = []; let pos = 0;
  notes.forEach(([m, b]) => {
    if (m) { let p = pos, rem = b; while (rem > 1e-9) { const i = Math.floor(p / step + 1e-9), end = Math.min((i + 1) * step, p + rem); (seg[i] = seg[i] || []).push([m % 12, end - p, Math.abs(p - i * step) < 1e-9]); rem -= end - p; p = end; } }
    pos += b;
  });
  const out = []; let prev = null;
  for (let i = 0; i < Math.ceil(pos / step - 1e-9); i++) {
    let best = prev || chords[0], bs = -Infinity;
    for (const c of chords) {
      const pcs = c.map(x => x % 12); let sc = c === prev ? 0.3 : 0;
      (seg[i] || []).forEach(([pc, w, on]) => { sc += pcs.includes(pc) ? w * (on ? 1.6 : 1) : -w * 0.7; });
      if (sc > bs) { bs = sc; best = c; }
    }
    out.push(best); prev = best;
  }
  return out;
}
// F 大调里的常用和弦（根音、三音、五音）
export const F_CHORDS = [[53, 57, 60], [50, 53, 57], [58, 62, 65], [48, 52, 55], [57, 60, 64], [55, 58, 62]];
/* ——— 多声部谱：每个声部按小节列出 [音名（和弦用 + 连接，R 为休止）, 时值（四分音符）]，所有声部同时开始、同时循环 ——— */
export const noteMidi = n => { const m = /^([A-G])(#|b)?(-?\d)$/.exec(n); if (!m) return 0; return 12 * (+m[3] + 1) + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0); };
export function multiScoreTrack(o) {
  const ev = {}; let total = 0;
  o.parts.forEach((p, pi) => {
    let pos = 0;
    let last = null;   // 上一个音：用来处理连音线
    p.bars.forEach((bar, bi) => { let q = pos; bar.forEach(([n0, b]) => {
      const tie = n0.endsWith("~"), n = n0.replace(/~$/, "");
      if (n === "R") { last = null; q += b; return; }
      if (tie && last && last.tie && last.n === n && Math.abs(last.end - q) < 1e-9) { last.e[2] += b; last.end += b; }   // 连到前一个音
      else { const k = Math.round(q * 4), e = [pi, n.split("+").map(noteMidi).filter(Boolean), b]; (ev[k] = ev[k] || []).push(e); last = { e, n, end: q + b }; }
      last.tie = tie; q += b;
    }); pos += o.barLens ? o.barLens[bi] : o.beatsPerBar; });
    total = Math.max(total, pos);
  });
  return { name: o.name, desc: o.desc, gain: o.gain, bpm: o.bpm, len: Math.round(total * 4),
    play(s, t, d, out) {
      (ev[s] || []).forEach(([pi, ms, b]) => {
        const p = o.parts[pi], hum = o.humanize ? (Math.random() - 0.5) * 0.012 : 0, vel = o.humanize ? 0.92 + Math.random() * 0.16 : 1;
        p.play(out, Math.max(0, t + hum), ms, b * d * 4, vel);
      });
    } };
}
/* ——— 简谱：1–7 为音级，“,” 低八度、“'” 高八度，0 为休止；每个音默认半拍 ——— */
export function jianpuMidi(tok, tonic, scale) {
  const m = /^([0-7])([,']*)$/.exec(tok); if (!m || m[1] === "0") return 0;
  return tonic + scale[+m[1] - 1] + 12 * ((m[2].match(/'/g) || []).length - (m[2].match(/,/g) || []).length);
}
/* 简谱曲目：sections 依次排列；休止前的音自然延音；伴奏按半小节自动配和弦 */
export function jianpuTrack(o) {
  const step = o.unit || 0.5, notes = [], secOf = [];
  o.sections.forEach((sec, si) => sec.notes ? sec.notes.forEach(bar => bar.forEach(([m, b]) => { notes.push([m, b]); secOf.push(si); })) : sec.bars.forEach(bar => bar.trim().split(/\s+/).forEach(tok => {
    if (tok === "-" && notes.length) { notes[notes.length - 1][1] += step; return; }   // 延音：不重新拨弦
    notes.push([tok === "-" ? 0 : jianpuMidi(tok, o.tonic, o.scale), step]); secOf.push(si);
  })));
  const ev = {}; let pos = 0;
  notes.forEach(([m, b], i) => {
    if (m) { let ring = b, k = i + 1; while (o.ringIntoRests !== false && k < notes.length && !notes[k][0] && ring < 4) { ring += notes[k][1]; k++; }
      ev[Math.round(pos * 4)] = { m, ring, held: b, sec: o.sections[secOf[i]], beatInBar: pos % o.beatsPerBar }; }
    pos += b;
  });
  const harm = harmonize(notes, o.chords, o.beatsPerBar / 2);
  return { name: o.name, desc: o.desc, gain: o.gain, bpm: o.bpm, len: Math.round(pos * 4),
    play(s, t, d, out) {
      const beatSec = d * 4, hum = (Math.random() - 0.5) * 0.008, vel = 0.95 + Math.random() * 0.1;
      if (s % 4 === 0) o.accomp(out, t, harm[Math.floor(s / 4 / (o.beatsPerBar / 2)) % harm.length], (s / 4) % o.beatsPerBar, beatSec);
      const e = ev[s]; if (e) o.lead(out, Math.max(0, t + hum), e.m, e.ring * beatSec, e.sec, e.held, vel);
    } };
}
export function eventTrack(o) {
  const ev = {}; o.events.forEach(e => (ev[e[0]] = ev[e[0]] || []).push(e));
  const harm = harmonize(o.line, o.chords, o.beatsPerBar / 2);
  return { name: o.name, desc: o.desc, gain: o.gain, bpm: o.bpm * 2, len: o.beats * 8,   // 每步 1/8 拍
    play(s, t, d, out) {
      const beatSec = d * 8;
      if (s % 8 === 0) { const beat = s / 8; o.accomp(out, t, harm[Math.floor(beat / (o.beatsPerBar / 2)) % harm.length], beat % o.beatsPerBar, beatSec); }
      (ev[s] || []).forEach(([, ms, b, arp, grace, inner, slide]) => {
        const hum = (Math.random() - 0.5) * 0.008, vel = 0.95 + Math.random() * 0.1;
        o.lead(out, Math.max(0, t + hum), ms, b * beatSec, { arp, grace, inner, slide, held: b }, vel);
      });
    } };
}
// A 大调里的常用和弦
export const A_CHORDS = [[57, 61, 64], [62, 66, 69], [64, 68, 71], [66, 69, 73], [59, 62, 66], [61, 64, 68]];
export function pedalTrack(o) {
  const ev = {}; o.events.forEach(e => (ev[e[0]] = ev[e[0]] || []).push(e));
  return { name: o.name, desc: o.desc, gain: o.gain, bpm: o.bpm, len: o.beats * 4,
    play(s, t, d, out) {
      const beatSec = d * 4;
      (ev[s] || []).forEach(([, ms, b, ped, hand]) => {
        const hum = (Math.random() - 0.5) * 0.01, vel = 0.94 + Math.random() * 0.12;
        const hold = b * beatSec * 0.92;   // 按书面时值发声，音与音之间留一点呼吸（不再用踏板延长，避免拖沓）
        ms.forEach((m, k) => pedalPiano(out, Math.max(0, t + hum + k * 0.008), m, (hand ? o.lhVol : o.rhVol) * vel / Math.sqrt(ms.length), hold));
      });
    } };
}
export const _ = null;
