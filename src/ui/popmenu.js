/* 药理闯关 · 自绘下拉菜单（代替系统原生 select 弹出框，样式和应用一致，手机上也好点）
 * popMenu(按钮, [{ v, label, hint, cur, danger, sep }], 选中回调, { newLabel, newPlaceholder, onNew })
 * onNew 有值时，菜单底部多一行“新建…”输入框，回车或点 ✓ 提交 */
import { reg } from "../core/registry.js";
import { esc } from "../core/utils.js";

reg({ popMenu: () => popMenu, closePopMenu: () => closePopMenu });

let cur = null;
export function closePopMenu() { if (cur) { cur.el.remove(); document.removeEventListener("pointerdown", cur.out, true); document.removeEventListener("keydown", cur.key, true); window.removeEventListener("scroll", cur.pos, true); window.removeEventListener("resize", cur.pos); cur.anchor.setAttribute("aria-expanded", "false"); cur = null; } }
export function popMenu(anchor, items, onPick, opt = {}) {
  const again = cur && cur.anchor === anchor; closePopMenu(); if (again) return;   // 再点一次同一个按钮 = 收起
  const el = document.createElement("div"); el.className = "pop-menu"; el.setAttribute("role", "menu");
  el.innerHTML = items.map((it, i) => it.sep ? `<div class="pm-sep"></div>`
    : `<button type="button" role="menuitem" class="pm-it${it.cur ? " cur" : ""}${it.danger ? " danger" : ""}" data-i="${i}" ${it.cur ? 'aria-current="true"' : ""}><span>${esc(it.label)}</span>${it.hint != null ? `<small>${esc(String(it.hint))}</small>` : ""}${it.cur ? "<b>✓</b>" : ""}</button>`).join("")
    + (opt.onNew ? `<div class="pm-new"><input class="pm-in" maxlength="40" placeholder="${esc(opt.newPlaceholder || "")}"><button type="button" class="pm-ok" aria-label="${esc(opt.newLabel || "OK")}">＋</button></div>` : "")
    + (items.length || opt.onNew ? "" : `<div class="pm-empty">${esc(opt.empty || "—")}</div>`);
  document.body.appendChild(el);
  const pos = () => {
    const r = anchor.getBoundingClientRect(), w = Math.max(el.offsetWidth, Math.min(260, innerWidth - 16)), h = el.offsetHeight;
    let x = Math.min(Math.max(8, r.right - w), innerWidth - w - 8), y = r.bottom + 6;
    if (y + h > innerHeight - 8 && r.top - h - 6 > 8) y = r.top - h - 6;      // 下面放不下就往上弹
    el.style.left = x + scrollX + "px"; el.style.top = y + scrollY + "px"; el.style.minWidth = Math.min(260, innerWidth - 16) + "px";
  };
  pos();
  el.querySelectorAll(".pm-it").forEach(b => b.onclick = e => { e.stopPropagation(); const it = items[+b.dataset.i]; closePopMenu(); onPick(it.v, it); });
  if (opt.onNew) {
    const inp = el.querySelector(".pm-in"), go = () => { const v = inp.value.trim().slice(0, 40); if (!v) { inp.focus(); return; } closePopMenu(); opt.onNew(v); };
    el.querySelector(".pm-ok").onclick = e => { e.stopPropagation(); go(); };
    inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); go(); } };
  }
  const out = e => { if (!el.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) closePopMenu(); };
  const key = e => { if (e.key === "Escape") { closePopMenu(); anchor.focus(); } };
  document.addEventListener("pointerdown", out, true); document.addEventListener("keydown", key, true);
  window.addEventListener("scroll", pos, true); window.addEventListener("resize", pos);
  anchor.setAttribute("aria-expanded", "true");
  cur = { el, anchor, out, key, pos };
  const first = el.querySelector(".pm-it"); if (first && opt.focus !== false) first.focus({ preventScroll: true });
}
