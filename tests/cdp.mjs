// 极简 CDP 客户端（自动测试用）：启动无头 Chrome，打开页面，提供 send / on
import { spawn } from 'child_process'; import path from 'path'; import os from 'os'; import fs from 'fs';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
async function launch(port = 9333, w = 1280, h = 720) {
  const base = fs.existsSync('D:/') ? 'D:/pharm-test-tmp' : os.tmpdir(); fs.mkdirSync(base, { recursive: true });
  if (base !== os.tmpdir()) for (const n of fs.readdirSync(base)) if (n.startsWith('cdp-')) { try { fs.rmSync(path.join(base, n), { recursive: true, force: true }); } catch {} }   // 只清理本脚本在 D 盘留下的旧配置（被占用的会跳过）
  const dir = fs.mkdtempSync(path.join(base, 'cdp-'));   // C 盘空间紧张：临时浏览器配置放 D 盘
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, `--window-size=${w},${h}`,
    '--hide-scrollbars', '--mute-audio', '--force-device-scale-factor=1', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  let list;
  for (let i = 0; i < 50; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.find(t => t.type === 'page')) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  const pg = list.find(t => t.type === 'page');
  const ws = new WebSocket(pg.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(), subs = {};
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id) { const p = pend.get(d.id); pend.delete(d.id); d.error ? p[1](new Error(d.error.message)) : p[0](d.result); } else (subs[d.method] || []).forEach(f => f(d.params)); };
  const send = (method, params = {}) => new Promise((ok, no) => { pend.set(++id, [ok, no]); ws.send(JSON.stringify({ id, method, params })); });
  const on = (ev, f) => (subs[ev] = subs[ev] || []).push(f);
  const once = ev => new Promise(r => { const f = p => { subs[ev] = subs[ev].filter(x => x !== f); r(p); }; on(ev, f); });
  const close = () => { try { ws.close(); } catch {} proc.kill(); setTimeout(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }, 1500); };   // 用完删掉临时配置
  return { send, on, once, close };
}
export { launch };
