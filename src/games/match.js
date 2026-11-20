/* 药理闯关 · 玩法：连线配对（中英 / 机制 / 适应证 / 不良反应 / 三合一） */
import { PG, reg } from "../core/registry.js";
import { $, TT, shuffle } from "../core/utils.js";
import { DM, DR, FACT_EN, FACT_NAME, dLabel, fact, sim } from "../data/index.js";
import { cfg, dHit, mwrong, poolDrugs, save, stats, track } from "../core/state.js";
import { SFX } from "../music/sfx.js";
import { FX } from "../ui/fx.js";
import { matchBreak, matchLink, matchReset, matchRoundClear, matchTether, matchTri } from "../ui/combo.js";
import { DEV, devOn } from "../core/dev.js";
import { markWrong } from "../records/wrong.js";
import { main, show, toast } from "../ui/screen.js";
import { bagDeck, bagMark } from "../records/rotation.js";

reg({ M: () => M, MATCH_KINDS: () => MATCH_KINDS, mkName: () => mkName, hasFacts: () => hasFacts, mwAdd: () => mwAdd, mwHit: () => mwHit, matchQ: () => matchQ, M_FORGET: () => M_FORGET, M_DONE: () => M_DONE, mBaseHint: () => mBaseHint, gotText: () => gotText, matchRound: () => matchRound, matchFlag: () => matchFlag, mRoundDone: () => mRoundDone, tileClick: () => tileClick, endMatch: () => endMatch }, { M: v => { M = v; } });
Object.assign(PG, { startMatch });   // 页面跳转函数：core/nav.js 会包一层，记录返回路径

