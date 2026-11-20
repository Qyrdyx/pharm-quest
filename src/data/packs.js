/* 药理闯关 · 题库扩展包：别人自己写（或 AI 生成）的药物组，导入后和内置分组一样参加各玩法
 * 存在 localStorage 的 pg_packs（完整备份会一起带上）。启动时在 data/index.js 之前并进 window.PHARM / window.FACTS。
 * 每个扩展包占一个“章”；组编号从 1001 起、药物编号从 10001 起，和内置的 1–53 组 / 1–186 号不会撞。
 */
import { reg } from "../core/registry.js";
import { LS } from "../core/storage.js";
import { CATALOG } from "./catalog.js";

reg({ catalog: () => catalog, isOfficial: () => isOfficial, packPrint: () => packPrint, officialMismatch: () => officialMismatch, normPack: () => normPack, updatePack: () => updatePack, packsToJSON: () => packsToJSON, PACK_LIMITS: () => PACK_LIMITS, packs: () => packs, parsePack: () => parsePack, installPack: () => installPack, removePackStore: () => removePackStore, setPackReviewed: () => setPackReviewed, packTag: () => packTag, packToJSON: () => packToJSON, PACK_SAMPLE: () => PACK_SAMPLE, PACK_SAMPLE_EN: () => PACK_SAMPLE_EN, packSample: () => packSample, isPackGroup: () => isPackGroup });

export const PACK_LIMITS = { packs: 20, groups: 40, drugs: 400, text: 400, chars: 2000000 };
export const packs = () => { const v = LS.get("packs", []); return Array.isArray(v) ? v : []; };
export const isPackGroup = g => !!(g && g.pack);
/* ---------- 官方合集与“官方审核” ----------
 * 官方合集打包在软件里（data/catalog.js）。一个包的内容（整理后的组和药，逐字）和合集里某个包完全一致，才算“官方审核”；
 * 改过一个字指纹就对不上——别人改过再传的文件不会显示官方，自己在编辑器里改过也会去掉这个标记 */
const fnv = s => { let h1 = 0x811c9dc5, h2 = 0x01000193; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; } return h1.toString(36) + h2.toString(36); };
export const packPrint = p => fnv(JSON.stringify([p.name, (p.groups || []).map(g => [g.n, g.e, g.m, g.i, g.c, g.d, g.s, g.a, (g.drugs || []).map(d => [d.zh, d.en, d.note, d.m, d.i, d.a])])]));
let CAT = null;
/* 合集里的包：{ file, pack（整理后）, print, groups, drugs } */
export function catalog() {
  if (CAT) return CAT;
  CAT = [];
  for (const it of CATALOG) { try { const r = parsePack(it.text, it.file.replace(/\.json$/i, "")); r.list.forEach(p => CAT.push({ file: it.file, text: it.text, pack: p, print: packPrint(p), groups: p.groups.length, drugs: p.groups.reduce((s, g) => s + g.drugs.length, 0) })); } catch (e) { console.warn("官方合集里的包读不出来：" + it.file, e); } }
  return CAT;
}
export const isOfficial = p => { const pr = packPrint(p); return catalog().some(c => c.print === pr); };
/* 和合集里某个包同名，但内容对不上：可能被人改过 */
export const officialMismatch = p => !isOfficial(p) && catalog().some(c => c.pack.name === p.name);
/* 组名后面的小标签：扩展包 / AI 未审核 */
const EN = () => window.LANG === "en";
export const packTag = g => !g || !g.pack ? "" : g.off ? `<span class="pk-tag off" title="${EN() ? "From the official collection, unmodified" : "来自官方合集，内容未改动"}">${EN() ? "Official" : "官方审核"}</span>` : g.ai ? `<span class="pk-tag ai" title="${EN() ? "AI-generated, not yet checked" : "AI 生成，还没有人工核对"}">${EN() ? "AI · unreviewed" : "AI·未审核"}</span>`
  : g.aig ? `<span class="pk-tag aio" title="${EN() ? "AI-generated, checked by you" : "AI 生成，已人工核对"}">${EN() ? "AI · reviewed" : "AI·已审核"}</span>` : `<span class="pk-tag">${EN() ? "Pack" : "扩展"}</span>`;

