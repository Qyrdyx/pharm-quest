/* 药理闯关 · AI 出题：服务商配置、提示词、接口调用、解析 */
import { PG, reg } from "../core/registry.js";
import { esc, shuffle } from "../core/utils.js";
import { LS } from "../core/storage.js";
import { DM, DR, GM, fact, zhAlt } from "../data/index.js";
import { mwrong, poolDrugs } from "../core/state.js";
import { wrongDrugs } from "../records/wrong.js";
import { bagDeck, bagMark } from "../records/rotation.js";
import { hotList } from "../games/drills.js";

reg({ AI_LEVEL: () => AI_LEVEL, AI_KIND: () => AI_KIND, AI_STYLE: () => AI_STYLE, aiRules: () => aiRules, aiNormQ: () => aiNormQ, aiPool: () => aiPool, AI_PROVIDERS: () => AI_PROVIDERS, aiCfg: () => aiCfg, aiBank: () => aiBank, aiSave: () => aiSave, AI_FOCUS: () => AI_FOCUS, AI_FOCUS_SHORT: () => AI_FOCUS_SHORT, AI_SCHEMA: () => AI_SCHEMA, aiDrugInfo: () => aiDrugInfo, aiPrompt: () => aiPrompt, aiErr: () => aiErr, aiCall: () => aiCall, aiParse: () => aiParse, aiBusy: () => aiBusy, aiGenerate: () => aiGenerate, aiToQ: () => aiToQ, aiExplain: () => aiExplain }, { aiCfg: v => { aiCfg = v; }, aiBank: v => { aiBank = v; }, aiBusy: v => { aiBusy = v; } });

