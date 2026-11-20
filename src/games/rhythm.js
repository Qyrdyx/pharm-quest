/* 药理闯关 · 玩法：摇滚医生（节拍分拣）
 * 药丸随着节拍一格一格往下走，到判定线那一拍把它放进正确的药物组抽屉。抽屉每 8 小节换一次（换之前有一小节预告），
 * 一段里位置固定——记住位置以后只需要认药名、按位置，这才是音游的手感：
 *   - 放对、踩准（±50 ms 完美 / ±100 ms 不错）→ 连击 +1，倍率 ×1 → ×2 → ×3 → ×4，音乐一层层加上去；
 *   - 放对但没踩到拍 → 算答对，但连击断掉；放错抽屉 → 知识错误，进错题本；
 *   - 漏掉、或者没有药丸时乱按（空拍）→ 连击断掉，音乐掉回只有鼓。
 * 题目优先从练过的组里出（熟练度挑战）。时间全部以音频时钟为准；设备延迟用“校准”量出来自动扣掉。 */
import { PG, reg } from "../core/registry.js";
import { $, TT, esc, shuffle } from "../core/utils.js";
import { cfg, mastery, poolDrugs, poolGroups, save, stats } from "../core/state.js";
import { LS } from "../core/storage.js";
import { zhAlt } from "../data/index.js";
import { groupTiers, makeOpts } from "../engine/questions.js";
import { show, toast } from "../ui/screen.js";
import { FX } from "../ui/fx.js";
import { fxLevel } from "../ui/combo.js";
import { SFX } from "../music/sfx.js";
import { AU } from "../music/engine.js";
import { startMusic, stopMusic } from "../music/player.js";
import { RHY, RHY_TRACKS, heardAt, heardNow, rhyClicks, rhyHit, rhyLevel, rhyLoad, rhyPress, rhyReady, rhyStart, rhyStop, rhyFloor } from "../music/rhythm.js";
import { DEV, devOn } from "../core/dev.js";

reg({ RH: () => RH }, { RH: v => { RH = v; } });
Object.assign(PG, { rhythmHub, startRhythm, rhythmCal });   // 页面跳转函数：core/nav.js 会包一层，记录返回路径

const LEAD = 6;                 // 药丸从出现到判定线走 6 拍（提前看得更远，有时间认药）
const SEC = 8;                  // 每 8 小节一段：一段里抽屉固定；每段第 1 小节是“换组预告”，不来药丸
/* 药丸密度：每几拍一颗（简单一直每 4 拍；普通前半首每 4 拍、后半首每 2 拍；困难每 2 拍） */
/* 药丸间隔：三首都是每 4 拍一颗（困难的曲速最快，140 BPM 下约 1.7 秒一颗）；普通只有最后一段高潮每 2 拍 */
const STEP = { revive: () => 4, adrenaline: () => 4, defib: () => 4 };
const WIN = { perfect: 0.07, good: 0.13, near: 0.3 };   // 判定窗口（秒）：放宽，完美 ±70 ms、不错 ±130 ms
const KEYS = { 2: [["ArrowLeft", "a", "1", "j"], ["ArrowRight", "d", "2", "k"]], 3: [["ArrowLeft", "a", "1", "j"], ["ArrowDown", "s", "2", "k"], ["ArrowRight", "d", "3", "l"]], 4: [["ArrowLeft", "a", "1"], ["ArrowDown", "s", "2"], ["ArrowUp", "d", "3"], ["ArrowRight", "f", "4"]] };
const KEY_LABEL = { 2: ["← / A", "→ / D"], 3: ["← / A", "↓ / S", "→ / D"], 4: ["← / A", "↓ / S", "↑ / D", "→ / F"] };
/* 连击 → 音乐层数和倍率 */
/* 连击门槛降低：连对 2 次加和弦、5 次加旋律、8 次全开；断了也至少保留“鼓 + 贝斯”，歌不会只剩鼓 */
const levelOf = n => n >= 8 ? 4 : n >= 5 ? 3 : n >= 2 ? 2 : 1;
const multOf = n => n >= 8 ? 4 : n >= 5 ? 3 : n >= 2 ? 2 : 1;
const SLIP = 2;   // 连着失误 2 次才断连击；只失误 1 次连击保留（提示“小心”）
const cal = () => typeof cfg.rhythmCal === "number" ? cfg.rhythmCal : 0.03;   // 没校准过：按 30 ms 的手指 / 触屏延迟估计

/* ---------- 摇滚医生自己的记录（和学习记录、闪卡、总成就完全分开） ----------
 * 存在 pg_rhythm：每首歌的最高分 / 演奏次数 / 最高连击 / 是否全连，累计完整演奏次数，自己的成就。
 * 不改总答题数、熟练度、错题本、轮换、闪卡，也不触发主成就系统。 */
const RS = () => {
  const s = LS.get("rhythm", null) || { best: {}, plays: 0, songs: {}, ach: {} };
  s.best = s.best || {}; s.songs = s.songs || {}; s.ach = s.ach || {};
  if (stats.best) for (const t of RHY_TRACKS) { const k = "rhythm_" + t.id; if (stats.best[k] != null) { s.best[t.id] = Math.max(s.best[t.id] || 0, stats.best[k]); delete stats.best[k]; LS.set("rhythm", s); save(); } }   // 1.5.0 存在总记录里的最高分搬过来
  return s;
};
const RS_SAVE = s => LS.set("rhythm", s);
/* 成就：[id, 名字, 英文名, 说明, 英文说明, 判定(本局结果 r, 记录 s)] */
const RH_ACH = [
  ["debut", "首次登台", "Debut", "完整演完任意一首歌", "Finish any song", (r, s) => r.done],
  ["tour", "巡回演出", "On tour", "三首歌都完整演完过", "Finish all three songs", (r, s) => RHY_TRACKS.every(t => (s.songs[t.id] || {}).done)],
  ["encore", "返场十次", "Ten encores", "累计完整演完 10 首", "Finish 10 songs in total", (r, s) => s.plays >= 10],
  ["c10", "热身完毕", "Warmed up", "一局里连击达到 10", "Reach a 10 combo", r => r.maxStreak >= 10],
  ["c25", "渐入佳境", "In the groove", "一局里连击达到 25", "Reach a 25 combo", r => r.maxStreak >= 25],
  ["band", "乐队全开", "Full band", "倍率升到 ×4，整个乐队都加进来", "Reach the ×4 multiplier with the full band", r => r.maxStreak >= 8],
  ["clean", "零失误", "Clean set", "一首歌从头到尾没有放错、没有漏掉", "Finish a song with no wrong drops or misses", r => r.done && r.wrongN === 0 && r.miss === 0],
  ["fc", "全连", "Full combo", "一首歌从头到尾没断过连击", "Finish a song without ever breaking the combo", r => r.done && r.breaks === 0 && r.answered > 0],
  ["perfect", "节拍精准", "On the beat", "一首歌里八成以上是「完美」", "Get Perfect on at least 80% of a song", r => r.done && r.answered > 0 && r.perfect / r.answered >= 0.8],
  ["score", "万人迷", "Crowd pleaser", "一局拿到 10000 分", "Score 10,000 in one song", r => r.score >= 10000],
  ["hard", "电击复苏", "Shock and revive", "完整演完「电除颤」（困难）", "Finish Defibrillator (Hard)", r => r.done && r.tr.id === "defib"],
  ["cal", "调好音准", "Tuned in", "完成一次延迟校准", "Complete a latency calibration", (r, s) => !!s.calDone],
];
function rhAchCheck(r) {
  const s = RS(), got = [];
  for (const a of RH_ACH) if (!s.ach[a[0]] && a[5](r, s)) { s.ach[a[0]] = Date.now(); got.push(a); }
  if (got.length) RS_SAVE(s);
  return got;
}
const achName = a => TT(a[1], a[2]), achDesc = a => TT(a[3], a[4]);

