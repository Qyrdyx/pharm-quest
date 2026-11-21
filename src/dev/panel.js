/* 药理闯关 · 开发者面板（只在开发者版里）
 * 左下角 DEV 按钮：作弊开关、成就逐个解锁 / 撤销、闪卡、连击档位跳转、特效预览、打卡天数、清空开发者数据 */
import { PG } from "../core/registry.js";
import { TT, esc } from "../core/utils.js";
import { LS } from "../core/storage.js";
import { G, P } from "../data/index.js";
import { mastery, save } from "../core/state.js";
import { SFX, CLICK_STYLES } from "../music/sfx.js";
import { QUIZ_TIERS, MATCH_TIERS, matchRoundClear, quizBreak, quizCombo, quizPerfect } from "../ui/combo.js";
import { AU, ensureAudio, mtof, noiseHit, voice } from "../music/engine.js";
import { cfg } from "../core/state.js";

/* 旧版音效（方波、高音区），只用来和新版对比试听 */
const OLD = {
  /* 答题音效第一版（改之前）：按钮方波“哔”、多选同一个上滑音、答对叮咚、答错蜂鸣器 */
  click: (t, o) => voice(o, t, 620, 0.06, { type: "square", vol: 0.05, lp: 2500 }),
  pick: (t, o) => voice(o, t, 520, 0.09, { type: "sine", vol: 0.15, glide: 820 }),
  right1: (t, o) => { voice(o, t, mtof(76), 0.18, { type: "triangle", vol: 0.16, a: 0.008, lp: 2200 }); voice(o, t + 0.08, mtof(83), 0.34, { vol: 0.17, a: 0.008 }); voice(o, t + 0.08, mtof(71), 0.34, { vol: 0.06, a: 0.01 }); },
  wrong: (t, o) => { voice(o, t, 230, 0.32, { type: "sawtooth", vol: 0.14, glide: 110, lp: 900 }); voice(o, t + 0.02, 218, 0.32, { type: "square", vol: 0.06, glide: 100, lp: 700 }); },
  right: (t, o) => { voice(o, t, mtof(76), 0.14, { type: "triangle", vol: 0.25 }); voice(o, t + 0.08, mtof(83), 0.3, { type: "triangle", vol: 0.25 }); voice(o, t + 0.08, mtof(95), 0.25, { vol: 0.06 }); },
  combo: (t, o) => { const sc = [72, 76, 79, 84, 88, 91]; for (let i = 0; i < 6; i++) voice(o, t + i * 0.05, mtof(sc[i]), 0.16, { type: "square", vol: 0.05, lp: 4000 }); },
  tier: (t, o) => { const base = 78, sc = [0, 4, 7, 12, 16, 19, 24]; sc.forEach((x, i) => voice(o, t + i * 0.055, mtof(base + x), 0.22, { type: i % 2 ? "triangle" : "square", vol: 0.07, lp: 5000 })); voice(o, t + sc.length * 0.055, mtof(base + 31), 0.4, { type: "sine", vol: 0.08 }); noiseHit(o, t, 0.08, { ft: "highpass", f: 6000, vol: 0.05 }); },
  shatter: (t, o) => { noiseHit(o, t, 0.25, { ft: "highpass", f: 3000, vol: 0.12 }); [88, 83, 79].forEach((m, i) => voice(o, t + i * 0.04, mtof(m), 0.12, { type: "triangle", vol: 0.06, glide: mtof(m - 12) })); },
  ach: (t, o) => { [72, 79, 84, 88].forEach((m, i) => voice(o, t + i * 0.08, mtof(m), 0.45, { type: "triangle", vol: 0.12 })); voice(o, t + 0.32, mtof(96), 0.6, { type: "sine", vol: 0.07 }); },
  win: (t, o) => [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => voice(o, t + i * 0.09, mtof(m), 0.35, { type: i % 2 ? "triangle" : "square", vol: 0.08, lp: 3500 }))
};
const playOld = k => { if (!ensureAudio() || cfg.sfx <= 0) return; OLD[k](AU.ctx.currentTime, AU.sfx); };

window.PG_DEV = Object.assign({ allRight: false, allLink: false }, LS.get("dev", {}));
const saveDev = () => LS.set("dev", window.PG_DEV);
document.title = "药理闯关 · 开发者版";

