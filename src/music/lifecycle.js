/* 药理闯关 · 音频生命周期：首次触摸解锁、切后台挂起、回前台恢复 */
import { PG, reg } from "../core/registry.js";
import { AU, ensureAudio, wakeAudio } from "./engine.js";

reg({ unlockIOS: () => unlockIOS });

// 第一次按下页面任何地方就启动音频引擎，避免第一个音效要等引擎启动
addEventListener("pointerdown", () => ensureAudio(), { once: true, capture: true });
try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
/* iOS 要在“抬起手指”这类手势里才肯真正启动声音：播一段静音唤醒 */
export const unlockIOS = () => {
  if (!ensureAudio()) return;
  wakeAudio(true); const c = AU.ctx;
  try { const b = c.createBufferSource(); b.buffer = c.createBuffer(1, 1, 22050); b.connect(c.destination); b.start(0); } catch (e) {}
  if (c.state === "running") ["touchend", "click"].forEach(t => removeEventListener(t, unlockIOS, true));
};
["touchend", "click"].forEach(t => addEventListener(t, unlockIOS, true));
addEventListener("pageshow", () => wakeAudio());
addEventListener("keydown", () => ensureAudio(), { once: true, capture: true });
// 切回本页时立刻唤醒音频引擎（浏览器会暂停后台页面的音频）
document.addEventListener("visibilitychange", () => {
  if (!AU.ctx) return;
  if (document.hidden) { if (AU.ctx.state === "running") AU.ctx.suspend().catch(() => {}); }
  else wakeAudio();
});
// 回到前台后的每一次点按都检查一下：声音没恢复就在这次手势里修好（iOS 只认手势里启动的声音）
["touchend", "click", "keydown"].forEach(t => addEventListener(t, () => { if (AU.ctx && (AU.broken || AU.ctx.state !== "running")) wakeAudio(true); }, true));
