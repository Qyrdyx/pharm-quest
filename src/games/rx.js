/* 药理闯关 · 处方书写：按俄罗斯通行的写法练习拉丁文处方
 * - 入口页：两种练法 + 写法速查（结构、缩写、规则、各剂型示例）；
 * - 填空开处方：看任务，把词块点进 / 拖进处方的空格（词块里混着常见错误写法），检查后看错在哪；
 * - 找错：给一张有一处错误的处方，点出错的那一行，看为什么错。
 * 每轮 8 张，不进错题本和熟练度，只记每种练法的最高分。 */
import { PG, reg } from "../core/registry.js";
import { $, TT, esc, shuffle } from "../core/utils.js";
import { save, stats } from "../core/state.js";
import { RX, RX_FORM, RX_ABBR } from "../data/rx.js";
import { show } from "../ui/screen.js";
import { SFX } from "../music/sfx.js";

reg({ RX: () => RX, RX_N: () => RX.length, rxLines: () => rxLines });
Object.assign(PG, { rxHub, startRx });   // 页面跳转函数：core/nav.js 会包一层，记录返回路径

const ROUND = 8;
/* 用法、患者信息这些“给患者看的”部分：现在用英文；以后做俄语版时改成 true 就全部换成俄语（数据里俄语已经写好） */
const RU = false;
const sigOf = d => RU ? d.sig : d.sigS, sigBadOf = d => RU ? d.sigBad : d.sigBadEn, doseOf = d => RU || !d.doseEn ? d.dose : d.doseEn;
const VAGUE = RU ? "Внутреннее." : "For internal use.";
const zhNum = s => String(s).replace(",", ".");

/* ---------- 一张处方的正确写法：返回每一行 ---------- */
export function rxLines(d) {
  const f = RX_FORM[d.form];
  if (d.form === "tab" || d.form === "caps") return [`Rp.: ${f.ab} ${d.lat} ${doseOf(d)}`, `D. t. d. N. ${d.n}`, `S. ${sigOf(d)}`];
  if (d.form === "amp") return [`Rp.: Sol. ${d.lat} ${d.conc} – ${d.vol}`, `D. t. d. N. ${d.n} in amp.`, `S. ${sigOf(d)}`];
  return [`Rp.: ${f.ab} ${d.lat} ${d.conc} – ${d.vol}`, `D. S. ${sigOf(d)}`];
}
/* 任务描述 */
function task(d) {
  const f = RX_FORM[d.form];
  if (d.form === "tab" || d.form === "caps") return TT(`开${d.zh}${f.zh === "片" ? "片" : "胶囊"}，每${f.zh === "片" ? "片" : "粒"} ${d.g}，共 ${d.n} ${f.zh === "片" ? "片" : "粒"}；${d.sigZh}`, `Prescribe ${d.en.toLowerCase()} ${f.en}, ${d.unit ? d.gEn : d.g.replace(/（.*）/, "")} each, ${d.n} in total; ${d.sigEn}`);
  if (d.form === "amp") return TT(`开 ${zhNum(d.conc)} ${d.zh}注射液，每支 ${d.vol}，共 ${d.n} 支（安瓿）；${d.sigZh}`, `Prescribe ${zhNum(d.conc)} ${d.en.toLowerCase()} solution, ${d.vol} ampoules, ${d.n} in total; ${d.sigEn}`);
  const amt = d.form === "ung" ? zhNum(d.vol).replace(/\.0$/, "") + " g" : d.vol;
  return TT(`开 ${zhNum(d.conc)} ${d.zh}${d.form === "ung" ? "软膏" : "溶液"} ${amt}；${d.sigZh}`, `Prescribe ${zhNum(d.conc)} ${d.en.toLowerCase()} ${f.en}, ${amt}; ${d.sigEn}`);
}

