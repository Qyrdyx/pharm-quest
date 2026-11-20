/* 药理闯关 · 导入的歌曲：读 JSON 乐谱 → 校验、整理 → 存本机 → 加进曲目表（“我导入的”分组）
   格式见 songs.md / 设置里的“导入歌曲”说明。存在 localStorage 的 pg_songs，完整备份会一起带上。 */
import { PG, reg } from "../core/registry.js";
import { LS } from "../core/storage.js";
import { cfg, save } from "../core/state.js";
import { mtof, voice } from "./engine.js";
import { chime, flute, grand, huqin, piano, pipa, sax, suona, trumpet, vox, warmLead, zheng } from "./instruments.js";
import { multiScoreTrack, noteMidi } from "./compose.js";
import { TRACKS, TRACK_GROUPS } from "./tracks.js";

reg({ USER_GROUP: () => USER_GROUP, INSTRUMENTS: () => INSTRUMENTS, userSongs: () => userSongs, parseSongJSON: () => parseSongJSON, addUserSongs: () => addUserSongs, removeUserSong: () => removeUserSong, SONG_SAMPLE: () => SONG_SAMPLE, SONG_SAMPLE_EN: () => SONG_SAMPLE_EN, songSample: () => songSample });

export const USER_GROUP = "我导入的";
export const LIMITS = { songs: 30, parts: 8, notes: 20000, chars: 1500000 };

/* 乐器：每种的音量和余音长度都调到和内置曲目差不多响 */
export const INSTRUMENTS = {
  piano:   ["钢琴", "Piano",          (o, t, m, dur, v) => grand(o, t, m, 0.045 * v, Math.max(0.8, dur * 1.5))],
  epiano:  ["电钢琴", "E-piano",      (o, t, m, dur, v) => piano(o, t, m, 0.04 * v, Math.max(0.6, dur * 1.2))],
  zheng:   ["古筝", "Guzheng",        (o, t, m, dur, v) => zheng(o, t, m, 0.06 * v, Math.max(0.8, dur * 1.4))],
  pipa:    ["琵琶", "Pipa",           (o, t, m, dur, v) => pipa(o, t, m, 0.055 * v, Math.max(0.6, dur * 1.5))],
  flute:   ["笛子", "Flute",          (o, t, m, dur, v) => flute(o, t, m, dur * 0.95, 0.045 * v)],
  erhu:    ["二胡", "Erhu",           (o, t, m, dur, v) => huqin(o, t, m, dur * 0.95, 0.035 * v)],
  suona:   ["唢呐", "Suona",          (o, t, m, dur, v) => suona(o, t, m, dur * 0.95, 0.03 * v)],
  sax:     ["萨克斯", "Sax",          (o, t, m, dur, v) => sax(o, t, m, dur * 0.95, 0.04 * v)],
  trumpet: ["小号", "Trumpet",        (o, t, m, dur, v) => trumpet(o, t, m, dur * 0.95, 0.035 * v)],
  synth:   ["合成器", "Synth lead",   (o, t, m, dur, v) => warmLead(o, t, m, dur * 0.96, 0.05 * v)],
  voice:   ["人声哼唱", "Voice",      (o, t, m, dur, v) => vox(o, t, m, dur * 0.95, 0.05 * v)],
  bell:    ["铃声", "Bells",          (o, t, m, dur, v) => chime(o, t, m, 0.06 * v)],
  bass:    ["低音", "Bass",           (o, t, m, dur, v) => voice(o, t, mtof(m), dur * 0.95, { type: "triangle", vol: 0.2 * v, lp: 600 })]
};
const ALIAS = { grand: "piano", 钢琴: "piano", guzheng: "zheng", 古筝: "zheng", 琵琶: "pipa", 笛子: "flute", 笛: "flute", dizi: "flute", huqin: "erhu", 二胡: "erhu", 唢呐: "suona", saxophone: "sax", 萨克斯: "sax", 小号: "trumpet", lead: "synth", 合成器: "synth", vox: "voice", 人声: "voice", chime: "bell", 铃: "bell", 低音: "bass", 贝斯: "bass", "e-piano": "epiano", 电钢琴: "epiano" };
const instKey = s => { const k = String(s || "piano").trim().toLowerCase(); return INSTRUMENTS[k] ? k : ALIAS[k] || ALIAS[String(s).trim()] || null; };

