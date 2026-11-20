/* 药理闯关 · 题库扩展包面板：导入（文件 / 粘贴 / AI 生成）→ 预览 → 并入；已装扩展包的导出、审核、删除 */
import { PG, reg } from "../core/registry.js";
import { $, TT, esc } from "../core/utils.js";
import { DR, G } from "../data/index.js";
import { dstat, mastery, mwrong, save, sel, wrong } from "../core/state.js";
import { PACK_LIMITS, catalog, installPack, isOfficial, officialMismatch, packSample, packToJSON, packs, packsToJSON, parsePack, removePackStore, setPackReviewed, updatePack } from "../data/packs.js";
import { SFX } from "../music/sfx.js";
import { armConfirm } from "../ui/screen.js";

reg({ packReviewSheet: () => packReviewSheet, packSheet: () => packSheet, packPreview: () => packPreview, purgeRecords: () => purgeRecords, existingNames: () => existingNames, reloadWith: () => reloadWith, saveFile: () => saveFile });

/* 题库里已有的药名（中文、英文小写）。except = 某个扩展包的 id：编辑这个包时，它自己的药不算重名 */
export const existingNames = (except) => { const s = new Set(); DR.forEach(d => { if (except && d.g.pack === except) return; s.add(d.zh); s.add(String(d.en).toLowerCase()); s.add(String(d.en).replace(/\s*\(.*\)\s*$/, "").toLowerCase()); }); return s; };
export const reloadWith = m => { try { sessionStorage.setItem("pg_packmsg", m); } catch (e) {} location.reload(); };

/* 删除扩展包时，把它的药和组留下的学习记录一起清掉（否则错题本里会出现找不到的药） */
function purge(p) { purgeRecords(p.groups.flatMap(g => g.drugs.map(d => d.no)), p.groups.map(g => g.id)); }
export function purgeRecords(noList, gidList) {
  const nos = new Set(noList), gids = new Set(gidList);
  nos.forEach(n => { delete dstat[n]; delete wrong[n]; ["cn", "m", "i", "a"].forEach(k => { delete mwrong[k + ":" + n]; }); });
  gids.forEach(id => { delete wrong["g" + id]; delete mastery[id]; sel.delete(id); });
  if (!sel.size) G.filter(g => !g.pack).forEach(g => sel.add(g.id));
  try { PG.aiBank = PG.aiBank.map(q => nos.has(q.no) ? { ...q, no: null } : q); PG.aiSave(); } catch (e) {}
  save();
}
export async function saveFile(fname, text) {
  let dl = null; try { if (window.claude && window.claude.use) dl = await window.claude.use("downloads"); } catch (e) {}
  if (dl) { await dl.save({ filename: fname, data: text }); return TT("已保存：", "Saved: ") + fname; }
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  return TT("已开始下载：", "Downloading: ") + fname;
}

