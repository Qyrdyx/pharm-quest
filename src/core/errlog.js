/* 药理闯关 · 出错记录
 * 尽早加载：把脚本报错、未处理的 Promise 拒绝、以及 ui/screen.js 的 showErr 显示过的错误记下来（最多 50 条，同一条连续出现只计次数）。
 * 存在 pg_errlog（不进完整备份）。设置 → 出错记录 里可以查看、复制、存成文件发给作者。
 * 记录里只有出错信息和设备 / 浏览器信息，不含学习记录、AI 密钥等个人数据。 */
import { reg } from "./registry.js";
import { LS } from "./storage.js";

reg({ APP_VERSION: () => APP_VERSION, logErr: () => logErr, errLog: () => errLog, clearErrLog: () => clearErrLog, errReport: () => errReport });

/* 版本号：每次发布新版改这里（出错记录、设置页会显示） */
export const APP_VERSION = "1.6.2 · 2026-11-21";
const MAX = 50;
export const errLog = () => { const v = LS.get("errlog", []); return Array.isArray(v) ? v : []; };
export function clearErrLog() { LS.set("errlog", []); }
const pageNow = () => { try { const N = window.PG && window.PG.NAV; const top = N && N[N.length - 1]; return top ? top.name : ""; } catch (e) { return ""; } };
/* 记一条。e 可以是 Error、字符串或任意对象；where 说明是在哪个环节出的错 */
export function logErr(e, where) {
  try {
    const msg = String((e && (e.message || e.reason && (e.reason.message || e.reason))) || e || "未知错误").slice(0, 300);
    const stack = String((e && (e.stack || e.reason && e.reason.stack)) || "").split("\n").slice(0, 8).join("\n").slice(0, 1200);
    const log = errLog(), last = log[log.length - 1];
    if (last && last.msg === msg && last.where === (where || "") && Date.now() - last.t < 60000) { last.n = (last.n || 1) + 1; last.t = Date.now(); }
    else log.push({ t: Date.now(), msg, where: where || "", page: pageNow(), stack, n: 1 });
    LS.set("errlog", log.slice(-MAX));
  } catch (_) {}
}
addEventListener("error", e => { if (e.error || e.message) logErr(e.error || e.message, "脚本"); else if (e.target && e.target !== window) logErr("资源加载失败：" + (e.target.src || e.target.href || e.target.tagName), "资源"); }, true);
addEventListener("unhandledrejection", e => logErr(e.reason, "Promise"));

/* 生成一份可以发给作者的文字报告：版本、设备、浏览器、设置（不含学习记录和密钥）+ 全部出错记录 */
export function errReport() {
  const P = window.PG || {}, cfg = P.cfg || {}, log = errLog();
  const env = [
    `药理闯关 ${APP_VERSION}${window.PG_DEV ? "（开发者版）" : ""}`,
    `生成时间：${new Date().toLocaleString()}`,
    `浏览器：${navigator.userAgent}`,
    `屏幕：${screen.width}×${screen.height}，窗口 ${innerWidth}×${innerHeight}，像素比 ${devicePixelRatio || 1}，触屏 ${navigator.maxTouchPoints || 0} 点`,
    `打开方式：${location.protocol === "file:" ? "本地文件（离线版）" : location.protocol + "//" + location.host}`,
    `语言：${window.LANG || ""}；省电：${cfg.eco ? "开（" + Object.entries(cfg.ecoOpts || {}).filter(([, v]) => v !== 0).map(([k]) => k).join(",") + "）" : "关"}；特效：${cfg.fx ?? 2}；成就：${cfg.ach === 0 ? "关" : "开"}；扩展包：${(P.packs ? P.packs() : []).length} 个；导入歌曲：${(P.userSongs ? P.userSongs() : []).length} 首`
  ];
  const rows = log.map((x, i) => `#${i + 1}  ${new Date(x.t).toLocaleString()}${x.n > 1 ? `（连续 ${x.n} 次）` : ""}  [${x.where || "-"}${x.page ? " @" + x.page : ""}]\n${x.msg}${x.stack ? "\n" + x.stack.split("\n").map(l => "    " + l.trim()).join("\n") : ""}`);
  return env.join("\n") + "\n\n" + (rows.length ? `出错记录（${rows.length} 条，最近的在最后）：\n\n` + rows.join("\n\n") : "没有出错记录。") + "\n";
}
