/* 药理闯关 · 成就与收集
 * 成就：每局结算（pgResult）和回首页时检查，新解锁的在右上角弹出提示；存在 pg_ach { id: 解锁时间 }，计数器在 pg_achCnt，打卡日期在 pg_days（都进完整备份）
 * 收集：某个药物组练过 10 题以上、掌握度达到 80%，就点亮成一张“闪卡”；点亮后 7 天没练光泽变淡、14 天氧化发暗（档位不收回），再练就重新擦亮
 * 打卡：每周（周一到周日）可以休息 3 天不算断签（连着最多 3 天）；首页可以钉 3 个正在追的成就、选一张展示卡 */
import { PG, reg } from "../core/registry.js";
import { $, TT, esc } from "../core/utils.js";
import { LS } from "../core/storage.js";
import { DR, G, P } from "../data/index.js";
import { packs } from "../data/packs.js";
import { cfg, dstat, mastery, masteryOf, mwrong, stats, wrong } from "../core/state.js";
import { SFX } from "../music/sfx.js";
import { main, show } from "../ui/screen.js";
import { userSongs } from "../music/usersongs.js";

reg({ achHomeStrip: () => achHomeStrip, bindAchStrip: () => bindAchStrip, fadeOf: () => fadeOf, fadeSync: () => fadeSync, nextTier: () => nextTier, weekInfo: () => weekInfo, achEvent: () => achEvent, shinyTier: () => shinyTier, holoCard: () => holoCard, bindHolo: () => bindHolo, revealCards: () => revealCards, toastAch: () => toastAch, ACH: () => ACH, achCheck: () => achCheck, achState: () => achState, isShiny: () => isShiny, shinyCount: () => shinyCount });
Object.assign(PG, { achPage });   // 页面跳转函数：core/nav.js 会包一层，记录返回路径

/* ---------- 收集 ---------- */
/* 闪卡分三档：银闪（练过 10 题、掌握度 80%）→ 金闪（30 题、90%）→ 彩虹闪（50 题、95%） */
export const SHINY = [[10, 0.8, "银闪", "Silver"], [30, 0.9, "金闪", "Gold"], [50, 0.95, "彩虹闪", "Rainbow"]];
export const shinyTier = g => { const a = mastery[g.id]?.a || 0, m = masteryOf(g.id) ?? 0; let t = 0; SHINY.forEach((s, i) => { if (a >= s[0] && m >= s[1]) t = i + 1; }); return t; };
export const isShiny = g => shinyTier(g) > 0;
/* ---------- 闪卡褪色 ----------
 * 依据：遗忘曲线 / 间隔重复——学会的东西隔一段时间不复习就会忘。闪卡点亮后 7 天没练光泽变淡、14 天氧化发暗（“待擦亮”），
 * 再练这组药就重新擦亮。档位不收回（不让人觉得辛苦攒的东西被没收），只是提醒该复习了 */
const DAY = 864e5;
export const idleDays = g => { const t = mastery[g.id]?.t; return t ? Math.floor((Date.now() - t) / DAY) : 0; };
export const fadeOf = g => { if (cfg.fade === 0 || !shinyTier(g)) return 0;   // 设置里可以关掉褪色
  const d = idleDays(g); return d >= 14 ? 2 : d >= 7 ? 1 : 0; };
export const tarnished = (gs = G) => gs.filter(g => fadeOf(g) === 2);
/* 记下每张闪卡现在的褪色程度；练完一局后对比，从褪色变回光亮的就播“重新擦亮” */
export function fadeSync() { const o = {}; G.forEach(g => { const f = fadeOf(g); if (f) o[g.id] = f; }); LS.set("fadeSeen", o); }
setTimeout(() => { try { fadeSync(); } catch (e) {} }, 0);
/* 离下一档还差多少（目标梯度：看得见终点，人会更愿意加把劲）：假设接下来都答对，最少还要答对几题（同时满足题数和掌握度） */
export function nextTier(g) {
  const t = shinyTier(g); if (t >= SHINY.length) return null;
  const [A, M] = SHINY[t], st = mastery[g.id] || {}, a = st.a || 0, c = st.c || 0, m = masteryOf(g.id) ?? 0;
  const byM = Math.max(0, Math.ceil((M * (a + 2) - (c + 1)) / (1 - M) - 1e-9));
  return { t: t + 1, k: Math.max(A - a, byM, 1), p: Math.max(0, Math.min(1, a / A, m / M)) };
}
/* 镭射卡：底卡 + 彩虹镭射层（随指针换色）+ 跟着指针的高光 + 星点纹理；--mx/--my 由 bindHolo 设置 */
export function holoCard(g, inner, extra = "") {
  const t = shinyTier(g), f = t ? fadeOf(g) : 0;
  return `<div class="col-card${t ? " holo t" + t + (f ? " f" + f : "") : (mastery[g.id]?.a ? " seen" : "")}" ${extra}>${t ? '<i class="holo-foil"></i><i class="holo-glare"></i>' : ""}${inner}${t ? `<span class="holo-tag">${TT(SHINY[t - 1][2], SHINY[t - 1][3])}${f === 2 ? TT(" · 待擦亮", " · dull") : ""}</span>` : ""}</div>`;
}
/* ---------- 卡面 ----------
 * 正面：左上编号 + 章号，中间是这一章的线条图标，组名放大，底部一行掌握度和题数；
 * 背面（点一下翻过来）：这组的药名和一句话区分要点——收藏卡同时是速记卡，先想“这组有哪几个药”再翻面核对，就是一次主动回忆 */