/* ================= AI 出题（用户自带 API 密钥） ================= */
export const AI_PROVIDERS = {
  claude: { name: "Claude", base: "https://api.anthropic.com", model: "claude-opus-5-5", kind: "anthropic", note: "Anthropic 官方接口，国内一般需要 VPN。" },
  deepseek: { name: "DeepSeek", base: "https://api.deepseek.com/v1", model: "deepseek-chat", kind: "openai", note: "国内直连。密钥在 platform.deepseek.com 创建。" },
  qwen: { name: "通义千问", base: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus", kind: "openai", note: "阿里云百炼，国内直连。密钥在百炼控制台创建。" },
  kimi: { name: "Kimi", base: "https://api.moonshot.cn/v1", model: "moonshot-v1-32k", kind: "openai", note: "月之暗面，国内直连。模型名以官网为准，可以改。" },
  custom: { name: "自定义", base: "", model: "", kind: "openai", note: "任何兼容 OpenAI 格式（/chat/completions）的服务，填写地址和模型名。" }
};
export let aiCfg = Object.assign({ provider: "deepseek", base: AI_PROVIDERS.deepseek.base, model: AI_PROVIDERS.deepseek.model, key: "" }, LS.get("aiCfg", {}));
export let aiBank = LS.get("aiBank", []);
export const aiSave = () => { LS.set("aiCfg", aiCfg); LS.set("aiBank", aiBank); };
export const AI_FOCUS = { mix: "混合（机制、适应证、不良反应、临床场景都可以）", m: "作用机制", i: "适应证与临床选药", a: "不良反应与禁忌", case: "口腔临床场景选药", cmp: "同类药物之间的区别" };
export const AI_FOCUS_SHORT = { doc: "我的资料", mix: "混合", m: "机制", i: "适应证", a: "不良反应 / 禁忌", case: "口腔场景", cmp: "同类辨析" };
/* 题型、题干风格（② 生成题目里的可选项，③ 用资料出题也沿用） */
export const AI_KIND = { single: "单选", multi: "多选", tf: "判断", mix: "三种混合" };
export const AI_STYLE = { direct: "直接提问", case: "临床情境", mix: "两种穿插" };
const Q_ITEM = { kind: { type: "string", enum: ["single", "multi", "tf"] }, stem: { type: "string" }, options: { type: "array", items: { type: "string" } }, answers: { type: "array", items: { type: "integer" } }, explanation: { type: "string" } };
export const AI_SCHEMA = {
  type: "object", additionalProperties: false, required: ["questions"],
  properties: { questions: { type: "array", items: { type: "object", additionalProperties: false, required: ["drug_no", "kind", "stem", "options", "answers", "explanation"],
    properties: { drug_no: { type: "integer" }, ...Q_ITEM } } } }
};
/* 题型 / 风格 / 解析详略 → 提示词里的规则（两种出题方式共用）。o = { kind, style, exp } */
export function aiRules(o = {}) {
  const k = o.kind || "single";
  const kinds = {
    single: "全部出单选题（kind 填 \"single\"）：4 个选项，只有 1 个最佳答案，answers 里放这一个正确选项的序号（0 到 3）。",
    multi: "全部出多选题（kind 填 \"multi\"）：4 或 5 个选项，其中 2 个以上正确（但不能全对），answers 里放所有正确选项的序号（从 0 开始）。题干末尾不用写“多选”。",
    tf: "全部出判断题（kind 填 \"tf\"）：题干是一句完整的陈述，options 固定为 [\"正确\",\"错误\"]，answers 是 [0]（陈述正确）或 [1]（陈述错误）。错误的陈述要像真的一样，只错在一个关键点上；对错大致各半。",
    mix: "单选、多选、判断混合出（大约各占三分之一）。单选 kind 填 \"single\"：4 个选项 1 个答案；多选 kind 填 \"multi\"：4～5 个选项、2 个以上正确，answers 放全部正确序号；判断 kind 填 \"tf\"：options 固定为 [\"正确\",\"错误\"]，answers 是 [0] 或 [1]。"
  };
  const style = { direct: "题干直接提问考点，简洁明了。", case: "题干尽量写成口腔临床情境（患者年龄、主诉、病史或合并用药，再问用药或处理），判断题也可以用情境陈述。", mix: "直接提问和口腔临床情境题干混合。" }[o.style || "direct"];
  const exp = o.exp === "detail" ? "explanation 写详细一些（3～5 句）：说明正确答案的依据，并逐个说明其他选项错在哪里，最后给一句记忆要点。" : "explanation 用 1～3 句话说明为什么选这个答案、其他选项错在哪里。";
  return { kind: kinds[k] || kinds.single, style, exp };
}
/* 模型返回的一道题 → { kind, options, ans, ansSet } 或 null（格式不对）。兼容旧格式的 answer 单个数字 */
export function aiNormQ(x) {
  if (!x || !String(x.stem || "").trim()) return null;
  let opts = Array.isArray(x.options) ? x.options.map(o => String(o).replace(/^\s*[A-EＡ-Ｅa-e][.、．:：)）]\s*/, "").trim()) : [];
  let ans = Array.isArray(x.answers) ? x.answers.map(Number) : x.answer != null ? [Number(x.answer)] : [];
  ans = [...new Set(ans)].filter(n => Number.isInteger(n) && n >= 0 && n < opts.length).sort((a, b) => a - b);
  let kind = x.kind === "multi" || x.kind === "tf" ? x.kind : "single";
  if (opts.length === 2 && /^(正确|对|√|true)$/i.test(opts[0]) && /^(错误|错|×|false)$/i.test(opts[1])) kind = "tf";
  if (kind === "tf") { if (opts.length !== 2 || ans.length !== 1) return null; opts = ["正确", "错误"]; }
  else if (kind === "multi") { if (opts.length < 4 || opts.length > 5 || ans.length < 2 || ans.length >= opts.length) return null; }
  else { if (opts.length !== 4 || ans.length !== 1) return null; }
  if (opts.some(o => !o) || new Set(opts).size !== opts.length) return null;
  return { kind, options: opts, ans: ans[0], ...(kind === "multi" ? { ansSet: ans } : {}) };
}
export function aiDrugInfo(d) {
  const f = fact(d), g = d.g;
  return [`#${d.no} ${d.en}｜${d.cn}`, `所属药物组：${g.n}`, `机制：${f.m}`, `适应证：${f.i}`, `不良反应：${f.a || g.a || ""}`,
    g.c ? `禁忌：${g.c}` : "", g.d ? `口腔应用：${g.d}` : "", g.s ? `抗菌谱：${g.s}` : "", d.note ? `区分要点：${d.note}` : ""].filter(Boolean).join("\n");
}
export const AI_LEVEL = { base: "基础（核心概念）", hard: "进阶（偏临床应用和易混辨析）", top: "冲刺（综合：跨药物组比较、临床综合判断，干扰项高度相似）" };
export function aiPrompt(drugs, n, focus, level, o = {}) {
  const r = aiRules(o);
  const system = `你是口腔医学专业的药理学出题老师。根据用户给出的药物资料出题，题干、选项和解析都用简体中文（药名可以附英文 INN）。
要求：
1. 题型：${r.kind}选项里不要带 A/B/C/D 前缀。
2. 题干：${r.style}
3. 干扰项要有迷惑性：优先用同类或容易混淆的药、相近的机制或不良反应。不要出现“以上都对 / 以上都不对”，也不要让正确选项一眼就能看出来（比如明显更长、更具体、和题干用词重复）。
4. 只考核心知识：作用机制、适应证、不良反应、禁忌、口腔临床用药。不要考化学结构分类，不要出强弱排序这类过细的题。
5. 内容必须以给出的资料为准，资料里没有的内容不要编造。
6. ${r.exp}
7. drug_no 填这道题主要考查的药物编号（资料里 # 后面的数字）。
只输出 JSON，格式：{"questions":[{"drug_no":数字,"kind":"single","stem":"题干","options":["选项1","选项2","选项3","选项4"],"answers":[正确选项序号],"explanation":"解析"}]}`;
  const user = `出题方向：${AI_FOCUS[focus] || AI_FOCUS.mix}
难度：${AI_LEVEL[level] || AI_LEVEL.base}
题目数量：${n} 道。尽量每道考不同的药；药物少于题数时，同一个药可以从不同角度出题。

药物资料：

${drugs.map(aiDrugInfo).join("\n\n")}`;
  return { system: LANG === "en" ? system + "\nIMPORTANT: write the stem, options and explanation in English (drug names as English INN)." : system, user };
}
export const aiErr = (st, d) => {
  const m = d && ((d.error && (d.error.message || d.error)) || d.message) || "";
  const head = { 400: "请求格式不被接受", 401: "密钥无效或已过期", 402: "账户余额不足", 403: "没有权限（密钥或模型不可用）", 404: "服务地址或模型名不对", 429: "请求太频繁或额度用完" }[st] || "请求失败";
  return `${head}（${st}）${m ? "：" + String(typeof m === "string" ? m : JSON.stringify(m)).slice(0, 160) : ""}`;
};
export async function aiCall(system, user, schema) {
  const P = AI_PROVIDERS[aiCfg.provider] || AI_PROVIDERS.custom;
  const base = (aiCfg.base || P.base || "").trim().replace(/\/+$/, ""), model = (aiCfg.model || P.model || "").trim(), key = (aiCfg.key || "").trim();
  if (!key) throw new Error("还没有填写 API 密钥");
  if (!base || !model) throw new Error("请填写服务地址和模型名");
  let res, data;
  try {
    if (P.kind === "anthropic") {
      // Claude Messages API（浏览器直连需要 anthropic-dangerous-direct-browser-access 头）
      const body = { model, max_tokens: 16000, system, messages: [{ role: "user", content: user }],
        output_config: { effort: "medium", format: { type: "json_schema", schema: schema || AI_SCHEMA } } };
      const headers = { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2026-10-21", "anthropic-dangerous-direct-browser-access": "true" };
      // 被安全分类器拒绝时由服务端自动换模型重试（仅部分新模型支持）
      if (/^claude-(opus-5|sonnet-5-5|fable-5)/.test(model)) { body.fallbacks = "default"; headers["anthropic-beta"] = "server-side-fallback-2026-07-01"; }
      res = await fetch(base + "/v1/messages", { method: "POST", headers, body: JSON.stringify(body) });
      data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(aiErr(res.status, data));
      if (data.stop_reason === "refusal") throw new Error("模型拒绝了这次请求，换个出题方向或稍后再试");
      if (data.stop_reason === "max_tokens") throw new Error("输出被截断了，请减少每次生成的题数");
      const t = (data.content || []).find(b => b.type === "text");
      return t ? t.text : "";
    }
    const go = json => fetch(base + "/chat/completions", {
      method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + key },
      body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: typeof user === "string" ? user : user.filter(c => c.type === "text").map(c => c.text).join("\n") }], ...(json ? { response_format: { type: "json_object" } } : {}) })
    });
    res = await go(true);
    if (res.status === 400) res = await go(false);   // 有的服务不支持 JSON 模式，去掉再试一次
    data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(aiErr(res.status, data));
    return (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
  } catch (e) {
    if (e instanceof TypeError) throw new Error("连不上服务：可能是网络不通（Claude 在国内需要 VPN），或者这个服务不允许网页直接调用。在线版网页也可能拦截外部请求，请改用离线版。");
    throw e;
  }
}
export function aiParse(text, drugs, focus) {
  let s = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  let obj;
  try { obj = JSON.parse(s); } catch (e) { throw new Error("模型返回的内容不是有效的 JSON，可以再试一次"); }
  const list = Array.isArray(obj) ? obj : (obj && obj.questions) || [];
  const okNo = new Set(drugs.map(d => d.no)), out = [];
  let bad = 0;
  list.forEach(x => {
    const nq = aiNormQ(x), no = Number(x && x.drug_no);
    if (!nq || !okNo.has(no)) { bad++; return; }
    out.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), no, stem: String(x.stem).trim(), ...nq,
      exp: String(x.explanation || "").trim(), t: Date.now(), by: (aiCfg.model || (AI_PROVIDERS[aiCfg.provider] || {}).model || "").trim(), focus });
  });
  return { out, bad };
}
export let aiBusy = false;
/* 出题范围 → 药物列表。gids = 自选药物组 */
export function aiPool(src, gids) {
  if (src === "hot") return hotList().map(e => e.d);
  if (src === "wrong") { const s = new Set(wrongDrugs()); Object.keys(mwrong).forEach(k => { const d = DM.get(+k.split(":")[1]); if (d) s.add(d); }); return [...s]; }
  if (src === "pack") return DR.filter(d => d.g.pack);
  if (src === "pick") return (gids || []).flatMap(id => { const g = GM.get(id); return g ? g.drugs.map(a => DM.get(a[0])) : []; });
  return poolDrugs();
}
const POOL_EMPTY = { hot: "高频错误里还没有药，先去别的板块多练几局", wrong: "错题本里还没有药", pack: "还没有导入题库扩展包", pick: "还没有选药物组：在下面点选要出题的组", range: "当前考试范围是空的，先回首页选择考试范围" };
export async function aiGenerate(n, focus, level, src, onProgress, o = {}) {
  const pool = aiPool(src, o.gids);
  if (!pool.length) throw new Error(POOL_EMPTY[src] || POOL_EMPTY.range);
  const key = "ai_" + src, deck = o.order === "rand" ? shuffle(pool.slice()) : bagDeck(key, pool), picks = [];
  for (let i = 0; i < Math.min(n, deck.length); i++) picks.push(deck[i]);
  let added = 0, bad = 0; const ids = [];
  for (let i = 0; i < n; i += 10) {
    const k = Math.min(10, n - i);
    let ds = picks.slice(i, i + k); if (!ds.length) ds = picks.slice(0, k);
    onProgress(`正在生成第 ${i + 1}～${i + k} 题，通常要几十秒…`);
    const { system, user } = aiPrompt(ds, k, focus, level, o);
    const r = aiParse(await aiCall(system, user), ds, focus);
    aiBank = [...r.out, ...aiBank]; added += r.out.length; ids.push(...r.out.map(q => q.id)); bad += r.bad;
    ds.forEach(d => bagMark(key, pool, d));
    aiSave();
  }
  return { added, bad, ids };
}
/* AI 题转成答题引擎用的题目：每次打乱选项顺序 */
export function aiToQ(it) {
  const d = it.no ? DM.get(it.no) : undefined;
  if (it.kind === "tf") return { options: it.options.slice(), ans: it.ans, prompt: `<b>【判断】</b>${esc(it.stem)}`, ref: { drug: d, ai: it }, type: "ai" };
  const idx = shuffle(it.options.map((_, i) => i));
  if (it.kind === "multi") { const ansSet = it.ansSet.map(a => idx.indexOf(a)).sort((a, b) => a - b); return { multi: true, options: idx.map(i => it.options[i]), ansSet, ans: ansSet[0], prompt: `${esc(it.stem)}<b>（多选，全部选对才得分）</b>`, ref: { drug: d, ai: it }, type: "ai" }; }
  return { options: idx.map(i => it.options[i]), ans: idx.indexOf(it.ans), prompt: esc(it.stem), ref: { drug: d, ai: it }, type: "ai" };
}
export function aiExplain(q) {
  const d = q.ref.drug, it = q.ref.ai;
  return `${it.exp ? `<p class="m"><em>解析</em>${esc(it.exp)}</p>` : ""}${it.doc ? `<span class="gchip">资料：${esc(it.doc)}${it.topic ? " · " + esc(it.topic) : ""}</span> ` : ""}${d ? `<div class="ex-drug"><span class="no">#${d.no}</span><b>${esc(d.en)}</b><span>${esc(zhAlt(d))}</span></div><span class="gchip">#${d.g.id} ${esc(d.g.n)}</span>` : ""}
    <p class="ai-note">AI 生成（${esc(it.by || "")}）。发现错误可以点“这题有问题”，或在 AI 题库里删掉这题。</p>`;
}
