/* 开发者版：本地存储加前缀 "dev~"，和正式版的数据完全分开（两个文件在同一个浏览器里打开也互不影响）。
 * 必须最先执行：把 window.localStorage 换成一个只读写带前缀键的代理，游戏代码不用改。 */
(() => {
  const P = "dev~", real = window.localStorage;
  const keys = () => { const a = []; for (let i = 0; i < real.length; i++) { const k = real.key(i); if (k && k.indexOf(P) === 0) a.push(k.slice(P.length)); } return a; };
  const shim = {
    getItem: k => real.getItem(P + k), setItem: (k, v) => real.setItem(P + k, String(v)), removeItem: k => real.removeItem(P + k),
    clear: () => keys().forEach(k => real.removeItem(P + k)), key: i => keys()[i] ?? null, get length() { return keys().length; }
  };
  try { Object.defineProperty(window, "localStorage", { configurable: true, get: () => shim }); } catch (e) { console.warn("开发者版存储隔离失败", e); }
  window.__devStorage = { prefix: P, real, shim };
})();
