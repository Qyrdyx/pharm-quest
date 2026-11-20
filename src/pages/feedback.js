/* 药理闯关 · 意见反馈：写意见，一键整理出错记录和错题，发邮件给作者（或复制 / 存成文件再发）
 * 软件是离线的，没有服务器：“发邮件”是打开本机的邮件 App（mailto:），内容已经填好；
 * 邮件链接有长度限制，内容太长时只放意见，完整报告自动复制到剪贴板，让用户粘贴进去或附上存好的 txt。 */
import { PG, reg } from "../core/registry.js";
import { $, TT, esc } from "../core/utils.js";
import { wrong } from "../core/state.js";
import { DM, GM } from "../data/index.js";
import { errLog, errReport } from "../core/errlog.js";
import { show } from "../ui/screen.js";
import { SFX } from "../music/sfx.js";
import { saveFile } from "./packs.js";

Object.assign(PG, { feedbackPage });   // 页面跳转函数：core/nav.js 会包一层

export const FEEDBACK_EMAIL = "qyrdyx1@gmail.com";
const MAILTO_MAX = 1800;   // 邮件链接（编码后）超过这个长度，很多邮件 App 会截断或打不开

/* 选择题错题：药 + 错了几次（按次数排） */
function quizWrongs() {
  return Object.entries(wrong).map(([k, n]) => {
    if (k[0] === "g") { const g = GM.get(+k.slice(1)); return g ? { name: TT("［整组］", "[group] ") + g.n, n } : null; }
    const d = DM.get(+k); return d ? { name: `${d.en} ${d.cn || ""}`.trim(), n } : null;
  }).filter(Boolean).sort((a, b) => b.n - a.n);
}
/* 连线错题：按连线种类 */
const MW_NAME = { mia: ["三合一", "3-in-1"], cn: ["中英", "names"], m: ["机制", "mechanism"], i: ["适应证", "indication"], a: ["不良反应", "adverse effect"] };
function matchWrongs() { return PG.mwKinds ? PG.mwKinds().map(([k, ids]) => ({ k, list: ids.map(id => DM.get(id)).filter(Boolean) })) : []; }

function compose(o) {
  const parts = [];
  parts.push(`【${TT("意见 / 建议", "Feedback")}】\n${o.text.trim() || TT("（没写）", "(none)")}`);
  if (o.errs) parts.push(`【${TT("出错记录和设备信息", "Error log & device info")}】\n${errReport().trim()}`);
  if (o.wrongs) {
    const q = quizWrongs(), m = matchWrongs();
    const lines = [];
    lines.push(TT(`选择题错题 ${q.length} 个：`, `Quiz mistakes (${q.length}):`));
    q.slice(0, 80).forEach(x => lines.push(`  ${x.name} ×${x.n}`)); if (q.length > 80) lines.push(`  …+${q.length - 80}`);
    m.forEach(({ k, list }) => { lines.push(TT(`连线错题 · ${MW_NAME[k][0]} ${list.length} 个：`, `Matching mistakes · ${MW_NAME[k][1]} (${list.length}):`)); lines.push("  " + list.slice(0, 60).map(d => d.en).join(", ") + (list.length > 60 ? ` …+${list.length - 60}` : "")); });
    if (!q.length && !m.length) lines.push(TT("  （没有错题）", "  (none)"));
    parts.push(`【${TT("错题", "Mistakes")}】\n${lines.join("\n")}`);
  }
  return parts.join("\n\n") + "\n";
}

