// Hostile2 criterion 4: which CDP diagnostic events does Obscura (the smoke script's browser) actually emit?
// The smoke script listens only to Runtime.exceptionThrown and Log.entryAdded.
const ws = new WebSocket('ws://127.0.0.1:9222/devtools/browser');
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map(); const seen = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method && /exception|console|entryAdded|Log\./i.test(m.method)) seen.push({ method: m.method, text: JSON.stringify(m.params).slice(0, 160) });
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
};
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const enabled = {};
for (const d of ['Page.enable', 'Runtime.enable', 'Log.enable']) {
  try { await send(d, {}, sessionId); enabled[d] = 'ok'; } catch (e) { enabled[d] = 'error: ' + e.message; }
}
const html = '<!doctype html><script>console.error("probe console.error"); setTimeout(function(){ throw new Error("probe uncaught timer") }, 0); Promise.reject(new Error("probe unhandled rejection"));</script><script>throw new Error("probe uncaught inline")</script>';
await send('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(html).toString('base64') }, sessionId);
await sleep(1500);
await send('Runtime.evaluate', { expression: 'console.error("probe evaluate console.error"); setTimeout(() => { throw new Error("probe evaluate timer throw") }, 0); 1' }, sessionId).catch(() => {});
await sleep(1000);
await send('Target.closeTarget', { targetId }).catch(() => {});
ws.close();
console.log(JSON.stringify({ enabled, eventsSeen: seen,
  exceptionThrownCount: seen.filter((s) => s.method === 'Runtime.exceptionThrown').length,
  logEntryAddedCount: seen.filter((s) => s.method === 'Log.entryAdded').length,
  consoleAPICalledCount: seen.filter((s) => s.method === 'Runtime.consoleAPICalled').length }, null, 1));