const ICON = {
  I: '<path d="M12 3v5M12 8c-3 0-5 2-5 5v1M12 8c3 0 5 2 5 5v1M7 14l-3 3M7 14l1 4M17 14l3 3M17 14l-1 4"/><circle cx="12" cy="11" r="2.2"/>',
  II: '<path d="M12 5c-1.5-1.6-5-1.4-5.6 1.4C4.6 6.8 4 9 5 10.4 4 11.8 4.6 14.4 6.6 15c.4 2.4 3.4 3.4 5.4 1.6 2 1.8 5 .8 5.4-1.6 2-.6 2.6-3.2 1.6-4.6 1-1.4.4-3.6-1.4-4C16.9 3.6 13.5 3.4 12 5z"/><path d="M12 5v11.6M9 8.5c1 .3 1.8 1 2 2M15 8.5c-1 .3-1.8 1-2 2M8.6 12.6c1 0 2 .6 2.4 1.4M15.4 12.6c-1 0-2 .6-2.4 1.4"/>',
  III: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  IV: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M5.5 12h3l1.5-2.5 2 5 1.5-2.5h5"/>',
  V: '<path d="M7 4c-2 0-3 1.8-3 4 0 3 1.2 4.4 1.8 7 .5 2.4 1 5 2.4 5 1.6 0 1.4-4 3.8-4s2.2 4 3.8 4c1.4 0 1.9-2.6 2.4-5 .6-2.6 1.8-4 1.8-7 0-2.2-1-4-3-4-2 0-3 1-5 1S9 4 7 4z"/>',
  VI: '<rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="M9.2 7.6l5.6 8.8"/>',
  VII: '<rect x="5" y="9" width="14" height="6" rx="3"/><path d="M5 12H2.5M19 12h2.5M8 9l-1-3M12 9V5.5M16 9l1-3M8 15l-1 3M12 15v3.5M16 15l1 3"/>',
  VIII: '<circle cx="12" cy="12" r="5"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4"/><circle cx="10.5" cy="11" r="1"/><circle cx="13.5" cy="13.5" r=".8"/>',
  pack: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>'
};
const icon = g => `<span class="col-ico"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[g.ch] || ICON.pack}</svg></span>`;
/* 正面内容。o.extra = 追加在底部的内容（离下一档的进度、几天没练、展示卡星标） */
export function cardFront(g, o = {}) {
  const st = mastery[g.id] || {}, a = st.a || 0, m = masteryOf(g.id);
  return `<span class="col-top"><span class="col-no">#${g.dot || g.id}</span>${CH_OF(g) ? `<span class="col-ch">${esc(CH_OF(g))}</span>` : ""}</span>${icon(g)}<b>${esc(g.n)}</b>
    <span class="col-foot"><span class="col-m">${a ? Math.round((m ?? 0) * 100) + "%" : "—"}</span><span class="col-a">${a ? TT(`练过 ${a} 题`, `${a} answered`) : TT("还没练", "Not yet")}</span></span>${o.extra || ""}`;
}
const CH_OF = g => g.pack ? "" : g.ch;
/* 背面：药名 + 区分要点（最多 5 个，其余写“还有 N 种”） */
function cardBack(g) {
  const ds = DR.filter(d => d.g === g), shown = ds.slice(0, 4);
  return `<div class="col-back"><b>${esc(g.n)}</b>${g.e && g.e !== g.n ? `<small class="col-be">${esc(g.e)}</small>` : ""}
    <ul>${shown.map(d => `<li><em>${esc(LANG === "en" ? d.en : d.zh)}</em>${esc(d.note || "")}</li>`).join("")}</ul>
    ${ds.length > shown.length ? `<span class="col-more">${TT(`还有 ${ds.length - shown.length} 种…`, `+${ds.length - shown.length} more…`)}</span>` : ""}<span class="col-hint">${TT("点一下翻回正面", "Tap to flip back")}</span></div>`;
}
/* 可翻面的卡：正面是镭射卡，背面是要点 */
const flipCard = (g, front, extra = "") => `<div class="col-flip" data-flip="${g.id}" ${extra}><div class="col-face front">${front}</div><div class="col-face back">${cardBack(g)}</div></div>`;
/* 指针在卡片上移动：更新镭射角度和 3D 倾斜（手机上没有悬停，就用缓慢的自动流光） */
export function bindHolo(root) {
  root.querySelectorAll(".col-card.holo").forEach(c => {
    c.onpointermove = e => { const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty("--mx", (x * 100).toFixed(1) + "%"); c.style.setProperty("--my", (y * 100).toFixed(1) + "%");
      c.style.setProperty("--rx", ((0.5 - y) * 16).toFixed(1) + "deg"); c.style.setProperty("--ry", ((x - 0.5) * 18).toFixed(1) + "deg"); c.classList.add("hov"); };
    c.onpointerleave = () => { c.classList.remove("hov"); ["--rx", "--ry"].forEach(k => c.style.setProperty(k, "0deg")); };
  });
}
/* 结算后：新点亮或升级的闪卡，翻面亮相（一次最多 3 张，其余直接记为已见） */
const revealQ = []; let revealing = false;
export function revealCards(wasFade) {   // wasFade：可选，指定“练之前”的褪色状态（开发者面板模拟用）
  const seen = LS.get("shinySeen", {}) || {}, fresh = [], was = wasFade || LS.get("fadeSeen", {}) || {};
  G.forEach(g => { const t = shinyTier(g); if (t > (seen[g.id] || 0)) { fresh.push([g, t, !!seen[g.id]]); } if (t) seen[g.id] = Math.max(seen[g.id] || 0, t); else delete seen[g.id]; });
  LS.set("shinySeen", seen);
  const ever = new Set(LS.get("everShiny", []) || []); G.forEach(g => { if (shinyTier(g)) ever.add(g.id); }); LS.set("everShiny", [...ever]);   // 点亮过的组（“半衰期”用）
  const polish = G.filter(g => was[g.id] && shinyTier(g) && !fadeOf(g) && !fresh.some(x => x[0] === g));   // 褪色的闪卡这局练过了：重新擦亮
  fadeSync();
  fresh.slice(0, 3).forEach(x => revealQ.push(x)); polish.slice(0, 2).forEach(g => revealQ.push([g, shinyTier(g), "polish"])); if (!revealing) nextReveal();
}
function nextReveal() {
  const x = revealQ.shift(); if (!x) { revealing = false; return; } revealing = true;
  const [g, t, up] = x, d = document.createElement("div"), st = mastery[g.id] || {}; d.className = "cb-reveal" + (up === "polish" ? " polish" : "");
  d.innerHTML = `<div class="rv-card">${holoCard(g, cardFront(g))}${up === "polish" ? '<i class="rv-patina"></i><i class="rv-shine"></i>' : ""}</div>
    <p class="rv-t">${up === "polish" ? TT("重新擦亮！", "Polished again!") : up ? TT(`升级为${SHINY[t - 1][2]}！`, `Upgraded to ${SHINY[t - 1][3]}!`) : TT("新闪卡！", "New shiny card!")}</p>
    <p class="rv-c">${up === "polish" ? TT("隔了一阵还记得，这才是真记住了。", "Still there after a break — that's real memory.") : ""}${TT(`「${g.n}」这组药你答对了 ${Math.round((masteryOf(g.id) ?? 0) * 100)}%（练过 ${st.a || 0} 题）`, `You get ${Math.round((masteryOf(g.id) ?? 0) * 100)}% of “${g.e || g.n}” right (${st.a || 0} answered)`)}</p><p class="rv-s">${TT("点一下继续", "Tap to continue")}</p>`;
  document.body.appendChild(d); bindHolo(d); SFX.reveal();
  const done = () => { if (!d.isConnected) return; d.classList.add("out"); setTimeout(() => { d.remove(); nextReveal(); }, 300); };
  d.onclick = done; setTimeout(done, 3200);
}
/* 预热：第一次弹出闪卡亮相时，大号字体、镭射渐变、背景模糊都要第一次准备，会卡一下（看起来像拖影）。
   打开软件几秒后在看不见的地方先画一次，真正弹出时就顺滑了 */