export let RH = null;
let wasMusic = false;
/* 进入 / 离开这个板块：暂停背景音乐，离开时恢复原样 */
function enterMode() { if (PG.rhythmActive) return; PG.rhythmActive = true; wasMusic = !!AU.playing; if (wasMusic) stopMusic(); }
function leaveMode() { rhyStop(); if (!PG.rhythmActive) return; PG.rhythmActive = false; if (wasMusic) setTimeout(() => { if (!PG.rhythmActive) startMusic(); }, 350); wasMusic = false; }

/* 出题用的药：本次范围里“练过 5 题以上”的组优先（熟练度挑战）；不够 MIN_G 个组就用整个范围。
 * 摇滚医生是娱乐玩法：不算轮换（重复次数）、不记错题本、不改熟练度，只算总答题数和最高分。 */
const MIN_G = 6;   // 至少 6 个药物组才开局：免得一首歌里翻来覆去就那几种药
const groupsOf = ds => new Set(ds.map(d => d.g)).size;
function rhythmPool() {
  const all = poolDrugs(), known = all.filter(d => (mastery[d.g.id]?.a || 0) >= 5);
  return groupsOf(known) >= MIN_G && known.length >= 16 ? { pool: known, known: true } : { pool: all, known: false };
}
const poolOk = pool => groupsOf(pool) >= MIN_G;

/* ---------- 入口页：选难度、校准 ---------- */
export function rhythmHub() {
  enterMode(); rhyStop(true); rhyLoad();   // 先把乐器采样解码好
  const { pool, known } = rhythmPool(), rs = RS(), best = rs.best;
  show(`<div class="sel-head"><div><div class="eyebrow">${TT("节奏挑战 · 测试版", "Rhythm challenge · Beta")}</div><h2 style="font-size:28px">${TT("摇滚医生", "Rock Doctor")}</h2>
      <p style="color:var(--mute);margin:6px 0 0;max-width:66ch">${TT("药丸跟着节拍一格一格往下走，走到判定线的那一拍，把它放进正确的药物组抽屉。抽屉每 8 小节换一次，换之前有一小节预告；一段里位置不变，记住位置就只需要认药名。放对就算连击，连对越多倍率越高（最高 ×4），乐队也一层层加进来；连着错两次才断连击，断了也还有鼓和贝斯。", "Pills step down on the beat; on the beat they reach the line, drop each into the right drug-group drawer. Drawers change every 8 bars with a one-bar preview and stay put in between — learn the positions, then just read the drug. Every right drop keeps the combo going, building the multiplier (up to ×4) and the band with it; only two misses in a row break it, and drums and bass keep playing.")}</p></div></div>
    ${!poolOk(pool) ? `<p class="rh-warn">${TT(`考试范围里只有 ${groupsOf(pool)} 个药物组，至少要 ${MIN_G} 个才能玩（不然一首歌里总是那几种药）。先去“选择考试范围”多选几组。`, `Only ${groupsOf(pool)} drug groups in scope — at least ${MIN_G} are needed so a song is not the same few drugs. Pick more groups first.`)}</p>` : `<p class="rh-src">${known ? TT(`题目来自你练过的 ${new Set(pool.map(d => d.g.id)).size} 个组（${pool.length} 种药）`, `Questions come from ${new Set(pool.map(d => d.g.id)).size} groups you've practised (${pool.length} drugs)`) : TT(`练过的组还不多，这次从考试范围的 ${pool.length} 种药里出`, `Not many practised groups yet — using all ${pool.length} drugs in scope`)}</p>`}
    <div class="rh-levels">${RHY_TRACKS.map((t, i) => `<button class="mode rh-lv" data-rt="${i}" ${!poolOk(pool) ? "disabled" : ""}><span class="tag">${TT(t.level[0], t.level[1])} · ${t.lanes} ${TT("个抽屉", "drawers")}</span><h3>${TT(t.name[0], t.name[1])}</h3><p>${t.style[0]} · ${Math.round(t.bars * 4 * 60 / t.bpm)} ${TT("秒", "s")}</p><span class="rh-best">${TT("最高", "Best")} ${best[t.id] || 0}${(rs.songs[t.id] || {}).fc ? " · " + TT("全连", "FC") : ""}</span></button>`).join("")}</div>
    <div class="rh-cal"><div><b>${TT("延迟校准", "Latency calibration")}</b><small>${typeof cfg.rhythmCal === "number" ? TT(`已校准：${Math.round(cfg.rhythmCal * 1000)} 毫秒`, `Calibrated: ${Math.round(cfg.rhythmCal * 1000)} ms`) : TT("还没校准。戴蓝牙耳机或用手机玩，建议先校准一次。", "Not calibrated yet — recommended for Bluetooth headphones or phones.")}</small></div><button class="btn ghost" id="rhCal">${TT("去校准", "Calibrate")}</button></div>
    <div class="rh-opt"><b>${TT("按键音", "Key sound")}</b><div class="seg" id="rhKeySeg">${[[2, TT("开", "On")], [1, TT("轻", "Soft")], [0, TT("关", "Off")]].map(([v, l]) => `<button data-v="${v}" aria-pressed="${(cfg.rhKey == null ? 1 : cfg.rhKey) === v}">${l}</button>`).join("")}</div><small>${TT("按下时的一声轻“嗒”。设备有延迟、觉得它比手指晚，就调轻或关掉。", "A soft tick on every press. Turn it down or off if it feels late on your device.")}</small></div>
    <div class="rh-ach"><b>${TT("摇滚医生成就", "Rock Doctor achievements")} ${RH_ACH.filter(a => rs.ach[a[0]]).length} / ${RH_ACH.length}</b><small>${TT("只算这个板块，和学习记录、闪卡、总成就分开", "Separate from study records, flashcards and the main achievements")}</small>
      <div class="rh-ach-grid">${RH_ACH.map(a => `<div class="rh-badge${rs.ach[a[0]] ? " on" : ""}" title="${esc(achDesc(a))}"><i>${rs.ach[a[0]] ? "★" : "☆"}</i><span><b>${esc(achName(a))}</b><small>${esc(achDesc(a))}</small></span></div>`).join("")}</div></div>
    <p class="rh-keys">${TT("电脑：方向键、A S D F 或数字键；手机 / 平板：直接点抽屉。音量跟设置里的“音乐”音量。", "Keyboard: arrows, A S D F or number keys. Touch: tap the drawers. Volume follows the Music setting.")}${cfg.music <= 0 ? `<b class="rh-warn">${TT(" 现在音乐音量是 0，听不到节拍，建议先调大。", " Music volume is 0 — turn it up to hear the beat.")}</b>` : ""}</p>`,
  () => {
    main().querySelectorAll("[data-rt]").forEach(b => b.onclick = () => { SFX.pick(); PG.__rhNext = true; PG.startRhythm(+b.dataset.rt); });
    $("#rhCal").onclick = () => { SFX.click(); PG.__rhNext = true; PG.rhythmCal(); };
    main().querySelectorAll("#rhKeySeg button").forEach(b => b.onclick = () => { cfg.rhKey = +b.dataset.v; save(); main().querySelectorAll("#rhKeySeg button").forEach(x => x.setAttribute("aria-pressed", x === b)); rhyLoad().then(() => rhyPress()); });
    PG.cleanup = () => { if (!PG.__rhNext) leaveMode(); PG.__rhNext = false; };
  });
}
const main = () => document.querySelector("#main");

