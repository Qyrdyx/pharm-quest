/* 药理闯关 · 基础工具：DOM 选择、转义、随机、洗牌、中英文切换小工具 */
import { PG, reg } from "./registry.js";

reg({ $: () => $, esc: () => esc, rnd: () => rnd, pick: () => pick, shuffle: () => shuffle, clamp: () => clamp, reduceMotion: () => reduceMotion, TT: () => TT });

/* ================= 基础工具 ================= */
export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const rnd = n => Math.floor(Math.random() * n);
export const pick = a => a[rnd(a.length)];
export const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const TT = (zh, en) => (window.LANG === "en" ? en : zh);
