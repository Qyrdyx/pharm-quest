// 构建：src/ → dist/（在线版：index.html + app.js + app.css）和 dist/offline/药理闯关-离线版.html（单文件，iPad / 手机直接打开）
// 用法：npm run build            构建
//       npm run build -- --desktop 构建后把离线版复制到桌面
//       精简版：同时生成 dist/offline/药理闯关-离线版-精简.html，不含摇滚医生（乐器录音约 1.3 MB），想省空间就用它
//       npm run build:dev            开发者版（作弊开关、成就 / 闪卡调试面板，数据和正式版分开）→ dist-dev/，并复制到桌面
import fs from "fs"; import { fileURLToPath } from "url"; import path from "path"; import os from "os"; import * as esbuild from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src"), DIST = path.join(ROOT, "dist");
const TARGET = ["safari14", "chrome90", "firefox90", "edge90"];   // 兼容较老的 iPad / 手机浏览器
/* 官方扩展包合集：把「扩展包合集/」里的 .json 打进软件（src/data/catalog.js），软件里可以一键安装、显示“官方审核” */
{
  const dir = path.join(ROOT, "扩展包合集"), out = [];
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(".json")).sort()) {
    const text = fs.readFileSync(path.join(dir, f), "utf8").replace(/^\uFEFF/, "");
    try { JSON.parse(text); out.push({ file: f, text }); } catch (e) { console.warn("跳过（不是有效的 JSON）：扩展包合集/" + f); }
  }
  const body = "/* 药理闯关 · 官方扩展包合集（自动生成，不要手改）\n * 来源：项目根目录的「扩展包合集/」文件夹里的 .json 文件；每次 npm run build / build:dev 时重新生成 */\nexport const CATALOG = " + JSON.stringify(out, null, 1) + ";\n";
  const file = path.join(SRC, "data/catalog.js");
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== body) fs.writeFileSync(file, body);
  console.log("官方扩展包合集：" + out.length + " 个");
}
if (process.argv.includes("--dev")) { await buildDev(); process.exit(0); }

fs.rmSync(DIST, { recursive: true, force: true }); fs.mkdirSync(path.join(DIST, "offline"), { recursive: true });
const js = await esbuild.build({ entryPoints: [path.join(SRC, "main.js")], bundle: true, format: "iife", target: TARGET, minify: true, charset: "utf8", write: false, legalComments: "none", define: { __DEV__: "false" } });   // 正式版：开发者作弊代码整段删掉
const css = await esbuild.build({ entryPoints: [path.join(SRC, "styles/index.css")], bundle: true, target: TARGET, minify: true, charset: "utf8", write: false });
const jsText = js.outputFiles[0].text, cssText = css.outputFiles[0].text;

const page = fs.readFileSync(path.join(SRC, "index.html"), "utf8");
const LINK = '<link rel="stylesheet" href="./styles/index.css">', SCRIPT = '<script type="module" src="./main.js"></script>';
if (!page.includes(LINK) || !page.includes(SCRIPT)) throw new Error("src/index.html 里找不到样式或脚本入口");
// 在线版：三个文件
fs.writeFileSync(path.join(DIST, "app.js"), jsText);
fs.writeFileSync(path.join(DIST, "app.css"), cssText);
// claude.ai 发布时会自己套一层 doctype / head / body 外壳，所以在线版只给“片段”：head 里的内容 + body 里的内容（字符集和视口由外壳提供）
const toFragment = h => {
  const head = h.slice(h.indexOf("<head>") + 6, h.indexOf("</head>")).replace(/<meta charset="utf-8">\n/, "").replace(/<meta name="viewport"[^>]*>\n/, "");
  const body = h.slice(h.indexOf("<body>") + 6, h.lastIndexOf("</body>"));
  return head.trim() + "\n" + body.trim() + "\n";
};
fs.writeFileSync(path.join(DIST, "index.html"), toFragment(page.replace(LINK, '<link rel="stylesheet" href="app.css">').replace(SCRIPT, '<script src="app.js"></script>')));
// 离线版：全部内联成一个 HTML（脚本里的 </script> 要转义，否则会提前结束标签）
const inlineJs = jsText.replace(/<\/script/gi, "<\\/script");
const offline = page.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', "").replace(LINK, () => `<style>\n${cssText}</style>`).replace(SCRIPT, () => `<script>\n${inlineJs}</script>`);
const offlineFile = path.join(DIST, "offline", "药理闯关-离线版.html");
fs.writeFileSync(offlineFile, offline);

