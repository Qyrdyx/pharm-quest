/* 药理闯关 · 轮换记录：每个玩法先出本轮没考过的药 */
import { PG, reg } from "../core/registry.js";
import { TT, shuffle } from "../core/utils.js";
import { LS } from "../core/storage.js";
import { toast } from "../ui/screen.js";

reg({ bagDeck: () => bagDeck, bagMark: () => bagMark, BAG_TOLD: () => BAG_TOLD, bagRoundDone: () => bagRoundDone, bagProgress: () => bagProgress, bagBadge: () => bagBadge, BAG_KEYS: () => BAG_KEYS, bagResetAll: () => bagResetAll });

/* 轮换抽药：key 区分玩法；pool 是本次范围 */
export function bagDeck(key, pool) {
  const seen = new Set(LS.get("seen_" + key, []));
  const fresh = pool.filter(d => !seen.has(d.no)), old = pool.filter(d => seen.has(d.no));
  return fresh.length ? [...shuffle(fresh), ...shuffle(old)] : shuffle(pool.slice());
}
export function bagMark(key, pool, d) {
  if (!key || !d) return;
  let seen = LS.get("seen_" + key, []);
  if (!seen.includes(d.no)) seen.push(d.no);
  // 当前范围里的药全部考过一遍：只清掉这些，范围外的记录保留
  const ids = new Set(pool.map(x => x.no));
  if ([...ids].every(n => seen.includes(n))) { seen = seen.filter(n => !ids.has(n)); bagRoundDone(key, ids.size); }
  LS.set("seen_" + key, seen);
}
/* 一整轮考完：弹一条提示（同一玩法 90 秒内只提示一次，范围很小时不刷屏） */
export const BAG_TOLD = {};
export function bagRoundDone(key, n) {
  if (n < 2 || Date.now() - (BAG_TOLD[key] || 0) < 90000) return; BAG_TOLD[key] = Date.now();
  const name = { quiz: TT("选择题", "quiz"), cls: TT("同类辨析", "class comparison"), sort: TT("药柜分拣", "pill sorting"), spell: TT("中英默写", "spelling"), match_cn: TT("中英连线", "name matching"), match_m: TT("机制连线", "mechanism matching"), match_i: TT("适应证连线", "indication matching"), match_a: TT("不良反应连线", "adverse-effect matching"), match_mia: TT("三合一连线", "3-in-1 matching") }[key] || TT("这个玩法", "this game");
  toast(TT(`✓ 所选的 ${n} 种药在「${name}」里已经全部考过一遍，接下来开始新一轮`, `✓ All ${n} selected drugs have come up once in ${name} — a new round starts now`), 4200);
}
export function bagProgress(key, pool) {
  const seen = new Set(LS.get("seen_" + key, []));
  const ids = [...new Set(pool.map(x => x.no))];
  return { done: ids.filter(n => seen.has(n)).length, total: ids.length };
}
export function bagBadge(key, pool) {
  const p = bagProgress(key, pool); if (!p.total) return "";
  return `<span class="bagp"><i><b style="width:${Math.round(p.done / p.total * 100)}%"></b></i><em>本轮已考 ${p.done} / ${p.total}</em></span>`;
}
export const BAG_KEYS = ["quiz", "cls", "sort", "spell", "match_cn", "match_m", "match_i", "match_a", "match_mia"];
export function bagResetAll() {
  BAG_KEYS.forEach(k => LS.set("seen_" + k, []));
  try {
    const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf("pg_seen_") === 0) ks.push(k); }
    ks.forEach(k => localStorage.setItem(k, "[]"));
  } catch (e) {}
}
