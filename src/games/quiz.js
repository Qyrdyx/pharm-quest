/* 药理闯关 · 玩法：查房问答（选择题） */
import { PG, reg } from "../core/registry.js";
import { $, TT, clamp, esc, pick, shuffle } from "../core/utils.js";
import { TYPES, TYPE_W } from "../data/index.js";
import { cfg, poolDrugs, save, stats, trackQ } from "../core/state.js";
import { SFX } from "../music/sfx.js";
import { FX, comboPop } from "../ui/fx.js";
import { fxLevel, quizBreak, quizCombo, quizPerfect } from "../ui/combo.js";
import { DEV, devOn } from "../core/dev.js";
import { ECG } from "../ui/ecg.js";
import { L, mascotHTML, mood } from "../ui/mascot.js";
import { enabledTypes, makeQuestion } from "../engine/questions.js";
import { markRight, markWrong } from "../records/wrong.js";
import { reportBtn, reportQ } from "../records/reports.js";
import { explainHTML } from "../engine/explain.js";
import { safeRun, show, toTop } from "../ui/screen.js";
import { bagDeck, bagMark } from "../records/rotation.js";

reg({ Q: () => Q, buildDeck: () => buildDeck, quizBagKey: () => quizBagKey, syringeSVG: () => syringeSVG, setSyringe: () => setSyringe, renderLives: () => renderLives, nextQ: () => nextQ, answer: () => answer, endQuiz: () => endQuiz, forceEndQuiz: () => forceEndQuiz }, { Q: v => { Q = v; } });
Object.assign(PG, { startQuiz });   // 页面跳转函数：core/nav.js 会包一层，记录返回路径

