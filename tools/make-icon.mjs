// 生成应用图标：assets/app.svg → 用无头 Chrome 渲染成多个尺寸的 PNG → 拼成 assets/app.ico（Windows 快捷方式 / 以后打包 exe 用）
// 用法：node tools/make-icon.mjs
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url"; import { launch } from "../tests/cdp.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), DIR = path.join(ROOT, "assets");
fs.mkdirSync(DIR, { recursive: true });
// 深色圆角底 + 斜放的红白胶囊（和顶栏 logo 同配色）
const DEVI = process.argv.includes("--dev"), NAME = DEVI ? "app-dev" : "app";   // --dev：开发者版图标（右下角红色 DEV 角标）
const SVG0 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect x="8" y="8" width="240" height="240" rx="56" fill="#0c1f26" stroke="#284e56" stroke-width="6"/>
  <g transform="translate(128 128) rotate(-40)">
    <clipPath id="c"><rect x="-90" y="-38" width="180" height="76" rx="38"/></clipPath>
    <g clip-path="url(#c)">
      <rect x="-90" y="-38" width="90" height="76" fill="#ee6a52"/>
      <rect x="0" y="-38" width="90" height="76" fill="#f7ecd6"/>
      <rect x="-70" y="-26" width="140" height="11" rx="5.5" fill="#fff" opacity=".3"/>
    </g>
    <rect x="-90" y="-38" width="180" height="76" rx="38" fill="none" stroke="#1e282c" stroke-width="7"/>
    <line x1="0" y1="-35" x2="0" y2="35" stroke="#1e282c" stroke-width="5"/>
  </g>
</svg>`;
const SVG = DEVI ? SVG0.replace("</svg>", `<rect x="96" y="168" width="152" height="72" rx="20" fill="#ff6b81" stroke="#0c1f26" stroke-width="8"/><text x="172" y="221" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="50" fill="#2a0f16">DEV</text></svg>`) : SVG0;
fs.writeFileSync(path.join(DIR, NAME + ".svg"), SVG);
const SIZES = [256, 64, 48, 32, 16];
const c = await launch(9401, 400, 300); await c.send("Runtime.enable");
const r = await c.send("Runtime.evaluate", { awaitPromise: true, returnByValue: true, expression: `(async () => {
  const img = new Image(); img.src = "data:image/svg+xml;base64," + btoa(${JSON.stringify(SVG)}); await img.decode();
  const out = [];
  for (const s of ${JSON.stringify(SIZES)}) { const cv = document.createElement("canvas"); cv.width = cv.height = s; const x = cv.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, s, s); out.push(cv.toDataURL("image/png").split(",")[1]); }
  return out; })()` });
c.close();
const pngs = r.result.value.map(b => Buffer.from(b, "base64"));
fs.writeFileSync(path.join(DIR, NAME + ".png"), pngs[0]);
// ICO 文件：6 字节头 + 每个尺寸 16 字节目录项 + PNG 数据
const head = Buffer.alloc(6 + 16 * SIZES.length); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(SIZES.length, 4);
let off = head.length;
SIZES.forEach((s, i) => { const e = 6 + 16 * i; head.writeUInt8(s >= 256 ? 0 : s, e); head.writeUInt8(s >= 256 ? 0 : s, e + 1); head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6); head.writeUInt32LE(pngs[i].length, e + 8); head.writeUInt32LE(off, e + 12); off += pngs[i].length; });
fs.writeFileSync(path.join(DIR, NAME + ".ico"), Buffer.concat([head, ...pngs]));
console.log(`图标已生成：assets/${NAME}.svg、${NAME}.png、${NAME}.ico`);
setTimeout(() => process.exit(0), 300);
