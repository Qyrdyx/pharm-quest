// 对照测试：同样的随机种子下，拆分前（legacy）和拆分后（src 模块 / dist 打包 / 离线单文件）逐个页面比对界面文字
// 用法：先 npm run dev，再 node tests/parity.mjs [zh|en] [src|dist|offline]
import fs from "fs"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url"; import { launch } from "./cdp.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANG = process.argv[2] || "zh", TARGET = process.argv[3] || "src";
const URLS = { legacy: pathToFileURL(path.join(ROOT, "legacy/pharm-game-before-split/offline/药理闯关-离线版.html")).href, src: "http://localhost:5181/", dist: "http://localhost:5181/dist/index.html", offline: pathToFileURL(path.join(ROOT, "dist/offline/药理闯关-离线版.html")).href };
// 固定随机数和时间，让两边出的题、台词完全一样
const SEED = `(() => { let s = 12345; Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  window.requestAnimationFrame = () => 0;   // 动画循环（心电图抖动、粒子）每帧都会用随机数，帧数不固定会打乱随机序列；对比文字不需要动画
  try { localStorage.clear(); localStorage.setItem("pg_lang", JSON.stringify("${LANG}")); } catch (e) {} })();`;
/* 拆分之后有意新加的界面内容：比对前从新版本里去掉这些整行（只容忍“新增”，旧内容变了照样报错）。
   以后再有意加新内容：用 SHOW_ADDED=1 node tests/parity.mjs zh dist 看多出来哪些行，确认后加到这里。 */
