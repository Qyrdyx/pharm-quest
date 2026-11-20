/* 药理闯关 · 错题本：记错 / 消错 */
import { PG, reg } from "../core/registry.js";
import { DM, GM } from "../data/index.js";
import { wrong } from "../core/state.js";

reg({ wrongKey: () => wrongKey, markWrong: () => markWrong, markRight: () => markRight, wrongDrugs: () => wrongDrugs });

export function wrongKey(q) { return q.ref.group ? "g" + q.ref.group.id : q.ref.drug ? String(q.ref.drug.no) : null; }
export function markWrong(q) { const k = wrongKey(q); if (k) wrong[k] = (wrong[k] || 0) + 1; }
export function markRight(q) { const k = wrongKey(q); if (k && wrong[k]) { wrong[k]--; if (wrong[k] <= 0) delete wrong[k]; } }
export function wrongDrugs() {
  return Object.keys(wrong).map(k => k[0] === "g" ? (GM.get(+k.slice(1)) ? DM.get(GM.get(+k.slice(1)).drugs[0][0]) : null) : DM.get(+k)).filter(Boolean);
}
