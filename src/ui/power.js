/* 药理闯关 · 省电：共用时间片、循环动画降帧、省电模式开关 */
import { PG, reg } from "../core/registry.js";
import { reduceMotion } from "../core/utils.js";
import { cfg } from "../core/state.js";

reg({ ecoOn: () => ecoOn, ECO_ITEMS: () => ECO_ITEMS, frameSlot: () => frameSlot, ECO_ANIM: () => ECO_ANIM, ecoAnimTick: () => ecoAnimTick, ecoAnim: () => ecoAnim, applyEco: () => applyEco });

/* 省电模式的各项：总开关打开时，每一项还可以单独关掉。[键, 中文, 英文, 说明中文, 说明英文] */
export const ECO_ITEMS = [
  ["bg", "背景静止", "Still background", "背景里飘动的分子图案停下来", "The drifting molecules in the background stop"],
  ["ecg", "画面降到 20 帧", "20 fps drawing", "监护仪心电图等画布从 30 帧降到 20 帧", "The heart monitor and other canvases draw at 20 fps instead of 30"],
  ["anim", "循环小动画降帧", "Slower looping animations", "病人呼吸、点滴、心跳、警报这类循环动画按 20 帧推进", "Breathing, drips, heartbeats and alarms step at 20 fps"],
  ["deco", "关掉装饰动画", "No decorative animations", "吉祥物晃动、音乐跳动条、病房灯光闪烁这些纯装饰的动画停掉", "Mascot wobble, music bars and ward lights stop"],
  ["holo", "闪卡镭射静止", "Still holo cards", "闪卡的镭射流光、彩虹闪星光不再自动流动（鼠标划过仍有反光）", "Holo foil and rainbow sparkles stop drifting (still react to the pointer)"],
  ["fx", "连击特效最高到「中」", "Combo effects capped at Medium", "特效强度选了「高」也按「中」显示", "Effects set to High show as Medium"]
];
/* 省电模式里某一项是否生效：总开关开着、这一项没被单独关掉 */
export const ecoOn = k => !!cfg.eco && (cfg.ecoOpts || {})[k] !== 0;
/* 共用时间片：同一帧里拿到同一个片号，画布和动画一起刷新，减少重绘次数 */
export const frameSlot = t => Math.floor(t / (ecoOn("ecg") ? 50 : 33.4));
/* 省电模式：循环的 CSS 动画（病人呼吸、点滴、心跳、警报…）暂停后按 20 帧手动推进；一次性的进场动画照常 */
export const ECO_ANIM = { raf: 0, slot: -1, last: 0, list: [], scan: 0 };
export function ecoAnimTick(t) {
  ECO_ANIM.raf = 0; if (!ecoOn("anim")) return;
  const sl = frameSlot(t);
  if (sl !== ECO_ANIM.slot && !document.hidden) {
    const dt = ECO_ANIM.last ? Math.min(200, t - ECO_ANIM.last) : 0; ECO_ANIM.slot = sl; ECO_ANIM.last = t;
    if (t - ECO_ANIM.scan > 400) {   // 每 0.4 秒重新找一次循环动画，平时只推进缓存的那几个
      ECO_ANIM.scan = t;
      ECO_ANIM.list = document.getAnimations().filter(a => typeof CSSAnimation !== "undefined" && a instanceof CSSAnimation && a.effect.getTiming().iterations === Infinity);
      ECO_ANIM.list.forEach(a => { if (a.playState === "running") a.pause(); });
    }
    for (const a of ECO_ANIM.list) if (a.playState === "paused" && a.effect && a.effect.target && a.effect.target.isConnected) a.currentTime = (a.currentTime || 0) + dt;
  } else if (document.hidden) ECO_ANIM.last = 0;
  if (!ECO_ANIM.list.length || document.hidden) {   // 没有循环动画（或在后台）：不逐帧唤醒，0.4 秒后再看
    ECO_ANIM.scan = 0; ECO_ANIM.last = 0; ECO_ANIM.raf = -1;
    setTimeout(() => { if (ECO_ANIM.raf === -1) { ECO_ANIM.raf = 0; if (ecoOn("anim")) ECO_ANIM.raf = requestAnimationFrame(ecoAnimTick); } }, 400);
    return;
  }
  ECO_ANIM.raf = requestAnimationFrame(ecoAnimTick);
}
export function ecoAnim() {
  if (ecoOn("anim") && !reduceMotion && document.getAnimations) { if (!ECO_ANIM.raf) { ECO_ANIM.last = 0; ECO_ANIM.raf = requestAnimationFrame(ecoAnimTick); } }
  else { if (ECO_ANIM.raf > 0) cancelAnimationFrame(ECO_ANIM.raf); ECO_ANIM.raf = 0;
    if (document.getAnimations) document.getAnimations().forEach(a => { if (typeof CSSAnimation !== "undefined" && a instanceof CSSAnimation && a.playState === "paused" && a.effect.getTiming().iterations === Infinity) a.play(); }); }
}
export function applyEco() {
  const b = document.body.classList; b.toggle("eco", !!cfg.eco);
  ["deco", "holo", "fx"].forEach(k => b.toggle("eco-" + k, ecoOn(k)));   // CSS 里按这些类关掉对应的动画
  if (window.bgAnim) window.bgAnim(); ecoAnim();
}
