/* 药理闯关 · 页面容器与通用交互：切页、出错提示、底部提示、二次确认、滚动 */
import { PG, reg } from "../core/registry.js";
import { $ } from "../core/utils.js";
import { stopMusic } from "../music/player.js";
import { SFX } from "../music/sfx.js";

reg({ main: () => main, cleanup: () => cleanup, show: () => show, showErr: () => showErr, toast: () => toast, armLang: () => armLang, armConfirm: () => armConfirm, toTop: () => toTop, safeRun: () => safeRun, keepY: () => keepY }, { cleanup: v => { cleanup = v; } });

/* ================= 页面路由 ================= */
export const main = $("#main");
export let cleanup = null;
export function show(html, after) {
  if (cleanup) { cleanup(); cleanup = null; }
  document.querySelectorAll(".cb-word,.cb-break,.cb-round,.cb-svg,.cb-reveal,.cb-comet").forEach(x => x.remove());   // 换页时收掉连击特效
  try { if (PG.feverOff) PG.feverOff(); } catch (e) {}
  main.innerHTML = `<section class="screen">${html}</section>`;
  scrollTo({ top: 0 });
  after && after();
}
/* ---------- 出错提示 ---------- */
export function showErr(e, where, fromGlobal) {
  if (!fromGlobal) PG.logErr && PG.logErr(e, where || "界面");   // 记进出错记录（全局报错已由 core/errlog.js 记过）
  try {
    const msg = (where ? where + "：" : "") + ((e && (e.message || e.reason)) || String(e)).toString().slice(0, 180);
    let box = document.getElementById("errBox");
    if (!box) {
      box = document.createElement("div"); box.id = "errBox";
      box.style.cssText = "position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:99;padding:10px 14px;border-radius:12px;background:#4a1a22;color:#ffd7dd;border:1px solid #ff6b81;font:13px/1.5 system-ui,sans-serif;white-space:pre-wrap";
      box.onclick = () => box.remove();
      document.body.appendChild(box);
    }
    box.textContent = (window.LANG === "en" ? "Something went wrong (saved to Settings → Error log; tap to close)\n" : "出错了（已记进 设置 → 出错记录，点此关闭）\n") + msg + (/^Script error/.test(msg) ? "（浏览器隐藏了详情）" : "");
  } catch (_) {}
}
addEventListener("error", e => showErr(e.error || e.message, "", true));
addEventListener("unhandledrejection", e => showErr(e.reason, "", true));
/* 底部轻提示 */
export function toast(text, ms = 3000) {
  const el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); el.textContent = text;
  document.querySelectorAll(".toast").forEach(x => x.remove()); document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("on"));
  setTimeout(() => { el.classList.remove("on"); setTimeout(() => el.remove(), 300); }, ms);
}
/* 页内二次确认：第一下变红提示，3.5 秒内再点一下才执行（有些内置浏览器会屏蔽 confirm 弹窗） */
/* 中英切换：点第一下只是“准备”，3 秒内再点一下才真正切换，防止误触 */
export function armLang(btn, to) {
  try { SFX.click(); } catch (e) {}
  if (btn.dataset.armed) {
    clearTimeout(btn._t);
    try { stopMusic(); } catch (e) {}
    setLang(to); return;
  }
  btn._html = btn.innerHTML; btn.dataset.armed = 1; btn.classList.add("armed");
  btn.textContent = LANG === "en" ? "Tap again" : "再点切换";
  btn._t = setTimeout(() => { delete btn.dataset.armed; btn.classList.remove("armed"); btn.innerHTML = btn._html; }, 3000);
}
export function armConfirm(btn, label, fn) {
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (btn.dataset.armed) { clearTimeout(btn._t); delete btn.dataset.armed; btn.classList.remove("armed"); btn.textContent = btn._orig; fn(); return; }
    btn._orig = btn.textContent; btn.dataset.armed = 1; btn.classList.add("armed"); btn.textContent = label;
    btn._t = setTimeout(() => { delete btn.dataset.armed; btn.classList.remove("armed"); btn.textContent = btn._orig; }, 3500);
  });
}
export const toTop = () => { if (scrollY > 0) scrollTo({ top: 0, behavior: "auto" }); };
/* 运行一段操作；出错时显示真实报错，并执行兜底 */
export function safeRun(fn, where, onFail) {
  try { return fn(); }
  catch (e) { showErr(e, where); if (onFail) { try { onFail(); } catch (e2) { showErr(e2, where + "·兜底"); } } }
}
export const keepY = y => { scrollTo(0, y); requestAnimationFrame(() => scrollTo(0, y)); };
