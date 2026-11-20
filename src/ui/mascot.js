/* 药理闯关 · 吉祥物：胶囊医生「小囊」 */
import { PG, reg } from "../core/registry.js";

reg({ L: () => L, mascotId: () => mascotId, mascotHTML: () => mascotHTML, LINES: () => LINES, mood: () => mood }, { mascotId: v => { mascotId = v; } });

export const L = () => LINES;
/* ================= 吉祥物：胶囊医生「小囊」 ================= */
export let mascotId = 0;
export function mascotHTML(mood = "idle") {
  const id = "mc" + (++mascotId);
  return `<div class="mascot" data-mood="${mood}"><svg viewBox="0 0 120 150" aria-hidden="true">
  <ellipse class="m-shadow" cx="60" cy="143" rx="28" ry="5"/>
  <g class="m-body">
    <g class="m-arm m-arm-l"><path class="stroke" d="M32 92 q-14 4 -18 18"/><circle cx="14" cy="111" r="5.5" fill="#f7ecd9" stroke="#0a1a20" stroke-width="3"/></g>
    <g class="m-arm m-arm-r"><path class="stroke" d="M88 92 q14 4 18 18"/><circle cx="106" cy="111" r="5.5" fill="#f7ecd9" stroke="#0a1a20" stroke-width="3"/></g>
    <clipPath id="${id}"><rect x="30" y="12" width="60" height="122" rx="30"/></clipPath>
    <g clip-path="url(#${id})">
      <rect x="30" y="12" width="60" height="122" fill="#f7ecd9"/>
      <rect x="30" y="12" width="60" height="58" fill="#ef6a52"/>
      <rect x="30" y="68" width="60" height="4" fill="#0a1a20" opacity=".18"/>
      <rect x="30" y="112" width="60" height="22" fill="#0a1a20" opacity=".05"/>
    </g>
    <rect x="30" y="12" width="60" height="122" rx="30" fill="none" stroke="#0a1a20" stroke-width="3"/>
    <rect x="38" y="22" width="7" height="30" rx="3.5" fill="#fff" opacity=".45"/>
    <g transform="translate(60 41)"><rect x="-9" y="-3.5" width="18" height="7" rx="2" fill="#fff"/><rect x="-3.5" y="-9" width="7" height="18" rx="2" fill="#fff"/></g>
    <g class="eyes eyes-n"><ellipse class="fillk" cx="48" cy="89" rx="4.6" ry="6"/><ellipse class="fillk" cx="72" cy="89" rx="4.6" ry="6"/><circle cx="49.5" cy="87" r="1.6" fill="#fff"/><circle cx="73.5" cy="87" r="1.6" fill="#fff"/></g>
    <g class="eyes eyes-h"><path class="stroke" d="M43 91 q5 -8 10 0"/><path class="stroke" d="M67 91 q5 -8 10 0"/></g>
    <g class="eyes eyes-s"><ellipse class="fillk" cx="48" cy="91" rx="4" ry="4.6"/><ellipse class="fillk" cx="72" cy="91" rx="4" ry="4.6"/><path class="stroke" d="M41 80 l11 4"/><path class="stroke" d="M79 80 l-11 4"/><path d="M76 96 q2 6 0 8 q-2 -2 0 -8z" fill="#86cbff"/></g>
    <g class="eyes eyes-o"><circle cx="48" cy="89" r="7" fill="#fff" stroke="#0a1a20" stroke-width="2.5"/><circle cx="72" cy="89" r="7" fill="#fff" stroke="#0a1a20" stroke-width="2.5"/><circle class="fillk" cx="48" cy="89" r="2.6"/><circle class="fillk" cx="72" cy="89" r="2.6"/></g>
    <circle cx="39" cy="100" r="5" fill="#ff8f8f" opacity=".55"/><circle cx="81" cy="100" r="5" fill="#ff8f8f" opacity=".55"/>
    <path class="mouth m-n stroke" d="M54 102 q6 5 12 0"/>
    <g class="mouth m-h"><path d="M50 100 q10 15 20 0 z" fill="#0a1a20" stroke="#0a1a20" stroke-width="2.5" stroke-linejoin="round"/><path d="M55 106 q5 3 10 0 q-5 -3 -10 0z" fill="#ef6a52"/></g>
    <path class="mouth m-s stroke" d="M53 108 q7 -6 14 0"/>
    <ellipse class="mouth m-o fillk" cx="60" cy="106" rx="4.5" ry="5.5"/>
    <path class="mouth m-t stroke" d="M54 105 h11"/>
  </g></svg></div>`;
}
export const LINES = {
  right: ["对啦！", "药到病除！", "稳稳拿下", "机制清楚！", "这题拿捏了", "记得很牢"],
  combo: ["连击！手感火热", "心率都快乐起来了", "停不下来啦", "考官点头了"],
  wrong: ["再想想机制…", "记下来，下次就会", "看看解析吧", "这组容易混"],
  time: ["时间到啦！", "要快一点哦"],
  think: ["慢慢想～", "先想分类", "回忆共同机制"],
  start: ["准备好了吗？", "开始查房！", "今天背哪组？"]
};
export function mood(el, m, text, ms = 1600) {
  if (!el) return;
  el.setAttribute("data-mood", "idle"); void el.offsetWidth; el.setAttribute("data-mood", m);
  el.querySelector(".bubble")?.remove();
  if (text) { const b = document.createElement("div"); b.className = "bubble"; b.textContent = text; el.appendChild(b); }
  clearTimeout(el._t);
  if (ms) el._t = setTimeout(() => { el.setAttribute("data-mood", "idle"); el.querySelector(".bubble")?.remove(); }, ms);
}