export function feedbackPage() {
  const nErr = errLog().length, nQ = quizWrongs().length, nM = matchWrongs().reduce((s, x) => s + x.list.length, 0);
  show(`<div class="sel-head"><div><div class="eyebrow">${TT("意见反馈", "Feedback")}</div><h2 style="font-size:28px">${TT("给作者提意见 / 报错", "Send feedback or a bug report")}</h2>
      <p style="color:var(--mute);margin:6px 0 0;max-width:66ch">${TT("写下遇到的问题或者想要的功能，勾选要附上的内容，点“发邮件”就会打开你的邮件 App，内容已经填好。作者邮箱：", "Describe the problem or the feature you'd like, choose what to attach, and tap “Send email” — your mail app opens with everything filled in. Author's email: ")}<b class="fb-mail">${FEEDBACK_EMAIL}</b></p></div></div>
    <div class="fb-box">
      <textarea id="fbText" rows="5" placeholder="${TT("比如：哪个页面、做了什么、出了什么问题；或者哪道题的答案有疑问……", "e.g. which page, what you did, what went wrong — or which question looks wrong…")}"></textarea>
      <label class="fb-chk"><input type="checkbox" id="fbErr" checked> ${TT(`附上出错记录和设备信息（${nErr} 条出错记录）`, `Attach error log & device info (${nErr} entries)`)}</label>
      <label class="fb-chk"><input type="checkbox" id="fbWrong" ${nQ + nM ? "checked" : ""}> ${TT(`附上错题（选择题 ${nQ} 个，连线 ${nM} 个）`, `Attach mistakes (quiz ${nQ}, matching ${nM})`)}</label>
      <p class="fb-priv">${TT("只会附上出错信息、设备 / 浏览器信息和错题药名，不含 AI 密钥和其他个人数据。发送前可以在下面预览全部内容。", "Only error details, device / browser info and the names of missed drugs are attached — no AI keys or other personal data. Preview everything below before sending.")}</p>
      <div class="io-row"><button class="btn" id="fbSend">${TT("发邮件", "Send email")}</button><button class="btn ghost" id="fbCopy">${TT("复制全部内容", "Copy everything")}</button><button class="btn ghost" id="fbSave">${TT("存成文件", "Save as file")}</button></div>
      <p class="io-msg" id="fbMsg"></p>
      <details class="fb-prev"><summary>${TT("预览要发送的内容", "Preview what will be sent")}</summary><textarea id="fbOut" readonly spellcheck="false"></textarea></details>
      <p class="fb-alt">${TT("邮件 App 打不开？复制全部内容或存成文件，用任何邮箱发到 ", "No mail app? Copy everything or save the file and send it from any email to ")}<b>${FEEDBACK_EMAIL}</b>${TT("，或者直接发给作者。", ", or send it to the author directly.")}</p>
    </div>`,
  () => {
    const opt = () => ({ text: $("#fbText").value, errs: $("#fbErr").checked, wrongs: $("#fbWrong").checked });
    const out = () => { const t = compose(opt()); $("#fbOut").value = t; return t; };
    const msg = (t, ok = true) => { const m = $("#fbMsg"); m.textContent = t; m.style.color = ok ? "var(--mint)" : "var(--rose)"; };
    ["#fbText", "#fbErr", "#fbWrong"].forEach(s => $(s).addEventListener("input", out)); ["#fbErr", "#fbWrong"].forEach(s => $(s).addEventListener("change", out));
    out();
    const copy = async t => { try { await navigator.clipboard.writeText(t); return true; } catch (e) { const o = $("#fbOut"); o.closest("details").open = true; o.focus(); o.select(); return false; } };
    $("#fbCopy").onclick = async () => { SFX.click(); msg(await copy(out()) ? TT("已复制，可以粘贴到邮件或聊天里发给作者", "Copied — paste it into an email or message to the author") : TT("这里不能直接复制：内容已经选中，按 Ctrl+C（手机上长按 → 复制）", "Can't copy automatically: the text is selected — press Ctrl+C (or long-press → Copy)"), true); };
    $("#fbSave").onclick = async () => { SFX.click(); try { msg(await saveFile(`药理闯关-意见反馈-${new Date().toISOString().slice(0, 10)}.txt`, out())); } catch (e) { if (e && e.code === "declined") return msg(TT("已取消保存", "Save cancelled")); msg(TT("这里不能下载，可以用“复制全部内容”", "Download unavailable — use Copy everything"), false); } };
    $("#fbSend").onclick = async () => {
      SFX.click(); const full = out(), subj = `${TT("药理闯关 意见反馈", "PharmQuest feedback")} · ${PG.APP_VERSION || ""}`;
      let body = full, note = TT("已打开邮件 App，确认后发送就行", "Your mail app should open — just hit send");
      if (encodeURIComponent(body).length > MAILTO_MAX) {   // 太长：邮件正文只放意见，完整内容复制到剪贴板
        const copied = await copy(full);
        body = `${opt().text.trim()}\n\n${copied ? TT("（完整的出错记录和错题已经复制好了，请在这里粘贴）", "(The full error log and mistakes are on your clipboard — please paste them here.)") : TT("（完整内容太长，请附上“存成文件”保存的 txt）", "(The full report is too long — please attach the saved .txt file.)")}`;
        note = copied ? TT("内容较长：邮件里只放了意见，完整报告已复制，在邮件里粘贴一下再发送", "Long report: only your note is in the email — paste the copied report before sending") : TT("内容较长：请先“存成文件”，作为附件发送", "Long report: save it as a file and attach it");
      }
      location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
      msg(note);
    };
  });
}
