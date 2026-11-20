/* 药理闯关 · 题库数据索引：药物组、药物、单药考点、同类辨析、易混药对 */
import { PG, reg } from "../core/registry.js";

reg({ P: () => P, G: () => G, GM: () => GM, CH: () => CH, DR: () => DR, zhAlt: () => zhAlt, enAlt: () => enAlt, DM: () => DM, FIELD: () => FIELD, TYPES: () => TYPES, TYPE_W: () => TYPE_W, FACTS: () => FACTS, fact: () => fact, aeItems: () => aeItems, FACT_NAME: () => FACT_NAME, FACT_EN: () => FACT_EN, sim: () => sim, CLASSES: () => CLASSES, CLASS_OF: () => CLASS_OF, PAIRS: () => PAIRS, PAIR_ANS: () => PAIR_ANS, dLabel: () => dLabel, pairOpt: () => pairOpt, CONFUSE: () => CONFUSE });

/* ================= 数据 ================= */
export const P = window.PHARM;
if (!P) { document.getElementById("main").innerHTML = '<p class="empty">题库文件 drugs.js 没有加载成功，请刷新页面。</p>'; throw new Error("no data"); }
export const G = P.groups;
export const GM = new Map(G.map(g => [g.id, g]));
export const CH = new Map(P.chapters.map(c => [c[0], c]));
export const DR = [];
G.forEach(g => g.drugs.forEach(a => DR.push({ no: a[0], en: a[1], cn: LANG === "en" ? a[1] : a[2], zh: a[2], note: a[3], same: a[4] || null, g })));
export const zhAlt = d => LANG === "en" ? "" : d.cn;          // 英文模式下不重复显示名字
export const enAlt = d => LANG === "en" || d.en === d.zh ? "" : d.en;
export const DM = new Map(DR.map(d => [d.no, d]));
export const FIELD = { m: "作用机制", i: "适应证", c: "禁忌证", d: "牙科应用", s: "抗菌谱", a: "不良反应" };
export const TYPES = {
  cn: "INN → 中文名", en: "中文 → INN", group: "归属药物组", note: "特点辨认",
  mech: "作用机制", feat: "适应证 / 禁忌 / 牙科 / 抗菌谱", odd: "找不同", pair: "易混药物特征归属", multi: "多选题", tf: "判断题（半分）",
  fm: "机制 → 药物", dm: "药物 → 机制", fi: "适应证 → 药物", di: "药物 → 适应证", fa: "不良反应 → 药物", da: "药物 → 不良反应", ga: "组不良反应 → 药物组",
  xf: "同类辨析 · 特征 → 药", xd: "同类辨析 · 药 → 特征", xs: "同类辨析 · 场景选药"
};
/* 各题型的得分倍数：判断题靠蒙也有一半机会，只给半分 */
export const TYPE_W = { tf: 0.5, multi: 1.5, pair: 1.2 };
/* 单药考点：机制 / 适应证 / 典型不良反应 */
export const FACTS = window.FACTS || {};
export const fact = d => { const f = FACTS[d.no]; return f ? { m: f[0], i: f[1], a: f[2] } : { m: d.g.m, i: d.g.i, a: d.g.a || "" }; };
export const aeItems = d => fact(d).a.split(d.g.pack ? /[、;；]\s*/ : LANG === "en" ? /;\s*/ : "、").map(x => x.trim()).filter(Boolean);
export const FACT_NAME = { m: "作用机制", i: "适应证", a: "不良反应" };
export const FACT_EN = { m: "mechanisms", i: "indications", a: "adverse effects" };
/* 两段文字的相似度（字符二元组重合率），用来排除“意思差不多”的干扰项 */
export function sim(a, b) {
  if (LANG === "en") {
    const w = t => new Set(String(t).toLowerCase().split(/[^a-z0-9⁺²³αβμ-]+/).filter(x => x.length > 2 && !/^(the|and|for|with|of|in|to|by|or|as|is|are|its|from|via|use|used)$/.test(x)));
    const A = w(a), B = w(b); if (!A.size || !B.size) return a === b ? 1 : 0;
    let n = 0; A.forEach(x => { if (B.has(x)) n++; }); return n / Math.min(A.size, B.size);
  }
  const g = t => { t = t.replace(/[\s，、；。（）()·:：,]/g, ""); const S = new Set(); for (let i = 0; i < t.length - 1; i++) S.add(t.slice(i, i + 2)); return S; };
  const A = g(a), B = g(b); if (!A.size || !B.size) return a === b ? 1 : 0;
  let n = 0; A.forEach(x => { if (B.has(x)) n++; }); return n / Math.min(A.size, B.size);
}
/* 同类药物辨析：类别数据 */
export const CLASSES = (window.CLASSES || []).map(c => ({ ...c, ds: c.drugs.map(n => DM.get(n)).filter(Boolean) })).sort((a, b) => a.group - b.group);
export const CLASS_OF = new Map();
CLASSES.forEach(c => c.ds.forEach(d => CLASS_OF.set(d.no, c)));
/* 易混药物对 */
export const PAIRS = (window.PAIRS || []).filter(p => DM.has(p[0]) && DM.has(p[1])).map(p => ({ a: DM.get(p[0]), b: DM.get(p[1]), feats: p[2].map(([t, k]) => ({ t, k })) }));
export const PAIR_ANS = ["A", "B", "AB", "N"];
/* 药名标签：中文名已带括号或英文时不再重复加英文 */
export const dLabel = d => /[（(A-Za-z]/.test(d.cn) || d.en === d.zh ? d.cn : `${d.cn}（${d.en.replace(/\s*\(.*\)/, "")}）`;
export const pairOpt = (p, k) => k === "A" ? dLabel(p.a) : k === "B" ? dLabel(p.b) : k === "AB" ? "两者都是" : "两者都不是";
export const CONFUSE = new Map();
PAIRS.forEach(p => { [[p.a, p.b], [p.b, p.a]].forEach(([x, y]) => { if (!CONFUSE.has(x.no)) CONFUSE.set(x.no, []); CONFUSE.get(x.no).push(y); }); });