/* ---------- 查房问答 ---------- */
export let Q = null;
export function buildDeck(focus) {
  const src = focus && focus.length ? focus : poolDrugs();
  return shuffle(src.slice());
}
export function quizBagKey(focus, opts) { return opts.ordered || opts.preset ? null : opts.mode === "cls" ? "cls" : focus && focus.length ? null : "quiz"; }
export function startQuiz(focus, opts = {}) {
  const bagKey = quizBagKey(focus, opts), bagPool = focus && focus.length ? focus.slice() : poolDrugs();
  const deck = opts.preset ? shuffle(opts.preset.slice()) : opts.ordered ? focus.slice() : bagKey ? bagDeck(bagKey, bagPool) : buildDeck(focus);
  if (!deck.length) { PG.home(); return; }
  Q = { mode: opts.mode || "quiz", types: opts.types || null, title: opts.title || "", opts, focus: !!(focus && focus.length), focusList: focus, deck, di: 0, i: 0, n: opts.preset ? Math.min(cfg.count || Infinity, opts.preset.length) : (cfg.count || Infinity), lives: cfg.lives || Infinity, maxLives: cfg.lives || 0,
    score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, wrongs: [], cur: null, tleft: 0, tid: 0, locked: false, bagKey, bagPool };
  Q.t0 = performance.now();
  show(`<div class="hud">
      <div class="panel monitor"><canvas id="ecg" aria-label="心电监护：生命值与连击"></canvas><div class="vitals"><div class="hr" id="hr">72<small>BPM</small></div><div class="lives" id="lives"></div></div></div>
      <div class="panel stat"><div class="k">SCORE</div><div class="v" id="score">0</div></div>
      <div class="panel stat"><div class="k">COMBO</div><div class="v combo" id="combo">×0</div></div>
      <div class="panel timer" id="timerBox"><div class="wrapc"><svg viewBox="0 0 44 44"><circle class="bgc" cx="22" cy="22" r="18"/><circle class="fgc" id="tring" cx="22" cy="22" r="18"/></svg><span class="t" id="tnum">∞</span></div></div>
    </div>
    <div class="syringe"><span id="qprog">1/${Q.n === Infinity ? "∞" : Q.n}</span>${syringeSVG()}<button class="ibtn" id="quit">结束本局</button></div>
    <div class="stage">${mascotHTML("think")}
      <div><div class="qcard"><span class="qtype" id="qtype"></span><span class="qno" id="qno"></span><div class="prompt" id="prompt"></div></div>
      <div class="opts" id="opts"></div>
      <div id="explain"></div>
      <div class="q-actions"><span id="rep"></span><button class="ibtn" id="dunno" title="${TT("看答案，并把这题记进错题本（不扣生命）", "Show the answer and save it to the mistake book (no life lost)")}">${TT("记不清", "Not sure")}</button><button class="btn" id="submit" hidden>提交答案 ↵</button><button class="btn" id="next" hidden>下一题 ↵</button></div></div>
    </div>`,
  () => {
    ECG.mount($("#ecg")); ECG.bpm = 72;
    $("#quit").onclick = () => { SFX.click(); endQuiz(); };
    $("#next").onclick = () => safeRun(() => nextQ(), "下一题", () => { if (!Q || Q.lives <= 0 || Q.i + 1 >= Q.n) forceEndQuiz(); });
    const onKey = e => {
      if (!Q || !$("#opts")) return;
      if (/^[1-4]$/.test(e.key) && !Q.locked) { const b = $("#opts").children[+e.key - 1]; b && b.click(); }
      else if ((e.key === "Enter" || e.key === " ") && !Q.locked && Q.cur?.multi) { e.preventDefault(); $("#submit").click(); }
      else if ((e.key === "Enter" || e.key === " ") && Q.locked && !$("#next").hidden) { e.preventDefault(); nextQ(); }
    };
    addEventListener("keydown", onKey);
    PG.cleanup = () => { removeEventListener("keydown", onKey); clearInterval(Q && Q.tid); cancelAnimationFrame(ECG.raf); };
    renderLives(); nextQ(true);
  });
}
export function syringeSVG() {
  let ticks = ""; for (let i = 0; i <= 10; i++) ticks += `<line x1="${40 + i * 13}" y1="6" x2="${40 + i * 13}" y2="${i % 5 ? 10 : 13}" stroke="#0a1a20" stroke-width="1.2"/>`;
  return `<svg viewBox="0 0 220 26" preserveAspectRatio="none" aria-hidden="true">
    <rect id="plRod" x="30" y="11" width="40" height="4" fill="#93b3b4"/><rect id="plHead" x="30" y="5" width="5" height="16" rx="1.5" fill="#93b3b4"/>
    <rect x="36" y="4" width="138" height="18" rx="3" fill="#f7ecd9" opacity=".12" stroke="#93b3b4" stroke-width="1.5"/>
    <rect id="plFill" x="38" y="6" width="0" height="14" rx="2" fill="#86cbff"/>${ticks}
    <rect x="174" y="9" width="8" height="8" fill="#93b3b4"/><line x1="182" y1="13" x2="218" y2="13" stroke="#93b3b4" stroke-width="1.6"/></svg>`;
}
export function setSyringe(p) {
  p = clamp(p, 0, 1); const f = $("#plFill"); if (!f) return;
  // 进度 = 针筒里抽进的药液；活塞随之往外拉
  f.setAttribute("width", 134 * p);
  $("#plHead").setAttribute("x", 30 - 30 * p);
  $("#plRod").setAttribute("x", 30 - 30 * p);
}
export function renderLives() {
  const el = $("#lives"); if (!el) return;
  if (Q.lives === Infinity) { el.innerHTML = "♥ ∞"; return; }
  el.innerHTML = Array.from({ length: Q.maxLives }, (_, i) => `<span class="${i < Q.lives ? "" : "lost"}">♥</span>`).join("");
}
export function nextQ(first) {
  if (!Q) return;
  toTop();
  if (!first) Q.i++;
  if (Q.i >= Q.n || Q.lives <= 0) { endQuiz(); return; }
  if (Q.di >= Q.deck.length) { Q.deck = shuffle(Q.deck); Q.di = 0; }
  const item = Q.deck[Q.di++];
  let q;
  if (Q.opts && Q.opts.preset) q = Q.cur = PG.aiToQ(item);
  else { Q.curItem = item; q = Q.cur = makeQuestion(item, Q.types || enabledTypes()); }   // 轮换记录在作答后才记（见 answer）
  Q.shownAt = performance.now();   // 出题时间：3 秒内答对算“秒答”
  Q.locked = false;
  $("#qtype").textContent = TYPES[q.type] || (q.type === "ai" ? "AI 出题" : "");
  $("#qno").textContent = q.ref.group ? `#${q.ref.group.id}` : "";
  $("#prompt").innerHTML = q.prompt;
  $("#qprog").textContent = `${Q.i + 1}/${Q.n === Infinity ? "∞" : Q.n}`;
  setSyringe(Q.n === Infinity ? (Q.i % 20) / 20 : Q.i / Q.n);
  const box = $("#opts"); box.className = "opts" + (q.multi || q.rank ? " wide" : ""); box.innerHTML = "";
  Q.picked = new Set(); Q.rankPick = [];
  const rankUI = () => [...box.children].forEach((x, k) => { const p = Q.rankPick.indexOf(k); x.querySelector(".key").textContent = p >= 0 ? p + 1 : "?"; x.classList.toggle("picked", p >= 0); });
  q.options.forEach((t, i) => {
    const b = document.createElement("button"); b.className = "opt";
    b.innerHTML = `<span class="key">${q.multi ? "□" : q.rank ? "?" : i + 1}</span><span class="txt">${esc(t)}</span>`;
    b.onclick = q.rank
      ? () => { if (Q.locked) return; const p = Q.rankPick, at = p.indexOf(i); if (at >= 0) { p.splice(at); SFX.pick(false); } else { p.push(i); SFX.rank(p.length); } rankUI(); if (p.length === q.options.length) setTimeout(() => answer(p.slice(), null), 250); }
      : q.multi
      ? () => { if (Q.locked) return; Q.picked.has(i) ? Q.picked.delete(i) : Q.picked.add(i); b.classList.toggle("picked"); b.querySelector(".key").textContent = Q.picked.has(i) ? "✓" : "□"; SFX.pick(Q.picked.has(i)); }
      : () => answer(i, b);
    if (!q.multi && !q.rank) PG.onPress(b, () => answer(i, b));
    box.appendChild(b);
  });
  const sb = $("#submit"); sb.hidden = !q.multi; sb.onclick = () => answer(Q.picked, sb);
  $("#explain").innerHTML = ""; $("#next").hidden = true; $("#rep").innerHTML = "";
  const dk = $("#dunno"); if (dk) { dk.hidden = false; dk.onclick = () => { SFX.click(); answer(-2, null); }; }
  const m = $(".stage .mascot"); if (m && Math.random() < 0.35) mood(m, "think", pick(L().think), 1400); else if (m) m.setAttribute("data-mood", "idle");
  clearInterval(Q.tid);
  const T = cfg.timer, ring = $("#tring"), tn = $("#tnum"), tb = $("#timerBox");
  if (T) {
    Q.tleft = T; tb.classList.remove("low"); ring.style.strokeDashoffset = 0; tn.textContent = T;
    Q.tid = setInterval(() => {
      if (!Q || Q.locked) return;
      Q.tleft -= 0.25; ring.style.strokeDashoffset = 113.1 * (1 - Q.tleft / T);
      const s = Math.ceil(Q.tleft); if (tn.textContent != s) { tn.textContent = s; if (s <= 5 && s > 0) { SFX.tick(); tb.classList.add("low"); } }
      if (Q.tleft <= 0) { clearInterval(Q.tid); answer(-1, null); }
    }, 250);
  } else { tn.textContent = "∞"; ring.style.strokeDashoffset = 0; }
}
export function answer(i, btn) {
  if (!Q || Q.locked) return; Q.locked = true; clearInterval(Q.tid);
  if (i !== -1 && Q.curItem && !(Q.opts && Q.opts.preset)) bagMark(Q.bagKey, Q.bagPool, Q.curItem);   // 真的答了（含“记不清”）才算考过一次；超时没答不算
  const q = Q.cur, box = $("#opts"); box.classList.add("locked"); $("#submit").hidden = true;
  if (DEV && devOn("allRight") && i !== -2 && i !== -1) { i = q.rank ? q.ansSeq.slice() : q.multi ? new Set(q.ansSet) : q.ans; if (!q.rank && !q.multi) btn = box.children[q.ans]; }   // 开发者版：怎么选都算对
  const dunno = i === -2; { const dk = $("#dunno"); if (dk) dk.hidden = true; }   // -2 = 点了“记不清”：看答案、记错题、不扣生命
  const spent = performance.now() - (Q.shownAt || performance.now());   // 这题用了多久（彩蛋成就：思考人生 / 手速超过脑速）
  if (!cfg.timer && !dunno && i !== -1 && spent > 180000) PG.achEvent && PG.achEvent("ponder");
  let ok;
  if (q.rank) {
    const picked = Array.isArray(i) ? i : [];
    ok = picked.length === q.ansSeq.length && picked.every((x, k) => x === q.ansSeq[k]);
    [...box.children].forEach((b, k) => { const pos = picked.indexOf(k); b.classList.remove("picked"); b.classList.add(pos >= 0 && q.ansSeq[pos] === k ? "right" : "wrong"); b.querySelector(".key").textContent = q.ansSeq.indexOf(k) + 1; });
    if (!ok) btn = null;
  } else if (q.multi) {
    const picked = i === -1 || dunno ? new Set() : i;
    ok = picked.size === q.ansSet.length && q.ansSet.every(k => picked.has(k));
    [...box.children].forEach((b, k) => { b.classList.remove("picked"); b.classList.add(q.ansSet.includes(k) ? "right" : picked.has(k) ? "wrong" : "dim"); });
    if (!ok) btn = null;
  } else {
    ok = i === q.ans;
    [...box.children].forEach((b, k) => { if (k === q.ans) b.classList.add("right"); else if (k === i) b.classList.add("wrong"); else b.classList.add("dim"); });
  }
  Q.answered++; stats.answered++; trackQ(q, ok);
  const m = $(".stage .mascot");
  if (ok) {
    Q.correct++; stats.correct++; Q.combo++; Q.maxCombo = Math.max(Q.maxCombo, Q.combo);
    Q.wrongRun = 0; if (Q.focus && q.ref && q.ref.drug && Q.drillRun) delete Q.drillRun[q.ref.drug.no];
    if (Q.lives === 1 && Q.combo === 10) PG.achEvent && PG.achEvent("miracle");   // 彩蛋：只剩 1 条命时连对 10 题
    const gain = Math.round((100 + Math.min(Q.combo, 10) * 15 + (cfg.timer ? Math.round(Q.tleft * 3) : 0)) * (TYPE_W[q.type] || 1));
    Q.score += gain; SFX.right(Q.combo);
    FX.at(btn || box.children[q.ans], "pill", 16 + Math.min(Q.combo, 10) * 2);
    const up = quizCombo(Q.combo, $("#combo"), { btn: btn || box.children[q.ans], fast: performance.now() - (Q.shownAt || 0) < 3000 });
    if (!up && Q.combo >= 3) { SFX.combo(Q.combo); if (fxLevel() > 0) comboPop(TT(`${Q.combo} 连击!`, `${Q.combo} combo!`), $("#combo")); }   // 升档时有大字和和弦，平时只飘小字
    if (Q.n !== Infinity && Q.n >= 5 && Q.i + 1 >= Q.n && Q.correct === Q.answered) quizPerfect(Q.n);
    mood(m, Q.combo >= 5 ? "cheer" : "happy", Q.combo >= 5 ? pick(L().combo) : pick(L().right));
    ECG.bpm = Math.min(150, 72 + Q.combo * 9);
    if (Q.focus) markRight(q);
  } else {
    quizBreak(Q.combo); Q.combo = 0; markWrong(q); Q.wrongs.push(q);
    /* 彩蛋成就：连错 5 题、1 秒内答错、错题专练里同一种药连错 3 次、一局点 10 次“记不清” */
    if (dunno) { Q.dunnoN = (Q.dunnoN || 0) + 1; if (Q.dunnoN === 10) PG.achEvent && PG.achEvent("dunno10"); }
    else {
      Q.wrongRun = (Q.wrongRun || 0) + 1; if (Q.wrongRun === 5) PG.achEvent && PG.achEvent("malpractice");
      if (i !== -1 && spent < 1000) PG.achEvent && PG.achEvent("hasty");
      if (Q.focus && q.ref && q.ref.drug) { const k = q.ref.drug.no; Q.drillRun = Q.drillRun || {}; Q.drillRun[k] = (Q.drillRun[k] || 0) + 1; if (Q.drillRun[k] === 3) PG.achEvent && PG.achEvent("resist"); }
    }
    if (Q.lives !== Infinity && !dunno) Q.lives--;
    if (dunno) { SFX.dunno(); ECG.bpm = 72; } else { SFX.wrong(); ECG.alarm = 40; ECG.bpm = 72; }
    const mon = $(".monitor"); mon.classList.add("alarm"); setTimeout(() => mon && mon.classList.remove("alarm"), 900);
    if (btn) FX.at(btn, "shard", 12);
    if (dunno) mood(m, "think", TT("记下来了，看看解析", "Saved — check the explanation"), 2000);
    else mood(m, i === -1 ? "shock" : "sad", i === -1 ? pick(L().time) : pick(L().wrong), 2200);
    renderLives();
    if (Q.lives <= 0) { ECG.flat = true; SFX.flatline(); PG.achEvent && PG.achEvent("flatline"); }
  }
  $("#score").textContent = Q.score; const c = $("#combo"); c.textContent = "×" + Q.combo; c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump");
  $("#hr").innerHTML = (Q.lives <= 0 ? "0" : ECG.bpm) + "<small>BPM</small>";
  stats.bestCombo = Math.max(stats.bestCombo, Q.combo); save();
  $("#explain").innerHTML = `<div class="explain">${explainHTML(q, ok)}</div>`;
  const pickedText = q.rank ? (Array.isArray(i) ? i.map(k => q.options[k]).join(" > ") : "超时") : q.multi ? [...(i === -1 ? [] : i)].map(k => q.options[k]).join(" ／ ") : (i >= 0 ? q.options[i] : dunno ? "记不清" : "超时");
  $("#rep").appendChild(reportBtn(() => reportQ(q, pickedText, "查房问答")));
  const nx = $("#next"); nx.hidden = false; nx.textContent = (Q.lives <= 0 || Q.i + 1 >= Q.n) ? "查看结果 ↵" : "下一题 ↵";
  nx.focus({ preventScroll: true });
}
export function endQuiz() {
  if (!Q) return; const R = Q; clearInterval(R.tid); Q = null;
  if (R.t0 && performance.now() - R.t0 < 5000) PG.achEvent && PG.achEvent("quickquit");   // 彩蛋：开局 5 秒内结束
  if (R.cur) R.cur = null;
  safeRun(() => PG.pgResult({ mode: R.mode, opts: R.opts, title: R.lives <= 0 ? "监护仪报警，本局结束" : (R.title ? R.title + "完成" : "查房结束"), score: R.score, correct: R.correct, answered: R.answered, maxCombo: R.maxCombo, wrongs: R.wrongs, focus: R.focusList, bag: { key: R.bagKey, pool: R.bagPool } }), "结算", () => PG.resultLite({ title: "本局结束", score: R.score, correct: R.correct, answered: R.answered }));
}
/* 强制结束当前问答，直接进简化结算页 */
export function forceEndQuiz() {
  const R = Q || {}; if (Q) { clearInterval(Q.tid); Q = null; }
  try { cancelAnimationFrame(ECG.raf); } catch (e) {}
  PG.resultLite({ title: "本局结束", score: R.score || 0, correct: R.correct || 0, answered: R.answered || 0 });
}