const css = document.createElement("style");
css.textContent = `
.dev-btn{position:fixed;left:12px;bottom:12px;z-index:150;padding:8px 14px;border-radius:12px;border:2px solid #ff6b81;background:#2a0f16;color:#ff6b81;font:900 13px/1 var(--f-mono,monospace);letter-spacing:.1em;cursor:pointer;box-shadow:0 6px 20px #0008}
.dev-btn.on{background:#ff6b81;color:#2a0f16}
.dev-rib{position:fixed;left:76px;bottom:18px;z-index:149;padding:3px 10px;background:#ff6b81;color:#2a0f16;font:900 11px/1.4 var(--f-mono,monospace);border-radius:8px;pointer-events:none;opacity:.85}
.dev-pan{position:fixed;left:12px;bottom:60px;z-index:150;width:min(420px,calc(100vw - 24px));max-height:min(78vh,720px);overflow:auto;padding:14px;border-radius:16px;background:var(--ink);border:2px solid #ff6b81;box-shadow:0 18px 50px #000a;color:var(--paper);font-size:13px}
.dev-pan h3{margin:12px 0 6px;font-size:14px;color:#ff6b81}
.dev-pan h3:first-child{margin-top:0}
.dev-pan p{margin:4px 0;color:var(--mute);font-size:12px}
.dev-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.dev-tg{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;margin:4px 0;border-radius:10px;background:var(--bench);cursor:pointer;font-weight:800}
.dev-tg i{width:38px;height:22px;border-radius:11px;background:var(--bench-2);position:relative;flex:none;transition:background .2s}
.dev-tg i::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s}
.dev-tg.on i{background:#5fd6a8}.dev-tg.on i::after{left:19px}
.dev-pan .ibtn{font-size:12px;padding:5px 10px}
.dev-ach{display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:8px}
.dev-ach:nth-child(odd){background:var(--bench)}
.dev-ach span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dev-ach small{color:var(--mute)}
.dev-ach.got span{color:#5fd6a8}
.dev-list{max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:4px;margin-top:6px}
.dev-msg{color:#5fd6a8;font-weight:800;min-height:1em}
.dev-pan .ibtn.on{border-color:#5fd6a8;color:#5fd6a8}
.dev-pan .dev-old{opacity:.7;margin-right:6px}`;
document.head.appendChild(css);
const rib = document.createElement("div"); rib.className = "dev-rib"; rib.textContent = TT("开发者版 · 数据与正式版分开", "DEV build · separate data"); document.body.appendChild(rib);
const btn = document.createElement("button"); btn.className = "dev-btn"; btn.textContent = "DEV"; document.body.appendChild(btn);
let pan = null;

/* ---------- 自动答题 / 自动连线（只为看特效）----------
 * 打开后，当前和之后开始的选择题、连线会自己一步步做下去；速度可选，最慢一档能看清每个特效；正确率可调，用来看“连击中断”“连错”。
 * 一局结束停在结算页（不自动开下一局）。 */
const AUTO_SPEED = { slow: [2600, 1800], mid: [1600, 1100], fast: [900, 650] };   // [选择题每题毫秒, 连线每步毫秒]
const autoOn = () => !!window.PG_DEV.auto;
let autoT = 0;
const autoWait = () => AUTO_SPEED[window.PG_DEV.autoSpeed || "slow"] || AUTO_SPEED.slow;
const autoHit = () => Math.random() * 100 < (window.PG_DEV.autoAcc ?? 100);   // 开发者面板里用 Math.random 无所谓（不参与正式版）
function autoStep() {
  clearTimeout(autoT); if (!autoOn()) return;
  const [qMs, mMs] = autoWait();
  try {
    const Q = PG.Q, M = PG.M;
    if (Q && document.querySelector("#opts")) {
      if (Q.locked) { const nx = document.querySelector("#next"); if (nx && !nx.hidden) nx.click(); autoT = setTimeout(autoStep, qMs * 0.45); return; }
      const q = Q.cur, b = [...document.querySelectorAll("#opts .opt")];
      if (q && b.length) {
        const ok = autoHit();
        if (q.rank) PG.answer(ok ? q.ansSeq.slice() : q.ansSeq.slice().reverse(), null);
        else if (q.multi) PG.answer(ok ? new Set(q.ansSet) : new Set([0]), null);
        else b[ok ? q.ans : (q.ans + 1) % b.length].click();
      }
      autoT = setTimeout(autoStep, qMs * 0.55); return;
    }
    if (M && document.querySelector("#mgrid")) {
      const live = s => [...document.querySelectorAll(`#mgrid .tile${s}:not(.done)`)];
      let L = M.selL && M.selL.isConnected && !M.selL.classList.contains("done") ? M.selL : live('[data-side="L"]')[0];
      if (L) {
        if (M.selL !== L) { L.click(); autoT = setTimeout(autoStep, mMs * 0.45); return; }
        const right = live(`[data-side="R"][data-no="${L.dataset.no}"]:not([data-decoy])`), wrong = live('[data-side="R"]').filter(x => x.dataset.no !== L.dataset.no);
        const pick = autoHit() || !wrong.length ? right[0] : wrong[0];
        if (pick) pick.click();
      }
      autoT = setTimeout(autoStep, mMs); return;
    }
  } catch (e) { console.warn("auto", e); }
  autoT = setTimeout(autoStep, 800);   // 不在答题页：隔一会儿再看
}
const autoBadge = () => { rib.textContent = TT("开发者版 · 数据与正式版分开", "DEV build · separate data") + (autoOn() ? TT(" · 自动中", " · AUTO") : ""); };
if (autoOn()) { autoBadge(); autoT = setTimeout(autoStep, 1200); }

