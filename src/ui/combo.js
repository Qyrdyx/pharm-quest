/* 药理闯关 · 连击分级反馈（第二版）
 * 设计依据：特效“适中、随表现升级”最好（Kao 2020；Kao 等 CHI 2024），分“蓄势 → 击中 → 余韵”三层叠加（Jonasson & Purho；Swink《Game Feel》），
 * 大特效只在升档时出现、只在答完之后、不挡解析（Harp & Mayer 1998 诱惑性细节效应）。强度跟随设置 cfg.fx：0 关 / 1 低 / 2 中（默认）/ 3 高。
 * 选择题：夸奖阶梯（每档 2～3 个随机说法）+ 顿帧 + 按钮挤压回弹 + 震屏 + 粒子飞进连击计数 + 连击条；第三档起“狂热”：屏幕光晕、背景音乐提亮；3 秒内答对“秒答”
 * 连线：选中后有一根跟着手指走的能量线；连对 → 弧形电光 + 光球飞进回合计数；连对成串升档时本轮所有连线依次重亮；三合一三线汇聚；连错能量线弹回
 * 所有元素都挂在 body 上（不进 #main），换页时由 ui/screen.js 收掉 */
import { reg } from "../core/registry.js";
import { TT, reduceMotion } from "../core/utils.js";
import { cfg } from "../core/state.js";
import { SFX } from "../music/sfx.js";
import { AU } from "../music/engine.js";
import { FX } from "./fx.js";
import { zap, clearLinks } from "./linkfx.js";

reg({ QUIZ_TIERS: () => QUIZ_TIERS, MATCH_TIERS: () => MATCH_TIERS, quizCombo: () => quizCombo, quizBreak: () => quizBreak, quizPerfect: () => quizPerfect, comboMeter: () => comboMeter,
  matchLink: () => matchLink, matchBreak: () => matchBreak, matchRoundClear: () => matchRoundClear, matchTether: () => matchTether, matchTri: () => matchTri, matchReset: () => matchReset, tierOf: () => tierOf, fxLevel: () => fxLevel, feverOff: () => feverOff });

/* [连击数, 中文说法（随机挑一个）, 英文说法, 颜色]。默认一局 20 题：20 = 满分；30、50 只在 40 题一局或无尽模式出现 */
export const QUIZ_TIERS = [
  [3, ["不错！", "漂亮！", "好手感！"], ["Nice!", "Sweet!", "Good touch!"], "#5fd6a8"],
  [5, ["很好！", "真棒！", "稳了！"], ["Great!", "Awesome!", "Steady!"], "#86cbff"],
  [8, ["太棒了！", "绝了！", "厉害了！"], ["Excellent!", "Brilliant!", "Superb!"], "#f4bf4f"],
  [12, ["无敌！", "势不可挡！", "太强了！"], ["Unstoppable!", "On fire!", "Incredible!"], "#ff9f43"],
  [16, ["超神！", "神级操作！"], ["Legendary!", "Godlike!"], "#ef6a52"],
  [20, ["药理之神！", "满分王者！"], ["Pharma God!", "Flawless!"], "#c56cf0"],
  [30, ["封神！"], ["Mythic!"], "#ff6b81"],
  [50, ["传说！"], ["Beyond legend!"], "#ffd166"]];
export const MATCH_TIERS = [
  [3, ["顺！", "连上了！"], ["Smooth!", "Linked!"], "#5fd6a8"],
  [5, ["连珠！", "一串！"], ["Chain!", "Combo chain!"], "#86cbff"],
  [8, ["一气呵成！", "行云流水！"], ["Flawless flow!", "In the flow!"], "#f4bf4f"],
  [12, ["势如破竹！", "连锁反应！"], ["Unstoppable!", "Chain reaction!"], "#ff9f43"],
  [18, ["天衣无缝！", "一线到底！"], ["Perfect chain!", "Unbroken!"], "#ef6a52"]];
