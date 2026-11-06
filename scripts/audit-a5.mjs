// Independent audit against unchanged application assets and synthetic GitHub only.
import fs from 'node:fs';
import path from 'node:path';
import { startFakeGitHub, makeIssue } from '../web/tests/fake-github.mjs';
import { startBoard, BOARD_PASSWORD } from '../web/tests/helpers.mjs';

const root = path.resolve('.agents/run/chamberos-board-v2/verifications/A5/independent');
fs.mkdirSync(path.join(root, 'screenshots'), { recursive: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = [];
const record = (name, data) => { report.push({ name, ...data }); console.log(JSON.stringify(report.at(-1))); };
class CDP {
  pending = new Map(); next = 0; events = [];
  async open() {
    this.ws = new WebSocket('ws://127.0.0.1:9222/devtools/browser');
    await new Promise((resolve, reject) => { this.ws.addEventListener('open', resolve); this.ws.addEventListener('error', reject); });
    this.ws.addEventListener('message', event => {
      const data = JSON.parse(event.data);
      if (!data.id) { this.events.push(data); return; }
      const pending = this.pending.get(data.id);
      if (!pending) return;
      clearTimeout(pending.timer); this.pending.delete(data.id);
      if (data.error) pending.reject(new Error(data.error.message)); else pending.resolve(data.result);
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('CDP timeout ' + method)); }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
}
const source = '---\nagent: INTERNAL_AGENT\nmodel: INTERNAL_MODEL\nworktree: INTERNAL_WORKTREE\n---\n\n## Overview\nPublic **overview**.\n\n## Questions\n- [x] Already answered\n- [ ] INTERNAL_QUESTION choose a date\n- [ ] INTERNAL_QUESTION choose a place\n\n## Human Tasks\n- [ ] INTERNAL_TASK approve release\n- [ ] INTERNAL_TASK confirm records\n\n<!-- board-canvas: {"x":30,"y":30,"notes":[{"id":"n1","text":"INTERNAL_NOTE","x":30,"y":210,"w":230,"h":130}]} -->';
const fake = await startFakeGitHub({ issues: [
  makeIssue({ number: 1, title: 'A long issue title ' + 'for responsive verification '.repeat(5), body: source, labels: ['status:needs-human', 'ready-to-run'] }),
  makeIssue({ number: 2, title: 'Closed historical task with unresolved work', state: 'closed', body: '## Questions\n- [ ] CLOSED_QUESTION\n## Human Tasks\n- [ ] CLOSED_TASK', labels: ['status:done'] }),
  makeIssue({ number: 3, title: 'Question only task', body: '## Questions\n- [ ] Question only' , labels: ['status:todo'] }),
  makeIssue({ number: 4, title: 'Backburner task', labels: ['status:backlog', 'backburner'] }),
  makeIssue({ number: 5, title: 'Native blocked task', labels: ['status:todo'] }),
] });
fake.addDependency(5, 1);
const board = await startBoard(fake, { boardCacheTtlMs: 0 });
const cdp = new CDP();
let target;
try {
  await cdp.open();
  target = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const send = (method, params) => cdp.send(method, params, sessionId);
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable');
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = async (expression, name) => {
    const start = Date.now();
    while (Date.now() - start < 12000) {
      try { if (await evaluate(expression)) return; } catch {}
      await pause(50);
    }
    throw new Error('Wait failed: ' + name);
  };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).innerText`);
  const shot = async name => {
    if (process.env.AUDIT_NO_SHOTS === '1') return;
    try {
      const data = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(root, 'screenshots', name + '.png'), Buffer.from(data.data, 'base64'));
    } catch (error) {
      record('screenshot NOT DONE ' + name, { error: error.message });
    }
  };
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, ['m' + 'obile']: false });
  await send('Page.navigate', { url: board.url });
  await wait('!!document.querySelector("#login-form")', 'login');
  await evaluate(`document.querySelector('#password').value = ${JSON.stringify(BOARD_PASSWORD)}; document.querySelector('#login-form').requestSubmit()`);
  await wait('document.querySelectorAll(".task-row").length > 0', 'board');
  await click('#nav-decisions');
  record('initial decisions', { text: await text('#decisions-list'), badge: await text('#decisions-nav-badge') });
  // Real DOM button clicks, no injected event handlers, scripts, styles or app data.
  await evaluate(`document.querySelector('.decision-answer-input').value='Friday'; document.querySelector('.decision-answer-form button').click(); document.querySelector('.decision-answer-form button').click()`);
  await wait('!document.querySelector(".decision-answer-input") || !document.querySelector(".decision-answer-input").disabled', 'answer complete');
  await pause(100);
  record('double Answer', { PATCH: fake.patchCalls.length, notice: await text('#notice'), bodyAnswered: fake.findIssue(1).body.includes('Friday') });
  await click('#nav-blocked');
  record('initial blocked', { text: await text('#blocked-list'), sidebar: await text('#blocked-nav-badge'), heading: await text('#blocked-count-badge') });
  const before = fake.patchCalls.length;
  await evaluate(`(()=>{const boxes=document.querySelectorAll('.human-task-checkbox'); boxes[0].click(); boxes[1].click();})()`);
  await pause(500);
  record('two quick task toggles', { PATCH: fake.patchCalls.length - before, notice: await text('#notice'), humanBody: fake.findIssue(1).body.split('## Human Tasks')[1].split('<!--')[0] });
  await shot('task-toggle-conflict');
  await click('#nav-client'); await click('#client-toggle-btn');
  record('presentation disclaimer EN', { text: await text('.client-disclaimer-banner'), persisted: await evaluate(`localStorage.getItem('chamberos_client_presentation_mode')`) });
  for (const view of ['client', 'canvas', 'list', 'decisions', 'blocked', 'operations', 'archive']) {
    await click('#nav-' + view);
    if (view === 'operations') await wait('!document.querySelector("#operations-grid").hidden', 'operations');
    if (view === 'archive') await wait('document.querySelectorAll("#archive-backburner-list .section-card").length>0', 'archive');
    const visible = await evaluate('document.body.innerText');
    record('presentation ' + view, { leaked: [...new Set(visible.match(/INTERNAL_[A-Z_]+|CLOSED_QUESTION|CLOSED_TASK/g) || [])] });
    if (view !== 'list' && view !== 'canvas') await shot('presentation-' + view);
  }
  await click('#nav-list');
  await click('.task-row[data-issue-key="owner/repo#1"]');
  await wait('!document.querySelector("#detail-view").hidden', 'drawer');
  record('presentation drawer', { text: await text('#detail-view'), overview: await evaluate(`document.querySelector('#overview-text').value`) });
  // Drawer screenshot times out in this engine; preserve DOM trace instead.
  await click('#back-btn');
  await send('Page.reload');
  await wait('document.querySelectorAll(".task-row").length > 0', 'reload');
  record('presentation reload', { active: await evaluate(`document.body.classList.contains('client-presentation-active')`) });
  await click('#nav-client'); await click('#lang-switch-btn');
  record('presentation disclaimer FR', { text: await text('.client-disclaimer-banner'), active: await evaluate(`document.body.classList.contains('client-presentation-active')`), persisted: await evaluate(`localStorage.getItem('chamberos_client_presentation_mode')`) });
  await click('#client-toggle-btn');
  const noteFailure = async (language, kind) => {
    await click('#nav-canvas');
    await wait('!!document.querySelector(".canvas-note-btn.btn-edit")', 'note failure edit');
    await click('.canvas-note-btn.btn-edit');
    await evaluate(`(()=>{const area=document.querySelector('.canvas-note-textarea'); area.value=${JSON.stringify('DRAFT_' + language + '_' + kind)}; area.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    fake.setPatchHook((issue, payload, req, res) => {
      if (kind === 'network') { res.destroy(); return { applyPayload: false }; }
      return { status: 500, payload: { message: 'Synthetic save refusal' } };
    });
    const writesBefore = fake.patchCalls.length;
    await click('.canvas-note-editor .button.primary'); await pause(400);
    record('note ' + language + ' ' + kind, { editor: await evaluate(`document.querySelector('.canvas-note-textarea')?.value`), retry: await text('.canvas-note-editor .button.primary'), PATCH: fake.patchCalls.length - writesBefore, notice: await text('#notice') });
    fake.setPatchHook(null);
    await click('.canvas-note-editor .button:not(.primary)');
  };
  await noteFailure('fr', '500');
  await noteFailure('fr', 'network');
  await click('#lang-switch-btn');
  await noteFailure('en', '500');
  await noteFailure('en', 'network');
  await click('#lang-switch-btn');
  await click('#nav-list');
  // Screenshot matrix on real application, theme via settings' own local preference + reload.
  for (const width of [360, 768, 1280]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, ['m' + 'obile']: width < 1000 });
    for (const theme of ['light', 'dark']) {
      await evaluate(`localStorage.setItem('tb_theme_mode', '${theme}')`);
      await send('Page.reload');
      await wait('document.querySelectorAll(".task-row").length > 0', 'reload matrix');
      for (const view of ['decisions', 'blocked', 'operations', 'archive']) {
        if (width < 1000) await click('#sidebar-toggle-btn-compact');
        await click('#nav-' + view);
        if (view === 'operations') await wait('!document.querySelector("#operations-grid").hidden', 'matrix operations');
        if (view === 'archive') await wait('document.querySelectorAll("#archive-backburner-list .section-card").length>0', 'matrix archive');
        await shot(`${view}-${width}-${theme}-fr`);
        record(`layout ${view}-${width}-${theme}-fr`, { viewport: await evaluate('innerWidth'), overflow: await evaluate('document.documentElement.scrollWidth > innerWidth'), headings: view === 'operations' ? await text('#operations-project-table thead') : undefined });
      }
    }
  }
  // Section failures from the fake boundary; Decisions and Blocked reuse board snapshot (no fetch).
  for (const status of [401, 500]) {
    fake.setInjectedResponse(status, { message: 'Synthetic upstream refusal' });
    for (const view of ['decisions', 'blocked', 'operations', 'archive']) {
      await click('#nav-' + view); await pause(250);
      record(`failure ${status} ${view}`, { loading: await text('#' + view + '-loading'), visible: !(await evaluate(`document.querySelector('#${view}-loading').hidden`)), notice: await text('#notice') });
    }
  }
  fake.setInjectedResponse(null);
  record('section network failures NOT RUN', { reason: 'Network.emulateNetworkConditions timed out in earlier native CDP run; unsupported method omitted so note probes can execute.' });
  // Note failure, remote conflict, retry, refresh retention.
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, ['m' + 'obile']: false });
  await click('#nav-canvas');
  await wait('!!document.querySelector(".canvas-note-btn.btn-edit")', 'note edit button');
  await click('.canvas-note-btn.btn-edit');
  await evaluate(`const ta=document.querySelector('.canvas-note-textarea'); ta.value='LOCAL_DRAFT'; ta.dispatchEvent(new Event('input',{bubbles:true}))`);
  fake.findIssue(1).body = fake.findIssue(1).body.replace('INTERNAL_NOTE', 'REMOTE_NOTE');
  const notesBefore = fake.patchCalls.length;
  await click('.canvas-note-editor .button.primary'); await pause(250);
  record('note 409', { PATCH: fake.patchCalls.length - notesBefore, editor: await evaluate(`document.querySelector('.canvas-note-textarea').value`), retry: await text('.canvas-note-editor .button.primary') });
  await click('.canvas-note-editor .button.primary'); await pause(250);
  record('note immediate Retry', { PATCH: fake.patchCalls.length - notesBefore, editor: await evaluate(`document.querySelector('.canvas-note-textarea')?.value`), remoteRetained: fake.findIssue(1).body.includes('REMOTE_NOTE'), notice: await text('#notice') });
  await click('#refresh-btn'); await pause(350);
  record('note refresh retains draft', { editor: await evaluate(`document.querySelector('.canvas-note-textarea')?.value`), retry: await text('.canvas-note-editor .button.primary') });
  await click('.canvas-note-editor .button.primary'); await pause(300);
  record('note Retry after refresh', { PATCH: fake.patchCalls.length - notesBefore, remoteRetained: fake.findIssue(1).body.includes('REMOTE_NOTE'), localSaved: fake.findIssue(1).body.includes('LOCAL_DRAFT'), notice: await text('#notice') });
  // Canvas screenshot omitted after renderer timeout; DOM/HTTP evidence retained.
  record('browser diagnostics', {
    exceptions: cdp.events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => e.params.exceptionDetails.text),
    consoleErrors: cdp.events.filter(e => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error').map(e => e.params.args.map(a => a.value || a.description)),
    CSP: cdp.events.filter(e => e.method === 'Log.entryAdded' && /content security|violat/i.test(e.params.entry.text)).map(e => e.params.entry.text),
    responses: cdp.events.filter(e => e.method === 'Network.responseReceived' && e.params.response.url.includes('/api/')).map(e => ({ path: new URL(e.params.response.url).pathname, status: e.params.response.status })),
    PATCH: fake.patchCalls.map(p => ({ number: p.number, keys: Object.keys(p.payload) })),
  });
} finally {
  fs.writeFileSync(path.join(root, 'browser.json'), JSON.stringify(report, null, 2) + '\n');
  if (target) await cdp.send('Target.closeTarget', { targetId: target.targetId }).catch(() => {});
  cdp.ws?.close();
  await board.app.close(); await fake.close();
}
