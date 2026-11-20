/* 药理闯关 · 专项板块：机制 · 适应证 · 不良反应；速记卡片 */
import { PG, reg } from "../core/registry.js";
import { $, TT, esc } from "../core/utils.js";
import { DM, FACT_EN, FACT_NAME, G, TYPES, enAlt, fact } from "../data/index.js";
import { packTag } from "../data/packs.js";
import { cfg, mwrong, poolDrugs, poolGroups, save, sel, wrong } from "../core/state.js";
import { SFX } from "../music/sfx.js";
import { main, show } from "../ui/screen.js";
import { bagBadge } from "../records/rotation.js";
import { roundsLabel } from "../pages/home.js";
import { hasFacts } from "./match.js";
import { bankItems } from "../pages/bank.js";

reg({ renderFactSheet: () => renderFactSheet, MI_TYPES: () => MI_TYPES, AE_TYPES: () => AE_TYPES, TOPIC: () => TOPIC });
Object.assign(PG, { topicHub, factCards });   // 页面跳转函数：core/nav.js 会包一层，记录返回路径

/* ---------- 专项板块：机制 · 适应证 · 不良反应 ---------- */
export const MI_TYPES = ["fm", "dm", "fi", "di", "mech"], AE_TYPES = ["fa", "da", "ga"];
export const TOPIC = {
  core: { title: "机制·适应证·不良反应", types: [...MI_TYPES, ...AE_TYPES], cols: ["m", "i", "a"],
    match: [["mia", "三合一连线"], ["m", "机制连线"], ["i", "适应证连线"], ["a", "不良反应连线"]],
    quiz: [["综合闯关", [...MI_TYPES, ...AE_TYPES], "机制、适应证、不良反应三类题混在一起出。"],
      ["只练机制与适应证", MI_TYPES, "给机制选药、给药选机制、给适应证选药、给药选适应证，外加药物组共同机制。"],
      ["只练不良反应", AE_TYPES, "给一条不良反应选药（如“灰婴综合征”“牙龈增生”），给药选它的不良反应组合，外加药物组共同不良反应。"]],
    desc: "每种药“怎么起作用、用来治什么、会出什么问题”。可以三类混合闯关，也可以只练其中一类；还有连线配对和可遮挡自测的速记卡片。" }
};
export function topicHub(t = "core") {
  const T = TOPIC[t], pd = poolDrugs(), en = LANG === "en", dis = pd.length ? "" : "disabled";
  const mdis = k => (k === "mia" ? pd.filter(hasFacts).length : pd.length) >= 2 ? "" : "disabled";   // 连线至少 2 种药
  const mrTag = k => roundsLabel() + (k === "mia" ? (en ? " · 4 drugs × 3 items per round" : " · 每轮 4 药 × 3 项") : (en ? " · 6 pairs per round" : " · 每轮 6 对"));
  const matchDesc = k => k === "mia"
    ? (en ? "Every drug links to three items: mechanism, indication and adverse effect. Tap the drug, then its three items." : "每个药连三项：作用机制、适应证、不良反应。先点药物，再依次点它的三项，三项都连上才算完成。")
    : (en ? `Drug names on the left, ${FACT_EN[k]} on the right; similar items never share a round.` : `左边药名，右边${FACT_NAME[k]}，两两连上。同一轮里不会出现意思相近的两条。`);
  const counts = T.types.map(k => [k, bankItems(k, true).length]), n = counts.reduce((a, x) => a + x[1], 0);
  const inSel = d => d && sel.has(d.g.id);
  const wrongHere = Object.keys(wrong).filter(k => k[0] !== "g" && inSel(DM.get(+k))).length + Object.keys(mwrong).filter(k => inSel(DM.get(+k.split(":")[1]))).length;
  show(`<div class="sel-head"><div><div class="eyebrow">专项板块</div><h2 style="font-size:28px">${T.title}</h2>
      <p style="color:var(--mute);margin:6px 0 0;max-width:64ch">${T.desc}</p></div>
      <div class="sel-tools"><button class="btn ghost" id="fcQuick">${TT("速记速查 →", "Flashcard sheet →")}</button></div></div>
    <div class="scope"><div><div class="big">${pd.length}</div><div class="lbl">本次范围的药物</div></div><div><div class="big">${n}</div><div class="lbl">本板块题目</div></div>
      <div class="chips-mini">${counts.map(([k, c]) => `<span>${TYPES[k]} ${c}</span>`).join("")}</div></div>
    ${pd.length ? "" : `<p style="color:var(--rose);font-weight:800;margin-top:10px">还没有选考试范围，先回首页选择药物组。</p>`}
    ${pd.length === 1 ? `<p style="color:var(--rose);font-weight:700;margin-top:10px">${TT("现在只选了 1 种药，连线至少需要 2 种；选择题和速记卡片可以正常使用。", "Only 1 drug is selected; matching needs at least 2. Quizzes and flashcards still work.")}</p>` : ""}
    <section class="hub-sec"><div class="sec-h"><h2>${en ? "Quiz" : "选择题闯关"}</h2><span>${en ? (cfg.count ? cfg.count + " questions per game" : "Endless") : (cfg.count ? "每局 " + cfg.count + " 题" : "无尽模式")}</span></div>
      <div class="modes hub3">${T.quiz.map(([nm, ts, ds], i) => `<button class="mode" data-a="quiz" data-q="${i}" ${dis}><span class="tag">${ts.reduce((a, k) => a + bankItems(k, true).length, 0)} ${en ? "questions available" : "题可抽"}</span><h3>${nm}</h3><p>${ds}</p>${bagBadge("quiz", pd)}</button>`).join("")}</div></section>
    ${T.match.length ? `<section class="hub-sec"><div class="sec-h"><h2>${en ? "Matching" : "连线配对"}</h2><span>${en ? "connect drugs and facts" : "药物和知识点两两连上"}</span>
        <div class="hub-rounds"><span>${en ? "Rounds" : "每局轮数"}</span><div class="seg" id="mrSeg">${[3, 5, 8, 0].map(v => `<button data-v="${v}" aria-pressed="${(cfg.matchRounds || 0) === v}">${v ? v + " 轮" : "全部"}</button>`).join("")}</div></div></div>
      <div class="modes hub4">${T.match.map(([k, nm]) => `<button class="mode${k === "mia" ? " new-k" : ""}" data-a="match" data-k="${k}" ${mdis(k)}>${k === "mia" ? `<span class="new-dot">${en ? "NEW" : "新"}</span>` : ""}<span class="tag mr-tag" data-k="${k}">${mrTag(k)}</span><h3>${nm}</h3><p>${matchDesc(k)}</p>${bagBadge("match_" + k, k === "mia" ? pd.filter(hasFacts) : pd)}</button>`).join("")}</div></section>` : ""}
    <section class="hub-sec"><div class="sec-h"><h2>${en ? "Self-test" : "速记自测"}</h2><span>${en ? "cover and reveal" : "遮住答案，点一下翻开"}</span></div>
      <div class="modes hub1"><button class="mode wide" data-a="cards"><div class="wide-txt"><span class="tag">可遮住答案自测</span><h3>速记卡片</h3><p>${en ? `A quick-reference table sorted by drug group; cover the ${T.cols.map(c => FACT_EN[c]).join(", ")} column (or all of them) and tap a cell to reveal it.` : `按药物组排好的速查表，可以遮住${T.cols.map(c => FACT_NAME[c]).join("、")}中的一列或全部，点一下翻开。`}</p></div><span class="go">${en ? "Open →" : "打开 →"}</span></button></div></section>
    ${wrongHere ? `<p class="foot">${en ? `${wrongHere} mistake entries are in the current scope.` : `本次范围内有 ${wrongHere} 条错题在错题本里。`}<button class="ibtn" id="toWrong" style="margin-left:8px">${en ? "Open mistake book" : "去错题本"}</button></p>` : ""}`,
  () => {
    const sg = $("#mrSeg");
    if (sg) sg.querySelectorAll("button").forEach(b => b.onclick = () => { cfg.matchRounds = +b.dataset.v; save(); SFX.click(); sg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); main.querySelectorAll(".mr-tag").forEach(x => x.textContent = mrTag(x.dataset.k)); });
    $("#fcQuick").onclick = () => { SFX.pick(); PG.factCards(t); };
    const tw = $("#toWrong"); if (tw) tw.onclick = () => { SFX.click(); PG.codex("wrong"); };
    main.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
      SFX.pick(); const a = b.dataset.a;
      if (a === "quiz") { const [nm, ts] = T.quiz[+b.dataset.q]; PG.startQuiz(null, { mode: t, types: ts, title: nm }); }
      else if (a === "match") PG.startMatch({ kind: b.dataset.k });
      else PG.factCards(t);
    });
  });
}
export function factCards(t, showAll = false, cover = "") {
  const T = TOPIC[t];
  show(`<div class="sel-head"><div><div class="eyebrow">${LANG === "en" ? "Flashcards · quick reference" : "速记卡片 · " + T.title}</div><h2 style="font-size:28px">${LANG === "en" ? "Mechanisms · indications · adverse effects" : T.title + "速查"}</h2></div>
      <div class="sel-tools"><button class="ibtn" id="fcBack">返回板块</button></div></div>
    <div id="fcHost"></div>`,
  () => {
    $("#fcBack").onclick = () => { SFX.click(); PG.topicHub(t); };
    renderFactSheet($("#fcHost"), t, showAll, cover);
  });
}
/* 速记卡片表（专项板块、药物图鉴的“速记速查”标签共用）：搜索、遮住某一列自测、本次范围 / 全部 */
export function renderFactSheet(host, t = "core", showAll = false, cover = "") {
  const T = TOPIC[t];
  host.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <input class="search" id="fq" type="search" placeholder="搜索药名、机制、适应证或不良反应…" style="flex:1 1 240px;margin-top:0">
      <div class="seg" id="fcov"><button data-c="" aria-pressed="${!cover}">全部显示</button>${T.cols.map(c => `<button data-c="${c}" aria-pressed="${cover === c}">${LANG === "en" ? "Cover " + FACT_EN[c] : "遮住" + FACT_NAME[c]}</button>`).join("")}<button data-c="all" aria-pressed="${cover === "all"}">${LANG === "en" ? "Cover all" : "遮住全部"}</button></div>
      <button class="ibtn ${showAll ? "on" : ""}" id="fall">${showAll ? `显示：全部 ${G.length} 组` : "显示：本次范围"}</button></div>
    <p class="foot" style="margin-top:8px">遮住后点灰色格子翻开，再点一次重新遮住。</p>
    <div id="flist"></div>`;
  const q = sel => host.querySelector(sel);
  // 切换遮挡 / 范围只重画下方列表，不重画整页，滚动位置保持不变
  q("#fall").onclick = () => { SFX.click(); showAll = !showAll; const b = q("#fall"); b.classList.toggle("on", showAll); b.textContent = showAll ? `显示：全部 ${G.length} 组` : "显示：本次范围"; render(); };
  q("#fcov").querySelectorAll("button").forEach(b => b.onclick = () => {
    SFX.click(); cover = b.dataset.c;
    q("#fcov").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    render();
  });
  const render = () => {
    const kw = q("#fq").value.trim().toLowerCase(), gs = showAll ? G : poolGroups();
    const html = gs.map(g => {
      const ds = g.drugs.map(a => DM.get(a[0])).filter(d => !kw || (d.en + d.cn + d.zh + Object.values(fact(d)).join("")).toLowerCase().includes(kw));
      if (!ds.length) return "";
      return `<div class="fgroup"><div class="fgh"><span class="id">#${g.dot || g.id}</span><b>${esc(g.n)}${packTag(g)}</b><span class="fga">${g.m ? "组共同机制：" + esc(g.m) : ""}${g.a ? `${g.m ? "<br>" : ""}组共同不良反应：${esc(g.a)}` : ""}</span></div>
        <div class="table-wrap"><table class="ftable${T.cols.length > 2 ? " c3" : ""}"><thead><tr><th>药物</th>${T.cols.map(c => `<th>${FACT_NAME[c]}</th>`).join("")}</tr></thead><tbody>
        ${ds.map(d => `<tr><td class="nm"><b>${esc(d.cn)}</b><span>${esc(enAlt(d))}</span></td>${T.cols.map(c => `<td class="${cover === c || cover === "all" ? "cover" : ""}">${esc(fact(d)[c])}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
    }).join("");
    q("#flist").innerHTML = html || `<p class="empty">${gs.length ? "没有匹配的药物。" : "还没有选择考试范围。"}</p>`;
    q("#flist").querySelectorAll("td.cover").forEach(td => td.onclick = () => { td.classList.toggle("open"); SFX.pick(); });
  };
  q("#fq").addEventListener("input", render); render();
}
