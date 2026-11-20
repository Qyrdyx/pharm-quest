/* 药理闯关 · 错题专练：选择题错题、连线错题、高频错误 */
import { PG, reg } from "../core/registry.js";
import { $, TT, esc, shuffle } from "../core/utils.js";
import { DM, FACT_EN, FACT_NAME, enAlt } from "../data/index.js";
import { HOT_DONE, HOT_MIN, cfg, dstat, mwrong, save, wrong } from "../core/state.js";
import { SFX } from "../music/sfx.js";
import { wrongDrugs } from "../records/wrong.js";
import { armConfirm, main, show, toast } from "../ui/screen.js";
import { mkName } from "./match.js";

reg({ mwDrugs: () => mwDrugs, mwKinds: () => mwKinds, hotRows: () => hotRows, hotList: () => hotList, hotDeck: () => hotDeck });
Object.assign(PG, { hotHub });   // 页面跳转函数：core/nav.js 会包一层，记录返回路径

/* ---------- 错题专练（选择题错题 + 连线错题 + 高频错误） ---------- */
/* 连线错题里某一类涉及的药：k 为 cn / m / i / a；mia = 机制、适应证、不良反应任意一项错过；all = 全部 */
export function mwDrugs(k) {
  const ks = Object.keys(mwrong).filter(x => DM.get(+x.split(":")[1]));
  const hit = x => k === "all" ? true : k === "mia" ? /^[mia]:/.test(x) : x.startsWith(k + ":");
  return [...new Set(ks.filter(hit).map(x => +x.split(":")[1]))];
}
export const mwKinds = () => ["mia", "cn", "m", "i", "a"].map(k => [k, mwDrugs(k)]).filter(([, l]) => l.length);
export const hotRows = () => Object.entries(dstat).map(([no, x]) => ({ d: DM.get(+no), ...x })).filter(e => e.d && e.w >= HOT_MIN);
export const hotList = () => hotRows().filter(e => e.s < HOT_DONE).sort((a, b) => b.w - a.w || (b.w / (b.w + b.r)) - (a.w / (a.w + a.r)) || b.t - a.t);
/* 错得越多，在练习里出现得越多（最多 3 次），并尽量不让同一个药连着出现 */
export function hotDeck(list) {
  const out = shuffle(list.flatMap(e => Array(e.w >= 5 ? 3 : e.w >= 3 ? 2 : 1).fill(e.d)));
  for (let i = 1; i < out.length; i++) if (out[i] === out[i - 1]) { const j = out.findIndex((x, k) => k > i && x !== out[i] && out[k - 1] !== x && (k + 1 >= out.length || out[k + 1] !== out[i])); if (j > 0) [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
export function hotHub() {
  const list = hotList(), done = hotRows().filter(e => e.s >= HOT_DONE).sort((a, b) => b.w - a.w);
  const N = cfg.hotN === undefined ? 10 : cfg.hotN;
  const fmt = t => t ? new Date(t).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) : "";
  const row = (e, i) => `<div class="hot-row"><span class="hot-rank">${i + 1}</span>
      <div class="hot-main"><b>${esc(e.d.cn)}</b> <span class="hot-en">${esc(enAlt(e.d))}</span><br><small>#${e.d.g.id} ${esc(e.d.g.n)}</small></div>
      <div class="hot-num"><span class="w">错 ${e.w}</span><span class="r">对 ${e.r}</span><small>${fmt(e.t)}</small></div>
      <div class="hot-bar" title="错误率"><i style="width:${Math.round(e.w / (e.w + e.r) * 100)}%"></i></div>
      <div class="hot-dots" title="连续答对 ${e.s}/${HOT_DONE}">${Array.from({ length: HOT_DONE }, (_, k) => `<span class="${k < e.s ? "on" : ""}"></span>`).join("")}</div></div>`;
  const wq = wrongDrugs(), mk = mwKinds(), en = LANG === "en";
  const wqN = Object.keys(wrong).length, mkN = Object.keys(mwrong).filter(x => DM.get(+x.split(":")[1])).length;
  show(`<div class="sel-head"><div><div class="eyebrow">专项板块</div><h2 style="font-size:28px">${TT("错题专练", "Mistake drills")}</h2>
      <p style="color:var(--mute);margin:6px 0 0;max-width:66ch">${TT("错题本里的选择题错题、连线错题，以及反复答错的高频药，都在这里练。", "Practise quiz mistakes, matching mistakes and frequently missed drugs in one place.")}</p></div>
      <div class="sel-tools"><button class="ibtn" id="toBook">${TT("管理错题本 · 导入导出", "Manage mistake book · import/export")}</button></div></div>
    <section class="hub-sec"><div class="sec-h"><h2>${TT("错题本专练", "Mistake book")}</h2><span>${TT(`选择题 ${wqN} 条 · 连线 ${mkN} 条；答对 / 连对一次减 1，减到 0 移出`, `${wqN} quiz · ${mkN} matching entries; each correct answer removes one count`)}</span></div>
      ${wq.length || mk.length ? `<div class="modes hub3">
        ${wq.length ? `<button class="mode" data-wd="quiz"><span class="tag">${TT("选择题", "Multiple choice")} · ${wq.length} ${TT("种药", "drugs")}</span><h3>${TT("选择题错题专练", "Quiz mistake drill")}</h3><p>${TT("把选择题错题本里的药再考一遍，各种题型轮着出。", "Re-test the drugs from your quiz mistakes with mixed question types.")}</p></button>` : ""}
        ${mk.map(([k, l]) => `<button class="mode${k === "mia" ? " new-k" : ""}" data-wd="${k}"><span class="tag">${TT("连线", "Matching")} · ${l.length} ${TT("种药", "drugs")}</span><h3>${mkName(k)}${TT("错题", " mistakes")}</h3><p>${k === "mia" ? TT("机制、适应证、不良反应错过任意一项的药，三项一起连。", "Drugs with any missed mechanism, indication or adverse effect; link all three.") : k === "cn" ? TT("连错的中英药名再连一遍。", "Re-match the names you missed.") : TT(`只连错过的${FACT_NAME[k]}。`, `Only the ${FACT_EN[k]} you missed.`)}</p></button>`).join("")}
      </div>` : `<p style="color:var(--mute);margin-top:12px">${TT("错题本是空的。答错的题、连错的线，或连线时点“记不清”标记的药，都会出现在这里。", "The mistake book is empty. Wrong answers, wrong links and drugs marked “Not sure” show up here.")}</p>`}</section>
    <section class="hub-sec"><div class="sec-h"><h2>${TT("高频错误", "Frequent mistakes")}</h2><span>${TT(`累计错 ${HOT_MIN} 次进榜，连对 ${HOT_DONE} 次算攻克`, `listed after ${HOT_MIN} misses, cleared after ${HOT_DONE} correct in a row`)}</span></div>
    <p style="color:var(--mute);margin:10px 0 0;max-width:66ch;font-size:13px">${TT("所有玩法里反复答错的药自动进榜，攻克后再错又会回来；练习时错得越多的药出现得越多。", "Drugs you keep missing in any game are listed automatically and return if missed again; the more misses, the more often they appear.")}</p>
    <div class="scope" style="margin-top:12px"><div><div class="big">${list.length}</div><div class="lbl">待攻克</div></div><div><div class="big" style="color:var(--mint)">${done.length}</div><div class="lbl">已攻克</div></div>
      <div class="chips-mini" style="align-items:center"><span>每次练</span><div class="seg" id="hotN">${[10, 20, 0].map(v => `<button data-v="${v}" aria-pressed="${N === v}">${v ? "前 " + v + " 种" : "全部"}</button>`).join("")}</div></div></div>
    ${list.length ? `<div class="modes">
      <button class="mode" data-hot="quiz"><span class="tag">${LANG === "en" ? "Multiple choice · " + (cfg.count ? cfg.count + " Qs" : "Endless") : "选择题 · " + (cfg.count ? cfg.count + " 题" : "无尽")}</span><h3>选择题专练</h3><p>各种题型轮着考这些药，答对会推进“连对”进度。</p></button>
      <button class="mode" data-hot="spell"><span class="tag">中写英</span><h3>默写专练</h3><p>看中文写出这些药的 INN，记得更牢。</p></button>
    </div>
    <h3 style="font-size:20px;margin-top:22px">待攻克（按错误次数排序）</h3><div class="hot-list">${list.map(row).join("")}</div>`
    : `<p style="color:var(--mute);margin-top:16px">还没有累计错 ${HOT_MIN} 次以上的药。去别的板块多练几局，这里会自动记录。</p>`}
    ${done.length ? `<details class="hot-done"><summary>已攻克 ${done.length} 种</summary>
      <div class="re-bar"><small>${TT("点选药物，可以把它们重新加入错题本：", "Tap drugs to put them back into the mistake book:")}</small><button class="ibtn" id="reAll">${TT("全选", "Select all")}</button><button class="btn red" id="reAdd" disabled>${TT("加入错题本", "Add to mistake book")}（0）</button></div>
      <div class="hot-list" id="doneList">${done.map((e, i) => row(e, i).replace('<div class="hot-row">', `<div class="hot-row pickable" data-re="${e.d.no}">`)).join("")}</div></details>` : ""}
    ${hotRows().length ? `<p class="foot"><button class="ibtn" id="hotReset">清空高频错误记录</button></p>` : ""}</section>`,
  () => {
    $("#toBook").onclick = () => { SFX.click(); PG.codex("wrong"); };
    // 已攻克：点选后重新加入错题本
    const reRows = () => [...main.querySelectorAll("#doneList [data-re]")], reBtn = $("#reAdd");
    const reUpd = () => { const n = reRows().filter(r => r.classList.contains("picked")).length; reBtn.disabled = !n; reBtn.textContent = TT("加入错题本", "Add to mistake book") + `（${n}）`; };
    reRows().forEach(r => r.onclick = () => { SFX.pick(); r.classList.toggle("picked"); reUpd(); });
    if ($("#reAll")) $("#reAll").onclick = () => { SFX.click(); const all = reRows().every(r => r.classList.contains("picked")); reRows().forEach(r => r.classList.toggle("picked", !all)); reUpd(); };
    if (reBtn) reBtn.onclick = () => {
      const nos = reRows().filter(r => r.classList.contains("picked")).map(r => r.dataset.re); if (!nos.length) return;
      nos.forEach(no => { wrong[no] = (wrong[no] || 0) + 1; }); save(); SFX.right();
      toast(TT(`已把 ${nos.length} 种药加入错题本`, `Added ${nos.length} drugs to the mistake book`));
      reRows().forEach(r => r.classList.remove("picked")); reUpd();
    };
    main.querySelectorAll("[data-wd]").forEach(b => b.onclick = () => {
      SFX.pick(); const k = b.dataset.wd;
      if (k === "quiz") PG.startQuiz(wrongDrugs(), { title: TT("选择题错题专练", "Quiz mistake drill") });
      else PG.startMatch({ kind: k, only: mwDrugs(k), drill: true });
    });
    const pickN = () => { const n = cfg.hotN === undefined ? 10 : cfg.hotN; return n ? list.slice(0, n) : list; };
    $("#hotN").querySelectorAll("button").forEach(b => b.onclick = () => { cfg.hotN = +b.dataset.v; save(); SFX.click(); $("#hotN").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); });
    main.querySelectorAll("[data-hot]").forEach(b => b.onclick = () => {
      SFX.pick(); const L = pickN();
      if (b.dataset.hot === "spell") PG.startSpell({ dir: "c2e", only: L.filter(e => PG.canSpell(e.d)).map(e => e.d.no) });
      else PG.startQuiz(hotDeck(L), { mode: "hot", title: "高频错误专练", ordered: true });
    });
    armConfirm($("#hotReset"), "再点一次确认清空（不能撤销）", () => { PG.dstat = {}; save(); SFX.click(); PG.hotHub(); });
  });
}
