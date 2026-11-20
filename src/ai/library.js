/* 药理闯关 · AI 题库：练习、按题集分组（新建 / 改名 / 删除 / 移动 / 批量移动）、搜索 */
import { PG } from "../core/registry.js";
import { $, TT, esc } from "../core/utils.js";
import { LS } from "../core/storage.js";
import { DM } from "../data/index.js";
import { packTag } from "../data/packs.js";
import { cfg } from "../core/state.js";
import { SFX } from "../music/sfx.js";
import { armConfirm, keepY, main, show } from "../ui/screen.js";
import { popMenu } from "../ui/popmenu.js";
import { AI_FOCUS_SHORT, aiBank, aiSave } from "./client.js";
import { KIND_TAG, addSetName, setNames, setOf } from "./hub.js";

Object.assign(PG, { aiLibrary });   // 页面跳转函数：core/nav.js 会包一层，记录返回路径

const UNG = "\u0001", BAD = "\u0002";    // “未分组”“自查有问题”筛选
const V = { set: null, q: "", picking: false, picked: new Set(), all: false };
const setCount = n => aiBank.filter(q => n === UNG ? !setOf(q) : setOf(q) === n).length;
const kinds = list => { const c = { single: 0, multi: 0, tf: 0 }; list.forEach(q => { c[q.kind === "multi" || q.kind === "tf" ? q.kind : "single"]++; }); return c; };
const kindLine = list => { const c = kinds(list); return [[c.single, TT("单选", "single")], [c.multi, TT("多选", "multi")], [c.tf, TT("判断", "T/F")]].filter(x => x[0]).map(x => x[0] + " " + x[1]).join(" · ") || TT("空", "empty"); };
/* 把题目移到题集（"" = 移出题集） */
function moveTo(ids, name) { const s = new Set(ids); if (name) addSetName(name); PG.aiBank = aiBank.map(q => s.has(q.id) ? { ...q, set: name } : q); aiSave(); }
function renameSet(from, to) {
  PG.aiBank = aiBank.map(q => setOf(q) === from ? { ...q, set: to } : q);
  LS.set("aiSets", (LS.get("aiSets", []) || []).map(x => x === from ? to : x).filter((x, i, a) => a.indexOf(x) === i)); aiSave();
}
function dropSet(name) { PG.aiBank = aiBank.map(q => setOf(q) === name ? { ...q, set: "" } : q); LS.set("aiSets", (LS.get("aiSets", []) || []).filter(x => x !== name)); aiSave(); }
/* 选题集的菜单：已有题集 + 移出题集 + 新建 */
function setMenu(anchor, curName, onPick) {
  const sets = setNames();
  popMenu(anchor, [...sets.map(s => ({ v: s, label: s, hint: setCount(s), cur: s === curName })), ...(curName ? [{ sep: true }, { v: "", label: TT("移出题集（未分组）", "Remove from set") }] : [])],
    v => onPick(v), { onNew: v => onPick(v), newPlaceholder: TT("新题集名字，回车", "New set name, Enter"), newLabel: TT("新建", "Create") });
}