/* 字段别名：短写（和 drugs.js 一样）、英文全称、中文都认 */
const KEYS = {
  name: ["name", "n", "title", "名称", "组名", "药物组"], en: ["en", "e", "inn", "english", "英文名", "英文"],
  zh: ["zh", "cn", "chinese", "中文名", "药名", "name"], note: ["note", "feature", "features", "key", "区分要点", "特点", "要点"],
  m: ["m", "mechanism", "mech", "机制", "作用机制"], i: ["i", "indication", "indications", "适应证", "适应症"],
  c: ["c", "contraindication", "contraindications", "禁忌", "禁忌证", "禁忌症"], d: ["d", "dental", "dentistry", "牙科", "牙科应用", "口腔应用"],
  s: ["s", "spectrum", "抗菌谱"], a: ["a", "adverse", "adverse_effects", "adverseEffects", "side_effects", "不良反应"]
};
const clip = v => String(v).replace(/\s+/g, " ").trim().slice(0, PACK_LIMITS.text);
const get = (o, k) => { for (const key of KEYS[k]) { const v = o[key]; if (v != null && typeof v !== "object" && String(v).trim()) return clip(v); if (Array.isArray(v) && v.length && v.every(x => typeof x === "string")) return clip(v.join("、")); } return ""; };
const arr = (o, keys) => { for (const k of keys) if (Array.isArray(o[k])) return o[k]; return null; };

