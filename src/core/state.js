/* 药理闯关 · 设置与学习记录的状态：考试范围、设置、统计、错题本、掌握度、高频错误 */
import { PG, reg } from "./registry.js";
import { LS } from "./storage.js";
import { DM, DR, G, GM } from "../data/index.js";

reg({ sel: () => sel, DEFAULT_TYPES: () => DEFAULT_TYPES, savedCfg: () => savedCfg, cfg: () => cfg, stats: () => stats, wrong: () => wrong, mwrong: () => mwrong, mastery: () => mastery, reports: () => reports, dstat: () => dstat, dHit: () => dHit, HOT_MIN: () => HOT_MIN, HOT_DONE: () => HOT_DONE, save: () => save, track: () => track, trackQ: () => trackQ, masteryOf: () => masteryOf, poolGroups: () => poolGroups, poolDrugs: () => poolDrugs }, { sel: v => { sel = v; }, wrong: v => { wrong = v; }, mwrong: v => { mwrong = v; }, mastery: v => { mastery = v; }, reports: v => { reports = v; }, dstat: v => { dstat = v; } });

/* ================= 持久化状态 ================= */
export let sel = new Set(LS.get("sel", G.map(g => g.id)).filter(id => GM.has(id)));
export const DEFAULT_TYPES = { cn: 1, en: 1, group: 1, note: 1, mech: 1, feat: 1, odd: 1, pair: 1, multi: 1, tf: 1, fm: 1, dm: 1, fi: 1, di: 1, fa: 1, da: 1, ga: 1, xf: 1, xd: 1, xs: 1 };
export const savedCfg = LS.get("cfg", {});
export const cfg = Object.assign({ fx: 2, shake: 1, ach: 1, fade: 1, ecoOpts: { bg: 1, ecg: 1, anim: 1, deco: 1, holo: 1, fx: 1 }, matchRounds: 3, count: 20, timer: 0, lives: 0, music: 0.45, sfx: 0.7, track: 2, playMode: "one", playlist: [], eco: matchMedia("(pointer: coarse)").matches ? 1 : 0 }, savedCfg, { types: Object.assign({}, DEFAULT_TYPES, savedCfg.types || {}), ecoOpts: Object.assign({ bg: 1, ecg: 1, anim: 1, deco: 1, holo: 1, fx: 1 }, savedCfg.ecoOpts || {}) });
export const stats = Object.assign({ games: 0, answered: 0, correct: 0, bestCombo: 0 }, LS.get("stats", {}));
stats.best = Object.assign({ quiz: 0, sort: 0, match: 0, case: 0 }, stats.best || {});
export let wrong = LS.get("wrong", {});
export let mwrong = LS.get("mwrong", {});   // 连线错题：{ "m:12": 次数 }，前缀是连线类型 cn / m / i / a
export let mastery = LS.get("mastery", {});   // { 组id: { a: 作答数, c: 答对数, t: 最近时间 } }
export let reports = LS.get("reports", []);
/* 每种药的累计记录：w 错 / r 对 / s 当前连对 / t 最近一次出错 */
export let dstat = LS.get("dstat", null);
if (!dstat) { dstat = {}; Object.keys(wrong).forEach(k => { if (k[0] !== "g" && DM.get(+k)) dstat[k] = { w: wrong[k], r: 0, s: 0, t: Date.now() }; }); }
export function dHit(d, ok) {
  if (!d || !d.no) return;
  const x = dstat[d.no] || (dstat[d.no] = { w: 0, r: 0, s: 0, t: 0 });
  if (ok) { x.r++; x.s++; } else { x.w++; x.s = 0; x.t = Date.now(); }
}
export const HOT_MIN = 2, HOT_DONE = 3;   // 错 2 次进榜；之后连对 3 次算攻克   // 用户标记“这题有问题”的题
export const save = () => { if (window.__restoring) return; try { cfg.trackName = PG.TRACKS[cfg.track].name; } catch (e) {} LS.set("dstat", dstat); LS.set("sel", [...sel]); LS.set("cfg", cfg); LS.set("stats", stats); LS.set("wrong", wrong); LS.set("mastery", mastery); LS.set("reports", reports); LS.set("mwrong", mwrong); };
/* 记录某个药物组的一次作答 */
export function track(g, ok) {
  if (!g) return;
  const m = mastery[g.id] || (mastery[g.id] = { a: 0, c: 0, t: 0 });
  m.a++; if (ok) m.c++; m.t = Date.now();
}
export function trackQ(q, ok) {
  const gs = new Set();
  if (q.ref.group) gs.add(q.ref.group);
  if (q.ref.drug) gs.add(q.ref.drug.g);
  if (q.ref.odd) gs.add(q.ref.odd);
  if (q.ref.pair) { gs.add(q.ref.pair.a.g); gs.add(q.ref.pair.b.g); }
  gs.forEach(g => track(g, ok));
  if (q.ref.drug) dHit(q.ref.drug, ok);
}
/* 掌握度：带平滑的正确率（作答少时向 50% 收缩），未练过返回 null */
export function masteryOf(id) { const m = mastery[id]; return m && m.a ? (m.c + 1) / (m.a + 2) : null; }
export const poolGroups = () => G.filter(g => sel.has(g.id));
export const poolDrugs = () => DR.filter(d => sel.has(d.g.id));
