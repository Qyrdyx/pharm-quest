/* 药理闯关 · 药物图鉴：记忆单元、错题本、错题速查表 */
import { PG, reg } from "../core/registry.js";
import { $, TT, esc } from "../core/utils.js";
import { CH, DM, FACT_EN, FACT_NAME, FIELD, G, GM, dLabel, enAlt, fact, zhAlt } from "../data/index.js";
import { packTag } from "../data/packs.js";
import { mwrong, poolGroups, reports, save, wrong } from "../core/state.js";
import { SFX } from "../music/sfx.js";
import { armConfirm, keepY, main, show } from "../ui/screen.js";
import { ioSheet } from "../records/backup.js";

reg({ renderWrongTable: () => renderWrongTable });
Object.assign(PG, { codex });   // 页面跳转函数：core/nav.js 会包一层，记录返回路径

/* ---------- 图鉴 / 错题本 ---------- */
export function codex(tab = "dex", showAll = false) {
  const tabs = [["dex", "按记忆单元"], ["cards", TT("速记速查", "Flashcard sheet")], ["mastery", "掌握度"], ["bank", "题库总览"], ["wrong", `错题本（${Object.keys(wrong).length + Object.keys(mwrong).length}）`], ["wtable", TT("错题速查表", "Mistake table")], ["report", `报错清单（${reports.length}）`]];
  show(`<div class="sel-head"><div><div class="eyebrow">Codex · 学习中心</div><h2 style="font-size:28px">药物图鉴</h2></div>
    <div class="tabs" role="tablist">${tabs.map(([k, n]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${tab === k}">${n}</button>`).join("")}</div></div>
    <div id="cbody"></div>`,
  () => {
    main.querySelectorAll(".tab").forEach(t => t.onclick = () => { SFX.click(); PG.codex(t.dataset.tab, showAll); });
    const body = $("#cbody");
    if (tab === "mastery") return PG.renderMastery(body);
    if (tab === "bank") return PG.renderBank(body);
    if (tab === "report") return PG.renderReports(body);
    if (tab === "wtable") return renderWrongTable(body);
    if (tab === "cards") return PG.renderFactSheet(body, "core", showAll);
    if (tab === "dex") {
      body.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:6px">
        <input class="search" id="q" type="search" placeholder="搜索药名、中文名、机制关键词…" style="flex:1 1 260px;margin-top:0">
        <button class="ibtn ${showAll ? "on" : ""}" id="allT">${showAll ? `显示：全部 ${G.length} 组` : "显示：仅本次考试范围"}</button></div><div id="glist"></div>`;
      $("#allT").onclick = () => { SFX.click(); PG.codex("dex", !showAll); };
      const render = () => {
        const kw = $("#q").value.trim().toLowerCase();
        const gs = (showAll ? G : poolGroups());
        const html = gs.map(g => {
          const txt = (g.n + g.e + g.m + g.i + g.c + g.d + (g.s || "") + (g.a || "")).toLowerCase();
          const ds = g.drugs.filter(a => !kw || txt.includes(kw) || (a[1] + a[2] + a[3]).toLowerCase().includes(kw));
          if (kw && !ds.length) return "";
          const ch = CH.get(g.ch);
          return `<details class="gcard" ${kw ? "open" : ""}><summary><span class="id">#${g.id}</span><h3>${esc(g.n)}${packTag(g)}</h3><span class="en">${esc(g.e)} · ${esc(ch[0])} ${esc(ch[1])}</span><span class="cnt">${g.drugs.length} 药</span></summary>
            <div class="gbody"><dl class="facts">${["m", "i", "c", "d", "s", "a"].filter(k => g[k]).map(k => `<dt>${FIELD[k]}</dt><dd>${esc(g[k])}</dd>`).join("")}</dl>
            <div class="table-wrap"><table class="dtable">${ds.map(a => `<tr><td class="no">${a[0]}</td><td class="nm"><b>${esc(a[1])}</b>${LANG === "en" ? "" : `<span>${esc(a[2])}</span>`}</td><td class="nt">${esc(a[3])}</td></tr>`).join("")}</table></div></div></details>`;
        }).join("");
        $("#glist").innerHTML = html || `<p class="empty">${gs.length ? "没有匹配的药物。" : "还没有选择考试范围。"}</p>`;
      };
      $("#q").addEventListener("input", render); render();
    } else {
      const ks = Object.keys(wrong).filter(k => k[0] === "g" ? GM.get(+k.slice(1)) : DM.get(+k)).sort((a, b) => wrong[b] - wrong[a]);
      const mks = Object.keys(mwrong).filter(k => DM.get(+k.split(":")[1]) && ["cn", "m", "i", "a"].includes(k.split(":")[0])).sort((a, b) => mwrong[b] - mwrong[a]);
      const byKind = k => [...new Set(mks.filter(x => k === "mia" ? /^[mia]:/.test(x) : x.startsWith(k + ":")).map(x => +x.split(":")[1]))];
      const kinds = ["mia", "cn", "m", "i", "a"].map(k => [k, byKind(k)]).filter(([, l]) => l.length);
      const keepAt = fn => { const y = scrollY; fn(); keepY(y); };
      body.innerHTML = `<div class="io-row" style="margin-top:6px">
          ${ks.length || mks.length ? `<button class="btn red" id="wprac">${TT("去错题专练", "Go to mistake drills")} →</button>` : ""}
          <button class="ibtn" id="wexp">${TT("导出错题", "Export mistakes")}</button><button class="ibtn" id="wimp">${TT("导入错题", "Import mistakes")}</button>
          ${ks.length || mks.length ? `<button class="ibtn" id="wclr">${TT("清空错题本", "Clear mistake book")}</button>` : ""}</div>
        <div class="wsec"><h3>${TT("连线错题", "Matching mistakes")} <small>${mks.length} ${TT("条", "entries")}</small></h3>
          ${mks.length ? `
            ${mks.map(k => { const [kd, no] = k.split(":"), d = DM.get(+no);
              return `<div class="wrow"><span class="cnt">×${mwrong[k]}</span><div class="body"><span class="kind-chip">${kd === "cn" ? TT("中英", "Name") : FACT_NAME[kd]}</span><b>${esc(dLabel(d))}</b>${packTag(d.g)}<br><small>${esc(kd === "cn" ? d.zh + " · " + d.en : fact(d)[kd])}</small></div><button class="x" data-del-m="${k}" aria-label="${TT("移除", "Remove")}">✕</button></div>`; }).join("")}
            <p class="foot">${TT("连线错题专练里每连对一次，该条次数减 1，减到 0 自动移出。连线时点“记不清”再点药物，也会记到这里。", "In a matching drill each correct link removes one count; entries leave at 0. Drugs marked with “Not sure” during matching are saved here too.")}</p>`
          : `<p class="empty" style="padding:14px 0">${TT("还没有连线错题。连错的、或在连线时点“记不清”标记的药会出现在这里。", "No matching mistakes yet. Wrong links and drugs marked “Not sure” during matching show up here.")}</p>`}</div>
        <div class="wsec"><h3>${TT("选择题错题", "Quiz mistakes")} <small>${ks.length} ${TT("条", "entries")}</small></h3>
          ${ks.length ? ks.map(k => {
            const x = `<button class="x" data-del="${k}" aria-label="${TT("移除", "Remove")}">✕</button>`;
            if (k[0] === "g") { const g = GM.get(+k.slice(1)); return `<div class="wrow"><span class="cnt">×${wrong[k]}</span><div class="body"><b>#${g.dot || g.id} ${esc(g.n)}</b>${packTag(g)} <small>组级知识点（机制 / 适应证 / 禁忌等）</small><br><small>${esc(g.m)}</small></div>${x}</div>`; }
            const d = DM.get(+k);
            return `<div class="wrow"><span class="cnt">×${wrong[k]}</span><div class="body"><b>${esc(d.en)}</b> ${esc(zhAlt(d))} <small>· #${d.g.dot || d.g.id} ${esc(d.g.n)}</small>${packTag(d.g)}<br><small>${esc(d.note)}</small></div>${x}</div>`;
          }).join("") + `<p class="foot">错题专练里每答对一次，该条错误次数减 1，减到 0 自动移出。</p>`
          : `<p class="empty" style="padding:14px 0">${TT("选择题错题本是空的。", "No quiz mistakes.")}</p>`}</div>`;
      const wp = $("#wprac"); if (wp) wp.onclick = () => { SFX.click(); PG.hotHub(); };
      body.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { SFX.click(); delete wrong[b.dataset.del]; save(); keepAt(() => PG.codex("wrong")); });
      body.querySelectorAll("[data-del-m]").forEach(b => b.onclick = () => { SFX.click(); delete mwrong[b.dataset.delM]; save(); keepAt(() => PG.codex("wrong")); });
      $("#wexp").onclick = () => { SFX.click(); ioSheet("wrong", "export"); };
      $("#wimp").onclick = () => { SFX.click(); ioSheet("wrong", "import", () => PG.codex("wrong")); };
      armConfirm($("#wclr"), TT("再点一次确认清空", "Tap again to clear"), () => { PG.wrong = {}; PG.mwrong = {}; save(); SFX.click(); PG.codex("wrong"); });
    }
  });
}
/* ---------- 错题速查表：错题本里的药（选择题错题 + 连线错题），样式同速记卡片；每次打开按当前错题本现算，答错自动进、减到 0 自动出 ---------- */
export function renderWrongTable(body, cover = "") {
  const cnt = {};
  Object.keys(wrong).forEach(k => { if (k[0] !== "g" && DM.get(+k)) cnt[k] = (cnt[k] || 0) + wrong[k]; });
  Object.keys(mwrong).forEach(k => { const no = k.split(":")[1]; if (DM.get(+no)) cnt[no] = (cnt[no] || 0) + mwrong[k]; });
  const nos = Object.keys(cnt), cols = ["m", "i", "a"];
  if (!nos.length) { body.innerHTML = `<p class="empty">${TT("错题本里还没有药。答错的题、连错的线、点“记不清”的药会自动出现在这张表里；在错题专练里练到 0 次会自动移出。", "No drugs in the mistake book yet. Wrong answers, wrong links and drugs marked “Not sure” appear here automatically and leave once drilled to 0.")}</p>`; return; }
  body.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:6px">
      <input class="search" id="wq" type="search" placeholder="${TT("搜索药名、机制、适应证或不良反应…", "Search…")}" style="flex:1 1 240px;margin-top:0">
      <div class="seg" id="wcov"><button data-c="" aria-pressed="${!cover}">${TT("全部显示", "Show all")}</button>${cols.map(c => `<button data-c="${c}" aria-pressed="${cover === c}">${LANG === "en" ? "Cover " + FACT_EN[c] : "遮住" + FACT_NAME[c]}</button>`).join("")}<button data-c="all" aria-pressed="${cover === "all"}">${TT("遮住全部", "Cover all")}</button></div>
      <button class="btn red" id="wtDrill">${TT("去错题专练", "Go to mistake drills")} →</button></div>
    <p class="foot" style="margin-top:8px">${TT(`共 ${nos.length} 种药。表格按当前错题本生成：答错、连错或点“记不清”会自动加进来，错题专练里减到 0 会自动移出。遮住后点灰色格子翻开。`, `${nos.length} drugs, built from the current mistake book: wrong answers and “Not sure” add drugs, drilling to 0 removes them. Tap a covered cell to reveal it.`)}</p>
    <div id="wlist"></div>`;
  const render = () => {
    const kw = $("#wq").value.trim().toLowerCase();
    const html = G.map(g => {
      const ds = g.drugs.map(a => DM.get(a[0])).filter(d => cnt[d.no] && (!kw || (d.en + d.cn + d.zh + Object.values(fact(d)).join("")).toLowerCase().includes(kw))).sort((a, b) => cnt[b.no] - cnt[a.no]);
      if (!ds.length) return "";
      return `<div class="fgroup"><div class="fgh"><span class="id">#${g.dot || g.id}</span><b>${esc(g.n)}${packTag(g)}</b><span class="fga">${g.m ? "组共同机制：" + esc(g.m) : ""}</span></div>
        <div class="table-wrap"><table class="ftable c3"><thead><tr><th>药物</th>${cols.map(c => `<th>${FACT_NAME[c]}</th>`).join("")}<th>${TT("错", "Miss")}</th></tr></thead><tbody>
        ${ds.map(d => `<tr><td class="nm"><b>${esc(d.cn)}</b><span>${esc(enAlt(d))}</span></td>${cols.map(c => `<td class="${cover === c || cover === "all" ? "cover" : ""}">${esc(fact(d)[c])}</td>`).join("")}<td class="cnt">×${cnt[d.no]}</td></tr>`).join("")}</tbody></table></div></div>`;
    }).join("");
    $("#wlist").innerHTML = html || `<p class="empty">${TT("没有匹配的药物。", "No matches.")}</p>`;
    $("#wlist").querySelectorAll("td.cover").forEach(td => td.onclick = () => { td.classList.toggle("open"); SFX.pick(); });
  };
  $("#wcov").querySelectorAll("button").forEach(b => b.onclick = () => { SFX.click(); cover = b.dataset.c; $("#wcov").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); render(); });
  $("#wtDrill").onclick = () => { SFX.click(); PG.hotHub(); };
  $("#wq").addEventListener("input", render); render();
}
