/* 药理闯关 · 报错清单：用户标记“这题有问题” */
import { PG, reg } from "../core/registry.js";
import { reports, save } from "../core/state.js";
import { SFX } from "../music/sfx.js";

reg({ plain: () => plain, reportQ: () => reportQ, reportBtn: () => reportBtn });

/* “这题有问题”：把题目快照存进报错清单 */
export const plain = h => { const d = document.createElement("div"); d.innerHTML = h; return d.textContent.trim(); };
export function reportQ(q, picked, mode) {
  const ansText = q.multi ? q.ansSet.map(i => q.options[i]).join(" ／ ") : q.rank ? q.ansSeq.map(i => q.options[i]).join(" > ") : q.options[q.ans];
  reports.unshift({ t: Date.now(), mode, type: q.type, prompt: plain(q.prompt || ""), options: q.options.slice(), answer: ansText, picked: picked ?? null, note: "" });
  save();
}
export function reportBtn(onClick) {
  const b = document.createElement("button"); b.className = "ibtn"; b.textContent = "这题有问题";
  b.onclick = () => { onClick(); b.textContent = "已记入报错清单"; b.disabled = true; SFX.click(); };
  return b;
}