function warmReveal() {
  try {
    const g = G.find(isShiny) || G[0]; if (!g) return;
    const d = document.createElement("div"); d.className = "cb-reveal polish"; d.setAttribute("aria-hidden", "true");
    d.style.cssText = "opacity:0;pointer-events:none;animation:none";
    d.innerHTML = `<div class="rv-card">${holoCard(g, cardFront(g))}<i class="rv-patina"></i><i class="rv-shine"></i></div><p class="rv-t">。</p><p class="rv-c">。</p>`;
    document.body.appendChild(d); requestAnimationFrame(() => requestAnimationFrame(() => d.remove()));
  } catch (e) {}
}
setTimeout(() => { (window.requestIdleCallback || setTimeout)(warmReveal); }, 2500);
export const shinyCount = (gs = G) => gs.filter(isShiny).length;
const builtIn = () => G.filter(g => !g.pack);

/* ---------- 打卡与计数 ---------- */
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const dk = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const weekKey = d => { const x = new Date(d); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return dk(x); };
function streak() {
  const days = new Set(LS.get("days", []) || []), d = new Date();
  if (!days.has(today())) d.setDate(d.getDate() - 1);          // 今天还没练：从昨天往前数，不算断
  return streakEnding(days, d);
}
/* 本周（周一到周日）每天练没练：周目标 5 天 */
export function weekInfo() {
  const days = new Set(LS.get("days", []) || []), d0 = new Date(), td = today(); d0.setDate(d0.getDate() - (d0.getDay() + 6) % 7);
  const list = Array.from({ length: 7 }, (_, i) => { const d = new Date(d0); d.setDate(d0.getDate() + i); const k = dk(d); return { k, done: days.has(k), future: k > td, today: k === td }; });
  return { list, n: list.filter(x => x.done).length, goal: 7 - REST_PER_WEEK };
}
const cnt = () => Object.assign({ ev: {}, uncured: 0, day: { d: "", n: 0 }, chain: 0, cured: 0, spell: 0, maxWrong: 0, modes: [], perfectQuiz: 0, perfectMatch: 0, tri: 0, night: 0, early: 0 }, LS.get("achCnt", {}));
export const achState = () => LS.get("ach", {}) || {};
/* 截止到某一天（含）的连续打卡天数（只数练过的天）。每周（周一到周日）可以休息 REST_PER_WEEK 天不算断，
   但连着没练超过 REST_RUN 天、或一周里没练的天数超过 REST_PER_WEEK 才算断。
   依据：只靠连续天数，断一天就清零，焦虑感很强，很多人断签后干脆不来了（损失厌恶）；留出余地更可持续 */
export const REST_PER_WEEK = 3, REST_RUN = 3;
function streakEnding(days, end) {
  let n = 0, miss = 0; const used = new Map(), d = new Date(end);
  for (let i = 0; i < 800; i++) {
    const k = dk(d);
    if (days.has(k)) { n++; miss = 0; }
    else { const w = weekKey(d), u = (used.get(w) || 0) + 1; if (miss + 1 > REST_RUN || u > REST_PER_WEEK) break; used.set(w, u); miss++; }
    d.setDate(d.getDate() - 1);
  }
  return n;
}
/* 游戏里发生了某件事（连错 5 题、1 秒内答错、只剩 1 条命连对 10 题……）：记一次，马上检查成就 */
export function achEvent(key) {
  if (cfg.ach === 0) return;
  try { const c = cnt(); c.ev = c.ev || {}; c.ev[key] = (c.ev[key] || 0) + 1; LS.set("achCnt", c); achCheck(null); } catch (e) {}
}
/* “撤销上次恢复”会刷新页面：刷新前在 sessionStorage 留个记号，刷新后补记 */
setTimeout(() => { try { if (sessionStorage.getItem("pg_undoFlag")) { sessionStorage.removeItem("pg_undoFlag"); achEvent("undo"); } } catch (e) {} }, 1500);

