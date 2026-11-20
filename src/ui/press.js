/* 药理闯关 · 触屏：按钮音效只在确认点按时播放，区分点按和滑动 */
import { PG, reg } from "../core/registry.js";
import { SFX } from "../music/sfx.js";
import { showErr } from "./screen.js";

reg({ pressSoundEl: () => pressSoundEl, pressSound: () => pressSound, onPress: () => onPress, TAP_SEL: () => TAP_SEL, tapStart: () => tapStart, elOf: () => elOf }, { tapStart: v => { tapStart = v; } });

// 按钮音效：鼠标在“按下”的瞬间播放；触屏要等确认是点按（不是滑动）才播放
// 作答类按钮（选项、药柜抽屉）不在这里播，由对错音效负责
export const pressSoundEl = el => { const b = el && el.closest && el.closest("button, summary, .ftable td.cover"); return b && !b.disabled && !b.closest(".opts, .cabinet, .dev-pan") ? b : null; };
export const pressSound = () => { PG.pressAt = 0; SFX.click(); PG.pressAt = performance.now(); };
addEventListener("pointerdown", e => {
  if (e.button !== 0 || e.pointerType !== "mouse") return;
  if (pressSoundEl(e.target)) pressSound();
}, true);
// 触屏：没走自定义点按（例如长按后松开）的点击，在 click 时补一声
addEventListener("click", e => { if (e.isTrusted && e.pointerType && e.pointerType !== "mouse" && pressSoundEl(e.target)) pressSound(); }, true);
// 鼠标按下就作答（不等松开），触屏仍按点击处理，避免滑动时误触
export const onPress = (el, fn) => el.addEventListener("pointerdown", e => {
  if (e.pointerType !== "mouse" || e.button !== 0) return;
  fn();
  // 吞掉随后松开鼠标产生的那次 click，防止换题后误点到新选项
  const kill = ev => { ev.stopPropagation(); ev.preventDefault(); };
  addEventListener("click", kill, { capture: true, once: true });
  setTimeout(() => removeEventListener("click", kill, true), 700);
});
/* 触屏点按：在按钮、选项等可操作元素上，拦下系统的点按并自己补发 click。
   点空白处不拦，想调出阅读器工具栏时点空白即可。滑动、长按（拖拽）不受影响。 */
export const TAP_SEL = "button, a[href], summary, label, .chip, .opt, .drawer, .tile, .hcell, .mode, .tab, .trk, .cls-card, .ctable td[data-k], td.cover, .rxpill, .ccard, #sbg, [data-chall], [data-preset], [data-a], [data-b], [data-del], [data-dir], [data-mc], [data-mq], [data-rm], [data-s]";
export let tapStart = null;
export const elOf = n => n && n.nodeType === 1 ? n : n && n.parentElement;   // 老版 iOS 的触摸目标可能是文字节点
addEventListener("touchstart", e => {
  const t = e.touches[0];
  tapStart = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, at: performance.now(), el: elOf(e.target) } : null;
}, { passive: true, capture: true });
addEventListener("touchmove", e => {
  if (!tapStart) return; const t = e.touches[0];
  if (Math.abs(t.clientX - tapStart.x) > 10 || Math.abs(t.clientY - tapStart.y) > 10) tapStart = null;
}, { passive: true, capture: true });
addEventListener("touchend", e => {
  let hitEl = null, prevented = false;
  try {
  const st = tapStart; tapStart = null;
  if (!st || e.changedTouches.length !== 1 || performance.now() - st.at > 450) return;
  const target = elOf(e.target);
  if (!target || target !== st.el || target.closest("input, textarea, select, [contenteditable]")) return;
  const hit = hitEl = target.closest(TAP_SEL);
  if (!hit) return;
  e.preventDefault(); prevented = true;
  if (hit.disabled || hit.closest("[disabled]")) return;
  const t = e.changedTouches[0];
  let ev;
  try { ev = new MouseEvent("click", { bubbles: true, cancelable: true, view: window, clientX: t.clientX, clientY: t.clientY, screenX: t.screenX, screenY: t.screenY, detail: 1 }); }
  catch (_) { ev = document.createEvent("MouseEvents"); ev.initMouseEvent("click", true, true, window, 1, t.screenX, t.screenY, t.clientX, t.clientY, false, false, false, false, 0, null); }
  if (pressSoundEl(target)) pressSound();
  target.dispatchEvent(ev);
  } catch (err) {
    showErr(err, "点按");
    if (prevented && hitEl && typeof hitEl.click === "function") hitEl.click();
  }
}, { passive: false, capture: true });