/* ---------- 每一行的常见错误写法（做干扰项 / 找错题），每个都带“为什么错” ---------- */
const WHY = {
  nom: () => TT("药名要用第二格（属格）：处方里写“取……的”，所以是 -i / -is 结尾", "The drug name must be in the genitive case (“take … of”), so it ends in -i / -is"),
  lower: () => TT("拉丁药名首字母要大写", "Latin drug names start with a capital letter"),
  dot: () => TT("小数用逗号：0,5，不写 0.5", "Use a decimal comma: 0,5, not 0.5"),
  mg: () => TT("固体药以克为单位，直接写数字（0,5 = 0.5 g），不写 mg", "Solid doses are written in grams as a bare number (0,5 = 0.5 g), not in mg"),
  unit: () => TT("按单位计量的药写单位（IU；俄语处方写 ЕД），不写 mg", "Drugs dosed in units are written in units (IU; ЕД in Russian), not mg"),
  form: () => TT("剂型缩写和任务不符", "The dosage-form abbreviation doesn't match the task"),
  novol: () => TT("溶液要写浓度和总量：2% – 2 ml", "A solution needs both strength and amount: 2% – 2 ml"),
  ml: () => TT("软膏按克计：5,0，不用 ml", "Ointments are measured in grams (5,0), not ml"),
  num: () => TT("数量和任务不符", "The quantity doesn't match the task"),
  cont: () => TT("包装写错了：注射液写 in amp.，片剂、胶囊不写 in amp.", "Wrong container: injections take “in amp.”, tablets and capsules don't"),
  ds: () => TT("分剂量的药（片、粒、安瓿）要写 D. t. d. N. …；D. S. 只用于瓶装溶液、软膏这类不分剂量的", "Dosed forms (tablets, capsules, ampoules) need D. t. d. N. …; D. S. is for undivided forms like bottled solutions and ointments"),
  dtd: () => TT("瓶装溶液、软膏不分剂量，直接写 D. S.，不写 D. t. d.", "Bottled solutions and ointments aren't divided into doses — write D. S., not D. t. d."),
  vague: () => TT("用法不能只写“内服”“已知”这种笼统说明（俄语处方里的 Внутреннее、Известно），要写清每次量、次数和用法", "Directions can't be a vague “for internal use” or “as known” (Внутреннее / Известно in Russian) — state the dose, frequency and route"),
  lat: () => TT("用法（S.）用患者看得懂的语言写（这里用英文，俄罗斯处方用俄语），不用拉丁语", "Directions (S.) are written in the patient's language (English here, Russian on Russian forms), not Latin"),
  sig: () => TT("用法和任务要求不一致", "The directions don't match the task"),
};
const low = s => s[0].toLowerCase() + s.slice(1);
function bads(d, i) {
  const f = RX_FORM[d.form], L = rxLines(d), out = [], add = (text, why) => { if (text !== L[i] && !out.some(x => x.text === text)) out.push({ text, why }); };
  const dosed = d.form === "tab" || d.form === "caps";
  if (i === 0) {
    add(L[0].replace(d.lat, d.latN), "nom");
    add(L[0].replace(d.lat, low(d.lat)), "lower");
    if (dosed && !d.unit) { add(L[0].replace(doseOf(d), d.dose.replace(",", ".")), "dot"); add(L[0].replace(doseOf(d), Math.round(parseFloat(d.dose.replace(",", ".")) * 1000) + " mg"), "mg"); }
    if (d.unit) add(L[0].replace(doseOf(d), "500 000 mg"), "unit");
    if (!dosed) { add(`Rp.: ${f.ab} ${d.lat} ${d.conc}`, "novol"); if (d.conc.includes(",")) add(L[0].replace(d.conc, d.conc.replace(",", ".")), "dot"); }
    if (d.form === "amp") { add(`Rp.: Sol. ${d.lat} ${d.conc}`, "novol"); if (d.conc.includes(",")) add(L[0].replace(d.conc, d.conc.replace(",", ".")), "dot"); }
    if (d.form === "ung") add(L[0].replace("– " + d.vol, "– " + parseInt(d.vol) + " ml"), "ml");
    add(L[0].replace(/^Rp\.: \S+/, "Rp.: " + { tab: "Ung.", caps: "Sol.", amp: "Tab.", sol: "Ung.", ung: "Sol." }[d.form]), "form");
  } else if (i === 1 && f.dosed) {
    add(`D. t. d. N. ${d.n === 20 ? 10 : 20}${f.cont}`, "num");
    add(d.form === "amp" ? `D. t. d. N. ${d.n} in tab.` : `D. t. d. N. ${d.n} in amp.`, "cont");
    add("D. S.", "ds");
  } else if (i === 1) {
    add(`D. t. d. N. 10. S. ${sigOf(d)}`, "dtd");
    add(`D. S. ${sigBadOf(d)}`, "sig");
    add("D. S. " + VAGUE, "vague");
  } else {
    add(`S. ${sigBadOf(d)}`, "sig");
    add("S. " + VAGUE, "vague");
    add(d.form === "amp" ? "S. Ad anaesthesiam." : `S. 1 ${d.form === "tab" ? "tab." : "caps."} ter in die.`, "lat");
  }
  return out;
}