/* ---------- 成就表：[id, 档位 1 铜 2 银 3 金, 图标, 中文名, 英文名, 中文说明, 英文说明, 判断 (c) => 布尔 | [当前, 目标]] ---------- */
const QUIZLIKE = ["quiz", "core", "cls", "hot", "ai"];
const nWrong = () => Object.keys(wrong).length + Object.keys(mwrong).length;
export const ACH = [
  ["first", 1, "🩺", "第一次查房", "First rounds", "完成第一局任意玩法", "Finish your first game", c => [stats.games, 1]],
  ["games50", 2, "🏃", "常驻病房", "Ward regular", "累计完成 50 局：复习已经成了习惯", "Finish 50 games — studying has become a habit", c => [stats.games, 50]],
  ["games200", 3, "🏥", "科室顶梁柱", "Department pillar", "累计完成 200 局：这门课你下的功夫比大多数人都多", "Finish 200 games — more effort than most people put into this course", c => [stats.games, 200]],
  ["ans100", 1, "✏️", "百题斩", "100 answers", "累计答题 100 道：常见的药你都见过一遍了", "Answer 100 questions — you've met the common drugs at least once", c => [stats.answered, 100]],
  ["ans1000", 2, "📚", "千题斩", "1,000 answers", "累计答题 1000 道：反复提取，记忆越来越牢", "Answer 1,000 questions — every recall makes the memory stronger", c => [stats.answered, 1000]],
  ["ans5000", 3, "🏆", "题海泳将", "Sea of questions", "累计答题 5000 道：这个题量，考试已经很难难住你", "Answer 5,000 questions — few exam questions can surprise you now", c => [stats.answered, 5000]],
  ["combo10", 1, "🔥", "手感来了", "On fire", "最高连击达到 10：连续 10 题不出错，基础已经稳了", "Reach a 10 combo — ten in a row without a slip; your basics are solid", c => [stats.bestCombo, 10]],
  ["combo20", 2, "⚡", "势不可挡", "Unstoppable", "最高连击达到 20：一整局（默认 20 题）全对，掌握得很扎实", "Reach a 20 combo — a whole default game without a mistake", c => [stats.bestCombo, 20]],
  ["combo40", 3, "👑", "药理之神", "Pharma god", "最高连击达到 40：连续 40 题不出错（要 40 题一局或无尽模式），接近满分状态", "Reach a 40 combo (40-question or endless games) — exam-ready accuracy", c => [stats.bestCombo, 40]],
  ["chain18", 2, "⛓️", "一线到底", "Unbroken line", "一局连线连对 18 次不断：名字和考点对得又快又准", "18 correct links in a row — names and facts match up fast and accurately", c => [c.chain, 18]],
  ["perfectQuiz", 2, "💯", "满分查房", "Perfect rounds", "一局选择题 15 题以上全对：这一范围的药你能完整区分", "Answer 15+ questions in one quiz without a mistake — you can tell this range apart", c => [c.perfectQuiz, 1]],
  ["perfectMatch", 1, "🔗", "完美连线", "Perfect matching", "一局连线零失误：药名和考点的对应已经很熟", "A matching game with no mistakes — you know which fact goes with which drug", c => [c.perfectMatch, 1]],
  ["tri", 3, "🧩", "三合一大师", "3-in-1 master", "三合一连线零失误：每种药的机制、适应证、不良反应都能一一对上", "3-in-1 with no mistakes — mechanism, indication and adverse effects all line up", c => [c.tri, 1]],
  ["modes", 2, "🎮", "全能住院医", "All-rounder", "查房、分拣、连线、病例、默写各完成一局：同一批药从五个角度都练过", "Finish a quiz, sort, matching, case and spelling game — the same drugs from five angles", c => [["quiz", "sort", "match", "case", "spell"].filter(m => c.modes.includes(m)).length, 5]],
  ["cured5", 2, "🧑‍⚕️", "妙手回春", "Healer", "病例诊室治好 5 位病人：能把药理用到具体病人身上了", "Cure 5 patients in the clinic — you can apply pharmacology to real cases", c => [c.cured, 5]],
  ["spell50", 2, "🖊️", "默写达人", "Speller", "默写累计答对 50 个：不只是认得，药名你也写得出来", "Spell 50 names correctly — you can produce the names, not just recognise them", c => [c.spell, 50]],
  ["shiny5", 1, "✨", "第一批闪卡", "First shiny cards", "点亮 5 张闪卡：已经有 5 组药掌握到 80% 以上", "Collect 5 shiny cards — 5 groups mastered to 80%+", c => [shinyCount(), 5]],
  ["shiny20", 2, "🌟", "闪卡收藏家", "Card collector", "点亮 20 张闪卡：20 组药掌握到 80% 以上", "Collect 20 shiny cards — 20 groups mastered to 80%+", c => [shinyCount(), 20]],
  ["shinyAll", 3, "💎", "全图鉴", "Complete codex", "内置药物组全部点亮：每一组药你都掌握到 80% 以上", "Every built-in group shiny — you've mastered every group to 80%+", c => [shinyCount(builtIn()), builtIn().length]],
  ["clean", 2, "🧹", "错题清零", "Clean slate", "错题本攒到过 10 条以上，再全部练掉：曾经的薄弱点都补上了", "Clear a mistake book that once had 10+ entries — your weak spots are fixed", c => c.maxWrong >= 10 && nWrong() === 0],
  ["streak3", 1, "📅", "三天打卡", "3-day streak", "连续 3 天练习：隔天复习最能记牢", "Practise 3 days in a row — spaced practice sticks best", c => [c.streak, 3]],
  ["streak7", 2, "🗓️", "一周不断", "7-day streak", "连续练习 7 天（每周可以休息 3 天）：记忆在反复巩固", "Practise 7 days in a row (up to 3 rest days a week) — steady reinforcement", c => [c.streak, 7]],
  ["streak30", 3, "🏅", "月度全勤", "30-day streak", "连续练习 30 天（每周可以休息 3 天）：长期记忆就是这样养成的", "Practise 30 days in a row (up to 3 rest days a week) — this is how long-term memory forms", c => [c.streak, 30]],
  ["night", 1, "🦉", "夜班医生", "Night shift", "晚上 11 点以后完成一局", "Finish a game after 11 pm", c => [c.night, 1]],
  ["early", 1, "🌅", "早查房", "Early rounds", "早上 5～7 点完成一局", "Finish a game between 5 and 7 am", c => [c.early, 1]],
  ["ai", 1, "🤖", "AI 助教", "AI tutor", "AI 题库里有题", "Have questions in the AI bank", c => (PG.aiBank || []).length > 0],
  ["aiCheck", 2, "🔍", "严格审题", "Strict reviewer", "用 AI 自查复核过题目", "Review questions with AI self-check", c => (PG.aiBank || []).some(q => q.check)],
  ["pack", 1, "📦", "扩展包作者", "Pack author", "导入或制作一个题库扩展包", "Import or make a question-bank pack", c => packs().length > 0],
  ["packReview", 2, "✅", "审核员", "Reviewer", "把一个 AI 扩展包核对后标为已审核", "Mark an AI pack as reviewed", c => packs().some(p => p.ai && p.reviewed)],
  ["dj", 1, "🎵", "DJ", "DJ", "导入一首自己的歌", "Import a song", c => userSongs().length > 0],
  ["backup", 1, "💾", "有备无患", "Safe and sound", "做过一次完整备份", "Make a full backup", c => !!(PG.backupInfo && PG.backupInfo().t)],
  /* ---------- 彩蛋（fun）：有些是隐藏的，解锁前只显示“？？？”和一句提示。黑色幽默只拿“医生和病人”的情景开玩笑 ---------- */
  ["malpractice", 1, "🚑", "医疗事故", "Malpractice", "一口气错了五道，主任正在赶来的路上", "Five wrong in a row — the attending is on the way", c => ev(c, "malpractice"), F("和连续出错有关……", "Something about mistakes in a row…")],
  ["flatline", 1, "📉", "监护仪拉直线", "Flatline", "嘀——————。下一位病人请进", "Beeeeeep. Next patient, please", c => ev(c, "flatline"), F()],
  ["transfer", 2, "📝", "家属请签字", "Next of kin, please sign", "病例诊室里，你已经让 3 位病人“转院”了", "Three patients have been “transferred” from your clinic", c => [c.uncured, 3], F("病例诊室里的事……", "Something in the clinic…")],
  ["guess", 2, "🎲", "全靠蒙", "Pure guesswork", "正确率和闭眼瞎选一模一样，统计学认证", "Exactly as accurate as guessing blind — statistically certified", c => ev(c, "guess"), F("和正确率有关，一个很“随机”的数字", "A very “random” accuracy…")],
  ["zero", 2, "🙃", "反向学霸", "Reverse genius", "能一题不对也是一种实力", "Getting every single one wrong takes talent", c => ev(c, "zero"), F("一局下来……", "One whole game…")],
  ["grudge", 1, "⚔️", "我和这个药有仇", "Personal vendetta", "同一种药错了十次，它一定是你的宿敌", "Ten misses on the same drug — it must be your nemesis", c => Object.values(dstat).some(x => x && x.w >= 10), F()],
  ["window", 1, "⚖️", "治疗窗太窄", "Narrow therapeutic window", "一半对一半错，剂量刚好卡在中毒边缘", "Half right, half wrong — right on the edge of toxicity", c => ev(c, "window"), F("和正确率有关，不多不少", "An accuracy that's neither here nor there…")],
  ["hasty", 1, "⚡", "手速超过脑速", "Faster than thought", "题目还没读完，答案已经错了", "Wrong before you even finished reading", c => ev(c, "hasty"), F("太快了……", "Too fast…")],
  ["ponder", 1, "🤔", "思考人生", "Contemplating life", "一道题想了三分钟，想出什么了吗", "Three minutes on one question. Any revelations?", c => ev(c, "ponder"), F("太慢了……", "Too slow…")],
  ["dunno10", 1, "🤷", "记不清专业户", "Professional “not sure”", "诚实是一种美德", "Honesty is a virtue", c => ev(c, "dunno10"), F()],
  ["miracle", 3, "✨", "医学奇迹", "Medical miracle", "只剩一口气，连对十题，主任说这不科学", "Down to your last life, ten in a row — the attending calls it unscientific", c => ev(c, "miracle"), F("只剩一条命的时候……", "When you're down to your last life…")],
  ["firstpass", 3, "🫀", "首过效应", "First-pass effect", "第一次就满分？肝脏都没来得及代谢", "A perfect first game? The liver didn't even get a chance", c => ev(c, "firstpass"), F("和第一次有关……", "Something about your very first time…")],
  ["langflip", 1, "🔀", "反复横跳", "Language ping-pong", "中文还是英文，这是个问题", "Chinese or English — that is the question", c => [LS.get("langSwitch", 0) || 0, 10], F("中 / EN……", "中 / EN…")],
  ["turntable", 1, "🎧", "打碟大师", "Turntablist", "一分钟换了十首歌，这里是复习还是蹦迪", "Ten tracks in a minute — study session or rave?", c => ev(c, "turntable"), F("和背景音乐有关……", "Something about the music…")],
  ["quickquit", 1, "🏃", "重开大师", "Restart master", "开局五秒就跑，比药效消失还快", "Gone within five seconds — faster than any drug wears off", c => [c.ev.quickquit || 0, 5], F("开局没多久……", "Not long after starting…")],
  ["awake", 1, "🧘", "人间清醒", "Wide awake", "关掉成就又打开，你还是在乎的", "Turned achievements off and back on. You do care", c => ev(c, "awake"), F("在设置里……", "In the settings…")],
  ["silent", 1, "🔇", "默片时代", "Silent film era", "音乐和音效全静音，靠意念答题", "Music and sound fully muted — answering by telepathy", c => ev(c, "silent"), F("安静……", "Quiet…")],
  ["nofx", 1, "🧾", "不要特效，只要真相", "Just the facts", "朴素，但有效", "Plain, but effective", c => ev(c, "nofx"), F()],
  ["undo", 1, "↩️", "Ctrl+Z", "Ctrl+Z", "后悔药已服用", "Regret pill taken", c => ev(c, "undo"), F("和数据备份有关……", "Something about backups…")],
  ["liver", 2, "🌙", "转氨酶升高", "Elevated liver enzymes", "凌晨还在背药，你的肝在报警", "Still studying drugs before dawn — your liver is sounding the alarm", c => ev(c, "liver"), F("天还没亮……", "Before sunrise…")],
  ["cram", 2, "📖", "考前抱佛脚", "Last-minute cramming", "一天刷五百题，佛祖都劝你休息", "500 questions in one day — even the Buddha says take a break", c => [c.day.d === today() ? c.day.n : 0, 500], F()],
  ["withdrawal", 1, "😵", "戒断反应", "Withdrawal symptoms", "连续打卡后突然断了一天，浑身难受", "Missed a day after a long streak — you feel terrible", c => ev(c, "withdrawal"), F("和打卡有关……", "Something about your streak…")],
  ["missing", 1, "🧭", "失踪人口回归", "Missing person found", "你的错题本以为你不要它了", "Your mistake book thought you'd abandoned it", c => ev(c, "missing"), F("好久不见……", "Long time no see…")],
  ["newyear", 3, "🎆", "跨年查房", "New Year's rounds", "别人在倒数，你在背半衰期", "Everyone's counting down; you're counting half-lives", c => ev(c, "newyear"), F("一年的最后一刻……", "The last moment of the year…")],
  ["halflife", 1, "⏳", "半衰期", "Half-life", "学会的东西，过一阵子就只剩一半", "What you learn decays to half after a while", c => (LS.get("everShiny", []) || []).some(id => { const m = masteryOf(id); return m != null && m < 0.5; }), F("和闪卡有关……", "Something about shiny cards…")],
  ["resist", 2, "🦠", "耐药性", "Drug resistance", "同一道错题练了三遍，它对你的治疗产生了耐药", "Drilled the same miss three times — it's developed resistance to your treatment", c => ev(c, "resist"), F("错题专练里……", "In mistake drills…")],
  ["aibad", 2, "🕵️", "审核员的审核员", "Reviewing the reviewers", "你让 AI 检查 AI，AI 说 AI 不行", "You had AI check AI, and AI said AI was wrong", c => [LS.get("aiBadTotal", 0) || 0, 5], F()],
  ["selfmade", 2, "🧪", "自产自销", "Home-grown", "自己出的题自己做，还全对了", "Made the questions yourself, then aced them", c => ev(c, "selfmade"), F("和扩展包有关……", "Something about packs…")]
];
/* 彩蛋成就的附加信息：fun = 放在“彩蛋”分区；hidden = 解锁前显示 ？？？ 和提示 hint */
function F(hz, he) { return { fun: 1, hidden: !!hz, hint: hz ? [hz, he] : null }; }
const ev = (c, k) => (c.ev && c.ev[k] || 0) >= 1;
const TIER = { 1: ["铜", "Bronze", "#cd8b5a"], 2: ["银", "Silver", "#c7d2dc"], 3: ["金", "Gold", "#f4bf4f"] };
const evalOne = (a, c) => { const v = a[7](c); return Array.isArray(v) ? { ok: v[0] >= v[1], cur: Math.min(v[0], v[1]), goal: v[1] } : { ok: !!v }; };
const ctx = () => ({ ...cnt(), streak: streak() });