let aiFlags = null;   // 文本框里是 AI 生成的内容时，改完再预览也保留“AI·未审核”标记
export function packSheet(note, keepAi) {
  if (!keepAi) aiFlags = null;
  const host = $("#sheetHost"), list = packs();
  host.innerHTML = `<div class="sheet-bg" id="pkbg"><div class="sheet io-box" role="dialog" aria-label="${TT("题库扩展包", "Question-bank packs")}">
    <h2>${TT("题库扩展包", "Question-bank packs")}</h2>
    <p>${TT("扩展包是一个 JSON 文件，里面写自己整理的药物组（药名、机制、适应证、不良反应等）。导入后会作为新的一章出现在「选择考试范围」里，和内置的 53 组一样参加查房问答、连线、分拣、速记卡片、图鉴、热力图和错题本。扩展包可以发给同学导入，也可以在「AI 出题」页让 AI 根据讲义生成。", "A pack is a JSON file of your own drug groups (names, mechanisms, indications, adverse effects…). Imported packs appear as a new chapter in the exam scope and join every game mode like the built-in groups. Share packs with friends, or let AI generate one from your notes on the AI page.")}</p>
    <p class="io-msg" id="pkMsg" style="margin:6px 0"></p>
    ${catalog().length ? "" : `<h4 id="pkCatH">${TT("官方合集", "Official collection")}（0）</h4><p class="pk-hint">${TT("还没有官方扩展包。作者审核过的包放进项目里的「扩展包合集」文件夹、发布新版本后，会出现在这里，可以一键安装；装好的包显示绿色的「官方审核」标签。", "No official packs yet. Packs the author has reviewed are bundled into a new version and show up here for one-tap install, marked with a green “Official” tag.")}</p>`}
    ${catalog().length ? `<h4 id="pkCatH">${TT("官方合集", "Official collection")}（${catalog().length}）</h4>
    <p class="pk-hint">${TT("作者审核过、打包在软件里的扩展包，点“预览并安装”就能并入题库；装好后显示「官方审核」。", "Packs reviewed by the author and bundled with the app. Preview and install with one tap; they show “Official” once installed.")}</p>
    <div class="sg-list pk-cat">${catalog().map((c, i) => { const inst = list.some(p => p.official && p.print === c.print);
      return `<div class="sg-item pk-item"><div><b>${esc(c.pack.name)} <span class="pk-tag off">${TT("官方审核", "Official")}</span></b><small>${c.groups} ${TT("组", "groups")} · ${c.drugs} ${TT("种药", "drugs")}${c.pack.author ? " · " + esc(c.pack.author) : ""}${c.pack.desc ? " · " + esc(c.pack.desc) : ""}</small></div>
        <div class="pk-btns">${inst ? `<span class="pk-inst">${TT("已安装", "Installed")}</span>` : `<button class="ibtn" data-cat="${i}">${TT("预览并安装", "Preview & install")}</button>`}</div></div>`; }).join("")}</div>` : ""}
    <h4>${TT("已导入", "Installed")}（${list.length} / ${PACK_LIMITS.packs}）</h4>
    ${list.length ? `<div class="sg-list">${list.map(p => {
      const nd = p.groups.reduce((s, g) => s + g.drugs.length, 0);
      return `<div class="sg-item pk-item"><div><b>${esc(p.name)} ${p.official ? `<span class="pk-tag off">${TT("官方审核", "Official")}</span>` : p.ai ? `<span class="pk-tag${p.reviewed ? "" : " ai"}">${p.reviewed ? TT("AI·已审核", "AI · reviewed") : TT("AI·未审核", "AI · unreviewed")}</span>` : ""}</b>
        <small>${esc(p.ch)} · ${p.groups.length} ${TT("组", "groups")} · ${nd} ${TT("种药", "drugs")}${p.author ? " · " + esc(p.author) : ""} · ${new Date(p.t).toLocaleDateString()}</small></div>
        <div class="pk-btns"><button class="ibtn" data-edit="${p.id}">${TT("编辑", "Edit")}</button><button class="ibtn" data-aichk="${p.id}">${TT("AI 自查", "AI check")}</button>${p.ai && !p.reviewed ? `<button class="ibtn" data-rev="${p.id}">${TT("标为已审核", "Mark reviewed")}</button>` : ""}<button class="ibtn" data-exp="${p.id}">${TT("导出", "Export")}</button><button class="ibtn" data-del="${p.id}">${TT("删除", "Delete")}</button></div></div>`; }).join("")}</div>`
      : `<p>${TT("还没有扩展包。", "No packs yet.")}</p>`}
    <h4>${TT("导入扩展包", "Import a pack")}</h4>
    <div class="io-row"><button class="btn" id="pkPick">${TT("选择 JSON 文件", "Choose JSON file")}</button><input id="pkFile" type="file" multiple accept=".json,application/json,text/plain" style="display:none"></div>
    <textarea id="pkTxt" placeholder="${TT("或者把扩展包 JSON 粘贴到这里…", "…or paste pack JSON here")}"></textarea>
    <div class="io-row"><button class="btn" id="pkGo">${TT("预览粘贴的内容", "Preview pasted JSON")}</button><button class="ibtn" id="pkSample">${TT("填入示例（抑酸药）", "Fill in a sample")}</button><button class="ibtn" id="pkSampleAlt">${TT("English sample", "中文示例")}</button><button class="ibtn" id="pkAi">${TT("去 AI 生成", "Generate with AI")}</button></div>
    <div class="io-row"><button class="btn ghost" id="pkNew">${TT("✎ 用可视化编辑器新建（不用写 JSON）", "✎ New pack in the visual editor (no JSON)")}</button></div>
    <div id="pkPrev"></div>
    <details class="sg-help"><summary>${TT("怎么写扩展包（格式说明）", "How to write a pack (format)")}</summary>
      <ul>
        <li>${TT("最外层：", "Top level: ")}<code>name</code> ${TT("扩展包名（会成为一章的标题）", "pack name (becomes the chapter title)")}，${TT("可选", "optional")} <code>author</code> ${TT("作者", "author")}、<code>desc</code> ${TT("说明", "description")}；<code>groups</code> ${TT("药物组列表", "list of drug groups")}。</li>
        <li>${TT("每个药物组：", "Each group: ")}<code>name</code> ${TT("组名（必填）", "name (required)")}、<code>en</code> ${TT("英文名", "English name")}，${TT("以及这一组的共同要点：", "plus the group's shared points: ")}<code>mechanism</code> ${TT("机制", "mechanism")}、<code>indication</code> ${TT("适应证", "indication")}、<code>adverse</code> ${TT("不良反应", "adverse effects")}、<code>contraindication</code> ${TT("禁忌", "contraindication")}、<code>dental</code> ${TT("牙科应用", "dental use")}、<code>spectrum</code> ${TT("抗菌谱（抗感染药才写）", "spectrum (anti-infectives only)")}；<code>drugs</code> ${TT("药物列表", "drugs")}。</li>
        <li>${TT("每种药：", "Each drug: ")}<code>zh</code> ${TT("中文名（必填）", "Chinese name (required)")}、<code>en</code> ${TT("英文名 / INN", "English name / INN")}、<code>note</code> ${TT("区分要点（和同组药不一样的地方，不要写药名本身）", "distinguishing point (don't include the drug's own name)")}；${TT("如果这个药和组里的要点不同，可以单独写", "if it differs from the group, add its own")} <code>mechanism</code> / <code>indication</code> / <code>adverse</code>，${TT("没写的就用组里的。", "otherwise the group's are used.")}</li>
        <li>${TT("每种药最少要有：药名 + 所属组 + 机制、适应证、不良反应里至少一项（药物或组里写都行）。写得越全，能出的题型越多：缺哪一项，就不出那一项的题。", "Minimum per drug: name + group + at least one of mechanism / indication / adverse effect (on the drug or its group). The more you fill in, the more question types it joins; missing fields just skip those types.")}</li>
        <li>${TT("不良反应用顿号「、」或分号「;」分隔多条（英文写的用分号），“不良反应 → 药物”题会单独抽一条出题。没写英文名的药不出中英互译和默写题。", "Separate adverse effects with ; (or 、) so single items can be quizzed. Drugs without an English name skip name-translation and spelling.")}</li>
        <li>${TT("和题库里已有的药重名（中文或英文）会自动跳过，避免一题两个答案。字段名也可以用中文（机制、适应证、不良反应…）或 drugs.js 里的短写（m / i / a / c / d / s）。", "Drugs already in the bank (same Chinese or English name) are skipped. Field names may also be Chinese or the short keys from drugs.js (m / i / a / c / d / s).")}</li>
        <li>${TT("英文模式下，扩展包里的内容按原文显示（不会自动翻译）。", "In English mode, pack content is shown as written (not translated).")}</li>
      </ul>
      <p>${TT("英文版示例点上面的“English sample”。英文版里 zh 仍写中文通用名（中文模式显示、查重用），其余字段可以写英文。", "The Chinese sample is under “中文示例” above. In English packs, keep zh as the Chinese generic name if you know it (used in Chinese mode and for duplicate checks); all other fields can be English.")}</p>
      <pre>${esc(packSample())}</pre>
    </details>
    <p style="font-size:12px">${TT("扩展包存在本机，完整备份会一起带上。删除扩展包会同时清掉它的错题、掌握度等记录。内容准确性由编写者负责，考试以讲义为准。", "Packs are stored on this device and included in full backups. Deleting a pack also clears its mistakes and mastery records. Authors are responsible for accuracy; your lecture notes take precedence.")}</p>
    <div class="close-row"><button class="btn ghost" id="pkClose">${TT("关闭", "Close")}</button></div></div></div>`;
  const msg = (t, ok = true) => { const m = $("#pkMsg"); m.textContent = t; m.style.color = ok ? "var(--mint)" : "var(--rose)"; };
  if (note) msg(note);
  const close = () => { host.innerHTML = ""; };
  $("#pkbg").addEventListener("click", e => { if (e.target.id === "pkbg") close(); });
  $("#pkClose").onclick = () => { SFX.click(); close(); };
  const run = (texts, flags = {}) => {
    const got = [], warn = [];
    texts.forEach(([txt, fname]) => { try { const r = parsePack(txt, (fname || "").replace(/\.[^.]+$/, "") || TT("我的扩展包", "My pack")); got.push(...r.list); warn.push(...r.warn); } catch (e) { warn.push((fname ? fname + "：" : "") + e.message); } });
    if (!got.length) { SFX.wrong(); msg(TT("读不出扩展包：", "Couldn't read the pack: ") + (warn[0] || ""), false); return; }
    SFX.pick(); msg(""); packPreview(got, warn, flags);
  };
  host.querySelectorAll("[data-cat]").forEach(b => b.onclick = () => { const c = catalog()[+b.dataset.cat]; if (c) run([[c.text, c.file]]); });
  $("#pkPick").onclick = () => { SFX.click(); $("#pkFile").click(); };
  $("#pkFile").onchange = async e => { aiFlags = null; const fs = [...e.target.files]; if (!fs.length) return; run(await Promise.all(fs.map(f => new Promise(r => { const rd = new FileReader(); rd.onload = () => r([String(rd.result), f.name]); rd.onerror = () => r(["", f.name]); rd.readAsText(f); })))); };
  $("#pkGo").onclick = () => { const t = $("#pkTxt").value.trim(); if (t) run([[t, ""]], aiFlags || {}); else msg(TT("先粘贴内容", "Paste something first"), false); };
  [["pkSample", false], ["pkSampleAlt", true]].forEach(([id, alt]) => { $("#" + id).onclick = () => { aiFlags = null; SFX.click(); $("#pkTxt").value = packSample(alt); msg(TT("示例已填入，点“预览粘贴的内容”试试", "Sample filled in — tap Preview")); }; });
  $("#pkAi").onclick = () => { SFX.click(); close(); PG.aiGen(); setTimeout(() => { const el = $("#aiPackBox"); if (el) el.scrollIntoView({ behavior: "smooth" }); }, 200); };
  $("#pkNew").onclick = () => { SFX.click(); close(); PG.packEditor(); };
  host.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => { SFX.click(); const p = packs().find(x => x.id === b.dataset.edit); if (!p) return; close(); PG.packEditor({ edit: p }); });
  host.querySelectorAll("[data-exp]").forEach(b => b.onclick = async () => {
    SFX.click(); const p = packs().find(x => x.id === b.dataset.exp); if (!p) return;
    const json = packToJSON(p);
    try { msg(await saveFile(`药理闯关扩展包-${p.name}.json`, json)); }
    catch (e) { if (e && e.code === "declined") { msg(TT("已取消保存", "Save cancelled")); return; } $("#pkTxt").value = json; msg(TT("这里不能下载，内容已放进下面的文本框，可以复制", "Download unavailable; the JSON is in the box below to copy"), false); }
  });
  host.querySelectorAll("[data-aichk]").forEach(b => b.onclick = () => { SFX.click(); packReviewSheet(b.dataset.aichk); });
  host.querySelectorAll("[data-rev]").forEach(b => armConfirm(b, TT("确认逐条核对过了？再点一次", "Checked every item? Tap again"), () => { setPackReviewed(b.dataset.rev); reloadWith(TT("已标为已审核", "Marked as reviewed")); }));
  host.querySelectorAll("[data-del]").forEach(b => armConfirm(b, TT("再点一次删除（连同学习记录）", "Tap again to delete (with its records)"), () => {
    const p = packs().find(x => x.id === b.dataset.del); if (!p) return;
    purge(p); removePackStore(p.id); reloadWith(TT("已删除扩展包：", "Deleted pack: ") + p.name);
  }));
}

