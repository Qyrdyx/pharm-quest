/* 药理闯关 · 扩展包可视化编辑器：不用写 JSON，一格一格填药物组和药；可以新建、改 AI 生成的预览、改已经并入的扩展包
 * 草稿存在 pg_packDraft（关掉页面也不丢）；编辑已装的包时带着原来的组 / 药编号，保存后学习记录不丢 */
import { PG, reg } from "../core/registry.js";
import { $, TT, esc } from "../core/utils.js";
import { LS } from "../core/storage.js";
import { sel, save } from "../core/state.js";
import { PACK_LIMITS, normPack, packSample, packToJSON, packs, parsePack, updatePack } from "../data/packs.js";
import { SFX } from "../music/sfx.js";
import { armConfirm, keepY, main, show } from "../ui/screen.js";
import { popMenu } from "../ui/popmenu.js";
import { existingNames, purgeRecords, reloadWith, saveFile } from "./packs.js";

reg({ packDraftClear: () => packDraftClear });
Object.assign(PG, { packEditor });   // 页面跳转函数：core/nav.js 会包一层，记录返回路径

const GF = [["m", "机制", "Mechanism"], ["i", "适应证", "Indications"], ["a", "不良反应", "Adverse effects"], ["c", "禁忌", "Contraindications"], ["d", "牙科 / 口腔应用", "Dental use"], ["s", "抗菌谱（抗感染药才写）", "Spectrum (anti-infectives)"]];
const DF = [["m", "机制", "Mechanism"], ["i", "适应证", "Indications"], ["a", "不良反应", "Adverse effects"]];
const blankDrug = () => ({ zh: "", en: "", note: "", m: "", i: "", a: "" });
const blankGroup = () => ({ n: "", e: "", m: "", i: "", c: "", d: "", s: "", a: "", drugs: [blankDrug(), blankDrug()] });
/* 药物没单独写的字段，输入框里用灰字显示“沿用组里的”内容，免得看起来像漏填 */
const inherit = (g, k) => g[k] ? (LANG === "en" ? "Uses group: " : "沿用组里的：") + g[k].slice(0, 60) + (g[k].length > 60 ? "…" : "") : (LANG === "en" ? "Group has none either" : "组里也没写");
const filled = g => GF.filter(([k]) => g[k]).map(([, zh, e]) => LANG === "en" ? e : zh.replace(/（.*）/, "")).join(LANG === "en" ? ", " : "、");
const blankPack = () => ({ name: "", author: "", desc: "", groups: [blankGroup()] });

let D = null;            // 当前草稿：{ name, author, desc, ai, by, editId, groups:[{ n,e,m,i,c,d,s,a,_id, drugs:[{ zh,en,note,m,i,a,_no }] }] }
let saveT = 0;
const keep = () => { clearTimeout(saveT); saveT = setTimeout(() => LS.set("packDraft", D), 300); };
export function packDraftClear() { D = null; clearTimeout(saveT); LS.set("packDraft", ""); }

/* 已装的包 / 预览里的包 → 草稿（编辑已装的包时保留编号） */
function toDraft(p, keepIds) {
  return { name: p.name || "", author: p.author || "", desc: p.desc || "", ai: !!p.ai, by: p.by || "", editId: keepIds ? p.id : "",
    groups: (p.groups || []).map(g => ({ n: g.n || "", e: g.e && g.e !== g.n ? g.e : "", m: g.m || "", i: g.i || "", c: g.c || "", d: g.d || "", s: g.s || "", a: g.a || "", ...(keepIds ? { _id: g.id } : {}),
      drugs: (g.drugs || []).map(d => ({ zh: d.zh || "", en: d.en && d.en !== d.zh ? d.en : "", note: d.note || "", m: d.m || "", i: d.i || "", a: d.a || "", ...(keepIds ? { _no: d.no } : {}) })) })) };
}