/* 结算 / 回首页时调用：r = 本局结果（回首页时为空）。返回新解锁的成就 */
export function achCheck(r) {
  if (cfg.ach === 0) return [];      // 设置里关掉了“成就与收集”
  const c = cnt();
  if (r && r.answered) {
    const days = new Set(LS.get("days", []) || []), td = today();
    /* 彩蛋：和上次练习隔了多久（失踪人口回归 / 戒断反应），要在把今天记进去之前算 */
    const prev = [...days].filter(d => d < td).sort().pop();
    if (prev) { const gap = Math.round((new Date(td) - new Date(prev)) / 864e5); if (gap >= 14) c.ev.missing = 1; if (gap >= 2) { const was = streakEnding(days, prev), d2 = new Set(days); d2.add(td); if (was >= 7 && streakEnding(d2, td) <= 1) c.ev.withdrawal = 1; } }   // 戒断反应：长连续真的断了（休息日用掉了还没练）
    days.add(td); LS.set("days", [...days].sort().slice(-400));
    const perfect = r.answered > 0 && r.correct === r.answered, h = new Date().getHours(), now = new Date(), acc = r.correct / r.answered;
    if (QUIZLIKE.includes(r.mode)) { if (r.answered >= 12 && acc === 0.25) c.ev.guess = 1; if (r.answered >= 10 && r.correct === 0) c.ev.zero = 1; if (r.answered >= 10 && r.correct * 2 === r.answered) c.ev.window = 1; }
    if (stats.games === 1 && perfect && r.answered >= 10) c.ev.firstpass = 1;
    if (r.mode === "case" && !r.cured) c.uncured++;
    if (cfg.music === 0 && cfg.sfx === 0) c.ev.silent = 1;
    if (cfg.fx === 0) c.ev.nofx = 1;
    if (h >= 3 && h < 5) c.ev.liver = 1;
    if ((now.getMonth() === 11 && now.getDate() === 31 && h >= 23) || (now.getMonth() === 0 && now.getDate() === 1 && h < 1)) c.ev.newyear = 1;
    if (c.day.d !== td) c.day = { d: td, n: 0 }; c.day.n += r.answered;
    if (perfect && r.answered >= 5 && Array.isArray(r.focus) && r.focus.length && r.focus.every(d => d && d.g && d.g.pack)) c.ev.selfmade = 1;
    if (QUIZLIKE.includes(r.mode) && perfect && r.answered >= 15) c.perfectQuiz++;
    if (r.mode === "match" && perfect && r.correct >= 6) { c.perfectMatch++; if (r.opts && r.opts.kind === "mia") c.tri++; }
    if (r.mode === "match") c.chain = Math.max(c.chain, r.maxCombo || 0);
    if (r.mode === "case" && r.cured) c.cured++;
    if (r.mode === "spell") c.spell += r.correct || 0;
    const m = QUIZLIKE.includes(r.mode) ? "quiz" : r.mode; if (!c.modes.includes(m)) c.modes.push(m);
    if (h >= 23 || h < 4) c.night++; if (h >= 5 && h < 7) c.early++;
  }
  c.maxWrong = Math.max(c.maxWrong, nWrong());
  LS.set("achCnt", c);
  const got = achState(), cx = { ...c, streak: streak() }, fresh = [];
  ACH.forEach(a => { if (got[a[0]]) return; try { if (evalOne(a, cx).ok) { got[a[0]] = Date.now(); fresh.push(a); } } catch (e) {} });
  if (fresh.length) { LS.set("ach", got); fresh.forEach(a => toastAch(a)); }
  if (r && r.answered) setTimeout(revealCards, fresh.length ? 900 : 300);
  return fresh;
}