/* 预览：列出要并入的组和药、会跳过的重名药、格式提示；AI 生成的额外提醒要审核。
   预览里可以直接改包名 / 组名、删掉某个药或某个组，也可以整个打开可视化编辑器细改。确认后并入并刷新页面 */
export function packPreview(list, warn, flags) {
  if (!$("#pkPrev")) packSheet(null, true);
  if (flags.ai) aiFlags = { ai: true, by: flags.by || "" };
  const names = existingNames(), dup = d => names.has(d.zh) || names.has(String(d.en).toLowerCase());
  list = list.filter(p => p.groups.length);
  const nd = list.reduce((s, p) => s + p.groups.reduce((t, g) => t + g.drugs.filter(d => !dup(d)).length, 0), 0), ng = list.reduce((s, p) => s + p.groups.length, 0);
  const box = $("#pkPrev");
  const sync = () => { const t = $("#pkTxt"); if (t && list.length) t.value = packsToJSON(list); };
  box.innerHTML = `<div class="restore-box pk-prev">
    ${flags.ai ? `<p class="pk-warn"><b>${TT("AI 生成的内容可能有错。", "AI-generated content may contain errors.")}</b>${TT("并入后这些组会标成「AI·未审核」。请对照讲义逐条核对：可以直接在这里改名、删掉不要的药和组，或者点“在编辑器里细改”逐条修改；核对完再点“标为已审核”。", " These groups will be marked “AI · unreviewed”. Check each item against your notes: rename or delete items right here, or open the editor for details; then mark the pack reviewed.")}</p>` : ""}
    ${list.some(isOfficial) ? `<p class="pk-ok"><span class="pk-tag off">${TT("官方审核", "Official")}</span> ${TT(`${list.length > 1 ? "其中 " + list.filter(isOfficial).length + " 个包" : "这个包"}和官方合集里的版本一字不差。在这里改名或删东西会去掉官方标记。`, `${list.length > 1 ? list.filter(isOfficial).length + " of these packs match" : "This pack matches"} the official collection exactly. Renaming or deleting anything here removes the Official mark.`)}</p>` : ""}
    ${list.some(officialMismatch) ? `<p class="pk-warn">${TT("注意：有和官方合集同名的包，但内容对不上，可能被人改过。并入后不会显示官方审核。", "Note: a pack has the same name as an official one but different content — it may have been modified. It won't be marked Official.")}</p>` : ""}
    <p class="pk-hint">${TT("点名字可以直接改；点 × 删掉这个药或这个组。", "Tap a name to edit it; tap × to delete a drug or group.")}</p>
    ${list.map((p, pi) => `<div class="pk-ph"><input class="pk-in pk-pn" data-p="${pi}" value="${esc(p.name)}" aria-label="${TT("扩展包名", "Pack name")}">${p.author ? ` <small>· ${esc(p.author)}</small>` : ""}</div>
      ${p.groups.map((g, gi) => `<div class="pk-g"><div class="pk-gh"><input class="pk-in pk-gn" data-p="${pi}" data-g="${gi}" value="${esc(g.n)}" aria-label="${TT("组名", "Group name")}">${g.e && g.e !== g.n ? ` <small>${esc(g.e)}</small>` : ""}<button class="pk-x" data-xg="${pi}:${gi}" title="${TT("删掉这个组", "Delete this group")}" aria-label="${TT("删掉这个组", "Delete this group")}">×</button></div>
        <div class="pk-ds">${g.drugs.map((d, di) => `<span class="${dup(d) ? "dup" : ""}" title="${esc([d.note, d.m || g.m, d.i || g.i, d.a || g.a].filter(Boolean).join("\n"))}">${esc(d.zh)}${d.en && d.en !== d.zh ? " · " + esc(d.en) : ""}${dup(d) ? TT("（已有，跳过）", " (exists, skipped)") : ""}<button class="pk-x" data-xd="${pi}:${gi}:${di}" aria-label="${TT("删掉", "Delete")} ${esc(d.zh)}">×</button></span>`).join("")}</div></div>`).join("")}`).join("")}
    ${list.length ? "" : `<p class="empty">${TT("都删光了。", "Nothing left.")}</p>`}
    ${warn.length ? `<ul class="pk-warns">${warn.slice(0, 12).map(w => `<li>${esc(w)}</li>`).join("")}${warn.length > 12 ? `<li>${TT("……还有 ", "…and ")}${warn.length - 12}${TT(" 条", " more")}</li>` : ""}</ul>` : ""}
    <p style="margin:8px 0 0">${TT(`将并入 ${ng} 个组、${nd} 种药。并入后页面会刷新一次。`, `Adds ${ng} groups and ${nd} drugs. The page reloads once.`)}</p>
    ${reviewHTML(flags.review)}
    <div class="io-row"><button class="btn" id="pkInstall" ${nd ? "" : "disabled"}>${TT("并入题库", "Add to the bank")}</button>${list.length === 1 ? `<button class="btn ghost" id="pkEdit">${TT("在编辑器里细改", "Open in editor")}</button><button class="ibtn" id="pkReview">${flags.review && !flags.review.error ? TT("重新自查", "Check again") : TT("AI 自查", "AI self-check")}</button>` : ""}<button class="ibtn" id="pkCancel">${TT("取消", "Cancel")}</button></div></div>`;
  if (flags.raw) { $("#pkTxt").value = flags.raw; flags = { ...flags, raw: "" }; }
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  const again = () => { sync(); const y = box.closest(".sheet") ? box.closest(".sheet").scrollTop : 0; packPreview(list, warn, flags); const sh = box.closest(".sheet"); if (sh) sh.scrollTop = y; };
  box.querySelectorAll(".pk-pn").forEach(inp => inp.onchange = () => { const v = inp.value.trim().slice(0, 40); if (v) list[+inp.dataset.p].name = v; sync(); });
  box.querySelectorAll(".pk-gn").forEach(inp => inp.onchange = () => { const v = inp.value.trim().slice(0, 40); if (v) { const g = list[+inp.dataset.p].groups[+inp.dataset.g]; if (g.e === g.n) g.e = v; g.n = v; } sync(); });
  box.querySelectorAll("[data-xg]").forEach(b => b.onclick = () => { SFX.click(); const [pi, gi] = b.dataset.xg.split(":").map(Number); list[pi].groups.splice(gi, 1); again(); });
  box.querySelectorAll("[data-xd]").forEach(b => b.onclick = e => { e.stopPropagation(); SFX.click(); const [pi, gi, di] = b.dataset.xd.split(":").map(Number), g = list[pi].groups[gi]; g.drugs.splice(di, 1); if (!g.drugs.length) list[pi].groups.splice(gi, 1); again(); });
  const rv = $("#pkReview");
  if (rv) rv.onclick = async () => {
    rv.disabled = true; const m = $("#pkMsg"); m.style.color = "var(--mute)";
    try { flags = { ...flags, review: await PG.aiReviewPack(list[0], t => { m.textContent = t; }) }; m.textContent = ""; SFX.pick(); }
    catch (e) { flags = { ...flags, review: { error: e.message } }; m.textContent = ""; SFX.wrong(); }
    again(); const b = $("#pkRevBox"); if (b) b.scrollIntoView({ block: "nearest" });
  };
  box.querySelectorAll("[data-fix]").forEach(b => b.onclick = () => {
    const it = flags.review.issues[+b.dataset.fix];
    if (!applyIssue(list[0], it)) { b.textContent = TT("找不到位置，请手动改", "Can't locate — edit manually"); b.disabled = true; return; }
    it.done = true; SFX.click(); again();
  });
  const ed = $("#pkEdit"); if (ed) ed.onclick = () => { SFX.click(); const p = list[0]; $("#sheetHost").innerHTML = ""; PG.packEditor({ draft: { ...p, ai: !!flags.ai, by: flags.by || "" } }); };
  $("#pkCancel").onclick = () => { SFX.click(); box.innerHTML = ""; };
  $("#pkInstall").onclick = () => {
    const done = [], skipped = [];
    try {
      list.forEach(p => { try { const r = installPack(p, existingNames(), flags); done.push(r.pack); skipped.push(...r.skipped); const pk = r.pack; pk.groups.forEach(g => sel.add(g.id)); } catch (e) { if (!done.length && list.length === 1) throw e; skipped.push(p.name + "：" + e.message); } });
    } catch (e) { SFX.wrong(); const m = $("#pkMsg"); m.textContent = TT("并入失败：", "Failed: ") + e.message; m.style.color = "var(--rose)"; return; }
    save(); SFX.win();
    try { PG.packDraftClear(); } catch (e) {}
    reloadWith(TT("已并入：", "Added: ") + done.map(p => `${p.name}（${p.groups.length} 组）`).join("、") + TT("，已加进本次考试范围", "; added to the current exam scope") + (skipped.length ? TT("。跳过了已有的药：", ". Skipped existing: ") + skipped.slice(0, 8).join("、") + (skipped.length > 8 ? "…" : "") : ""));
  };
}