/* ---------- 入口页 ---------- */
const best = k => (stats.best && stats.best["rx_" + k]) || 0;
function example(d) { return `<div class="rx-mini"><small>${esc(task(d))}</small><pre>${rxLines(d).map(esc).join("\n")}</pre></div>`; }
export function rxHub() {
  const ex = ["tab", "caps", "amp", "sol", "ung"].map(k => RX.find(d => d.form === k));
  show(`<div class="sel-head"><div><div class="eyebrow">${TT("俄罗斯处方 · 拉丁文书写", "Russian prescriptions · Latin")}</div><h2 style="font-size:28px">${TT("处方书写", "Prescription writing")}</h2>
      <p style="color:var(--mute);margin:6px 0 0;max-width:66ch">${TT("按俄罗斯通行的写法练习开处方：药名用拉丁文第二格，剂量用逗号小数，分剂量写 D. t. d. N.，用法写给患者看（这里先用英文）。每轮 8 张，口腔科常用药。", "Practise writing prescriptions the Russian way: drug names in the Latin genitive, decimal commas, D. t. d. N. for dosed forms, directions for the patient (in English for now). 8 prescriptions a round, common dental drugs.")}</p></div></div>
    <div class="rx-modes">
      <button class="mode" data-rx="build"><span class="tag">${TT("每轮 8 张", "8 per round")} · ${TT("最高", "Best")} ${best("build")}</span><h3>${TT("填空开处方", "Fill in the prescription")}</h3><p>${TT("看任务，把词块点进或拖进处方的空格里，拼出一张完整的处方。", "Read the task, then tap or drag tiles into the gaps to complete the prescription.")}</p></button>
      <button class="mode" data-rx="find"><span class="tag">${TT("每轮 8 张", "8 per round")} · ${TT("最高", "Best")} ${best("find")}</span><h3>${TT("处方找错", "Spot the mistake")}</h3><p>${TT("每张处方都藏着一处错误，点出错的那一行，看为什么错。", "Each prescription hides one mistake — tap the wrong line and see why.")}</p></button>
    </div>
    <div class="rx-ref">
      <h3>${TT("写法速查", "Quick reference")}</h3>
      <div class="rx-ref-grid">
        <div class="rx-card"><b>${TT("一张处方的结构", "Structure")}</b><ol>
          <li>${TT("表头：日期、患者姓名和年龄、医生姓名（普通处方用 107-1/у 表，俄罗斯卫生部 2021 年第 1094н 号令）", "Header: date, patient's name and age, doctor's name (regular prescriptions use form 107-1/у, Russian MoH order No. 1094н of 2021)")}</li>
          <li><code>Rp.:</code> ${TT("处方正文：剂型 + 药名（拉丁文第二格）+ 剂量", "Body: dosage form + drug name (Latin genitive) + dose")}</li>
          <li><code>D. t. d. N. …</code> / <code>D. S.</code> ${TT("给药指示：分剂量写数量，瓶装溶液、软膏直接 D. S.", "Dispensing: quantity for dosed forms, D. S. for bottles and ointments")}</li>
          <li><code>S.</code> ${TT("用法（写给患者看，这里用英文，俄罗斯处方用俄语）：每次多少、每天几次、什么时候、什么途径", "Directions (for the patient — English here, Russian on Russian forms): how much, how often, when, which route")}</li>
          <li>${TT("医生签名、盖章；处方上不能涂改", "Doctor's signature and seal; no corrections on the form")}</li></ol></div>
        <div class="rx-card"><b>${TT("必须记住的规则", "Rules to remember")}</b><ul>
          <li>${TT("药名用拉丁文第二格、首字母大写：Amoxicillinum → Amoxicillini", "Drug names in the Latin genitive, capitalised: Amoxicillinum → Amoxicillini")}</li>
          <li>${TT("固体以克计、小数用逗号：0,5（= 0.5 g）、1,0；按单位计的写 IU（俄语处方写 ЕД）", "Solids in grams with a decimal comma: 0,5 (= 0.5 g), 1,0; unit-dosed drugs in IU (ЕД in Russian)")}</li>
          <li>${TT("液体以 ml 计；软膏以克计：5,0", "Liquids in ml; ointments in grams: 5,0")}</li>
          <li>${TT("溶液写浓度和总量：Sol. … 2% – 2 ml", "Solutions need strength and amount: Sol. … 2% – 2 ml")}</li>
          <li>${TT("用法要写清楚，不能只写“内服”“已知”这种笼统说明", "Directions must be specific — never just “for internal use” or “as known”")}</li></ul></div>
      </div>
      <div class="rx-card"><b>${TT("常用缩写", "Abbreviations")}</b><table class="rx-abbr">${RX_ABBR.map(a => `<tr><td><code>${esc(a[0])}</code></td><td><i>${esc(a[1])}</i></td><td>${TT(a[2], a[3])}</td></tr>`).join("")}</table></div>
      <div class="rx-card"><b>${TT("各剂型示例", "Examples by form")}</b><div class="rx-exs">${ex.map(example).join("")}</div></div>
      <p class="rx-note">${TT("示例剂量只用来练习书写格式，临床用量和现行处方法规以讲义、说明书为准。", "Doses are for practising the format only — follow your lecture notes, drug labels and current regulations for real use.")}</p>
    </div>`,
  () => { document.querySelectorAll("[data-rx]").forEach(b => b.onclick = () => { SFX.pick(); PG.startRx(b.dataset.rx); }); });
}

