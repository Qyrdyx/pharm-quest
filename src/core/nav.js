/* 药理闯关 · 返回上一页：记录走过的页面 */
import { PG, reg } from "./registry.js";
import { $ } from "./utils.js";
import { keepY } from "../ui/screen.js";
import { Q } from "../games/quiz.js";
import { S } from "../games/sort.js";
import { M } from "../games/match.js";
import { K } from "../games/case.js";
import { SP } from "../games/spell.js";

reg({ NAV: () => NAV, homeY: () => homeY, TRANSIENT: () => TRANSIENT, updBack: () => updBack, goBack: () => goBack }, { homeY: v => { homeY = v; } });

/* ================= 顶栏 ================= */
/* ================= 返回上一页 ================= */
// 记录走过的页面；答题、结算这类“一次性”页面返回时直接跳过，回到开始答题之前的那一页
export const NAV = [];
export let homeY = 0;
export const TRANSIENT = new Set(["startRx", "startRhythm", "rhythmCal", "startQuiz", "startSort", "startMatch", "startCase", "startSpell", "pgResult"]);
["rxHub", "startRx", "feedbackPage", "rhythmHub", "rhythmCal", "startRhythm", "home", "selector", "codex", "caseMenu", "startCase", "classHub", "classPage", "classTable", "topicHub", "factCards", "startQuiz", "startSort", "startMatch", "spellHub", "startSpell", "hotHub", "aiHub", "aiGen", "aiLibrary", "achPage", "packEditor", "pgResult"].forEach(name => {
  const orig = PG[name];
  PG[name] = function (...args) {
    const top0 = NAV[NAV.length - 1];
    if (top0) top0.y = scrollY;                          // 记下离开时的位置
    if (top0 && top0.name === "home") homeY = scrollY;
    // 首页：从别的页回来用上次离开首页的位置；首页自己刷新保持当前位置
    const restoreY = name === "home" ? (top0 && top0.name === "home" ? scrollY : homeY) : null;
    if (name === "home") NAV.length = 0;
    const top = NAV[NAV.length - 1];
    if (top && top.name === name && !TRANSIENT.has(name)) top.args = args;   // 同一页内切换标签，只更新参数
    else NAV.push({ name, args });
    const out = orig.apply(this, args);
    updBack();
    if (restoreY) keepY(restoreY);
    return out;
  };
});
export function updBack() {
  const b = $("#backBtn"); if (!b) return;
  b.hidden = NAV.length <= 1; delete b.dataset.armed; b.querySelector("span").textContent = "返回";
}
export function goBack() {
  const b = $("#backBtn"), cur = NAV[NAV.length - 1];
  const inGame = (Q || S || M || K || SP) && cur && TRANSIENT.has(cur.name) && cur.name !== "pgResult";
  // 正在答题时要点两次，防止误触丢掉本局进度
  if (inGame && !b.dataset.armed) {
    b.dataset.armed = 1; b.querySelector("span").textContent = innerWidth < 600 ? "再点放弃" : "再点一次放弃本局";
    clearTimeout(b._t); b._t = setTimeout(() => { if (b.dataset.armed) { delete b.dataset.armed; b.querySelector("span").textContent = "返回"; } }, 3000);
    return;
  }
  if (Q) { clearInterval(Q.tid); PG.Q = null; }
  if (S) { clearInterval(S.tid); PG.S = null; }
  if (M) { clearInterval(M.tid); PG.M = null; }
  if (K) { clearInterval(K.tid); PG.K = null; }
  PG.SP = null;
  NAV.pop();
  while (NAV.length && TRANSIENT.has(NAV[NAV.length - 1].name)) NAV.pop();
  const prev = NAV.pop() || { name: "home", args: [] };
  const y = prev.name === "home" ? homeY : prev.y || 0;
  PG[prev.name](...prev.args);
  if (y) keepY(y);
}
$("#backBtn").onclick = () => goBack();
addEventListener("keydown", e => {
  if (e.key !== "Escape" || e.isComposing) return;
  if ($("#sheetHost").innerHTML) { $("#sheetHost").innerHTML = ""; return; }
  if (!$("#backBtn").hidden) goBack();
});