/* 读 JSON 文本 → { list: [整理好的扩展包], warn: [提示] }。整理好的包：{ name, author, desc, groups:[{ n, e, m,i,c,d,s,a, drugs:[{ zh, en, note, m,i,a }] }] } */
export function parsePack(text, fallbackName = "我的扩展包") {
  if (text.length > PACK_LIMITS.chars) throw new Error("文件太大（超过 2 MB）");
  let s = String(text).replace(/^﻿/, "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  let o; try { o = JSON.parse(s); } catch (e) { const a = s.indexOf("{"), b = s.lastIndexOf("}"); try { o = JSON.parse(s.slice(a, b + 1)); } catch (e2) { throw new Error("不是有效的 JSON：" + e.message); } }
  const warn = [];
  let raw = o && o.app === "pharm-quest" && Array.isArray(o.packs) ? o.packs : Array.isArray(o) && o.length && o[0] && (o[0].groups || o[0].drugs) ? o : [o];
  const list = raw.map((p, i) => normPack(p, raw.length > 1 ? `${fallbackName} ${i + 1}` : fallbackName, warn)).filter(Boolean);
  if (!list.length) throw new Error(warn[0] || "没有找到可用的药物组");
  return { list, warn };
}
export function normPack(o, fallbackName, warn) {
  if (!o || typeof o !== "object" || Array.isArray(o)) { warn.push("最外层应该是 { … } 对象"); return null; }
  let groups = arr(o, ["groups", "units", "药物组", "分组"]);
  if (!groups && arr(o, ["drugs", "药物"])) groups = [o];     // 只有一个组：drugs 直接写在最外层
  if (!groups || !groups.length) { warn.push("没有找到 groups（药物组）"); return null; }
  const name = get(o, "name").slice(0, 40) || fallbackName;
  const out = { name, author: clip(o.author || o.作者 || "").slice(0, 40), desc: clip(o.desc || o.description || o.说明 || "").slice(0, 120), groups: [] };
  let nd = 0;
  groups.slice(0, PACK_LIMITS.groups).forEach((g, gi) => {
    if (!g || typeof g !== "object") return;
    const G = { n: (get(g, "name") || (groups.length === 1 && g === o ? name : "")).slice(0, 40), e: get(g, "en").slice(0, 60) };
    if (g._id) G._id = g._id;      // 可视化编辑已装的扩展包：带着原来的组编号，学习记录不丢
    ["m", "i", "c", "d", "s", "a"].forEach(k => { G[k] = get(g, k); });
    const W = `第 ${gi + 1} 组${G.n ? "「" + G.n + "」" : ""}`;
    if (!G.n) { warn.push(W + "：缺少组名（name），已跳过"); return; }
    const ds = arr(g, ["drugs", "药物"]) || [];
    G.drugs = [];
    const seen = new Set();
    ds.forEach((d, di) => {
      if (Array.isArray(d)) d = { en: d[0], zh: d[1], note: d[2] };     // 和 drugs.js 一样的简写：[英文名, 中文名, 区分要点]
      if (!d || typeof d !== "object") return;
      const x = { zh: (get(d, "zh") || get(d, "en")).slice(0, 40), en: (get(d, "en") || get(d, "zh")).slice(0, 60), note: get(d, "note") };
      ["m", "i", "a"].forEach(k => { x[k] = get(d, k); });
      if (d._no) x._no = d._no;
      if (!x.zh) { warn.push(`${W} 第 ${di + 1} 个药：缺少药名，已跳过`); return; }
      if (!(x.m || x.i || x.a || G.m || G.i || G.a)) { warn.push(`${W}「${x.zh}」：机制、适应证、不良反应一项都没有（药物和组里都没写），已跳过`); return; }
      if (seen.has(x.zh)) { warn.push(`${W}「${x.zh}」：同一组里重复，已跳过`); return; }
      if (nd >= PACK_LIMITS.drugs) return;
      seen.add(x.zh); G.drugs.push(x); nd++;
    });
    if (!G.drugs.length) { warn.push(W + "：没有可用的药物，已跳过"); return; }
    if (!G.e) G.e = G.n;
    out.groups.push(G);
  });
  if (nd >= PACK_LIMITS.drugs) warn.push(`药物太多，只收了前 ${PACK_LIMITS.drugs} 个`);
  return out.groups.length ? out : null;
}

/* 安装：分配编号、去掉和已有药物重名的药，存进本机。existing = 已有药名（中文、英文小写）集合。返回 { pack, skipped:[药名] } */
export function installPack(p, existing, flags = {}) {
  const all = packs();
  if (all.length >= PACK_LIMITS.packs) throw new Error(`扩展包最多 ${PACK_LIMITS.packs} 个，先删掉几个`);
  const seq = Object.assign({ g: 1000, d: 10000, c: 0 }, LS.get("packSeq", {}));
  const skipped = [], taken = new Set(existing);
  const groups = p.groups.map(g => {
    const drugs = g.drugs.filter(d => {
      const hit = taken.has(d.zh) || taken.has(d.en.toLowerCase());
      if (hit) { skipped.push(d.zh); return false; }
      taken.add(d.zh); taken.add(d.en.toLowerCase()); return true;
    }).map(d => ({ ...d, no: ++seq.d }));
    return drugs.length ? { ...g, id: ++seq.g, drugs } : null;
  }).filter(Boolean);
  if (!groups.length) throw new Error("这些药题库里都已经有了，没有新内容可以并入");
  let nm = p.name, k = 2; while (all.some(x => x.name === nm)) nm = `${p.name} (${k++})`;
  const pack = { id: "pk" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ch: "扩" + (++seq.c), name: nm, author: p.author || "", desc: p.desc || "",
    ai: !!flags.ai, reviewed: !flags.ai, by: flags.by || "", t: Date.now(), groups, ...(isOfficial(p) ? { official: true, reviewed: true, print: packPrint(p) } : {}) };
  all.push(pack);
  LS.set("packs", all); LS.set("packSeq", seq);
  if ((LS.get("packs", []) || []).length !== all.length) throw new Error("本机存储空间不够，没能保存");
  return { pack, skipped };
}
/* 编辑已装的扩展包：原来的药 / 组保留编号（学习记录不丢），新加的分配新编号。existing = 其他药的药名集合（不含这个包自己的）。
   返回 { pack, skipped, warn, gone:{ nos, gids } }：gone 是删掉的药和组，调用方负责清它们的学习记录 */
export function updatePack(id, draft, existing) {
  const all = packs(), i = all.findIndex(p => p.id === id);
  if (i < 0) throw new Error("找不到这个扩展包");
  const old = all[i], warn = [], np = normPack(draft, old.name, warn);
  if (!np) throw new Error(warn[0] || "没有可用的药物组");
  const oldNos = new Set(old.groups.flatMap(g => g.drugs.map(d => d.no))), oldGids = new Set(old.groups.map(g => g.id));
  const seq = Object.assign({ g: 1000, d: 10000, c: 0 }, LS.get("packSeq", {}));
  const skipped = [], taken = new Set(existing), usedNo = new Set(), usedG = new Set();
  const groups = np.groups.map(g => {
    const drugs = g.drugs.filter(d => {
      const hit = taken.has(d.zh) || taken.has(d.en.toLowerCase());
      if (hit) { skipped.push(d.zh); return false; }
      taken.add(d.zh); taken.add(d.en.toLowerCase()); return true;
    }).map(({ _no, ...d }) => { const no = oldNos.has(_no) && !usedNo.has(_no) ? _no : ++seq.d; usedNo.add(no); return { ...d, no }; });
    const { _id, ...rest } = g;
    if (!drugs.length) return null;
    const gid = oldGids.has(_id) && !usedG.has(_id) ? _id : ++seq.g; usedG.add(gid);
    return { ...rest, id: gid, drugs };
  }).filter(Boolean);
  if (!groups.length) throw new Error("没有可用的药物组（药都和题库里已有的重名，或者缺内容）");
  let nm = np.name, k = 2; while (all.some((x, j) => j !== i && x.name === nm)) nm = `${np.name} (${k++})`;
  const pack = { ...old, name: nm, author: np.author, desc: np.desc, groups, t: Date.now() };
  if (pack.official && packPrint(np) !== old.print) { delete pack.official; delete pack.print; }   // 改过内容就不再是官方版本
  all[i] = pack; LS.set("packs", all); LS.set("packSeq", seq);
  return { pack, skipped, warn, gone: { nos: [...oldNos].filter(n => !usedNo.has(n)), gids: [...oldGids].filter(g => !usedG.has(g)) } };
}
export function removePackStore(id) { LS.set("packs", packs().filter(p => p.id !== id)); }
export function setPackReviewed(id, v = true) { LS.set("packs", packs().map(p => p.id === id ? { ...p, reviewed: v } : p)); }
/* 导出成可以发给别人导入的格式（不带本机编号） */
export function packToJSON(p) {
  const str = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v));
  return JSON.stringify({ name: p.name, author: p.author || undefined, desc: p.desc || undefined, ...(p.ai ? { note_ai: p.reviewed ? "AI 生成，已人工审核" : "AI 生成，未审核" } : {}),
    groups: p.groups.map(g => ({ ...str({ name: g.n, en: g.e !== g.n ? g.e : "", m: g.m, i: g.i, c: g.c, d: g.d, s: g.s, a: g.a }), drugs: g.drugs.map(d => str({ zh: d.zh, en: d.en !== d.zh ? d.en : "", note: d.note, m: d.m, i: d.i, a: d.a })) })) }, null, 2);
}

