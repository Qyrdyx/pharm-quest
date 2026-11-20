/* 药理闯关 · 开发者开关
 * 正式版构建时 __DEV__ 被替换成 false，下面的判断和用到它的作弊代码会被整段删掉；开发者版（npm run build:dev）里为 true。
 * 开关本身在开发者面板（src/dev/panel.js）里设置，存在 window.PG_DEV。 */
export const DEV = typeof __DEV__ !== "undefined" && __DEV__;
export const devOn = k => DEV && !!(window.PG_DEV && window.PG_DEV[k]);
