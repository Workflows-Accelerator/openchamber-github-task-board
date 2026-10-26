// Synthetic browser acceptance: picker, combined writes, identity, persistence,
// partial/unavailable/archived/empty/discovery-failed states at desktop and 360px.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { startFakeGitHub, makeIssue } from '../../../../../web/tests/fake-github.mjs';
import { startBoard, BOARD_PASSWORD } from '../../../../../web/tests/helpers.mjs';
const proof = path.dirname(new URL(import.meta.url).pathname);
const baseline = await readFile(path.join(proof, 'browser-baseline.mjs'), 'utf8');
const helper = baseline.slice(baseline.indexOf('class CDP {'), baseline.indexOf('function fixtures()'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const CDP_PORT = 9387;
const { CDP, ensureObscura } = new Function('WebSocket', 'fetch', 'spawn', 'CDP_PORT', 'sleep', helper + ';return {CDP,ensureObscura};')(WebSocket, fetch, spawn, CDP_PORT, sleep);
const body = '## Overview\nOriginal\n\n## Open Questions\n- [ ] Decide?\n';
const repositories = [
  { repo: 'owner/alpha', id: 101, issues: [makeIssue({ number: 1, title: 'Alpha task', body, repo: 'owner/alpha', labels: ['status:todo'] })] },
  { repo: 'owner/beta', id: 102, issues: [makeIssue({ number: 1, title: 'Beta task', body, repo: 'owner/beta', labels: ['status:todo'] })] },
  { repo: 'owner/archived', id: 103, archived: true, issues: [makeIssue({ number: 1, title: 'Archived task', body, repo: 'owner/archived' })] },
  { repo: 'owner/empty', id: 104, issues: [] },
];
const fake = await startFakeGitHub({ repositories });
const board = await startBoard(fake, { repositoryTtlMs: 0 });
const browser = await ensureObscura();
const cdp = new CDP(`ws://127.0.0.1:${CDP_PORT}/devtools/browser`); await cdp.open();
const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
const send = (method, params) => cdp.send(method, params, sessionId);
await send('Page.enable'); await send('Runtime.enable');
const results = [], screenshots = [];
async function ev(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function wait(expression) {
  for (let i = 0; i < 200; i++) { if (await ev(expression)) return; await sleep(50); }
  throw new Error('Timeout: ' + expression + ' ' + await ev('document.body.innerText'));
}
async function check(name, expression) { const value = await ev(expression); assert.ok(value, name); results.push({ name, pass: true }); }
async function choose(value) {
  await ev(`document.getElementById('repo-select').value=${JSON.stringify(value)};document.getElementById('repo-select').dispatchEvent(new Event('change'))`);
  await wait(`document.getElementById('repo-label').textContent.includes(${JSON.stringify(value === 'all' ? 'All repositories' : value)}) && !document.getElementById('refresh-btn').disabled`);
}
async function shot(name) {
  for (const width of [1280, 360]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: width === 360 ? 800 : 900, deviceScaleFactor: 1, mobile: width === 360 });
    await check(name + '/' + width + ' no overflow', 'document.documentElement.scrollWidth <= innerWidth');
    const image = await send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(proof, 'screenshots', name + '-' + width + '.png');
    await writeFile(file, Buffer.from(image.data, 'base64')); screenshots.push(file);
  }
}
async function open(title) {
  await ev(`Array.from(document.querySelectorAll('.task-row')).find(row=>row.innerText.includes(${JSON.stringify(title)})).click()`);
  await wait(`!document.getElementById('detail-view').hidden && document.getElementById('detail-title').textContent === ${JSON.stringify(title)}`);
}
async function back() { await ev("document.getElementById('back-btn').click()"); await wait("!document.getElementById('board-view').hidden"); }
try {
  await mkdir(path.join(proof, 'screenshots'), { recursive: true });
  await send('Page.navigate', { url: board.url });
  await wait("document.getElementById('login-form')");
  await ev(`document.getElementById('password').value=${JSON.stringify(BOARD_PASSWORD)};document.getElementById('login-form').requestSubmit()`);
  await wait("document.querySelector('.task-row')");
  await check('all four repository identities available', "document.querySelectorAll('#repo-select option').length===5");
  await choose('all');
  await check('same-number combined rows separate with labels', "document.querySelectorAll('.task-row').length===3 && document.getElementById('task-list').innerText.includes('owner/alpha') && document.getElementById('task-list').innerText.includes('owner/beta')");
  await shot('combined');
  await open('Alpha task');
  await ev("document.getElementById('overview-text').value='Alpha draft';document.getElementById('answer-0').value='Alpha answer'");
  await back(); await open('Beta task');
  await check('beta receives neither alpha draft', "document.getElementById('overview-text').value==='Original' && document.getElementById('answer-0').value===''");
  await ev("document.getElementById('overview-text').value='Beta saved';document.getElementById('save-overview').click()");
  await wait("document.getElementById('save-status').textContent==='Saved just now.'");
  assert.equal(fake.patchCalls.length, 1); assert.equal(fake.patchCalls[0].repo, 'owner/beta');
  assert.match(fake.findIssue(1, 'owner/beta').body, /Beta saved/); assert.doesNotMatch(fake.findIssue(1, 'owner/alpha').body, /Beta saved/);
  results.push({ name: 'combined write reaches beta only', pass: true });
  await back(); await open('Alpha task');
  await check('alpha drafts survive same-number navigation', "document.getElementById('overview-text').value==='Alpha draft' && document.getElementById('answer-0').value==='Alpha answer'");
  await back(); await choose('owner/archived');
  await check('archived explicitly marked', "document.getElementById('scope-status').textContent.includes('Archived') && Array.from(document.getElementById('repo-select').options).find(option=>option.value===document.getElementById('repo-select').value).textContent.includes('archived')");
  await shot('archived');
  await choose('owner/empty'); await shot('empty');
  await check('honest empty state', "document.getElementById('empty-state').innerText.includes('No tasks in owner/empty')");
  await choose('owner/beta');
  await send('Page.navigate', { url: board.url });
  await wait("document.getElementById('repo-label').textContent==='owner/beta'");
  await check('last repository remembered without repository name in storage or URL', "localStorage.length===1 && /^[a-f0-9]{64}$/.test(localStorage.getItem('board-repository-choice')) && sessionStorage.length===0 && !location.href.includes('owner') && document.cookie===''");
  await choose('all'); fake.setRepoFailing('owner/beta', true);
  await ev("document.getElementById('refresh-btn').click()");
  await wait("document.getElementById('scope-status').textContent.includes('NOT complete')");
  await check('partial failure names unavailable member', "document.getElementById('scope-status').textContent.includes('owner/beta') && document.querySelectorAll('.task-row').length===2");
  await shot('partial'); fake.setRepoFailing('owner/beta', false);
  await choose('owner/beta'); fake.setRepoAccessible('owner/beta', false);
  await ev("document.getElementById('refresh-btn').click()");
  await wait("document.getElementById('scope-status').textContent.includes('unavailable')");
  await check('lost access retained identity, never empty', "Array.from(document.getElementById('repo-select').options).find(option=>option.value===document.getElementById('repo-select').value).textContent.includes('unavailable') && document.querySelectorAll('.task-row').length===0 && document.getElementById('empty-state').innerText.includes('not an empty')");
  await shot('unavailable'); fake.setDiscoveryFailure(true);
  await ev("document.getElementById('refresh-btn').click()");
  await wait("document.getElementById('discovery-status').textContent.includes('Discovery failed')");
  await check('failed discovery retains picker identities', "document.querySelectorAll('#repo-select option').length===5");
  await shot('discovery-failed');
  assert.equal(board.logs.some(line => /owner\/alpha|owner\/beta|owner\/archived|owner\/empty/.test(line)), false);
  results.push({ name: 'new qualified paths are redacted in logs', pass: true });
  await ev("document.getElementById('signout-btn').click()");
  await wait("!document.getElementById('login-view').hidden");
  await check('signout removes issue and repository DOM', "document.querySelectorAll('.task-row').length===0 && document.getElementById('repo-select').options.length===0");
} finally {
  await writeFile(path.join(proof, 'multi-browser.json'), JSON.stringify({ results, screenshots, summary: { checks: results.length, passed: results.filter(r=>r.pass).length }, runtimeErrors: cdp.events.filter(e=>e.method==='Runtime.exceptionThrown') }, null, 2));
  await send('Target.closeTarget', { targetId: target.targetId }).catch(()=>{}); cdp.close();
  await board.app.close(); await fake.close(); if (browser.started) process.kill(-browser.child.pid);
}
console.log(JSON.stringify({ checks: results.length, screenshots: screenshots.length }));
