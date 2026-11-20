/* 药理闯关 · 玩法：病例诊室 */
import { PG, reg } from "../core/registry.js";
import { $, clamp, esc, pick, reduceMotion, shuffle } from "../core/utils.js";
import { DM, GM, zhAlt } from "../data/index.js";
import { save, sel, stats, trackQ } from "../core/state.js";
import { SFX } from "../music/sfx.js";
import { FX } from "../ui/fx.js";
import { frameSlot } from "../ui/power.js";
import { ECG } from "../ui/ecg.js";
import { L, mascotHTML, mood } from "../ui/mascot.js";
import { markWrong } from "../records/wrong.js";
import { reportBtn, reportQ } from "../records/reports.js";
import { main, show } from "../ui/screen.js";

reg({ CASES: () => CASES, NORM: () => NORM, PT_STATE: () => PT_STATE, setPatient: () => setPatient, patientSVG: () => patientSVG, caseMonitor: () => caseMonitor, K: () => K, vStatus: () => vStatus, tween: () => tween, renderVitals: () => renderVitals, renderLabs: () => renderLabs, renderMeds: () => renderMeds, renderStab: () => renderStab, patientSay: () => patientSay, applyFx: () => applyFx, renderDots: () => renderDots, caseStep: () => caseStep, startErTimer: () => startErTimer, renderRx: () => renderRx, rxSubmit: () => rxSubmit, caseAnswer: () => caseAnswer, finishStep: () => finishStep, endCase: () => endCase, rxAnswer: () => rxAnswer, caseSteps: () => caseSteps }, { K: v => { K = v; } });
Object.assign(PG, { caseMenu, startCase });   // 页面跳转函数：core/nav.js 会包一层，记录返回路径