/* 音符 → "C4+E4" / "R"：接受 "E4"、"C4+E4"、["C4","E4"]、MIDI 数字（60）、null / "R" / 0（休止），结尾 "~" 表示连到下一个同音 */
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midiName = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);
function noteStr(n, where) {
  if (n == null || n === 0 || n === "R" || n === "r" || n === "-" || n === "") return "R";
  if (typeof n === "number") { if (!(n >= 12 && n <= 120)) throw new Error(where + "：MIDI 音高应在 12–120 之间（收到 " + n + "）"); return midiName(Math.round(n)); }
  if (Array.isArray(n)) { const xs = n.map(x => noteStr(x, where)).filter(x => x !== "R"); return xs.length ? xs.join("+") : "R"; }
  const s = String(n).trim().replace(/♯/g, "#").replace(/♭/g, "b"), tie = s.endsWith("~"), body = tie ? s.slice(0, -1) : s;
  if (body === "R" || body === "r") return "R";
  const parts = body.split("+").map(x => x.trim()).map(x => x.charAt(0).toUpperCase() + x.slice(1));
  parts.forEach(x => { if (!noteMidi(x)) throw new Error(where + "：看不懂音名 “" + x + "”（写法如 C4、F#3、Bb5）"); });
  return parts.join("+") + (tie ? "~" : "");
}

