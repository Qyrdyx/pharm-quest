/* 药理闯关 · 中英切换
 * 语言保存在 localStorage 的 pg_lang（"zh" / "en"），切换时刷新页面。
 * 英文模式：
 *   1. 题库数据里的中文字符串按 I18N_DATA 换成英文（药物中文名保留在 d.zh，供“中文名”相关题型使用）；
 *   2. 页面渲染后，按 I18N_UI 把界面中文换成英文（带 data-zh 的元素保持中文，如默写题面）；
 *   3. 剩下的中文标点换成英文标点。
 * 中文模式什么都不做，界面与原来完全一致。
 */
(function () {
  // 语言优先看网址里的 #pg-lang=（切换时写进去，防止某些浏览器刷新后读到旧的本地存储），其次看本地存储
  let lang = "zh";
  const fromHash = /[#&]pg-lang=(zh|en)(?![a-z])/.exec(location.hash);
  if (fromHash) {
    lang = fromHash[1];
    try { localStorage.setItem("pg_lang", JSON.stringify(lang)); } catch (e) {}
    try { history.replaceState(null, "", location.href.replace(/#.*$/, "")); } catch (e) {}
  } else { try { lang = JSON.parse(localStorage.getItem("pg_lang")) === "en" ? "en" : "zh"; } catch (e) {} }
  window.LANG = lang;
  window.T = (zh, en) => lang === "en" ? en : zh;
  let switching = false;
  window.setLang = l => {
    if (switching) return; switching = true;
    setTimeout(() => { switching = false; }, 4000);
    try { localStorage.setItem("pg_lang", JSON.stringify(l)); localStorage.setItem("pg_langSwitch", JSON.stringify((JSON.parse(localStorage.getItem("pg_langSwitch") || "0") || 0) + 1)); } catch (e) {}   // 切换次数（彩蛋成就“反复横跳”）
    const url = location.href.replace(/#.*$/, "") + "#pg-lang=" + l;
    try { history.replaceState(null, "", url); } catch (e) { try { location.hash = "pg-lang=" + l; } catch (_) {} }
    try { location.reload(); } catch (e) { location.href = url; }
  };
  if (lang !== "en") return;
  document.documentElement.lang = "en";

  /* ---------- 1. 数据 ---------- */
  const D = window.I18N_DATA || {}, P = window.PHARM;
  const cnToEn = new Map();
  if (P) P.groups.forEach(g => g.drugs.forEach(d => cnToEn.set(d[2], d[1].replace(/\s*\(.*\)\s*$/, ""))));
  const tr = s => typeof s !== "string" ? s : (D[s] ?? cnToEn.get(s) ?? s);
  const walk = v => {
    if (typeof v === "string") return tr(v);
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = walk(v[i]); return v; }
    if (v && typeof v === "object") { for (const k of Object.keys(v)) v[k] = walk(v[k]); return v; }
    return v;
  };
  if (P) {
    P.chapters.forEach(c => { c[1] = tr(c[1]); });
    P.groups.forEach(g => {
      for (const k of Object.keys(g)) if (k !== "drugs") g[k] = walk(g[k]);
      g.drugs.forEach(d => { d[3] = tr(d[3]); });     // 区分要点翻译，药物中文名 d[2] 保留
    });
  }
  ["FACTS", "PAIRS", "CLASSES", "CASES"].forEach(k => { if (window[k]) walk(window[k]); });

  /* ---------- 2. 界面 ---------- */
  const U = Object.assign({}, window.I18N_UI || {});
  if (P) P.groups.forEach(g => g.drugs.forEach(d => { delete U[d[2]]; }));   // 药物中文名永远不翻译（默写、中英配对要用）
  const PUNCT = { "，": ", ", "、": ", ", "；": "; ", "：": ": ", "。": ". ", "？": "? ", "！": "! ", "（": " (", "）": ") ", "「": "'", "」": "'", "“": "\"", "”": "\"", "‘": "'", "’": "'", "《": "'", "》": "'", "【": "[", "】": "]", "～": "~", "…": "…", "＞": ">", "／": "/", "＋": "+", "　": " " };
  const CJ = "\\u3400-\\u9fff\\u3000-\\u303f\\uff00-\\uffef“”‘’…·—";
  const SPAN = new RegExp(`[${CJ}][^<>\`"'{}$\\n]*[${CJ}]|[\\u3400-\\u9fff]`, "g");
  const RUN = new RegExp(`[${CJ}]+`, "g");
  const HAS = /[㐀-鿿　-〿＀-￯“”]/;
  function translateText(t) {
    if (!HAS.test(t)) return t;
    const whole = t.trim();
    if (U[whole] !== undefined) return t.replace(whole, U[whole]);
    const P0 = /^[，、；：。？！（）「」“”·—\s]+/, P1 = /[，、；：。？！（）「」“”·—\s]+$/;
    const look = r => {                       // 一段纯中文：整段查，查不到就去掉首尾标点再查
      if (U[r] !== undefined) return U[r];
      const core = r.replace(P0, "").replace(P1, "");
      return core && U[core] !== undefined ? r.replace(core, U[core]) : r;
    };
    let out = t.replace(SPAN, s => {
      const k = s.trim();
      if (U[k] !== undefined) return s.replace(k, U[k]);
      return s.replace(RUN, look);            // 整段没有，就按纯中文小段逐个查
    });
    out = out.replace(/[，、；：。？！（）「」“”‘’《》【】～＞／＋　]/g, c => PUNCT[c] ?? c);
    return out.replace(/ {2,}/g, " ").replace(/ ([,.;:?!)])/g, "$1").replace(/\( /g, "(");
  }
  const KEEP = "[data-zh], script, style, textarea, input, code";
  function translateTree(root) {
    if (!root) return;
    if (root.nodeType === 3) { const p = root.parentElement; if (p && !p.closest(KEEP)) { const n = translateText(root.nodeValue); if (n !== root.nodeValue) root.nodeValue = n; } return; }
    if (root.nodeType !== 1 || root.closest?.(KEEP)) return;
    ["placeholder", "title", "aria-label"].forEach(a => { const v = root.getAttribute?.(a); if (v && HAS.test(v)) { const n = translateText(v); if (n !== v) root.setAttribute(a, n); } });
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: n => n.nodeType === 1 ? (n.matches(KEEP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP) : NodeFilter.FILTER_ACCEPT
    });
    const texts = []; let n; while ((n = w.nextNode())) texts.push(n);
    texts.forEach(t => { const v = translateText(t.nodeValue); if (v !== t.nodeValue) t.nodeValue = v; });
    root.querySelectorAll?.("[placeholder],[title],[aria-label]").forEach(el => { if (el.closest(KEEP) && !el.matches("input,textarea")) return; ["placeholder", "title", "aria-label"].forEach(a => { const v = el.getAttribute(a); if (v && HAS.test(v)) { const n = translateText(v); if (n !== v) el.setAttribute(a, n); } }); });
  }
  /* 属性只在翻译结果真的不同时才写回：写回会再触发 MutationObserver，译不了的中文（如扩展包里的药名）原样写回会无限循环卡死页面 */
  window.translateText = translateText;
  window.translateTree = translateTree;
  const start = () => {
    document.title = translateText(document.title);
    translateTree(document.body);
    new MutationObserver(ms => ms.forEach(m => {
      if (m.type === "characterData") translateTree(m.target);
      else { m.addedNodes.forEach(translateTree); if (m.type === "attributes") translateTree(m.target); }
    })).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title", "aria-label"] });
  };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