/* ---------- 解锁提示：右上角滑入，排队一个一个出 ---------- */
const queue = []; let busy = false;
function toastAch(a) { queue.push(a); if (!busy) next(); }
function next() {
  const a = queue.shift(); if (!a) { busy = false; return; } busy = true;
  const t = TIER[a[1]], d = document.createElement("div");
  d.className = "ach-toast"; d.style.setProperty("--c", t[2]); d.setAttribute("role", "status");
  d.innerHTML = `<span class="ach-ico">${a[2]}</span><span><small>${TT("解锁成就", "Achievement unlocked")} · ${TT(t[0], t[1])}</small><b>${esc(TT(a[3], a[4]))}</b></span>`;
  d.onclick = () => { d.remove(); PG.achPage(); };
  document.body.appendChild(d); SFX.ach();
  setTimeout(() => { d.classList.add("out"); setTimeout(() => { d.remove(); next(); }, 350); }, 2600);
}

/* ---------- 钉住的成就（最多 3 个）和展示卡：自己选的目标比系统安排的更有动力（自我决定理论：自主感） ---------- */
const MAX_PINS = 3;
const pinsOf = () => { const got = achState(), p = (LS.get("achPins", []) || []).filter(id => ACH.some(a => a[0] === id) && !got[id]); return p; };
function togglePin(id) {
  let p = pinsOf(); if (p.includes(id)) p = p.filter(x => x !== id); else { if (p.length >= MAX_PINS) return false; p.push(id); }
  LS.set("achPins", p); return true;
}
const showcase = () => { const id = LS.get("showcase", null); return G.find(g => g.id === id && shinyTier(g)) || null; };
/* 本周打卡小圆点（一到日）：练过 ● / 今天 ◎ / 以后 · */
const weekDots = w => `<span class="wk-dots">${w.list.map((x, i) => `<i class="${x.done ? "on" : ""}${x.today ? " td" : ""}${x.future ? " fu" : ""}" title="${x.k}">${TT("一二三四五六日"[i], "MTWTFSS"[i])}</i>`).join("")}</span>`;
const chBadge = gs => { const t = gs.length ? Math.min(...gs.map(shinyTier)) : 0; return t; };   // 一章里最低的闪卡档位：全部点亮才有徽章

