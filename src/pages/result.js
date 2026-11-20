/* 药理闯关 · 结算页 */
import { PG, reg } from "../core/registry.js";
import { $, TT, esc } from "../core/utils.js";
import { DM } from "../data/index.js";
import { save, stats } from "../core/state.js";
import { SFX } from "../music/sfx.js";
import { FX } from "../ui/fx.js";
import { mascotHTML, mood } from "../ui/mascot.js";
import { wrongKey } from "../records/wrong.js";
import { explainHTML } from "../engine/explain.js";
import { cleanup, main, show, showErr } from "../ui/screen.js";
import { bagProgress } from "../records/rotation.js";
import { patientSVG, setPatient } from "../games/case.js";

reg({ resultLite: () => resultLite, resultFull: () => resultFull });
Object.assign(PG, { pgResult });   // 页面跳转函数：core/nav.js 会包一层，记录返回路径

/* ---------- 结算 ---------- */
export function pgResult(r) {
  try { resultFull(r); }
  catch (e) { showErr(e, "结算页"); resultLite(r); }
  try { PG.achCheck(r); } catch (e) { console.warn("成就检查失败", e); }   // 结算后检查成就，新解锁的在右上角弹出
}
export function resultLite(r) {
  try { if (cleanup) cleanup(); } catch (e) { showErr(e, "清理"); }
  PG.cleanup = null;
  {
    main.innerHTML = `<section class="screen"><div class="result"><div class="eyebrow">本局结束</div><h2 style="font-size:30px">${esc(r.title || "本局结束")}</h2>
      <div class="score">${r.score}</div><div class="meta"><span>正确 <b>${r.correct}/${r.answered}</b></span></div>
      <div class="q-actions" style="justify-content:center"><button class="btn ghost" id="toHome2">回首页</button></div></div></section>`;
    scrollTo({ top: 0 });
    $("#toHome2").onclick = () => PG.home();
  }
}
export function resultFull(r) {
  stats.games++;
  const best = stats.best[r.mode] || 0, isBest = r.score > best && r.score > 0;
  if (isBest) stats.best[r.mode] = r.score;
  save();
  const acc = r.answered ? r.correct / r.answered : 0;
  const stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : acc >= 0.4 ? 1 : 0;
  // 轮换进度：本轮已考多少种（一整轮考完会自动从 0 开始新一轮）
  const bp = r.bag && r.bag.key ? bagProgress(r.bag.key, r.bag.pool) : null;
  const bagHTML = bp && bp.total ? `<span>${bp.done === 0 && r.answered ? TT("已考完一整轮，新一轮 ", "Full round done · new round ") : TT("本轮已考 ", "Covered this round ")}<b>${bp.done}/${bp.total}</b></span>` : "";
  const uniq = []; const seen = new Set();
  r.wrongs.forEach(q => { const k = wrongKey(q) || (q.ref.ai && "ai" + q.ref.ai.id) || Math.random(); if (!seen.has(k)) { seen.add(k); uniq.push(q); } });
  show(`<div class="result">${mascotHTML(stars >= 2 ? "cheer" : stars === 1 ? "idle" : "sad")}
    ${r.caseKind ? `<div style="width:120px">${patientSVG(r.caseKind, false)}</div>` : ""}
    <div class="eyebrow">${{ quiz: "查房问答", sort: "药柜分拣", match: "连线配对", case: "病例诊室", core: "机制·适应证·不良反应", cls: "同类药物辨析", spell: "中英默写", hot: "高频错误专练", ai: "AI 出题" }[r.mode]}</div>
    <h2 style="font-size:30px">${esc(r.title)}</h2>
    <div class="stars">${[0, 1, 2].map(i => `<span class="${i < stars ? "on" : ""}" style="animation-delay:${i * 0.18}s">★</span>`).join("")}</div>
    <div class="score">${r.score}</div>${isBest ? `<div class="newbest">新纪录！</div>` : `<div style="color:var(--faint);font-size:13px">最高 ${stats.best[r.mode] || 0}</div>`}
    <div class="meta"><span>正确 <b>${r.correct}/${r.answered}</b></span><span>正确率 <b>${Math.round(acc * 100)}%</b></span><span>最高连击 <b>${r.maxCombo}</b></span>${r.extra ? `<span>${r.extra}</span>` : ""}${bagHTML}</div>
    <div class="q-actions" style="justify-content:center"><button class="btn" id="again">再来一局</button>
      ${uniq.length ? `<button class="btn red" id="redo">专练这局错题（${uniq.length}）</button>` : ""}<button class="btn ghost" id="toBack">返回上一级</button><button class="btn ghost" id="toHome">回首页</button></div>
    <div class="tca-sign">红烧肉大王TCA · 药理闯关</div>
    ${uniq.length ? `<div class="wronglist"><h3 style="font-size:20px;margin-top:12px">这局错在哪</h3>${uniq.map(q => `<div class="explain">${explainHTML(q, false)}</div>`).join("")}</div>` : ""}
  </div>`,
  () => {
    const m = $(".result .mascot");
    const pt = $(".result .patient"); if (pt) setPatient(pt, r.cured ? "happy" : "faint");
    if (r.caseKind) $("#again").textContent = "接诊下一位";
    if (stars >= 2) { SFX.win(); FX.rain(stars === 3 ? 90 : 45); mood(m, "cheer", stars === 3 ? "满分查房！" : "表现不错！", 3000); }
    else if (stars === 1) { SFX.win(); mood(m, "happy", "继续加油", 2000); }
    else { SFX.lose(); mood(m, "sad", "去错题本复习一下", 3000); }
    $("#again").onclick = () => { SFX.click(); r.mode === "hot" ? PG.hotHub() : ["quiz", "core", "cls", "ai"].includes(r.mode) ? PG.startQuiz(r.focus, r.opts) : r.mode === "sort" ? PG.startSort() : r.mode === "case" ? PG.caseMenu() : r.mode === "spell" ? PG.startSpell(r.opts) : PG.startMatch(r.opts); };
    $("#toHome").onclick = () => { SFX.click(); PG.home(); };
    $("#toBack").onclick = () => { SFX.click(); PG.goBack(); };
    const rd = $("#redo"); if (rd) rd.onclick = () => { SFX.click();
      if (r.mode === "match") return PG.startMatch({ kind: (r.opts && r.opts.kind) || "cn", only: [...new Set(uniq.map(q => q.ref.drug && q.ref.drug.no).filter(Boolean))], drill: true });
      if (r.mode === "spell") return PG.startSpell({ dir: r.opts.dir, only: uniq.map(q => q.ref.drug.no) });
      if (r.mode === "ai") return PG.startQuiz(null, { mode: "ai", title: "AI 出题 · 错题", preset: r.wrongs.map(q => q.ref.ai).filter(Boolean) }); PG.startQuiz(uniq.map(q => q.ref.drug || DM.get(q.ref.group.drugs[0][0]))); };
  });
}
