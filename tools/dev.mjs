// 本地预览：直接用浏览器加载 src/ 里的 ES 模块，改完刷新即可看到效果（不用打包）
// 用法：npm run dev → 打开 http://localhost:5181/        构建好的版本：http://localhost:5181/dist/
import http from "http"; import fs from "fs"; import { fileURLToPath } from "url"; import path from "path";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = +(process.env.PORT || 5181);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const base = p.startsWith("/dist/") || p.startsWith("/legacy/") ? ROOT : path.join(ROOT, "src");
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(base, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": (TYPES[path.extname(file)] || "application/octet-stream") + "; charset=utf-8", "Cache-Control": "no-store" });
    // 在线版是片段：像 claude.ai 发布时那样套上 doctype / 字符集 / 视口外壳再给浏览器
    if (p === "/dist/index.html" && !/^\s*<!doctype/i.test(buf.toString("utf8", 0, 30)))
      return res.end('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n' + buf.toString("utf8") + "</body></html>\n");
    res.end(buf);
  });
}).listen(PORT, () => console.log(`预览：http://localhost:${PORT}/   构建版：http://localhost:${PORT}/dist/`));
