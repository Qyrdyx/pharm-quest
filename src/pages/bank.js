/* 药理闯关 · 题库总览与题目自检 */
import { PG, reg } from "../core/registry.js";
import { $, esc, reduceMotion } from "../core/utils.js";
import { CLASSES, DM, DR, FIELD, G, PAIRS, TYPES, aeItems, fact, pairOpt } from "../data/index.js";
import { poolDrugs, poolGroups, sel } from "../core/state.js";
import { SFX } from "../music/sfx.js";
import { label, mask } from "../engine/questions.js";
import { CASES, caseSteps, rxAnswer } from "../games/case.js";

reg({ clsIn: () => clsIn, bankItems: () => bankItems, ABS_RE: () => ABS_RE, WHY_RE: () => WHY_RE, lintStep: () => lintStep, lintAll: () => lintAll, BANK_TYPES: () => BANK_TYPES, BANK_NAME: () => BANK_NAME, renderBank: () => renderBank });

export const clsIn = inScope => CLASSES.filter(c => !inScope || sel.has(c.group));
export function bankItems(type, inScope) {
  const ds = inScope ? poolDrugs() : DR, gs = inScope ? poolGroups() : G;
  switch (type) {
    case "spellE": return ds.filter(PG.canSpell).map(d => [`写出中文名：${PG.enShow(d)}`, PG.cnShow(d)]);
    case "spellC": return ds.filter(PG.canSpell).map(d => [`写出英文名：${PG.cnShow(d)}`, PG.enShow(d)]);
    case "cn": return ds.filter(d => d.en !== d.zh).map(d => [T(`${d.en} 的中文名`, `Chinese name of ${d.en}`), d.zh]);
    case "en": return ds.filter(d => d.en !== d.zh).map(d => [T(`「${d.cn}」的英文名 / INN`, `English name / INN of ${d.zh}`), d.en]);
    case "group": return ds.map(d => [T(`${d.en}（${d.cn}）属于哪个药物组`, `Drug group of ${d.en}`), d.g.n]);
    case "note": return ds.filter(d => d.note).map(d => [`哪个药物：${mask(d.note, [d])}`, label(d)]);
    case "mech": return gs.filter(g => g.m).map(g => [`这是哪组的共同机制：${g.m}`, g.n]);
    case "feat": return gs.flatMap(g => ["i", "c", "d", "s", "a"].filter(k => g[k]).map(k => [`${FIELD[k]}：${g[k]}`, g.n]));
    case "odd": return gs.filter(g => g.drugs.length >= 3).map(g => [`下列哪一个不属于「${g.n}」`, "本组以外的那个药（每次随机）"]);
    case "pair": return PAIRS.filter(p => !inScope || sel.has(p.a.g.id) || sel.has(p.b.g.id)).flatMap(p => p.feats.map(f => [`「${f.t}」属于 ${p.a.cn} 还是 ${p.b.cn}？`, pairOpt(p, f.k)]));
    case "multi": return ds.filter(d => d.note && d.g.m).map(d => [`关于 ${d.en}，哪些说法正确（多选）`, "归组 / 中文名 / 特点 / 机制四类陈述随机真假"]);
    case "tf": return ds.map(d => [`判断：${d.en} 属于某个药物组`, d.g.n]);
    case "fm": return ds.filter(d => fact(d).m).map(d => [`哪个药的作用机制是：${mask(fact(d).m, [d])}`, label(d)]);
    case "dm": return ds.filter(d => fact(d).m).map(d => [`${d.cn} 的作用机制`, fact(d).m]);
    case "fi": return ds.filter(d => fact(d).i).map(d => [`哪个药主要用于：${mask(fact(d).i, [d])}`, label(d)]);
    case "di": return ds.filter(d => fact(d).i).map(d => [`${d.cn} 的主要适应证`, fact(d).i]);
    case "fa": return ds.flatMap(d => aeItems(d).map(x => [`哪个药的典型不良反应是：${x}`, label(d)]));
    case "da": return ds.filter(d => fact(d).a).map(d => [`${d.cn} 的典型不良反应`, fact(d).a]);
    case "ga": return gs.filter(g => g.a).map(g => [`这组不良反应属于哪个药物组：${g.a}`, g.n]);
    case "xf": return clsIn(inScope).flatMap(c => c.feats.filter(f => f[1].length === 1).map(f => [`${c.short}：哪个药具有「${f[0]}」`, DM.get(f[1][0]).cn]));
    case "xd": return clsIn(inScope).flatMap(c => c.ds.map(d => [`${c.short}：${d.cn} 的特点`, c.feats.filter(f => f[1].includes(d.no)).map(f => f[0]).join("；")]));
    case "xm": return clsIn(inScope).flatMap(c => c.feats.filter(f => f[1].length >= 2).map(f => [`${c.short}：哪些药「${f[0]}」`, f[1].map(n => DM.get(n).cn).join("、")]));
    case "xs": return clsIn(inScope).flatMap(c => (c.scen || []).map(sc => [`${c.short} 场景：${sc.q}`, DM.get(sc.ans).cn]));
    case "xr": return clsIn(inScope).flatMap(c => (c.scales || []).map(sc => [`${c.short}：按${sc[1]}从强到弱`, Object.entries(sc[2]).sort((a, b) => b[1] - a[1]).map(([n, v]) => DM.get(+n).cn).join(" ＞ ")]));
    case "case": return CASES.filter(c => !inScope || c.gids.some(id => sel.has(id))).flatMap(c => caseSteps(c).map(s => [`病例 ${c.id}「${c.title}」：${s.q}`, s.rx ? rxAnswer(s.rx) : s.o[0]]));
  }
  return [];
}
/* 出题质检：拦截“一眼就能猜到”的题 */
export const ABS_RE = /只|都|一定|绝不|所有|完全|永远/, WHY_RE = /因为|对抗|以便|从而|所以|以免/;
export function lintStep(s) {
  if (s.rx) return [];
  const it = s.o.map(x => Array.isArray(x) ? x[0] : x), c = it[0], ot = it.slice(1);
  const avg = ot.reduce((a, t) => a + t.length, 0) / ot.length, iss = [];
  if (c.length > 10 && c.length > avg * 1.4) iss.push(`正确选项偏长（${c.length} 字，干扰项平均 ${avg.toFixed(0)} 字）`);
  ot.forEach(t => { if (ABS_RE.test(t)) iss.push(`干扰项含绝对化用词：「${t}」`); });
  if (WHY_RE.test(c)) iss.push("正确选项里写了理由");
  if (s.o.slice(1).some(x => !Array.isArray(x))) iss.push("有干扰项没写“为什么不对”");
  return iss;
}
export function lintAll() {
  const out = [];
  CASES.forEach(c => caseSteps(c).forEach(s => { const iss = lintStep(s); out.push({ c, s, iss }); }));
  return out;
}
export const BANK_TYPES = [...Object.keys(TYPES), "spellE", "spellC", "case"];
export const BANK_NAME = t => t === "case" ? "病例分析步骤（含分支）" : t === "spellE" ? "中英默写 · 看 INN 写中文" : t === "spellC" ? "中英默写 · 看中文写 INN" : TYPES[t];
export function renderBank(body, open) {
  const rows = BANK_TYPES.map(t => [t, bankItems(t, false).length, bankItems(t, true).length]);
  const tot = rows.reduce((a, r) => a + r[1], 0), totS = rows.reduce((a, r) => a + r[2], 0);
  body.innerHTML = `<div class="scope" style="margin-top:6px">
      <div><div class="big">${tot}</div><div class="lbl">全部题目（题干数）</div></div>
      <div><div class="big">${totS}</div><div class="lbl">本次考试范围内</div></div>
      <div class="chips-mini" style="flex-basis:300px"><span>${DR.length} 种药 · ${G.length} 组 · ${PAIRS.length} ${LANG === "en" ? "confusable pairs" : "对易混药"} · ${CASES.length} 个病例</span><span>选择题的干扰项每次随机组合，所以实际可出的题比题干数多得多</span></div></div>
    <div class="table-wrap"><table class="btable"><thead><tr><th>题型</th><th>全部</th><th>本次范围</th><th></th></tr></thead><tbody>
      ${rows.map(([t, a, s]) => `<tr><td>${esc(BANK_NAME(t))}</td><td class="n">${a}</td><td class="n">${s}</td><td><button class="ibtn" data-b="${t}">浏览</button></td></tr>`).join("")}
      <tr class="tot"><td>合计</td><td class="n">${tot}</td><td class="n">${totS}</td><td></td></tr></tbody></table></div>
    <p class="foot">药柜分拣和中英配对直接使用“归属药物组”和“中英名”这两类题。</p>
    ${(() => {
      const L = lintAll(), bad = L.filter(x => x.iss.length);
      return `<div class="explain"><b style="font-size:17px">出题质检</b> <span class="eyebrow">病例题 ${L.length - bad.length}/${L.length} 通过</span>
        <p class="m">规则：正确选项不明显长于干扰项；干扰项不用“只、都、一定、所有”等绝对词；正确选项不写理由；每个干扰项都写明为什么不对。易混药物题统一用“A / B / 两者都是 / 两者都不是”四个固定选项，不存在长短提示。</p>
        ${bad.length ? `<ul class="whynot">${bad.map(x => `<li>✗ <b>病例 ${x.c.id}：${esc(x.s.q)}</b><br>${x.iss.map(esc).join("；")}</li>`).join("")}</ul>` : `<p style="color:var(--mint);font-weight:800">全部通过</p>`}</div>`;
    })()}
    <div id="bview"></div>`;
  const view = t => {
    const items = bankItems(t, true), all = bankItems(t, false);
    let scope = items.length ? "in" : "all";
    const draw = () => {
      const list = scope === "in" ? items : all, kw = ($("#bq")?.value || "").trim().toLowerCase();
      const f = kw ? list.filter(x => (x[0] + x[1]).toLowerCase().includes(kw)) : list;
      $("#blist").innerHTML = f.length ? f.map((x, i) => `<div class="brow"><span class="k">${i + 1}</span><div><div>${esc(x[0])}</div><div class="ans">答案：${esc(x[1])}</div></div></div>`).join("") : `<p class="empty">没有匹配的题目。</p>`;
      $("#bcount").textContent = `${f.length} 题`;
    };
    $("#bview").innerHTML = `<div class="explain"><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><b style="font-size:17px">${esc(BANK_NAME(t))}</b><span class="eyebrow" id="bcount"></span><span class="spacer"></span>
      <div class="seg"><button data-s="in" aria-pressed="${scope === "in"}">本次范围</button><button data-s="all" aria-pressed="${scope === "all"}">全部</button></div></div>
      <input class="search" id="bq" type="search" placeholder="在这个题型里搜索…"><div id="blist" class="blist"></div></div>`;
    $("#bview").querySelectorAll("[data-s]").forEach(b => b.onclick = () => { scope = b.dataset.s; $("#bview").querySelectorAll("[data-s]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); draw(); });
    $("#bq").addEventListener("input", draw); draw();
    $("#bview").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };
  body.querySelectorAll("[data-b]").forEach(b => b.onclick = () => { SFX.click(); view(b.dataset.b); });
  if (open) view(open);
}
