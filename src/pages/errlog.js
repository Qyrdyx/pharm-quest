/* 药理闯关 · 出错记录面板：查看、复制、存成文件、清空 */
import { reg } from "../core/registry.js";
import { $, TT, esc } from "../core/utils.js";
import { APP_VERSION, clearErrLog, errLog, errReport } from "../core/errlog.js";
import { SFX } from "../music/sfx.js";
import { armConfirm } from "../ui/screen.js";
import { saveFile } from "./packs.js";

reg({ errSheet: () => errSheet });

export function errSheet() {
  const host = $("#sheetHost"), log = errLog();
  host.innerHTML = `<div class="sheet-bg" id="erbg"><div class="sheet io-box" role="dialog" aria-label="${TT("出错记录", "Error log")}">
    <h2>${TT("出错记录", "Error log")}</h2>
    <p>${TT("软件出错时会自动记在这里（最多 50 条）。遇到问题，把记录复制或存成文件发给作者，方便排查。记录里只有出错信息和设备、浏览器信息，不含学习记录和 AI 密钥。", "Errors are recorded here automatically (up to 50). If something goes wrong, copy or save the log and send it to the author. It contains only error details and device/browser info — no study records or API keys.")}</p>
    <p style="font-size:12px;color:var(--mute)">${TT("版本", "Version")} ${esc(APP_VERSION)} · ${log.length ? TT(`共 ${log.length} 条`, `${log.length} entries`) : TT("没有出错记录", "No errors recorded")}</p>
    <p class="io-msg" id="erMsg" style="margin:6px 0"></p>
    ${log.length ? `<div class="er-list">${log.slice().reverse().map(x => `<div class="er-it"><div class="er-h"><b>${esc(x.where || "-")}</b>${x.page ? `<small>@${esc(x.page)}</small>` : ""}${x.n > 1 ? `<small>×${x.n}</small>` : ""}<span>${new Date(x.t).toLocaleString()}</span></div><p>${esc(x.msg)}</p></div>`).join("")}</div>` : ""}
    <div class="io-row"><button class="btn" id="erCopy">${TT("复制报告", "Copy report")}</button><button class="ibtn" id="erSave">${TT("存成文件", "Save as file")}</button>${log.length ? `<button class="ibtn" id="erClear">${TT("清空记录", "Clear log")}</button>` : ""}</div>
    <textarea id="erTxt" readonly spellcheck="false" style="min-height:140px;font-family:var(--f-mono);font-size:11px">${esc(errReport())}</textarea>
    <div class="close-row"><button class="btn ghost" id="erClose">${TT("关闭", "Close")}</button></div></div></div>`;
  const msg = (t, ok = true) => { const m = $("#erMsg"); m.textContent = t; m.style.color = ok ? "var(--mint)" : "var(--rose)"; };
  const close = () => { host.innerHTML = ""; };
  $("#erbg").addEventListener("click", e => { if (e.target.id === "erbg") close(); });
  $("#erClose").onclick = () => { SFX.click(); close(); };
  $("#erCopy").onclick = async () => {
    SFX.click(); const t = $("#erTxt");
    try { await navigator.clipboard.writeText(t.value); msg(TT("已复制，可以粘贴到微信 / QQ 发给作者", "Copied — paste it into a message to the author")); }
    catch (e) { t.focus(); t.select(); msg(TT("这里不能直接复制：报告已经选中，按 Ctrl+C（手机上长按 → 复制）", "Can't copy automatically: the report is selected — press Ctrl+C (or long-press → Copy)"), false); }
  };
  $("#erSave").onclick = async () => {
    SFX.click();
    try { msg(await saveFile(`药理闯关-出错记录-${new Date().toISOString().slice(0, 10)}.txt`, errReport())); }
    catch (e) { if (e && e.code === "declined") return msg(TT("已取消保存", "Save cancelled")); msg(TT("这里不能下载，可以用“复制报告”", "Download unavailable — use Copy report"), false); }
  };
  armConfirm($("#erClear"), TT("再点一次确认清空", "Tap again to clear"), () => { clearErrLog(); SFX.click(); errSheet(); });
}