/* 一个或几个整理好的包 → JSON 文本（编辑器、预览改动后写回文本框用） */
export function packsToJSON(list) { return list.length === 1 ? packToJSON(list[0]) : JSON.stringify({ app: "pharm-quest", packs: list.map(p => JSON.parse(packToJSON(p))) }, null, 2); }

/* ---------- 启动时并进题库（在 data/index.js 建索引之前） ---------- */
try {
  const P = window.PHARM, F = window.FACTS || (window.FACTS = {});
  if (P) packs().forEach(p => {
    if (!p || !Array.isArray(p.groups) || !p.groups.length) return;
    P.chapters.push([p.ch, p.name, p.name]);
    p.groups.forEach(g => {
      P.groups.push({ id: g.id, ch: p.ch, n: g.n, e: g.e || g.n, m: g.m || "", i: g.i || "", c: g.c || "", d: g.d || "", s: g.s || undefined, a: g.a || "",
        pack: p.id, dot: p.groups.indexOf(g) + 1, ai: !!(p.ai && !p.reviewed && !p.official), aig: !!p.ai, off: !!p.official, drugs: g.drugs.map(d => [d.no, d.en || d.zh, d.zh, d.note || ""]) });
      g.drugs.forEach(d => { if (d.m || d.i || d.a) F[d.no] = [d.m || g.m || "", d.i || g.i || "", d.a || g.a || ""]; });
      /* 同类辨析：组里至少 3 种药、2 种以上写了区分要点，就自动做成一个类别（特点辨认题；没有场景题） */
      const noted = g.drugs.filter(d => d.note);
      if (g.drugs.length >= 3 && noted.length >= 2) {
        const C = window.CLASSES || (window.CLASSES = []), rows = {};
        g.drugs.forEach(d => { rows[d.no] = { note: d.note || "", mech: d.m || g.m || "", ind: d.i || g.i || "", ae: d.a || g.a || "" }; });
        const vary = k => new Set(Object.values(rows).map(r => r[k])).size > 1;
        C.push({ id: "pk" + g.id, name: g.n, short: g.n.slice(0, 14), group: g.id, pack: p.id, drugs: g.drugs.map(d => d.no),
          intro: g.m || g.i || "", tip: "", dims: [["note", "区分要点"], ...[["mech", "机制"], ["ind", "适应证"], ["ae", "不良反应"]].filter(([k]) => vary(k))],
          rows, feats: noted.map(d => [d.note, [d.no]]), scen: [], scales: [] });
      }
    });
  });
} catch (e) { console.warn("扩展包加载失败", e); }