/* ---------- 中英配对 ---------- */
export let M = null;
/* 连线类型：cn 中英、m 机制、i 适应证、a 不良反应、mia 三合一（每个药连机制 + 适应证 + 不良反应三项） */
export const MATCH_KINDS = ["m", "i", "a"];
export const mkName = k => ({ cn: TT("中英连线", "Name matching"), m: TT("机制连线", "Mechanism matching"), i: TT("适应证连线", "Indication matching"), a: TT("不良反应连线", "Adverse-effect matching"), mia: TT("三合一连线", "3-in-1 matching") })[k] || k;
export const hasFacts = d => { const f = fact(d); return !!(f.m && f.i && f.a); };
/* 连线错题本：记一次 / 连对一次减一次 */
export function mwAdd(kind, d) { if (!d) return; (kind === "mia" ? MATCH_KINDS : [kind]).forEach(k => { const key = k + ":" + d.no; mwrong[key] = (mwrong[key] || 0) + 1; }); }
export function mwHit(kind, d) { const key = kind + ":" + d.no; if (mwrong[key]) { mwrong[key]--; if (mwrong[key] <= 0) delete mwrong[key]; } }
export function matchQ(d, k) { return k === "cn" ? { ref: { drug: d }, options: [d.zh], ans: 0, type: "cn" } : { ref: { drug: d, fact: k }, options: [fact(d)[k]], ans: 0, type: "d" + k }; }
export const M_FORGET = () => TT("记不清？点这里，再点药物 → 加入错题本", "Not sure? Tap here, then a drug → mistake book");
export const M_DONE = () => TT("完成标记", "Done marking");
export function mBaseHint() { return M && M.tri ? TT("先点药物，再分别点它的机制、适应证、不良反应；三项都连上这个药才算完成。", "Tap a drug, then its mechanism, indication and adverse effect; the drug is done when all three are linked.") : ""; }
export function startMatch(opts = {}) {
  const kind = opts.kind || "cn", tri = kind === "mia", per = tri ? 4 : 6;
  let pd = opts.only ? opts.only.map(n => DM.get(+n)).filter(Boolean) : poolDrugs();
  if (tri) pd = pd.filter(hasFacts);
  else pd = pd.filter(d => kind === "cn" ? d.en !== d.zh : fact(d)[kind]);   // 扩展包里缺这一项（或没写英文名）的药不进这种连线
  if (!opts.drill && pd.length < 2) { toast(TT("连线至少需要 2 种药，请在“选择考试范围”里多选一些。", "Matching needs at least 2 drugs — select more in the exam scope.")); return; }
  if (!pd.length) { opts.only ? PG.codex("wrong") : PG.home(); return; }
  let src = pd.slice(); const min = tri ? 3 : 4;
  if (opts.drill && src.length < min) src = src.concat(shuffle(DR.filter(d => !src.includes(d) && (!tri || hasFacts(d)))).slice(0, min + 2 - src.length));
  const drill = !!opts.drill, want = drill ? Infinity : (cfg.matchRounds || Infinity), bagKey = drill ? null : "match_" + kind;
  // 错题专练：先出错题里的药，不够一轮再用别的药补齐
  const deck = bagKey ? bagDeck(bagKey, src) : shuffle(pd.slice()).concat(shuffle(src.filter(d => !pd.includes(d))));
  const rounds = Math.max(1, Math.min(want, drill ? Math.ceil(pd.length / per) : Math.floor(src.length / per) || 1));
  M = { round: 0, rounds, per, tri, src: deck, bagKey, bagPool: src, used: new Set(), mistakes: 0, matched: 0, start: performance.now(), selL: null, selR: null, wrongs: [], tid: 0, combo: 0, maxCombo: 0, kind, opts, forget: false };
  const cols = tri ? [["L", TT("药物", "DRUG")], ["m", FACT_NAME.m], ["i", FACT_NAME.i], ["a", FACT_NAME.a]]
    : [["L", kind === "cn" ? "INN / ENGLISH" : "药物"], ["R", kind === "cn" ? "中文名" : FACT_NAME[kind]]];
  show(`<div class="hud" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      <div class="panel stat"><div class="k">ROUND</div><div class="v" id="mround">1/${M.rounds}</div></div>
      <div class="panel stat"><div class="k">TIME</div><div class="v" id="mtime">0s</div></div>
      <div class="panel stat"><div class="k">MISS</div><div class="v" id="mmiss" style="color:var(--rose)">0</div></div></div>
    ${drill ? `<p class="m-hint" style="margin-top:12px">${TT("连线错题专练：每连对一次，这条错题次数减 1。", "Matching-mistake drill: each correct link removes one count.")}</p>` : ""}
    <div class="match-grid${kind === "cn" ? "" : " fact"}${tri ? " tri" : ""}" id="mgrid">${cols.map(([id, h]) => `<div class="match-col" id="col${id}"><h3>${h}</h3></div>`).join("")}</div>
    <p class="m-hint" id="mhint">${mBaseHint()}</p>
    <div class="q-actions"><button class="ibtn" id="mforget">${M_FORGET()}</button><button class="ibtn" id="mquit">结束本局</button></div>`,
  () => {
    $("#mquit").onclick = () => { SFX.click(); endMatch(); };
    $("#mforget").onclick = () => {
      SFX.click(); M.forget = !M.forget;
      const b = $("#mforget"), h = $("#mhint"); b.classList.toggle("on", M.forget); b.textContent = M.forget ? M_DONE() : M_FORGET();
      $("#mgrid").classList.toggle("forget-on", M.forget);
      h.classList.toggle("warn", M.forget);
      h.textContent = M.forget ? TT("点药物 = 整个药记进错题本并直接揭晓答案；点某一项 = 只记这一项。记下的不再参与本轮连线。点“完成标记”继续。", "Tap a drug to save it and reveal its answers, or one item to save just that item. Saved items leave this round. Tap “Done marking” to continue.") : mBaseHint();
      if (M.selL) M.selL.classList.remove("sel"); if (M.selR) M.selR.classList.remove("sel"); M.selL = M.selR = null;
    };
    M.tid = setInterval(() => { $("#mtime").textContent = Math.floor((performance.now() - M.start) / 1000) + "s"; }, 500);
    const tid = M.tid; PG.cleanup = () => clearInterval(tid);   // 记下这一局自己的计时器：直接开下一局时也能清掉
    matchRound();
  });
}
export const gotText = b => MATCH_KINDS.map(k => b.dataset["g" + k] ? "✓" : "○").join(" ");
export function matchRound() {
  M.roundMiss = 0; M.roundT = performance.now(); matchReset();   // 本轮失误数和开始时间：轮末给星级
  const picks = [], seenCn = new Set(), seenSame = new Set(), kinds = M.tri ? MATCH_KINDS : [M.kind];
  const txt = (d, k) => k === "cn" ? d.zh : fact(d)[k];
  for (const d of M.src) {
    if (picks.length >= M.per) break;
    if (M.used.has(d.no) || seenCn.has(d.cn) || (d.same && seenSame.has(d.same))) continue;
    if (M.kind !== "cn" && picks.some(x => kinds.some(k => sim(txt(x, k), txt(d, k)) > 0.45))) continue;   // 同一轮不放意思相近的两条
    picks.push(d); seenCn.add(d.cn); if (d.same) seenSame.add(d.same);
  }
  // 同组药的描述都很像时（如局麻药都是“阻断 Na⁺ 通道”），放宽到“文字不完全相同”，避免一轮凑不出两种药
  if (picks.length < 2) for (const d of M.src) {
    if (picks.length >= M.per) break;
    if (picks.includes(d) || M.used.has(d.no) || seenCn.has(d.cn)) continue;
    if (picks.some(x => kinds.some(k => txt(x, k) === txt(d, k)))) continue;
    picks.push(d); seenCn.add(d.cn);
  }
  if (picks.length < 2) { endMatch(); return; }
  picks.forEach(d => M.used.add(d.no));   // 轮换记录等真的连了（连对、连错或点“记不清”）才记
  M.cur = picks; M.left = picks.length * kinds.length; M.selL = M.selR = null;
  $("#mround").textContent = `${M.round + 1}/${M.rounds}`;
  main.querySelectorAll("#mgrid .tile").forEach(e => e.remove());
  const mk = (col, d, text, side, k) => { const b = document.createElement("button"); b.className = "tile" + (side === "L" ? "" : " cn"); b.dataset.no = d.no; b.dataset.side = side; if (k) b.dataset.k = k; b.textContent = text; col.appendChild(b); return b; };
  shuffle(picks.slice()).forEach(d => {
    const b = mk($("#colL"), d, M.kind === "cn" ? d.en : dLabel(d), "L");
    if (M.tri) { const g = document.createElement("span"); g.className = "got"; g.textContent = gotText(b); b.appendChild(g); }
  });
  // 干扰项：每列再混入 2～3 条不属于本轮任何药的选项（三合一每列 2 条），连到最后一个也不会“剩下的就是对的”
  const decoyFor = k => {
    const n = M.tri ? 2 : 2 + (Math.random() < 0.5 ? 1 : 0), out = [], texts = picks.map(d => txt(d, k));
    const cands = shuffle(M.bagPool.filter(d => !picks.includes(d))).concat(shuffle(DR.filter(d => !picks.includes(d) && !M.bagPool.includes(d))));
    for (const d of cands) {
      if (out.length >= n) break;
      const s = txt(d, k); if (!s || picks.some(p => p.cn === d.cn)) continue;
      if (texts.some(x => x === s || (k !== "cn" && sim(x, s) > 0.45))) continue;
      out.push(d); texts.push(s);
    }
    return out;
  };
  kinds.forEach(k => {
    const col = M.tri ? $("#col" + k) : $("#colR");
    shuffle(picks.map(d => [d, 0]).concat(decoyFor(k).map(d => [d, 1]))).forEach(([d, dec]) => { const b = mk(col, d, txt(d, k), "R", k); if (dec) b.dataset.decoy = 1; });
  });
  main.querySelectorAll("#mgrid .tile").forEach(b => b.onclick = () => tileClick(b));
}
/* “记不清”：把药（或某一项）记进错题本，不算失误；记下的直接揭晓并退出本轮（不能再被选中，也不会白送答案） */
export function matchFlag(b) {
  const h = $("#mhint");
  if (b.dataset.decoy) { SFX.pick(); if (h) h.textContent = TT("这是干扰项，不属于本轮任何一种药。", "That's a distractor — it belongs to none of this round's drugs."); return; }
  const d = DM.get(+b.dataset.no), isL = b.dataset.side === "L", k = isL ? M.kind : b.dataset.k, lab = TT("已记错题", "Saved");
  bagMark(M.bagKey, M.bagPool, d);
  mwAdd(k, d); const q = matchQ(d, k === "mia" ? "m" : k); markWrong(q); M.wrongs.push(q); dHit(d, false); track(d.g, false); save();
  const L = main.querySelector(`#mgrid .tile[data-side="L"][data-no="${d.no}"]`);
  const rs = isL ? [...main.querySelectorAll(`#mgrid .tile[data-side="R"][data-no="${d.no}"]:not([data-decoy])`)] : [b];
  M.roundMiss = (M.roundMiss || 0) + 1;   // “记不清”算这一轮的失误（影响星级，不扣分）
  rs.forEach(x => { if (x.classList.contains("done")) return; x.classList.add("done", "flag"); x.dataset.flag = lab; M.left--; if (M.tri && L) L.dataset["g" + x.dataset.k] = 1; });
  if (L) {
    if (M.tri) { const g = L.querySelector(".got"); if (g) g.textContent = gotText(L); }
    L.classList.add("flag"); L.dataset.flag = lab;
    if (!M.tri || MATCH_KINDS.every(x => L.dataset["g" + x])) { L.classList.remove("part", "sel"); L.classList.add("done"); if (M.selL === L) M.selL = null; }
  }
  SFX.pick(); FX.at(b, "spark", 6);
  if (h) h.textContent = TT(`已把「${d.cn}」${isL ? "" : "的" + (k === "cn" ? "中文名" : FACT_NAME[k])}记进错题本，答案已揭晓。`, `Saved ${d.en}${isL ? "" : " (" + (k === "cn" ? "name" : FACT_EN[k]) + ")"} to the mistake book; answer revealed.`);
  if (M.left === 0) mRoundDone();
}
export function mRoundDone() {
  main.querySelectorAll("#mgrid .tile[data-decoy]").forEach(x => x.classList.add("done"));   // 本轮连完，干扰项一起淡出
  if (M.round < M.rounds) matchRoundClear(document.querySelector("#mgrid"), M.roundMiss || 0, Math.round((performance.now() - (M.roundT || performance.now())) / 1000));
  M.round++; setTimeout(() => { if (!M || !document.querySelector("#mgrid")) return; if (M.round >= M.rounds) endMatch(); else { SFX.win(); matchRound(); } }, 600);
}
export function tileClick(b) {
  if (!M || b.classList.contains("done")) return;
  if (M.forget) return matchFlag(b);
  const side = b.dataset.side;
  if (side === "L") { M.selL?.classList.remove("sel"); M.selL = M.selL === b ? null : b; } else { M.selR?.classList.remove("sel"); M.selR = M.selR === b ? null : b; }
  if (M.selL) M.selL.classList.add("sel"); if (M.selR) M.selR.classList.add("sel");
  matchTether(M.selL && !M.selR ? M.selL : M.selR && !M.selL ? M.selR : null);   // 只选了一边：能量线跟着手指走
  SFX.pick();
  if (M.selL && M.selR) {
    const a = M.selL; let c = M.selR;
    if (DEV && devOn("allLink") && a.dataset.no !== c.dataset.no) {   // 开发者版：怎么连都算对，换成这个药真正对应的那一块
      const q = `#mgrid .tile[data-side="R"][data-no="${a.dataset.no}"]:not(.done)`;
      c = (M.tri && main.querySelector(q + `[data-k="${c.dataset.k}"]`)) || main.querySelector(q) || c;
    }
    const d = DM.get(+a.dataset.no), k = c.dataset.k || M.kind; M.selL = M.selR = null;
    bagMark(M.bagKey, M.bagPool, d);   // 连过这个药（对错都算）才记一次
    a.classList.remove("sel"); c.classList.remove("sel");
    if (a.dataset.no === c.dataset.no) {
      track(d.g, true); dHit(d, true); if (M.opts.drill) mwHit(k, d);
      c.classList.add("done"); M.matched++; M.left--; M.combo++; M.maxCombo = Math.max(M.maxCombo, M.combo);
      if (M.tri) {   // 三合一：三项都连上药物才算完成；没完成就保持选中，方便接着连
        a.dataset["g" + k] = 1; const g = a.querySelector(".got"); if (g) g.textContent = gotText(a);
        if (MATCH_KINDS.every(x => a.dataset["g" + x])) { a.classList.remove("part"); a.classList.add("done"); setTimeout(() => matchTri(a, [...main.querySelectorAll(`#mgrid .tile[data-side="R"][data-no="${a.dataset.no}"]:not([data-decoy])`)]), 250); } else { a.classList.add("part", "sel"); M.selL = a; }
      } else a.classList.add("done");
      FX.at(a, "pill", 10, true); FX.at(c, "spark", 10, true);   // 不再撒粒子，只消耗同样的随机数（保持出题顺序和以前一致）
      matchLink(a, c, M.combo);
      if (M.left === 0) mRoundDone();
    } else {
      matchBreak(M.combo, a, c); M.mistakes++; M.roundMiss = (M.roundMiss || 0) + 1; M.combo = 0; M.lastHit = 0; $("#mmiss").textContent = M.mistakes;
      dHit(d, false); const q = matchQ(d, k); markWrong(q); mwAdd(k, d); M.wrongs.push(q); track(d.g, false);
      [a, c].forEach(x => { x.classList.remove("bad"); void x.offsetWidth; x.classList.add("bad"); });
      if (M.tri) { M.selL = a; a.classList.add("sel"); }
      save();
    }
  }
}
export function endMatch() {
  if (!M) return; const R = M; clearInterval(R.tid); M = null;
  if (performance.now() - R.start < 5000) PG.achEvent && PG.achEvent("quickquit");   // 彩蛋：开局 5 秒内结束
  const secs = Math.floor((performance.now() - R.start) / 1000);
  const score = Math.max(0, R.matched * 100 - R.mistakes * 30 + Math.max(0, R.rounds * (R.tri ? 120 : 60) - secs) * 5);
  stats.answered += R.matched + R.mistakes; stats.correct += R.matched; stats.bestCombo = Math.max(stats.bestCombo, R.maxCombo); save();
  const title = (R.opts.drill ? TT("连线错题专练 · ", "Matching drill · ") : "") + (R.kind === "cn" ? "配对完成" : R.tri ? TT("三合一连线完成", "3-in-1 matching complete") : FACT_NAME[R.kind] + "配对完成");
  PG.pgResult({ mode: "match", bag: R.bagKey ? { key: R.bagKey, pool: R.bagPool } : null, opts: R.opts, title, score, correct: R.matched, answered: R.matched + R.mistakes, maxCombo: R.maxCombo, wrongs: R.wrongs, extra: `用时 <b>${secs}s</b>` });
}