/* ================= 病例诊室 ================= */
export const CASES = window.CASES || [];
CASES.forEach(c => { c.gids = [...new Set(caseSteps(c).flatMap(s => [s.d, ...(s.rx ? s.rx.ans : [])]).map(n => DM.get(n)?.g.id).filter(Boolean))].sort((a, b) => a - b); });
export const NORM = { hr: [60, 100], sys: [90, 139], dia: [60, 89], spo2: [95, 100], temp: [36, 37.3], rr: [12, 20], pain: [0, 3] };
/* Q 版病人：状态 → 眼睛 / 嘴巴 / 附加特征 / 动作 */
export const PT_STATE = {
  ok: { e: "n", m: "smile", f: [], a: "bob" },
  happy: { e: "c", m: "smile", f: ["spark"], a: "hop" },
  pain: { e: "w", m: "wavy", f: ["handc"], a: "shake" },
  swollen: { f: ["swell"] },
  fever: { e: "w", m: "frown", f: ["fever", "thermo", "sweat"], a: "bob" },
  allergy: { e: "w", m: "o", f: ["rash", "swell"], a: "tremble" },
  faint: { e: "x", m: "o", f: ["dizzy"], a: "faint" },
  seize: { e: "x", m: "wavy", f: ["sweat"], a: "seize" },
  chest: { e: "w", m: "wavy", f: ["handh", "sweat"], a: "shake" },
  hypo: { e: "w", m: "wavy", f: ["sweat", "dizzy", "shiver"], a: "tremble" },
  anxious: { e: "w", m: "frown", f: ["sweat", "shiver"], a: "tremble" },
  wheeze: { e: "w", m: "o", f: ["handh", "sweat"], a: "breathe" }
};
(() => {
  let css = "";
  ["n", "c", "x", "w"].forEach(k => css += `.patient.e-${k} .pe-${k}{display:inline}`);
  ["smile", "frown", "wavy", "o"].forEach(k => css += `.patient.m-${k} .pm-${k}{display:inline}`);
  ["swell", "rash", "fever", "thermo", "sweat", "handc", "handh", "dizzy", "spark", "shiver"].forEach(k => css += `.patient.f-${k} .pf-${k}{display:inline}`);
  const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
})();
export function setPatient(el, st) {
  if (!el) return;
  let e = "n", m = "smile", a = "bob"; const f = new Set();
  String(st || "ok").split(/\s+/).forEach(k => { const d = PT_STATE[k]; if (!d) return; if (d.e) e = d.e; if (d.m) m = d.m; if (d.a) a = d.a; (d.f || []).forEach(x => f.add(x)); });
  el.setAttribute("class", `patient e-${e} m-${m} a-${a} ${[...f].map(x => "f-" + x).join(" ")}`);
}
export function patientSVG(kind, room = true) {
  const ol = "#0a1a20", sk = "#f6d2b3";
  const hair = { man: "#2b2321", woman: "#4a2f27", pregnant: "#5a3a2c", kid: "#3a2a22", grandpa: "#d9dcdc", grandma: "#d9dcdc" }[kind] || "#2b2321";
  const shirt = { man: "#86cbff", woman: "#ef6a52", pregnant: "#f4bf4f", kid: "#ff9fb2", grandpa: "#9fb7a5", grandma: "#c7a2d6" }[kind] || "#86cbff";
  const glasses = `<g fill="none" stroke="${ol}" stroke-width="2"><circle cx="64" cy="84" r="9"/><circle cx="92" cy="84" r="9"/><path d="M73 84h10"/></g>`;
  let back = "", front = "";
  if (kind === "woman" || kind === "pregnant") back = `<path d="M34 80 Q30 30 78 30 Q126 30 122 80 L126 128 Q100 136 78 132 Q56 136 30 128z" fill="${hair}"/>`;
  if (kind === "grandma") back = `<circle cx="78" cy="34" r="14" fill="${hair}" stroke="${ol}" stroke-width="2.5"/>`;
  if (kind === "kid") back = `<circle cx="34" cy="60" r="12" fill="${hair}"/><circle cx="122" cy="60" r="12" fill="${hair}"/><circle cx="42" cy="50" r="5" fill="#ff6b81"/><circle cx="114" cy="50" r="5" fill="#ff6b81"/>`;
  if (kind === "man") front = `<path d="M38 74 Q38 34 78 36 Q118 34 118 74 Q108 52 84 56 Q70 48 56 58 Q44 60 38 74z" fill="${hair}"/>`;
  if (kind === "woman" || kind === "pregnant" || kind === "kid") front = `<path d="M38 78 Q38 36 78 36 Q118 36 118 78 Q112 58 96 54 Q84 66 62 56 Q46 60 38 78z" fill="${hair}"/>`;
  if (kind === "grandpa") front = `<path d="M38 84 Q36 60 48 52 Q46 70 52 82z" fill="${hair}"/><path d="M118 84 Q120 60 108 52 Q110 70 104 82z" fill="${hair}"/><path d="M60 46 q8 -4 16 0" stroke="#e8c4a6" stroke-width="2" fill="none"/>` + glasses;
  if (kind === "grandma") front = `<path d="M38 80 Q38 40 78 40 Q118 40 118 80 Q110 58 78 58 Q46 58 38 80z" fill="${hair}"/>` + glasses;
  const belly = kind === "pregnant" ? `<ellipse cx="82" cy="160" rx="25" ry="18" fill="${shirt}" stroke="${ol}" stroke-width="3"/><path d="M74 158 q6 -6 12 0 q-6 8 -12 0z" fill="#ff8f8f" opacity=".7"/>` : "";
  const scale = kind === "kid" ? `transform="translate(14 22) scale(.86)"` : "";
  const person = `<g ${scale}><g class="pt-body">
    ${back}
    <path d="M42 182 Q42 124 78 122 Q114 124 114 182z" fill="${shirt}" stroke="${ol}" stroke-width="3"/>
    <path d="M60 126 h36 l-5 22 h-26z" fill="#bfe6ff" stroke="${ol}" stroke-width="2"/><path d="M60 127 Q78 116 96 127" stroke="#93b3b4" stroke-width="1.6" fill="none" stroke-dasharray="2 2"/>
    ${belly}
    <circle cx="38" cy="84" r="7" fill="${sk}" stroke="${ol}" stroke-width="2.5"/><circle cx="118" cy="84" r="7" fill="${sk}" stroke="${ol}" stroke-width="2.5"/>
    <circle cx="78" cy="80" r="41" fill="${sk}" stroke="${ol}" stroke-width="3"/>
    <ellipse class="pf pf-fever" cx="78" cy="62" rx="27" ry="12" fill="#ff6b81" opacity=".35"/>
    ${front}
    <ellipse cx="56" cy="98" rx="6.5" ry="3.8" fill="#ff8f8f" opacity=".55"/><ellipse cx="100" cy="98" rx="6.5" ry="3.8" fill="#ff8f8f" opacity=".55"/>
    <g class="pe pe-n" fill="${ol}"><circle cx="64" cy="86" r="4.6"/><circle cx="92" cy="86" r="4.6"/><circle cx="65.5" cy="84.5" r="1.5" fill="#fff"/><circle cx="93.5" cy="84.5" r="1.5" fill="#fff"/></g>
    <g class="pe pe-c" fill="none" stroke="${ol}" stroke-width="3" stroke-linecap="round"><path d="M59 88 q5 -7 10 0"/><path d="M87 88 q5 -7 10 0"/></g>
    <g class="pe pe-x" stroke="${ol}" stroke-width="3" stroke-linecap="round"><path d="M60 82 l8 8 M68 82 l-8 8 M88 82 l8 8 M96 82 l-8 8"/></g>
    <g class="pe pe-w"><circle cx="64" cy="88" r="4" fill="${ol}"/><circle cx="92" cy="88" r="4" fill="${ol}"/><path d="M56 79 l11 -4 M100 79 l-11 -4" stroke="${ol}" stroke-width="2.6" stroke-linecap="round"/></g>
    <path class="pm pm-smile" d="M70 102 q8 8 16 0" fill="none" stroke="${ol}" stroke-width="3" stroke-linecap="round"/>
    <path class="pm pm-frown" d="M70 108 q8 -7 16 0" fill="none" stroke="${ol}" stroke-width="3" stroke-linecap="round"/>
    <path class="pm pm-wavy" d="M66 105 q3 -4 6 0 q3 4 6 0 q3 -4 6 0 q3 4 6 0" fill="none" stroke="${ol}" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse class="pm pm-o" cx="78" cy="106" rx="4.5" ry="6" fill="${ol}"/>
    <g class="pf pf-swell"><ellipse cx="108" cy="100" rx="17" ry="15" fill="#f9c3a5" stroke="${ol}" stroke-width="3"/><ellipse cx="111" cy="100" rx="8" ry="6" fill="#ff7f7f" opacity=".55"/></g>
    <g class="pf pf-rash" fill="#e8455a" opacity=".8"><circle cx="58" cy="70" r="2.4"/><circle cx="96" cy="66" r="2.6"/><circle cx="68" cy="112" r="2"/><circle cx="102" cy="112" r="2.2"/><circle cx="50" cy="104" r="2"/><circle cx="72" cy="140" r="2.6"/><circle cx="92" cy="152" r="2.4"/><circle cx="56" cy="160" r="2.2"/><circle cx="102" cy="138" r="2"/><circle cx="84" cy="64" r="1.8"/></g>
    <g class="pf pf-thermo"><path d="M86 106 l24 8" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="111" cy="114" r="3.6" fill="#ff6b81"/></g>
    <g class="pf pf-sweat" fill="#86cbff"><path class="drop" d="M42 62 q-4 7 0 9 q4 -2 0 -9z"/><path class="drop2" d="M116 58 q-4 7 0 9 q4 -2 0 -9z"/></g>
    <g class="pf pf-handc"><path d="M104 156 Q126 134 118 114" stroke="${shirt}" stroke-width="11" fill="none" stroke-linecap="round"/><circle cx="117" cy="110" r="9.5" fill="${sk}" stroke="${ol}" stroke-width="2.5"/></g>
    <g class="pf pf-handh"><path d="M48 160 Q56 144 74 142" stroke="${shirt}" stroke-width="11" fill="none" stroke-linecap="round"/><circle cx="78" cy="142" r="9.5" fill="${sk}" stroke="${ol}" stroke-width="2.5"/></g>
    <g class="pf pf-shiver" stroke="#93b3b4" stroke-width="2" stroke-linecap="round"><path d="M30 118 l-7 -3 M30 128 l-8 0 M126 118 l7 -3 M126 128 l8 0"/></g>
  </g>
  <g class="pf pf-dizzy"><g class="dz" fill="#f4bf4f"><path d="M58 22 l2.5 5 5.5 .8 -4 3.8 1 5.4 -5 -2.6 -5 2.6 1 -5.4 -4 -3.8 5.5 -.8z"/><path d="M98 24 l2 4 4.4 .6 -3.2 3 .8 4.4 -4 -2 -4 2 .8 -4.4 -3.2 -3 4.4 -.6z"/><circle cx="78" cy="16" r="3"/></g></g>
  <g class="pf pf-spark" fill="#f4bf4f"><path class="spk" d="M22 50 h10 M27 45 v10" stroke="#f4bf4f" stroke-width="3" stroke-linecap="round"/><path class="spk" d="M132 34 h10 M137 29 v10" stroke="#f4bf4f" stroke-width="3" stroke-linecap="round" style="animation-delay:.4s"/></g></g>`;
  if (!room) return `<svg viewBox="16 18 126 170" class="patient" aria-hidden="true">${person}</svg>`;
  return `<svg viewBox="0 0 220 210" class="room" aria-hidden="true">
    <path class="lampbeam" d="M150 40 L84 150 L196 150 L170 40z" fill="#f4bf4f" opacity=".07"/>
    <path d="M220 6 h-44 l-14 24" stroke="#5f8389" stroke-width="5" fill="none" stroke-linecap="round"/>
    <ellipse cx="160" cy="36" rx="20" ry="9" fill="#93b3b4" stroke="${ol}" stroke-width="2.5"/><ellipse cx="160" cy="40" rx="12" ry="4" fill="#fff7d6"/>
    <rect x="62" y="30" width="56" height="26" rx="13" fill="#2d6f7a" stroke="${ol}" stroke-width="2.5"/>
    <rect x="50" y="62" width="80" height="112" rx="24" fill="#2d6f7a" stroke="${ol}" stroke-width="2.5"/>
    <rect x="36" y="166" width="136" height="22" rx="11" fill="#2a6370" stroke="${ol}" stroke-width="2.5"/>
    <rect x="96" y="188" width="16" height="12" fill="#5f8389"/><rect x="70" y="198" width="68" height="7" rx="3.5" fill="#5f8389"/>
    <g transform="translate(166 120)"><rect x="-4" y="0" width="8" height="66" fill="#5f8389"/><rect x="-22" y="-10" width="44" height="12" rx="4" fill="#c9d6d4" stroke="${ol}" stroke-width="2"/><path d="M-14 -10 v-6 M0 -10 v-8 M12 -10 v-5" stroke="#93b3b4" stroke-width="2.4" stroke-linecap="round"/></g>
    <g class="patient" transform="translate(12 6)">${person}</g></svg>`;
}
/* 监护仪：ECG + 血氧容积波 */
export function caseMonitor(cv) {
  const cx = cv.getContext("2d"); const dpr = Math.min(1.5, devicePixelRatio || 1);
  cv.style.backgroundImage = "linear-gradient(90deg,rgba(95,214,168,.07) 1px,transparent 1px)"; cv.style.backgroundSize = "12px 100%";
  const r = cv.getBoundingClientRect(); const w = Math.max(120, r.width), h = r.height || 74;
  cv.width = w * dpr; cv.height = h * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  let ph = 0, last = performance.now(), raf = 0, slot = -1; const b1 = [], b2 = [];
  const g = (p, c, wd, ht) => ht * Math.exp(-((p - c) ** 2) / (2 * wd * wd));
  function loop(t) {
    if (!cv.isConnected || !K) return;
    if (document.hidden || frameSlot(t) === slot) { raf = requestAnimationFrame(loop); return; }
    slot = frameSlot(t);
    const steps = Math.max(1, Math.round(Math.min(120, t - last) / 16.7)); last = t;
    const v = K.v, bad = v.spo2 < 92 || v.sys < 85;
    for (let i = 0; i < steps; i++) {
      ph = (ph + v.hr / 60 / 60) % 1;
      b1.push(K.st.includes("seize") ? ECG.wave(ph) + (Math.random() - .5) * .6 : ECG.wave(ph));
      const pp = (ph + 0.82) % 1; b2.push((g(pp, .3, .08, 1) + g(pp, .5, .06, .35)) * clamp((v.spo2 - 80) / 18, .25, 1));
    }
    const max = Math.floor(w / 2); while (b1.length > max) { b1.shift(); b2.shift(); }
    cx.clearRect(0, 0, w, h);
    const draw = (b, col, y0, amp) => { cx.strokeStyle = col; cx.beginPath(); b.forEach((val, i) => { const y = y0 - val * amp; i ? cx.lineTo(i * 2, y) : cx.moveTo(i * 2, y); }); cx.globalAlpha = 0.25; cx.lineWidth = 5; cx.stroke(); cx.globalAlpha = 1; cx.lineWidth = 2; cx.stroke(); };
    draw(b1, bad ? "#ff6b81" : "#5fd6a8", h * 0.42, h * 0.32);
    draw(b2, "#86cbff", h * 0.95, h * 0.3);
    cx.fillStyle = "rgba(147,179,180,.6)"; cx.font = "10px JetBrains Mono, monospace"; cx.fillText("II", 4, 12); cx.fillText("PLETH", 4, h * 0.62);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}
export let K = null;
export function caseMenu(onlySel = true) {
  const list = CASES.filter(c => !onlySel || c.gids.some(id => sel.has(id)));
  show(`<div class="sel-head"><div><div class="eyebrow">Clinic · 病例分析</div><h2 style="font-size:28px">病例诊室</h2>
      <p style="color:var(--mute);margin:6px 0 0;max-width:60ch">接诊病人，看监护仪和化验单，一步步选药。选对了病情好转，选错了指标会恶化；稳定度归零就要转诊。</p></div>
    <div class="sel-tools"><button class="ibtn ${onlySel ? "on" : ""}" id="cf">${onlySel ? "只看考试范围相关" : "显示全部病例"}</button><button class="btn" id="crand" ${list.length ? "" : "disabled"}>随机接诊</button></div></div>
    ${list.length ? `<div class="case-list">${list.map(c => `<button class="ccard" data-c="${c.id}"><span class="ava">${patientSVG(c.kind, false)}</span>
      <span style="min-width:0"><span class="who">${esc(c.name)} · ${c.sex} · ${c.age} 岁 · ${c.steps.length} 步</span><h3>${esc(c.title)}</h3><div class="dx">${esc(c.diag)}</div>
      <span class="badges">${c.er ? `<span class="bd er">急救限时</span>` : ""}${c.steps.some(s => s.rx) ? `<span class="bd rx">开处方</span>` : ""}${c.steps.some(s => s.bad?.then) ? `<span class="bd br">分支剧情</span>` : ""}</span>
      <span class="gs">${c.gids.map(id => `<span>#${id} ${esc(GM.get(id).n)}</span>`).join("")}</span></span></button>`).join("")}</div>`
      : `<p class="empty">当前考试范围里没有对应的病例。点“只看考试范围相关”切换为显示全部。</p>`}`,
  () => {
    main.querySelectorAll(".ccard").forEach(b => { setPatient(b.querySelector(".patient"), CASES.find(c => c.id === +b.dataset.c).st); b.onclick = () => { SFX.pick(); PG.startCase(CASES.find(c => c.id === +b.dataset.c)); }; });
    $("#cf").onclick = () => { SFX.click(); PG.caseMenu(!onlySel); };
    $("#crand").onclick = () => { SFX.pick(); PG.startCase(pick(list)); };
  });
}
export function startCase(c) {
  K = { c, steps: c.steps.slice(), i: 0, v: { ...c.v }, labs: c.labs.map(r => r.slice()), st: c.st, allergy: c.allergy, stab: 60, score: 0, correct: 0, answered: 0, wrongs: [], res: [], norm: { ...NORM, ...(c.norm || {}) }, locked: false, tid: 0 };
  const upper = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28], lower = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
  const tooth = n => `<span class="t ${c.teeth.includes(n) ? "hit" : ""}">${n}</span>`;
  show(`<div class="case-head"><div style="min-width:0"><div class="eyebrow">病例 ${c.id} · ${esc(c.name)} · ${c.sex} · ${c.age} 岁</div><h2>${esc(c.title)}</h2><div class="dx">诊断：${esc(c.diag)}</div></div>
      <div class="stab"><div class="k"><span>病情稳定度</span><span id="stabN">60</span></div><div class="bar"><i id="stabB"></i></div>
        <div class="stepdots" id="dots" style="margin-top:8px"></div></div></div>
    <div class="case-grid">
      <div style="min-width:0"><div class="scene">${patientSVG(c.kind)}<div class="pbubble" id="pb" hidden></div></div>
        <div class="chart-row"><span class="mchip">现病史 <b>${esc(c.hx)}</b></span></div>
        <div class="chart-row" id="medrow"></div>
        <div class="teeth"><div class="tl"><span>牙位图 FDI · 右</span><span>左</span></div><div class="row">${upper.map(tooth).join("")}</div><div class="row lo">${lower.map(tooth).join("")}</div>
          ${c.teeth.length ? "" : `<div class="tl" style="margin-top:6px"><span>本例无特定患牙（黏膜 / 全身情况）</span></div>`}</div></div>
      <div style="min-width:0"><div class="monitor2"><canvas id="cmon" aria-label="监护仪波形"></canvas>
        <div class="vgrid">
          <div class="vt" data-k="hr"><div class="lb"><span>HR 心率</span><span class="heart">♥</span></div><div class="val"><span data-n="hr"></span><small>bpm</small></div></div>
          <div class="vt" data-k="bp"><div class="lb"><span>NIBP 血压</span></div><div class="val"><span data-n="sys"></span>/<span data-n="dia"></span><small>mmHg</small></div></div>
          <div class="vt" data-k="spo2"><div class="lb"><span>SpO₂ 血氧</span></div><div class="val" style="color:var(--sky)"><span data-n="spo2"></span><small>%</small></div></div>
          <div class="vt" data-k="temp"><div class="lb"><span>TEMP 体温</span></div><div class="val"><span data-n="temp"></span><small>°C</small></div>
            <svg class="thermo" viewBox="0 0 10 38"><rect x="3" y="1" width="4" height="30" rx="2" fill="#173b42"/><rect id="thFill" x="3" y="16" width="4" height="15" rx="2" fill="#ff6b81"/><circle cx="5" cy="33" r="4" fill="#ff6b81"/></svg></div>
          <div class="vt" data-k="rr"><div class="lb"><span>RR 呼吸</span></div><div class="val"><span data-n="rr"></span><small>次/分</small></div></div>
          <div class="vt" data-k="pain"><div class="lb"><span>VAS 疼痛</span></div><div class="val"><span data-n="pain"></span><small>/10</small></div><div class="painbar"><i id="painI"></i></div></div>
        </div></div>
        <div class="labs"><h4><span>化验单 LAB REPORT</span><span>参考范围</span></h4><table id="labT"></table></div></div>
    </div>
    <div class="stage" style="margin-top:16px">${mascotHTML("think")}
      <div><div class="erbar" id="erbar" hidden><span>抢救倒计时</span><b id="ern"></b><div class="eb"><i id="eri"></i></div></div>
      <div class="qcard"><span class="qtype">病例分析 · 第 <span id="cstep">1</span>/<span id="ctot"></span> 步</span><span class="qno" id="cbr"></span><div class="prompt" id="cprompt"></div></div>
      <div class="opts" id="copts"></div><div id="crx"></div><div id="cexplain"></div>
      <div class="q-actions"><button class="ibtn" id="cquit">放弃本病例</button><span id="crep"></span><button class="btn" id="cnext" hidden>下一步 ↵</button></div></div></div>`,
  () => {
    const stop = caseMonitor($("#cmon"));
    const onKey = e => {
      if (!K) return;
      if (/^[1-4]$/.test(e.key) && !K.locked) { const b = $("#copts")?.children[+e.key - 1]; b && b.click(); }
      else if ((e.key === "Enter" || e.key === " ") && K.locked && !$("#cnext").hidden) { e.preventDefault(); $("#cnext").click(); }
    };
    addEventListener("keydown", onKey);
    PG.cleanup = () => { stop(); removeEventListener("keydown", onKey); if (K) clearInterval(K.tid); };
    $("#cquit").onclick = () => { SFX.click(); clearInterval(K.tid); K = null; PG.caseMenu(); };
    $("#cnext").onclick = () => { SFX.click(); K.i++; if (K.i >= K.steps.length || K.stab <= 0) endCase(); else caseStep(); };
    renderVitals(true); renderLabs([]); renderMeds(); renderStab(); setPatient($(".scene .patient"), K.st);
    patientSay(c.say, 3200);
    caseStep();
  });
}
export function vStatus(k, val) {
  const [lo, hi] = K.norm[k];
  if (val >= lo && val <= hi) return "ok";
  const span = hi - lo || 1, d = val < lo ? (lo - val) / span : (val - hi) / span;
  if (k === "spo2") return val < 90 ? "bad" : "warn";
  if (k === "pain") return val >= 7 ? "bad" : "warn";
  if (k === "temp") return val >= 39 || val < 35.5 ? "bad" : "warn";
  return d > 0.35 ? "bad" : "warn";
}
export function tween(el, to, dec) {
  const from = parseFloat(el.textContent) || to, t0 = performance.now();
  if (from === to || reduceMotion) { el.textContent = to.toFixed(dec); return; }
  const f = t => { const p = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - p, 3); el.textContent = (from + (to - from) * e).toFixed(dec); if (p < 1 && el.isConnected) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
export function renderVitals(first, quiet) {
  const v = K.v;
  v.hr = clamp(Math.round(v.hr), 25, 190); v.sys = clamp(Math.round(v.sys), 40, 230); v.dia = clamp(Math.round(v.dia), 20, 140);
  v.spo2 = clamp(Math.round(v.spo2), 70, 100); v.temp = clamp(+v.temp.toFixed(1), 34.5, 41.5); v.rr = clamp(Math.round(v.rr), 6, 44); v.pain = clamp(Math.round(v.pain), 0, 10);
  Object.keys(v).forEach(k => { const el = main.querySelector(`[data-n="${k}"]`); if (el) first ? el.textContent = k === "temp" ? v[k].toFixed(1) : v[k] : tween(el, v[k], k === "temp" ? 1 : 0); });
  const st = { hr: vStatus("hr", v.hr), bp: [vStatus("sys", v.sys), vStatus("dia", v.dia)].includes("bad") ? "bad" : [vStatus("sys", v.sys), vStatus("dia", v.dia)].includes("warn") ? "warn" : "ok",
    spo2: vStatus("spo2", v.spo2), temp: vStatus("temp", v.temp), rr: vStatus("rr", v.rr), pain: vStatus("pain", v.pain) };
  main.querySelectorAll(".vt").forEach(t => { const s = st[t.dataset.k]; t.dataset.st = s; if (!first && !quiet) { t.classList.remove("flash"); void t.offsetWidth; t.classList.add("flash"); } });
  main.querySelector(".heart").style.setProperty("--beat", (60 / v.hr).toFixed(2) + "s");
  const th = $("#thFill"), hgt = clamp((v.temp - 35) / 6, 0.05, 1) * 30; th.setAttribute("y", 31 - hgt); th.setAttribute("height", hgt);
  $("#painI").style.left = (v.pain * 10) + "%";
}
export function renderLabs(changed) {
  $("#labT").innerHTML = K.labs.length ? K.labs.map(([n, val, u, lo, hi]) => {
    let cls = "", flag = "", rng = "";
    if (typeof val === "number" && lo != null) {
      if (val > hi) { cls = "hi"; flag = "↑"; } else if (val < lo) { cls = "lo"; flag = "↓"; }
      const minV = Math.min(lo, val) - (hi - lo) * 0.4, maxV = Math.max(hi, val) + (hi - lo) * 0.4, pos = x => ((x - minV) / (maxV - minV) * 100).toFixed(1);
      rng = `<span class="rng"><b style="left:${pos(lo)}%;right:${100 - pos(hi)}%"></b><i style="left:${pos(val)}%"></i></span>`;
    } else if (/阳|异常/.test(val)) { cls = "pos"; flag = "!"; }
    return `<tr class="${changed.includes(n) ? "chg" : ""}"><td>${esc(n)}</td><td class="v ${cls}">${esc(val)}</td><td class="f">${flag}</td><td>${rng}</td><td class="r">${lo != null ? `${lo}–${hi} ${esc(u)}` : esc(u)}</td></tr>`;
  }).join("") : `<tr><td style="color:#7a6a55">抢救中，化验结果待回报</td></tr>`;
}
export function renderMeds() {
  $("#medrow").innerHTML = `<span class="mchip alg">过敏史 <b>${esc(K.allergy || "无")}</b></span>` + (K.c.meds.length ? K.c.meds.map(m => `<span class="mchip">用药 <b>${esc(m)}</b></span>`).join("") : `<span class="mchip">用药 <b>无</b></span>`);
}
export function renderStab() {
  const s = clamp(K.stab, 0, 100); $("#stabN").textContent = s;
  const b = $("#stabB"); b.style.width = s + "%"; b.style.background = s >= 60 ? "var(--mint)" : s >= 30 ? "var(--cap-amber)" : "var(--rose)";
}
export function patientSay(text, ms = 2600) {
  const b = $("#pb"); if (!b || !text) return;
  b.hidden = false; b.textContent = text; b.style.animation = "none"; void b.offsetWidth; b.style.animation = "";
  clearTimeout(b._t); b._t = setTimeout(() => { b.hidden = true; }, ms);
}
export function applyFx(fx) {
  if (!fx) return [];
  if (fx.v) Object.entries(fx.v).forEach(([k, d]) => K.v[k] += d);
  const changed = [];
  if (fx.lab) Object.entries(fx.lab).forEach(([n, val]) => { const r = K.labs.find(x => x[0] === n); if (r) { r[1] = val; changed.push(n); } });
  if (fx.st) K.st = fx.st;
  if (fx.allergy) { K.allergy = fx.allergy; renderMeds(); }
  renderVitals(false); renderLabs(changed); setPatient($(".scene .patient"), K.st);
  if (fx.say) patientSay(fx.say);
  return changed;
}
export function renderDots() {
  $("#dots").innerHTML = K.steps.map((s, i) => `<i class="${K.res[i] === true ? "ok" : K.res[i] === false ? "no" : i === K.i ? "cur" : ""}${s.branch ? " br" : ""}"></i>`).join("");
  $("#ctot").textContent = K.steps.length;
}
export function caseStep() {
  const s = K.steps[K.i]; K.locked = false;
  if (s.pre) { applyFx(s.pre); if (s.pre.v) SFX.beep(); }
  $("#cstep").textContent = K.i + 1;
  $("#cbr").textContent = s.branch ? "⚠ 分支：上一步处置引发的新情况" : "";
  $("#cprompt").innerHTML = esc(s.q);
  renderDots();
  const box = $("#copts"); box.className = "opts"; box.innerHTML = ""; $("#crx").innerHTML = "";
  if (s.rx) renderRx(s);
  else {
    // 选项格式：第一个是正确答案（字符串），其余是 [干扰项, 为什么不对]
    const items = s.o.map(x => Array.isArray(x) ? { t: x[0], why: x[1] } : { t: x, why: "" });
    K.notes = Object.fromEntries(items.map(x => [x.t, x.why]));
    const opts = shuffle(items.map(x => x.t)); K.opts = opts; K.ans = opts.indexOf(items[0].t);
    opts.forEach((t, i) => { const b = document.createElement("button"); b.className = "opt"; b.innerHTML = `<span class="key">${i + 1}</span><span class="txt">${esc(t)}</span>`; b.onclick = () => caseAnswer(i, b); PG.onPress(b, () => caseAnswer(i, b)); box.appendChild(b); });
  }
  $("#cexplain").innerHTML = ""; $("#cnext").hidden = true; $("#crep").innerHTML = "";
  const m = $(".stage .mascot"); if (m) mood(m, "think", pick(s.rx ? ["从药柜里挑药", "别忘了给药途径", "剂量也要对"] : ["先看监护仪", "注意过敏史和用药史", "想想机制再选", "化验单有提示"]), 1600);
  startErTimer(s);
}
/* 急救倒计时：拖得越久，指标越差，稳定度持续下降 */
export function startErTimer(s) {
  clearInterval(K.tid);
  const er = K.c.er, bar = $("#erbar");
  if (!er || s.er === false) { bar.hidden = true; return; }
  const T = s.sec || er.sec; let left = T, acc = 0;
  bar.hidden = false; bar.classList.remove("low"); $("#ern").textContent = T + "s"; $("#eri").style.width = "100%";
  K.tid = setInterval(() => {
    if (!K || K.locked) return clearInterval(K && K.tid);
    left -= 0.25; acc += 0.25;
    $("#eri").style.width = Math.max(0, left / T * 100) + "%";
    $("#ern").textContent = Math.ceil(Math.max(0, left)) + "s";
    if (acc >= 1) {
      acc = 0;
      Object.entries(er.decay || {}).forEach(([k, d]) => K.v[k] += d);
      K.stab -= er.stab ?? 1; renderVitals(false, true); renderStab();
      if (left <= 5) { SFX.tick(); bar.classList.add("low"); } else SFX.beep();
    }
    if (left <= 0 || K.stab <= 0) {
      clearInterval(K.tid); patientSay("……（情况越来越糟）", 1800);
      s.rx ? rxSubmit(true) : caseAnswer(-1, null);
    }
  }, 250);
}
/* 开处方：从药柜挑药放进处方笺，再选给药途径和剂量 */
export function renderRx(s) {
  const rx = s.rx; K.rx = { picked: [], route: null, dose: null };
  const pool = shuffle(rx.pool.map(n => DM.get(n)).filter(Boolean));
  const seg = (k, arr) => arr ? `<div class="rx-row"><span>${k === "route" ? "给药途径" : "剂量 / 用法"}</span><div class="seg" data-rx="${k}">${shuffle(arr.slice()).map(o => `<button data-v="${esc(o)}" aria-pressed="false">${esc(o)}</button>`).join("")}</div></div>` : "";
  $("#crx").innerHTML = `<div class="rx">
    <div class="rx-cab"><div class="rx-h">药柜 · 拖到处方笺，或点一下</div><div class="rx-pills" id="rxCab">${pool.map(d => `<button class="rxpill" draggable="true" data-no="${d.no}"><span class="a">${esc(d.cn)}</span><span class="b">${esc(d.en.replace(/\s*\(.*\)/, ""))}</span></button>`).join("")}</div></div>
    <div class="rx-pad" id="rxPad"><div class="rx-h"><b>Rp.</b> 处方笺 · ${esc(K.c.name)} ${K.c.sex} ${K.c.age} 岁</div>
      <div class="rx-list" id="rxList"></div>
      ${seg("route", rx.route)}${seg("dose", rx.dose)}
      <div class="q-actions"><button class="btn" id="rxGo">开出处方</button></div></div></div>`;
  const draw = () => {
    $("#rxList").innerHTML = K.rx.picked.length ? K.rx.picked.map(n => `<span class="rxitem">${esc(DM.get(n).cn)}<button data-rm="${n}" aria-label="移除">×</button></span>`).join("") : `<span class="rx-empty">把药拖到这里</span>`;
    $("#crx").querySelectorAll(".rxpill").forEach(b => b.classList.toggle("in", K.rx.picked.includes(+b.dataset.no)));
    $("#rxList").querySelectorAll("[data-rm]").forEach(b => b.onclick = () => toggle(+b.dataset.rm));
  };
  const toggle = n => { if (K.locked) return; const i = K.rx.picked.indexOf(n); if (i >= 0) K.rx.picked.splice(i, 1); else if (K.rx.picked.length < 3) K.rx.picked.push(n); SFX.pick(); draw(); };
  $("#crx").querySelectorAll(".rxpill").forEach(b => {
    b.onclick = () => toggle(+b.dataset.no);
    b.addEventListener("dragstart", e => { e.dataTransfer.setData("text/plain", b.dataset.no); b.classList.add("drag"); });
    b.addEventListener("dragend", () => b.classList.remove("drag"));
  });
  const pad = $("#rxPad");
  pad.addEventListener("dragover", e => { e.preventDefault(); pad.classList.add("over"); });
  pad.addEventListener("dragleave", () => pad.classList.remove("over"));
  pad.addEventListener("drop", e => { e.preventDefault(); pad.classList.remove("over"); const n = +e.dataTransfer.getData("text/plain"); if (n && !K.rx.picked.includes(n)) toggle(n); });
  $("#crx").querySelectorAll("[data-rx]").forEach(sg => sg.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || K.locked) return;
    K.rx[sg.dataset.rx] = b.dataset.v; sg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); SFX.click();
  }));
  $("#rxGo").onclick = () => rxSubmit(false);
  draw();
}
export function rxSubmit(timeout) {
  if (!K || K.locked) return;
  const s = K.steps[K.i], rx = s.rx, r = K.rx;
  if (!timeout) {
    const miss = !r.picked.length ? "先从药柜里选药" : rx.route && !r.route ? "还没选给药途径" : rx.dose && !r.dose ? "还没选剂量" : "";
    if (miss) { mood($(".stage .mascot"), "shock", miss, 1400); SFX.wrong(); return; }
  }
  const drugsOk = r.picked.length === rx.ans.length && rx.ans.every(n => r.picked.includes(n));
  const routeOk = !rx.route || r.route === rx.route[0], doseOk = !rx.dose || r.dose === rx.dose[0];
  const ok = !timeout && drugsOk && routeOk && doseOk;
  K.locked = true;
  $("#crx").querySelectorAll(".rxpill").forEach(b => { const n = +b.dataset.no; b.classList.add(rx.ans.includes(n) ? "right" : r.picked.includes(n) ? "wrong" : "dim"); });
  $("#crx").querySelectorAll("[data-rx]").forEach(sg => sg.querySelectorAll("button").forEach(x => { if (x.dataset.v === rx[sg.dataset.rx][0]) x.classList.add("rx-right"); else if (x.getAttribute("aria-pressed") === "true") x.classList.add("rx-wrong"); }));
  K.opts = [rxAnswer(rx)]; K.ans = 0; K.notes = null;
  const mine = timeout ? "超时未开出" : [r.picked.map(n => DM.get(n).cn).join(" + "), r.route, r.dose].filter(Boolean).join("，");
  const detail = ok ? "" : `<p class="m"><em>你的处方</em>${esc(mine)}${!timeout ? `（药物${drugsOk ? "✓" : "✗"}${rx.route ? " · 途径" + (routeOk ? "✓" : "✗") : ""}${rx.dose ? " · 剂量" + (doseOk ? "✓" : "✗") : ""}）` : ""}</p>`;
  finishStep(s, ok, $("#rxGo"), mine, detail);
}
export function caseAnswer(i, btn) {
  if (!K || K.locked) return; K.locked = true; clearInterval(K.tid);
  const s = K.steps[K.i], ok = i === K.ans, box = $("#copts"); box.classList.add("locked");
  [...box.children].forEach((b, k) => b.classList.add(k === K.ans ? "right" : k === i ? "wrong" : "dim"));
  finishStep(s, ok, btn || box, i >= 0 ? K.opts[i] : "超时", "");
}
export function finishStep(s, ok, btn, mine, detail) {
  clearInterval(K.tid); $("#erbar").classList.remove("low");
  K.answered++; stats.answered++; K.res[K.i] = ok;
  const d = DM.get(s.d), q = { ref: { drug: d }, options: K.opts, ans: K.ans, type: "case", prompt: `病例 ${K.c.id}「${K.c.title}」：${esc(s.q)}` };
  trackQ(q, ok);
  const m = $(".stage .mascot");
  let branched = false;
  if (ok) {
    K.correct++; stats.correct++; K.score += s.rx ? 200 : 150; K.stab = Math.min(100, K.stab + 15);
    applyFx(s.ok); if (!s.ok?.say) patientSay(pick(["好一些了…", "谢谢医生", "感觉舒服点了"]));
    SFX.right(); FX.at(btn, "pill", 18); FX.at($(".scene"), "cross", 10); mood(m, "happy", pick(L().right));
  } else {
    K.stab -= 25; markWrong(q); K.wrongs.push(q);
    const def = { v: { hr: 10, pain: 1 } };
    applyFx(s.bad && (s.bad.v || s.bad.lab || s.bad.st) ? s.bad : { ...def, ...(s.bad || {}) });
    if (!s.bad?.say) patientSay(pick(["医生…我更难受了", "好像更严重了…", "这药不对劲…"]));
    SFX.wrong(); FX.at(btn, "shard", 12); mood(m, "sad", pick(L().wrong), 2200);
    if (s.bad?.then && K.stab > 0) { K.steps.splice(K.i + 1, 0, { ...s.bad.then, branch: true }); branched = true; }
  }
  renderStab(); save(); renderDots();
  const v = `<div class="verdict ${ok ? "ok" : "no"}">${ok ? "处置正确" : (s.rx ? "正确处方：" : "正确处置：") + esc(K.opts[K.ans])}</div>`;
  const whyNot = !s.rx && K.notes ? K.opts.filter((t, k) => k !== K.ans && K.notes[t]).map(t => `<li class="${t === mine ? "picked" : ""}">✗ <b>${esc(t)}</b>：${esc(K.notes[t])}</li>`).join("") : "";
  $("#cexplain").innerHTML = `<div class="explain">${v}${detail}<p>${esc(s.why)}</p>${whyNot ? `<ul class="whynot">${whyNot}</ul>` : ""}${d ? `<span class="gchip">关联药物 #${d.no} ${esc(d.en)} ${esc(zhAlt(d))} · ${esc(d.g.n)}</span>` : ""}
    ${branched ? `<p class="branch-note">⚠ 这个处置引发了新的情况，下一步需要处理后果。</p>` : ""}</div>`;
  $("#crep").appendChild(reportBtn(() => reportQ(q, mine, "病例诊室")));
  const last = K.i + 1 >= K.steps.length || K.stab <= 0;
  const nx = $("#cnext"); nx.hidden = false; nx.textContent = K.stab <= 0 ? "病情恶化，查看结局 ↵" : last ? "完成诊疗，查看结局 ↵" : branched ? "处理新情况 ↵" : "下一步 ↵";
  nx.focus({ preventScroll: true });
}
export function endCase() {
  const R = K; if (!R) return;
  clearInterval(R.tid);
  const cured = R.stab > 0 && R.correct >= Math.ceil(R.steps.length / 2);
  if (cured) { R.st = "happy"; setPatient($(".scene .patient"), "happy"); patientSay("谢谢医生，我可以回家啦！", 1600); SFX.win(); FX.rain(40); }
  else { setPatient($(".scene .patient"), "faint"); patientSay("……", 1600); SFX.lose(); }
  K = null;
  const scr = main.firstElementChild;
  setTimeout(() => main.firstElementChild === scr && PG.pgResult({ mode: "case", title: cured ? `${R.c.name}康复离院` : `${R.c.name}病情恶化，已转上级医院`, score: R.score + (cured ? R.stab * 2 : 0),
    correct: R.correct, answered: R.answered, maxCombo: R.correct, wrongs: R.wrongs, extra: `稳定度 <b>${Math.max(0, R.stab)}</b>`, caseKind: R.c.kind, cured }), 1500);
}
/* ---------- 题库总览 ---------- */
export function rxAnswer(rx) { return [rx.ans.map(n => DM.get(n)?.cn).join(" + "), rx.route?.[0], rx.dose?.[0]].filter(Boolean).join("，"); }
export function caseSteps(c) { return c.steps.flatMap(s => [s, ...(s.bad?.then ? [s.bad.then] : [])]); }