/* ---------- 一轮 ---------- */
let R = null;
export function startRx(mode = "build") {
  R = { mode, list: shuffle(RX.slice()).slice(0, ROUND), k: 0, ok: 0, tot: 0 };
  next();
}
const paper = (d, lines, cls = "") => `<div class="rx-paper ${cls}"><div class="rx-ph"><span>${RU ? "Рецепт · ф. 107-1/у" : "Prescription · form 107-1/у"}</span><span>${new Date().toLocaleDateString("ru-RU")}</span></div>
  <div class="rx-pt">${RU ? "Пациент: <i>Иванов И. И., 35 лет</i>" : "Patient: <i>Ivanov I. I., 35 y.o.</i>"}</div><div class="rx-lines" id="rxLines">${lines}</div><div class="rx-sign">${RU ? "Подпись и печать врача" : "Doctor's signature & seal"}</div></div>`;
function head() {
  return `<div class="rx-top"><button class="ibtn" id="rxQuit">${TT("结束本轮", "End round")}</button><span>${R.mode === "build" ? TT("填空开处方", "Fill in") : TT("处方找错", "Spot the mistake")} · ${R.k + 1} / ${R.list.length}</span><b>${TT("得分", "Score")} ${R.ok}</b></div>`;
}
function next() {
  if (R.k >= R.list.length) return finish();
  const d = R.list[R.k];
  if (R.mode === "build") build(d); else find(d);
}
function bindQuit() { $("#rxQuit").onclick = () => { SFX.click(); finish(); }; }
function nextBtn() {
  const b = document.createElement("button"); b.className = "btn"; b.id = "rxNext"; b.textContent = R.k + 1 >= R.list.length ? TT("看结果", "See results") : TT("下一张", "Next");
  b.onclick = () => { SFX.click(); R.k++; next(); }; $("#rxAct").appendChild(b); b.focus();
}

/* 填空开处方：处方上留出空格，下面一排词块（正确的 + 常见错误写法），点词块填进当前空格，也可以直接拖到某个空格；
 * 点已经填好的空格把词块取回。全部填完点“检查”：对的变绿，错的显示正确写法和错在哪。 */