const ADDED_OK = new Set([
  // 导入歌曲（设置）
  "＋ 导入歌曲（JSON）", "+ Import songs (JSON)",
  // 题库扩展包：选择范围按钮、设置入口
  "＋ 题库扩展包", "+ Question-bank packs", "题库扩展包", "Question-bank packs", "导入自己或同学整理的药物组，也可以用 AI 根据讲义生成。", "Import drug groups written by you or friends, or generate them with AI from your notes.", "管理题库扩展包", "Manage packs",
  // AI 出题 ④
  "④ 生成题库扩展包（新的药物组）", "让 AI 把讲义整理成药物组（药名、机制、适应证、不良反应、区分要点），预览确认后并入题库，和内置分组一样参加所有玩法。题库里已有的药会自动跳过。 AI 整理的内容可能有错，并入后会标成「AI·未审核」，请对照讲义核对后再标为已审核。",
  "主题（只按主题生成时必填，用资料时可选）", "用上面的资料生成", "只按主题生成", "只按主题生成时，AI 凭教材常识整理，出错的可能更大，务必审核。生成后会打开扩展包面板，可以先修改再并入。",
  "④ Generate a question-bank pack (new drug groups)", "Let AI turn your notes into drug groups (names, mechanisms, indications, adverse effects, distinguishing points). Preview, then add them to the bank; they join every game mode like built-in groups. Drugs already in the bank are skipped automatically. AI-organized content may contain errors; added groups are marked \"AI · unreviewed\" until you check them against your notes and mark them reviewed.",
  "Topic (required for topic-only, optional with notes)", "Generate from the notes above", "Generate from topic only", "Topic-only generation relies on textbook knowledge and is more error-prone — always review. The pack panel opens afterwards so you can edit before adding."
,
  // 首页题库扩展包板块、速记速查入口（首页工具、图鉴标签、专项板块按钮）
  "自己 DIY 药物组，或让 AI 根据讲义整理", "扩展包是自己或同学整理的药物组。并入后成为新的一章，和内置分组一样参加查房问答、分拣、连线、默写、同类辨析、速记卡片、图鉴、热力图和错题本。AI 生成的组会一直标着「AI·未审核」，核对后再标为已审核。", "✎ 可视化新建", "导入 / 管理", "AI 生成", "还没有扩展包。可以用可视化编辑器一格一格填，也可以导入同学发来的 JSON 文件。", "速记速查", "机制·适应证·不良反应，可遮住自测", "速记速查 →",
  "DIY drug groups, or let AI build them from notes", "Packs are drug groups written by you or friends. Once added they become a new chapter and join every mode like built-in groups. AI-generated groups stay marked \"AI · unreviewed\" until you check them.", "✎ New in editor", "Import / manage", "Generate with AI", "No packs yet. Fill one in with the visual editor, or import a JSON file from a friend.", "Flashcard sheet", "Cover & reveal self-test", "Flashcard sheet →",
  // AI 出题 ② 新增的可选项、③ 题集
  "题型", "单选", "多选", "判断", "题干风格", "直接提问", "临床情境", "三种混合", "两种穿插", "15 题", "30 题", "冲刺", "解析", "简洁", "详细（逐项说明）", "错题本（0 种）", "自选药物组", "挑药方式", "轮流（先挑没出过题的）", "完全随机", "题型、题干风格、难度和解析的设置，下面「用自己的资料出题」也会沿用。挑药方式选“完全随机”时不按轮流挑。", "存入题集（自己起名分组；不填就用资料标题）", "整理成药物组（可自己分组改名）",
  "Question type", "Single answer", "Multi-select", "True / false", "Stem style", "Direct question", "Clinical scenario", "All three mixed", "Both, interleaved", "15 Qs", "30 Qs", "Sprint", "Explanations", "Brief", "Detailed (option by option)", "Mistake book (0 drugs)", "Pick groups", "Drug picking", "Rotate (unused drugs first)", "Fully random", "Question type, stem style, difficulty and explanation settings also apply to \"your own materials\" below. \"Fully random\" skips the rotation.", "Save to question set (your own grouping; defaults to the title)", "Turn into drug groups (regroup & rename)"
,
  // AI 出题页：去 AI 题库的按钮、AI 自查选项（AI 题库拆成独立页面）
  "AI 题库 · 0 题 →", "AI 自查", "不自查", "生成后自动自查", "自查：生成后再让 AI 以审题老师的身份复核一遍（答案对不对、有没有歧义、知识点有没有错），有问题的题在 AI 题库里标出来；生成扩展包时会逐条列出修改建议。会多花一次调用费用。也可以之后在 AI 题库或扩展包预览里手动点“AI 自查”。", "打开 AI 题库 →",
  "AI bank · 0 →", "AI self-check", "No check", "Check after generating", "Self-check: after generating, AI reviews the result as an examiner (is the answer right, any ambiguity, factual errors). Problem questions are flagged in the AI bank; for packs you get item-by-item suggestions. Costs one extra call. You can also run it later from the AI bank or the pack preview.", "Open AI bank →"
,
  // 首页“成就与收集”入口（共 59 个；对照流程跑完几局后解锁 1～4 个，和时间、答题快慢有关，比如“夜班医生”“手速超过脑速”）
  "成就与收集", "成就 0/59 · 闪卡 0", "成就 1/59 · 闪卡 0", "成就 2/59 · 闪卡 0", "成就 3/59 · 闪卡 0", "成就 4/59 · 闪卡 0", "Achievements", "0/59 · 0 shiny", "1/59 · 0 shiny", "2/59 · 0 shiny", "3/59 · 0 shiny", "4/59 · 0 shiny"
,
  // 设置：连击特效强度、成就与收集开关
  "测试版", "ROCK DOCTOR · 节奏挑战", "摇滚医生", "踩着鼓点把药丸放进正确的药物组抽屉。真鼓、真吉他，连击越高，乐队越完整。", "复苏简单", "强心剂普通", "电除颤困难", "开始演奏", "Beta", "ROCK DOCTOR · RHYTHM CHALLENGE", "Rock Doctor", "Drop each pill into the right drug-group drawer on the beat. Real drums and guitars — the higher your combo, the fuller the band.", "ReviveEasy", "AdrenalineNormal", "DefibrillatorHard", "Start playing", "›",
  // 处方书写、意见反馈栏目
  "处方书写", "按俄罗斯标准写拉丁文处方", "25 种常用药 · 片 / 胶囊 / 注射液 / 溶液 / 软膏", "处方书写练习", "Rp.、D. t. d. N.、S. 一行一行写对：拉丁文第二格、逗号小数、写清用法；还有处方找错和写法速查。", "意见反馈", "报错、提建议，直接发给作者", "✉", "给作者发意见 / 报错", "一键整理出错记录和错题，发邮件到 qyrdyx1@gmail.com", "Prescription writing", "Latin prescriptions, Russian style", "25 common drugs · tablets / capsules / injections / solutions / ointments", "Prescription practice", "Get Rp., D. t. d. N. and S. right line by line — Latin genitive, decimal commas, clear directions — plus spot-the-mistake and a quick reference.", "Feedback", "Bugs and ideas, straight to the author", "Send feedback or a bug report", "Bundle the error log and your mistakes into an email to qyrdyx1@gmail.com",
  "节奏挑战 · 跟着节拍分拣", "节拍分拣", "药丸踩着节拍落下，按拍点放进正确的药物组抽屉。连击越高，音乐越丰满。", "Rhythm · sort on the beat", "Beat sort", "Pills fall on the beat — drop each into the right drawer on time. The higher the combo, the fuller the music.",
  "细调省电项目 · 6 / 6 项开着（省电模式关着，这些暂不生效）", "Fine-tune power saving · 6 / 6 on (power saving is off — not in effect)",
  "闪卡褪色", "点亮的闪卡 7 天没练光泽变淡、14 天氧化发暗，提醒该复习了（档位不会收回）；关掉后闪卡一直保持光亮。", "Card fading", "Shiny cards dull after 7 idle days and tarnish after 14 as a review reminder (tiers are never taken away). Turn it off to keep them bright.",
  "连击特效", "不要特效", "低（只有文字）", "中", "高", "开着", "关掉", "特效“中”是推荐强度；“高”在“中”的基础上加了逐字闪光的大字、更多粒子、第二圈光环、更明显的震动和更多全对彩带。省电模式最多到“中”，系统开了“减少动画”最多到“低”。屏幕震动只在连击升档时出现，容易头晕可以单独关掉，其他特效照常。关闭成就后不再弹解锁提示和新闪卡，已有记录保留，重新打开就能接着用。", "屏幕震动", "Combo effects", "No effects", "Low (text only)", "Medium", "High", "Achievements & collection", "Enabled", "Disabled", "Medium is recommended. High adds letter-by-letter shining words, more particles, a second ring, stronger shake and more confetti. Power saving caps it at Medium; the system \"reduce motion\" setting caps it at Low. Screen shake only happens on combo tier-ups — turn it off if it makes you dizzy; other effects stay. Turning achievements off stops unlock banners and card reveals; existing records are kept.", "Screen shake"
,
  // 设置：下架歌曲后的曲目分组数量、出错记录（版本号变了这里也要改）
  "5 首", "★ 2 5 首", "6 首", "出错记录", "软件出错时自动记下来，遇到问题可以复制发给作者。 版本 1.6.1 · 2026-11-20 · 没有记录", "查看出错记录", "5 tracks", "★ 2 5 tracks", "6 tracks", "Error log", "Errors are recorded automatically; copy and send them to the author if something breaks. Version 1.6.1 · 2026-11-20 · none", "View error log"
]);
/* 拆分之后有意删掉的内容（2026-11-18 下架有版权的曲目）：比对前从拆分前的版本里去掉这些整行 */
const REMOVED_OK = new Set(["★ 3 8 首", "★ 4 7 首", "★ 1 7 首", "★ 3 8 tracks", "★ 4 7 tracks", "★ 1 7 tracks"]);
const REMOVED_TRACKS = ["莫斯科郊外的晚上", "喀秋莎", "星光下的梦想", "北京 · 燕京（游京）", "琵琶行", "琵琶行 · 钢琴", "Moscow Nights", "Katyusha", "Dreams Under the Starlight", "Beijing · Yanjing (Strolling the Capital)", "Song of the Pipa", "Song of the Pipa · Piano"];
const dropTracks = t => { let L = String(t).split("\n"); REMOVED_TRACKS.forEach(n => { let i; while ((i = L.indexOf(n)) >= 0) { let a = i, b = i + 2; if (/^★ (精选|Featured)$/.test(L[a - 1])) a--; if (L[b] === "＋" || L[b] === "+") b++; L.splice(a, b - a); } }); return L.join("\n"); };
const STEPS = [
  ["首页", "A.home()"], ["选择范围", "A.selector()"], ["图鉴", "A.codex('dex')"], ["掌握度", "A.codex('mastery')"], ["题库总览", "A.codex('bank')"],
  ["错题本", "A.codex('wrong')"], ["错题速查表", "A.codex('wtable')"], ["报错清单", "A.codex('report')"], ["专项板块", "A.topicHub('core')"], ["速记卡片", "A.factCards('core')"],
  ["同类辨析", "A.classHub()"], ["默写", "A.spellHub()"], ["错题专练", "A.hotHub()"], ["AI 出题", "(A.aiGen || A.aiHub)()"], ["病例列表", "A.caseMenu()"],
  ["查房问答", "A.startQuiz()"], ["答一题", "document.querySelector('#opts .opt').click()"], ["记不清", "A.nextQ(); document.querySelector('#dunno').click()"], ["结算", "A.endQuiz()"],
  ["连线", "A.startMatch({ kind: 'mia' })"], ["连一下", "document.querySelector('#colL .tile').click(); document.querySelector('#colm .tile').click()"], ["连线结算", "A.endMatch()"],
  ["分拣", "A.startSort()"], ["分拣结算", "A.endSort()"], ["病例", "A.startCase(A.CASES[0])"], ["病例离开", "A.home()"],
  ["默写开始", "A.startSpell({ dir: 'e2c' })"], ["默写结算", "A.endSpell()"], ["设置", "A.home(); A.settings()"], ["备份面板", "A.backupSheet()"]
];
async function run(which) {
  const c = await launch(9370 + (which === "legacy" ? 0 : 1), 820, 1180);
  await c.send("Page.enable"); await c.send("Runtime.enable");
  const errs = []; c.on("Runtime.exceptionThrown", p => errs.push((p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text).split("\n")[0]));
  await c.send("Emulation.setDeviceMetricsOverride", { width: 820, height: 1180, deviceScaleFactor: 1, mobile: true });
  await c.send("Page.addScriptToEvaluateOnNewDocument", { source: SEED });
  await c.send("Page.navigate", { url: URLS[which] });
  const ev = async e => { const r = await c.send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return "EXC " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").split("\n")[0]; return r.result.value; };
  for (let i = 0; i < 100 && !(await ev('!!document.querySelector(".hero")')); i++) await new Promise(r => setTimeout(r, 150));
  await new Promise(r => setTimeout(r, 700));   // 等首页吉祥物的随机台词（300ms 定时器）先出来，两边随机数序列才对得上
  const out = [];
  for (const [name, js] of STEPS) {
    const r = await ev(`(() => { const A = window.PG || window; ${js}; return 1; })()`);
    await new Promise(r => setTimeout(r, 450));   // 回首页会再触发一次随机台词定时器，等它跑完
    const text = await ev(`(document.querySelector("#main").innerText + "\\n#SHEET#" + document.querySelector("#sheetHost").innerText).replace(/\\d+s\\b/g, "Ns")`);
    out.push([name, r === 1 ? text : r]);
  }
  c.close(); return { out, errs };
}
/* 轮换进度（“本轮已考 n / 总数”）从 1.3.1 起改成真的作答后才算，拆分前是题目一出来就算，所以只比格式和总数，不比已考数 */
/* 1.6.1 题库复核后有意改动的内容：拆分前的文字先换成新写法再比（题库总数因此少 1 题） */
const CHANGED = [[/低钾血症、锥体外系症状/g, "低钾血症、运动性兴奋（肌肉抽动）"], [/Hypokalemia; extrapyramidal symptoms/g, "Hypokalemia; psychomotor agitation (muscle twitching)"], [/3974/g, "3973"], [/1423/g, "1422"]];
const fixOld = t => CHANGED.reduce((s, [re, to]) => s.replace(re, to), t);
const BAG_RE = /(本轮已考 ?|Covered this round |Done this round )\d+( ?\/ ?\d+)/g, BAG_N = "$1#$2";
const a = await run("legacy"), b = await run(TARGET);
let same = 0;
for (let i = 0; i < STEPS.length; i++) {
  const [n, x0] = a.out[i], [, y0] = b.out[i];
  const x = fixOld(dropTracks(x0)).split("\n").filter(l => l.trim() && !REMOVED_OK.has(l)).join("\n").replace(BAG_RE, BAG_N);   // 空行不比（新加的块会多出空行）
  const y = String(y0).split("\n").filter(l => l.trim() && !ADDED_OK.has(l)).join("\n").replace(BAG_RE, BAG_N);
  if (x === y) { same++; continue; }
  if (process.env.SHOW_ADDED) console.log("ADDED", n, JSON.stringify(String(y).split("\n").filter(l => !String(x).split("\n").includes(l))));
  const xl = String(x).split("\n"), yl = String(y).split("\n"); const k = xl.findIndex((l, j) => l !== yl[j]);
  console.log(`✗ ${n}\n   拆分前：${String(xl[k]).slice(0, 150)}\n   拆分后：${String(yl[k]).slice(0, 150)}`);
}
console.log(`${LANG} · ${TARGET}：${same}/${STEPS.length} 个页面完全一致`);
console.log("拆分前报错：", a.errs.length ? a.errs : "无"); console.log("拆分后报错：", b.errs.length ? b.errs : "无");
process.exit(same === STEPS.length && !b.errs.length ? 0 : 1);
