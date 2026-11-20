/* 药理闯关 · 顶栏按钮 */
import { PG } from "../core/registry.js";
import { $ } from "../core/utils.js";
import { AU } from "../music/engine.js";
import { musicUI, nextTrackIdx, setTrack, startMusic, stopMusic } from "../music/player.js";
import { SFX } from "../music/sfx.js";
import { armLang } from "./screen.js";
import { settings } from "../pages/settings.js";

$("#logo").onclick = () => { SFX.click(); PG.home(); };
const busy = () => { if (!PG.rhythmActive) return false; PG.toast(LANG === "en" ? "Rock Doctor has its own music — background music resumes when you leave" : "摇滚医生有自己的曲子，离开后背景音乐会恢复"); return true; };
$("#musicBtn").onclick = () => { if (busy()) return; AU.playing ? stopMusic() : startMusic(); };
const skips = [];   // 彩蛋成就“打碟大师”：一分钟内切歌 10 次
$("#nextTrack").onclick = () => { if (busy()) return; setTrack(nextTrackIdx()); if (!AU.playing) startMusic(); const now = Date.now(); skips.push(now); while (skips.length && now - skips[0] > 60000) skips.shift(); if (skips.length === 10) PG.achEvent && PG.achEvent("turntable"); };
$("#setBtn").onclick = () => { SFX.click(); settings(); };
$("#langBtn").onclick = () => armLang($("#langBtn"), LANG === "en" ? "zh" : "en");
musicUI();
