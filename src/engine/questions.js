/* 药理闯关 · 出题引擎：各题型生成、干扰项、同类辨析题 */
import { PG, reg } from "../core/registry.js";
import { esc, pick, rnd, shuffle } from "../core/utils.js";
import { CLASS_OF, CONFUSE, DM, DR, G, PAIRS, TYPES, aeItems, dLabel, fact, pairOpt, sim } from "../data/index.js";
import { cfg, poolDrugs, poolGroups } from "../core/state.js";

reg({ nameTokens: () => nameTokens, mask: () => mask, label: () => label, makeOpts: () => makeOpts, notSame: () => notSame, drugTiers: () => drugTiers, groupTiers: () => groupTiers, clsGens: () => clsGens, clsExplain: () => clsExplain, WEAK_AE: () => WEAK_AE, MKEYS: () => MKEYS, AKEYS: () => AKEYS, IKEYS: () => IKEYS, kwEn: () => kwEn, share: () => share, factGens: () => factGens, GEN: () => GEN, enabledTypes: () => enabledTypes, makeQuestion: () => makeQuestion });

/* ================= 出题器 ================= */
export function nameTokens(d) {
  return [d.en, d.cn, d.zh, ...d.en.split(/[()（）\/,+·]/), ...d.zh.split(/[()（）\/,+·]/)].map(s => s.trim()).filter(s => s.length >= 2);
}
export function mask(text, drugs) {
  let t = text;
  drugs.forEach(d => nameTokens(d).sort((a, b) => b.length - a.length).forEach(tok => {
    t = t.split(tok).join("▢▢");
  }));
  return t;
}
export const label = d => LANG === "en" ? d.en : `${d.en}｜${d.cn}`;
export function makeOpts(correct, tiers, n = 4) {
  const out = [correct], seen = new Set([correct]);
  for (const tier of tiers) { for (const t of shuffle(tier.slice())) { if (out.length >= n) break; if (!seen.has(t)) { seen.add(t); out.push(t); } } }
  const opts = shuffle(out);
  return { options: opts, ans: opts.indexOf(correct) };
}
export const notSame = (d, x) => x !== d && !(d.same && x.same === d.same);
export function drugTiers(d, f) {
  const pd = poolDrugs();
  return [(CONFUSE.get(d.no) || []).filter(x => notSame(d, x)).map(f),
    d.g.drugs.map(a => DM.get(a[0])).filter(x => notSame(d, x)).map(f),
    pd.filter(x => x.g.ch === d.g.ch && notSame(d, x)).map(f),
    pd.filter(x => notSame(d, x)).map(f),
    DR.filter(x => notSame(d, x)).map(f)];
}
export function groupTiers(g) {
  const pg = poolGroups();
  return [pg.filter(x => x !== g && x.ch === g.ch).map(x => x.n), pg.filter(x => x !== g).map(x => x.n), G.filter(x => x !== g).map(x => x.n)];
}
/* 同类药物辨析题：只在同一大类内部出选项，专练“长得像但不一样” */
export function clsGens() {
  const C = d => CLASS_OF.get(d.no);
  return {
    xf: d => {
      const c = C(d); if (!c) return null;
      const fs = c.feats.filter(f => f[1].length === 1);
      const f = pick(fs.filter(f => f[1][0] === d.no)) || pick(fs); if (!f) return null;
      const t = DM.get(f[1][0]), opts = shuffle([t, ...shuffle(c.ds.filter(x => x !== t)).slice(0, 3)]);
      return { options: opts.map(dLabel), ans: opts.indexOf(t), prompt: `${c.short} 里，哪个药具有这个特点？<q>${esc(f[0])}</q>`, ref: { drug: t, cls: c, drugs: opts } };
    },
    xd: d => {
      const c = C(d); if (!c) return null;
      const T = c.feats.filter(f => f[1].includes(d.no)); if (!T.length) return null;
      // 只用每个药专属的特点，避免“好几个药都符合”的模糊选项
      const single = T.filter(f => f[1].length === 1), right = pick(single.length ? single : T);
      const F = shuffle(c.feats.filter(f => !f[1].includes(d.no) && f[1].length === 1)).slice(0, 3); if (F.length < 3) return null;
      const all = shuffle([right, ...F]);
      return { options: all.map(f => f[0]), ans: all.indexOf(right), prompt: `下列哪一项是 <span class="drug">${esc(dLabel(d))}</span> 的特点？`,
        ref: { drug: d, cls: c, drugs: [d, ...F.map(f => DM.get(f[1][0]))], featOpts: all } };
    },
    xm: d => {
      const c = C(d); if (!c) return null;
      const fs = c.feats.filter(f => f[1].length >= 2); if (!fs.length) return null;
      const f = pick(fs), yes = c.ds.filter(x => f[1].includes(x.no)), no = c.ds.filter(x => !f[1].includes(x.no));
      let ny = Math.min(1 + rnd(3), yes.length), nn = 4 - ny;
      if (nn > no.length) { nn = no.length; ny = Math.min(yes.length, 4 - nn); }
      const opts = shuffle([...shuffle(yes.slice()).slice(0, ny), ...shuffle(no.slice()).slice(0, nn)]);
      const ansSet = opts.map((x, i) => f[1].includes(x.no) ? i : -1).filter(i => i >= 0);
      return { multi: true, options: opts.map(dLabel), ansSet, ans: ansSet[0], prompt: `下列哪些药物符合这一条？<q>${esc(f[0])}</q><b>（多选，全部选对才得分）</b>`, ref: { drug: opts[ansSet[0]], cls: c, drugs: opts, feat: f } };
    },
    xs: d => {
      const c = C(d); if (!c || !(c.scen || []).length) return null;
      const sc = pick(c.scen), t = DM.get(sc.ans), opts = shuffle([t, ...sc.o.map(o => DM.get(o[0]))]);
      return { options: opts.map(dLabel), ans: opts.indexOf(t), prompt: `临床场景：${esc(sc.q)}`, ref: { drug: t, cls: c, drugs: opts, scen: sc } };
    },
    xr: d => {
      const c = C(d); if (!c || !(c.scales || []).length) return null;
      const sc = pick(c.scales), byV = {};
      shuffle(Object.entries(sc[2])).forEach(([n, v]) => { if (byV[v] === undefined && DM.get(+n)) byV[v] = DM.get(+n); });
      const vals = Object.keys(byV).map(Number); if (vals.length < 3) return null;
      const chosen = shuffle(vals).slice(0, 4).map(v => [byV[v], v]);
      const opts = shuffle(chosen.map(e => e[0]));
      const ansSeq = chosen.slice().sort((a, b) => b[1] - a[1]).map(e => opts.indexOf(e[0]));
      return { rank: true, options: opts.map(dLabel), ansSeq, ans: ansSeq[0], prompt: `按「${sc[1]}」从强到弱，依次点击排序`, ref: { drug: opts[ansSeq[0]], cls: c, drugs: opts, scale: sc } };
    }
  };
}
/* 同类辨析解析：对比选项里每个药的特色适应证和标志性不良反应 */
export function clsExplain(q, ok) {
  const c = q.ref.cls, R = c.rows;
  let h = ok ? `<div class="verdict ok">回答正确</div>`
    : q.rank ? `<div class="verdict no">正确顺序：${q.ansSeq.map(i => esc(q.options[i])).join(" ＞ ")}</div>`
    : q.multi ? `<div class="verdict no">正确选项：</div><p>${q.ansSet.map(i => "✓ " + esc(q.options[i])).join("<br>")}</p>`
    : `<div class="verdict no">${LANG === "en" ? "Correct answer: " : "正确答案："}${esc(q.options[q.ans])}</div>`;
  if (q.ref.scen) { const sc = q.ref.scen; h += `<p>${esc(sc.why)}</p><ul class="whynot">${sc.o.map(([n, w]) => `<li>✗ <b>${esc(dLabel(DM.get(n)))}</b>：${esc(w)}</li>`).join("")}</ul>`; }
  if (q.ref.featOpts) h += `<ul class="whynot">${q.ref.featOpts.map(f => `<li>${f[1].includes(q.ref.drug.no) ? "✓" : "✗"} <b>${esc(f[0])}</b>：属于 ${f[1].map(n => esc(DM.get(n).cn)).join("、")}</li>`).join("")}</ul>`;
  if (q.ref.feat) h += `<p class="m"><em>符合的药</em>${q.ref.feat[1].map(n => esc(DM.get(n).cn)).join("、")}</p>`;
  if (q.ref.scale) {
    const sc = q.ref.scale;
    h += `<div class="scalebars">${q.ref.drugs.slice().sort((a, b) => sc[2][b.no] - sc[2][a.no]).map(d => `<div><span>${esc(d.cn)}</span><i>${"●".repeat(sc[2][d.no] + 1)}<em>${"●".repeat(3 - sc[2][d.no])}</em></i></div>`).join("")}</div>`;
  }
  const ds = [...new Set(q.ref.drugs.filter(Boolean))];
  h += `<div class="table-wrap"><table class="cmp"><thead><tr><th>药物</th><th>特色适应证</th><th>标志性不良反应</th></tr></thead><tbody>${ds.map(d => `<tr class="${d === q.ref.drug ? "cur" : ""}"><td><b>${esc(d.cn)}</b></td><td>${esc(R[d.no]?.ind || "")}</td><td>${esc(R[d.no]?.ae || "")}</td></tr>`).join("")}</tbody></table></div>`;
  return h;
}
/* 单药考点题：机制 / 适应证 / 不良反应，正反两个方向 */
export const WEAK_AE = LANG === "en" ? /^(allergy|nausea|diarrhea|headache|dizziness|fatigue|gi reactions|gi upset|gi irritation|local irritation|local burning sensation)$/i : /^(过敏|恶心|腹泻|头痛|头晕|乏力|胃肠反应|胃肠不适|局部刺激)$/;
/* 关键词冲突：同一靶点 / 同一器官的药不互相当干扰项，避免“两个都对” */
export const MKEYS = ["Na⁺ 通道", "K⁺ 通道", "钙通道", "Ca²⁺", "COX", "GABA", "M 受体", "M1", "Nm", "Nn", "α1", "α2", "β1", "β2", "D2", "H1", "5-HT", "μ", "阿片", "PBPs", "30S", "50S", "DNA 回旋酶", "二氢蝶酸", "叶酸", "胆碱酯酶", "Na⁺/K⁺", "糖皮质激素受体", "雌激素", "雄激素", "孕激素", "NO", "ACE", "AT1", "醛固酮", "维生素 K", "纤溶", "β-内酰胺", "硝基", "微管"];
export const AKEYS = ["肝", "肾", "耳", "听力", "前庭", "骨髓", "粒细胞", "贫血", "血小板", "出血", "QT", "心律失常", "心动过缓", "心动过速", "低血压", "高血压", "低血糖", "高血糖", "低钾", "高钾", "低钠", "光敏", "嗜睡", "锥体外系", "牙龈增生", "牙齿", "呼吸抑制", "惊厥", "依赖", "成瘾", "便秘", "口干", "致畸", "神经管", "血栓", "肺", "甲状腺", "视", "胃", "溃疡", "抑郁", "双硫仑", "结肠炎", "药疹", "过敏性休克", "男性化", "乳房", "水肿", "干咳", "钙"];
/* 适应证按同义词分组：同一组里的任意词都算“治同一类病” */
export const IKEYS = [["肠道", "痢", "肠炎"], ["贾第虫", "滴虫", "阿米巴", "原虫"], ["尿路"], ["呼吸道", "肺炎", "咽"], ["厌氧"], ["结核"], ["疟"], ["支原体", "衣原体", "立克次体"], ["幽门"], ["疱疹"], ["流感"], ["HIV"], ["肝炎"],
  ["念珠菌", "真菌", "隐球菌"], ["铜绿", "G⁻"], ["MRSA", "VRE", "G⁺"], ["骨髓炎", "颌骨"], ["牙源性", "牙周", "牙龈", "口腔", "冠周", "口炎"], ["手术预防"], ["心内膜炎"], ["梅毒"], ["风湿"],
  ["高血压"], ["心绞痛"], ["心衰"], ["房颤", "心律失常", "心动过速", "心动过缓"], ["哮喘", "COPD", "支气管"], ["鼻塞", "鼻炎"], ["过敏", "荨麻疹"], ["疼痛", "痛"], ["发热", "高热"],
  ["癫痫", "惊厥"], ["焦虑"], ["失眠", "镇静"], ["抑郁"], ["精神分裂", "躁狂", "双相"], ["帕金森"], ["糖尿病"], ["甲亢"], ["甲减"], ["骨质疏松", "补钙"], ["水肿", "腹水"], ["休克", "低血压"],
  ["青光眼"], ["溃疡"], ["痉挛"], ["血栓", "溶栓", "抗凝"], ["出血", "止血"], ["贫血"], ["麻醉", "插管", "肌松"], ["呕吐", "晕动"], ["不孕", "避孕", "流产", "引产"], ["前列腺"],
  ["消毒", "冲洗", "含漱", "清创"], ["菌斑", "防龋"]];