export function aiLibrary() {
  const sets = setNames();
  if (V.set != null && V.set !== UNG && V.set !== BAD && !sets.includes(V.set)) V.set = null;
  const kw = V.q.trim().toLowerCase();
  const flagged = q => q.check && q.check.v !== "ok";
  const inSet = V.set == null ? aiBank : V.set === BAD ? aiBank.filter(flagged) : aiBank.filter(q => V.set === UNG ? !setOf(q) : setOf(q) === V.set);
  const shown = kw ? inSet.filter(q => (q.stem + q.options.join("") + (q.topic || "") + (q.exp || "")).toLowerCase().includes(kw)) : inSet;
  const list = V.all ? shown : shown.slice(0, 40);
  [...V.picked].forEach(id => { if (!aiBank.some(q => q.id === id)) V.picked.delete(id); });
  const curName = V.set == null ? TT("全部题目", "All questions") : V.set === UNG ? TT("未分组", "Ungrouped") : V.set === BAD ? TT("自查有问题", "Flagged by self-check") : V.set;
  const card = (key, name, n, extra = "") => `<div class="ai-sc${V.set === key ? " on" : ""}" data-sc="${esc(key == null ? "" : key)}" role="button" tabindex="0">
      <div class="ai-sc-n">${esc(name)}</div><div class="ai-sc-c"><b>${n}</b> ${TT("题", "Qs")}</div><div class="ai-sc-k">${kindLine(key == null ? aiBank : aiBank.filter(q => key === UNG ? !setOf(q) : key === BAD ? flagged(q) : setOf(q) === key))}</div>${extra}</div>`;
  const row = q => {
    const d = q.no ? DM.get(q.no) : null, ans = q.ansSet || [q.ans];
    return `<article class="aiq${V.picked.has(q.id) ? " picked" : ""}" data-q="${q.id}">
      ${V.picking ? `<button class="aiq-ck" data-ck="${q.id}" aria-pressed="${V.picked.has(q.id)}" aria-label="${TT("选择这题", "Select")}">${V.picked.has(q.id) ? "✓" : ""}</button>` : ""}
      <div class="aiq-body"><div class="aiq-stem">${KIND_TAG[q.kind] ? `<span class="aiq-kind">${TT(...KIND_TAG[q.kind])}</span>` : ""}${esc(q.stem)}</div>
        <ol class="aiq-opts">${q.options.map((o, i) => `<li class="${ans.includes(i) ? "ok" : ""}">${esc(o)}</li>`).join("")}</ol>
        ${q.exp ? `<details class="aiq-exp"><summary>${TT("解析", "Explanation")}</summary><p>${esc(q.exp)}</p></details>` : ""}
        ${q.check ? `<div class="aiq-ck-r ${q.check.v}">${q.check.v === "ok" ? TT("✓ AI 自查通过", "✓ Passed AI check") : q.check.v === "fix" ? TT("⚠ 自查：答案可能标错了", "⚠ Check: answer may be wrong") : TT("✗ 自查：建议删除", "✗ Check: suggest deleting")}${q.check.note ? " — " + esc(q.check.note) : ""}${q.check.v === "fix" ? ` <button class="ibtn" data-fixans="${q.id}">${TT(`改成 ${q.check.fix.map(k => k + 1).join("、")}`, `Change to ${q.check.fix.map(k => k + 1).join(", ")}`)}</button>` : ""}${q.check.v !== "ok" ? ` <button class="ibtn" data-okcheck="${q.id}">${TT("我看过了，没问题", "Looks fine to me")}</button>` : ""}</div>` : ""}
        <div class="aiq-meta">${setOf(q) ? `<span class="aiq-chip set">${esc(setOf(q))}</span>` : ""}${d ? `<span class="aiq-chip">${esc(d.cn)} · ${esc(d.g.n)}${packTag(d.g)}</span>` : q.topic ? `<span class="aiq-chip">${esc(q.topic)}</span>` : ""}
          <span class="aiq-by">${esc(AI_FOCUS_SHORT[q.focus] || "")} · ${esc(q.by || "")} · ${new Date(q.t).toLocaleDateString()}</span></div></div>
      <div class="aiq-acts"><button class="ibtn aiq-mv" data-mv="${q.id}" aria-haspopup="menu">${setOf(q) ? TT("换题集", "Move") : TT("放进题集", "Add to set")} ▾</button><button class="aiq-x" data-del="${q.id}" title="${TT("删除这题", "Delete")}" aria-label="${TT("删除这题", "Delete")}">×</button></div></article>`;
  };
  show(`<div class="sel-head"><div><div class="eyebrow">${TT("AI 专题", "AI")}</div><h2 style="font-size:28px">${TT("AI 题库", "AI question bank")}</h2>
      <p style="color:var(--mute);margin:6px 0 0;max-width:68ch">${TT("生成的题都在这里。用“题集”自己分组：点题集卡片筛选，每道题右边“放进题集”，或者点“批量选择”一次移动很多题。", "All generated questions live here. Group them into sets: tap a set card to filter, use “Add to set” on a question, or “Select” to move many at once.")}</p></div>
      <div class="sel-tools"><button class="btn ghost" id="libGen">${TT("← 去生成题目", "← Generate")}</button></div></div>
    ${aiBank.length ? "" : `<div class="ai-empty"><p>${TT("还没有 AI 题目。先去“AI 出题”填好密钥、生成一些题。", "No AI questions yet. Generate some on the AI page first.")}</p><p style="font-size:13px">${TT("有题之后，这里上方的工具条会出现「AI 自查」按钮，让 AI 复核答案对不对；也可以在 AI 出题页 ② 选「生成后自动自查」，每次生成完自动复核。", "Once you have questions, the toolbar here gets an “AI self-check” button to re-check answers; or pick “Check after generating” in section ② of the AI page.")}</p><button class="btn" id="libGen2">${TT("去生成题目", "Generate questions")}</button></div>`}
    <div class="sec-h"><h2>${TT("题集", "Sets")}</h2><span>${TT(`${sets.length} 个`, `${sets.length}`)}</span></div>
    <div class="ai-scs">
      ${card(null, TT("全部题目", "All questions"), aiBank.length)}
      ${sets.map(s => card(s, s, setCount(s), `<button class="ai-sc-more" data-more="${esc(s)}" aria-label="${TT("题集操作", "Set actions")}" aria-haspopup="menu">⋯</button>`)).join("")}
      ${aiBank.some(q => !setOf(q)) ? card(UNG, TT("未分组", "Ungrouped"), setCount(UNG)) : ""}
      ${aiBank.some(flagged) ? card(BAD, TT("⚠ 自查有问题", "⚠ Flagged"), aiBank.filter(flagged).length).replace('class="ai-sc', 'class="ai-sc warn') : ""}
      <div class="ai-sc add" id="scAdd"><div class="ai-sc-n">${TT("＋ 新建题集", "+ New set")}</div><div class="ai-sc-new" hidden><input class="search" id="scName" maxlength="40" placeholder="${TT("题集名字", "Set name")}"><button class="ibtn" id="scOk">${TT("建好", "Create")}</button></div><span class="ai-status" id="scMsg"></span></div></div>
    ${aiBank.length ? `<div class="ai-bar">
      <div class="ai-bar-t"><b>${esc(curName)}</b><span>${shown.length}${kw ? " / " + inSet.length : ""} ${TT("题", "Qs")}</span></div>
      <div class="ai-bar-a">
        <button class="btn" id="libPlay" ${shown.length ? "" : "disabled"}>${TT("练习这些题", "Practise these")}</button>
        ${V.set != null && V.set !== UNG && V.set !== BAD ? `<button class="ibtn" id="libRen">${TT("改名", "Rename")}</button><button class="ibtn" id="libDrop">${TT("删除题集", "Delete set")}</button>` : ""}
        <button class="ibtn" id="libNew">${TT("最新 20 题", "Latest 20")}</button>
        <button class="ibtn" id="libCheck" ${shown.length ? "" : "disabled"} title="${TT("让 AI 复核当前列表里还没自查过的题（每次最多 30 题）", "AI reviews unchecked questions in this list (up to 30)")}">${TT("AI 自查", "AI self-check")}</button>
        <button class="ibtn${V.picking ? " on" : ""}" id="libPick">${V.picking ? TT("完成选择", "Done") : TT("批量选择", "Select")}</button></div>
      <span class="ai-status" id="libMsg"></span>
      <input class="search ai-find" id="libFind" type="search" value="${esc(V.q)}" placeholder="${TT("搜索题干、选项、解析…", "Search stems, options, explanations…")}"></div>
    <div class="aiq-list">${list.map(row).join("") || `<p class="empty">${kw ? TT("没有匹配的题。", "No matches.") : TT("这个题集还没有题：在别的题右边点“放进题集”，或者用“批量选择”移过来。", "This set is empty: use “Add to set” on other questions, or “Select” to move several.")}</p>`}</div>
    ${shown.length > 40 && !V.all ? `<p class="foot"><button class="ibtn" id="libMore">${TT(`显示全部 ${shown.length} 题`, `Show all ${shown.length}`)}</button></p>` : ""}
    <p class="foot"><button class="ibtn" id="libClear">${TT("清空 AI 题库", "Clear AI bank")}</button></p>
    ${V.picking ? `<div class="ai-pickbar" id="pickBar"><span>${TT("已选", "Selected")} <b>${V.picked.size}</b></span><button class="ibtn" id="pkAll">${TT("全选当前列表", "Select all shown")}</button><button class="btn" id="pkMove" ${V.picked.size ? "" : "disabled"} aria-haspopup="menu">${TT("移到题集 ▾", "Move to set ▾")}</button><button class="ibtn" id="pkDel" ${V.picked.size ? "" : "disabled"}>${TT("删除", "Delete")}</button><button class="ibtn" id="pkNone">${TT("取消", "Cancel")}</button></div>` : ""}` : ""}`,
  () => {
    const re = () => { const y = scrollY; aiLibrary(); keepY(y); };
    ["libGen", "libGen2"].forEach(id => { const b = $("#" + id); if (b) b.onclick = () => { SFX.pick(); PG.aiGen(); }; });
    main.querySelectorAll("[data-sc]").forEach(c => {
      const go = () => { SFX.click(); const k = c.dataset.sc; V.set = k === "" ? null : k; V.all = false; re(); };
      c.onclick = e => { if (e.target.closest(".ai-sc-more")) return; go(); };
      c.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
    });
    main.querySelectorAll("[data-more]").forEach(b => b.onclick = e => {
      e.stopPropagation(); const name = b.dataset.more;
      popMenu(b, [{ v: "play", label: TT("练习这个题集", "Practise this set"), hint: setCount(name) }, { v: "ren", label: TT("改名", "Rename") }, { sep: true }, { v: "del", label: TT("删除题集（题目移到未分组）", "Delete set (questions become ungrouped)"), danger: true }], v => {
        if (v === "play") { const items = aiBank.filter(q => setOf(q) === name); if (items.length) PG.startQuiz(null, { mode: "ai", title: TT("题集：", "Set: ") + name, preset: items }); }
        else if (v === "ren") { V.set = name; re(); const r = $("#libRen"); if (r) r.click(); }
        else { dropSet(name); if (V.set === name) V.set = null; SFX.click(); re(); }
      });
    });
    const add = $("#scAdd");
    add.onclick = e => { if (e.target.closest(".ai-sc-new")) return; add.querySelector(".ai-sc-new").hidden = false; add.querySelector(".ai-sc-n").hidden = true; $("#scName").focus(); };
    const mk = () => {
      const nm = $("#scName").value.trim().slice(0, 40), m = $("#scMsg");
      if (!nm) { $("#scName").focus(); return; }
      if (setNames().includes(nm)) { m.textContent = TT("已经有这个题集了", "Already exists"); m.className = "ai-status no"; return; }
      addSetName(nm); SFX.click(); V.set = nm; re();
    };
    $("#scOk").onclick = e => { e.stopPropagation(); mk(); };
    $("#scName").onkeydown = e => { if (e.key === "Enter") mk(); else if (e.key === "Escape") re(); };
    if (!aiBank.length) return;
    const shownNow = () => shown;
    $("#libPlay").onclick = () => { SFX.pick(); PG.startQuiz(null, { mode: "ai", title: V.set == null ? "AI 出题" : TT("题集：", "Set: ") + curName, preset: shownNow().slice() }); };
    $("#libNew").onclick = () => { SFX.pick(); PG.startQuiz(null, { mode: "ai", title: "AI 出题", preset: aiBank.slice(0, 20) }); };
    $("#libPick").onclick = () => { SFX.click(); V.picking = !V.picking; if (!V.picking) V.picked.clear(); re(); };
    let ft = 0; $("#libFind").oninput = e => { clearTimeout(ft); ft = setTimeout(() => { V.q = e.target.value; V.all = false; const pos = e.target.selectionStart; re(); const f = $("#libFind"); f.focus(); try { f.setSelectionRange(pos, pos); } catch (_) {} }, 250); };
    const ren = $("#libRen");
    if (ren) ren.onclick = () => {
      SFX.click(); const t = main.querySelector(".ai-bar-t"), old = V.set;
      t.innerHTML = `<input class="search ai-ren" id="renIn" value="${esc(old)}" maxlength="40"><button class="ibtn" id="renOk">${TT("保存", "Save")}</button><button class="ibtn" id="renNo">${TT("取消", "Cancel")}</button>`;
      const inp = $("#renIn"); inp.focus(); inp.select();
      const ok = () => { const nm = inp.value.trim().slice(0, 40); if (nm && nm !== old) { renameSet(old, nm); V.set = nm; SFX.click(); } re(); };
      $("#renOk").onclick = ok; $("#renNo").onclick = re; inp.onkeydown = e => { if (e.key === "Enter") ok(); else if (e.key === "Escape") re(); };
    };
    armConfirm($("#libDrop"), TT("再点一次：只删题集，题目移到未分组", "Tap again: deletes the set only"), () => { dropSet(V.set); V.set = null; SFX.click(); re(); });
    main.querySelectorAll("[data-mv]").forEach(b => b.onclick = e => { e.stopPropagation(); const q = aiBank.find(x => x.id === b.dataset.mv); setMenu(b, setOf(q), v => { moveTo([q.id], v); SFX.click(); re(); }); });
    main.querySelectorAll("[data-del]").forEach(b => armConfirm(b, TT("删除？", "Delete?"), () => { PG.aiBank = aiBank.filter(q => q.id !== b.dataset.del); V.picked.delete(b.dataset.del); aiSave(); SFX.click(); re(); }));
    $("#libCheck").onclick = async () => {
      const b = $("#libCheck"), m = $("#libMsg"); let ids = shown.filter(q => !q.check).map(q => q.id);
      if (!ids.length) ids = shown.map(q => q.id);          // 都查过了就重新查当前列表
      b.disabled = true; m.className = "ai-status";
      try { const c = await PG.aiReviewQuestions(ids, t => { m.textContent = t; }, 30); SFX.pick();
        V.msg = TT(`自查了 ${c.n} 题：${c.ok} 题没问题${c.fix ? `，${c.fix} 题答案可能标错` : ""}${c.bad ? `，${c.bad} 题建议删除` : ""}`, `Checked ${c.n}: ${c.ok} fine${c.fix ? `, ${c.fix} wrong answer` : ""}${c.bad ? `, ${c.bad} to delete` : ""}`) + (ids.length >= 30 ? TT("（每次最多 30 题，可以再点一次）", " (30 per run; tap again for more)") : "");
        re(); }
      catch (e) { m.textContent = e.message; m.className = "ai-status no"; b.disabled = false; SFX.wrong(); }
    };
    if (V.msg) { const m = $("#libMsg"); m.textContent = V.msg; m.className = "ai-status ok"; V.msg = ""; }
    main.querySelectorAll("[data-fixans]").forEach(b => b.onclick = () => { PG.applyAnswerFix(b.dataset.fixans); SFX.click(); re(); });
    main.querySelectorAll("[data-okcheck]").forEach(b => b.onclick = () => { PG.aiBank = aiBank.map(q => q.id === b.dataset.okcheck ? { ...q, check: { ...q.check, v: "ok", note: TT("人工确认没问题", "Confirmed by you") } } : q); aiSave(); SFX.click(); re(); });
    const more = $("#libMore"); if (more) more.onclick = () => { V.all = true; re(); };
    armConfirm($("#libClear"), TT("再点一次确认清空（不能撤销）", "Tap again to clear (cannot undo)"), () => { PG.aiBank = []; aiSave(); V.picked.clear(); V.picking = false; SFX.click(); re(); });
    if (V.picking) {
      main.querySelectorAll(".aiq").forEach(a => a.onclick = e => { if (e.target.closest(".aiq-acts,details,summary")) return; const id = a.dataset.q; V.picked.has(id) ? V.picked.delete(id) : V.picked.add(id); SFX.pick(); re(); });
      $("#pkAll").onclick = () => { shownNow().forEach(q => V.picked.add(q.id)); SFX.click(); re(); };
      $("#pkNone").onclick = () => { V.picked.clear(); V.picking = false; SFX.click(); re(); };
      $("#pkMove").onclick = e => { e.stopPropagation(); setMenu($("#pkMove"), null, v => { moveTo([...V.picked], v); V.picked.clear(); V.picking = false; SFX.click(); if (v) V.set = v; re(); }); };
      armConfirm($("#pkDel"), TT(`再点一次删除 ${V.picked.size} 题`, `Tap again to delete ${V.picked.size}`), () => { PG.aiBank = aiBank.filter(q => !V.picked.has(q.id)); aiSave(); V.picked.clear(); SFX.click(); re(); });
    }
  });
}