function slots(d) {
  const f = RX_FORM[d.form], B = a => ({ a });
  if (d.form === "tab" || d.form === "caps") return [["Rp.:", B(f.ab), B(d.lat), B(doseOf(d))], [B("D. t. d."), B(`N. ${d.n}`)], ["S.", B(sigOf(d))]];
  if (d.form === "amp") return [["Rp.:", B("Sol."), B(d.lat), B(`${d.conc} – ${d.vol}`)], [B("D. t. d."), B(`N. ${d.n}`), B("in amp.")], ["S.", B(sigOf(d))]];
  return [["Rp.:", B(f.ab), B(d.lat), B(`${d.conc} – ${d.vol}`)], [B("D. S."), B(sigOf(d))]];
}
function decoys(d) {
  const out = [], add = (t, why) => out.push({ t, why }), dosed = d.form === "tab" || d.form === "caps";
  add({ tab: "Ung.", caps: "Sol.", amp: "Tab.", sol: "Ung.", ung: "Sol." }[d.form], "form");
  add(d.latN, "nom");
  if (dosed && !d.unit) add(d.dose.replace(",", "."), "dot");
  if (d.unit) add("500 000 mg", "unit");
  if (d.form === "ung") add(`${d.conc} – ${parseInt(d.vol)} ml`, "ml");
  else if (!dosed) add(d.conc.includes(",") ? `${d.conc.replace(",", ".")} – ${d.vol}` : d.conc, d.conc.includes(",") ? "dot" : "novol");
  if (dosed || d.form === "amp") { add(`N. ${d.n === 20 ? 10 : 20}`, "num"); add(d.form === "amp" ? "in tab." : "in amp.", "cont"); add("D. S.", "ds"); }
  else add("D. t. d.", "dtd");
  add(sigBadOf(d), "sig");
  if (Math.random() < 0.5) add(VAGUE, "vague");
  return out;
}
function build(d) {
  const lines = slots(d), blanks = [];
  lines.forEach(l => l.forEach(p => { if (typeof p !== "string") { p.i = blanks.length; blanks.push(p); } }));
  const toks = shuffle([...blanks.map(b => ({ t: b.a })), ...decoys(d).filter((x, j, A) => !blanks.some(b => b.a === x.t) && A.findIndex(y => y.t === x.t) === j)]);
  toks.forEach((t, k) => { t.k = k; });
  const fill = new Array(blanks.length).fill(-1); let active = 0, checked = false;
  const paperHtml = lines.map(l => `<div class="rx-ln rx-fl">${l.map(p => typeof p === "string" ? `<span class="rx-fix">${esc(p)}</span>` : `<button class="rx-blank" data-b="${p.i}"></button>`).join(" ")}</div>`).join("");
  show(`<div class="rx-play">${head()}<div class="rx-task">${esc(task(d))}</div>${paper(d, paperHtml)}
    <p class="rx-q">${TT("点下面的词块填进空格，也可以直接拖到某个空格里；点已经填好的空格可以取回。", "Tap a tile to fill the highlighted gap, or drag it onto any gap; tap a filled gap to take the tile back.")}</p>
    <div class="rx-bank" id="rxBank">${toks.map(t => `<button class="rx-tok" data-t="${t.k}">${esc(t.t)}</button>`).join("")}</div>
    <div class="rx-why" id="rxWhy"></div><div class="rx-act" id="rxAct"><button class="btn ghost" id="rxClear">${TT("清空", "Clear")}</button><button class="btn" id="rxCheck" disabled>${TT("检查", "Check")}</button></div></div>`, () => {
    bindQuit();
    const bEl = i => document.querySelector(`.rx-blank[data-b="${i}"]`), tEl = k => document.querySelector(`.rx-tok[data-t="${k}"]`);
    const render = () => {
      blanks.forEach((b, i) => { const e = bEl(i), k = fill[i]; if (!checked) e.textContent = k < 0 ? "" : toks[k].t; e.classList.toggle("on", !checked && i === active); e.classList.toggle("full", k >= 0); });
      toks.forEach(t => tEl(t.k).classList.toggle("used", fill.includes(t.k)));
      const ck = $("#rxCheck"); if (ck) ck.disabled = checked || fill.includes(-1);
    };
    const nextEmpty = from => { for (let j = 0; j < blanks.length; j++) { const i = (from + j) % blanks.length; if (fill[i] < 0) return i; } return from; };
    const put = (i, k) => { if (checked) return; const old = fill.indexOf(k); if (old >= 0) fill[old] = -1; fill[i] = k; active = nextEmpty(i); SFX.click(); render(); };
    blanks.forEach((b, i) => bEl(i).onclick = () => { if (checked) return; if (fill[i] >= 0) fill[i] = -1; active = i; SFX.click(); render(); });
    /* 词块：轻点 = 填进当前空格；按住拖动 = 放到松手处的空格 */
    toks.forEach(t => {
      const e = tEl(t.k);
      e.addEventListener("pointerdown", ev => {
        if (checked || e.classList.contains("used")) return; ev.preventDefault();
        const x0 = ev.clientX, y0 = ev.clientY; let ghost = null;
        const move = m => {
          if (!ghost && Math.hypot(m.clientX - x0, m.clientY - y0) > 6) { ghost = e.cloneNode(true); ghost.classList.add("rx-ghost"); document.body.appendChild(ghost); }
          if (ghost) { ghost.style.left = m.clientX + "px"; ghost.style.top = m.clientY + "px"; document.querySelectorAll(".rx-blank.drop").forEach(x => x.classList.remove("drop")); const over = document.elementFromPoint(m.clientX, m.clientY)?.closest(".rx-blank"); if (over) over.classList.add("drop"); }
        };
        const up = u => {
          removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
          document.querySelectorAll(".rx-blank.drop").forEach(x => x.classList.remove("drop"));
          if (ghost) { ghost.remove(); const over = document.elementFromPoint(u.clientX, u.clientY)?.closest(".rx-blank"); if (over) put(+over.dataset.b, t.k); }
          else put(active, t.k);
        };
        addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
      });
    });
    $("#rxClear").onclick = () => { if (checked) return; fill.fill(-1); active = 0; SFX.click(); render(); };
    $("#rxCheck").onclick = () => {
      checked = true; let ok = 0; const why = [];
      blanks.forEach((b, i) => {
        const t = toks[fill[i]], e = bEl(i), good = t.t === b.a;
        if (good) { ok++; e.classList.add("ok"); return; }
        e.classList.add("bad"); e.innerHTML = `<s>${esc(t.t)}</s> ${esc(b.a)}`;
        why.push(`<li><b>${esc(t.t)}</b> → <b>${esc(b.a)}</b>：${esc(t.why ? WHY[t.why]() : TT("这个词块放错位置了", "This tile belongs in a different gap"))}</li>`);
      });
      R.ok += ok; R.tot += blanks.length; ok === blanks.length ? SFX.pick() : SFX.click();
      $("#rxWhy").innerHTML = ok === blanks.length ? `<b>${TT("全对！", "All correct!")}</b>` : `<b>${TT(`对了 ${ok} / ${blanks.length} 个空，错在哪：`, `${ok} / ${blanks.length} gaps right. Why:`)}</b><ul>${why.join("")}</ul>`;
      document.querySelector(".rx-top b").textContent = TT("得分 ", "Score ") + R.ok;
      $("#rxClear").remove(); $("#rxCheck").remove(); render(); nextBtn();
    };
    render();
  });
}