const kb = f => Math.round(fs.statSync(f).size / 1024) + " KB";
console.log("在线版：dist/index.html + app.js (" + kb(path.join(DIST, "app.js")) + ") + app.css (" + kb(path.join(DIST, "app.css")) + ")");
console.log("离线版：" + path.relative(ROOT, offlineFile) + " (" + kb(offlineFile) + ")");
/* 精简版：把摇滚医生的三个模块（音乐引擎 + 乐器录音、游戏、样式）换成空模块，其余完全一样 */
const NO_ROCK = { name: "no-rock", setup(b) {
  b.onResolve({ filter: /(^|[\\/])(music|games)[\\/]rhythm\.js$|(^|[\\/])rhythm\.css$/ }, a => ({ path: a.path, namespace: "no-rock" }));
  b.onLoad({ filter: /.*/, namespace: "no-rock" }, a => ({ contents: "", loader: a.path.endsWith(".css") ? "css" : "js" }));
} };
const jsLite = await esbuild.build({ entryPoints: [path.join(SRC, "main.js")], bundle: true, format: "iife", target: TARGET, minify: true, charset: "utf8", write: false, legalComments: "none", define: { __DEV__: "false" }, plugins: [NO_ROCK] });
const cssLite = await esbuild.build({ entryPoints: [path.join(SRC, "styles/index.css")], bundle: true, target: TARGET, minify: true, charset: "utf8", write: false, plugins: [NO_ROCK] });
const liteJs = jsLite.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
if (/SAMPLE_MIDI|rhythmHub\s*:/.test(liteJs)) throw new Error("精简版里还有摇滚医生的代码");
const lite = page.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', "").replace(LINK, () => `<style>\n${cssLite.outputFiles[0].text}</style>`).replace(SCRIPT, () => `<script>\n${liteJs}</script>`);
const liteFile = path.join(DIST, "offline", "药理闯关-离线版-精简.html");
fs.writeFileSync(liteFile, lite);
console.log("精简版（无摇滚医生）：" + path.relative(ROOT, liteFile) + " (" + kb(liteFile) + ")");
if (process.argv.includes("--desktop")) {
  const desk = path.join(os.homedir(), "Desktop", "药理闯关-离线版.html");
  fs.copyFileSync(offlineFile, desk); console.log("已复制到桌面：" + desk);
  const deskLite = path.join(os.homedir(), "Desktop", "药理闯关-离线版-精简.html");
  fs.copyFileSync(liteFile, deskLite); console.log("已复制到桌面：" + deskLite);
}

/* 开发者版：入口 src/dev/main.js（先隔离存储、再加载游戏、最后挂面板），单文件输出到 dist-dev/，不碰 dist/ */
async function buildDev() {
  const OUT = path.join(ROOT, "dist-dev"); fs.mkdirSync(OUT, { recursive: true });
  const js = await esbuild.build({ entryPoints: [path.join(SRC, "dev", "main.js")], bundle: true, format: "iife", target: TARGET, minify: true, charset: "utf8", write: false, legalComments: "none", define: { __DEV__: "true" } });
  const css = await esbuild.build({ entryPoints: [path.join(SRC, "styles/index.css")], bundle: true, target: TARGET, minify: true, charset: "utf8", write: false });
  const page = fs.readFileSync(path.join(SRC, "index.html"), "utf8");
  const LINK = '<link rel="stylesheet" href="./styles/index.css">', SCRIPT = '<script type="module" src="./main.js"></script>';
  const jsText = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
  const html = page.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', "").replace(/<title>[^<]*<\/title>/, "<title>药理闯关 · 开发者版</title>")
    .replace(LINK, () => "<style>\n" + css.outputFiles[0].text + "</style>").replace(SCRIPT, () => "<script>\n" + jsText + "</script>");
  const file = path.join(OUT, "药理闯关-开发者版.html"); fs.writeFileSync(file, html);
  console.log("开发者版：" + path.relative(ROOT, file) + " (" + Math.round(fs.statSync(file).size / 1024) + " KB)");
  if (process.argv.includes("--desktop")) { const desk = path.join(os.homedir(), "Desktop", "药理闯关-开发者版.html"); fs.copyFileSync(file, desk); console.log("已复制到桌面：" + desk); }
}
