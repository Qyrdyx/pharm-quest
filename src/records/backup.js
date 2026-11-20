/* 药理闯关 · 备份与导入导出：完整备份、恢复、撤销、错题本 / 热力图导入导出 */
import { PG, reg } from "../core/registry.js";
import { $, TT, esc } from "../core/utils.js";
import { LS } from "../core/storage.js";
import { dstat, mastery, mwrong, save, stats, wrong } from "../core/state.js";
import { SFX } from "../music/sfx.js";
import { armConfirm, main } from "../ui/screen.js";
import { TOOL_ICON } from "../pages/home.js";

reg({ IO_T: () => IO_T, BK_SKIP: () => BK_SKIP, fullSnapshot: () => fullSnapshot, backupInfo: () => backupInfo, markBackup: () => markBackup, backupDue: () => backupDue, backupBanner: () => backupBanner, readUndo: () => readUndo, doRestore: () => doRestore, askPersist: () => askPersist, backupSheet: () => backupSheet, ioPayload: () => ioPayload, ioMerge: () => ioMerge, ioSheet: () => ioSheet });

/* ---------- 数据导出 / 导入（错题本、掌握度热力图），导入为合并 ---------- */
export const IO_T = { wrong: ["错题本", "mistake book"], mastery: ["掌握度热力图", "mastery heatmap"], full: ["全部数据", "all data"] };
/* ---------- 完整备份：把本机所有学习记录打包（不含 AI 密钥），恢复时整体覆盖，覆盖前自动留一份可撤销 ---------- */
export const BK_SKIP = k => k === "pg_lang" || k === "pg_errlog" || k.indexOf("pg_bk") === 0;   // 界面语言、备份提醒本身不进备份
export function fullSnapshot() {
  save(); const data = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf("pg_") === 0 && !BK_SKIP(k)) data[k] = localStorage.getItem(k); }
  if (data.pg_aiCfg) { try { const a = JSON.parse(data.pg_aiCfg); delete a.key; data.pg_aiCfg = JSON.stringify(a); } catch (e) {} }
  return data;
}
export function backupInfo() { return LS.get("bkMeta", { t: 0, n: 0, snooze: 0 }); }
export function markBackup() { LS.set("bkMeta", { t: Date.now(), n: stats.answered, snooze: 0 }); }
/* 需要提醒备份：上次备份后又答了 30 题以上，且从没备份过或已超过 7 天 */
export function backupDue() {
  const m = backupInfo(), since = stats.answered - (m.n || 0);
  if (Date.now() < (m.snooze || 0) || since < 30 || (m.t && Date.now() - m.t < 7 * 864e5)) return null;
  return { since, days: m.t ? Math.floor((Date.now() - m.t) / 864e5) : null };
}
export function backupBanner() {
  const d = backupDue(); if (!d) return "";
  return `<div class="bk-banner">${TOOL_ICON.save}<div class="bk-txt"><b>${d.days == null ? TT("学习记录还没有备份过", "Your progress has never been backed up") : TT(`已经 ${d.days} 天没有备份了`, `${d.days} days since your last backup`)}</b>
    <small>${TT(`期间又答了 ${d.since} 题。浏览器清理数据或换设备时，没备份的错题和掌握度会丢失。`, `${d.since} answers since then. Unsaved mistakes and mastery are lost if the browser clears its data or you switch devices.`)}</small></div>
    <button class="btn" id="bkNow">${TT("立即备份", "Back up now")}</button><button class="ibtn" id="bkLater">${TT("3 天后提醒", "Remind me in 3 days")}</button></div>`;
}
export function readUndo() { try { return JSON.parse(localStorage.getItem("pgbak_undo") || "null"); } catch (e) { return null; } }
export function doRestore(o) {
  const curKey = PG.aiCfg && PG.aiCfg.key;
  try { localStorage.setItem("pgbak_undo", JSON.stringify({ t: Date.now(), data: fullSnapshot() })); } catch (e) {}
  window.__restoring = true;   // 之后不再把内存里的旧数据写回去
  const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf("pg_") === 0 && !BK_SKIP(k)) ks.push(k); }
  ks.forEach(k => localStorage.removeItem(k));
  Object.entries(o.data).forEach(([k, v]) => { if (k.indexOf("pg_") === 0 && !BK_SKIP(k) && typeof v === "string") { try { localStorage.setItem(k, v); } catch (e) {} } });
  if (curKey) { try { const a = JSON.parse(localStorage.getItem("pg_aiCfg") || "{}"); if (!a.key) { a.key = curKey; localStorage.setItem("pg_aiCfg", JSON.stringify(a)); } } catch (e) {} }   // 保留本机的 AI 密钥
  location.reload();
}
/* 浏览器的“持久存储”：开了之后空间紧张时不会自动清掉本站数据 */
export function askPersist() { try { if (navigator.storage && navigator.storage.persist) return navigator.storage.persisted().then(p => p || navigator.storage.persist()).catch(() => false); } catch (e) {} return Promise.resolve(null); }
addEventListener("pointerdown", () => askPersist(), { once: true, capture: true });
export function backupSheet() {
  const host = $("#sheetHost"), m = backupInfo(), undo = readUndo();
  const when = t => t ? new Date(t).toLocaleString() : TT("从未备份", "Never");
  host.innerHTML = `<div class="sheet-bg" id="bkbg"><div class="sheet io-box" role="dialog"><h2>${TT("数据备份与恢复", "Backup & restore")}</h2>
    <p>${TT("错题本、连线错题、高频错误、掌握度热力图、轮换记录、设置和歌单、AI 题库，都只存在这台设备的浏览器里。浏览器清理网站数据、很久不打开（iPad 上较常见）、换设备或换浏览器时都可能丢失。定期备份成一个文件，丢了可以一次恢复。", "Mistakes, matching mistakes, frequent mistakes, mastery, rotation records, settings, playlist and the AI question bank live only in this device's browser. They can be lost when the browser clears site data, after long inactivity (common on iPad), or when you switch devices or browsers. Back up to one file regularly and restore it all at once.")}</p>
    <div class="bk-stat"><div><small>${TT("上次备份", "Last backup")}</small><b>${when(m.t)}</b></div><div><small>${TT("之后新答", "Answered since")}</small><b>${Math.max(0, stats.answered - (m.n || 0))} ${TT("题", "")}</b></div><div><small>${TT("防自动清理", "Protected from cleanup")}</small><b id="bkPersist">${TT("检查中…", "Checking…")}</b></div></div>
    <div class="io-row"><button class="btn" id="bkExp">${TT("备份全部数据", "Back up everything")}</button><button class="ibtn" id="bkImp">${TT("从备份恢复", "Restore from backup")}</button>${undo ? `<button class="ibtn" id="bkUndo">${TT("撤销上次恢复", "Undo last restore")}</button>` : ""}</div>
    <p style="font-size:12px;margin-top:10px">${TT("备份文件不含 AI 密钥。恢复会用备份覆盖本机当前的记录，覆盖前会自动保留一份，可以撤销。", "Backups never include your AI key. Restoring replaces this device's records; the current data is kept once so you can undo.")}${undo ? TT(`（可撤销到 ${when(undo.t)} 恢复之前的状态）`, ` (Undo returns to the state before ${when(undo.t)}.)`) : ""}</p>
    <div class="close-row"><button class="btn ghost" id="bkClose">${TT("关闭", "Close")}</button></div></div></div>`;
  const close = () => { host.innerHTML = ""; if (main.querySelector(".hero")) PG.home(); };
  $("#bkbg").addEventListener("click", e => { if (e.target.id === "bkbg") close(); });
  $("#bkClose").onclick = () => { SFX.click(); close(); };
  $("#bkExp").onclick = () => { SFX.click(); ioSheet("full", "export", backupSheet); };
  $("#bkImp").onclick = () => { SFX.click(); ioSheet("full", "import"); };
  armConfirm($("#bkUndo"), TT("再点一次确认撤销", "Tap again to undo"), () => { const u = readUndo(); if (u && u.data) { try { sessionStorage.setItem("pg_undoFlag", "1"); } catch (e) {} doRestore(u); } });   // 记号：刷新后补记彩蛋成就“Ctrl+Z”
  const ps = $("#bkPersist");
  const show2 = p => { if (!ps.isConnected) return; ps.textContent = p == null ? TT("此浏览器不支持", "Not supported here") : p ? TT("已开启", "On") : TT("未开启（空间紧张时可能被清理）", "Off (may be cleared when space is low)"); };
  try { if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(show2, () => show2(null)); else show2(null); } catch (e) { show2(null); }
}
export function ioPayload(type) {
  if (type === "full") return { app: "pharm-quest", type, v: 1, t: Date.now(), data: fullSnapshot() };
  return type === "wrong" ? { app: "pharm-quest", type, v: 1, t: Date.now(), wrong, mwrong, dstat } : { app: "pharm-quest", type, v: 1, t: Date.now(), mastery };
}
export function ioMerge(type, o) {
  if (!o || o.app !== "pharm-quest" || o.type !== type) throw new Error("bad file");
  let n = 0;
  const maxMerge = (dst, src) => Object.entries(src || {}).forEach(([k, v]) => { if (typeof v === "number" && v > 0 && !(dst[k] >= v)) { dst[k] = v; n++; } });
  if (type === "wrong") {
    maxMerge(wrong, o.wrong); maxMerge(mwrong, o.mwrong);
    Object.entries(o.dstat || {}).forEach(([k, v]) => { if (!v || typeof v !== "object") return; const x = dstat[k]; if (!x || (v.w || 0) + (v.r || 0) > (x.w || 0) + (x.r || 0)) { dstat[k] = v; n++; } });
  } else Object.entries(o.mastery || {}).forEach(([k, v]) => { if (!v || !v.a) return; const x = mastery[k]; if (!x || v.a > (x.a || 0)) { mastery[k] = v; n++; } });
  save(); return n;
}
export function ioSheet(type, mode, after) {
  const host = $("#sheetHost"), nm = TT(IO_T[type][0], IO_T[type][1]);
  const json = mode === "export" ? JSON.stringify(ioPayload(type)) : "";
  const fname = `药理闯关-${IO_T[type][0]}-${new Date().toISOString().slice(0, 10)}.json`;
  host.innerHTML = `<div class="sheet-bg" id="iobg"><div class="sheet io-box" role="dialog">
    <h2>${mode === "export" ? TT("导出", "Export ") + nm : TT("导入", "Import ") + nm}</h2>
    ${mode === "export" ? `<p>${TT("点“下载文件”保存。如果当前浏览器不能下载，就点“复制内容”，粘贴到备忘录或发给自己；以后在“导入”里粘贴回来即可。", "Tap “Download file” to save. If this browser can't download, tap “Copy” and paste it into a note or message; paste it back under Import later.")}</p>
      <div class="io-row"><button class="btn" id="ioDl">${TT("下载文件", "Download file")}</button><button class="ibtn" id="ioCp">${TT("复制内容", "Copy")}</button><span class="io-msg" id="ioMsg"></span></div>
      <textarea id="ioTxt" readonly>${esc(json)}</textarea>`
    : `<p>${TT("选择之前导出的 .json 文件，或把导出的内容粘贴到下面。导入是合并：同一条记录保留次数更多（作答更多）的那份，不会删掉本机已有的记录。", "Pick a previously exported .json file, or paste its content below. Importing merges: for each entry the larger count is kept, nothing on this device is deleted.")}</p>
      <div class="io-row"><button class="btn" id="ioPick">${TT("选择文件", "Choose file")}</button><input id="ioFile" type="file" accept=".json,application/json,text/plain" style="display:none"><span class="io-msg" id="ioMsg"></span></div>
      <textarea id="ioTxt" placeholder="${TT("或者把导出的内容粘贴到这里…", "…or paste the exported content here")}"></textarea>
      <div class="io-row"><button class="btn" id="ioGo">${TT("导入粘贴的内容", "Import pasted content")}</button></div><div id="ioConfirm"></div>`}
    <div class="close-row"><button class="btn ghost" id="ioClose">${TT("关闭", "Close")}</button></div></div></div>`;
  const msg = (t, ok = true) => { const m = $("#ioMsg"); m.textContent = t; m.style.color = ok ? "var(--mint)" : "var(--rose)"; };
  let changed = false;
  const done = t => { msg(t); if (type === "full") { markBackup(); changed = true; } };   // 完整备份导出成功：记下备份时间
  const close = () => { host.innerHTML = ""; if (changed && after) after(); };
  $("#iobg").addEventListener("click", e => { if (e.target.id === "iobg") close(); });
  $("#ioClose").onclick = () => { SFX.click(); close(); };
  if (mode === "export") {
    $("#ioDl").onclick = async () => {
      SFX.click();
      // 在线版（claude.ai 里）走平台的下载确认；离线版直接用浏览器下载
      let dl = null; try { if (window.claude && window.claude.use) dl = await window.claude.use("downloads"); } catch (e) {}
      if (dl) {
        try { await dl.save({ filename: fname, data: json }); done(TT("已保存：", "Saved: ") + fname); }
        catch (e) { const c = e && e.code; msg(c === "declined" ? TT("已取消保存", "Save cancelled") : c === "rate_limited" ? TT("稍等一下再点", "Wait a moment and try again") : TT("这里不能下载，请用“复制内容”", "Download not available here; use Copy"), c === "declined"); }
        return;
      }
      try { const url = URL.createObjectURL(new Blob([json], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000); done(TT("已开始下载：", "Downloading: ") + fname); }
      catch (e) { msg(TT("这个浏览器不能下载，请用“复制内容”", "Download not supported here; use Copy"), false); }
    };
    $("#ioTxt").addEventListener("copy", () => done(TT("已复制", "Copied")));   // 长按手动复制也算备份过
    $("#ioCp").onclick = async () => {
      SFX.click(); const ta = $("#ioTxt");
      try { await navigator.clipboard.writeText(json); msg(TT("已复制", "Copied")); }
      catch (e) { ta.focus(); ta.select(); try { document.execCommand("copy") ? msg(TT("已复制", "Copied")) : msg(TT("请长按文本框手动复制", "Long-press the box to copy"), false); } catch (e2) { msg(TT("请长按文本框手动复制", "Long-press the box to copy"), false); } }
    };
  } else {
    const run = txt => {
      let o = null; try { o = JSON.parse(txt); } catch (e) {}
      if (type === "full" && o && o.app === "pharm-quest" && o.type === "full" && o.data && typeof o.data === "object") {   // 完整备份：先确认再覆盖
        const n = Object.keys(o.data).length;
        $("#ioConfirm").innerHTML = `<div class="restore-box">${TT(`备份时间：${new Date(o.t).toLocaleString()}，共 ${n} 项数据。恢复会用它覆盖本机当前的全部学习记录（覆盖前自动保留一份，可以撤销）。`, `Backup from ${new Date(o.t).toLocaleString()}, ${n} items. Restoring replaces all records on this device (the current data is kept once so you can undo).`)}
          <div class="io-row"><button class="btn red" id="ioRestore">${TT("确认恢复", "Restore now")}</button></div></div>`;
        $("#ioRestore").onclick = () => { SFX.click(); doRestore(o); };
        msg(TT("已读取备份，请确认", "Backup loaded — please confirm")); return;
      }
      try { const n = ioMerge(type === "full" && o ? o.type : type, o); changed = true; SFX.right(); msg(TT(`导入成功，合并了 ${n} 条记录`, `Imported — ${n} entries merged`)); }
      catch (e) { SFX.wrong(); msg(TT("导入失败：这不是本软件导出的", "Import failed: this is not exported ") + nm + TT("数据", " data"), false); }
    };
    $("#ioPick").onclick = () => { SFX.click(); $("#ioFile").click(); };
    $("#ioFile").onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => run(String(r.result)); r.readAsText(f); };
    $("#ioGo").onclick = () => { const t = $("#ioTxt").value.trim(); if (t) run(t); else msg(TT("先粘贴内容", "Paste something first"), false); };
  }
}