/* 读一段 JSON 文本 → 一首或多首整理好的歌 { name, desc, bpm, beatsPerBar, gain, parts:[{ inst, vol, bars }] } */
export function parseSongJSON(text, fallbackName = "导入的歌曲") {
  if (text.length > LIMITS.chars) throw new Error("文件太大（超过 1.5 MB）");
  let o; try { o = JSON.parse(text.replace(/^﻿/, "")); } catch (e) { throw new Error("不是有效的 JSON：" + e.message); }
  if (o && o.app === "pharm-quest" && o.type === "songs" && Array.isArray(o.songs)) return o.songs.map((s, i) => normSong(s, fallbackName + " " + (i + 1)));   // 本软件导出的歌曲包
  if (Array.isArray(o) && o.length && o[0] && typeof o[0] === "object" && !Array.isArray(o[0]) && (o[0].parts || o[0].bars)) return o.map((s, i) => normSong(s, fallbackName + " " + (i + 1)));
  return [normSong(o, fallbackName)];
}
function normSong(o, fallbackName) {
  // 简写 1：最外层直接是小节数组，每小节 = [声部1, 声部2…]（之前给的谱就是这种）
  if (Array.isArray(o)) o = { bars: o };
  if (!o || typeof o !== "object") throw new Error("最外层应该是 { … } 对象");
  let parts = o.parts || o.tracks || o.voices;
  if (!parts && Array.isArray(o.bars)) {          // 简写 2：bars 里每小节列出各声部
    const bars = o.bars, multi = bars.every(b => Array.isArray(b) && b.every(p => Array.isArray(p) && (p.length === 0 || Array.isArray(p[0]))));
    if (multi) { const n = Math.max(...bars.map(b => b.length)); parts = Array.from({ length: n }, (_, k) => ({ instrument: (o.instruments || [])[k], bars: bars.map(b => b[k] || []) })); }
    else parts = [{ instrument: o.instrument, bars }];
  }
  if (!parts && Array.isArray(o.notes)) parts = [{ instrument: o.instrument, notes: o.notes }];   // 简写 3：一条旋律的 notes 列表，不分小节
  if (!Array.isArray(parts) || !parts.length) throw new Error("没有找到 parts（声部）或 bars（小节）");
  if (parts.length > LIMITS.parts) throw new Error("声部太多（最多 " + LIMITS.parts + " 个）");
  const bpm = +(o.bpm || o.tempo || 90), bpb = +(o.beatsPerBar || o.beats_per_bar || 4);
  if (!(bpm >= 30 && bpm <= 260)) throw new Error("bpm（速度）应在 30–260 之间");
  if (!(bpb > 0 && bpb <= 16)) throw new Error("beatsPerBar（每小节拍数）应在 1–16 之间");
  let count = 0;
  const outParts = parts.map((p, pi) => {
    const P = `第 ${pi + 1} 个声部`;
    if (Array.isArray(p)) p = { bars: p };
    const inst = instKey(p.instrument || p.inst || (pi === 0 ? "piano" : "piano"));
    if (!inst) throw new Error(P + "：没有这种乐器 “" + p.instrument + "”，可选：" + Object.keys(INSTRUMENTS).join(" / "));
    let bars = p.bars;
    if (!bars && Array.isArray(p.notes)) {            // 不分小节的旋律：按每小节拍数自动切（跨小节的音放在开始的那一小节）
      bars = []; let cur = [], acc = 0;
      p.notes.forEach(x => { cur.push(x); acc += +(Array.isArray(x) ? x[1] : 0) || 0; if (acc >= bpb - 1e-9) { bars.push(cur); cur = []; acc = 0; } });
      if (cur.length) bars.push(cur);
    }
    if (!Array.isArray(bars)) throw new Error(P + "：缺少 bars（小节）");
    const nb = bars.map((bar, bi) => {
      if (!Array.isArray(bar)) throw new Error(P + ` 第 ${bi + 1} 小节应该是数组`);
      return bar.map((ev, ei) => {
        const W = `${P} 第 ${bi + 1} 小节第 ${ei + 1} 个音`;
        let n, b;
        if (Array.isArray(ev)) [n, b] = ev; else if (ev && typeof ev === "object") { n = ev.note ?? ev.n ?? ev.pitch; b = ev.beats ?? ev.b ?? ev.dur; } else throw new Error(W + "：应该写成 [音名, 拍数]");
        b = +b; if (!(b > 0 && b <= 64)) throw new Error(W + "：拍数应大于 0（四分音符 = 1 拍）");
        if (++count > LIMITS.notes) throw new Error("音符太多（最多 " + LIMITS.notes + " 个）");
        return [noteStr(n, W), +b.toFixed(5)];
      });
    });
    const vol = p.volume == null ? 1 : +p.volume;
    return { inst, vol: vol >= 0 && vol <= 3 ? vol : 1, bars: nb };
  });
  const nBars = Math.max(...outParts.map(p => p.bars.length));
  if (!nBars || !count) throw new Error("谱里一个音都没有");
  // 每小节长度：取各声部里最长的那个（弱起、变拍子都能对齐）；空小节按每小节拍数算
  const barLens = Array.from({ length: nBars }, (_, i) => Math.max(...outParts.map(p => (p.bars[i] || []).reduce((s, x) => s + x[1], 0))) || bpb);
  const name = String(o.name || o.title || fallbackName).trim().slice(0, 40) || fallbackName;
  const gain = o.gain == null ? 1 : +o.gain;
  return { name, desc: String(o.desc || o.description || "").slice(0, 60), bpm, beatsPerBar: bpb, barLens, gain: gain > 0 && gain <= 3 ? gain : 1, parts: outParts };
}