/* 打开编辑器。o.edit = 已装的包；o.draft = 预览里的包（还没并入）；都没有就接着上次的草稿，或者新建 */
export function packEditor(o = {}) {
  if (!o._done) {                                   // 返回键会用同样的参数再调一次：只在第一次读参数，免得冲掉改动
    if (o.edit) D = toDraft(o.edit, true);
    else if (o.draft) D = toDraft(o.draft, false);
    else if (o.fresh || !D) { const old = LS.get("packDraft", ""); D = !o.fresh && old && Array.isArray(old.groups) ? old : blankPack(); }
    o._done = true; keep();
  }
  if (!D) D = blankPack();
  render();
}

/* 检查：每个药 / 组有什么问题。返回 { bad: Map(元素键 → 提示), n:{g,d}, list:[提示] } */
function check() {
  const names = existingNames(D.editId || ""), bad = new Map(), list = [];
  let nd = 0;
  D.groups.forEach((g, gi) => {
    const gk = "g" + gi, W = TT(`第 ${gi + 1} 组`, `Group ${gi + 1}`);
    if (!g.n.trim()) { bad.set(gk, TT("缺组名", "Missing group name")); list.push(W + TT("：缺组名", ": missing name")); }
    const seen = new Set();
    g.drugs.forEach((d, di) => {
      const dk = gk + "d" + di, zh = d.zh.trim(), en = d.en.trim(), nm = zh || en;
      if (!nm) { if (d.note || d.m || d.i || d.a) { bad.set(dk, TT("缺药名", "Missing name")); list.push(`${W} · ${di + 1}${TT("：缺药名", ": missing name")}`); } return; }
      let p = "";
      if (!(d.m || d.i || d.a || g.m || g.i || g.a)) p = TT("机制、适应证、不良反应一项都没有（这个药和组里都没写）", "No mechanism / indication / adverse effect on the drug or group");
      else if (names.has(zh) || (en && names.has(en.toLowerCase()))) p = TT("题库里已经有这个药，并入时会跳过", "Already in the bank — will be skipped");
      else if (seen.has(nm)) p = TT("同一组里重复", "Duplicate in this group");
      seen.add(nm);
      if (p) { bad.set(dk, p); list.push(`${W}「${nm}」：${p}`); } else nd++;
    });
  });
  return { bad, list, nd, ng: D.groups.filter(g => g.n.trim() && g.drugs.some(d => (d.zh || d.en).trim())).length };
}

