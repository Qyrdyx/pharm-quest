/* 药理闯关 · AI 专题：入口页（两个板块）+ AI 出题（生成）页；AI 题库页在 ai/library.js */
import { PG, reg } from "../core/registry.js";
import { $, TT, esc } from "../core/utils.js";
import { LS } from "../core/storage.js";
import { DM, DR, G, GM } from "../data/index.js";
import { packTag } from "../data/packs.js";
import { cfg, poolDrugs, save } from "../core/state.js";
import { SFX } from "../music/sfx.js";
import { armConfirm, main, show } from "../ui/screen.js";
import { decoSVG } from "../pages/home.js";
import { hotList } from "../games/drills.js";
import { AI_FOCUS, AI_FOCUS_SHORT, AI_KIND, AI_PROVIDERS, AI_STYLE, aiBank, aiBusy, aiCall, aiCfg, aiGenerate, aiParse, aiPool, aiSave } from "./client.js";
import { AI_DOC_MAX, aiDoc, aiGenerateFromDoc } from "./document.js";
import { aiGeneratePack } from "./packgen.js";
import { aiReviewPack, aiReviewQuestions } from "./review.js";
import { parsePack } from "../data/packs.js";

reg({ setOf: () => setOf, setNames: () => setNames, addSetName: () => addSetName, KIND_TAG: () => KIND_TAG });
Object.assign(PG, { aiHub, aiGen });   // 页面跳转函数：core/nav.js 会包一层，记录返回路径
const ST = { msg: null, docMsg: null, lastSet: "" };   // 生成结果提示：生成过程中离开页面，回来还能看到

/* ---------- 题集：AI 题按自己起的名字分组（资料题默认用资料标题），可以新建、改名、删除、移动 ---------- */
export const setOf = q => q.set != null ? q.set : q.doc || "";
export const setNames = () => { const s = new Set((LS.get("aiSets", []) || []).filter(Boolean)); aiBank.forEach(q => { const n = setOf(q); if (n) s.add(n); }); return [...s].sort((a, b) => a.localeCompare(b, "zh")); };   // 按名字排序，移动题目后卡片不会跳位置
export const addSetName = n => { const l = (LS.get("aiSets", []) || []).filter(Boolean); if (n && !l.includes(n)) { l.push(n); LS.set("aiSets", l); } };
export const KIND_TAG = { multi: ["多选", "Multi"], tf: ["判断", "T/F"] };
const KIND_EN = { single: "Single answer", multi: "Multi-select", tf: "True / false", mix: "All three mixed" }, STYLE_EN = { direct: "Direct question", case: "Clinical scenario", mix: "Both, interleaved" };

