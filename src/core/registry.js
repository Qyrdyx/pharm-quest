/* 药理闯关 · 共享注册表 PG
 * 模块之间的“回头调用”走这里：排在前面的模块要调用后面模块的函数（比如游戏结束回首页 PG.home()），
 * 或者要给别的模块的变量重新赋值（比如 PG.M = null），就通过 PG，避免循环 import。
 * 每个模块加载时把自己的顶层名字登记进来；window.PG 也指向它，方便调试和自动测试。 */
export const PG = {};
/** 登记名字：getters 读当前值；setters（可选）允许别的模块通过 PG.名字 = 值 赋值 */
export function reg(getters, setters = {}) {
  for (const k of Object.keys(getters)) Object.defineProperty(PG, k, { get: getters[k], set: setters[k] || (() => { throw new TypeError("PG." + k + " 不能重新赋值"); }), enumerable: true, configurable: true });
}