/* 特效专用的随机数（mulberry32）：不碰游戏的 Math.random，出题顺序不受特效影响 */
const VR = (() => { let s = (Date.now() ^ 0x9e3779b9) >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
const pick = a => a[Math.floor(VR() * a.length)];
export const tierOf = (n, T = QUIZ_TIERS) => { let k = -1; T.forEach((t, i) => { if (n >= t[0]) k = i; }); return k; };
/* 特效强度：0 关 / 1 低（只有文字）/ 2 中 / 3 高；省电模式（开了“特效最高到中”这一项）最多到“中”，系统“减少动画”最多到“低” */
export const fxLevel = () => { const v = cfg.fx == null ? 2 : +cfg.fx; return reduceMotion ? Math.min(v, 1) : document.body.classList.contains("eco-fx") ? Math.min(v, 2) : v; };
const say = t => TT(pick(t[1]), pick(t[2]));
const add = (cls, html, ms, style) => { const d = document.createElement("div"); d.className = cls; if (style) d.style.cssText = style; d.innerHTML = html; document.body.appendChild(d); setTimeout(() => d.remove(), ms); return d; };
const center = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

/* 大字，三种做法随特效强度变化（依据：动态字体的错落、过冲回弹、跟随动作；游戏飘字要描边保可读、寿命 0.6～1 秒、层级随强度放大）：
 *  低：整词淡入、轻微放大，0.8 秒；中：先微缩（预备）再弹出过冲、描边 + 投影，副标题错后滑入，0.95 秒；
 *  高：逐字落下（每字错后 45 ms）、带厚度的立体字 + 扫光，第 5 档起结束时逐字散开，1.15 秒。档位越高字越大、立体越厚 */
const escT = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function bigWord(text, color, level, sub, pos) {
  document.querySelectorAll(".cb-word").forEach(x => x.remove());
  const L = fxLevel(), mode = L >= 3 ? "high" : L === 2 ? "mid" : "low", life = { low: 800, mid: 950, high: 1150 }[mode];
  const chars = [...text], burstEnd = mode === "high" && level >= 5;
  const body = mode === "high" ? chars.map((ch, i) => `<span style="--i:${i};--dx:${((VR() - 0.5) * 160).toFixed(0)}px;--dr:${((VR() - 0.5) * 70).toFixed(0)}deg" data-ch="${ch === " " ? "" : escT(ch)}"><i>${ch === " " ? "&nbsp;" : escT(ch)}</i></span>`).join("") : mode === "mid" ? `<i>${escT(text)}</i>` : escT(text);
  const d = add(`cb-word m-${mode}${pos ? " " + pos : ""}${LANG === "en" ? " en" : ""}${burstEnd ? " burst" : ""}${level >= 4 && L >= 2 ? " hot" : ""}`, `<b${mode === "mid" ? ` data-t="${escT(text)}"` : ""}>${body}</b>${sub ? `<small>${escT(sub)}</small>` : ""}`, life);
  d.style.setProperty("--c", color); d.style.setProperty("--s", String(1 + Math.min(level, 7) * 0.065)); d.style.setProperty("--depth", Math.min(2 + level, 8)); d.style.setProperty("--life", life + "ms");
  if (mode === "high") d.style.setProperty("--n", chars.length);
  if (L >= 2) {
    const quiet = pos === "top";   // 连线里的大字：只要一圈环，不撒彩色粒子（画面保持克制）
    const yy = pos === "top" ? 0.24 : 0.38, rg = add("cb-ring" + (pos ? " " + pos : ""), "", 800); rg.style.setProperty("--c", color);
    if (level >= 3 && L >= 3) add("cb-ring r2" + (pos ? " " + pos : ""), "", 900).style.setProperty("--c", color);
    if (!quiet) FX.burst(innerWidth / 2, innerHeight * yy, level >= 3 ? "spark" : "pill", (L >= 3 ? 18 : 10) + level * 4, VR);
    if (!quiet && level >= 5 && L >= 3) FX.burst(innerWidth / 2, innerHeight * yy, "cross", 6 + level * 2, VR);
  }
}
/* 震屏：幅度随档位，只在“中 / 高” */
function shake(level) {
  const L = fxLevel(); if (L < 2 || level < 2 || cfg.shake === 0) return;   // 设置里可以单独关掉屏幕震动
  const m = document.querySelector("#main"); if (!m) return;
  m.style.setProperty("--amp", Math.min(2 + level * 1.2, 9) * (L >= 3 ? 1.4 : 1) + "px");
  m.classList.remove("cb-shake"); void m.offsetWidth; m.classList.add("cb-shake"); setTimeout(() => m.classList.remove("cb-shake"), 320);
}
/* 小光点从 from 飞进 to（余韵：把“得分”送进计数器） */
function flyTo(from, to, n, color) {
  if (!from || !to || fxLevel() < 2) return;
  const [x1, y1] = center(from), [x2, y2] = center(to);
  for (let i = 0; i < n; i++) {
    const d = add("cb-fly", "", 900, `left:${x1 + (VR() - 0.5) * 60}px;top:${y1 + (VR() - 0.5) * 30}px;--c:${color}`);
    requestAnimationFrame(() => requestAnimationFrame(() => { d.style.transitionDelay = i * 35 + "ms"; d.style.transform = `translate(${x2 - parseFloat(d.style.left)}px,${y2 - parseFloat(d.style.top)}px) scale(.4)`; d.style.opacity = "0.2"; }));
  }
  setTimeout(() => { to.classList.remove("cb-drop"); void to.offsetWidth; to.classList.add("cb-drop"); }, 420 + n * 35);
}
/* 屏幕四周的颜色光晕 + 背景音乐轻轻提亮（狂热） */
function fever(color) {
  if (fxLevel() < 2) return;
  let g = document.querySelector(".cb-glow"); if (!g) g = add("cb-glow", "", 9e9);
  g.style.setProperty("--c", color);
  try { if (AU.shelf) AU.shelf.gain.setTargetAtTime(fxLevel() >= 3 ? 5 : 3.5, AU.ctx.currentTime, 0.2); } catch (e) {}
}
export function feverOff() {
  document.querySelectorAll(".cb-glow").forEach(x => x.remove());
  try { if (AU.shelf) AU.shelf.gain.setTargetAtTime(0, AU.ctx.currentTime, 0.25); } catch (e) {}
}
const squash = el => { if (!el || fxLevel() < 2) return; el.classList.remove("cb-squash"); void el.offsetWidth; el.classList.add("cb-squash"); };
/* 小飘字：同时最多 3 个，多了先收掉最早的（避免满屏飘字） */
const chipAt = (el, text, color, cls = "") => { if (!el) return; const old = document.querySelectorAll(".cb-chip"); if (old.length >= 3) old[0].remove(); const r = el.getBoundingClientRect(); add("cb-chip " + cls + (LANG === "en" ? " en" : ""), escT(text), 750, `left:${r.left + r.width / 2}px;top:${r.top}px;--c:${color}`); };

/* ---------- 选择题 ---------- */
/* 答对后调用。o = { btn: 点中的选项, fast: 3 秒内答对 }。返回 true 表示刚升档（调用方就不用再飘小字） */
export function quizCombo(n, anchor, o = {}) {
  if (fxLevel() === 0) { comboMeter(n); return false; }
  const k = tierOf(n), t = QUIZ_TIERS[k], color = t ? t[3] : "#5fd6a8";
  if (anchor) { anchor.style.color = t ? color : ""; anchor.classList.toggle("cb-hot", k >= 2); }
  comboMeter(n);
  squash(o.btn);
  if (o.fast && n >= 2) chipAt(o.btn, TT("秒答 ⚡", "Quick ⚡"), "#f4bf4f", "sm");
  if (t && n === t[0]) {
    SFX.tier(k); shake(k + 1);
    setTimeout(() => bigWord(say(t), color, k + 1, TT(`${n} 连击`, `${n} combo`)), fxLevel() >= 2 ? 70 : 0);   // 顿一下再出大字（顿帧）
    flyTo(o.btn, anchor, 6 + k, color);
    if (k >= 2) fever(color);
    return true;
  }
  flyTo(o.btn, anchor, n >= 3 ? 4 : 2, color);
  if (k >= 2) fever(color);
  return false;
}
/* 全部答对的最后一题 */
export function quizPerfect(n) {
  if (fxLevel() === 0) return;
  setTimeout(() => { bigWord(TT("全对！", "Perfect!"), "#ffd166", 7, TT(`${n} / ${n}`, `${n} / ${n}`)); SFX.tier(6); if (fxLevel() >= 2) FX.rain(fxLevel() >= 3 ? 80 : 45, VR); }, 500);
}
export function quizBreak(n) {
  comboMeter(0); feverOff();
  const a = document.querySelector("#combo"); if (a) { a.style.color = ""; a.classList.remove("cb-hot"); }
  if (n < 5 || fxLevel() === 0) return;
  add("cb-break" + (fxLevel() <= 1 ? " calm" : ""), `<b>${TT("连击中断", "Combo broken")}</b><small>×${n}</small>`, 1200);
  SFX.shatter();
}
/* 连击条：指向下一档；第三档起流光 */
export function comboMeter(n) {
  const host = document.querySelector("#combo"); if (!host) return;
  let bar = host.parentElement.querySelector(".cb-meter");
  if (!bar) { bar = document.createElement("div"); bar.className = "cb-meter"; bar.innerHTML = "<i></i>"; host.parentElement.appendChild(bar); }
  const k = tierOf(n), lo = k >= 0 ? QUIZ_TIERS[k][0] : 0, hi = QUIZ_TIERS[k + 1] ? QUIZ_TIERS[k + 1][0] : lo || 1;
  bar.firstChild.style.width = Math.round((k + 1 >= QUIZ_TIERS.length ? 1 : (n - lo) / (hi - lo)) * 100) + "%";
  bar.style.setProperty("--c", QUIZ_TIERS[Math.max(0, k)][3]);
  bar.classList.toggle("fever", k >= 2);
}

/* ---------- 连线 ----------
 * 走线和流光的画法在 linkfx.js；这里管连对 / 连错 / 三合一时的节奏：流光到达时方块锁定、升档时涟漪和大字。 */
let pairs = [];
export function matchTether() {}   // 选中一块后不画跟着鼠标的线（保留接口给游戏调用）
/* 方块锁定：边框亮一下再落回成功状态 */
const lock = (el, delay = 120) => setTimeout(() => { if (!el.isConnected) return; el.classList.remove("cb-lock"); void el.offsetWidth; el.classList.add("cb-lock"); }, delay);
/* 方块泛起一圈涟漪（连对成串升档时） */
const ripple = (el, color, delay) => setTimeout(() => { if (!el.isConnected) return; el.style.setProperty("--rc", color); el.classList.remove("cb-ripple"); void el.offsetWidth; el.classList.add("cb-ripple"); }, delay);
/* 连对一对。n = 本局连对数 */
export function matchLink(a, c, n) {
  const L = fxLevel(), k = tierOf(n, MATCH_TIERS), t = MATCH_TIERS[k], color = t ? t[3] : "#7fe3ff";
  SFX.link(n);
  if (L === 0) return;
  pairs.push([a, c]);
  const dd = L >= 2 ? zap(a, c, color) : 0;   // 流光到达时第二块锁定
  lock(a, 0); lock(c, dd);
  if (t && n === t[0]) {
    SFX.tier(k); shake(k + 1);
    setTimeout(() => bigWord(say(t), color, k + 2, TT(`连对 ${n} 次`, `${n} in a row`), "top"), L >= 2 ? dd : 0);   // 连线的大字放在网格上方，不挡方块
    if (L >= 2) pairs.forEach(([x, y], i) => { ripple(x, color, dd + i * 50); ripple(y, color, dd + 20 + i * 50); });
  }
}
/* 三合一：三道金色流光依次从三项沿走线跑回药名，药名锁定 + 涟漪 */
export function matchTri(drugEl, rightEls) {
  if (fxLevel() < 2) return;
  let last = 0; rightEls.slice(0, 3).forEach((r, i) => { last = Math.max(last, zap(r, drugEl, "#ffd166", i * 130)); });
  ripple(drugEl, "#ffd166", last); lock(drugEl, last);
  setTimeout(() => chipAt(drugEl, TT("三合一！", "3-in-1!"), "#ffd166"), last + 20);
}
/* 连错：一道暗红的流光沿走线跑到半路就断掉、散开 */
export function matchBreak(n, a, c) {
  SFX.linkWrong();
  if (fxLevel() >= 2 && a && c) zap(a, c, "#ff6b81", 0, { stop: 0.5, bad: true });
  if (n >= 5 && fxLevel() > 0) add("cb-break sm" + (fxLevel() <= 1 ? " calm" : ""), `<b>${TT(`断了 · ×${n}`, `Chain broken · ×${n}`)}</b>`, 1000);
}
export function matchReset() { pairs = []; clearLinks(); }
/* 一轮连完：方块依次碎开、星星飞进来；零失误再加一道金光扫过 */
/* 星级：错 1 次以内（三合一一轮 12 根线，错 2 次以内）也算“清盘”，照样有金光扫过和三颗星；以前要零失误才有，太苛刻 */
export function matchRoundClear(grid, miss, secs) {
  const ok = grid && grid.classList.contains("tri") ? 2 : 1, top = miss <= ok, stars = top ? 3 : miss <= ok + 2 ? 2 : 1, L = fxLevel();
  pairs = []; clearLinks();
  if (L === 0) return stars;
  SFX.roundClear(stars);
  if (L >= 2 && grid) {
    [...grid.querySelectorAll(".tile")].forEach((x, i) => setTimeout(() => { if (x.isConnected) { const [cx, cy] = center(x); FX.burst(cx, cy, i % 2 ? "spark" : "pill", top ? 7 : 3, VR); x.classList.add("cb-crumble"); } }, i * 35));
    if (top) { const r = grid.getBoundingClientRect(); add("cb-sweep", "", 900, `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`); }
  }
  add("cb-round" + (L <= 1 ? " calm" : ""), `<div class="cb-stars">${[0, 1, 2].map(i => `<span class="${i < stars ? "on" : ""}" style="animation-delay:${0.15 + i * 0.16}s">★</span>`).join("")}</div>
    <b>${miss === 0 ? TT("完美清盘！", "Perfect clear!") : top ? TT("漂亮清盘！", "Clean sweep!") : stars === 2 ? TT("这轮不错", "Nice round") : TT("这轮完成", "Round done")}</b>${secs != null ? `<small>${secs}s</small>` : ""}`, 1150);
  return stars;
}