/* 整理好的歌 → 曲目（和“喀秋莎”等内置钢琴曲同一套多声部播放器） */
function songTrack(s) {
  const insts = [...new Set(s.parts.map(p => INSTRUMENTS[p.inst][0]))].join(" + ");
  const tr = multiScoreTrack({ name: s.name, gain: 1.6 * s.gain, bpm: s.bpm, beatsPerBar: s.beatsPerBar, barLens: s.barLens, humanize: true,
    desc: s.desc || `${s.bpm} BPM · ${insts} · ${s.barLens.length} 小节 · 导入`,
    parts: s.parts.map(p => { const f = INSTRUMENTS[p.inst][2]; return { bars: p.bars, play: (out, t, ms, dur, vel) => ms.forEach((m, k) => f(out, t + k * 0.007, m, dur, p.vol * vel / Math.sqrt(ms.length))) }; }) });
  tr.user = true;
  return tr;
}

export const userSongs = () => LS.get("songs", []);
const group = (() => { let g = TRACK_GROUPS.find(x => x[0] === USER_GROUP); if (!g) TRACK_GROUPS.push(g = [USER_GROUP, []]); return g; })();
function mount(s) { TRACKS.push(songTrack(s)); group[1].push(s.name); }
/* 新导入：重名的自动加 (2)；超过上限的不收。返回实际加入的歌名 */
export function addUserSongs(list) {
  const all = userSongs(), added = [];
  for (const s of list) {
    if (all.length >= LIMITS.songs) break;
    let nm = s.name, k = 2; while (TRACKS.some(t => t.name === nm)) nm = `${s.name} (${k++})`;
    const x = { ...s, name: nm }; all.push(x); mount(x); added.push(nm);
  }
  LS.set("songs", all);
  if (LS.get("songs", null)?.length !== all.length) { for (const nm of added) removeUserSong(nm, true); throw new Error("本机存储空间不够，没能保存"); }
  return added;
}
export function removeUserSong(name, skipStore) {
  const i = TRACKS.findIndex(t => t.user && t.name === name); if (i < 0) return;
  const playing = i === cfg.track;
  TRACKS.splice(i, 1); group[1].splice(group[1].indexOf(name), 1);
  if (cfg.track > i) cfg.track--; else if (playing) cfg.track = 0;
  if (cfg.playlist) cfg.playlist = cfg.playlist.filter(n => n !== name);
  if (!skipStore) LS.set("songs", userSongs().filter(s => s.name !== name));
  save();
  if (playing && PG.AU && PG.AU.playing) PG.startMusic();
}

// 启动时把存着的歌挂上；上次选的是导入的歌，就接着选它
try { userSongs().forEach(s => { try { mount(s); } catch (e) {} }); } catch (e) {}
if (cfg.trackName) { const i = TRACKS.findIndex(t => t.name === cfg.trackName); if (i >= 0) cfg.track = i; }

/* 示例：小星星（公有领域），钢琴旋律 + 低音 */
export const SONG_SAMPLE = `{
  "name": "小星星",
  "bpm": 96,
  "beatsPerBar": 4,
  "parts": [
    { "instrument": "piano", "bars": [
      [["C5",1],["C5",1],["G5",1],["G5",1]], [["A5",1],["A5",1],["G5",2]],
      [["F5",1],["F5",1],["E5",1],["E5",1]], [["D5",1],["D5",1],["C5",2]] ] },
    { "instrument": "bass", "volume": 0.8, "bars": [
      [["C3",2],["E3",2]], [["F3",2],["E3",2]],
      [["D3",2],["C3",2]], [["G2",2],["C3",2]] ] }
  ]
}`;

/* English sample: same tune (public-domain “Twinkle, Twinkle, Little Star”) */
export const SONG_SAMPLE_EN = SONG_SAMPLE.replace('"name": "小星星"', '"name": "Twinkle, Twinkle, Little Star"');
/* 按界面语言挑示例：alt = true 时给另一种语言的 */
export const songSample = (alt = false) => (window.LANG === "en") !== alt ? SONG_SAMPLE_EN : SONG_SAMPLE;