/* 找错 */
function find(d) {
  const L = rxLines(d), wi = Math.floor(Math.random() * L.length), bad = shuffle(bads(d, wi))[0], shown = L.map((x, k) => k === wi ? bad.text : x);
  show(`<div class="rx-play">${head()}<div class="rx-task">${esc(task(d))}</div>
    ${paper(d, shown.map((x, k) => `<button class="rx-ln rx-pick" data-k="${k}">${esc(x)}</button>`).join(""))}
    <p class="rx-q">${TT("这张处方有一处错误，点出错的那一行。", "There's one mistake — tap the wrong line.")}</p><p class="rx-why" id="rxWhy"></p><div class="rx-act" id="rxAct"></div></div>`, () => {
    bindQuit();
    document.querySelectorAll(".rx-pick").forEach(b => b.onclick = () => {
      const k = +b.dataset.k, ok = k === wi; R.tot++; if (ok) { R.ok++; SFX.pick(); } else SFX.click();
      document.querySelectorAll(".rx-pick").forEach(x => { x.disabled = true; });
      if (!ok) b.classList.add("miss");
      const w = document.querySelector(`.rx-pick[data-k="${wi}"]`); w.classList.add("bad"); w.insertAdjacentHTML("afterend", `<div class="rx-ln fix">${esc(L[wi])}</div>`);
      $("#rxWhy").innerHTML = `<b>${ok ? TT("找对了！", "Correct! ") : TT("错的是标红的那一行。", "The wrong line is the red one. ")}</b>${esc(WHY[bad.why]())}`;
      nextBtn();
    });
  });
}

function finish() {
  const r = R, pct = r.tot ? Math.round(r.ok / r.tot * 100) : 0, key = "rx_" + r.mode;
  stats.best = stats.best || {}; const prev = stats.best[key] || 0, isBest = r.ok > prev; if (isBest) stats.best[key] = r.ok; save();
  show(`<div class="rx-end"><div class="eyebrow">${TT("处方书写", "Prescription writing")} · ${r.mode === "build" ? TT("填空开处方", "Fill in") : TT("处方找错", "Spot the mistake")}</div>
    <h2>${r.ok} / ${r.tot}</h2><p>${TT(`正确率 ${pct}%`, `${pct}% correct`)}${isBest ? TT(" · 新纪录！", " · New best!") : ""}</p>
    <div class="io-row"><button class="btn" id="rxAgain">${TT("再来一轮", "Another round")}</button><button class="btn ghost" id="rxBack">${TT("回到处方书写", "Back")}</button></div></div>`, () => {
    $("#rxAgain").onclick = () => { SFX.click(); PG.startRx(r.mode); };
    $("#rxBack").onclick = () => { SFX.click(); PG.rxHub(); };
  });
}
