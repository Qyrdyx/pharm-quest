/* 药理闯关 · 选择考试范围 */
import { PG, reg } from "../core/registry.js";
import { $, esc } from "../core/utils.js";
import { G, P } from "../data/index.js";
import { packTag } from "../data/packs.js";
import { poolDrugs, save, sel } from "../core/state.js";
import { SFX } from "../music/sfx.js";
import { main, show } from "../ui/screen.js";

reg({ PRESETS: () => PRESETS });
Object.assign(PG, { selector });   // 页面跳转函数：core/nav.js 会包一层，记录返回路径

/* ---------- 选择考试范围 ---------- */
export const PRESETS = [
  { n: `全部 ${G.length} 组`, ids: G.map(g => g.id) },
  { n: "牙科高频", ids: [1, 5, 15, 17, 20, 31, 32, 34, 35, 36, 39, 40, 41, 48, 49, 50] },
  { n: "抗感染 + 消毒（35–53）", ids: G.filter(g => g.id >= 35 && g.id <= 53).map(g => g.id) },
  { n: "I–IV 章（1–33）", ids: G.filter(g => g.id <= 33).map(g => g.id) }
];
export function selector() {
  const chHTML = P.chapters.map(c => {
    const gs = G.filter(g => g.ch === c[0]);
    return `<div class="chapter" data-ch="${c[0]}"><div class="chapter-h"><span class="num">${c[0]}</span><h3>${esc(c[1])}</h3>
      <span class="cnt" data-cnt="${c[0]}"></span><button class="ibtn" data-chall="${c[0]}">整章</button></div>
      <div class="chips">${gs.map(g => `<button class="chip" data-g="${g.id}" aria-pressed="${sel.has(g.id)}"><span class="dot">${g.dot || g.id}</span>${esc(g.n)}${packTag(g)}<span class="n">${g.drugs.length}</span></button>`).join("")}</div></div>`;
  }).join("");
  show(`<div class="sel-head"><div><div class="eyebrow">Step 1 · 考试范围</div><h2 style="font-size:28px">这次考哪些药物组？</h2></div>
    <div class="sel-tools">${PRESETS.map((p, i) => `<button class="ibtn" data-preset="${i}">${p.n}</button>`).join("")}
    <button class="ibtn" id="invSel">反选</button><button class="ibtn" id="noneSel">全不选</button><button class="ibtn" id="packOpen">${T("＋ 题库扩展包", "+ Question-bank packs")}</button></div></div>
    ${chHTML}
    <div class="sel-bar"><span class="sum" id="selSum"></span><button class="btn" id="selDone">完成</button></div>`,
  () => {
    const refresh = () => {
      main.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", String(sel.has(+c.dataset.g))));
      P.chapters.forEach(c => { const gs = G.filter(g => g.ch === c[0]); const k = gs.filter(g => sel.has(g.id)).length; $(`[data-cnt="${c[0]}"]`).textContent = `${k}/${gs.length} 组`; });
      $("#selSum").innerHTML = `已选 <b>${sel.size}</b> 组 · <b>${poolDrugs().length}</b> 种药物`;
      $("#selDone").disabled = sel.size === 0; save();
    };
    // 监听挂在本页的根节点上：离开页面时随页面一起销毁，不会越积越多
    main.firstElementChild.addEventListener("click", e => {
      const c = e.target.closest(".chip");
      if (c) { const id = +c.dataset.g; sel.has(id) ? sel.delete(id) : sel.add(id); SFX.click(); refresh(); return; }
      const ca = e.target.closest("[data-chall]");
      if (ca) { const gs = G.filter(g => g.ch === ca.dataset.chall); const all = gs.every(g => sel.has(g.id)); gs.forEach(g => all ? sel.delete(g.id) : sel.add(g.id)); SFX.pick(); refresh(); return; }
      const pr = e.target.closest("[data-preset]");
      if (pr) { PG.sel = new Set(PRESETS[+pr.dataset.preset].ids); SFX.pick(); refresh(); return; }
      if (e.target.closest("#invSel")) { PG.sel = new Set(G.filter(g => !sel.has(g.id)).map(g => g.id)); SFX.pick(); refresh(); }
      if (e.target.closest("#packOpen")) { SFX.click(); PG.packSheet(); return; }
      if (e.target.closest("#noneSel")) { sel.clear(); SFX.pick(); refresh(); }
      if (e.target.closest("#selDone")) { SFX.click(); PG.goBack(); }
    });
    refresh();
  });
}