/* 按一条自查意见改内容。p 是整理好的包（组用 n/e/m/i/…，药用 zh/en/note/m/i/a）。改到了返回 true，找不到位置返回 false */
function applyIssue(p, it) {
  const key = PG.REVIEW_FIELDS[it.field];
  const g = p.groups.find(x => x.n === it.group) || p.groups.find(x => it.group && (x.n.includes(it.group) || it.group.includes(x.n)));
  const d = g && it.drug ? g.drugs.find(x => x.zh === it.drug || x.en === it.drug) : null;
  if (!g || !key || (it.drug && !d) || (d && !["note", "m", "i", "a", "e"].includes(key))) return false;
  if (d) d[key === "e" ? "en" : key] = it.fix.trim(); else g[key] = it.fix.trim();
  return true;
}

/* 已装扩展包的 AI 自查：卡片上直接点。自查结果可以逐条采纳，再“保存修改”或“保存并标为已审核”。
   改动通过 updatePack 写回，药和组保留原来的编号，学习记录不丢 */
const keepIds = p => ({ name: p.name, author: p.author || "", desc: p.desc || "",
  groups: p.groups.map(g => ({ n: g.n || "", e: g.e && g.e !== g.n ? g.e : "", m: g.m || "", i: g.i || "", c: g.c || "", d: g.d || "", s: g.s || "", a: g.a || "", _id: g.id,
    drugs: g.drugs.map(d => ({ zh: d.zh || "", en: d.en && d.en !== d.zh ? d.en : "", note: d.note || "", m: d.m || "", i: d.i || "", a: d.a || "", _no: d.no })) })) });