/* ---------- 首页：展示卡 + 正在追的成就 + 待擦亮的闪卡（都没有就不显示） ---------- */
export function achHomeStrip() {
  if (cfg.ach === 0) return "";
  try { fadeSync(); } catch (e) {}
  const tn = tarnished(), pins = pinsOf().map(id => ACH.find(a => a[0] === id)), sc = showcase(), c = ctx();
  if (!tn.length && !pins.length && !sc) return "";
  return `<div class="ach-home" id="achHome">
    ${sc ? `<div class="ah-sc" data-ah="col" title="${TT("展示卡（在闪卡页更换）", "Showcase card (change it on the card page)")}">${holoCard(sc, cardFront(sc))}</div>` : ""}
    <div class="ah-main">
      ${pins.length ? `<div class="ah-box" data-ah="ach"><h4>${TT("正在追的成就", "Goals I'm chasing")}</h4>${pins.map(a => { const e = evalOne(a, c), t = TIER[a[1]];
        return `<div class="ah-pin" style="--c:${t[2]}"><span>${a[2]}</span><div><b>${esc(TT(a[3], a[4]))}</b>${e.goal ? `<span class="ach-p"><i style="width:${Math.round(e.cur / e.goal * 100)}%"></i></span><small>${e.cur} / ${e.goal}</small>` : `<small>${esc(TT(a[5], a[6]))}</small>`}</div></div>`; }).join("")}</div>` : ""}
      ${tn.length ? `<div class="ah-box ah-tn"><h4>${TT(`${tn.length} 张闪卡需要擦亮`, `${tn.length} shiny card${tn.length > 1 ? "s" : ""} need polishing`)}</h4>
        <p>${TT("这些组两周以上没练了，记忆在慢慢变淡。练一局就能重新擦亮。", "Not practised for 2+ weeks — the memory is fading. One game polishes them again.")}</p>
        <span class="ah-chips">${tn.slice(0, 8).map(g => `<span>${esc(g.n)}</span>`).join("")}${tn.length > 8 ? `<span>+${tn.length - 8}</span>` : ""}</span>
        <button class="btn" id="ahPolish">${TT("擦亮它们（练一局）", "Polish them (one game)")}</button></div>` : ""}
    </div></div>`;
}
export function bindAchStrip(root) {
  const b = root.querySelector("#ahPolish");
  if (b) b.onclick = e => { e.stopPropagation(); SFX.pick(); const ids = new Set(tarnished().map(g => g.id)); PG.startQuiz(DR.filter(d => ids.has(d.g.id)), { title: TT("擦亮闪卡", "Polish cards") }); };
  root.querySelectorAll("[data-ah]").forEach(x => x.onclick = () => { SFX.click(); PG.achPage(x.dataset.ah); });
}

