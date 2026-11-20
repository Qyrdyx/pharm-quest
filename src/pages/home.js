/* 药理闯关 · 首页 */
import { PG, reg } from "../core/registry.js";
import { $, TT, esc, pick } from "../core/utils.js";
import { LS } from "../core/storage.js";
import { CLASSES, G } from "../data/index.js";
import { cfg, mastery, masteryOf, poolDrugs, poolGroups, stats, wrong } from "../core/state.js";
import { SFX } from "../music/sfx.js";
import { L, mascotHTML, mood } from "../ui/mascot.js";
import { wrongDrugs } from "../records/wrong.js";
import { armConfirm, armLang, main, show } from "../ui/screen.js";
import { bagBadge, bagResetAll } from "../records/rotation.js";
import { packs } from "../data/packs.js";

reg({ roundsLabel: () => roundsLabel, TOOL_ICON: () => TOOL_ICON, hmMini: () => hmMini, decoSVG: () => decoSVG });
Object.assign(PG, { home });   // 页面跳转函数：core/nav.js 会包一层，记录返回路径

export const roundsLabel = () => cfg.matchRounds ? cfg.matchRounds + " 轮" : "全部轮";
/* ---------- 首页 ---------- */
export function home() {
  const pg = poolGroups(), pd = poolDrugs();
  const acc = stats.answered ? Math.round(stats.correct / stats.answered * 100) : 0;
  const wc = Object.keys(wrong).length;
  show(`
  <div class="hero">${mascotHTML("idle")}
    <div><div class="eyebrow">Dentistry Pharmacology · Grouped Memory Game</div>
      <h1>${T("按<em>药物组</em>闯关，<br>186 种药一个个拿下", "Level up by <em>drug group</em>,<br>master all 186 drugs")}</h1>
      <p>先选这次要考的记忆单元，再挑一种玩法。答错的药会进错题本，答对一次就消掉一次。</p>
      <div class="lang-pick seg" data-zh><button data-lang="zh" aria-pressed="${LANG !== "en"}">中文</button><button data-lang="en" aria-pressed="${LANG === "en"}">English</button></div></div>
  </div>
  <div class="scope">
    <div><div class="big">${pg.length}<span style="font-size:15px;color:var(--mute)"> / ${G.length}</span></div><div class="lbl">本次考的药物组</div></div>
    <div><div class="big">${pd.length}</div><div class="lbl">种药物</div></div>
    <div class="chips-mini">${pg.length === G.length ? `<span>全部 ${new Set(G.map(g => g.ch)).size} 章</span>` : pg.slice(0, 18).map(g => `<span>#${g.id} ${esc(g.n)}</span>`).join("") + (pg.length > 18 ? `<span>…另 ${pg.length - 18} 组</span>` : "")}</div>
    <button class="btn" id="goSel">选择考试范围</button>
  </div>
  ${pd.length ? "" : `<p style="color:var(--rose);font-weight:800;margin-top:10px">还没有选药物组，先点“选择考试范围”。</p>`}
  ${PG.backupBanner()}
  ${PG.achHomeStrip ? PG.achHomeStrip() : ""}
  <div class="sec-h"><h2>开始闯关</h2><span>四种主玩法</span><button class="ibtn sec-act" id="bagResetHome" title="各玩法的“本轮已考”清零，从头开始新一轮">↺ 重置轮换记录</button></div>
  <div class="modes home-play">
    <button class="mode" data-m="quiz" ${pd.length ? "" : "disabled"}><span class="tag">${cfg.count === 0 ? "无尽" : cfg.count + " 题"} · ${cfg.lives === 0 ? "不限命" : cfg.lives + " 条命"}</span><h3>查房问答</h3><p>多种题型混合：中英名、归组、机制、适应证、牙科要点、找不同、判断。</p>${bagBadge("quiz", pd)}${decoSVG(0)}</button>
    <button class="mode" data-m="sort" ${pd.length ? "" : "disabled"}><span class="tag">限时 60 秒</span><h3>药柜分拣</h3><p>药丸一个个掉下来，放进正确的药物组抽屉。答对加时，答错扣时。</p>${bagBadge("sort", pd)}${decoSVG(1)}</button>
    <button class="mode" data-m="match" ${pd.length >= 2 ? "" : "disabled"}><span class="tag">${roundsLabel()} · ${LANG === "en" ? "6 pairs per round" : "每轮 6 对"}</span><h3>中英配对</h3><p>左边 INN，右边中文名，两两连上。比速度，也比失误数。</p>${bagBadge("match_cn", pd)}${decoSVG(2)}</button>
    <button class="mode" data-m="case"><span class="tag">${PG.CASES.length} 个病例</span><h3>病例诊室</h3><p>接诊 Q 版病人，看监护仪、化验单和牙位图，一步步选药。</p>${decoSVG(4)}</button>
  </div>
  <div class="sec-h"><h2>专项练习</h2><span>针对性地补短板</span></div>
  <div class="modes home-focus">
    <button class="mode rec" data-m="core"><span class="rec-tag">★ ${TT("作者强烈推荐", "Author's top pick")}</span><span class="tag">混合闯关 · 连线 · 速记卡</span><h3 class="long">机制·适应证·不良反应</h3><p>每种药怎么起作用、治什么、会出什么问题。</p>${decoSVG(6)}</button>
    <button class="mode" data-m="cls"><span class="tag">${CLASSES.length} 类 · 可混合</span><h3>同类药物辨析</h3><p>同一大类里“长得像但不一样”的药：对比表、特点辨认、场景选药。</p>${decoSVG(7)}</button>
    <button class="mode" data-m="spell"><span class="tag">英写中 / 中写英</span><h3>中英默写</h3><p>看 INN 写中文，或看中文写 INN。动手写一遍记得更牢。</p>${bagBadge("spell", PG.spellPool())}${decoSVG(5)}</button>
    <button class="mode" data-m="hot"><span class="tag">${TT(`高频 ${PG.hotList().length} · 选择题错题 ${wrongDrugs().length} · 连线错题 ${PG.mwKinds().length ? PG.mwDrugs("all").length : 0}`, `Frequent ${PG.hotList().length} · quiz ${wrongDrugs().length} · matching ${PG.mwKinds().length ? PG.mwDrugs("all").length : 0}`)}</span><h3>${TT("错题专练", "Mistake drills")}</h3><p>${TT("选择题错题、连线错题、反复答错的高频药，都在这里集中练。", "Quiz mistakes, matching mistakes and frequently missed drugs — all drilled here.")}</p>${decoSVG(3)}</button>
  </div>
  <div class="sec-h" id="rxSec"><h2>${TT("处方书写", "Prescription writing")}</h2><span>${TT("按俄罗斯标准写拉丁文处方", "Latin prescriptions, Russian style")}</span></div>
  <div class="modes home-rx" id="rxHome"><button class="mode" data-m="rx"><span class="tag">${TT(`${PG.RX_N || 25} 种常用药 · 片 / 胶囊 / 注射液 / 溶液 / 软膏`, `${PG.RX_N || 25} common drugs · tablets / capsules / injections / solutions / ointments`)}</span><h3>${TT("处方书写练习", "Prescription practice")}</h3><p>${TT("Rp.、D. t. d. N.、S. 一行一行写对：拉丁文第二格、逗号小数、写清用法；还有处方找错和写法速查。", "Get Rp., D. t. d. N. and S. right line by line — Latin genitive, decimal commas, clear directions — plus spot-the-mistake and a quick reference.")}</p></button></div>
  <div class="sec-h"><h2>AI 出题</h2><span>用你自己的 API 密钥生成新题</span></div>
  <div class="modes home-ai"><button class="mode" data-m="ai"><span class="tag">${PG.aiBank.length ? "AI 题库 " + PG.aiBank.length + " 题" : "还没有生成题目"} · ${PG.aiCfg.key ? esc((PG.AI_PROVIDERS[PG.aiCfg.provider] || {}).name || "") : "未设置密钥"}</span><h3>AI 出题专题</h3><p>接入 Claude、DeepSeek、通义千问、Kimi 等模型，按考试范围或高频错误自动出题；生成的题单独存放，可以反复练习。</p>${decoSVG(8)}</button></div>
  ${packHome()}
  ${PG.RHY_TRACKS ? `<button class="rock-home" data-m="rhythm" id="rockHome">
    <span class="rock-art" aria-hidden="true"><svg viewBox="0 0 120 60"><path class="ecg" d="M0 34 H30 L36 34 L42 10 L50 52 L56 26 L62 34 H120"/></svg></span>
    <span class="rock-txt"><b>${TT("摇滚医生", "Rock Doctor")}<span class="rock-beta">${TT("测试版", "Beta")}</span></b><small>${TT("踩着鼓点把药丸放进正确的药物组抽屉。真鼓、真吉他，连击越高，乐队越完整。", "Drop each pill into the right drug-group drawer on the beat. Real drums and guitars — the higher your combo, the fuller the band.")}</small></span>
    <span class="rock-songs">${(PG.RHY_TRACKS || []).map(t => `<span>${esc(TT(t.name[0], t.name[1]))}<small>${TT(t.level[0], t.level[1])}</small></span>`).join("")}</span>
    <span class="rock-arrow" aria-hidden="true">›</span></button>` : ""}
  <div class="sec-h"><h2>学习工具</h2><span>查资料、看进度</span></div>
  <div class="home-tools five">
    <button class="tool" data-m="codex">${TOOL_ICON.book}<span><b>药物图鉴</b><small>${wc ? wc + " 条错题待复习" : "按记忆单元浏览全部药物"}</small></span></button>
    <button class="tool" data-m="cards" id="fcTool">${TOOL_ICON.cards}<span><b>${TT("速记速查", "Flashcard sheet")}</b><small>${TT("机制·适应证·不良反应，可遮住自测", "Cover & reveal self-test")}</small></span></button>
    ${cfg.ach === 0 ? "" : `<button class="tool" data-m="ach" id="achTool">${TOOL_ICON.trophy}<span><b>${TT("成就与收集", "Achievements")}</b><small>${TT(`成就 ${PG.ACH.filter(a => PG.achState()[a[0]]).length}/${PG.ACH.length} · 闪卡 ${PG.shinyCount()}`, `${PG.ACH.filter(a => PG.achState()[a[0]]).length}/${PG.ACH.length} · ${PG.shinyCount()} shiny`)}</small></span></button>`}
    <button class="tool" data-m="mastery">${TOOL_ICON.grid}<span><b>掌握度热力图</b><small>${G.filter(g => mastery[g.id]?.a).length} / ${G.length} 组已练</small></span></button>
    <button class="tool" data-m="bank">${TOOL_ICON.list}<span><b>题库总览</b><small>共 ${PG.BANK_TYPES.reduce((a, t) => a + PG.bankItems(t, false).length, 0)} 题</small></span></button>
    <button class="tool" data-m="backup">${TOOL_ICON.save}<span><b>${TT("数据备份", "Backup")}</b><small>${PG.backupInfo().t ? TT("上次 ", "Last ") + new Date(PG.backupInfo().t).toLocaleDateString() : TT("还没有备份过", "Never backed up")}</small></span></button>
  </div>
  <div class="statsrow">
    <span>已玩 <b>${stats.games}</b> 局</span><span>累计答题 <b>${stats.answered}</b></span><span>正确率 <b>${acc}%</b></span>
    <span>最高连击 <b>${stats.bestCombo}</b></span><span>问答最高 <b>${stats.best.quiz}</b></span><span>分拣最高 <b>${stats.best.sort}</b></span><span>配对最高 <b>${stats.best.match}</b></span><span>病例最高 <b>${stats.best.case || 0}</b></span>
  </div>
  <div id="fbHome"><div class="sec-h"><h2>${TT("意见反馈", "Feedback")}</h2><span>${TT("报错、提建议，直接发给作者", "Bugs and ideas, straight to the author")}</span></div>
  <button class="fb-home" data-m="feedback"><span class="fb-ico" aria-hidden="true">✉</span><span><b>${TT("给作者发意见 / 报错", "Send feedback or a bug report")}</b><small>${TT(`一键整理出错记录${PG.errLog().length ? "（" + PG.errLog().length + " 条）" : ""}和错题，发邮件到 qyrdyx1@gmail.com`, `Bundle the error log${PG.errLog().length ? " (" + PG.errLog().length + ")" : ""} and your mistakes into an email to qyrdyx1@gmail.com`)}</small></span><span class="rock-arrow" aria-hidden="true">›</span></button></div>
  <p class="foot">题库按老师要求整理：Classification · INN · Mechanism · Indications · Contraindications · Dentistry；抗感染与消毒组另含抗菌谱与负面效应。内容与讲义不一致时以讲义为准。</p>
  <p class="tca-sign">MADE BY 红烧肉大王TCA · 药理闯关</p>`,
  () => {
    const m = $(".hero .mascot"); setTimeout(() => mood(m, "happy", pick(L().start), 2200), 300);
    $("#goSel").onclick = () => { SFX.click(); PG.selector(); };
    const bn = $("#bkNow");
    if (bn) {
      bn.onclick = () => { SFX.click(); PG.ioSheet("full", "export", () => { if (main.querySelector(".hero")) PG.home(); }); };
      $("#bkLater").onclick = () => { SFX.click(); const m = PG.backupInfo(); m.snooze = Date.now() + 3 * 864e5; LS.set("bkMeta", m); const b = $(".bk-banner"); if (b) b.remove(); };
    }
    main.querySelectorAll(".lang-pick [data-lang]").forEach(b => b.onclick = () => { if (b.dataset.lang === LANG) return; armLang(b, b.dataset.lang); });
    bindPackHome();
    if (PG.bindAchStrip) PG.bindAchStrip(main);
    setTimeout(() => { try { PG.achCheck(null); } catch (e) {} }, 900);   // 备份、导入歌曲、扩展包这类成就在回首页时补查
    armConfirm($("#bagResetHome"), "再点一次确认重置", () => { bagResetAll(); SFX.click(); PG.home(); });
    main.querySelectorAll("[data-m]").forEach(b => b.onclick = () => {
      SFX.pick(); const k = b.dataset.m;
      if (k === "rx") PG.rxHub(); else if (k === "feedback") PG.feedbackPage(); else if (k === "rhythm") PG.rhythmHub(); else if (k === "quiz") PG.startQuiz(); else if (k === "sort") PG.startSort(); else if (k === "match") PG.startMatch(); else if (k === "case") PG.caseMenu(); else if (k === "mastery" || k === "bank") PG.codex(k); else if (k === "core") PG.topicHub("core"); else if (k === "cls") PG.classHub(); else if (k === "spell") PG.spellHub(); else if (k === "hot") PG.hotHub(); else if (k === "ai") PG.aiHub(); else if (k === "backup") PG.backupSheet(); else if (k === "cards") PG.codex("cards"); else if (k === "ach") PG.achPage(); else PG.codex("dex");
    });
  });
}
/* ---------- 首页的题库扩展包板块：已装的包一览 + 导入 / 新建 / AI 生成 ---------- */
function packHome() {
  const list = packs();
  const card = p => {
    const nd = p.groups.reduce((s, g) => s + g.drugs.length, 0), on = p.groups.filter(g => PG.sel.has(g.id)).length;
    const tag = p.official ? `<span class="pk-tag off">${TT("官方审核", "Official")}</span>` : p.ai ? `<span class="pk-tag ${p.reviewed ? "aio" : "ai"}">${p.reviewed ? TT("AI·已审核", "AI · reviewed") : TT("AI·未审核", "AI · unreviewed")}</span>` : `<span class="pk-tag">${TT("扩展", "Pack")}</span>`;
    return `<div class="pk-card"><b>${esc(p.name)}${tag}</b><small>${esc(p.ch)} · ${p.groups.length} ${TT("组", "groups")} · ${nd} ${TT("种药", "drugs")} · ${TT(`本次范围 ${on} 组`, `${on} in scope`)}${p.author ? " · " + esc(p.author) : ""}</small>
      <span class="pk-cg">${p.groups.slice(0, 6).map(g => `<span>${esc(g.n)}</span>`).join("")}${p.groups.length > 6 ? `<span>…+${p.groups.length - 6}</span>` : ""}</span>
      <span class="pk-btns"><button class="ibtn" data-pk-play="${p.id}">${TT("只练这个包", "Practice this pack")}</button><button class="ibtn" data-pk-edit="${p.id}">${TT("编辑", "Edit")}</button><button class="ibtn" data-pk-chk="${p.id}">${TT("AI 自查", "AI check")}</button>${p.ai && !p.reviewed ? `<button class="ibtn" data-pk-rev="${p.id}">${TT("标为已审核", "Mark reviewed")}</button>` : ""}<button class="ibtn pk-del" data-pk-del="${p.id}">${TT("删除", "Delete")}</button></span></div>`;
  };
  return `<div id="pkHome"><div class="sec-h"><h2>${TT("题库扩展包", "Question-bank packs")}</h2><span>${TT("自己 DIY 药物组，或让 AI 根据讲义整理", "DIY drug groups, or let AI build them from notes")}</span></div>
  <div class="pk-home"><div class="pk-home-top"><p>${TT("扩展包是自己或同学整理的药物组。并入后成为新的一章，和内置分组一样参加查房问答、分拣、连线、默写、同类辨析、速记卡片、图鉴、热力图和错题本。AI 生成的组会一直标着「AI·未审核」，核对后再标为已审核。", "Packs are drug groups written by you or friends. Once added they become a new chapter and join every mode like built-in groups. AI-generated groups stay marked “AI · unreviewed” until you check them.")}</p>
    <div class="pk-home-acts"><button class="btn" id="pkhNew">${TT("✎ 可视化新建", "✎ New in editor")}</button><button class="btn ghost" id="pkhManage">${TT("导入 / 管理", "Import / manage")}</button><button class="btn ghost" id="pkhAi">${TT("AI 生成", "Generate with AI")}</button>${PG.catalog().length ? `<button class="btn ghost" id="pkhCat">${TT(`官方合集（${PG.catalog().length}）`, `Official collection (${PG.catalog().length})`)}</button>` : ""}</div></div>
    ${list.length ? `<div class="pk-cards">${list.map(card).join("")}</div>` : `<p class="pk-empty">${TT("还没有扩展包。可以用可视化编辑器一格一格填，也可以导入同学发来的 JSON 文件。", "No packs yet. Fill one in with the visual editor, or import a JSON file from a friend.")}</p>`}</div></div>`;
}
function bindPackHome() {
  const b = id => main.querySelector("#" + id);
  if (!b("pkhNew")) return;
  b("pkhNew").onclick = () => { SFX.pick(); PG.packEditor(); };
  b("pkhManage").onclick = () => { SFX.click(); PG.packSheet(); };
  if (b("pkhCat")) b("pkhCat").onclick = () => { SFX.click(); PG.packSheet(); setTimeout(() => { const h = document.querySelector("#pkCatH"); if (h) h.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80); };
  b("pkhAi").onclick = () => { SFX.click(); PG.aiGen(); setTimeout(() => { const el = main.querySelector("#aiPackBox"); if (el) el.scrollIntoView({ behavior: "smooth" }); }, 200); };
  main.querySelectorAll("[data-pk-edit]").forEach(x => x.onclick = e => { e.stopPropagation(); SFX.click(); const p = packs().find(q => q.id === x.dataset.pkEdit); if (p) PG.packEditor({ edit: p }); });
  main.querySelectorAll("[data-pk-del]").forEach(x => armConfirm(x, TT("再点一次删除（连同学习记录）", "Tap again to delete (with records)"), () => {
    const p = packs().find(q => q.id === x.dataset.pkDel); if (!p) return;
    PG.purgeRecords(p.groups.flatMap(g => g.drugs.map(d => d.no)), p.groups.map(g => g.id)); PG.removePackStore(p.id);
    PG.reloadWith(TT("已删除扩展包：", "Deleted pack: ") + p.name);
  }));
  main.querySelectorAll("[data-pk-chk]").forEach(x => x.onclick = e => { e.stopPropagation(); SFX.click(); PG.packReviewSheet(x.dataset.pkChk); });
  main.querySelectorAll("[data-pk-rev]").forEach(x => armConfirm(x, TT("确认逐条核对过了？再点一次", "Checked every item? Tap again"), () => { PG.setPackReviewed(x.dataset.pkRev); PG.reloadWith(TT("已标为已审核", "Marked as reviewed")); }));
  main.querySelectorAll("[data-pk-play]").forEach(x => x.onclick = e => {
    e.stopPropagation(); SFX.pick(); const p = packs().find(q => q.id === x.dataset.pkPlay); if (!p) return;
    const gs = p.groups.map(g => PG.GM.get(g.id)).filter(Boolean); if (gs.length) PG.startQuiz(PG.groupDrugs(gs), { title: p.name });
  });
}
export const TOOL_ICON = {
  trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8.5 20h7M10 17h4v3h-4z"/></svg>',
  cards: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/><path d="M6.5 11h7M6.5 15h4"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 12h5"/></svg>',
  grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="4" cy="18" r="1.2"/></svg>',
  save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h11l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-2z"/><path d="M8 3v5h7V3"/><rect x="7.5" y="13" width="9" height="6" rx="1"/></svg>'
};
export function hmMini() {
  const cells = G.slice(0, 16).map((g, i) => `<rect x="${8 + (i % 4) * 17}" y="${8 + Math.floor(i / 4) * 17}" width="14" height="14" rx="3" fill="${mastery[g.id]?.a ? PG.mColor(masteryOf(g.id)) : ["#ef6a52", "#f4bf4f", "#5fd6a8", "#86cbff"][i % 4]}"/>`).join("");
  return `<svg class="deco" viewBox="0 0 80 80">${cells}</svg>`;
}
export function decoSVG(i) {
  const s = [
    `<svg class="deco" viewBox="0 0 80 80"><rect x="10" y="30" width="60" height="22" rx="11" fill="#ef6a52"/><rect x="40" y="30" width="30" height="22" rx="11" fill="#f7ecd9"/><rect x="40" y="30" width="12" height="22" fill="#f7ecd9"/></svg>`,
    `<svg class="deco" viewBox="0 0 80 80"><rect x="8" y="8" width="64" height="64" rx="6" fill="#c9a77d"/><rect x="14" y="14" width="24" height="24" rx="3" fill="#8a6a49"/><rect x="42" y="14" width="24" height="24" rx="3" fill="#8a6a49"/><rect x="14" y="42" width="24" height="24" rx="3" fill="#8a6a49"/><rect x="42" y="42" width="24" height="24" rx="3" fill="#8a6a49"/></svg>`,
    `<svg class="deco" viewBox="0 0 80 80"><rect x="6" y="14" width="28" height="16" rx="5" fill="#86cbff"/><rect x="46" y="48" width="28" height="16" rx="5" fill="#5fd6a8"/><path d="M34 22 C 50 22, 30 56, 46 56" stroke="#f4bf4f" stroke-width="4" fill="none"/></svg>`,
    `<svg class="deco" viewBox="0 0 80 80"><path d="M4 44 h14 l6 -16 8 30 6 -14 h38" stroke="#5fd6a8" stroke-width="5" fill="none" stroke-linejoin="round"/></svg>`,
    `<svg class="deco" viewBox="0 0 80 80"><rect x="14" y="10" width="46" height="60" rx="4" fill="#f7ecd9"/><path d="M22 24h30M22 34h30M22 44h30M22 54h20" stroke="#0a1a20" stroke-width="3"/><circle cx="60" cy="60" r="12" fill="none" stroke="#f4bf4f" stroke-width="4"/><path d="M68 68l8 8" stroke="#f4bf4f" stroke-width="4"/></svg>`,
    `<svg class="deco" viewBox="0 0 80 80"><rect x="14" y="10" width="46" height="60" rx="4" fill="#f7ecd9"/><rect x="20" y="10" width="6" height="60" fill="#ef6a52"/><path d="M32 26h20M32 36h20M32 46h14" stroke="#0a1a20" stroke-width="3"/></svg>`,
    `<svg class="deco" viewBox="0 0 80 80"><path d="M40 12 L64 26 L64 54 L40 68 L16 54 L16 26 Z" fill="none" stroke="#86cbff" stroke-width="4"/><path d="M40 22 L56 31 L56 49 L40 58 L24 49 L24 31 Z" fill="none" stroke="#86cbff" stroke-width="2" opacity=".6"/><circle cx="40" cy="12" r="6" fill="#ef6a52"/><circle cx="64" cy="54" r="6" fill="#f4bf4f"/><circle cx="16" cy="54" r="6" fill="#5fd6a8"/></svg>`,
    `<svg class="deco" viewBox="0 0 80 80"><path d="M40 10 V66 M24 66 H56 M14 22 H66" stroke="#f4bf4f" stroke-width="4" stroke-linecap="round"/><path d="M14 22 L4 44 H24 Z M66 22 L56 44 H76 Z" fill="#f7ecd9" stroke="#f7ecd9" stroke-width="2" stroke-linejoin="round"/><circle cx="40" cy="10" r="5" fill="#ef6a52"/></svg>`,
    `<svg class="deco" viewBox="0 0 80 80"><rect x="22" y="22" width="36" height="36" rx="6" fill="none" stroke="#5fd6a8" stroke-width="4"/><path d="M30 14v8M40 14v8M50 14v8M30 58v8M40 58v8M50 58v8M14 30h8M14 40h8M14 50h8M58 30h8M58 40h8M58 50h8" stroke="#5fd6a8" stroke-width="3"/><path d="M40 28 L43 37 L52 40 L43 43 L40 52 L37 43 L28 40 L37 37 Z" fill="#f4bf4f"/></svg>`
  ];
  return s[i];
}