/* ---------- 入口页：AI 出题 / AI 题库 两个板块 ---------- */
export function aiHub() {
  const P = AI_PROVIDERS[aiCfg.provider] || AI_PROVIDERS.custom, sets = setNames(), nDoc = aiBank.filter(q => q.doc).length;
  show(`<div class="sel-head"><div><div class="eyebrow">${TT("AI 专题", "AI")}</div><h2 style="font-size:28px">${TT("AI 出题专题", "AI questions")}</h2>
      <p style="color:var(--mute);margin:6px 0 0;max-width:68ch">${TT("用你自己的 API 密钥调用大模型出新题。左边生成题目，右边管理和练习已经生成的题。生成的题只存在这台设备上。", "Use your own API key to generate new questions. Generate on the left; manage and practise them on the right. Questions stay on this device.")}</p></div></div>
    <div class="modes ai-two">
      <button class="mode" data-go="gen"><span class="tag">${aiCfg.key ? esc(P.name) + " · " + esc(aiCfg.model || P.model || "") : TT("还没有设置密钥", "No API key yet")}</span><h3>${TT("AI 出题", "Generate")}</h3>
        <p>${TT("设置接口；按考试范围、错题或自选药物组出题；用自己的讲义出题；把讲义整理成题库扩展包。", "Set up the API; generate from your scope, mistakes or chosen groups; from your own notes; or turn notes into a question-bank pack.")}</p>
        <span class="ai-two-list"><span>${TT("① 接口设置", "① API")}</span><span>${TT("② 生成题目", "② Generate")}</span><span>${TT("③ 用自己的资料", "③ Own notes")}</span><span>${TT("④ 生成扩展包", "④ Packs")}</span></span>${decoSVG(8)}</button>
      <button class="mode" data-go="lib"><span class="tag">${TT(`${aiBank.length} 题 · ${sets.length} 个题集`, `${aiBank.length} questions · ${sets.length} sets`)}</span><h3>${TT("AI 题库", "AI question bank")}</h3>
        <p>${TT("练习生成的题；按自己起名的题集分组，批量移动、改名、删除；搜索题目。", "Practise generated questions; group them into your own sets, move in bulk, rename, delete; search.")}</p>
        <span class="ai-two-list">${sets.slice(0, 5).map(x => `<span>${esc(x)}</span>`).join("") || `<span>${TT("还没有题集", "No sets yet")}</span>`}${sets.length > 5 ? `<span>+${sets.length - 5}</span>` : ""}</span>${decoSVG(5)}</button></div>
    ${aiBank.length ? `<div class="ai-quick"><span>${TT("快速练习：", "Quick practice: ")}</span><button class="ibtn" data-q="all">${TT(`全部 ${aiBank.length} 题`, `All ${aiBank.length}`)}</button><button class="ibtn" data-q="new">${TT("最新 20 题", "Latest 20")}</button>${nDoc ? `<button class="ibtn" data-q="doc">${TT(`资料题 ${aiBank.filter(q => q.doc).length}`, `From notes ${aiBank.filter(q => q.doc).length}`)}</button>` : ""}</div>` : ""}`,
  () => {
    main.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { SFX.pick(); b.dataset.go === "gen" ? PG.aiGen() : PG.aiLibrary(); });
    main.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { SFX.pick(); const k = b.dataset.q; PG.startQuiz(null, { mode: "ai", title: "AI 出题", preset: k === "new" ? aiBank.slice(0, 20) : k === "doc" ? aiBank.filter(q => q.doc) : aiBank.slice() }); });
  });
}
/* ---------- AI 出题：接口设置、生成题目、用资料出题、生成扩展包 ---------- */
export function aiGen() {
  const P = AI_PROVIDERS[aiCfg.provider] || AI_PROVIDERS.custom, pd = poolDrugs(), hot = hotList();
  const g = cfg.ai || {}, focus = g.focus || "mix", n = g.n || 10, level = g.level || "base", src = g.src || "range";
  const kind = g.kind || "single", style = g.style || "direct", expL = g.exp || "brief", order = g.order || "rot", gids = new Set(g.gids || []);
  const wrongN = aiPool("wrong").length, packN = DR.filter(d => d.g.pack).length, pickN = aiPool("pick", [...gids]).length;
  const sets = setNames();
  const seg = (id, items, cur) => `<div class="seg" id="${id}">${items.map(([v, t]) => `<button data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
  show(`<div class="sel-head"><div><div class="eyebrow">AI 专题</div><h2 style="font-size:28px">AI 出题</h2>
      <p style="color:var(--mute);margin:6px 0 0;max-width:68ch">用你自己的 API 密钥调用大模型，根据题库里的药物资料出新题。生成的题只存在这台设备上，单独放在这里，不会混进其他板块。</p></div>
      <div class="sel-tools"><button class="btn ghost" id="toLib">${TT(`AI 题库 · ${aiBank.length} 题 →`, `AI bank · ${aiBank.length} →`)}</button></div></div>
    <div class="aibox"><h3>① 接口设置</h3>
      ${seg("aiProv", Object.entries(AI_PROVIDERS).map(([k, p]) => [k, p.name]), aiCfg.provider)}
      <p class="ai-note" id="aiProvNote">${esc(P.note)}</p>
      <div class="ai-form">
        <label>服务地址<input class="search" id="aiBase" value="${esc(aiCfg.base)}" placeholder="https://..." autocomplete="off" spellcheck="false"></label>
        <label>模型名<input class="search" id="aiModel" value="${esc(aiCfg.model)}" placeholder="模型名" autocomplete="off" spellcheck="false"></label>
        <label>API 密钥<span class="ai-keyrow"><input class="search" id="aiKey" type="password" value="${esc(aiCfg.key)}" placeholder="粘贴你的密钥" autocomplete="off" spellcheck="false"><button class="ibtn" id="aiEye" type="button">显示</button></span></label>
      </div>
      <div class="q-actions" style="justify-content:flex-start"><button class="btn" id="aiSaveBtn">保存设置</button><button class="btn ghost" id="aiTest">测试连接</button><span class="ai-status" id="aiCfgMsg"></span></div>
      <p class="ai-note">密钥只保存在这台设备的浏览器里，只会发给你选的服务；不要在别人的设备上保存密钥。调用费用由你自己的账号承担。在线版网页可能拦截外部请求，建议用离线版。</p></div>
    <div class="aibox"><h3>② 生成题目</h3>
      <div class="ai-row"><span>出题方向</span>${seg("aiFocus", Object.keys(AI_FOCUS).map(k => [k, AI_FOCUS_SHORT[k]]), focus)}</div>
      <div class="ai-row"><span>${TT("题型", "Question type")}</span>${seg("aiKind", Object.entries(AI_KIND).map(([k, v]) => [k, TT(v, KIND_EN[k])]), kind)}</div>
      <div class="ai-row"><span>${TT("题干风格", "Stem style")}</span>${seg("aiStyle", Object.entries(AI_STYLE).map(([k, v]) => [k, TT(v, STYLE_EN[k])]), style)}</div>
      <div class="ai-row"><span>每次生成</span>${seg("aiN", [[5, "5 题"], [10, "10 题"], [15, "15 题"], [20, "20 题"], [30, "30 题"]], n)}</div>
      <div class="ai-row"><span>难度</span>${seg("aiLevel", [["base", "基础"], ["hard", "进阶"], ["top", "冲刺"]], level)}</div>
      <div class="ai-row"><span>${TT("解析", "Explanations")}</span>${seg("aiExp", [["brief", TT("简洁", "Brief")], ["detail", TT("详细（逐项说明）", "Detailed (option by option)")]], expL)}</div>
      <div class="ai-row"><span>出题范围</span>${seg("aiSrc", [["range", `当前考试范围（${pd.length} 种）`], ["hot", `高频错误（${hot.length} 种）`], ["wrong", `错题本（${wrongN} 种）`], ...(packN ? [["pack", TT(`扩展包（${packN} 种）`, `Packs (${packN} drugs)`)]] : []), ["pick", TT("自选药物组", "Pick groups") + (gids.size ? TT(`（${pickN} 种）`, ` (${pickN} drugs)`) : "")]], src)}</div>
      <div class="ai-pick" id="aiPick" ${src === "pick" ? "" : "hidden"}><div class="ai-pick-h"><span>${TT("点选要出题的药物组", "Tap the groups to generate from")}（${TT("已选", "selected")} <b id="aiPickN">${gids.size}</b>）</span><button class="ibtn" id="aiPickNone" type="button">${TT("全不选", "Select none")}</button></div>
        <div class="ai-pick-l">${G.map(x => `<button class="chip" data-gid="${x.id}" aria-pressed="${gids.has(x.id)}"><span class="dot">${x.dot || x.id}</span>${esc(x.n)}${packTag(x)}</button>`).join("")}</div></div>
      <div class="ai-row"><span>${TT("挑药方式", "Drug picking")}</span>${seg("aiOrder", [["rot", TT("轮流（先挑没出过题的）", "Rotate (unused drugs first)")], ["rand", TT("完全随机", "Fully random")]], order)}</div>
      <div class="ai-row"><span>${TT("AI 自查", "AI self-check")}</span>${seg("aiCheck", [["off", TT("不自查", "No check")], ["on", TT("生成后自动自查", "Check after generating")]], g.check || "off")}</div>
      <p class="ai-note" style="margin-top:0">${TT("自查：生成后再让 AI 以审题老师的身份复核一遍（答案对不对、有没有歧义、知识点有没有错），有问题的题在 AI 题库里标出来；生成扩展包时会逐条列出修改建议。会多花一次调用费用。也可以之后在 AI 题库或扩展包预览里手动点“AI 自查”。", "Self-check: after generating, AI reviews the result as an examiner (is the answer right, any ambiguity, factual errors). Problem questions are flagged in the AI bank; for packs you get item-by-item suggestions. Costs one extra call. You can also run it later from the AI bank or the pack preview.")}</p>
      <div class="q-actions" style="justify-content:flex-start"><button class="btn" id="aiGo">开始生成</button><span class="ai-status" id="aiGenMsg"></span></div>
      <p class="ai-note">会轮流挑选还没出过 AI 题的药。格式不对或药物编号对不上的题会自动丢弃。</p>
      <p class="ai-note">${TT("题型、题干风格、难度和解析的设置，下面「用自己的资料出题」也会沿用。挑药方式选“完全随机”时不按轮流挑。", "Question type, stem style, difficulty and explanation settings also apply to “your own materials” below. “Fully random” skips the rotation.")}</p></div>
    <div class="aibox"><h3>③ 用自己的资料出题</h3>
      <p class="ai-note" style="margin-top:0">把讲义、笔记、课本段落粘贴进来，或者选一个 .txt / .md 文件（用 Claude 时也可以选 PDF）。只接受药理学资料，其他内容会被拒绝出题。题量和难度沿用上面的设置。</p>
      <div class="ai-form" style="grid-template-columns:1fr">
        <label>资料标题（可选）<input class="search" id="aiDocTitle" placeholder="例如：局麻药讲义第 3 章" autocomplete="off"></label>
        <label>${TT("存入题集（自己起名分组；不填就用资料标题）", "Save to question set (your own grouping; defaults to the title)")}<input class="search" id="aiDocSet" placeholder="${TT("例如：期中复习 · 局麻药", "e.g. Midterm · local anesthetics")}" autocomplete="off" maxlength="40" value="${esc(ST.lastSet || "")}"></label>
        ${sets.length ? `<div class="ai-setpick"><span>${TT("点一下选已有题集：", "Pick an existing set: ")}</span>${sets.map(x => `<button type="button" class="chip" data-pickset="${esc(x)}" aria-pressed="${x === ST.lastSet}">${esc(x)}</button>`).join("")}</div>` : ""}
        <label>资料内容<textarea class="search ai-doc" id="aiDocText" placeholder="在这里粘贴药理学资料…">${esc(aiDoc.text)}</textarea></label>
      </div>
      <div class="ai-row"><label class="ibtn ai-file">选择文件<input type="file" id="aiDocFile" accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf" hidden></label><span class="ai-note" id="aiDocInfo" style="margin:0">${aiDoc.pdf ? "已选 PDF：" + esc(aiDoc.name) : aiDoc.text ? aiDoc.text.length + " 字" : "还没有资料"}</span></div>
      <div class="q-actions" style="justify-content:flex-start"><button class="btn" id="aiDocGo">用资料出题</button><button class="btn ghost" id="aiDocPack" type="button">${TT("整理成药物组（可自己分组改名）", "Turn into drug groups (regroup & rename)")}</button><button class="ibtn" id="aiDocClear" type="button">清空资料</button><span class="ai-status" id="aiDocMsg"></span></div></div>
    <div class="aibox" id="aiPackBox"><h3>④ 生成题库扩展包（新的药物组）</h3>
      <p class="ai-note" style="margin-top:0">让 AI 把讲义整理成药物组（药名、机制、适应证、不良反应、区分要点），预览确认后并入题库，和内置分组一样参加所有玩法。题库里已有的药会自动跳过。 <b style="color:var(--rose)">AI 整理的内容可能有错</b>，并入后会标成「AI·未审核」，请对照讲义核对后再标为已审核。</p>
      <div class="ai-form" style="grid-template-columns:1fr"><label>主题（只按主题生成时必填，用资料时可选）<input class="search" id="aiPackTopic" placeholder="例如：抗真菌药、降压药、质子泵抑制剂" autocomplete="off"></label></div>
      <div class="q-actions" style="justify-content:flex-start"><button class="btn" id="aiPackDoc">用上面的资料生成</button><button class="btn ghost" id="aiPackTopicGo">只按主题生成</button><span class="ai-status" id="aiPackMsg"></span></div>
      <p class="ai-note">只按主题生成时，AI 凭教材常识整理，出错的可能更大，务必审核。生成后会打开扩展包面板，可以先修改再并入。</p></div>
    <div class="sec-h"><h2>AI 题库</h2><span>共 ${aiBank.length} 题</span><button class="ibtn sec-act" id="toLib2">${TT("打开 AI 题库 →", "Open AI bank →")}</button></div>
    ${aiBank.length ? "" : `<p style="color:var(--mute);margin-top:12px">还没有 AI 题目。填好密钥后点“开始生成”。</p>`}`,
  () => {
    const msg = (id, t, cls) => { const el = $("#" + id); if (el) { el.textContent = t; el.className = "ai-status" + (cls ? " " + cls : ""); } };
    const readForm = () => { aiCfg.base = $("#aiBase").value.trim(); aiCfg.model = $("#aiModel").value.trim(); aiCfg.key = $("#aiKey").value.trim(); };
    const pressed = (id, v) => $("#" + id).querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.v === String(v))));
    $("#aiProv").querySelectorAll("button").forEach(b => b.onclick = () => {
      readForm(); const k = b.dataset.v, p = AI_PROVIDERS[k]; aiCfg.provider = k;
      if (k !== "custom") { aiCfg.base = p.base; aiCfg.model = p.model; $("#aiBase").value = p.base; $("#aiModel").value = p.model; }
      $("#aiProvNote").textContent = p.note; pressed("aiProv", k); aiSave(); SFX.click();
    });
    $("#aiEye").onclick = () => { const k = $("#aiKey"); k.type = k.type === "password" ? "text" : "password"; $("#aiEye").textContent = k.type === "password" ? "显示" : "隐藏"; };
    ["aiBase", "aiModel", "aiKey"].forEach(id => $("#" + id).addEventListener("change", () => { readForm(); aiSave(); }));
    $("#aiSaveBtn").onclick = () => { readForm(); aiSave(); SFX.click(); msg("aiCfgMsg", "已保存", "ok"); };
    $("#aiTest").onclick = async () => {
      readForm(); aiSave(); const b = $("#aiTest"); b.disabled = true; msg("aiCfgMsg", "正在测试…");
      try { const t = await aiCall("你是接口测试助手。只输出 JSON。", '请原样输出这个 JSON：{"questions":[]}'); aiParse(t, [], "mix"); msg("aiCfgMsg", "连接成功，可以开始生成", "ok"); }
      catch (e) { msg("aiCfgMsg", e.message, "no"); }
      finally { if (b.isConnected) b.disabled = false; }
    };
    const setG = (k, v) => { cfg.ai = Object.assign({}, cfg.ai || {}, { [k]: v }); save(); };
    [["aiFocus", "focus", x => x], ["aiN", "n", Number], ["aiLevel", "level", x => x], ["aiSrc", "src", x => x], ["aiKind", "kind", x => x], ["aiStyle", "style", x => x], ["aiExp", "exp", x => x], ["aiOrder", "order", x => x], ["aiCheck", "check", x => x]].forEach(([id, k, cv]) =>
      $("#" + id).querySelectorAll("button").forEach(b => b.onclick = () => { setG(k, cv(b.dataset.v)); pressed(id, b.dataset.v); SFX.click(); if (id === "aiSrc") $("#aiPick").hidden = b.dataset.v !== "pick"; }));
    const pickRefresh = () => { const ids = (cfg.ai || {}).gids || []; $("#aiPickN").textContent = ids.length; const sb = $("#aiSrc").querySelector('[data-v="pick"]'); if (sb) sb.textContent = TT("自选药物组", "Pick groups") + (ids.length ? TT(`（${aiPool("pick", ids).length} 种）`, ` (${aiPool("pick", ids).length} drugs)`) : ""); };
    main.querySelectorAll("#aiPick [data-gid]").forEach(b => b.onclick = () => {
      const id = +b.dataset.gid, ids = new Set((cfg.ai || {}).gids || []); ids.has(id) ? ids.delete(id) : ids.add(id);
      setG("gids", [...ids]); b.setAttribute("aria-pressed", String(ids.has(id))); SFX.click(); pickRefresh();
    });
    $("#aiPickNone").onclick = () => { setG("gids", []); main.querySelectorAll("#aiPick [data-gid]").forEach(b => b.setAttribute("aria-pressed", "false")); SFX.click(); pickRefresh(); };
    /* 生成后自动自查：失败不影响已生成的题 */
    const selfCheck = async (ids, prog) => { try { const c = await aiReviewQuestions(ids, prog, 60); return `。AI 自查：${c.ok} 题没问题${c.fix ? `，${c.fix} 题答案可能标错` : ""}${c.bad ? `，${c.bad} 题建议删除` : ""}${c.fix || c.bad ? "（在 AI 题库里已标出）" : ""}`; } catch (e) { return "。自查没完成：" + e.message; } };
    const opts = () => { const c = cfg.ai || {}; return { kind: c.kind || "single", style: c.style || "direct", exp: c.exp || "brief", order: c.order || "rot", gids: c.gids || [] }; };
    if (ST.msg) { msg("aiGenMsg", ST.msg[0], ST.msg[1]); ST.msg = null; }
    if (aiBusy) { $("#aiGo").disabled = true; msg("aiGenMsg", "上一次生成还在进行中…"); }
    $("#aiGo").onclick = async () => {
      if (aiBusy) return; readForm(); aiSave();
      const G2 = cfg.ai || {}, b = $("#aiGo"); PG.aiBusy = true; b.disabled = true; SFX.pick();
      let result;
      try {
        const r = await aiGenerate(G2.n || 10, G2.focus || "mix", G2.level || "base", G2.src || "range", t => msg("aiGenMsg", t), opts());
        result = r.added ? [`生成了 ${r.added} 道题${r.bad ? `，另有 ${r.bad} 道格式不对已丢弃` : ""}`, "ok"] : [`没有得到可用的题${r.bad ? `（${r.bad} 道格式不对已丢弃）` : ""}，可以再试一次`, "no"];
        if (r.added && (cfg.ai || {}).check === "on") result[0] += await selfCheck(r.ids, t => msg("aiGenMsg", t));
        if (r.added) SFX.win();
      } catch (e) { result = [e.message, "no"]; SFX.wrong(); }
      finally { PG.aiBusy = false; }
      const top = PG.NAV[PG.NAV.length - 1];
      ST.msg = result;
      if (top && top.name === "aiGen") { const y = scrollY; PG.aiGen(); scrollTo(0, y); }
    };
    const docInfo = () => { $("#aiDocInfo").textContent = aiDoc.pdf ? "已选 PDF：" + aiDoc.name : aiDoc.text ? aiDoc.text.length + " 字" + (aiDoc.text.length > AI_DOC_MAX() ? `（超过 ${AI_DOC_MAX()} 字，只会用前面部分）` : "") : "还没有资料"; };
    $("#aiDocText").addEventListener("input", e => { aiDoc.text = e.target.value; aiDoc.pdf = null; try { LS.set("aiDocDraft", aiDoc.text.slice(0, 100000)); } catch (_) {} docInfo(); });
    $("#aiDocFile").addEventListener("change", e => {
      const f = e.target.files && e.target.files[0]; if (!f) return; const isPdf = /\.pdf$/i.test(f.name) || f.type === "application/pdf";
      if (f.size > 30 * 1024 * 1024) { msg("aiDocMsg", "文件太大（超过 30MB）", "no"); return; }
      const rd = new FileReader();
      rd.onload = () => {
        if (isPdf) { aiDoc.pdf = String(rd.result).split(",")[1] || ""; aiDoc.name = f.name; msg("aiDocMsg", (AI_PROVIDERS[aiCfg.provider] || {}).kind === "anthropic" ? "" : "PDF 只有 Claude 能直接读取，其他服务请粘贴文字", (AI_PROVIDERS[aiCfg.provider] || {}).kind === "anthropic" ? "" : "no"); }
        else { aiDoc.text = String(rd.result || ""); aiDoc.pdf = null; aiDoc.name = f.name; $("#aiDocText").value = aiDoc.text; try { LS.set("aiDocDraft", aiDoc.text.slice(0, 100000)); } catch (_) {} msg("aiDocMsg", ""); }
        if (!$("#aiDocTitle").value) $("#aiDocTitle").value = f.name.replace(/\.[^.]+$/, "");
        docInfo();
      };
      rd.onerror = () => msg("aiDocMsg", "读取文件失败", "no");
      isPdf ? rd.readAsDataURL(f) : rd.readAsText(f);
    });
    $("#aiDocClear").onclick = () => { PG.aiDoc = { text: "", name: "", pdf: null }; $("#aiDocText").value = ""; $("#aiDocFile").value = ""; LS.set("aiDocDraft", ""); docInfo(); msg("aiDocMsg", ""); };
    $("#aiDocGo").onclick = async () => {
      if (aiBusy) return; readForm(); aiSave();
      const G2 = cfg.ai || {}, b = $("#aiDocGo"), title = $("#aiDocTitle").value.trim(), setName = $("#aiDocSet").value.trim().slice(0, 40); PG.aiBusy = true; b.disabled = true; SFX.pick();
      ST.lastSet = setName; if (setName) addSetName(setName);
      let result;
      try {
        const r = await aiGenerateFromDoc(G2.n || 10, G2.level || "base", title, t => msg("aiDocMsg", t), opts());
        if (setName && r.ids) { const ids = new Set(r.ids); PG.aiBank = PG.aiBank.map(q => ids.has(q.id) ? { ...q, set: setName } : q); aiSave(); }
        const ck = r.added && (cfg.ai || {}).check === "on" ? await selfCheck(r.ids, t => msg("aiDocMsg", t)) : "";
        result = r.added ? [`用资料生成了 ${r.added} 道题${r.bad ? `，另有 ${r.bad} 道格式不对已丢弃` : ""}${r.note ? "。" + r.note : ""}${ck}`, "ok"] : [`没有得到可用的题${r.bad ? `（${r.bad} 道格式不对已丢弃）` : ""}${r.note ? "。" + r.note : ""}`, "no"];
        if (r.added) SFX.win();
      } catch (e) { result = [e.message, "no"]; SFX.wrong(); }
      finally { PG.aiBusy = false; }
      const top = PG.NAV[PG.NAV.length - 1];
      ST.docMsg = result;
      if (top && top.name === "aiGen") { const y = scrollY; PG.aiGen(); scrollTo(0, y); }
    };
    if (ST.docMsg) { msg("aiDocMsg", ST.docMsg[0], ST.docMsg[1]); ST.docMsg = null; }
    if (aiBusy) $("#aiDocGo").disabled = true;
    const packGo = async fromDoc => {
      if (aiBusy) return; readForm(); aiSave();
      const topic = $("#aiPackTopic").value.trim(); PG.aiBusy = true; ["aiPackDoc", "aiPackTopicGo"].forEach(id => { $("#" + id).disabled = true; }); SFX.pick();
      try {
        const r = await aiGeneratePack(topic, fromDoc, t => msg("aiPackMsg", t));
        const p = parsePack(r.raw, topic || "AI 扩展包");
        let review = null;
        if ((cfg.ai || {}).check === "on" && p.list.length === 1) { try { review = await aiReviewPack(p.list[0], t => msg("aiPackMsg", t)); } catch (e) { review = { error: e.message }; } }
        msg("aiPackMsg", "生成好了，请在扩展包面板里预览" + (review && !review.error ? `，AI 自查提出 ${review.issues.length} 条意见` : "") + (r.note ? "。" + r.note : ""), "ok"); SFX.win();
        PG.packPreview(p.list, p.warn, { ai: true, by: r.by, raw: r.raw, review });
      } catch (e) { msg("aiPackMsg", e.message, "no"); SFX.wrong(); }
      finally { PG.aiBusy = false; ["aiPackDoc", "aiPackTopicGo"].forEach(id => { const b = $("#" + id); if (b) b.disabled = false; }); }
    };
    $("#aiPackDoc").onclick = () => packGo(true);
    $("#aiDocPack").onclick = () => { const t = $("#aiDocTitle").value.trim(); if (t && !$("#aiPackTopic").value.trim()) $("#aiPackTopic").value = t; packGo(true); };
    $("#aiPackTopicGo").onclick = () => packGo(false);
    if (aiBusy) ["aiPackDoc", "aiPackTopicGo"].forEach(id => { $("#" + id).disabled = true; });
    ["toLib", "toLib2"].forEach(id => { const b = $("#" + id); if (b) b.onclick = () => { SFX.pick(); PG.aiLibrary(); }; });
    main.querySelectorAll("[data-pickset]").forEach(b => b.onclick = () => { const v = b.dataset.pickset, inp = $("#aiDocSet"); inp.value = inp.value === v ? "" : v; main.querySelectorAll("[data-pickset]").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.pickset === inp.value))); SFX.click(); });
    $("#aiDocSet").addEventListener("input", e => main.querySelectorAll("[data-pickset]").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.pickset === e.target.value.trim()))));
  });
}