export const kwEn = k => { const e = (window.I18N_UI || {})[k]; return (e !== undefined ? e : (window.translateText ? translateText(k) : k)).toLowerCase(); };
if (LANG === "en") { [MKEYS, AKEYS].forEach(L => L.forEach((k, i) => { L[i] = kwEn(k); })); IKEYS.forEach(g => g.forEach((k, i) => { g[i] = kwEn(k); })); }
export const share = LANG === "en"
  ? (t, u, keys) => { t = String(t).toLowerCase(); u = String(u).toLowerCase(); return keys.some(k => { const ks = Array.isArray(k) ? k : [k]; return ks.some(x => t.includes(x)) && ks.some(x => u.includes(x)); }); }
  : (t, u, keys) => keys.some(k => { const ks = Array.isArray(k) ? k : [k]; return ks.some(x => t.includes(x)) && ks.some(x => u.includes(x)); });
export function factGens() {
  // 干扰药物：易混搭档 → 同一章 → 本次范围 → 全部，并用 okFn 排除考点相近的药
  const conf = d => CONFUSE.get(d.no) || [];
  const clash = (k, d, x, t, u) => {
    if (!u || sim(t, u) >= 0.5) return true;   // 没写这一项的药（扩展包）不能当干扰项
    if (k === "m" && share(t, u, MKEYS)) return true;
    if (k === "a" && share(t, u, AKEYS)) return true;
    if (k === "i" && share(t, u, IKEYS)) return true;
    if ((k === "i" || k === "a") && x.g === d.g) return true;           // 同组药适应证、不良反应多有重叠
    if (k === "m" && x.g === d.g && !conf(d).includes(x)) return true;
    return false;
  };
  const pickDrugs = (d, okFn, n = 3) => {
    const out = [], tiers = [CONFUSE.get(d.no) || [], DR.filter(x => x.g.ch === d.g.ch), poolDrugs(), DR];
    for (const t of tiers) for (const x of shuffle(t.slice())) {
      if (out.length >= n) return out;
      if (x === d || !notSame(d, x) || out.includes(x)) continue;
      if (okFn(x)) out.push(x);
    }
    return out;
  };
  const toD = (d, k, prompt, extra = {}) => {
    if (!fact(d)[k]) return null;
    const t = fact(d)[k], ds = pickDrugs(d, x => !clash(k, d, x, t, fact(x)[k]));
    const opts = shuffle([d, ...ds]);
    return { options: opts.map(dLabel), ans: opts.indexOf(d), prompt, ref: { drug: d, fact: k, ...extra } };
  };
  const fromD = (d, k, prompt) => {
    if (!fact(d)[k]) return null;
    const t = fact(d)[k], texts = [t], picked = [d];
    pickDrugs(d, x => { const u = fact(x)[k]; if (picked.every((y, i) => !clash(k, y, x, texts[i], u))) { texts.push(u); picked.push(x); return true; } return false; });
    const opts = shuffle(texts.slice());
    return { options: opts, ans: opts.indexOf(t), prompt, ref: { drug: d, fact: k } };
  };
  const dn = d => `<span class="drug">${esc(dLabel(d))}</span>`;
  return {
    fm: d => toD(d, "m", `哪个药的作用机制是这个？<q>${esc(mask(fact(d).m, [d]))}</q>`),
    dm: d => fromD(d, "m", `${dn(d)} 的作用机制是？`),
    fi: d => toD(d, "i", `哪个药主要用于？<q>${esc(mask(fact(d).i, [d]))}</q>`),
    di: d => fromD(d, "i", `${dn(d)} 的主要适应证是？`),
    fa: d => {
      const items = aeItems(d).filter(x => !WEAK_AE.test(x)); if (!items.length) return null;
      const item = pick(items);
      // 干扰药物的不良反应里不能含有这一条或意思相近的条目
      const ds = (() => { const out = [], tiers = [CONFUSE.get(d.no) || [], DR.filter(x => x.g.ch === d.g.ch), poolDrugs(), DR];
        for (const t of tiers) for (const x of shuffle(t.slice())) { if (out.length >= 3) return out; if (x === d || !notSame(d, x) || out.includes(x)) continue; if (fact(x).a && aeItems(x).every(y => sim(y, item) < 0.5) && !share(item, fact(x).a, AKEYS)) out.push(x); }
        return out; })();
      const opts = shuffle([d, ...ds]);
      return { options: opts.map(dLabel), ans: opts.indexOf(d), prompt: `哪个药的典型不良反应是这个？<q>${esc(item)}</q>`, ref: { drug: d, fact: "a", item } };
    },
    da: d => fromD(d, "a", `${dn(d)} 的典型不良反应是？`),
    ga: d => {
      const g = d.g; if (!g.a) return null;
      // 干扰组的共同不良反应不能和本组有同类条目（如两个组都会有双硫仑样反应）
      const okG = x => x !== g && !share(g.a, x.a || "", AKEYS) && sim(g.a, x.a || "") < 0.5;
      const pg = poolGroups();
      const o = makeOpts(g.n, [pg.filter(x => okG(x) && x.ch === g.ch).map(x => x.n), pg.filter(okG).map(x => x.n), G.filter(okG).map(x => x.n)]);
      return { ...o, prompt: `这组不良反应属于哪个药物组？<q>${esc(mask(g.a, g.drugs.map(a => DM.get(a[0]))))}</q>`, ref: { group: g, field: "a" } };
    }
  };
}
export const GEN = {
  cn(d) { if (d.en === d.zh) return null; const o = makeOpts(d.zh, drugTiers(d, x => x.zh)); return { ...o, prompt: T(`<span class="drug">${esc(d.en)}</span> 的中文名是？`, `What is the Chinese name of <span class="drug">${esc(d.en)}</span>?`), ref: { drug: d } }; },
  en(d) { if (d.en === d.zh) return null; const o = makeOpts(d.en, drugTiers(d, x => x.en)); return { ...o, prompt: T(`「${esc(d.cn)}」对应的英文名 / INN 是？`, `What is the English name / INN of <span data-zh>${esc(d.zh)}</span>?`), ref: { drug: d } }; },
  group(d) { const o = makeOpts(d.g.n, groupTiers(d.g)); return { ...o, prompt: T(`<span class="drug">${esc(d.en)}</span>（${esc(d.cn)}）属于哪个药物组？`, `Which drug group does <span class="drug">${esc(d.en)}</span> belong to?`), ref: { drug: d } }; },
  note(d) { if (!d.note) return null; const o = makeOpts(label(d), drugTiers(d, label)); return { ...o, prompt: `哪个药物符合这条描述？<q>${esc(mask(d.note, [d]))}</q>`, ref: { drug: d } }; },
  mech(d) { const g = d.g; if (!g.m) return null; const o = makeOpts(g.n, groupTiers(g)); return { ...o, prompt: `下面这段描述属于哪个药物组？<q>${esc(mask(g.m, g.drugs.map(a => DM.get(a[0]))))}</q>`, ref: { group: g, field: "m" } }; },
  feat(d) {
    // 不在题干里写“抗菌谱 / 牙科应用”等标签，避免标签本身泄露范围
    const g = d.g, keys = ["i", "c", "d", "s", "a"].filter(k => g[k]); if (!keys.length) return null; const k = pick(keys);
    const o = makeOpts(g.n, groupTiers(g));
    return { ...o, prompt: `下面这段描述属于哪个药物组？<q>${esc(mask(g[k], g.drugs.map(a => DM.get(a[0]))))}</q>`, ref: { group: g, field: k } };
  },
  odd(d) {
    {
      // 让 d 当“外来药”：从它的易混搭档所在组 → 同一章其他组里挑一个组
      const same = x => x === d || x.cn === d.cn || (d.same && x.same === d.same);
      const ok = g => g !== d.g && g.drugs.map(a => DM.get(a[0])).filter(x => x && !same(x)).length >= 3;
      const near = [...new Set((CONFUSE.get(d.no) || []).map(x => x.g))].filter(ok);
      const sameCh = G.filter(g => g.ch === d.g.ch && ok(g));
      const g2 = pick(near.length ? near : sameCh.length ? sameCh : G.filter(ok));
      if (g2) {
        const ins = shuffle(g2.drugs.map(a => DM.get(a[0])).filter(x => x && !same(x))).slice(0, 3);
        const opts = shuffle([...ins, d].map(label));
        return { options: opts, ans: opts.indexOf(label(d)), prompt: `下列哪一个<b>不属于</b>「${esc(g2.n)}」？`, ref: { drug: d, odd: g2 } };
      }
    }
    const g = d.g; if (g.drugs.length < 3) return null;
    const ins = shuffle(g.drugs.map(a => DM.get(a[0]))).slice(0, 3);
    // 外来药优先选：易混搭档 → 同一章其他组 → 其他
    const near = ins.flatMap(x => CONFUSE.get(x.no) || []).filter(x => x.g !== g);
    const sameCh = DR.filter(x => x.g !== g && x.g.ch === g.ch);
    const out = pick(near.length ? near : sameCh.length ? sameCh : DR.filter(x => x.g !== g));
    const opts = shuffle([...ins, out].map(label));
    return { options: opts, ans: opts.indexOf(label(out)), prompt: `下列哪一个<b>不属于</b>「${esc(g.n)}」？`, ref: { drug: out, odd: g } };
  },
  ...factGens(),
  ...clsGens(),
  tf(d) {
    const truth = Math.random() < 0.5; let g = d.g;
    if (!truth) { const others = poolGroups().filter(x => x !== d.g); g = others.length ? pick(others) : pick(G.filter(x => x !== d.g)); }
    return { options: ["正确", "错误"], ans: truth ? 0 : 1, prompt: T(`判断：<span class="drug">${esc(d.en)}</span>（${esc(d.cn)}）属于「${esc(g.n)}」`, `True or false: <span class="drug">${esc(d.en)}</span> belongs to '${esc(g.n)}'`), ref: { drug: d } };
  },
  pair(d) {
    const ps = PAIRS.filter(p => p.a === d || p.b === d); if (!ps.length) return null;
    const p = pick(ps), side = p.a === d ? "A" : "B";
    // 答案分布保持原样（单药 / 两者都是 / 两者都不是）；若抽中的是搭档独有的特征，换成本药独有的
    let f = pick(p.feats);
    if ((f.k === "A" || f.k === "B") && f.k !== side) f = pick(p.feats.filter(x => x.k === side)) || f;
    // A/B 顺序随机，“两者都是 / 两者都不是”固定在后面
    const order = Math.random() < 0.5 ? ["A", "B", "AB", "N"] : ["B", "A", "AB", "N"];
    return { options: order.map(k => pairOpt(p, k)), ans: order.indexOf(f.k),
      prompt: `下面这条特征属于哪个药？<q>${esc(f.t)}</q>`, ref: { drug: f.k === "A" ? p.a : f.k === "B" ? p.b : d, pair: p, feat: f } };
  },
  multi(d) {
    // 假陈述取自“近邻”：同组其他药 / 易混搭档 / 同一章，避免主题一眼对不上
    if (!d.note || !d.g.m) return null;
    const ok = x => notSame(d, x) && x.cn !== d.cn && !!x.note;
    const sib = d.g.drugs.map(a => DM.get(a[0])).filter(ok), conf = (CONFUSE.get(d.no) || []).filter(ok);
    const sameCh = DR.filter(x => x.g !== d.g && x.g.ch === d.g.ch && ok(x));
    const near = [...conf, ...sib].length ? [...conf, ...sib] : sameCh.length ? sameCh : DR.filter(ok);
    const chG = G.filter(x => x !== d.g && x.ch === d.g.ch && x.m);
    const og = pick(chG.length ? chG : G.filter(x => x !== d.g && x.m)), o1 = pick(near), o2 = pick(near);
    const T = LANG === "en" ? [`Belongs to '${d.g.n}'`, `Chinese name is ${d.zh}`, mask(d.note, [d]), `Shared mechanism of its group: ${d.g.m}`] : [`属于「${d.g.n}」`, `中文名是「${d.cn}」`, mask(d.note, [d]), `所在药物组的共同机制：${d.g.m}`];
    const F = LANG === "en" ? [`Belongs to '${og.n}'`, `Chinese name is ${o1.zh}`, mask(o2.note, [o2]), `Shared mechanism of its group: ${og.m}`] : [`属于「${og.n}」`, `中文名是「${o1.cn}」`, mask(o2.note, [o2]), `所在药物组的共同机制：${og.m}`];
    // 每一类（归组 / 中文名 / 特点 / 机制）只出真或假其中一句，避免互相矛盾一眼看穿
    const nTrue = 1 + rnd(3), kinds = shuffle([0, 1, 2, 3]);
    const items = kinds.map((k, i) => ({ t: i < nTrue ? T[k] : F[k], ok: i < nTrue }));
    shuffle(items);
    return { multi: true, options: items.map(x => x.t), ansSet: items.map((x, i) => x.ok ? i : -1).filter(i => i >= 0), ans: items.findIndex(x => x.ok),
      prompt: `关于 <span class="drug">${esc(d.en)}</span>，下列哪些说法正确？<b>（多选，全部选对才得分）</b>`, ref: { drug: d } };
  }
};
export function enabledTypes() { const t = Object.keys(TYPES).filter(k => cfg.types[k]); return t.length ? t : ["group"]; }
export function makeQuestion(d, types) {
  // 有易混搭档的药，适当提高出“区别题”的机会
  let order = shuffle(types.slice());
  if (types.includes("pair") && CONFUSE.has(d.no) && Math.random() < 0.35) order = ["pair", ...order.filter(t => t !== "pair")];
  const about = q => q.ref.drug ? q.ref.drug === d : q.ref.group === d.g;
  let loose = null;
  for (const t of order) {
    const q = GEN[t](d); if (!q || q.options.length < 2) continue;
    q.type = t;
    if (about(q)) return q;
    if (!loose) loose = q;
  }
  if (loose) return loose;
  const q = GEN.group(d); q.type = "group"; return q;
}