/* ---------- 校准：跟着“嗒”点 8 下 ---------- */
/* 校准：12 下“嗒”，每一拍只记第一下；漏几下、晚开始都没关系，嗒声放完后自动出结果（记到 6 下以上就算）。
 * 以前要求正好点满 8 下才结束：漏一下、晚开始或者蓝牙耳机延迟大让最后一下落到范围外，就一直停在一半，没有任何提示。 */
const CAL_N = 12, CAL_MIN = 6;
export function rhythmCal() {
  enterMode();
  let run = null, endTimer = 0; const taps = new Map();   // 拍号 → 偏差（秒）
  show(`<div class="rh-calpage"><div class="eyebrow">${TT("摇滚医生", "Rock Doctor")}</div><h2>${TT("延迟校准", "Latency calibration")}</h2>
    <p>${TT("点“开始”后会先响 2 下预备，接着每一下“嗒”的时候点一下下面的大按钮（或按空格 / 任意方向键），一共 12 下；漏掉几下没关系，记到 6 下以上就能算出结果。软件会算出这台设备从出声到你按下的平均延迟，以后自动扣掉。", "After Start you'll hear 2 lead-in clicks. Then tap the big button (or press Space / any arrow) on each click — 12 in all; missing a few is fine, 6 are enough. The average delay is subtracted automatically from then on.")}</p>
    <button class="rh-pad" id="rhPad">${TT("跟着“嗒”点这里", "Tap here on each click")}</button>
    <div class="rh-dots" id="rhDots">${Array.from({ length: CAL_N }, () => "<i></i>").join("")}</div>
    <p class="rh-calres" id="rhRes">${typeof cfg.rhythmCal === "number" ? TT(`当前：${Math.round(cfg.rhythmCal * 1000)} 毫秒`, `Current: ${Math.round(cfg.rhythmCal * 1000)} ms`) : ""}</p>
    <div class="io-row"><button class="btn" id="rhGo">${TT("开始", "Start")}</button><button class="ibtn" id="rhMinus">−10 ms</button><button class="ibtn" id="rhPlus">+10 ms</button><button class="btn ghost" id="rhBack">${TT("返回", "Back")}</button></div></div>`,
  () => {
    const res = $("#rhRes"), dots = [...document.querySelectorAll("#rhDots i")];
    const go = $("#rhGo"), goText = go.textContent;
    const tap = perf => { if (!run) return;
      $("#rhPad").classList.remove("hit"); void $("#rhPad").offsetWidth; $("#rhPad").classList.add("hit");
      /* 归到哪一拍：允许比这一拍早 0.3 拍、晚 0.7 拍（蓝牙耳机延迟大也能对上），每拍只记第一下 */
      const th = heardAt(perf), k = Math.floor((th - run.t0) / run.beat + 0.3); if (k < 0 || k >= CAL_N || taps.has(k)) return;
      taps.set(k, th - (run.t0 + k * run.beat)); if (dots[k]) dots[k].classList.add("on");
      if (taps.size >= CAL_N - 2) finish(); };   // 点到 10 下就可以提前出结果
    const finish = () => { clearTimeout(endTimer); go.disabled = false; go.textContent = goText;
      const all = [...taps.entries()], use = (all.filter(([k]) => k >= 2).length >= CAL_MIN ? all.filter(([k]) => k >= 2) : all).map(([, v]) => v).sort((a, b) => a - b), med = use[Math.floor(use.length / 2)];   // 尽量去掉前两拍（还没跟上节奏），取中位数
      run = null;
      if (taps.size < CAL_MIN) { res.textContent = TT(`只记到 ${taps.size} 下，至少要 ${CAL_MIN} 下。点“开始”再来一次，跟着“嗒”点就行`, `Only ${taps.size} taps recorded — at least ${CAL_MIN} are needed. Press Start to try again.`); return; }
      if (Math.abs(med) > 0.4) { res.textContent = TT("差得太多了，可能没跟上节奏，再试一次", "Too far off — try again"); return; }
      cfg.rhythmCal = Math.round(med * 1000) / 1000; save(); { const st = RS(); st.calDone = true; RS_SAVE(st); const g = rhAchCheck({ maxStreak: 0, score: 0 }); g.forEach(a => toast(TT("🎸 摇滚医生成就：", "🎸 Rock Doctor: ") + achName(a), 3200)); } res.textContent = TT(`校准好了：${Math.round(med * 1000)} 毫秒`, `Calibrated: ${Math.round(med * 1000)} ms`); SFX.pick(); };
    $("#rhPad").addEventListener("pointerdown", e => { e.preventDefault(); tap(e.timeStamp); });
    const onKey = e => { if (e.repeat) return; if ([" ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(e.key)) { e.preventDefault(); tap(e.timeStamp); } };
    addEventListener("keydown", onKey);
    go.onclick = () => { if (run) return; taps.clear(); dots.forEach(x => x.classList.remove("on")); res.textContent = ""; run = rhyClicks(CAL_N, 100); if (!run) { res.textContent = TT("这台设备没法播放声音", "Audio isn't available on this device"); return; }
      go.disabled = true; go.textContent = TT("进行中…", "Listening…");
      clearTimeout(endTimer); endTimer = setTimeout(() => { if (run) finish(); }, (run.t0 - AU.ctx.currentTime + CAL_N * run.beat + 0.9) * 1000); };   // 嗒声放完自动出结果，不会卡在一半
    const nudge = v => { cfg.rhythmCal = Math.round(((typeof cfg.rhythmCal === "number" ? cfg.rhythmCal : 0.03) + v) * 1000) / 1000; save(); res.textContent = TT(`当前：${Math.round(cfg.rhythmCal * 1000)} 毫秒`, `Current: ${Math.round(cfg.rhythmCal * 1000)} ms`); SFX.click(); };
    $("#rhMinus").onclick = () => nudge(-0.01); $("#rhPlus").onclick = () => nudge(0.01);
    $("#rhBack").onclick = () => { SFX.click(); PG.__rhNext = true; PG.rhythmHub(); };
    PG.cleanup = () => { clearTimeout(endTimer); removeEventListener("keydown", onKey); rhyStop(true); if (!PG.__rhNext) leaveMode(); PG.__rhNext = false; };
  });
}

/* ---------- 一局 ---------- */
export function startRhythm(ti = 0) {
  const tr = RHY_TRACKS[ti] || RHY_TRACKS[0], { pool } = rhythmPool();
  if (!poolOk(pool)) { PG.rhythmHub(); return; }
  enterMode();
  /* 分段：每段从范围里挑几个组当这一段的抽屉（轮着挑，尽量每段不一样），这一段的药丸只从这几个组里出。
   * 一首歌里每种药最多出现一次；只有范围里这几个组的药全部用完了，才允许重新出（再洗一遍） */
  const order = shuffle(pool.slice()), groups = [], used = new Set();
  order.forEach(d => { if (!groups.includes(d.g)) groups.push(d.g); });
  shuffle(groups);
  const n = Math.max(2, Math.min(tr.lanes, groups.length)), beats = tr.bars * 4, step = STEP[tr.id] || (() => 4), sections = [], pills = [];
  const unusedIn = g => order.filter(d => d.g === g && !used.has(d)).length;
  let prevGs = [];
  for (let b0 = 0; b0 < tr.bars; b0 += SEC) {
    /* 这一段的抽屉：优先选还剩最多“没出过的药”的组，并尽量避开上一段刚用过的组 */
    const gs = groups.slice().sort((a, b) => (prevGs.includes(a) - prevGs.includes(b)) || (unusedIn(b) - unusedIn(a)) || (Math.random() - 0.5)).slice(0, n); prevGs = gs;
    const names = gs.map(g => g.n), ds = order.filter(d => gs.includes(d.g));
    const next = () => { let left = ds.filter(d => !used.has(d)); if (!left.length) { ds.forEach(d => used.delete(d)); left = ds.slice(); }   // 这几个组的药都出过了：才放回去重新抽
      const prev = pills.length ? pills[pills.length - 1].d : null, cand = left.filter(d => d !== prev), pick = cand.length ? cand[Math.floor(Math.random() * cand.length)] : left[0]; used.add(pick); return pick; };
    sections.push({ b0, names });
    /* 第 1 小节是换组预告：这期间不出现药丸；预告结束后药丸才开始落，走完 LEAD 拍到判定线 */
    const first = (b0 + 1) * 4 + LEAD, end = Math.min(b0 + SEC, tr.bars) * 4;
    for (let hb = first; hb < end && hb < beats - 1;) {
      const bar = Math.floor(hb / 4);
      const d = next();
      pills.push({ hb, d, o: { options: names, ans: gs.indexOf(d.g) }, sec: sections.length - 1, state: 0 });   // state: 0 等待 1 已判
      hb += step(bar);
    }
  }
  RH = { tr, n, pills, sections, curSec: -1, front: 0, streak: 0, maxStreak: 0, score: 0, perfect: 0, good: 0, late: 0, miss: 0, wrongN: 0, offb: 0, correct: 0, answered: 0, wrongs: [], t0: 0, beat: 60 / tr.bpm, raf: 0, ended: false, el: {}, flash: [], ecgHits: [] };
  show(`<div class="rh-game lanes-${n}">
      <div class="rh-hud"><div class="panel stat"><div class="k">SCORE</div><div class="v" id="rhScore">0</div></div><div class="panel stat rh-mult"><div class="k">${TT("倍率", "MULT")}</div><div class="v" id="rhMult">×1</div><small id="rhStreak">${TT("连击 0", "Combo 0")}</small></div><div class="panel stat"><div class="k">${TT("完美 / 不错 / 失误", "PERF / GOOD / MISS")}</div><div class="v rh-cnt" id="rhCnt">0 / 0 / 0</div></div></div>
      <canvas class="rh-ecg" id="rhEcg"></canvas>
      <div class="rh-belt" id="rhBelt"><div class="rh-line"></div><div class="rh-judge" id="rhJudge"></div><div class="rh-ann" id="rhAnn"></div><div class="rh-combo" id="rhCombo"></div></div>
      <div class="rh-lanes" id="rhLanes">${Array.from({ length: n }, (_, i) => `<button class="rh-lane" data-lane="${i}"><span class="rh-k">${KEY_LABEL[n][i]}</span><b></b></button>`).join("")}</div>
      <div class="rh-foot"><span class="rh-count" id="rhCountIn"></span><button class="ibtn" id="rhQuit">${TT("结束本局", "End game")}</button></div>
    </div>`,
  () => {
    RH.el = { belt: $("#rhBelt"), lanes: [...document.querySelectorAll(".rh-lane")], score: $("#rhScore"), mult: $("#rhMult"), streak: $("#rhStreak"), cnt: $("#rhCnt"), judge: $("#rhJudge"), ecg: $("#rhEcg"), countIn: $("#rhCountIn"), ann: $("#rhAnn"), combo: $("#rhCombo"), game: document.querySelector(".rh-game"), wave: null };
    /* 音浪画布直接挂在 body 上：页面容器有过渡用的 transform，挂在里面 fixed 会跟着容器偏 */
    document.querySelector("#rhWave")?.remove(); const wv = document.createElement("canvas"); wv.className = "rh-wave"; wv.id = "rhWave"; wv.setAttribute("aria-hidden", "true"); document.body.appendChild(wv); RH.el.wave = wv;
    const down = (i, on) => { const b = RH && RH.el.lanes[i]; if (b) b.classList.toggle("down", on); };   // 按住时抽屉沉下去，松开弹回来
    RH.el.lanes.forEach((b, i) => { b.addEventListener("pointerdown", e => { e.preventDefault(); down(i, true); press(i, e.timeStamp); });
      ["pointerup", "pointerleave", "pointercancel"].forEach(t => b.addEventListener(t, () => down(i, false))); });
    const laneOf = e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; return KEYS[n].findIndex(ks => ks.includes(k)); };
    const onKey = e => { if (!RH) return; const lane = laneOf(e); if (lane < 0) return; e.preventDefault(); if (e.repeat) return; down(lane, true); press(lane, e.timeStamp); };
    const onKeyUp = e => { const lane = laneOf(e); if (lane >= 0) down(lane, false); };
    addEventListener("keydown", onKey); addEventListener("keyup", onKeyUp);
    $("#rhQuit").onclick = () => { SFX.click(); finish(true); };
    PG.cleanup = () => { removeEventListener("keydown", onKey); removeEventListener("keyup", onKeyUp); document.querySelector("#rhWave")?.remove(); if (RH) cancelAnimationFrame(RH.raf); if (!PG.__rhNext) leaveMode(); PG.__rhNext = false; RH = null; };
    const go = () => { if (!RH || RH.ended) return; RH.el.countIn.textContent = "";
      const st = rhyStart(tr, () => finish(false));
      if (!st) { toast(TT("这台设备没法播放声音，摇滚医生用不了", "Audio isn't available on this device")); return; }
      RH.t0 = st.t0; RH.beat = st.beat; rhyLevel(levelOf(0));   // 一开始就有鼓 + 贝斯
      labels();
      if (DEV && devOn("rhAuto")) autoPlay();
      RH.raf = requestAnimationFrame(frame); };
    if (rhyReady()) go(); else { RH.el.countIn.textContent = TT("加载乐器…", "Loading instruments…"); rhyLoad().then(go); }   // 采样还没解码完就等一下
  });
}
/* 抽屉上的组名：按当前所在的段固定不变；进入新的一段（它的第 1 小节，不来药丸）时换上新组名，并在中间大字预告 */
function labels() {
  if (!RH || !RH.el.lanes) return;
  const bar = Math.max(0, Math.floor(beatNow() / 4)), si = Math.min(RH.sections.length - 1, Math.floor(bar / SEC));
  if (si === RH.curSec) return; RH.curSec = si;
  const sec = RH.sections[si]; RH.el.lanes.forEach((b, i) => { b.querySelector("b").textContent = sec.names[i] || ""; b.classList.remove("swap"); void b.offsetWidth; b.classList.add("swap"); });
  const a = RH.el.ann; if (a) { a.innerHTML = `<small>${si === 0 ? TT("这一段的抽屉", "Drawers for this section") : TT("换组！这一段的抽屉", "New drawers!")}</small>${sec.names.map((x, i) => `<span><em>${KEY_LABEL[RH.n][i]}</em>${esc(x)}</span>`).join("")}`; a.style.animationDuration = (RH.beat * 4).toFixed(2) + "s"; a.classList.remove("go"); void a.offsetWidth; a.classList.add("go"); }
}
/* 现在耳朵听到的是第几拍（小数） */
const beatNow = () => (heardNow() - RH.t0) / RH.beat;

function press(lane, perfMs) {
  if (!RH || RH.ended) return;
  rhyPress();   // 按下的一瞬间就响（清脆的打击声），不等判定——音游的“手感”主要来自这一下
  const th = heardAt(perfMs) - cal(), p = RH.pills[RH.front];
  beam(lane, "press");
  if (!p) return offBeat(lane);
  const dt = th - (RH.t0 + p.hb * RH.beat);
  if (Math.abs(dt) > WIN.near) return offBeat(lane);
  judge(p, lane, dt);
}
/* 没有药丸时乱按：断连击（这类游戏的核心规则：节奏要踩准） */
function offBeat(lane) {
  RH.offb++; showJudge(TT("空拍", "Off-beat"), "off");   // 没有药丸时按了：只提示，不算失误（包容一点）
}
/* 一次失误：连着第 2 次才断连击；第 1 次只提示“小心”，连击和音乐都保留 */
function slip() {
  RH.err = (RH.err || 0) + 1;
  if (RH.err >= SLIP) { breakStreak(); RH.err = 0; return true; }
  const c = RH.el.combo; if (c && RH.streak >= 2) { c.classList.remove("warn"); void c.offsetWidth; c.classList.add("warn"); }
  return false;
}
function judge(p, lane, dt) {
  p.state = 1; RH.front++; RH.answered++;
  const ok = lane === p.o.ans, ad = Math.abs(dt), grade = !ok ? "wrong" : ad <= WIN.perfect ? "perfect" : ad <= WIN.good ? "good" : "late";
  const q = { ref: { drug: p.d }, options: p.o.options, ans: p.o.ans, type: "group" };
  if (ok) { RH.correct++;
    if (grade === "late") { RH.late++; RH.err = 0; RH.streak++; RH.maxStreak = Math.max(RH.maxStreak, RH.streak); RH.score += 30 * multOf(RH.streak); rhyLevel(levelOf(RH.streak)); showJudge(dt < 0 ? TT("早了一点", "A bit early") : TT("晚了一点", "A bit late"), "late", dt); }   // 放对了但没踩准：照样算连击，只是分少
    else { const m0 = multOf(RH.streak); RH[grade]++; RH.err = 0; RH.streak++; RH.maxStreak = Math.max(RH.maxStreak, RH.streak); RH.score += (grade === "perfect" ? 100 : 60) * multOf(RH.streak); rhyLevel(levelOf(RH.streak));
      showJudge(grade === "perfect" ? TT("完美", "Perfect") : TT("不错", "Good"), grade, dt); rhyHit(grade); boom(lane, grade);
      if (multOf(RH.streak) > m0) multUp(multOf(RH.streak)); }
    beam(lane, grade === "late" ? "late" : "ok");
  } else {
    RH.wrongN++; RH.wrongs.push(q); save(); const broke = slip(); beam(lane, "bad"); flashLane(p.o.ans, "show");
    showJudge(TT("放错了 · ", "Wrong · ") + p.o.options[p.o.ans] + (broke ? "" : TT("（连击还在，小心）", " (combo kept)")), "wrong"); if (broke) shakeGame(3);
  }
  RH.ecgHits.push([p.hb, grade]);
  dropPill(p, lane, ok);
  hud(); labels();
}
function breakStreak() { const had = RH.streak; if (had > 0) RH.breaks = (RH.breaks || 0) + 1; RH.streak = 0; rhyLevel(levelOf(0)); hud(); if (had >= 5) { const c = RH.el.combo; if (c) { c.classList.remove("break"); void c.offsetWidth; c.classList.add("break"); } } }
function hud() {
  RH.el.score.textContent = RH.score; const m = multOf(RH.streak);
  RH.el.mult.textContent = "×" + m; RH.el.mult.parentElement.dataset.m = m;
  RH.el.streak.textContent = TT(`连击 ${RH.streak}`, `Combo ${RH.streak}`);
  RH.el.cnt.textContent = `${RH.perfect} / ${RH.good} / ${RH.miss + RH.wrongN + RH.late}`;
  document.querySelector(".rh-game")?.setAttribute("data-lv", levelOf(RH.streak));
  const c = RH.el.combo; if (c) { c.textContent = RH.streak >= 2 ? RH.streak : ""; if (RH.streak >= 2) { c.classList.remove("pop", "break"); void c.offsetWidth; c.classList.add("pop"); } }
}
/* ---------- 打击特效（音游的通行做法：判定线上爆开 + 抽屉射出光柱 + 连击数跳动 + 倍率升级的全屏冲击） ---------- */
const COLOR = { perfect: "#5fd6a8", good: "#7fe3ff", late: "#f4bf4f", wrong: "#ff6b81", bad: "#ff6b81", ok: "#5fd6a8", press: "#ffffff" };
/* 判定线上爆开：一圈光环 + 一道横向闪光 + 火花（完美更大） */
function boom(lane, grade) {
  if (fxLevel() === 0) return;
  const belt = RH.el.belt, x = belt.clientWidth / 2, y = belt.clientHeight - 24, big = grade === "perfect";
  const e = document.createElement("div"); e.className = "rh-boom " + grade; e.style.left = x + "px"; e.style.top = y + "px"; belt.appendChild(e); setTimeout(() => e.remove(), 520);
  if (fxLevel() >= 2) { const r = belt.getBoundingClientRect(); FX.burst(r.left + x, r.top + y, big ? "spark" : "pill", big ? 16 : 7); }
}
/* 抽屉射出光柱（按下是白色细光，判定后按结果上色） */
function beam(i, kind) {
  const b = RH.el.lanes[i]; if (!b) return; b.style.setProperty("--bc", COLOR[kind] || "#fff");
  b.classList.remove("beam", "hit", "miss"); void b.offsetWidth; b.classList.add("beam", kind === "press" ? "beam" : kind === "bad" ? "miss" : "hit");
  clearTimeout(b._bt); b._bt = setTimeout(() => b.classList.remove("beam", "hit", "miss"), 320);
}
/* 倍率升级：全屏一闪 + 中间大字“×3！” + 轻微震动 */
function multUp(m) {
  if (fxLevel() === 0) return;
  const g = document.querySelector(".rh-game"); if (!g) return;
  const f = document.createElement("div"); f.className = "rh-mup m" + m; f.innerHTML = `<b>×${m}</b><small>${TT(["", "", "音乐加入和弦", "旋律加入", "全开！"][m] || "", ["", "", "Chords join in", "Melody joins in", "Full band!"][m] || "")}</small>`;
  g.appendChild(f); setTimeout(() => f.remove(), 900); shakeGame(m >= 4 ? 6 : 4);
}
function shakeGame(px) {
  if (cfg.shake === 0 || fxLevel() < 2) return;
  const g = document.querySelector(".rh-game"); if (!g) return; g.style.setProperty("--sk", px + "px"); g.classList.remove("shake"); void g.offsetWidth; g.classList.add("shake");
}
function showJudge(text, cls, dt) {
  const j = RH.el.judge; j.className = "rh-judge " + cls; j.textContent = text + (DEV && dt != null ? ` ${dt >= 0 ? "+" : ""}${Math.round(dt * 1000)}ms` : "");
  void j.offsetWidth; j.classList.add("go");
}
function flashLane(i, cls) { const b = RH.el.lanes[i]; if (!b) return; b.classList.remove(cls); void b.offsetWidth; b.classList.add(cls); setTimeout(() => b.classList.remove(cls), 260); }

/* ---------- 画面：每帧按音频时钟摆放药丸、画心电图节拍条 ---------- */
const SLOT = () => Math.max(46, Math.min(64, (RH.el.belt.clientHeight - 30) / (LEAD + 0.6)));
const hop = f => f >= 0.18 ? 1 : 1 - Math.pow(1 - f / 0.18, 3);   // 每拍最后 0.18 拍里跳到下一格，正好在拍点落下
function frame() {
  if (!RH) return; RH.raf = requestAnimationFrame(frame);
  const bn = beatNow(), belt = RH.el.belt, slot = SLOT(), lineY = belt.clientHeight - 24;
  labels();
  /* 每一拍画面都“跳”一下：判定线、传送带边框、心电图标记跟着拍子亮 */
  const ph = bn - Math.floor(bn), pulse = bn < 0 ? 0 : Math.max(0, 1 - ph * 3.2); 
  /* 预备拍倒数 */
  RH.el.countIn.textContent = bn < 0 ? TT(`预备 ${Math.ceil(-bn)}`, `Ready ${Math.ceil(-bn)}`) : "";
  /* 漏掉：过了判定线还没按 */
  let p;
  while ((p = RH.pills[RH.front]) && bn > p.hb + WIN.near / RH.beat + 0.05) {
    p.state = 1; RH.front++; RH.miss++; RH.answered++; const broke = slip(); showJudge(TT("漏了", "Miss") + (broke ? "" : TT("（连击还在）", " (combo kept)")), "miss"); RH.ecgHits.push([p.hb, "miss"]); dropPill(p, -1, false); labels(); hud();
  }
  for (let i = RH.front; i < RH.pills.length; i++) {
    const q = RH.pills[i], rel = q.hb - bn; if (rel > LEAD + 0.2) break;
    if (!q.node) { q.node = document.createElement("div"); q.node.className = "rh-pill"; q.node.innerHTML = `<span class="a">${esc(q.d.en)}</span><span class="b">${esc(zhAlt(q.d))}</span>`; belt.appendChild(q.node); }
    const pos = Math.floor(rel) + hop(rel - Math.floor(rel));
    q.node.style.transform = `translate(-50%, ${lineY - Math.max(0, pos) * slot - 22}px)`;
    q.node.classList.toggle("front", i === RH.front);
    q.node.style.opacity = rel > LEAD - 0.4 ? Math.max(0, (LEAD + 0.2 - rel) / 0.6) : 1;
  }
  drawEcg(bn);
  drawWave();
}
/* ---------- 屏幕边缘的音浪（稳定版）----------
 * 不随拍子一闪一闪：亮度只跟段落走——主歌暗、渐强慢慢变亮、副歌一直亮，切换时用 1 秒左右慢慢过渡；
 * 光条的高度跟频谱走，但上升、回落都做了平滑（不会一帧亮一帧暗），透明度固定，不随音量闪烁。 */
let waveBuf = null, waveSm = {}, waveGlow = 0.35;
function drawWave() {
  const cv = RH.el.wave, an = RHY.an; if (!cv) return;
  const L = fxLevel(); if (!an || L === 0) { cv.style.display = "none"; return; } cv.style.display = "";
  const dpr = Math.min(1.5, devicePixelRatio || 1), w = innerWidth, h = innerHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  if (!waveBuf || waveBuf.length !== an.frequencyBinCount) waveBuf = new Uint8Array(an.frequencyBinCount);
  an.getByteFrequencyData(waveBuf);
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const fl = rhyFloor(heardNow()), climax = fl >= 3; if (RH.el.game) RH.el.game.classList.toggle("hi", climax);
  /* 段落亮度：主歌 0.35、渐强 0.6、副歌 1；每帧只靠近一点点 → 约 1 秒的平滑过渡 */
  waveGlow += ((climax ? 1 : fl >= 2 ? 0.6 : 0.35) - waveGlow) * 0.03;
  const col = climax ? "#ff9ff3" : "#7fe3ff", maxH = (L >= 3 ? 64 : 48) * (0.55 + waveGlow * 0.6), bins = waveBuf.length * 0.62;
  const val = k => { const x = waveBuf[Math.min(waveBuf.length - 1, Math.floor(k * bins))] / 255; return Math.pow(x, 1.25); };
  /* 1. 边缘光带：宽度和亮度只看段落，不跟拍子 */
  const depth = 18 + waveGlow * 40, ga = 0.06 + waveGlow * 0.16;
  const band = (x0, y0, x1, y1, rx, ry, rw, rh) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)"); g.globalAlpha = ga; g.fillStyle = gr; g.fillRect(rx, ry, rw, rh); };
  band(0, 0, 0, depth, 0, 0, w, depth); band(0, h, 0, h - depth, 0, h - depth, w, depth);
  band(0, 0, depth, 0, 0, 0, depth, h); band(w, 0, w - depth, 0, w - depth, 0, depth, h);
  /* 2. 频谱光条：高度平滑跟随（升得快一点、落得慢），透明度固定 */
  g.globalAlpha = 0.3 + waveGlow * 0.4; g.fillStyle = col;
  const edge = (id, n, len, place) => { const bw = len / n, sm = waveSm[id] && waveSm[id].length === n ? waveSm[id] : (waveSm[id] = new Float32Array(n));
    for (let i = 0; i < n; i++) { const k = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2), v = Math.min(1, val(k * 0.85 + 0.02));
      sm[i] += (v - sm[i]) * (v > sm[i] ? 0.25 : 0.06); place(i * bw + bw * 0.14, bw * 0.72, 3 + sm[i] * maxH); } };
  const nx = Math.round(w / 18), ny = Math.round(h / 20);
  edge("t", nx, w, (x, bw, hh) => g.fillRect(x, 0, bw, hh));
  edge("b", nx, w, (x, bw, hh) => g.fillRect(x, h - hh, bw, hh));
  edge("l", ny, h, (y, bh, hh) => g.fillRect(0, y, hh * 0.75, bh));
  edge("r", ny, h, (y, bh, hh) => g.fillRect(w - hh * 0.75, y, hh * 0.75, bh));
  g.globalAlpha = 1;
}
/* 判完的药丸：掉进抽屉（放对）或者变红淡出 */
function dropPill(p, lane, ok) {
  const n = p.node; if (!n) return; p.node = null;
  n.classList.add(ok ? "in" : "out"); if (lane >= 0) { const b = RH.el.lanes[lane], br = b.getBoundingClientRect(), pr = RH.el.belt.getBoundingClientRect(); n.style.left = (br.left + br.width / 2 - pr.left) + "px"; }
  setTimeout(() => n.remove(), 380);
}
/* 心电图节拍条：每一拍一个波划向左边的判定标记；有药丸的拍是大的 QRS 波，判完按结果上色 */
function drawEcg(bn) {
  const cv = RH.el.ecg; if (!cv) return;
  const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const mx = w * 0.16, span = (w - mx) / 4.2, mid = h * 0.62, hitSet = new Map(RH.pills.map(p => [p.hb, p])), res = new Map(RH.ecgHits.map(([b, gr]) => [b, gr]));
  const COL = { perfect: "#5fd6a8", good: "#7fe3ff", late: "#f4bf4f", wrong: "#ff6b81", miss: "#ff6b81" };
  g.lineWidth = 2; g.lineJoin = "round";
  const from = Math.floor(bn - 0.6), to = Math.ceil(bn + 4.4);
  g.strokeStyle = "#7fe3ff55"; g.beginPath(); g.moveTo(0, mid);
  for (let b = from; b <= to; b++) {
    const x = mx + (b - bn) * span, big = hitSet.has(b);
    g.lineTo(x - span * 0.12, mid);
    if (big) { g.lineTo(x - span * 0.05, mid + 4); g.lineTo(x, mid - h * 0.5); g.lineTo(x + span * 0.05, mid + h * 0.22); g.lineTo(x + span * 0.1, mid); }
    else { g.quadraticCurveTo(x, mid - h * 0.12, x + span * 0.1, mid); }
  }
  g.lineTo(w, mid); g.stroke();
  /* 判完的拍：上色重画 */
  res.forEach((gr, b) => { const x = mx + (b - bn) * span; if (x < -20 || x > w + 20) return; g.strokeStyle = COL[gr] || "#fff"; g.lineWidth = 3; g.beginPath(); g.moveTo(x - span * 0.05, mid + 4); g.lineTo(x, mid - h * 0.5); g.lineTo(x + span * 0.05, mid + h * 0.22); g.stroke(); });
  /* 判定标记 */
  const pulse = 0.4;   // 判定标记亮度固定，不随拍子闪
  g.strokeStyle = `rgba(255,255,255,${0.35 + pulse * 0.6})`; g.lineWidth = 2; g.beginPath(); g.moveTo(mx, 4); g.lineTo(mx, h - 4); g.stroke();
  g.fillStyle = `rgba(127,227,255,${0.15 + pulse * 0.4})`; g.beginPath(); g.arc(mx, mid, 9 + pulse * 5, 0, 6.2832); g.fill();
}