export function packReviewSheet(id) {
  const p0 = packs().find(x => x.id === id); if (!p0) return;
  const work = keepIds(p0); let review = null, changed = 0;
  const host = $("#sheetHost");
  const draw = () => {
    const errs = review && !review.error ? review.issues.filter(x => x.severity === "error" && !x.done).length : 0;
    host.innerHTML = `<div class="sheet-bg" id="prbg"><div class="sheet io-box" role="dialog" aria-label="${TT("AI 自查", "AI self-check")}">
      <h2>${TT("AI 自查：", "AI self-check: ")}${esc(p0.name)}</h2>
      <p class="pk-hint">${TT("让 AI 以审稿老师的身份把这个扩展包逐组、逐药核对一遍（机制、适应证、不良反应、分组、区分要点）。能定位到具体内容的意见可以一键采纳，采纳后点“保存修改”才会真正写进题库。", "AI reviews every group and drug (mechanism, indication, adverse effects, grouping, notes). Fixes that point at a specific field can be applied with one tap; they're written to the bank only when you save.")}</p>
      <p class="io-msg" id="prMsg" style="margin:6px 0"></p>
      ${review ? reviewHTML(review) : ""}
      ${review && !review.error && !review.issues.length ? `<p class="pk-rev-s">${TT("没有发现问题。", "No problems found.")}</p>` : ""}
      <div class="io-row" style="margin-top:10px">
        <button class="btn" id="prRun">${review ? TT("再查一次", "Check again") : TT("开始自查", "Start check")}</button>
        ${changed ? `<button class="btn" id="prSave">${TT(`保存修改（${changed} 处）`, `Save changes (${changed})`)}</button>` : ""}
        ${p0.ai && !p0.reviewed && review && !review.error ? `<button class="btn ghost" id="prOk">${changed ? TT("保存并标为已审核", "Save and mark reviewed") : TT("标为已审核", "Mark reviewed")}</button>` : ""}
        <button class="btn ghost" id="prClose">${TT("关闭", "Close")}</button></div>
      ${errs ? `<p class="pk-hint" style="margin-top:6px">${TT(`还有 ${errs} 处“错误”没处理，标为已审核前建议先改掉或者在编辑器里手动改。`, `${errs} errors are still open — fix them (here or in the editor) before marking as reviewed.`)}</p>` : ""}
    </div></div>`;
    const m = $("#prMsg");
    const close = () => { host.innerHTML = ""; };
    $("#prbg").onclick = e => { if (e.target.id === "prbg") { SFX.click(); close(); } };
    $("#prClose").onclick = () => { SFX.click(); close(); };
    $("#prRun").onclick = async () => {
      const b = $("#prRun"); b.disabled = true; m.style.color = "var(--mute)";
      try { review = await PG.aiReviewPack(work, t => { m.textContent = t; }); SFX.pick(); }
      catch (e) { review = { error: e.message }; SFX.wrong(); }
      draw(); const box = $("#pkRevBox"); if (box) box.scrollIntoView({ block: "nearest" });
    };
    host.querySelectorAll("[data-fix]").forEach(b => b.onclick = () => {
      const it = review.issues[+b.dataset.fix];
      if (!applyIssue(work, it)) { b.textContent = TT("找不到位置，请在编辑器里手动改", "Can't locate — edit in the editor"); b.disabled = true; return; }
      it.done = true; changed++; SFX.click(); const sh = host.querySelector(".sheet"), y = sh ? sh.scrollTop : 0; draw(); const s2 = host.querySelector(".sheet"); if (s2) s2.scrollTop = y;
    });
    const save = mark => {
      try {
        if (changed) { const r = updatePack(id, work, existingNames(id)); if (r.gone.nos.length || r.gone.gids.length) purgeRecords(r.gone.nos, r.gone.gids); }
        if (mark) setPackReviewed(id);
        SFX.win(); reloadWith((changed ? TT(`已保存 ${changed} 处修改`, `Saved ${changed} changes`) : "") + (mark ? (changed ? TT("，并标为已审核", " and marked as reviewed") : TT("已标为已审核", "Marked as reviewed")) : ""));
      } catch (e) { SFX.wrong(); m.textContent = TT("保存失败：", "Save failed: ") + e.message; m.style.color = "var(--rose)"; }
    };
    const sv = $("#prSave"); if (sv) sv.onclick = () => save(false);
    const ok = $("#prOk"); if (ok) armConfirm(ok, TT("确认核对过了？再点一次", "Checked? Tap again"), () => save(true));
  };
  draw();
}