/* ---------- 页面：成就 / 收集 ---------- */
export function achPage(tab = "ach") {
  try { fadeSync(); } catch (e) {}
  const got = achState(), c = ctx(), n = ACH.filter(a => got[a[0]]).length, sh = shinyCount(), bi = builtIn(), pins = pinsOf(), wk = weekInfo();
  const card = a => {
    const t = TIER[a[1]], ok = !!got[a[0]], e = ok ? null : evalOne(a, c), x = a[8] || {};
    if (x.hidden && !ok) return `<div class="ach hid" style="--c:${t[2]}"><span class="ach-ico">❔</span><div class="ach-b"><b>？？？</b><small>${esc(TT(x.hint[0], x.hint[1]))}</small><span class="ach-t">${TT("隐藏成就 · ", "Hidden · ")}${TT(t[0], t[1])}</span></div></div>`;
    const pin = ok ? "" : `<button class="ach-pin${pins.includes(a[0]) ? " on" : ""}" data-pin="${a[0]}" title="${pins.includes(a[0]) ? TT("不追了", "Unpin") : TT("钉到首页，作为正在追的目标（最多 3 个）", "Pin to the home page as a goal (up to 3)")}">📌</button>`;
    return `<div class="ach${ok ? " got" : ""}${x.fun ? " fun" : ""}" style="--c:${t[2]}"><span class="ach-ico">${a[2]}</span><div class="ach-b"><b>${esc(TT(a[3], a[4]))}</b><small>${esc(TT(a[5], a[6]))}</small>
      ${ok ? `<span class="ach-t">${TT(t[0], t[1])} · ${new Date(got[a[0]]).toLocaleDateString()}</span>` : e && e.goal ? `<span class="ach-p"><i style="width:${Math.round(e.cur / e.goal * 100)}%"></i></span><span class="ach-t">${e.cur} / ${e.goal}</span>` : `<span class="ach-t">${TT("未解锁", "Locked")}</span>`}</div>${pin}</div>`;
  };
  /* 最接近完成的 3 个（目标梯度效应） */
  const close = ACH.filter(a => !got[a[0]] && !(a[8] && a[8].hidden)).map(a => { try { const e = evalOne(a, c); return e.goal && e.cur > 0 ? [a, e.cur / e.goal] : null; } catch (er) { return null; } }).filter(Boolean).sort((x, y) => y[1] - x[1]).slice(0, 3).map(x => x[0]);
  const gcard = g => { const st = mastery[g.id] || {}, a = st.a || 0, t = shinyTier(g), f = t ? fadeOf(g) : 0, nx = a ? nextTier(g) : null, star = t && (LS.get("showcase", null) === g.id);
    const extra = `${f ? `<span class="col-idle">${TT(`${idleDays(g)} 天没练`, `${idleDays(g)} days idle`)}</span>` : ""}
      ${nx ? `<span class="col-nx"><i style="width:${Math.round(nx.p * 100)}%"></i></span><span class="col-nt">${TT(`再连对 ${nx.k} 题 → ${SHINY[nx.t - 1][2]}`, `${nx.k} more right → ${SHINY[nx.t - 1][3]}`)}</span>` : ""}
      ${t ? `<button class="col-star${star ? " on" : ""}" data-star="${g.id}" title="${TT("设为首页展示卡", "Show on the home page")}">★</button>` : ""}`;
    return flipCard(g, holoCard(g, cardFront(g, { extra })), `title="${esc(TT("点一下翻面看要点", "Tap to see the key points"))}"`); };
  const BADGE = [null, [TT("银章", "Silver"), "#c7d2dc"], [TT("金章", "Gold"), "#f4bf4f"], [TT("彩虹章", "Rainbow"), "#ff9ff3"]];
  const chapters = P.chapters.map(ch => ({ ch, gs: G.filter(g => g.ch === ch[0]) })).filter(x => x.gs.length);
  show(`<div class="sel-head"><div><div class="eyebrow">${TT("成就与收集", "Achievements & collection")}</div><h2 style="font-size:28px">${tab === "ach" ? TT("成就", "Achievements") : TT("闪卡收集", "Shiny card collection")}</h2>
      <p style="color:var(--mute);margin:6px 0 0;max-width:66ch">${tab === "ach" ? TT("练得越多解锁越多：连击、满分、打卡、全图鉴……点 📌 可以把想追的成就钉到首页（最多 3 个）。", "Unlock more as you practise. Tap 📌 to pin up to 3 goals to the home page.") : TT("药物组练过 10 题、掌握度 80% 点亮银闪；30 题、90% 升级金闪；50 题、95% 升级彩虹闪。点亮后 7 天没练光泽变淡、14 天氧化发暗，再练这组就重新擦亮。一章全部点亮得章节徽章；点 ★ 设为首页展示卡。", "10 answers at 80% makes a group silver; 30 at 90% gold; 50 at 95% rainbow. Cards dull after 7 idle days and tarnish after 14 — practise the group to polish them. Light a whole chapter for its badge; tap ★ to show a card on the home page.")}</p></div>
      <div class="tabs" role="tablist"><button class="tab" data-t="ach" aria-selected="${tab === "ach"}">${TT("成就", "Achievements")} ${n}/${ACH.length}</button><button class="tab" data-t="col" aria-selected="${tab === "col"}">${TT("闪卡", "Shiny cards")} ${sh}/${G.length}</button></div></div>
    ${tab === "ach" ? `<div class="ach-sum"><div><b>${n}</b><span>/ ${ACH.length} ${TT("个成就", "unlocked")}</span></div>
        <div class="ach-wk"><b>${c.streak}</b><span>${TT("天连续打卡", "day streak")}</span>${weekDots(wk)}<small>${TT(`本周 ${wk.n} / ${wk.goal} 天 · 每周可以休息 3 天不断签`, `This week ${wk.n} / ${wk.goal} days · up to 3 rest days a week won't break it`)}</small></div>
        <div><b>${stats.bestCombo}</b><span>${TT("最高连击", "best combo")}</span></div></div>
      ${close.length ? `<div class="sec-h"><h2>${TT("快完成了", "Almost there")}</h2><span>${TT("离解锁最近的几个", "Closest to unlocking")}</span></div><div class="ach-grid">${close.map(card).join("")}</div>` : ""}
      ${[3, 2, 1].map(tr => { const L = ACH.filter(a => a[1] === tr && !(a[8] && a[8].fun)); return `<div class="sec-h"><h2>${TT(TIER[tr][0] + "牌", TIER[tr][1])}</h2><span>${L.filter(a => got[a[0]]).length} / ${L.length}</span></div>
        <div class="ach-grid">${L.sort((x, y) => (got[y[0]] ? 1 : 0) - (got[x[0]] ? 1 : 0)).map(card).join("")}</div>`; }).join("")}
      ${(() => { const L = ACH.filter(a => a[8] && a[8].fun); return `<div class="sec-h"><h2>${TT("彩蛋", "Easter eggs")}</h2><span>${L.filter(a => got[a[0]]).length} / ${L.length} · ${TT("有些是隐藏的", "some are hidden")}</span></div>
        <div class="ach-grid">${L.sort((x, y) => (got[y[0]] ? 1 : 0) - (got[x[0]] ? 1 : 0) || x[1] - y[1]).map(card).join("")}</div>`; })()}
      <p class="ach-msg" id="achMsg"></p>`
    : `<div class="ach-sum"><div><b>${sh}</b><span>/ ${G.length} ${TT("张闪卡", "shiny")}</span></div><div><b>${shinyCount(bi)}</b><span>/ ${bi.length} ${TT("内置组", "built-in")}</span></div><div><b>${chapters.filter(x => chBadge(x.gs)).length}</b><span>/ ${chapters.length} ${TT("枚章节徽章", "chapter badges")}</span></div><div><b>${tarnished().length}</b><span>${TT("张待擦亮", "need polishing")}</span></div></div>
      <div class="ch-badges">${chapters.map(({ ch, gs }) => { const b = chBadge(gs), lit = shinyCount(gs); return `<a class="ch-b${b ? " t" + b : ""}" href="#ch-${esc(ch[0])}" style="--bc:${b ? BADGE[b][1] : "color-mix(in srgb,var(--cap-amber) 75%,transparent)"};--p:${Math.round(lit / gs.length * 100)}%"><span>${esc(ch[0])}</span><small>${b ? BADGE[b][0] : lit + "/" + gs.length}</small></a>`; }).join("")}</div>
      ${chapters.map(({ ch, gs }) => { const b = chBadge(gs); return `<div class="sec-h" id="ch-${esc(ch[0])}"><h2>${esc(ch[0])} ${esc(ch[1])}</h2><span>${b ? `<em class="ch-tag" style="--bc:${BADGE[b][1]}">${TT("章节徽章 · ", "Chapter badge · ")}${BADGE[b][0]}</em> ` : ""}${shinyCount(gs)} / ${gs.length}</span></div><div class="col-grid">${gs.map(gcard).join("")}</div>`; }).join("")}
      <p class="foot"><button class="ibtn" id="colHm">${TT("去热力图看哪些组还差一点 →", "See which groups are close on the heatmap →")}</button></p>`}`,
  () => {
    main.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { SFX.click(); PG.achPage(b.dataset.t); });
    const h = $("#colHm"); if (h) h.onclick = () => { SFX.click(); PG.codex("mastery"); };
    main.querySelectorAll("[data-pin]").forEach(b => b.onclick = e => { e.stopPropagation();
      if (!togglePin(b.dataset.pin)) { SFX.wrong(); const m = $("#achMsg"); if (m) { m.textContent = TT(`最多钉 ${MAX_PINS} 个，先取消一个`, `Up to ${MAX_PINS} pins — unpin one first`); } b.classList.add("bad"); setTimeout(() => b.classList.remove("bad"), 500); return; }
      SFX.click(); const on = pinsOf().includes(b.dataset.pin); main.querySelectorAll(`[data-pin="${b.dataset.pin}"]`).forEach(x => x.classList.toggle("on", on)); });
    main.querySelectorAll("[data-star]").forEach(b => b.onclick = e => { e.stopPropagation(); SFX.click(); const id = +b.dataset.star, cur = LS.get("showcase", null);
      LS.set("showcase", cur === id ? null : id); main.querySelectorAll("[data-star]").forEach(x => x.classList.toggle("on", +x.dataset.star === LS.get("showcase", null))); });
    main.querySelectorAll("[data-flip]").forEach(x => x.onclick = e => { if (e.target.closest("button")) return; SFX.click(); x.classList.toggle("flipped"); });
    bindHolo(main);
  });
}
