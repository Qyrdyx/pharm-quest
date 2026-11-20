// 逐像素比较两张 PNG（截图对比用）：在无头浏览器里解码，统计不同的像素数和位置范围
import fs from "fs"; import { pathToFileURL } from "url"; import { launch } from "./cdp.mjs";
export async function pxdiff(aB64, bB64) {
  const c = await launch(9399, 400, 300); await c.send("Runtime.enable");
  const r = await c.send("Runtime.evaluate", { awaitPromise: true, returnByValue: true, expression: `(async () => {
    const load = s => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = "data:image/png;base64," + s; });
    const [a, b] = await Promise.all([load(${JSON.stringify(aB64)}), load(${JSON.stringify(bB64)})]);
    const px = i => { const cv = new OffscreenCanvas(i.width, i.height), x = cv.getContext("2d"); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
    const A = px(a), B = px(b); let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let k = 0; k < A.length; k += 4) if (Math.abs(A[k] - B[k]) + Math.abs(A[k+1] - B[k+1]) + Math.abs(A[k+2] - B[k+2]) > 24) { n++; const p = k / 4, x = p % a.width, y = (p / a.width) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { n, box: n ? [x0, y0, x1, y1] : null, size: [a.width, a.height, b.width, b.height] };
  })()` });
  c.close(); return r.result.value;
}
if (import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[3]) {   // 命令行：node tests/pxdiff.mjs a.png b.png
  console.log(await pxdiff(fs.readFileSync(process.argv[2]).toString("base64"), fs.readFileSync(process.argv[3]).toString("base64"))); process.exit(0); }