/* AI 自查结果：总体评价 + 逐条意见（能定位到字段的可以一键采纳） */
function reviewHTML(r) {
  if (!r) return "";
  if (r.error) return `<div class="pk-rev" id="pkRevBox"><p class="pk-warn">${TT("自查没完成：", "Self-check failed: ")}${esc(r.error)}</p></div>`;
  const FN = { name: TT("组名", "name"), en: TT("英文名", "English"), mechanism: TT("机制", "mechanism"), indication: TT("适应证", "indication"), contraindication: TT("禁忌", "contraindication"), dental: TT("牙科应用", "dental"), adverse: TT("不良反应", "adverse"), note: TT("区分要点", "note"), grouping: TT("分组", "grouping"), other: TT("其他", "other") };
  return `<div class="pk-rev" id="pkRevBox"><div class="pk-rev-h"><b>${TT("AI 自查", "AI self-check")}</b><small>${esc(r.by || "")}</small><span>${r.issues.length ? TT(`${r.issues.filter(x => x.severity === "error").length} 处错误 · ${r.issues.filter(x => x.severity !== "error").length} 条建议`, `${r.issues.filter(x => x.severity === "error").length} errors · ${r.issues.filter(x => x.severity !== "error").length} suggestions`) : TT("没有发现问题", "No problems found")}</span></div>
    ${r.summary ? `<p class="pk-rev-s">${esc(r.summary)}</p>` : ""}
    ${r.issues.map((x, i) => `<div class="pk-rev-i ${x.severity}${x.done ? " done" : ""}"><div><span class="pk-rev-tag">${x.severity === "error" ? TT("错误", "Error") : TT("建议", "Suggest")}</span><b>${esc(x.group)}${x.drug ? " · " + esc(x.drug) : ""}</b> <small>${FN[x.field] || esc(x.field)}</small></div>
      <p>${esc(x.problem)}</p>${x.fix ? `<p class="pk-rev-fix">→ ${esc(x.fix)}</p>` : ""}
      ${x.done ? `<small class="pk-rev-ok">${TT("已采纳", "Applied")}</small>` : x.fix && PG.REVIEW_FIELDS[x.field] ? `<button class="ibtn" data-fix="${i}">${TT("采纳这条", "Apply")}</button>` : ""}</div>`).join("")}
    <p class="pk-hint" style="margin-top:6px">${TT("自查也是 AI 给的意见，同样可能出错；采纳前请对照讲义。", "The self-check is AI too and can be wrong; compare with your notes before applying.")}</p></div>`;
}

/* 导入 / 删除后刷新页面：刷新完重新打开面板，显示结果 */
setTimeout(() => { let m = null; try { m = sessionStorage.getItem("pg_packmsg"); sessionStorage.removeItem("pg_packmsg"); } catch (e) {} if (m) packSheet(m); }, 0);
