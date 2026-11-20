/* 药理闯关 · 设置面板 */
import { PG, reg } from "../core/registry.js";
import { $, TT } from "../core/utils.js";
import { TYPES } from "../data/index.js";
import { cfg, save } from "../core/state.js";
import { AU } from "../music/engine.js";
import { startMusic, trackGroupsHTML } from "../music/player.js";
import { SFX } from "../music/sfx.js";
import { applyEco } from "../ui/power.js";
import { enabledTypes } from "../engine/questions.js";
import { armConfirm, main } from "../ui/screen.js";
import { bagResetAll } from "../records/rotation.js";
import { backupInfo, backupSheet } from "../records/backup.js";

reg({ settings: () => settings });

/* ---------- 设置面板 ---------- */
export function settings() {
  const host = $("#sheetHost");
  const seg = (key, vals, fmt) => `<div class="seg" data-key="${key}">${vals.map(v => `<button data-v="${v}" aria-pressed="${cfg[key] === v}">${fmt(v)}</button>`).join("")}</div>`;
  host.innerHTML = `<div class="sheet-bg" id="sbg"><div class="sheet" role="dialog" aria-label="设置">
    <h2>设置</h2>
    <h4>背景音乐</h4>
    <div class="seg" id="pmode">${[["one", TT("单曲循环", "Repeat one")], ["shuffle", TT("随机播放", "Shuffle")], ["list", TT("歌单轮播", "Playlist")]].map(([v, n]) => `<button data-pm="${v}" aria-pressed="${(cfg.playMode || "one") === v}">${n}</button>`).join("")}</div>
    <p class="pl-note" id="plNote"></p>
    ${trackGroupsHTML()}
    <button class="ibtn" id="songImp" style="margin:2px 0 8px">＋ ${TT("导入歌曲（JSON）", "Import songs (JSON)")}</button>
    <div class="range"><label for="vm">音乐</label><input id="vm" type="range" min="0" max="1" step="0.05" value="${cfg.music}"><output id="vmo">${Math.round(cfg.music * 100)}</output></div>
    <div class="range"><label for="vs">音效</label><input id="vs" type="range" min="0" max="1" step="0.05" value="${cfg.sfx}"><output id="vso">${Math.round(cfg.sfx * 100)}</output></div>
    <h4>查房问答 · 每局题量</h4>${seg("count", [10, 20, 40, 0], v => v ? v + " 题" : "无尽")}
    <h4>每题限时</h4>${seg("timer", [0, 15, 25, 40], v => v ? v + " 秒" : "不限时")}
    <h4>连线配对 · 每局轮数（每轮 6 对）</h4>${seg("matchRounds", [3, 5, 8, 0], v => v ? v + " 轮" : "全部")}
    <h4>生命数</h4>${seg("lives", [3, 5, 0], v => v ? v + " 条" : "无限")}
    <h4>题型（至少保留一种）</h4><div class="seg" id="types">${Object.entries(TYPES).map(([k, n]) => `<button data-t="${k}" aria-pressed="${!!cfg.types[k]}">${n}</button>`).join("")}</div>
    <h4>省电模式</h4>${seg("eco", [1, 0], v => v ? "开启" : "关闭")}
    <div id="ecoSec">${(() => { const on = PG.ECO_ITEMS.filter(([k]) => cfg.ecoOpts[k] !== 0).length;
      return `<details class="eco-box"${cfg.ecoOpen ? " open" : ""}><summary>${TT(`细调省电项目 · ${on} / ${PG.ECO_ITEMS.length} 项开着`, `Fine-tune power saving · ${on} / ${PG.ECO_ITEMS.length} on`)}${cfg.eco ? "" : TT("（省电模式关着，这些暂不生效）", " (power saving is off — not in effect)")}</summary>
        <div class="eco-list">${PG.ECO_ITEMS.map(([k, zh, en, dz, de]) => `<label class="eco-it"><input type="checkbox" data-eco="${k}"${cfg.ecoOpts[k] !== 0 ? " checked" : ""}><span><b>${TT(zh, en)}</b><small>${TT(dz, de)}</small></span></label>`).join("")}</div>
        <div class="eco-acts"><button class="ibtn" id="ecoAll">${TT("全部打开（默认）", "All on (default)")}</button><button class="ibtn" id="ecoNone">${TT("全部关掉", "All off")}</button></div></details>`; })()}</div>
    <div id="fxSec"><h4>${TT("连击特效", "Combo effects")}</h4>${seg("fx", [0, 1, 2, 3], v => [TT("不要特效", "No effects"), TT("低（只有文字）", "Low (text only)"), TT("中", "Medium"), TT("高", "High")][v])}
    <h4>${TT("屏幕震动", "Screen shake")}</h4>${seg("shake", [1, 0], v => v ? TT("开着", "Enabled") : TT("关掉", "Disabled"))}
    <h4>${TT("成就与收集", "Achievements & collection")}</h4>${seg("ach", [1, 0], v => v ? TT("开着", "Enabled") : TT("关掉", "Disabled"))}
    <h4>${TT("闪卡褪色", "Card fading")}</h4>${seg("fade", [1, 0], v => v ? TT("开着", "Enabled") : TT("关掉", "Disabled"))}
    <p style="font-size:12px;color:var(--mute);margin:4px 0 0">${TT("点亮的闪卡 7 天没练光泽变淡、14 天氧化发暗，提醒该复习了（档位不会收回）；关掉后闪卡一直保持光亮。", "Shiny cards dull after 7 idle days and tarnish after 14 as a review reminder (tiers are never taken away). Turn it off to keep them bright.")}</p>
    <p style="font-size:12px;color:var(--mute);margin:4px 0 0">${TT("特效“中”是推荐强度；“高”在“中”的基础上加了逐字闪光的大字、更多粒子、第二圈光环、更明显的震动和更多全对彩带。省电模式最多到“中”，系统开了“减少动画”最多到“低”。屏幕震动只在连击升档时出现，容易头晕可以单独关掉，其他特效照常。关闭成就后不再弹解锁提示和新闪卡，已有记录保留，重新打开就能接着用。", "Medium is recommended. High adds letter-by-letter shining words, more particles, a second ring, stronger shake and more confetti. Power saving caps it at Medium; the system “reduce motion” setting caps it at Low. Screen shake only happens on combo tier-ups — turn it off if it makes you dizzy; other effects stay. Turning achievements off stops unlock banners and card reveals; existing records are kept.")}</p></div>
    <p style="margin:6px 0 0;font-size:13px;color:var(--mute)">背景静止、监护仪降帧、关掉装饰动画，手机平板更凉快、更省电。</p>
    <h4>轮换记录</h4>
    <p style="margin:0 0 8px;font-size:13px;color:var(--mute)">各玩法会先出本轮还没考过的药。重置后从头开始新一轮；错题本、掌握度、高频错误记录都不受影响。</p>
    <button class="ibtn" id="bagReset">重置轮换记录</button> <span id="bagResetMsg" style="font-size:13px;color:var(--mint)"></span>
    <h4>${TT("数据备份", "Backup")}</h4>
    <p style="margin:0 0 8px;font-size:13px;color:var(--mute)">${TT("上次备份：", "Last backup: ")}${backupInfo().t ? new Date(backupInfo().t).toLocaleString() : TT("从未备份", "never")}。${TT("学习记录只存在本机浏览器里，建议定期备份。", "Records live only in this browser; back up regularly.")}</p>
    <button class="ibtn" id="bkOpen">${TT("数据备份与恢复", "Backup & restore")}</button>
    <div id="pkSec"><h4>${TT("题库扩展包", "Question-bank packs")}</h4>
    <p style="margin:0 0 8px;font-size:13px;color:var(--mute)">${TT("导入自己或同学整理的药物组，也可以用 AI 根据讲义生成。", "Import drug groups written by you or friends, or generate them with AI from your notes.")}</p>
    <button class="ibtn" id="pkOpen">${TT("管理题库扩展包", "Manage packs")}</button></div>
    <div id="errSec"><h4>${TT("出错记录", "Error log")}</h4>
    <p style="margin:0 0 8px;font-size:13px;color:var(--mute)">${TT("软件出错时自动记下来，遇到问题可以复制发给作者。", "Errors are recorded automatically; copy and send them to the author if something breaks.")} ${TT("版本", "Version")} ${PG.APP_VERSION} · ${PG.errLog().length ? TT(`${PG.errLog().length} 条记录`, `${PG.errLog().length} entries`) : TT("没有记录", "none")}</p>
    <button class="ibtn" id="errOpen">${TT("查看出错记录", "View error log")}</button></div>
    <p class="tca-sign" style="margin-top:14px">药理闯关 · 作者 红烧肉大王TCA</p>
    <div class="close-row"><button class="btn" id="sclose">完成</button></div>
  </div></div>`;
  const close = () => { host.innerHTML = ""; if (main.querySelector(".hero")) PG.home(); };
  $("#sbg").addEventListener("click", e => { if (e.target.id === "sbg") close(); });
  $("#sclose").onclick = () => { SFX.click(); close(); };
  $("#bkOpen").onclick = () => { SFX.click(); backupSheet(); };
  $("#pkOpen").onclick = () => { SFX.click(); PG.packSheet(); };
  $("#songImp").onclick = () => { SFX.click(); PG.songSheet(); };
  $("#errOpen").onclick = () => { SFX.click(); PG.errSheet(); };
  armConfirm($("#bagReset"), "再点一次确认重置", () => { bagResetAll(); SFX.click(); $("#bagResetMsg").textContent = "已重置"; });
  const plNote = () => {
    const n = (cfg.playlist || []).length, m = cfg.playMode || "one";
    $("#plNote").textContent = m === "one" ? TT("一直循环当前这首。点曲目右下角的 ＋ 可以把它加入歌单。", "Loops the current track. Tap + on a track to add it to the playlist.")
      : m === "shuffle" ? TT("每首完整放完一遍（至少约 75 秒）后，随机换下一首。", "After each track plays through once (about 75 s at least), a random track comes next.")
      : TT(`按顺序轮流播放歌单里的曲目，每首放完一遍再换。点曲目右下角的 ＋ 加入歌单（已选 ${n} 首${n ? "" : "，没选时轮播全部曲目"}）。`, `Plays the playlist in order, each track once through. Tap + on a track to add it (${n} selected${n ? "" : "; all tracks rotate when empty"}).`);
  };
  plNote();
  $("#pmode").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return; cfg.playMode = b.dataset.pm; save(); SFX.click();
    $("#pmode").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); plNote();
    if (AU.playing) AU.trackT0 = AU.next;   // 切换模式后，从现在起算这一首的播放时长
  });
  host.querySelectorAll(".trk").forEach(b => b.onclick = e => {
    const del = e.target.closest(".trk-del");
    if (del) {   // 删除导入的歌：点一次变红确认，3 秒内再点一次才删
      e.stopPropagation();
      if (!del.classList.contains("arm")) { del.classList.add("arm"); del.textContent = TT("删除？", "Delete?"); SFX.click(); setTimeout(() => { if (del.isConnected) { del.classList.remove("arm"); del.textContent = "×"; } }, 4000); return; }
      PG.removeUserSong(del.dataset.del); SFX.click(); const y = host.querySelector(".sheet").scrollTop; settings(); host.querySelector(".sheet").scrollTop = y; return;
    }
    const pl = e.target.closest(".pl-add");
    if (pl) {   // 加入 / 移出歌单，不切歌
      e.stopPropagation(); const nm = pl.dataset.pl, L = cfg.playlist = (cfg.playlist || []).slice(), i = L.indexOf(nm);
      if (i >= 0) L.splice(i, 1); else L.push(nm);
      pl.classList.toggle("on", i < 0); pl.textContent = i < 0 ? "✓" : "＋"; save(); SFX.click(); plNote(); return;
    }
    cfg.track = +b.dataset.i; save(); startMusic();
  });
  $("#vm").oninput = e => { cfg.music = +e.target.value; $("#vmo").textContent = Math.round(cfg.music * 100); if (AU.ctx && AU.playing) AU.music.gain.setTargetAtTime(cfg.music, AU.ctx.currentTime, 0.05); save(); };
  { const box = $("#ecoSec");
    if (box) {
      const refresh = () => { const on = PG.ECO_ITEMS.filter(([k]) => cfg.ecoOpts[k] !== 0).length, sm = box.querySelector("summary"); if (sm) sm.firstChild.textContent = TT(`细调省电项目 · ${on} / ${PG.ECO_ITEMS.length} 项开着`, `Fine-tune power saving · ${on} / ${PG.ECO_ITEMS.length} on`) + (cfg.eco ? "" : TT("（省电模式关着，这些暂不生效）", " (power saving is off — not in effect)")); };
      box.__refresh = refresh;
      box.querySelector("details").addEventListener("toggle", e => { cfg.ecoOpen = e.target.open ? 1 : 0; save(); });
      box.querySelectorAll("[data-eco]").forEach(c => c.onchange = () => { cfg.ecoOpts[c.dataset.eco] = c.checked ? 1 : 0; save(); applyEco(); SFX.click(); refresh(); });
      const setAll = v => { PG.ECO_ITEMS.forEach(([k]) => { cfg.ecoOpts[k] = v; }); box.querySelectorAll("[data-eco]").forEach(c => { c.checked = !!v; }); save(); applyEco(); SFX.click(); refresh(); };
      $("#ecoAll").onclick = () => setAll(1); $("#ecoNone").onclick = () => setAll(0);
    } }
  $("#vs").oninput = e => { cfg.sfx = +e.target.value; $("#vso").textContent = Math.round(cfg.sfx * 100); if (AU.ctx) AU.sfx.gain.value = cfg.sfx; save(); };
  $("#vs").onchange = () => SFX.right();
  host.querySelectorAll(".seg[data-key]").forEach(s => s.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return; const was = cfg[s.dataset.key]; cfg[s.dataset.key] = +b.dataset.v; save(); SFX.click(); if (s.dataset.key === "eco") { applyEco(); const eb = $("#ecoSec"); if (eb && eb.__refresh) eb.__refresh(); }
    if (s.dataset.key === "ach" && was === 0 && cfg.ach === 1) PG.achEvent && PG.achEvent("awake");   // 彩蛋：关掉成就又打开
    s.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  }));
  $("#types").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return; const k = b.dataset.t;
    if (cfg.types[k] && enabledTypes().length === 1) return;
    cfg.types[k] = cfg.types[k] ? 0 : 1; b.setAttribute("aria-pressed", String(!!cfg.types[k])); save(); SFX.click();
  });
}
