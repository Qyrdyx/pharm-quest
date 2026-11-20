/* 药理闯关 · 导入歌曲面板：选 JSON 文件或粘贴 → 加进“我导入的”分组；可试听、删除、导出 */
import { PG, reg } from "../core/registry.js";
import { $, TT, esc } from "../core/utils.js";
import { cfg, save } from "../core/state.js";
import { SFX } from "../music/sfx.js";
import { TRACKS } from "../music/tracks.js";
import { INSTRUMENTS, LIMITS, addUserSongs, songSample, parseSongJSON, removeUserSong, userSongs } from "../music/usersongs.js";
import { armConfirm } from "../ui/screen.js";

reg({ songSheet: () => songSheet });

export function songSheet() {
  const host = $("#sheetHost"), list = userSongs();
  const inst = Object.entries(INSTRUMENTS).map(([k, v]) => `<code>${k}</code> ${TT(v[0], v[1])}`).join("　");
  host.innerHTML = `<div class="sheet-bg" id="sgbg"><div class="sheet io-box" role="dialog" aria-label="${TT("导入歌曲", "Import songs")}">
    <h2>${TT("导入歌曲", "Import songs")}</h2>
    <p>${TT("把乐谱写成 JSON（格式见下面的说明和示例），选文件或粘贴进来，就会出现在曲目表的「我导入的」分组里，和内置曲目一样可以单曲循环、加入歌单。歌曲存在本机，完整备份会一起带上。", "Write a score as JSON (see the format and sample below), pick the file or paste it, and it appears under “我导入的” in the track list, just like built-in tracks. Songs are stored on this device and included in full backups.")}</p>
    <div class="io-row"><button class="btn" id="sgPick">${TT("选择 JSON 文件", "Choose JSON file")}</button><input id="sgFile" type="file" multiple accept=".json,application/json,text/plain" style="display:none"><span class="io-msg" id="sgMsg"></span></div>
    <textarea id="sgTxt" placeholder="${TT("或者把 JSON 粘贴到这里…", "…or paste JSON here")}"></textarea>
    <div class="io-row"><button class="btn" id="sgGo">${TT("导入粘贴的内容", "Import pasted JSON")}</button><button class="ibtn" id="sgSample">${TT("填入示例（小星星）", "Fill in a sample")}</button><button class="ibtn" id="sgSampleAlt">${TT("English sample", "中文示例")}</button></div>
    <h4>${TT("已导入", "Imported")}（${list.length} / ${LIMITS.songs}）</h4>
    ${list.length ? `<div class="sg-list">${list.map(s => `<div class="sg-item"><div><b>${esc(s.name)}</b><small>${s.bpm} BPM · ${s.barLens.length} ${TT("小节", "bars")} · ${esc([...new Set(s.parts.map(p => TT(INSTRUMENTS[p.inst][0], INSTRUMENTS[p.inst][1])))].join(" + "))}</small></div>
      <button class="ibtn" data-play="${esc(s.name)}">${TT("播放", "Play")}</button><button class="ibtn" data-del="${esc(s.name)}">${TT("删除", "Delete")}</button></div>`).join("")}</div>`
      : `<p>${TT("还没有导入歌曲。", "No songs yet.")}</p>`}
    <details class="sg-help"><summary>${TT("JSON 格式说明", "JSON format")}</summary>
      <ul>
        <li><code>name</code> ${TT("歌名", "title")}；<code>bpm</code> ${TT("速度（30–260，按四分音符）", "tempo (30–260, quarter notes)")}；<code>beatsPerBar</code> ${TT("每小节几拍（2/4 写 2，3/4 写 3）", "beats per bar")}。</li>
        <li><code>parts</code> ${TT("声部，最多 8 个，同时开始。每个声部有", "up to 8 voices played together, each with")} <code>instrument</code>、${TT("可选", "optional")} <code>volume</code>（0–3，${TT("默认 1", "default 1")}）${TT("和", "and")} <code>bars</code>。</li>
        <li><code>bars</code> ${TT("按小节列出音符，每个音写成", "lists notes bar by bar, each as")} <code>["音名", 拍数]</code>：${TT("四分音符 = 1，八分 = 0.5，二分 = 2，附点四分 = 1.5。", "quarter = 1, eighth = 0.5, half = 2, dotted quarter = 1.5.")}</li>
        <li>${TT("音名：", "Pitches: ")}<code>C4</code> ${TT("是中央 C", "is middle C")}，${TT("升降号", "accidentals")} <code>F#4</code> / <code>Bb3</code>；${TT("和弦", "chords")} <code>"C4+E4+G4"</code> ${TT("或", "or")} <code>["C4","E4","G4"]</code>；${TT("休止", "rest")} <code>"R"</code>；${TT("也可以直接写 MIDI 数字（60 = C4）；音名后加", "MIDI numbers work too (60 = C4); add")} <code>~</code> ${TT("连到下一个同音", "to tie into the next same note")}。</li>
        <li>${TT("乐器：", "Instruments: ")}${inst}</li>
        <li>${TT("简写也认：最外层直接是小节数组、每小节是 [声部1, 声部2]（之前发给我的那种谱）；或者只有一条 notes 旋律，按每小节拍数自动分小节。", "Shorthands: a top-level array of bars, each bar = [voice1, voice2]; or a single notes list that is split into bars automatically.")}</li>
      </ul>
      <pre>${esc(songSample())}</pre>
    </details>
    <p style="font-size:12px">${TT("提示：受版权保护的歌曲只供自己学习时听，不要发布或分享。", "Note: copyrighted songs are for your own listening only; don't publish or share them.")}</p>
    <div class="close-row"><button class="btn ghost" id="sgClose">${TT("返回设置", "Back to settings")}</button></div></div></div>`;
  const msg = (t, ok = true) => { const m = $("#sgMsg"); m.textContent = t; m.style.color = ok ? "var(--mint)" : "var(--rose)"; };
  const close = () => PG.settings();
  $("#sgbg").addEventListener("click", e => { if (e.target.id === "sgbg") close(); });
  $("#sgClose").onclick = () => { SFX.click(); close(); };
  const run = (texts) => {
    const got = [], errs = [];
    texts.forEach(([txt, fname]) => { try { got.push(...parseSongJSON(txt, (fname || "").replace(/\.[^.]+$/, "") || TT("导入的歌曲", "Imported song"))); } catch (e) { errs.push((fname ? fname + "：" : "") + e.message); } });
    let added = [];
    if (got.length) { try { added = addUserSongs(got); } catch (e) { errs.push(e.message); } }
    if (!added.length) { SFX.wrong(); msg(TT("导入失败：", "Import failed: ") + (errs[0] || TT(`已达上限 ${LIMITS.songs} 首，先删掉几首`, `Limit of ${LIMITS.songs} songs reached`)), false); return; }
    SFX.right();
    // 导入完直接放第一首，方便马上听
    cfg.track = TRACKS.findIndex(t => t.name === added[0]); save(); PG.startMusic();
    songSheet();
    msg(TT(`已导入 ${added.length} 首：`, `Imported ${added.length}: `) + added.join("、") + (errs.length ? TT("；有 ", "; ") + errs.length + TT(" 个失败：", " failed: ") + errs[0] : ""), !errs.length);
  };
  $("#sgPick").onclick = () => { SFX.click(); $("#sgFile").click(); };
  $("#sgFile").onchange = async e => {
    const fs = [...e.target.files]; if (!fs.length) return;
    run(await Promise.all(fs.map(f => new Promise(r => { const rd = new FileReader(); rd.onload = () => r([String(rd.result), f.name]); rd.onerror = () => r(["", f.name]); rd.readAsText(f); }))));
  };
  $("#sgGo").onclick = () => { const t = $("#sgTxt").value.trim(); if (t) run([[t, ""]]); else msg(TT("先粘贴内容", "Paste something first"), false); };
  [["sgSample", false], ["sgSampleAlt", true]].forEach(([id, alt]) => { $("#" + id).onclick = () => { SFX.click(); $("#sgTxt").value = songSample(alt); msg(TT("示例已填入，点“导入粘贴的内容”试试", "Sample filled in — tap Import")); }; });
  host.querySelectorAll("[data-play]").forEach(b => b.onclick = () => { SFX.click(); const i = TRACKS.findIndex(t => t.user && t.name === b.dataset.play); if (i >= 0) { cfg.track = i; save(); PG.startMusic(); msg(TT("正在播放：", "Playing: ") + b.dataset.play); } });
  host.querySelectorAll("[data-del]").forEach(b => armConfirm(b, TT("再点一次删除", "Tap again"), () => { removeUserSong(b.dataset.del); SFX.click(); songSheet(); msg(TT("已删除：", "Deleted: ") + b.dataset.del); }));
}