/* 示例：抑酸药（教科书通用要点，仅作格式示范；以讲义为准） */
export const PACK_SAMPLE = `{
  "name": "抑酸药（示例）",
  "author": "你的名字",
  "groups": [
    {
      "name": "质子泵抑制剂",
      "en": "Proton pump inhibitors",
      "mechanism": "不可逆抑制胃壁细胞 H⁺/K⁺-ATP 酶（质子泵），强效抑制胃酸分泌",
      "indication": "消化性溃疡、胃食管反流病、联合抗菌药根除幽门螺杆菌",
      "contraindication": "对本类药过敏",
      "dental": "长期服用 NSAIDs 镇痛的患者可联用，保护胃黏膜",
      "adverse": "头痛、腹泻、长期使用致维生素 B12 缺乏、低镁血症",
      "drugs": [
        { "zh": "奥美拉唑", "en": "Omeprazole", "note": "最早上市的质子泵抑制剂；抑制 CYP2C19，影响氯吡格雷活化" },
        { "zh": "泮托拉唑", "en": "Pantoprazole", "note": "对 CYP2C19 影响小，相互作用较少；有注射剂" }
      ]
    },
    {
      "name": "H₂ 受体阻断药",
      "en": "H2 receptor antagonists",
      "mechanism": "竞争性阻断胃壁细胞 H₂ 受体，减少胃酸分泌",
      "indication": "消化性溃疡、轻症胃食管反流病",
      "adverse": "头痛、腹泻",
      "drugs": [
        { "zh": "西咪替丁", "en": "Cimetidine", "note": "第一代；抑制肝药酶，相互作用多；有抗雄激素作用",
          "adverse": "男性乳房发育、肝药酶抑制致药物相互作用、老年人精神错乱" },
        { "zh": "法莫替丁", "en": "Famotidine", "note": "作用强、维持时间长；不抑制肝药酶" }
      ]
    }
  ]
}`;

/* English sample: same content written in English. zh keeps the Chinese generic name (used in Chinese mode and to spot duplicates); every other field is free text */
export const PACK_SAMPLE_EN = `{
  "name": "Acid suppressants (sample)",
  "author": "Your name",
  "groups": [
    {
      "name": "Proton pump inhibitors",
      "en": "Proton pump inhibitors",
      "mechanism": "Irreversibly inhibit the H+/K+-ATPase (proton pump) of parietal cells, strongly suppressing gastric acid secretion",
      "indication": "Peptic ulcer, GERD, H. pylori eradication together with antibiotics",
      "contraindication": "Hypersensitivity to this class",
      "dental": "Can be co-prescribed to protect the stomach in patients on long-term NSAIDs for pain",
      "adverse": "Headache; diarrhoea; vitamin B12 deficiency with long-term use; hypomagnesaemia",
      "drugs": [
        { "zh": "奥美拉唑", "en": "Omeprazole", "note": "The first PPI; inhibits CYP2C19 and reduces activation of clopidogrel" },
        { "zh": "泮托拉唑", "en": "Pantoprazole", "note": "Little effect on CYP2C19, fewer interactions; available as injection" }
      ]
    },
    {
      "name": "H2 receptor antagonists",
      "en": "H2 receptor antagonists",
      "mechanism": "Competitively block H2 receptors on parietal cells, reducing acid secretion",
      "indication": "Peptic ulcer, mild GERD",
      "adverse": "Headache; diarrhoea",
      "drugs": [
        { "zh": "西咪替丁", "en": "Cimetidine", "note": "First generation; inhibits liver enzymes, many interactions; anti-androgenic",
          "adverse": "Gynaecomastia; drug interactions from enzyme inhibition; confusion in the elderly" },
        { "zh": "法莫替丁", "en": "Famotidine", "note": "Potent and long-acting; does not inhibit liver enzymes" }
      ]
    }
  ]
}`;
/* 按界面语言挑示例：alt = true 时给另一种语言的 */
export const packSample = (alt = false) => (window.LANG === "en") !== alt ? PACK_SAMPLE_EN : PACK_SAMPLE;
