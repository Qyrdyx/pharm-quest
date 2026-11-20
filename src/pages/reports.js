/* 药理闯关 · 报错清单页面 */
import { PG, reg } from "../core/registry.js";
import { $, esc } from "../core/utils.js";
import { TYPES } from "../data/index.js";
import { reports, save } from "../core/state.js";
import { SFX } from "../music/sfx.js";

reg({ reportsText: () => reportsText, renderReports: () => renderReports });

/* ---------- 报错清单 ---------- */
export function reportsText() {
  return reports.map((r, i) => `【${i + 1}】${r.mode} · ${TYPES[r.type] || ({ spell: "默写", ai: "AI 出题" }[r.type] || "病例")} · ${new Date(r.t).toLocaleString()}\n题目：${r.prompt}\n选项：${r.options.join(" | ")}\n标准答案：${r.answer}\n我的作答：${r.picked ?? "—"}${r.note ? "\n备注：" + r.note : ""}`).join("\n\n");
}
export function renderReports(body) {
  body.innerHTML = reports.length ? `<div class="q-actions" style="justify-content:flex-start"><button class="btn" id="rcopy">复制全部，发给 Claude</button><button class="ibtn" id="rclr">清空清单</button></div>
    <textarea id="rtext" class="search" style="height:120px;padding:10px 14px;border-radius:12px" readonly hidden></textarea>
    ${reports.map((r, i) => `<div class="wrow"><span class="cnt">${i + 1}</span><div class="body"><small>${esc(r.mode)} · ${esc(TYPES[r.type] || ({ spell: "默写", ai: "AI 出题" }[r.type] || "病例"))} · ${new Date(r.t).toLocaleString()}</small><br><b>${esc(r.prompt)}</b>
      <br><small>选项：${r.options.map(esc).join(" ｜ ")}</small><br><small>标准答案：${esc(r.answer)} · 我的作答：${esc(r.picked ?? "—")}</small>
      <input class="search rnote" data-i="${i}" placeholder="可选：写一句哪里有问题" value="${esc(r.note || "")}" style="height:36px;margin-top:6px;font-size:13px"></div>
      <button class="ibtn" data-del="${i}">删除</button></div>`).join("")}
    <p class="foot">复制后直接粘贴给我，我会逐条核对并修正题库。</p>`
    : `<p class="empty">还没有报错。答题后觉得题目有歧义或答案不对，点解析下面的“这题有问题”就会记到这里。</p>`;
  body.querySelectorAll(".rnote").forEach(inp => inp.addEventListener("change", () => { reports[+inp.dataset.i].note = inp.value.trim(); save(); }));
  body.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { reports.splice(+b.dataset.del, 1); save(); SFX.click(); PG.codex("report"); });
  const cp = $("#rcopy");
  if (cp) cp.onclick = () => {
    const txt = reportsText(), ta = $("#rtext");
    const fallback = () => { ta.hidden = false; ta.value = txt; ta.focus(); ta.select(); cp.textContent = "已选中文字，请手动复制"; };
    try { navigator.clipboard.writeText(txt).then(() => { cp.textContent = "已复制，粘贴给 Claude 即可"; SFX.right(); }, fallback); } catch (e) { fallback(); }
  };
  const rc = $("#rclr");
  if (rc) rc.onclick = () => {
    if (rc.dataset.armed) { PG.reports = []; save(); PG.codex("report"); }
    else { rc.dataset.armed = 1; rc.textContent = "再点一次确认清空"; setTimeout(() => { if (rc.isConnected) { delete rc.dataset.armed; rc.textContent = "清空清单"; } }, 3000); }
  };
}
