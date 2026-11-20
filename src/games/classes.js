/* 药理闯关 · 同类药物辨析 */
import { PG, reg } from "../core/registry.js";
import { $, esc } from "../core/utils.js";
import { LS } from "../core/storage.js";
import { CLASSES, G, GM, enAlt } from "../data/index.js";
import { packTag } from "../data/packs.js";
import { cfg } from "../core/state.js";
import { SFX } from "../music/sfx.js";
import { main, show } from "../ui/screen.js";
import { bagProgress } from "../records/rotation.js";
import { bankItems } from "../pages/bank.js";

reg({ CLS_MODES: () => CLS_MODES, clsSel: () => clsSel }, { clsSel: v => { clsSel = v; } });
Object.assign(PG, { classHub, classPage, classTable });   // 页面跳转函数：core/nav.js 会包一层，记录返回路径

/* ---------- 同类药物辨析 ---------- */
export const CLS_MODES = [
  ["综合辨析闯关", ["xf", "xd", "xs"], "特点辨认和临床场景混合出题，专练每个药最有代表性的那几条特点。"],
  ["特点辨认", ["xf", "xd"], "这个特点属于哪个药（如“粒细胞缺乏”“Reye 综合征”）、这个药的特点是哪一条。"],
  ["临床场景选药", ["xs"], "给一个具体病人，从同类药里挑最合适（或最不该用）的那一个，每个错误选项都说明为什么不选。"]
];
/* 混合考试选中的类别（记在本机浏览器里，下次打开还在） */
export let clsSel = new Set(LS.get("clsSel", CLASSES.map(c => c.id)).filter(id => CLASSES.some(c => c.id === id)));
export function classHub() {
  show(`<div class="sel-head"><div><div class="eyebrow">专项板块</div><h2 style="font-size:28px">同类药物辨析</h2>
      <p style="color:var(--mute);margin:6px 0 0;max-width:64ch">同一大类的药共用一套机制，考试却最爱考它们的区别。可以点进某一类单独练，也可以勾选几类混在一起考。</p></div></div>
    <div class="mixbox">
      <div class="mixhead"><div><div class="eyebrow">混合考试范围</div><div class="mixsum" id="mixSum"></div></div>
        <div class="sel-tools"><button class="ibtn" id="mixAll">全选</button><button class="ibtn" id="mixNone">全不选</button></div></div>
      <div class="mixchips">${CLASSES.map(c => `<button class="chip" data-mc="${c.id}" aria-pressed="${clsSel.has(c.id)}"><span class="dot">${c.group}</span>${esc(c.short)}<span class="n">${c.ds.length}</span></button>`).join("")}</div>
      <div class="modes mixmodes">${CLS_MODES.map(([nm, ts, ds], i) => `<button class="mode" data-mq="${i}"><span class="tag">混合 · ${cfg.count ? cfg.count + " 题" : "无尽"}</span><h3>${nm}</h3><p>${ds}</p></button>`).join("")}</div>
      <p class="foot" style="margin-top:8px">混合考试时，每道题的选项仍只来自这个药所在的那一类，专练同类之间的区别。</p>
    </div>
    <h3 style="font-size:18px;margin-top:22px">单独练某一类</h3>
    <div class="case-list">${CLASSES.map(c => `<button class="ccard cls-card" data-c="${c.id}"><span class="ava cls-ava">${c.ds.length}<small>种药</small></span>
      <span style="min-width:0"><span class="who">#${GM.get(c.group)?.dot || c.group} ${esc(GM.get(c.group)?.n || "")}${packTag(GM.get(c.group))}</span><h3>${esc(c.name)}</h3><div class="dx">${esc(c.intro)}</div>
      <span class="gs">${c.ds.map(d => `<span>${esc(d.cn)}</span>`).join("")}</span></span></button>`).join("")}</div>
    <h3 style="font-size:18px;margin-top:22px">暂未制作（药物不足 4 种）</h3>
    <div class="chips-mini" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${G.filter(g => g.drugs.length >= 2 && !CLASSES.some(c => c.group === g.id)).map(g => `<span class="planned">#${g.id} ${esc(g.n)}</span>`).join("")}</div>
    <p class="foot">想做哪一组，直接告诉 Claude。</p>`,
  () => {
    // 勾选只更新这块区域，不重画整页，滚动位置不变
    const refresh = () => {
      const cs = CLASSES.filter(c => clsSel.has(c.id)), nd = cs.reduce((a, c) => a + c.ds.length, 0);
      main.querySelectorAll("[data-mc]").forEach(b => b.setAttribute("aria-pressed", String(clsSel.has(b.dataset.mc))));
      const bp = bagProgress("cls", cs.flatMap(c => c.ds));
      $("#mixSum").innerHTML = cs.length ? `已选 <b>${cs.length}</b> 类 · <b>${nd}</b> 种药 · 本轮已考 <b>${bp.done}</b> / ${bp.total}` : `<span style="color:var(--rose)">还没选类别，至少勾选一类</span>`;
      main.querySelectorAll("[data-mq]").forEach(b => b.disabled = !cs.length);
      LS.set("clsSel", [...clsSel]);
    };
    main.querySelectorAll("[data-mc]").forEach(b => b.onclick = () => { const id = b.dataset.mc; clsSel.has(id) ? clsSel.delete(id) : clsSel.add(id); SFX.click(); refresh(); });
    $("#mixAll").onclick = () => { clsSel = new Set(CLASSES.map(c => c.id)); SFX.click(); refresh(); };
    $("#mixNone").onclick = () => { clsSel.clear(); SFX.click(); refresh(); };
    main.querySelectorAll("[data-mq]").forEach(b => b.onclick = () => {
      const cs = CLASSES.filter(c => clsSel.has(c.id)); if (!cs.length) return;
      SFX.pick(); const [nm, ts] = CLS_MODES[+b.dataset.mq];
      const title = (cs.length === 1 ? cs[0].short : `混合 ${cs.length} 类`) + " · " + nm;
      PG.startQuiz(cs.flatMap(c => c.ds), { mode: "cls", types: ts, title });
    });
    main.querySelectorAll(".cls-card").forEach(b => b.onclick = () => { SFX.pick(); PG.classPage(b.dataset.c); });
    refresh();
  });
}
export function classPage(id) {
  const c = CLASSES.find(x => x.id === id); if (!c) return PG.classHub();
  const cnt = ts => ts.reduce((a, k) => a + bankItems(k, false).filter(x => x[0].startsWith(c.short)).length, 0);
  show(`<div class="sel-head"><div><div class="eyebrow">同类药物辨析 · #${c.group}</div><h2 style="font-size:28px">${esc(c.name)}</h2>
      <p style="color:var(--mute);margin:6px 0 0;max-width:64ch">${esc(c.intro)}</p></div>
      <div class="sel-tools"><button class="ibtn" id="clsBack">全部类别</button></div></div>
    ${c.tip ? `<div class="cls-tip"><b>记忆口诀</b><p>${esc(c.tip)}</p></div>` : ""}
    <div class="modes">
      <button class="mode" data-a="table"><span class="tag">${c.ds.length} 种药 × ${c.dims.length} 项对比</span><h3>对比总表</h3><p>一张表看清每个药的作用特点、特色适应证、标志性不良反应和牙科要点，可遮住任一列自测。</p></button>
      ${CLS_MODES.map(([nm, ts, ds], i) => `<button class="mode" data-a="quiz" data-q="${i}"><span class="tag">${cfg.count ? cfg.count + " 题" : "无尽"} · ${cnt(ts)} 题可抽</span><h3>${nm}</h3><p>${ds}</p></button>`).join("")}
    </div>`,
  () => {
    $("#clsBack").onclick = () => { SFX.click(); PG.classHub(); };
    main.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
      SFX.pick();
      if (b.dataset.a === "table") return PG.classTable(id);
      const [nm, ts] = CLS_MODES[+b.dataset.q];
      PG.startQuiz(c.ds, { mode: "cls", types: ts, title: c.short + " · " + nm });
    });
  });
}
export function classTable(id, cover = "") {
  const c = CLASSES.find(x => x.id === id);
  const dots = v => v == null ? `<span class="dots none">—</span>` : `<span class="dots">${"●".repeat(v + 1)}<em>${"●".repeat(3 - v)}</em></span>`;
  show(`<div class="sel-head"><div><div class="eyebrow">对比总表 · ${esc(c.short)}</div><h2 style="font-size:28px">${esc(c.name)}${LANG === "en" ? " · comparison" : "对比"}</h2></div>
      <div class="sel-tools"><button class="ibtn" id="ctBack">返回</button></div></div>
    <div class="seg" id="ctcov"><button data-c="" aria-pressed="${!cover}">全部显示</button>${c.dims.map(([k, n]) => `<button data-c="${k}" aria-pressed="${cover === k}">${LANG === "en" ? "Cover " : "遮住"}${n}</button>`).join("")}</div>
    <p class="foot" style="margin-top:8px">遮住后点灰色格子翻开，再点一次重新遮住。</p>
    <div class="table-wrap"><table class="ftable ctable"><thead><tr><th>药物</th>${c.dims.map(([k, n]) => `<th>${n}</th>`).join("")}</tr></thead><tbody>
      ${c.ds.map(d => `<tr><td class="nm"><b>${esc(d.cn)}</b><span>${esc(enAlt(d))}</span></td>${c.dims.map(([k]) => `<td data-k="${k}" class="${cover === k ? "cover" : ""}">${esc(c.rows[d.no]?.[k] || "")}</td>`).join("")}</tr>`).join("")}
    </tbody></table></div>`,
  () => {
    $("#ctBack").onclick = () => { SFX.click(); PG.classPage(id); };
    // 切换遮挡只改表格格子的样式，不重画整页：滚动位置不变、页面不会跳动
    $("#ctcov").querySelectorAll("button").forEach(b => b.onclick = () => {
      SFX.click(); cover = b.dataset.c;
      $("#ctcov").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      main.querySelectorAll(".ctable td[data-k]").forEach(td => { td.classList.toggle("cover", td.dataset.k === cover); td.classList.remove("open"); });
    });
    main.querySelectorAll(".ctable td[data-k]").forEach(td => td.onclick = () => { if (!td.classList.contains("cover")) return; td.classList.toggle("open"); SFX.pick(); });
  });
}
