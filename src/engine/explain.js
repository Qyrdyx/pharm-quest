/* 药理闯关 · 答题解析卡片 */
import { PG, reg } from "../core/registry.js";
import { esc } from "../core/utils.js";
import { FACT_NAME, FIELD, fact, zhAlt } from "../data/index.js";
import { packTag } from "../data/packs.js";
import { clsExplain } from "./questions.js";

reg({ explainHTML: () => explainHTML });

/* 解析卡片 */
export function explainHTML(q, ok) {
  if (q.ref.cls) return clsExplain(q, ok);
  const v = ok ? `<div class="verdict ok">回答正确</div>`
    : q.multi ? `<div class="verdict no">正确选项：</div><p>${q.ansSet.map(i => "✓ " + esc(q.options[i])).join("<br>")}</p>`
    : `<div class="verdict no">${LANG === "en" ? "Correct answer: " : "正确答案："}${esc(q.options[q.ans])}</div>`;
  if (q.ref.ai) return v + PG.aiExplain(q);
  if (q.ref.fact) {
    const d = q.ref.drug, f = fact(d), k = q.ref.fact;
    return v + `<div class="ex-drug"><span class="no">#${d.no}</span><b>${esc(d.en)}</b><span>${esc(zhAlt(d))}</span></div><span class="gchip">#${d.g.id} ${esc(d.g.n)}</span>
      <dl class="facts" style="margin-top:8px">${["m", "i", "a"].map(x => `<dt>${FACT_NAME[x]}</dt><dd${x === k ? ' class="hl"' : ""}>${esc(f[x])}</dd>`).join("")}</dl>
      ${q.ref.item ? `<p class="m"><em>考点</em>「${esc(q.ref.item)}」是${esc(d.cn)}的典型不良反应</p>` : ""}`;
  }
  if (q.ref.pair) {
    const p = q.ref.pair, mk = (f, k) => f.k === k || f.k === "AB" ? `<td class="y">✓</td>` : `<td class="x">✗</td>`;
    return v + `<p class="m"><em>对比表</em>本对药物的全部考点</p><div class="table-wrap"><table class="cmp"><thead><tr><th>特征</th><th>${esc(p.a.cn)}</th><th>${esc(p.b.cn)}</th></tr></thead><tbody>
      ${p.feats.map(f => `<tr class="${f === q.ref.feat ? "cur" : ""}"><td>${esc(f.t)}</td>${mk(f, "A")}${mk(f, "B")}</tr>`).join("")}</tbody></table></div>
      <p class="m"><em>${esc(p.a.cn)}</em>${esc(p.a.g.n)} · ${esc(p.a.note)}</p><p class="m"><em>${esc(p.b.cn)}</em>${esc(p.b.g.n)} · ${esc(p.b.note)}</p>`;
  }
  if (q.ref.group) {
    const g = q.ref.group;
    return v + `<span class="gchip">#${g.id} ${esc(g.n)} · ${esc(g.e)}</span>${packTag(g)}
      <p><b>${FIELD[q.ref.field]}</b>：${esc(g[q.ref.field])}</p>
      <p class="m"><em>本组药物</em>${g.drugs.map(a => esc(a[1]) + (LANG === "en" ? "" : " " + esc(a[2]))).join("、")}</p>`;
  }
  const d = q.ref.drug;
  return v + `<div class="ex-drug"><span class="no">#${d.no}</span><b>${esc(d.en)}</b><span>${esc(zhAlt(d))}</span></div>
    <span class="gchip">#${d.g.id} ${esc(d.g.n)}</span>${packTag(d.g)}${q.ref.odd ? ` <span class="gchip" style="color:var(--rose)">不属于 ${esc(q.ref.odd.n)}</span>` : ""}
    <p>${esc(d.note)}</p><p class="m"><em>组机制</em>${esc(d.g.m)}</p>`;
}