function render() {
  const en = LANG === "en", L = (zh, e) => en ? e : zh;
  const ed = D.editId ? packs().find(p => p.id === D.editId) : null;
  if (D.editId && !ed) D.editId = "";
  const gHTML = (g, gi) => `<section class="pe-g" data-g="${gi}">
      <div class="pe-gh"><span class="pe-num">${gi + 1}</span>
        <input class="search pe-in" data-k="n" value="${esc(g.n)}" placeholder="${L("组名（必填），如：质子泵抑制剂", "Group name (required)")}" maxlength="40">
        <input class="search pe-in pe-en" data-k="e" value="${esc(g.e)}" placeholder="${L("英文组名（可选）", "English name (optional)")}" maxlength="60">
        <span class="pe-tools"><button class="ibtn" data-act="gup" ${gi ? "" : "disabled"} title="${L("上移", "Move up")}">↑</button><button class="ibtn" data-act="gdown" ${gi < D.groups.length - 1 ? "" : "disabled"} title="${L("下移", "Move down")}">↓</button><button class="ibtn" data-act="gdel">${L("删除这组", "Delete group")}</button></span></div>
      <p class="pe-err" data-err="g${gi}"></p>
      <details class="pe-gf" ${g.m || g.i || g.a ? "" : "open"}><summary>${L("这一组的共同要点", "Shared points of this group")} <small>${L("（组里的药没单独写的，就用这里的）", "(used for drugs that don't have their own)")}</small> <small class="pe-filled" data-filled="${gi}">${filled(g) ? L("已写：", "Filled: ") + filled(g) : L("还没写", "Empty")}</small></summary>
        <div class="pe-grid">${GF.map(([k, zh, e]) => `<label>${L(zh, e)}<textarea class="search pe-in" data-k="${k}" rows="2" maxlength="${PACK_LIMITS.text}">${esc(g[k] || "")}</textarea></label>`).join("")}</div></details>
      <div class="pe-ds">
        <div class="pe-dh"><span></span><span>${L("中文名", "Chinese name")}</span><span>${L("英文名 / INN", "English / INN")}</span><span>${L("区分要点（和同组药不一样的地方）", "Distinguishing point")}</span><span></span></div>
        ${g.drugs.map((d, di) => `<div class="pe-d" data-d="${di}">
          <span class="pe-dn">${di + 1}</span>
          <input class="search pe-in" data-dk="zh" value="${esc(d.zh)}" placeholder="${L("如：奥美拉唑", "e.g. 奥美拉唑")}" maxlength="40" aria-label="${L("中文名", "Chinese name")}">
          <input class="search pe-in" data-dk="en" value="${esc(d.en)}" placeholder="Omeprazole" maxlength="60" aria-label="${L("英文名", "English name")}">
          <input class="search pe-in" data-dk="note" value="${esc(d.note)}" placeholder="${L("不要写药名本身", "Don't include the drug's name")}" maxlength="${PACK_LIMITS.text}" aria-label="${L("区分要点", "Distinguishing point")}">
          <span class="pe-dt">
            ${D.groups.length > 1 ? `<button type="button" class="ibtn pe-mvb" data-act="dmove" aria-haspopup="menu">${L("移到 ▾", "Move ▾")}</button>` : ""}
            <button class="ibtn" data-act="dup" ${di ? "" : "disabled"} title="${L("上移", "Move up")}">↑</button><button class="pk-x" data-act="ddel" title="${L("删掉这个药", "Delete drug")}" aria-label="${L("删掉这个药", "Delete drug")}">×</button></span>
          <details class="pe-own" ${d.m || d.i || d.a ? "open" : ""}><summary>${L("单独写这个药的机制 / 适应证 / 不良反应（和组里不同时才写；空着的格子沿用组里的）", "Own mechanism / indication / adverse effect (only if different; empty boxes use the group's)")}</summary>
            <div class="pe-grid">${DF.map(([k, zh, e]) => `<label>${L(zh, e)}<input class="search pe-in" data-dk="${k}" value="${esc(d[k] || "")}" placeholder="${esc(inherit(g, k))}" maxlength="${PACK_LIMITS.text}"></label>`).join("")}</div></details>
          <p class="pe-err" data-err="g${gi}d${di}"></p></div>`).join("")}
        <button class="ibtn pe-add" data-act="dadd">${L("＋ 加一种药", "+ Add a drug")}</button></div></section>`;
  show(`<div class="sel-head"><div><div class="eyebrow">${L("题库扩展包 · 可视化编辑器", "Question-bank pack · visual editor")}</div>
      <h2 style="font-size:28px">${ed ? L("编辑：", "Edit: ") + esc(ed.name) : L("新建扩展包", "New pack")}${D.ai ? ` <span class="pk-tag ai">${ed && ed.reviewed ? L("AI·已审核", "AI · reviewed") : L("AI 生成", "AI-generated")}</span>` : ""}</h2>
      <p style="color:var(--mute);margin:6px 0 0;max-width:70ch">${L("一个扩展包 = 几个药物组，每组几种药。组里写这一组共同的机制、适应证、不良反应，每种药写名字和区分要点就够了；某个药和组里不一样时，再展开单独写。改动会自动存成草稿。", "A pack holds a few drug groups. Write the shared mechanism / indication / adverse effects on the group, then each drug's name and distinguishing point; expand a drug only when it differs. Changes are saved as a draft automatically.")}</p></div>
      <div class="sel-tools"><button class="ibtn" id="peSheet">${L("扩展包管理", "Manage packs")}</button></div></div>
    ${ed ? `<p class="pe-note">${L("正在修改已经并入的扩展包。保存后原来的药保留学习记录；删掉的药和组，它们的错题、掌握度记录会一起清掉。", "You're editing an installed pack. Kept drugs keep their records; deleted drugs and groups lose theirs.")}${ed.ai && !ed.reviewed ? L(" 这是 AI 生成的包，改完核对无误后可以在扩展包管理里点“标为已审核”。", " This pack is AI-generated; once checked, mark it reviewed in Manage packs.") : ""}</p>` : ""}
    <div class="aibox pe-meta"><div class="ai-form">
      <label>${L("扩展包名（会成为一章的标题）", "Pack name (chapter title)")}<input class="search" id="peName" value="${esc(D.name)}" maxlength="40" placeholder="${L("如：抑酸药", "e.g. Antacids")}"></label>
      <label>${L("作者（可选）", "Author (optional)")}<input class="search" id="peAuthor" value="${esc(D.author)}" maxlength="40"></label>
      <label>${L("说明（可选）", "Description (optional)")}<input class="search" id="peDesc" value="${esc(D.desc)}" maxlength="120"></label></div></div>
    <div id="peGroups">${D.groups.map(gHTML).join("")}</div>
    <div class="io-row"><button class="btn ghost" id="peAddG">${L("＋ 加一个药物组", "+ Add a group")}</button></div>
    <div class="pe-bar" id="peBar"></div>
    <div class="io-row pe-acts">
      ${ed ? `<button class="btn" id="peSave">${L("保存修改", "Save changes")}</button>` : `<button class="btn" id="peDone">${L("检查并预览 →", "Check & preview →")}</button>`}
      <button class="ibtn" id="peExp">${L("导出 JSON 文件", "Export JSON")}</button>
      <button class="ibtn" id="peJson">${L("查看 / 粘贴 JSON", "View / paste JSON")}</button>
      ${ed ? "" : `<button class="ibtn" id="peSample">${L("载入示例", "Load sample")}</button><button class="ibtn" id="peSampleAlt">${L("载入英文示例", "Load Chinese sample")}</button>`}
      <button class="ibtn" id="peReset">${ed ? L("放弃修改", "Discard changes") : L("清空重来", "Start over")}</button></div>
    <div id="peJsonBox" hidden><textarea class="search pe-json" id="peJsonTxt" spellcheck="false"></textarea>
      <div class="io-row"><button class="btn" id="peJsonLoad">${L("用这段 JSON 替换编辑器内容", "Replace editor content with this JSON")}</button><span class="pe-msg" id="peJsonMsg"></span></div></div>
    <p class="pe-msg" id="peMsg"></p>`,
  () => {
    const msg = (t, ok) => { const m = $("#peMsg"); m.textContent = t; m.style.color = ok ? "var(--mint)" : "var(--rose)"; if (t) m.scrollIntoView({ block: "nearest" }); };
    const refresh = () => {
      const r = check();
      main.querySelectorAll("[data-err]").forEach(p => { p.textContent = r.bad.get(p.dataset.err) || ""; });
      main.querySelectorAll(".pe-g").forEach(sec => sec.classList.toggle("bad", !!r.bad.get("g" + sec.dataset.g)));
      main.querySelectorAll(".pe-d").forEach(row => row.classList.toggle("bad", !!r.bad.get(`g${row.closest(".pe-g").dataset.g}d${row.dataset.d}`)));
      $("#peBar").innerHTML = `<b>${r.ng}</b> ${TT("组", "groups")} · <b>${r.nd}</b> ${TT("种药可以并入", "drugs ready")}${r.list.length ? ` · <span style="color:var(--rose)">${r.list.length} ${TT("处要看一下", "issues")}</span>` : ` · <span style="color:var(--mint)">${TT("没有问题", "no issues")}</span>`}`;
      return r;
    };
    const redraw = () => { keep(); const yy = scrollY; render(); keepY(yy); };
    // 文字输入：只改草稿和提示，不重画（光标不跳）
    $("#peName").oninput = e => { D.name = e.target.value; keep(); };
    $("#peAuthor").oninput = e => { D.author = e.target.value; keep(); };
    $("#peDesc").oninput = e => { D.desc = e.target.value; keep(); };
    main.querySelectorAll(".pe-g").forEach(sec => {
      const gi = +sec.dataset.g, g = D.groups[gi];
      sec.querySelectorAll("[data-k]").forEach(inp => inp.oninput = () => {
        const k = inp.dataset.k; g[k] = inp.value; keep(); refresh();
        sec.querySelectorAll(`.pe-own [data-dk="${k}"]`).forEach(x => { x.placeholder = inherit(g, k); });   // 组里改了，药物格子里的灰字跟着变
        const f = sec.querySelector("[data-filled]"); if (f) f.textContent = filled(g) ? TT("已写：", "Filled: ") + filled(g) : TT("还没写", "Empty");
      });
      sec.querySelectorAll(".pe-d").forEach(row => { const d = g.drugs[+row.dataset.d]; row.querySelectorAll("[data-dk]").forEach(inp => inp.oninput = () => { d[inp.dataset.dk] = inp.value; keep(); refresh(); }); });
      sec.querySelectorAll("[data-act]").forEach(b => {
        const act = b.dataset.act, row = b.closest(".pe-d"), di = row ? +row.dataset.d : -1;
        if (act === "dmove") { b.onclick = e => { e.stopPropagation(); popMenu(b, D.groups.map((x, xi) => xi === gi ? null : { v: xi, label: `${xi + 1}. ${x.n || TT("未命名组", "Untitled")}`, hint: x.drugs.length }).filter(Boolean), v => { SFX.click(); const [d] = g.drugs.splice(di, 1); D.groups[v].drugs.push(d); redraw(); }); }; return; }
        if (act === "gdel") { armConfirm(b, TT("再点一次删除这组", "Tap again to delete"), () => { D.groups.splice(gi, 1); if (!D.groups.length) D.groups.push(blankGroup()); SFX.click(); redraw(); }); return; }
        b.onclick = () => {
          SFX.click();
          if (act === "gup" || act === "gdown") { const j = act === "gup" ? gi - 1 : gi + 1; [D.groups[gi], D.groups[j]] = [D.groups[j], D.groups[gi]]; }
          else if (act === "dadd") { if (D.groups.reduce((s, x) => s + x.drugs.length, 0) >= PACK_LIMITS.drugs) return msg(TT(`一个扩展包最多 ${PACK_LIMITS.drugs} 种药`, `At most ${PACK_LIMITS.drugs} drugs per pack`)); g.drugs.push(blankDrug()); }
          else if (act === "dup") [g.drugs[di - 1], g.drugs[di]] = [g.drugs[di], g.drugs[di - 1]];
          else if (act === "ddel") { g.drugs.splice(di, 1); if (!g.drugs.length) g.drugs.push(blankDrug()); }
          redraw();
          if (act === "dadd") { const rows = main.querySelectorAll(`.pe-g[data-g="${gi}"] .pe-d`); const last = rows[rows.length - 1]; if (last) last.querySelector("input").focus(); }
        };
      });
    });
    $("#peAddG").onclick = () => { if (D.groups.length >= PACK_LIMITS.groups) return msg(TT(`一个扩展包最多 ${PACK_LIMITS.groups} 组`, `At most ${PACK_LIMITS.groups} groups`)); SFX.click(); D.groups.push(blankGroup()); redraw(); const s = main.querySelectorAll(".pe-g"); const last = s[s.length - 1]; if (last) { last.scrollIntoView({ block: "center" }); last.querySelector("input").focus(); } };
    $("#peSheet").onclick = () => { SFX.click(); PG.packSheet(); };
    /* 草稿 → 整理好的包（和导入 JSON 走同一套检查） */
    const finalize = () => { const warn = []; const np = normPack(D, D.name.trim() || TT("我的扩展包", "My pack"), warn); return { np, warn }; };
    const done = $("#peDone");
    if (done) done.onclick = () => {
      const { np, warn } = finalize();
      if (!np) { SFX.wrong(); return msg(TT("还没有可以并入的药物组：", "Nothing to add yet: ") + (warn[0] || TT("至少填一个组名和一种药", "fill in at least one group and drug")), false); }
      SFX.pick(); PG.packSheet(null, !!D.ai); PG.packPreview([np], warn, { ai: !!D.ai, by: D.by || "" });
      const t = $("#pkTxt"); if (t) t.value = packToJSON(np);
    };
    const sv = $("#peSave");
    if (sv) sv.onclick = () => {
      const before = new Set(packs().find(p => p.id === D.editId).groups.map(g => g.id));
      try {
        const r = updatePack(D.editId, D, existingNames(D.editId));
        purgeRecords(r.gone.nos, r.gone.gids);
        r.pack.groups.forEach(g => { if (!before.has(g.id)) sel.add(g.id); });
        save(); SFX.win(); packDraftClear();
        reloadWith(TT("已保存修改：", "Saved: ") + r.pack.name + (r.skipped.length ? TT("。跳过了题库里已有的药：", ". Skipped existing: ") + r.skipped.slice(0, 8).join("、") : "") + (r.gone.nos.length ? TT(`。删掉了 ${r.gone.nos.length} 种药，它们的学习记录已清掉`, `. Removed ${r.gone.nos.length} drugs and their records`) : ""));
      } catch (e) { SFX.wrong(); msg(TT("保存失败：", "Couldn't save: ") + e.message, false); }
    };
    $("#peExp").onclick = async () => {
      const { np, warn } = finalize(); if (!np) { SFX.wrong(); return msg(TT("还没有可以导出的内容：", "Nothing to export: ") + (warn[0] || ""), false); }
      SFX.click();
      try { msg(await saveFile(`药理闯关扩展包-${np.name}.json`, packToJSON(np)), true); }
      catch (e) { if (e && e.code === "declined") return msg(TT("已取消保存", "Save cancelled"), true); $("#peJsonBox").hidden = false; $("#peJsonTxt").value = packToJSON(np); msg(TT("这里不能下载，JSON 已放进下面的文本框，可以复制", "Download unavailable; copy the JSON below"), false); }
    };
    $("#peJson").onclick = () => {
      SFX.click(); const box = $("#peJsonBox"); box.hidden = !box.hidden;
      if (!box.hidden) { const { np } = finalize(); $("#peJsonTxt").value = np ? packToJSON(np) : ""; box.scrollIntoView({ block: "nearest" }); }
    };
    $("#peJsonLoad").onclick = () => {
      const m = $("#peJsonMsg");
      try {
        const r = parsePack($("#peJsonTxt").value, D.name || TT("我的扩展包", "My pack")), p = r.list[0];
        const keepEdit = D.editId, ai = D.ai, by = D.by;
        D = toDraft(p, false); D.editId = keepEdit; D.ai = ai; D.by = by;
        SFX.pick(); redraw(); msg(TT("已载入", "Loaded") + (r.warn.length ? TT("，有几处被跳过：", "; skipped: ") + r.warn.slice(0, 3).join("；") : ""), true);
      } catch (e) { SFX.wrong(); m.textContent = e.message; m.style.color = "var(--rose)"; }
    };
    [["peSample", false], ["peSampleAlt", true]].forEach(([id, alt]) => { const b = $("#" + id); if (b) b.onclick = () => { SFX.click(); D = toDraft(parsePack(packSample(alt)).list[0], false); redraw(); }; });
    armConfirm($("#peReset"), TT("再点一次确认", "Tap again to confirm"), () => {
      SFX.click();
      if (D.editId) { const p = packs().find(x => x.id === D.editId); packDraftClear(); if (p) { D = toDraft(p, true); keep(); render(); } else { D = blankPack(); render(); } }
      else { D = blankPack(); keep(); render(); }
    });
    refresh();
  });
}
