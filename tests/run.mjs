// npm test：构建 → 启动本地预览（如果还没开）→ 对照测试（中 / 英 × 在线版 / 离线版）→ 功能测试
// 对照测试以 legacy/ 里拆分前的版本为基准，确认界面文字、音乐、截图都没变。
// 以后功能有意改动时，对照测试会报“不一致”，这是预期的，看清楚差异后即可。
import { spawn, spawnSync } from "child_process"; import path from "path"; import { fileURLToPath } from "url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const node = (args, opts = {}) => spawnSync(process.execPath, args, { cwd: ROOT, stdio: "inherit", ...opts }).status;

if (node(["tools/build.mjs"])) process.exit(1);
let server = null;
const up = async () => { try { await fetch("http://localhost:5181/"); return true; } catch { return false; } };
if (!(await up())) {
  server = spawn(process.execPath, ["tools/dev.mjs"], { cwd: ROOT, stdio: "ignore" });
  for (let i = 0; i < 30 && !(await up()); i++) await new Promise(r => setTimeout(r, 200));
}
let bad = 0;
for (const [lang, target] of [["zh", "dist"], ["en", "dist"], ["zh", "offline"], ["en", "offline"]]) bad += node(["tests/parity.mjs", lang, target]) ? 1 : 0;
for (const target of ["dist", "offline"]) bad += node(["tests/functional.mjs", target]) ? 1 : 0;
if (server) server.kill();
console.log(bad ? `\n有 ${bad} 组测试没通过` : "\n全部测试通过");
process.exit(bad ? 1 : 0);
