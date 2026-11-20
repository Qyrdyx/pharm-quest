/* 药理闯关 · 玩法：中英默写 */
import { PG, reg } from "../core/registry.js";
import { $, esc, pick, shuffle } from "../core/utils.js";
import { DM, DR } from "../data/index.js";
import { cfg, poolDrugs, save, stats, trackQ } from "../core/state.js";
import { SFX } from "../music/sfx.js";
import { FX } from "../ui/fx.js";
import { L, mascotHTML, mood } from "../ui/mascot.js";
import { markRight, markWrong } from "../records/wrong.js";
import { reportBtn, reportQ } from "../records/reports.js";
import { main, show, toTop } from "../ui/screen.js";
import { bagDeck, bagMark, bagProgress } from "../records/rotation.js";

reg({ FORM_RE: () => FORM_RE, SALT_EN: () => SALT_EN, EN_ALT: () => EN_ALT, CN_ALT: () => CN_ALT, LATIN3: () => LATIN3, enParts: () => enParts, cnParts: () => cnParts, enShow: () => enShow, cnShow: () => cnShow, normEn: () => normEn, normCn: () => normCn, enAnswers: () => enAnswers, cnAnswers: () => cnAnswers, canSpell: () => canSpell, spellPool: () => spellPool, editDist: () => editDist, SPELL_DIR: () => SPELL_DIR, SP: () => SP, spellStep: () => spellStep, spellHint: () => spellHint, spellSubmit: () => spellSubmit, spellFinish: () => spellFinish, spellNext: () => spellNext, endSpell: () => endSpell }, { SP: v => { SP = v; } });
Object.assign(PG, { spellHub, startSpell });   // 页面跳转函数：core/nav.js 会包一层，记录返回路径

