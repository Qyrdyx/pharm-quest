/* 药理闯关 · 玩法：药柜分拣 */
import { PG, reg } from "../core/registry.js";
import { $, esc, shuffle } from "../core/utils.js";
import { zhAlt } from "../data/index.js";
import { dHit, poolDrugs, save, stats, track } from "../core/state.js";
import { SFX } from "../music/sfx.js";
import { FX, comboPop } from "../ui/fx.js";
import { mascotHTML, mood } from "../ui/mascot.js";
import { groupTiers, makeOpts } from "../engine/questions.js";
import { markWrong } from "../records/wrong.js";
import { show } from "../ui/screen.js";
import { bagDeck, bagMark } from "../records/rotation.js";

reg({ S: () => S, nextSort: () => nextSort, sortPick: () => sortPick, endSort: () => endSort }, { S: v => { S = v; } });
Object.assign(PG, { startSort });   // 页面跳转函数：core/nav.js 会包一层，记录返回路径

/* ---------- 药柜分拣 ---------- */
export let S = null;
export function startSort() {
  const pd = poolDrugs(); if (!pd.length) { PG.home(); return; }
  S = { time: 60, total: 60, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, wrongs: [], deck: bagDeck("sort", pd), pool: pd, di: 0, lock: false, tid: 0 };
  show(`<div class="hud" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      <div class="panel stat"><div class="k">TIME</div><div class="v" id="stime">60.0</div></div>
      <div class="panel stat"><div class="k">SCORE</div><div class="v" id="sscore">0</div></div>
      <div class="panel stat"><div class="k">COMBO</div><div class="v combo" id="scombo">×0</div></div></div>
    <div class="timebar" id="tbar"><i id="tfill" style="width:100%"></i></div>
    <div class="sort-stage">
      <div style="display:flex;align-items:center;gap:14px;max-width:100%">${mascotHTML("idle").replace('class="mascot"', 'class="mascot" style="width:70px"')}<div id="pillSlot" style="min-width:0"></div></div>
      <div class="cabinet" id="cab"></div>
      <button class="ibtn" id="squit">结束本局</button>
    </div>`,
  () => {
    $("#squit").onclick = () => { SFX.click(); endSort(); };
    const onKey = e => { if (/^[1-4]$/.test(e.key)) { const b = $("#cab")?.children[+e.key - 1]; b && b.click(); } };
    addEventListener("keydown", onKey);
    PG.cleanup = () => { removeEventListener("keydown", onKey); clearInterval(S && S.tid); };
    nextSort();
    let last = performance.now();
    S.tid = setInterval(() => {
      const now = performance.now(), dt = (now - last) / 1000; last = now;
      S.time = Math.max(0, S.time - dt);
      $("#stime").textContent = S.time.toFixed(1);
      $("#tfill").style.width = (S.time / S.total * 100) + "%";
      $("#tbar").classList.toggle("low", S.time < 10);
      if (S.time <= 0) endSort();
    }, 100);
  });
}
export function nextSort() {
  if (S.di >= S.deck.length) { S.deck = shuffle(S.deck); S.di = 0; }
  const d = S.cur = S.deck[S.di++];   // 轮换记录在放进抽屉后才记（见 sortPick）
  const o = makeOpts(d.g.n, groupTiers(d.g));
  S.opts = o; S.lock = false;
  $("#pillSlot").innerHTML = `<div class="drugpill"><span class="a">${esc(d.en)}</span><span class="b">${esc(zhAlt(d))}</span></div>`;
  const cab = $("#cab"); cab.innerHTML = "";
  o.options.forEach((t, i) => {
    const b = document.createElement("button"); b.className = "drawer"; b.innerHTML = `<span class="lab">${esc(t)}</span>`;
    b.onclick = () => sortPick(i, b); PG.onPress(b, () => sortPick(i, b)); cab.appendChild(b);
  });
}
export function sortPick(i, b) {
  if (!S || S.lock) return; S.lock = true; S.answered++; stats.answered++; bagMark("sort", S.pool, S.cur);
  const ok = i === S.opts.ans, m = $(".sort-stage .mascot"), q = { ref: { drug: S.cur }, options: S.opts.options, ans: S.opts.ans, type: "group" };
  track(S.cur.g, ok); dHit(S.cur, ok);
  if (ok) {
    S.correct++; stats.correct++; S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
    S.score += 10 + Math.min(S.combo, 10) * 2; S.time = Math.min(S.total, S.time + 1.5);
    b.classList.add("right"); SFX.drawer(); SFX.right(); FX.at(b, "pill", 14);
    if (S.combo >= 3 && S.combo % 3 === 0) { SFX.combo(S.combo / 3 + 2); comboPop(`${S.combo} 连击!`, $("#scombo")); }
    mood(m, S.combo >= 5 ? "cheer" : "happy", null, 700);
    setTimeout(() => S && document.querySelector("#pillSlot") && nextSort(), 380);
  } else {
    S.combo = 0; S.time = Math.max(0, S.time - 3); markWrong(q); S.wrongs.push(q);
    b.classList.add("wrong"); $("#cab").children[S.opts.ans].classList.add("reveal");
    SFX.wrong(); FX.at(b, "shard", 10); mood(m, "sad", `应放「${S.cur.g.n}」`, 1300);
    setTimeout(() => S && document.querySelector("#pillSlot") && nextSort(), 1300);
  }
  $("#sscore").textContent = S.score; $("#scombo").textContent = "×" + S.combo;
  stats.bestCombo = Math.max(stats.bestCombo, S.combo); save();
}
export function endSort() {
  if (!S) return; const R = S; clearInterval(R.tid); S = null;
  PG.pgResult({ mode: "sort", bag: { key: "sort", pool: R.pool }, title: "药柜整理完毕", score: R.score, correct: R.correct, answered: R.answered, maxCombo: R.maxCombo, wrongs: R.wrongs });
}
