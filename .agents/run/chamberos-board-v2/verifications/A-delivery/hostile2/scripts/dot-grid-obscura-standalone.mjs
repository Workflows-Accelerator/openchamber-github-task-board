// Hostile2 criterion 1b: same standalone gradient page rendered by Obscura (CDP :9222), no app code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.resolve(here, '..', 'screenshots');
const ws = new WebSocket('ws://127.0.0.1:9222/devtools/browser');
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', { width: 800, height: 400, deviceScaleFactor: 1, mobile: false }, sessionId);
const out = [];
for (const theme of [{ name: 'light', bg: '#f6f4ee', rgb: '24, 22, 19' }, { name: 'dark', bg: '#151412', rgb: '244, 241, 234' }]) {
  for (const scale of [0.72, 1.0]) {
    const worldStep = scale < 0.35 ? 96 : scale < 0.65 ? 48 : 24;
    const gridStep = worldStep * scale;
    const r = Math.max(0.75, Math.min(2.0, 0.85 + 0.4 * scale));
    const alpha = Math.max(0.10, Math.min(0.18, 0.10 + 0.06 * scale)).toFixed(4);
    const grad = `radial-gradient(rgba(${theme.rgb}, ${alpha}) ${r.toFixed(2)}px, transparent ${r.toFixed(2)}px)`;
    const html = `<!doctype html><html><body style="margin:0;background:${theme.bg}"><div style="width:800px;height:400px;background-color:${theme.bg};background-image:${grad};background-size:${gridStep.toFixed(2)}px ${gridStep.toFixed(2)}px"></div></body></html>`;
    await send('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(html).toString('base64') }, sessionId);
    await sleep(500);
    const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const name = `obscura-standalone-${theme.name}-${String(Math.round(scale * 100)).padStart(3, '0')}.png`;
    fs.writeFileSync(path.join(SHOTS, name), Buffer.from(shot.data, 'base64'));
    out.push({ theme: theme.name, scale, gradient: grad, backgroundSize: gridStep.toFixed(2), screenshot: name });
  }
}
await send('Target.closeTarget', { targetId });
ws.close();
console.log(JSON.stringify(out, null, 1));