const close = () => { if (pan) { pan.remove(); pan = null; btn.classList.remove("on"); } };
btn.onclick = () => { if (pan) close(); else open(); };

const TIER_N = ["铜", "银", "金"];
const lastDays = n => { const out = []; const d = new Date(); for (let i = 0; i < n; i++) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`); d.setDate(d.getDate() - 1); } return out; };
const refreshPage = () => { const top = PG.NAV && PG.NAV[PG.NAV.length - 1]; if (top && ["achPage", "home", "codex"].includes(top.name)) { const y = scrollY; PG[top.name](...(top.args || [])); scrollTo(0, y); } };

function open() {
  btn.classList.add("on");
  const got = PG.achState(), shiny = PG.shinyCount();
  pan = document.createElement("div"); pan.className = "dev-pan";
  pan.innerHTML = `
    <h3>${TT("作弊开关", "Cheats")}</h3>
    <div class="dev-tg${window.PG_DEV.allRight ? " on" : ""}" data-tg="allRight"><span>${TT("选择题：怎么选都对", "Quiz: every answer is right")}</span><i></i></div>
    <div class="dev-tg${window.PG_DEV.allLink ? " on" : ""}" data-tg="allLink"><span>${TT("连线：怎么连都对", "Matching: every link is right")}</span><i></i></div>
    <p>${TT("开着时答题照样计入这个开发者版的统计、掌握度和成就（和正式版无关）。", "Answers still count toward this dev build's stats, mastery and achievements (separate from the real app).")}</p>

    <h3>${TT("自动答题 / 自动连线", "Auto play")}</h3>
    <div class="dev-tg${window.PG_DEV.auto ? " on" : ""}" id="dvAuto"><span>${TT("自动做题（选择题和连线都会自己做）", "Play automatically (quiz and matching)")}</span><i></i></div>
    <div class="dev-row">${TT("速度", "Speed")}：${[["slow", "慢（看特效）", "Slow"], ["mid", "中", "Medium"], ["fast", "快", "Fast"]].map(([k, z, e]) => `<button class="ibtn${(window.PG_DEV.autoSpeed || "slow") === k ? " on" : ""}" data-asp="${k}">${TT(z, e)}</button>`).join("")}</div>
    <div class="dev-row" style="margin-top:6px">${TT("正确率", "Accuracy")}：${[100, 90, 70].map(v => `<button class="ibtn${(window.PG_DEV.autoAcc ?? 100) === v ? " on" : ""}" data-aacc="${v}">${v}%</button>`).join("")}</div>
    <p>${TT("打开后关掉这个面板，再开始一局选择题或连线就行；一局结束停在结算页。正确率调低可以看连击中断、连错的效果。", "Close this panel and start a quiz or matching game; it stops on the results page. Lower accuracy shows combo breaks and wrong links.")}</p>

    <h3>${TT("摇滚医生", "Rock Doctor")}</h3>
    <div class="dev-tg${window.PG_DEV.rhAuto ? " on" : ""}" id="dvRhAuto"><span>${TT("自动打（开一局后自己按）", "Auto-play (presses for you)")}</span><i></i></div>
    <div class="dev-row">${TT("按键误差", "Timing error")}：${[0, 30, 70, 120, 200].map(v => `<button class="ibtn${(window.PG_DEV.rhJitter ?? 30) === v ? " on" : ""}" data-rhj="${v}">±${v}ms</button>`).join("")}</div>
    <div class="dev-row" style="margin-top:6px">${TT("放对的比例", "Accuracy")}：${[100, 85, 60].map(v => `<button class="ibtn${(window.PG_DEV.rhAcc ?? 100) === v ? " on" : ""}" data-rha="${v}">${v}%</button>`).join("")}</div>
    <div class="dev-row" style="margin-top:6px">${TT("开局连击", "Starting combo")}：${[0, 14, 22, 30].map(v => `<button class="ibtn${(window.PG_DEV.rhCombo ?? 0) === v ? " on" : ""}" data-rhc="${v}">${v}</button>`).join("")}</div>
    <p>${TT("开局连击设成 14 / 22 / 30，再放对两下就能看到「燃起来了 / 全场沸腾 / 摇滚之神」。", "Set a starting combo of 14 / 22 / 30 to see each stage-heat level after two more hits.")}</p>
    <p>${TT("开发者版里每次判定会显示时间差（+12ms = 晚了 12 毫秒）。±50 ms 内算完美，±100 ms 内算不错，±300 ms 内算偏了。", "The dev build shows the timing error on each judgement (+12ms = 12 ms late). Within ±50 ms is Perfect, ±100 ms Good, ±300 ms Off-time.")}</p>

    <h3>${TT("音效试听（新版 / 旧版对比）", "Sound check (new vs old)")}</h3>
    <p>${TT("答题音效（新 / 改之前）：", "Answer sounds (new / before):")}</p>
    <div class="dev-row">${[["aClick", "按钮", "click"], ["aPick", "多选勾选", "pick"], ["aRight", "答对", "right1"], ["aWrong", "答错", "wrong"]].map(([k, n, o]) => `<button class="ibtn" data-snd="${k}">${n}·新</button><button class="ibtn dev-old" data-old="${o}">旧</button>`).join("")}</div>
    <div class="dev-row" style="margin-top:6px"><button class="ibtn" data-snd="aUncheck">${TT("多选取消", "Uncheck")}</button><button class="ibtn" data-snd="aRank">${TT("排序 1→6", "Rank 1→6")}</button><button class="ibtn" data-snd="aRightLadder">${TT("连对 1→10 的答对声", "Right ×1→10")}</button><button class="ibtn" data-snd="aDunno">${TT("记不清", "Not sure")}</button><button class="ibtn" data-snd="aVary">${TT("答对 ×5（听随机变化）", "Right ×5 (variation)")}</button></div>
    <div class="dev-row" style="margin-top:6px"><button class="ibtn" data-snd="aClimb">${TT("连对 1→30（无尽上行）", "Right ×1→30 (endless climb)")}</button><button class="ibtn" data-snd="aClimbBreak">${TT("连对 1→8，错一题，再爬", "1→8, miss, climb again")}</button></div>
    <p style="margin-top:8px">${TT("按钮音效（点一下试听并选用，正式版会用你选的这个）：", "Button sound (tap to hear and choose):")}</p>
    <div class="dev-row">${CLICK_STYLES.map(k => `<button class="ibtn${(window.PG_DEV.clickStyle || "bubble") === k ? " on" : ""}" data-click="${k}">${{ bubble: TT("泡泡", "Bubble"), drop: TT("水滴", "Drop"), soft: TT("轻触", "Soft"), ding: TT("小叮", "Ding") }[k]}</button>`).join("")}<button class="ibtn" data-snd="aClickRun">${TT("连点 6 下", "Tap ×6")}</button></div>
    <p style="margin-top:8px">${TT("连击 / 升档等特效音效：", "Combo / tier effect sounds:")}</p>
    <div class="dev-row">${[["right", "答对"], ["combo", "连击"], ["tier", "升档"], ["shatter", "中断"], ["ach", "成就"], ["win", "结算"]].map(([k, n]) => `<button class="ibtn" data-snd="${k}">${n}·新</button><button class="ibtn dev-old" data-old="${k}">旧</button>`).join("")}</div>
    <div class="dev-row" style="margin-top:6px"><button class="ibtn" data-snd="ladder">${TT("连击音阶 1→7", "Combo ladder")}</button><button class="ibtn" data-snd="link">${TT("连线音阶", "Link ladder")}</button><button class="ibtn" data-snd="linkWrong">${TT("连错", "Wrong link")}</button><button class="ibtn" data-snd="roundClear">${TT("清盘和弦", "Round chord")}</button><button class="ibtn" data-snd="reveal">${TT("开卡", "Reveal")}</button><button class="ibtn" data-snd="tierAll">${TT("升档 1→6", "Tiers 1→6")}</button></div>

    <h3>${TT("特效强度", "Effect intensity")} <small>${["不要特效", "低", "中", "高"][cfg.fx ?? 2]}</small></h3>
    <div class="dev-row">${[0, 1, 2, 3].map(v => `<button class="ibtn${(cfg.fx ?? 2) === v ? " on" : ""}" data-fx="${v}">${["关", "低", "中", "高"][v]}</button>`).join("")}<button class="ibtn${cfg.shake === 0 ? "" : " on"}" id="dvShakeSw">${TT("屏幕震动：", "Shake: ")}${cfg.shake === 0 ? "关" : "开"}</button><button class="ibtn${cfg.ach === 0 ? "" : " on"}" id="dvAchSw">${TT("成就系统：", "Achievements: ")}${cfg.ach === 0 ? "关" : "开"}</button></div>

    <h3>${TT("连击档位", "Combo tiers")}</h3>
    <p>${TT("答题中点一下，下一次答对 / 连对就正好升到这一档。", "During a game, the next correct answer reaches this tier.")}</p>
    <div class="dev-row">${QUIZ_TIERS.map(t => `<button class="ibtn" data-qc="${t[0]}">${TT("选择", "Quiz")} ${t[0]}</button>`).join("")}</div>
    <div class="dev-row" style="margin-top:6px">${MATCH_TIERS.map(t => `<button class="ibtn" data-mc="${t[0]}">${TT("连线", "Match")} ${t[0]}</button>`).join("")}</div>

    <h3>${TT("特效预览", "Effect preview")}</h3>
    <div class="dev-row">${QUIZ_TIERS.map((t, i) => `<button class="ibtn" data-pq="${i}">${TT(t[1], t[2])}</button>`).join("")}</div>
    <div class="dev-row" style="margin-top:6px"><button class="ibtn" data-pv="break">${TT("连击中断", "Combo break")}</button><button class="ibtn" data-pv="r3">${TT("完美清盘 3 星", "Perfect 3★")}</button><button class="ibtn" data-pv="r2">${TT("2 星", "2★")}</button><button class="ibtn" data-pv="r1">${TT("1 星", "1★")}</button><button class="ibtn" data-pv="toast">${TT("成就提示", "Achievement toast")}</button><button class="ibtn" data-pv="rain">${TT("满屏礼花", "Confetti")}</button><button class="ibtn" data-pv="perfect">${TT("全对大结局", "Perfect finale")}</button></div>
    <div class="dev-row" style="margin-top:6px"><button class="ibtn" data-rv="1">${TT("开卡：银闪", "Reveal: silver")}</button><button class="ibtn" data-rv="2">${TT("开卡：金闪", "Reveal: gold")}</button><button class="ibtn" data-rv="3">${TT("开卡：幻彩闪", "Reveal: iridescent")}</button></div>

    <h3>${TT("成就", "Achievements")} <small class="dev-cnt">${PG.ACH.filter(a => got[a[0]]).length}/${PG.ACH.length}</small></h3>
    <p>${TT("逐个点“解锁”会弹出提示；“全部解锁”不弹提示，免得一下刷屏。", "Unlocking one shows its toast; Unlock all is silent so nothing floods the screen.")}</p>
    <div class="dev-row"><button class="ibtn" id="dvAchAll">${TT("全部解锁（不弹提示）", "Unlock all (silent)")}</button><button class="ibtn" id="dvAchNone">${TT("全部撤销", "Lock all")}</button><button class="ibtn" id="dvAchPage">${TT("打开成就页", "Open page")}</button></div>
    <div class="dev-list">${PG.ACH.map(a => `<div class="dev-ach${got[a[0]] ? " got" : ""}"><b>${a[2]}</b><span>${esc(TT(a[3], a[4]))} <small>${TIER_N[a[1] - 1]}</small></span>${got[a[0]] ? `<button class="ibtn" data-lock="${a[0]}">${TT("撤销", "Lock")}</button>` : `<button class="ibtn" data-unlock="${a[0]}">${TT("解锁", "Unlock")}</button>`}</div>`).join("")}</div>

    <h3>${TT("闪卡", "Shiny cards")} <small>${shiny}/${G.length}</small></h3>
    <div class="dev-row"><button class="ibtn" data-tier="1">${TT("前 6 组 → 银闪", "First 6 → silver")}</button><button class="ibtn" data-tier="2">${TT("前 6 组 → 金闪", "First 6 → gold")}</button><button class="ibtn" data-tier="3">${TT("前 6 组 → 幻彩闪", "First 6 → iridescent")}</button><button class="ibtn" data-tier="mix">${TT("银金幻彩各一些", "Mixed tiers")}</button></div>
    <div class="dev-row" style="margin-top:6px"><button class="ibtn" data-sh="5">${TT("点亮前 5 组", "First 5")}</button><button class="ibtn" data-sh="20">${TT("点亮前 20 组", "First 20")}</button><button class="ibtn" data-sh="all">${TT("全部点亮", "All")}</button><button class="ibtn" data-sh="half">${TT("一半练过但没亮", "Half practised, not shiny")}</button><button class="ibtn" data-sh="none">${TT("全部清掉", "Clear")}</button></div>
    <div class="dev-row" style="margin-top:6px">${P.chapters.map(ch => `<button class="ibtn" data-shch="${esc(ch[0])}">${TT("点亮", "Light")} ${esc(ch[0])}</button>`).join("")}</div>

    <h3>${TT("闪卡褪色", "Card fading")} <small>${G.filter(g => PG.fadeOf(g) === 1).length} ${TT("张变淡", "dull")} · ${G.filter(g => PG.fadeOf(g) === 2).length} ${TT("张待擦亮", "tarnished")}</small></h3>
    <p>${TT("把已点亮的闪卡改成“很久没练”：变淡是 7 天以上，待擦亮是 14 天以上。没有闪卡时先点上面的“前 6 组 → 银闪 / 金闪”。", "Make shiny cards look long-idle: dull after 7+ days, tarnished after 14+. Light some cards above first if you have none.")}</p>
    <div class="dev-row"><button class="ibtn" data-fade="8">${TT("全部变淡（8 天没练）", "All dull (8 days)")}</button><button class="ibtn" data-fade="15">${TT("全部待擦亮（15 天没练）", "All tarnished (15 days)")}</button><button class="ibtn" data-fade="mix">${TT("混合：光亮 / 变淡 / 待擦亮", "Mixed")}</button><button class="ibtn" data-fade="0">${TT("全部恢复光亮", "All bright")}</button></div>
    <div class="dev-row" style="margin-top:6px"><button class="ibtn" id="dvPolish">${TT("模拟把褪色的练一遍（播放“重新擦亮”）", "Simulate practising them (polish reveal)")}</button><button class="ibtn" id="dvFadeCol">${TT("打开闪卡页", "Open card page")}</button></div>

    <h3>${TT("打卡天数", "Streak")}</h3>
    <div class="dev-row">${[0, 2, 3, 6, 7, 29, 30].map(n => `<button class="ibtn" data-days="${n}">${n} ${TT("天", "d")}</button>`).join("")}</div>
    <p>${TT("设好后回首页或结束一局，会按新天数检查成就。", "Achievements re-check on the home page or after a game.")}</p>

    <h3>${TT("数据", "Data")}</h3>
    <div class="dev-row"><button class="ibtn" id="dvStats">${TT("答题数 +1000、最高连击 49", "+1000 answers, best combo 49")}</button><button class="ibtn" id="dvWipe">${TT("清空开发者数据（不影响正式版）", "Wipe dev data (real app untouched)")}</button></div>
    <p class="dev-msg" id="dvMsg"></p>`;
  document.body.appendChild(pan);
  const msg = t => { const m = pan.querySelector("#dvMsg"); if (m) m.textContent = t; };
  const reopen = () => { const sc = pan.scrollTop; close(); open(); pan.scrollTop = sc; };
  pan.querySelector("#dvAuto").onclick = () => { window.PG_DEV.auto = !window.PG_DEV.auto; saveDev(); SFX.click(); autoBadge(); if (window.PG_DEV.auto) autoT = setTimeout(autoStep, 600); else clearTimeout(autoT); reopen(); };
  pan.querySelectorAll("[data-asp]").forEach(b => b.onclick = () => { window.PG_DEV.autoSpeed = b.dataset.asp; saveDev(); SFX.click(); reopen(); });
  pan.querySelectorAll("[data-aacc]").forEach(b => b.onclick = () => { window.PG_DEV.autoAcc = +b.dataset.aacc; saveDev(); SFX.click(); reopen(); });
pan.querySelector("#dvRhAuto").onclick = () => { window.PG_DEV.rhAuto = !window.PG_DEV.rhAuto; saveDev(); SFX.click(); reopen(); };
  pan.querySelectorAll("[data-rhj]").forEach(b => b.onclick = () => { window.PG_DEV.rhJitter = +b.dataset.rhj; saveDev(); SFX.click(); reopen(); });
  pan.querySelectorAll("[data-rhc]").forEach(b => b.onclick = () => { window.PG_DEV.rhCombo = +b.dataset.rhc; saveDev(); SFX.click(); reopen(); });
  pan.querySelectorAll("[data-rha]").forEach(b => b.onclick = () => { window.PG_DEV.rhAcc = +b.dataset.rha; saveDev(); SFX.click(); reopen(); });
  pan.querySelectorAll("[data-tg]").forEach(el => el.onclick = () => { const k = el.dataset.tg; window.PG_DEV[k] = !window.PG_DEV[k]; saveDev(); el.classList.toggle("on", window.PG_DEV[k]); SFX.click(); });
  const TL = { 1: { a: 12, c: 11 }, 2: { a: 32, c: 31 }, 3: { a: 60, c: 60 } };
  pan.querySelectorAll("[data-snd]").forEach(b => b.onclick = () => { const k = b.dataset.snd;
    PG.pressAt = 0; if (k === "aClick") SFX.click(); else if (k === "aPick") SFX.pick(true); else if (k === "aUncheck") SFX.pick(false); else if (k === "aRight") SFX.right(1); else if (k === "aWrong") SFX.wrong(); else if (k === "aDunno") SFX.dunno();
    else if (k === "aClimb") Array.from({ length: 30 }, (_, i) => i + 1).forEach((n, i) => setTimeout(() => { SFX.right(n); if (n >= 3) SFX.combo(n); }, i * 420));
    else if (k === "aClimbBreak") [1, 2, 3, 4, 5, 6, 7, 8, -1, 1, 2, 3, 4, 5].forEach((n, i) => setTimeout(() => { if (n < 0) SFX.wrong(); else { SFX.right(n); if (n >= 3) SFX.combo(n); } }, i * 460));
    else if (k === "aClickRun") [0, 1, 2, 3, 4, 5].forEach(i => setTimeout(() => { PG.pressAt = 0; SFX.click(); }, i * 160));
    else if (k === "aRank") [1, 2, 3, 4, 5, 6].forEach((n, i) => setTimeout(() => SFX.rank(n), i * 260));
    else if (k === "aRightLadder") [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach((n, i) => setTimeout(() => SFX.right(n), i * 520));
    else if (k === "aVary") [0, 1, 2, 3, 4].forEach(i => setTimeout(() => SFX.right(1), i * 600));
    else if (k === "ladder") [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((n, i) => setTimeout(() => SFX.combo(n + 2), i * 260));
    else if (k === "link") Array.from({ length: 20 }, (_, i) => i + 1).forEach((n, i) => setTimeout(() => SFX.link(n), i * 300));
    else if (k === "tierAll") [0, 1, 2, 3, 4, 5].forEach((n, i) => setTimeout(() => SFX.tier(n), i * 900));
    else if (k === "combo") SFX.combo(5); else if (k === "tier") SFX.tier(2); else if (k === "roundClear") SFX.roundClear(3); else SFX[k](); });
  pan.querySelectorAll("[data-click]").forEach(b => b.onclick = () => { window.PG_DEV.clickStyle = b.dataset.click; saveDev(); SFX.clickAs(b.dataset.click); pan.querySelectorAll("[data-click]").forEach(x => x.classList.toggle("on", x === b)); });
  pan.querySelectorAll("[data-old]").forEach(b => b.onclick = () => playOld(b.dataset.old));
  pan.querySelectorAll("[data-fx]").forEach(b => b.onclick = () => { cfg.fx = +b.dataset.fx; save(); SFX.click(); reopen(); });
  pan.querySelector("#dvShakeSw").onclick = () => { cfg.shake = cfg.shake === 0 ? 1 : 0; save(); SFX.click(); reopen(); };
  pan.querySelector("#dvAchSw").onclick = () => { cfg.ach = cfg.ach === 0 ? 1 : 0; save(); SFX.click(); reopen(); refreshPage(); };
  pan.querySelectorAll("[data-rv]").forEach(b => b.onclick = () => { const g = G[Math.floor(Math.random() * Math.min(G.length, 53))], t = +b.dataset.rv; mastery[g.id] = { ...TL[t], t: Date.now() }; save();
    const seen = LS.get("shinySeen", {}) || {}; delete seen[g.id]; LS.set("shinySeen", seen); close(); PG.revealCards(); });
  pan.querySelectorAll("[data-fade]").forEach(b => b.onclick = () => { const v = b.dataset.fade, D = 864e5, sh = G.filter(g => PG.shinyTier(g));
    if (!sh.length) return msg(TT("还没有闪卡，先点上面的“前 6 组 → 银闪 / 金闪”", "No shiny cards yet — light some first"));
    sh.forEach((g, i) => { const days = v === "mix" ? [0, 8, 15][i % 3] : +v; mastery[g.id] = { ...mastery[g.id], t: Date.now() - days * D }; });
    save(); PG.fadeSync(); SFX.pick(); reopen(); refreshPage(); msg(TT(`已改 ${sh.length} 张闪卡`, `Changed ${sh.length} cards`)); });
  pan.querySelector("#dvPolish").onclick = () => { const fad = G.filter(g => PG.fadeOf(g));
    if (!fad.length) return msg(TT("现在没有褪色的闪卡，先点上面的“全部待擦亮”", "No faded cards — make some tarnished first"));
    const seen = LS.get("shinySeen", {}) || {}; fad.forEach(g => { seen[g.id] = Math.max(seen[g.id] || 0, PG.shinyTier(g)); }); LS.set("shinySeen", seen);   // 当成早就亮相过的卡，只播“重新擦亮”
    const was = Object.fromEntries(fad.map(g => [g.id, PG.fadeOf(g)])); fad.forEach(g => { mastery[g.id] = { ...mastery[g.id], t: Date.now() }; }); save(); close(); refreshPage(); setTimeout(() => PG.revealCards(was), 500); };   // 等换页清特效那一下过去再亮相   // 等换页清特效那一下过去再亮相
  pan.querySelector("#dvFadeCol").onclick = () => { close(); PG.achPage("col"); };
  pan.querySelectorAll("[data-tier]").forEach(b => b.onclick = () => { const v = b.dataset.tier;
    G.slice(0, v === "mix" ? 12 : 6).forEach((g, i) => { mastery[g.id] = { ...TL[v === "mix" ? 1 + (i % 3) : +v], t: Date.now() }; }); save(); SFX.pick(); reopen(); refreshPage(); });
  pan.querySelectorAll("[data-qc]").forEach(b => b.onclick = () => { if (!PG.Q) return msg(TT("先开始一局选择题", "Start a quiz first")); PG.Q.combo = +b.dataset.qc - 1; PG.Q.maxCombo = Math.max(PG.Q.maxCombo, PG.Q.combo); const c = document.querySelector("#combo"); if (c) c.textContent = "×" + PG.Q.combo; msg(TT(`下一题答对就是 ${b.dataset.qc} 连击`, `Next correct answer = ${b.dataset.qc} combo`)); });
  pan.querySelectorAll("[data-mc]").forEach(b => b.onclick = () => { if (!PG.M) return msg(TT("先开始一局连线", "Start a matching game first")); PG.M.combo = +b.dataset.mc - 1; msg(TT(`下一次连对就是连对 ${b.dataset.mc} 次`, `Next correct link = ${b.dataset.mc} in a row`)); });
  pan.querySelectorAll("[data-pq]").forEach(b => b.onclick = () => { quizCombo(QUIZ_TIERS[+b.dataset.pq][0], null); setTimeout(() => document.querySelectorAll(".cb-glow").forEach(x => x.remove()), 1600); });
  pan.querySelectorAll("[data-pv]").forEach(b => b.onclick = () => {
    const v = b.dataset.pv;
    if (v === "break") quizBreak(12); else if (v === "toast") PG.toastAch(PG.ACH[Math.floor(Math.random() * PG.ACH.length)]);
    else if (v === "rain") { SFX.win(); PG.FX.rain(90); } else if (v === "perfect") quizPerfect(20); else matchRoundClear(null, v === "r3" ? 0 : v === "r2" ? 1 : 4, 12);
  });
  const setAch = (o, toast) => { LS.set("ach", o); if (toast) PG.toastAch(toast); reopen(); refreshPage(); };
  pan.querySelectorAll("[data-unlock]").forEach(b => b.onclick = () => { const a = PG.ACH.find(x => x[0] === b.dataset.unlock), o = PG.achState(); o[a[0]] = Date.now(); setAch(o, a); });
  pan.querySelectorAll("[data-lock]").forEach(b => b.onclick = () => { const o = PG.achState(); delete o[b.dataset.lock]; SFX.click(); setAch(o); });
  pan.querySelector("#dvAchAll").onclick = () => { const o = PG.achState(); PG.ACH.forEach(a => { if (!o[a[0]]) o[a[0]] = Date.now(); }); SFX.ach(); setAch(o); msg(TT("已全部解锁", "All unlocked")); };
  pan.querySelector("#dvAchNone").onclick = () => { SFX.click(); setAch({}); };
  pan.querySelector("#dvAchPage").onclick = () => { close(); PG.achPage(); };
  const light = gs => { gs.forEach(g => { mastery[g.id] = { a: 20, c: 19, t: Date.now() }; }); save(); };
  pan.querySelectorAll("[data-sh]").forEach(b => b.onclick = () => {
    const v = b.dataset.sh;
    if (v === "none") G.forEach(g => { delete mastery[g.id]; });
    else if (v === "half") G.forEach((g, i) => { if (i % 2) mastery[g.id] = { a: 12, c: 7, t: Date.now() }; else delete mastery[g.id]; });
    else light(v === "all" ? G : G.slice(0, +v));
    save(); SFX.pick(); reopen(); refreshPage();
  });
  pan.querySelectorAll("[data-shch]").forEach(b => b.onclick = () => { light(G.filter(g => g.ch === b.dataset.shch)); SFX.pick(); reopen(); refreshPage(); });
  pan.querySelectorAll("[data-days]").forEach(b => b.onclick = () => { LS.set("days", lastDays(+b.dataset.days).sort()); SFX.click(); msg(TT(`已设为连续 ${b.dataset.days} 天`, `Streak set to ${b.dataset.days}`)); refreshPage(); });
  pan.querySelector("#dvStats").onclick = () => { PG.stats.answered += 1000; PG.stats.correct += 900; PG.stats.bestCombo = Math.max(PG.stats.bestCombo, 49); save(); SFX.click(); msg(TT("已加上，回首页或结束一局会检查成就", "Done — achievements re-check on home / after a game")); refreshPage(); };
  let armed = false;
  pan.querySelector("#dvWipe").onclick = e => { if (!armed) { armed = true; e.target.textContent = TT("再点一次确认清空", "Tap again to wipe"); return; } localStorage.clear(); location.reload(); };
}