/* ---------- 结束：自己的结算页（不走总结算页，不计入总局数、总最高分和主成就） ---------- */
function finish(quit) {
  if (!RH || RH.ended) return; RH.ended = true; cancelAnimationFrame(RH.raf);
  const R = RH; RH.pills.forEach(p => p.node && p.node.remove());
  rhyStop(); PG.__rhNext = true;
  const st = RS(), song = st.songs[R.tr.id] = st.songs[R.tr.id] || { plays: 0, best: 0, maxCombo: 0 }, prevBest = st.best[R.tr.id] || 0, isBest = R.score > prevBest;
  const done = !quit && R.front >= R.pills.length;
  if (isBest) st.best[R.tr.id] = R.score;
  song.maxCombo = Math.max(song.maxCombo || 0, R.maxStreak);
  if (done) { song.done = true; song.plays = (song.plays || 0) + 1; st.plays = (st.plays || 0) + 1; if (!R.breaks && R.answered) song.fc = true; }
  RS_SAVE(st);
  const got = rhAchCheck({ ...R, done, breaks: R.breaks || 0 });
  const timing = R.perfect + R.good, tot = R.answered || 1, wr = [...new Map(R.wrongs.map(q => [q.ref.drug.no, q])).values()];
  show(`<div class="result rh-res"><div class="eyebrow">${TT("摇滚医生", "Rock Doctor")} · ${TT(R.tr.level[0], R.tr.level[1])}</div><h2 style="font-size:30px">${quit ? TT("提前结束 · ", "Ended early · ") : ""}${esc(TT(R.tr.name[0], R.tr.name[1]))}</h2>
      <div class="score">${R.score}</div>${isBest ? `<div class="newbest">${TT("新纪录！", "New best!")}</div>` : `<div style="color:var(--faint);font-size:13px">${TT("最高", "Best")} ${prevBest}</div>`}
      <div class="meta"><span>${TT("最高连击", "Max combo")} <b>${R.maxStreak}</b></span><span>${TT("放对", "Right")} <b>${R.correct}/${R.answered}</b></span><span>${TT("节奏准确率", "Timing")} <b>${Math.round(timing / tot * 100)}%</b></span>${done && !R.breaks && R.answered ? `<span class="rh-fc">${TT("全连！", "Full combo!")}</span>` : ""}</div>
      <p class="rh-res-x">${TT(`完美 ${R.perfect} · 不错 ${R.good} · 偏了 ${R.late} · 放错 ${R.wrongN} · 漏 ${R.miss} · 空拍 ${R.offb}`, `Perfect ${R.perfect} · Good ${R.good} · Off-time ${R.late} · Wrong ${R.wrongN} · Miss ${R.miss} · Off-beat ${R.offb}`)}</p>
      ${got.length ? `<div class="rh-newach"><b>${TT("解锁新成就", "New achievements")}</b>${got.map(a => `<span>★ ${esc(achName(a))}<small>${esc(achDesc(a))}</small></span>`).join("")}</div>` : ""}
      ${wr.length ? `<details class="rh-wr"><summary>${TT(`放错的药（${wr.length}）· 只是给你看看，不记进错题本`, `Drugs you misplaced (${wr.length}) · for reference only, not saved`)}</summary>${wr.map(q => `<div><b>${esc(q.ref.drug.en)}</b> ${esc(zhAlt(q.ref.drug))} → ${esc(q.options[q.ans])}</div>`).join("")}</details>` : ""}
      <div class="q-actions" style="justify-content:center"><button class="btn" id="rhAgain">${TT("再来一首", "Play again")}</button><button class="btn ghost" id="rhHub">${TT("回到摇滚医生", "Rock Doctor")}</button><button class="btn ghost" id="rhHome">${TT("回首页", "Home")}</button></div></div>`, () => {
    $("#rhAgain").onclick = () => { SFX.click(); PG.__rhNext = true; PG.startRhythm(RHY_TRACKS.indexOf(R.tr)); };
    $("#rhHub").onclick = () => { SFX.click(); PG.__rhNext = true; PG.rhythmHub(); };
    $("#rhHome").onclick = () => { SFX.click(); PG.home(); };
    PG.cleanup = () => { if (!PG.__rhNext) leaveMode(); PG.__rhNext = false; };
    if (got.length && fxLevel() >= 1) { const r = document.querySelector(".rh-newach")?.getBoundingClientRect(); if (r) FX.burst(r.left + r.width / 2, r.top + 20, "spark", 14); }
  });
  PG.__rhNext = false;
}

/* ---------- 开发者版：自动打（误差可调），用来看手感 ---------- */
function autoPlay() {
  const jitter = (window.PG_DEV.rhJitter ?? 30) / 1000, acc = (window.PG_DEV.rhAcc ?? 100) / 100;
  const tick = () => { if (!RH || RH.ended) return;
    const p = RH.pills[RH.front]; if (p && !p.auto) { p.auto = true; const err = (Math.random() * 2 - 1) * jitter, target = RH.t0 + p.hb * RH.beat + err + cal();
      const wait = (target - heardNow()) * 1000; const lane = Math.random() < acc ? p.o.ans : (p.o.ans + 1) % RH.n;
      setTimeout(() => { if (RH && RH.pills[RH.front] === p) press(lane, performance.now()); }, Math.max(0, wait)); }
    setTimeout(tick, 60); };
  tick();
}
