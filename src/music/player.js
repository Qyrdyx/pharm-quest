/* 药理闯关 · 播放器：调度、播放模式（单曲 / 随机 / 歌单）、切歌 */
import { PG, reg } from "../core/registry.js";
import { $, esc } from "../core/utils.js";
import { cfg, save } from "../core/state.js";
import { AU, ensureAudio } from "./engine.js";
import { FEATURED, TRACKS, TRACK_GROUPS } from "./tracks.js";

reg({ trackGroupsHTML: () => trackGroupsHTML, trackOut: () => trackOut, nextTrackIdx: () => nextTrackIdx, sched: () => sched, startMusic: () => startMusic, stopMusic: () => stopMusic, setTrack: () => setTrack, musicUI: () => musicUI });

export function trackGroupsHTML() {
  const used = new Set(), groups = TRACK_GROUPS.map(([g, names]) => [g, TRACKS.map((t, i) => [t, i]).filter(([t]) => names.includes(t.name)).sort(([a], [b]) => FEATURED.has(b.name) - FEATURED.has(a.name))]);   // 精选曲目排在每组最前
  groups.forEach(([, items]) => items.forEach(([, i]) => used.add(i)));
  const rest = TRACKS.map((t, i) => [t, i]).filter(([, i]) => !used.has(i)); if (rest.length) groups.push(["其他", rest]);
  return groups.filter(([, items]) => items.length).map(([g, items]) => {
    const open = items.some(([, i]) => i === cfg.track);
    return `<details class="trk-group"${open ? " open" : ""}><summary><span>${g}</span><small>${items.some(([t]) => FEATURED.has(t.name)) ? '<em class="feat-count">★ ' + items.filter(([t]) => FEATURED.has(t.name)).length + '</em> ' : ""}${items.length} 首</small></summary>
      <div class="tracks">${items.map(([t, i]) => `<button class="trk${FEATURED.has(t.name) ? " featured" : ""}" data-i="${i}" aria-pressed="${i === cfg.track}">${FEATURED.has(t.name) ? '<span class="feat-tag">★ 精选</span>' : ""}<b>${t.name}</b><small>${t.desc}</small>${t.user ? `<span class="trk-del" data-del="${esc(t.name)}" title="删除这首导入的歌" aria-label="删除">×</span>` : ""}<span class="pl-add${(cfg.playlist || []).includes(t.name) ? " on" : ""}" data-pl="${esc(t.name)}">${(cfg.playlist || []).includes(t.name) ? "✓" : "＋"}</span></button>`).join("")}</div></details>`;
  }).join("");
}
/* 每首曲子可以有自己的音量系数（gain），让切歌时响度差不多 */
export function trackOut(tr) {
  if (!tr.gain || tr.gain === 1) return AU.music;
  if (!tr._g || tr._g.context !== AU.ctx) { tr._g = AU.ctx.createGain(); tr._g.gain.value = tr.gain; tr._g.connect(AU.music); }
  return tr._g;
}
/* 播放模式：单曲循环 one / 随机播放 shuffle / 歌单轮播 list（歌单为空时轮播全部） */
export function nextTrackIdx() {
  const m = cfg.playMode || "one", cur = cfg.track;
  if (m === "shuffle") { if (TRACKS.length < 2) return cur; let n; do n = Math.floor(Math.random() * TRACKS.length); while (n === cur); return n; }
  const all = TRACKS.map((t, i) => i), pl = all.filter(i => (cfg.playlist || []).includes(TRACKS[i].name));
  const L = m === "list" && pl.length ? pl : all;
  return L[(L.indexOf(cur) + 1) % L.length];
}
export function sched() {
  for (;;) {
    const tr = TRACKS[cfg.track], d = 60 / tr.bpm / 4;
    if (AU.next >= AU.ctx.currentTime + 0.35) break;
    // 随机 / 歌单模式：一首完整放完一遍、且至少放了约 75 秒，就在循环点换下一首
    if (AU.step > 0 && AU.step % tr.len === 0 && cfg.playMode && cfg.playMode !== "one" && AU.next - (AU.trackT0 || 0) >= 75) {
      const n = nextTrackIdx();
      if (n !== cfg.track) {
        cfg.track = n; save(); AU.step = 0; AU.next += 0.8; AU.trackT0 = AU.next;
        setTimeout(musicUI, Math.max(0, (AU.next - AU.ctx.currentTime) * 1000));
        continue;
      }
    }
    tr.play(AU.step % tr.len, AU.next, d, trackOut(tr));
    AU.next += d; AU.step++;
  }
}
export function startMusic() {
  if (!ensureAudio()) return;
  AU.music.gain.cancelScheduledValues(AU.ctx.currentTime);
  AU.music.gain.setTargetAtTime(cfg.music, AU.ctx.currentTime, 0.05);
  if (AU.timer) clearInterval(AU.timer);
  AU.step = 0; AU.next = AU.ctx.currentTime + 0.1; AU.trackT0 = AU.next;
  AU.timer = setInterval(sched, 100); sched();
  AU.playing = true; musicUI();
}
export function stopMusic() {
  if (AU.timer) clearInterval(AU.timer); AU.timer = null; AU.playing = false;
  if (AU.ctx) AU.music.gain.setTargetAtTime(0, AU.ctx.currentTime, 0.12);
  musicUI();
}
export function setTrack(i) { cfg.track = (i + TRACKS.length) % TRACKS.length; save(); if (AU.playing) startMusic(); musicUI(); }
export function musicUI() {
  const b = $("#musicBtn"); b.classList.toggle("on", AU.playing);
  $("#trackName").textContent = AU.playing ? (FEATURED.has(TRACKS[cfg.track].name) ? "★ " : "") + TRACKS[cfg.track].name : "音乐 · 关";
  document.querySelectorAll(".trk").forEach(e => e.setAttribute("aria-pressed", String(+e.dataset.i === cfg.track)));
}