/* ---------- 中英默写 ---------- */
export const FORM_RE = /spray|tablet|ointment|solution|ampoule/i;
export const SALT_EN = /\b(sodium|hydrochloride|citrate|sulfate|acetate|bromide)\b/gi;
/* 常用别名：写这些也算对 */
export const EN_ALT = { 36: ["Nikethamide"], 84: ["Piracetam"], 94: ["Acetaminophen"], 98: ["Amiodarone"], 155: ["Doxyrubicin"], 59: ["Cyclosporine", "Ciclosporin"], 122: ["Amoxicillin clavulanate", "Amoxicillin clavulanic acid"], 124: ["Piperacillin tazobactam"], 53: ["Nandrolone phenylpropionate"], 178: ["Vitamin B"] };
export const CN_ALT = { 59: ["环孢素"], 178: ["维生素B", "复合维生素B"], 94: ["扑热息痛"], 80: ["安定"], 21: ["苯肾上腺素", "新福林"], 27: ["心得安"], 28: ["倍他乐克"], 40: ["冬眠灵"], 44: ["优降糖"], 42: ["他巴唑"], 33: ["异丙酚"], 99: ["速尿"], 100: ["安体舒通"], 117: ["催产素"], 50: ["孕酮"], 147: ["灭滴灵"], 149: ["无环鸟苷"], 170: ["雷米封"], 19: ["氯琥珀胆碱", "司可林"], 175: ["心痛定"], 36: ["可拉明"], 72: ["双氧水"], 122: ["阿莫西林克拉维酸钾"], 124: ["哌拉西林他唑巴坦钠"] };
export const LATIN3 = /[A-Za-z]{3,}/;
export const enParts = d => { const m = d.en.match(/^([^(]+?)\s*(?:\((.+)\))?$/); return { main: m[1].trim(), alias: m[2] && !FORM_RE.test(m[2]) ? m[2].trim() : "" }; };
export const cnParts = d => { const m = d.zh.match(/^([^（(]+?)\s*(?:[（(](.+)[）)])?$/); const alias = m[2] && !LATIN3.test(m[2]) ? m[2].trim() : ""; return { main: m[1].trim(), alias }; };
export const enShow = d => { const p = enParts(d); return p.alias ? `${p.main} (${p.alias})` : p.main; };
export const cnShow = d => { const p = cnParts(d); return p.alias ? `${p.main}（${p.alias}）` : p.main; };
export const normEn = t => t.toLowerCase().replace(/[^a-z0-9]/g, "");
export const normCn = t => t.toLowerCase().replace(/[\s·・,，、\/／+＋\-－—()（）.。]/g, "");
export function enAnswers(d) {
  const sameDrugs = d.same ? DR.filter(x => x.same === d.same) : [d], out = [];
  sameDrugs.forEach(x => { const p = enParts(x); out.push(p.main); if (p.alias) out.push(p.alias); const bare = p.main.replace(SALT_EN, "").trim(); if (bare) out.push(bare); });
  if (d.en.includes("+")) out.push(d.en.split("+").map(x => x.trim()).reverse().join(" "));
  return [...new Set([...out, ...(EN_ALT[d.no] || [])].map(normEn).filter(Boolean))];
}
export function cnAnswers(d) {
  const p = cnParts(d), out = [p.main];
  if (p.alias) out.push(p.alias);
  const bare = p.main.replace(/^(盐酸|枸橼酸|硫酸|醋酸)/, ""); if (bare.length >= 2) out.push(bare);
  const noNa = p.main.replace(/钠$/, ""); if (noNa.length >= 3) out.push(noNa);
  if (p.main.includes("+")) out.push(p.main.split("+").map(x => x.trim()).reverse().join(""));
  return [...new Set([...out, ...(CN_ALT[d.no] || [])].map(normCn).filter(Boolean))];
}
/* 商品名本身没有通用中文名，不能英中互写；同一活性成分只出一次 */
export const canSpell = d => d.en !== d.zh && !LATIN3.test(cnParts(d).main) && !(d.same && DR.find(x => x.same === d.same) !== d);
export const spellPool = () => poolDrugs().filter(canSpell);
export function editDist(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { let prev = dp[0]; dp[0] = i; for (let j = 1; j <= b.length; j++) { const t = dp[j]; dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; } }
  return dp[b.length];
}
export const SPELL_DIR = {
  e2c: { name: "英写中", title: "看 INN 写中文", ask: "写出它的中文名", ph: "在这里输入中文名", q: enShow, a: cnShow, main: d => cnParts(d).main, answers: cnAnswers, norm: normCn, near: (dist, len) => dist === 1 && len >= 3 },
  c2e: { name: "中写英", title: "看中文写 INN", ask: "写出它的英文名 / INN", ph: "在这里输入英文名", q: cnShow, a: enShow, main: d => enParts(d).main, answers: enAnswers, norm: normEn, near: (dist, len) => dist <= (len >= 8 ? 2 : 1) }
};
export let SP = null;
export function spellHub() {
  const pool = spellPool(), excluded = DR.filter(d => LATIN3.test(cnParts(d).main));
  const count = cfg.spellN === undefined ? 20 : cfg.spellN;
  show(`<div class="sel-head"><div><div class="eyebrow">专项板块</div><h2 style="font-size:28px">中英默写</h2>
      <p style="color:var(--mute);margin:6px 0 0;max-width:64ch">看着药名，自己动手写出来。先选方向，再开始。</p></div></div>
    <div class="scope"><div><div class="big">${pool.length}</div><div class="lbl">本次范围可默写的药</div></div>
      <div><div class="big">${bagProgress("spell", pool).done}<span style="font-size:15px;color:var(--mute)"> / ${pool.length}</span></div><div class="lbl">本轮已默写</div></div>
      <div class="chips-mini" style="align-items:center"><span>每局题量</span><div class="seg" id="spN">${[10, 20, 40, 0].map(v => `<button data-v="${v}" aria-pressed="${count === v}">${v ? v + " 题" : "全部"}</button>`).join("")}</div></div>
      <button class="btn ghost" id="spScope">选择考试范围</button></div>
    ${pool.length ? "" : `<p style="color:var(--rose);font-weight:800;margin-top:10px">当前范围里没有可默写的药，先选择考试范围。</p>`}
    <div class="modes">
      <button class="mode" data-dir="e2c" ${pool.length ? "" : "disabled"}><span class="tag">英写中</span><h3>看 INN 写中文</h3><p>屏幕显示 Tetracaine，你输入“丁卡因”。</p></button>
      <button class="mode" data-dir="c2e" ${pool.length ? "" : "disabled"}><span class="tag">中写英</span><h3>看中文写 INN</h3><p>屏幕显示“丁卡因”，你输入 Tetracaine，大小写和空格不计。</p></button>
    </div>
    <p class="foot">判分：括号里的别名和常用别名（如“安定”“扑热息痛”）都算对；只差一两个字时会提示你再写一次，第二次仍不对才算错。<br>不参加默写的 ${excluded.length} 种商品名制剂（没有通用中文名）：${excluded.map(d => esc(enParts(d).main)).join("、")}。</p>`,
  () => {
    $("#spScope").onclick = () => { SFX.click(); PG.selector(); };
    $("#spN").querySelectorAll("button").forEach(b => b.onclick = () => { cfg.spellN = +b.dataset.v; save(); SFX.click(); $("#spN").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); });
    main.querySelectorAll("[data-dir]").forEach(b => b.onclick = () => { SFX.pick(); PG.startSpell({ dir: b.dataset.dir }); });
  });
}
export function startSpell(opts = {}) {
  const dir = opts.dir || "e2c", D = SPELL_DIR[dir];
  const src = opts.only ? opts.only.map(n => DM.get(n)).filter(Boolean) : spellPool();
  if (!src.length) return PG.spellHub();
  const n = cfg.spellN === undefined ? 20 : cfg.spellN;
  const deck = opts.only ? shuffle(src.slice()) : bagDeck("spell", src); if (!opts.only && n) deck.length = Math.min(n, deck.length);
  SP = { dir, D, opts, deck, i: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, wrongs: [], tries: 0, hints: 0, locked: false };
  show(`<div class="hud" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      <div class="panel stat"><div class="k">PROGRESS</div><div class="v" id="spProg"></div></div>
      <div class="panel stat"><div class="k">SCORE</div><div class="v" id="spScore">0</div></div>
      <div class="panel stat"><div class="k">COMBO</div><div class="v combo" id="spCombo">×0</div></div></div>
    <div class="stage">${mascotHTML("idle")}
      <div><div class="qcard"><span class="qtype">${D.title}</span><div class="spell-q" id="spQ" data-zh></div><div class="spell-ask">${D.ask}</div></div>
        <form id="spForm" class="spell-form" autocomplete="off">
          <input id="spIn" class="search spell-in" type="text" placeholder="${D.ph}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
          <button class="btn" id="spGo" type="submit">提交</button></form>
        <div class="spell-msg" id="spMsg" role="status"></div>
        <div id="spEx"></div>
        <div class="q-actions"><button class="ibtn" id="spHint" type="button">提示一个字</button><button class="ibtn" id="spGive" type="button">不会，看答案</button><span id="spRep"></span><button class="ibtn" id="spQuit" type="button">结束本局</button><button class="btn" id="spNext" type="button" hidden>下一题</button></div>
      </div></div>`,
  () => {
    let composing = false;
    const spIn = $("#spIn");
    spIn.addEventListener("compositionstart", () => { composing = true; });
    spIn.addEventListener("compositionend", () => { setTimeout(() => { composing = false; }, 0); });
    /* 中文输入法选词时按回车不算提交；按住回车不连发 */
    spIn.addEventListener("keydown", e => { if (e.key === "Enter" && (e.isComposing || composing || e.keyCode === 229 || e.repeat)) e.preventDefault(); });
    $("#spForm").addEventListener("submit", e => { e.preventDefault(); if (!composing) spellSubmit(); });
    $("#spHint").onclick = () => spellHint();
    $("#spGive").onclick = () => { if (SP && !SP.locked) spellFinish(false, $("#spIn").value.trim() || "（没写）"); };
    $("#spQuit").onclick = () => { SFX.click(); endSpell(); };
    $("#spNext").onclick = () => spellNext();
    $("#spNext").addEventListener("keydown", e => { if (e.repeat) e.preventDefault(); });
    spellStep();
  });
}
export function spellStep() {
  toTop();
  const d = SP.deck[SP.i]; SP.tries = 0; SP.hints = 0; SP.locked = false;
  $("#spProg").textContent = `${SP.i + 1}/${SP.deck.length}`;
  $("#spQ").textContent = SP.D.q(d);
  const inp = $("#spIn"); inp.value = ""; inp.disabled = false; inp.classList.remove("ok", "no");
  $("#spGo").hidden = false; $("#spHint").hidden = false; $("#spGive").hidden = false; $("#spNext").hidden = true;
  $("#spMsg").textContent = ""; $("#spMsg").className = "spell-msg"; $("#spEx").innerHTML = ""; $("#spRep").innerHTML = "";
  $(".stage .mascot")?.setAttribute("data-mood", "idle");
  inp.focus({ preventScroll: true });
}
export function spellHint() {
  if (!SP || SP.locked) return;
  const ans = SP.D.main(SP.deck[SP.i]), chars = [...ans]; SP.hints = Math.min(SP.hints + 1, Math.max(1, chars.length - 1));
  const shown = chars.map((c, i) => i < SP.hints || c === " " ? c : "＿").join("");
  const msg = $("#spMsg"); msg.className = "spell-msg hint"; msg.textContent = `提示：${shown}（共 ${chars.length} 个字符）`;
  $("#spIn").focus({ preventScroll: true });
}
export function spellSubmit() {
  if (!SP || SP.locked) return;
  const inp = $("#spIn"), raw = inp.value.trim(), msg = $("#spMsg");
  if (!raw) { msg.className = "spell-msg hint"; msg.textContent = "先写点什么，或者点“不会，看答案”。"; inp.focus({ preventScroll: true }); return; }
  const d = SP.deck[SP.i], val = SP.D.norm(raw), answers = SP.D.answers(d);
  if (answers.includes(val)) return spellFinish(true, raw);
  const nearest = answers.reduce((best, a) => Math.min(best, editDist(val, a)), Infinity);
  if (SP.tries === 0 && SP.D.near(nearest, val.length)) {
    SP.tries = 1; msg.className = "spell-msg near"; msg.textContent = "很接近了，差一点点。检查一下，再写一次。";
    SFX.tick(); inp.classList.remove("no"); void inp.offsetWidth; inp.classList.add("no"); inp.focus({ preventScroll: true }); inp.select();
    return;
  }
  spellFinish(false, raw);
}
export function spellFinish(ok, typed) {
  const d = SP.deck[SP.i], D = SP.D, ans = D.a(d), inp = $("#spIn"), m = $(".stage .mascot"); SP.locked = true;
  if (!SP.opts.only) bagMark("spell", spellPool(), d);   // 提交了答案才算默写过一次
  const q = { ref: { drug: d }, options: [ans], ans: 0, type: "spell", prompt: esc(`${D.title}：${D.q(d)}`) };
  SP.answered++; stats.answered++; trackQ(q, ok);
  inp.disabled = true; inp.classList.remove("no"); inp.classList.add(ok ? "ok" : "no");
  if (ok) {
    SP.correct++; stats.correct++; if (SP.opts.only) markRight(q); SP.combo++; SP.maxCombo = Math.max(SP.maxCombo, SP.combo);
    SP.score += Math.max(25, 100 - SP.hints * 25 - SP.tries * 30) + Math.min(SP.combo, 10) * 10;
    SFX.right(); FX.at(inp, "pill", 16); if (SP.combo >= 3) SFX.combo(SP.combo);
    mood(m, SP.combo >= 5 ? "cheer" : "happy", pick(SP.combo >= 5 ? L().combo : L().right));
  } else {
    SP.combo = 0; markWrong(q); SP.wrongs.push(q);
    SFX.wrong(); FX.at(inp, "shard", 10); mood(m, "sad", pick(L().wrong), 2200);
  }
  stats.bestCombo = Math.max(stats.bestCombo, SP.combo); save();
  $("#spScore").textContent = SP.score; $("#spCombo").textContent = "×" + SP.combo;
  $("#spMsg").textContent = ""; $("#spMsg").className = "spell-msg";
  $("#spEx").innerHTML = `<div class="explain"><div class="verdict ${ok ? "ok" : "no"}">${ok ? (LANG === "en" ? "Correct" : "写对了") : (LANG === "en" ? "Correct answer: " : "正确答案：") + esc(ans)}</div>
    ${ok ? `<p class="m"><em>标准写法</em>${esc(ans)}</p>` : `<p class="m"><em>你写的</em>${esc(typed)}</p>`}
    <div class="ex-drug"><span class="no">#${d.no}</span><b>${esc(enShow(d))}</b><span>${esc(cnShow(d))}</span></div><span class="gchip">#${d.g.id} ${esc(d.g.n)}</span></div>`;
  $("#spGo").hidden = true; $("#spHint").hidden = true; $("#spGive").hidden = true;
  $("#spRep").appendChild(reportBtn(() => reportQ(q, typed, "中英默写")));
  const nx = $("#spNext"); nx.hidden = false; nx.textContent = SP.i + 1 >= SP.deck.length ? "查看结果" : "下一题"; nx.focus({ preventScroll: true });
}
export function spellNext() { if (!SP) return; SFX.click(); SP.i++; if (SP.i >= SP.deck.length) endSpell(); else spellStep(); }
export function endSpell() {
  if (!SP) return; const R = SP; SP = null;
  PG.pgResult({ mode: "spell", bag: R.opts.only ? null : { key: "spell", pool: spellPool() }, opts: { dir: R.dir, only: R.opts.only }, title: R.D.title + "完成", score: R.score, correct: R.correct, answered: R.answered, maxCombo: R.maxCombo, wrongs: R.wrongs });
}
