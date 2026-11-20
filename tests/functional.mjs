// 功能测试：在构建好的版本上跑关键流程，并和拆分前对比音乐渲染与页面截图
// 用法：先 npm run dev 和 npm run build，再 node tests/functional.mjs [dist|offline|src]
import fs from "fs"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url"; import { launch } from "./cdp.mjs"; import { pxdiff } from "./pxdiff.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = process.argv[2] || "dist";
const URLS = { legacy: pathToFileURL(path.join(ROOT, "legacy/pharm-game-before-split/offline/药理闯关-离线版.html")).href, src: "http://localhost:5181/", dist: "http://localhost:5181/dist/index.html", offline: pathToFileURL(path.join(ROOT, "dist/offline/药理闯关-离线版.html")).href };
const SEED = `(() => { let s = 777; Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; window.requestAnimationFrame = () => 0; try { if (!sessionStorage.getItem("t_seeded")) { localStorage.clear(); sessionStorage.setItem("t_seeded", 1); } } catch (e) {} })();`;
const wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (cond, msg) => { console.log((cond ? "  ✓ " : "  ✗ ") + msg); if (!cond) fails++; };

async function open(which, w = 820, h = 1180, port = 9380) {
  const c = await launch(port, w, h);
  await c.send("Page.enable"); await c.send("Runtime.enable");
  c.errs = []; c.on("Runtime.exceptionThrown", p => c.errs.push((p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text).split("\n")[0]));
  await c.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 900 });
  await c.send("Emulation.setTouchEmulationEnabled", { enabled: w < 900, maxTouchPoints: 5 });
  await c.send("Page.addScriptToEvaluateOnNewDocument", { source: SEED });
  await c.send("Page.navigate", { url: URLS[which] });
  c.ev = async e => { const r = await c.send("Runtime.evaluate", { expression: `(async () => { const A = window.PG || window; return (${e}); })()`, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(e.slice(0, 60) + " → " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").split("\n")[0]); return r.result.value; };
  for (let i = 0; i < 100 && !(await c.ev('!!document.querySelector(".hero")').catch(() => false)); i++) await wait(150);
  c.shot = async () => (await c.send("Page.captureScreenshot", { format: "png" })).data;
  return c;
}

/* 1. 音乐：曲目表一致，每首渲染 8 秒的响度和拆分前完全相同 */
console.log("音乐");
const RENDER = `(async () => { const P0 = window.PG, AUx = P0 ? P0.AU : eval("AU"), TRx = P0 ? P0.TRACKS : eval("TRACKS"); (P0 || window).ensureAudio(); const out = [];
  for (const tr of TRx) { const SR = 16000, dur = 8, d = 60 / tr.bpm / 4, oc = new OfflineAudioContext(1, SR * dur, SR), real = AUx.ctx; AUx.ctx = oc;
    const g = oc.createGain(); g.gain.value = (tr.gain || 1) * 0.5; g.connect(oc.destination); let t = 0, k = 0;
    try { while (t < dur) { tr.play(k % tr.len, t, d, g); t += d; k++; } } finally { AUx.ctx = real; }
    const x = (await oc.startRendering()).getChannelData(0); let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i];
    out.push([tr.name, +(10 * Math.log10(s / x.length + 1e-12)).toFixed(2)]); }
  return out; })()`;
for (const which of ["legacy", TARGET]) {   // 渲染前先等首页吉祥物的随机台词定时器跑完
  const c = await open(which); await wait(700); globalThis[which === "legacy" ? "LEG" : "NEW"] = await c.ev(RENDER); c.close(); await wait(800);
}
// 2026-11-18 下架了有版权 / 版权待确认的曲目（转成歌曲 JSON 放桌面），拆分前的版本里还有，比对时去掉
const REMOVED_TRACKS = new Set(["莫斯科郊外的晚上", "北京 · 燕京（游京）", "琵琶行", "琵琶行 · 钢琴", "喀秋莎", "星光下的梦想"]);
globalThis.LEG = LEG.filter(x => !REMOVED_TRACKS.has(x[0]));
ok(JSON.stringify(LEG.map(x => x[0])) === JSON.stringify(NEW.map(x => x[0])), `曲目表一致（${NEW.length} 首）`);
const diffT = NEW.filter((x, i) => Math.abs(x[1] - LEG[i][1]) > 0.01);
ok(!diffT.length, diffT.length ? "响度不同：" + diffT.map(x => x[0]).join("、") : "每首 8 秒渲染响度与拆分前一致");

/* 2. 关键流程 */
console.log("流程");
const c = await open(TARGET);
await c.ev("A.startMusic(), 1"); await wait(600);
ok(await c.ev("A.AU.playing && !!A.AU.timer"), "背景音乐能播放");
await c.ev("A.stopMusic(), 1");
// 连线：干扰项、记不清揭晓
await c.ev("A.startMatch({ kind: 'mia' }), 1"); await wait(200);
ok(await c.ev("document.querySelectorAll('#colm .tile[data-decoy]').length === 2"), "三合一连线每列 2 个干扰项");
ok(await c.ev(`(() => { const L = document.querySelector('#colL .tile'), no = L.dataset.no; document.querySelector('#mforget').click(); L.click(); document.querySelector('#mforget').click();
  return [...document.querySelectorAll('#mgrid .tile[data-no="' + no + '"]')].every(x => x.classList.contains('done')); })()`), "连线“记不清”后该药全部揭晓并退出本轮");
ok(await c.ev("Object.keys(A.mwrong).length === 3"), "记不清的药记进连线错题本（3 项）");
await c.ev("A.endMatch(), 1"); await wait(300);
ok(await c.ev("!!document.querySelector('.result') && /本轮已考/.test(document.querySelector('.result .meta').innerText)"), "连线结算页显示本轮进度");
// 返回键：进入图鉴 → 掌握度 → 返回
await c.ev("A.home(), A.codex('dex'), A.codex('mastery'), 1");
await c.ev("document.querySelector('#backBtn').click(), 1"); await wait(100);
ok(await c.ev("document.querySelector('.hero') !== null || document.querySelector('.tab[aria-selected=true]')?.dataset.tab === 'dex'"), "返回键回到上一页");
// 选择题记不清
await c.ev("A.cfg.lives = 3, A.startQuiz(), 1"); await wait(200);
await c.ev("document.querySelector('#dunno').click(), 1");
ok(await c.ev("A.Q.lives === 3 && A.Q.wrongs.length === 1"), "选择题“记不清”：不扣命、记错题");
await c.ev("A.endQuiz(), A.cfg.lives = 0, 1");
// 备份 → 清空 → 恢复
await c.ev("A.home(), A.backupSheet(), document.querySelector('#bkExp').click(), 1"); await wait(150);
const json = await c.ev("document.querySelector('#ioTxt').value");
ok(JSON.parse(json).type === "full" && Object.keys(JSON.parse(json).data).includes("pg_mwrong"), "完整备份包含连线错题");
await c.ev("localStorage.clear(), 1"); await c.send("Page.reload"); await wait(1500);
await c.ev(`A.backupSheet(), document.querySelector('#bkImp').click(), document.querySelector('#ioTxt').value = ${JSON.stringify(json)}, document.querySelector('#ioGo').click(), 1`);
await c.ev("document.querySelector('#ioRestore').click(), 1").catch(() => {}); await wait(1500);
 for (let i = 0; i < 60 && !(await c.ev('!!window.PG || !!window.home').catch(() => false)); i++) await wait(200); await wait(500);
ok(await c.ev("Object.keys(A.mwrong).length === 3"), "从备份恢复后连线错题回来了");
// 题库扩展包：导入示例 → 刷新后进题库、出题没有空选项 → 删除后恢复原样
const waitPG = async () => { await wait(1500); for (let i = 0; i < 60 && !(await c.ev("!!window.PG && !!PG.G").catch(() => false)); i++) await wait(200); await wait(300); };
await c.ev("A.packSheet(), document.querySelector('#pkSample').click(), document.querySelector('#pkGo').click(), 1"); await wait(200);
await c.ev("document.querySelector('#pkInstall').click(), 1").catch(() => {}); await waitPG();
ok(await c.ev("A.G.filter(g => g.pack).length === 2 && A.DR.filter(d => d.g.pack).length === 4 && A.G.filter(g => g.pack).every(g => A.sel.has(g.id))"), "扩展包示例并入：2 组 4 种药，已加进考试范围");
ok(await c.ev(`(() => { const ts = Object.keys(A.TYPES); return A.DR.every(d => { for (let k = 0; k < (d.g.pack ? 60 : 3); k++) { const q = A.makeQuestion(d, ts); if (q.options.some(o => !String(o).trim()) || new Set(q.options).size !== q.options.length) return false; } return true; }); })()`), "并入扩展包后各题型出题都没有空选项或重复选项");
await c.ev("(() => { const d = A.DR.find(x => x.g.pack); A.wrong[d.no] = 2; A.save(); A.packSheet(); const b = document.querySelector('.pk-item [data-del]'); b.click(); b.click(); return 1; })()").catch(() => {}); await waitPG();
ok(await c.ev("A.G.filter(g => g.pack).length === 0 && A.packs().length === 0 && !Object.keys(A.wrong).some(k => +k > 10000)"), "删除扩展包后题库恢复原样，错题记录一起清掉");
// 英文切换按钮存在、设置能打开
await c.ev("A.settings(), 1");
ok(await c.ev("!!document.querySelector('#pmode') && !!document.querySelector('#bkOpen')"), "设置面板：播放模式、备份入口都在");
ok(!c.errs.length, "流程中没有脚本报错" + (c.errs.length ? "：" + c.errs.join(" | ") : ""));
c.close(); await wait(800);

/* 3. 截图对比：iPad 和手机尺寸下，各页面像素级一致 */
console.log("截图（与拆分前逐像素比对）");
const PAGES = [["首页", "A.home()"], ["专项板块", "A.topicHub('core')"], ["错题专练", "A.hotHub()"], ["设置", "A.settings()"], ["病例列表", "A.caseMenu()"]];
for (const [w, h, dev] of [[820, 1180, "iPad"], [390, 844, "手机"]]) {
  const shots = {};
  for (const which of ["legacy", TARGET]) {
    const d = await open(which, w, h, 9390);
    // 让画面稳定：关掉省电动画计时器（它按自己的时钟推进动画）、背景分子、过渡效果，只保留静态样式
    await d.ev("((window.PG ? PG.cfg : eval(\"cfg\")).eco = 0, (window.PG ? PG.applyEco : eval(\"applyEco\"))(), document.body.classList.add('eco', 'eco-deco', 'eco-holo'), document.getElementById('bg').style.visibility = 'hidden', document.head.insertAdjacentHTML('beforeend', '<style>*,*::before,*::after{transition:none!important}</style>'), 1)");
    shots[which] = [];
    for (const [, js] of PAGES) {
      await d.ev(`(${js}, 1)`);
      await wait(500);
      await d.ev("document.fonts.ready.then(() => 1)");   // 等网络字体加载完
      await wait(200);
      // 吉祥物台词气泡按定时器出现 / 消失；循环动画停在第 0 帧，一次性动画直接放完
      // 拆分后有意新加的入口（导入歌曲、题库扩展包、首页扩展包板块、速记速查、出错记录），以及曲目列表（2026-11-18 下架了几首有版权的歌，列表变短）：截图前去掉，其余部分仍逐像素比对
      await d.ev("(document.querySelectorAll('#songImp,#pkSec,#fxSec,#errSec,#ecoSec,#rockHome,#rxSec,#rxHome,#fbHome,#pkHome,#fcTool,#achTool,.trk-group').forEach(e => e.remove()), document.querySelector('#fcQuick')?.parentElement.remove(), document.querySelector('.home-tools')?.classList.remove('five'), 1)");
      // 手机尺寸：拆分前的版本顶栏在有“返回”按钮的页面会把页面撑宽 25px（已修复），顶栏不参与逐像素比对，比对下面的内容
      await d.ev("(innerWidth < 500 && document.querySelector('.topbar')?.remove(), 1)"); await wait(100);
      await d.ev(`(document.querySelectorAll('.mascot').forEach(m => { clearTimeout(m._t); m.setAttribute('data-mood', 'idle'); m.querySelector('.bubble')?.remove(); }),
        document.getAnimations().forEach(a => { const it = a.effect && a.effect.getTiming().iterations; if (it === Infinity) { a.pause(); a.currentTime = 0; } else a.finish(); }), 1)`);
      await wait(150);
      shots[which].push(await d.shot());
    }
    d.close(); await wait(800);
  }
  for (const [i, [n]] of PAGES.entries()) {
    const d = await pxdiff(shots.legacy[i], shots[TARGET][i]), same = d.n < 0.001 * 820 * 1180;   // 允许极少量抗锯齿噪点（千分之一以内）
    if (!same) { fs.writeFileSync(path.join(ROOT, "tests", `_diff_${dev}_${n}_${TARGET}.png`), Buffer.from(shots[TARGET][i], "base64")); fs.writeFileSync(path.join(ROOT, "tests", `_diff_${dev}_${n}_legacy.png`), Buffer.from(shots.legacy[i], "base64")); }
    ok(same, `${dev} · ${n}` + (same ? "" : `（${d.n} 个像素不同，范围 ${d.box}）`));
  }
}
console.log(fails ? `\n${fails} 项不通过` : "\n全部通过");
process.exit(fails ? 1 : 0);
