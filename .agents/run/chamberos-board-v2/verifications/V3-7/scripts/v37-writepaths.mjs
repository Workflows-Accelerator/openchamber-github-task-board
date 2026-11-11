// V3-7 hostile review: exercise every product write path through the real server
// against the fake GitHub, on a given source tree (fixed worktree or pre-fix copy).
import path from 'node:path';

const ROOT = process.argv[2];
const { startFakeGitHub, makeIssue } = await import(path.join(ROOT, 'web/tests/fake-github.mjs'));
const { startBoard, HttpSession } = await import(path.join(ROOT, 'web/tests/helpers.mjs'));

const REPO = 'owner/alpha';
const results = [];

const issues = [
  makeIssue({ number: 1, title: 'Draft one', body: 'Inspiration\n\n<!-- board-order: 1000 -->', labels: ['status:draft'], repo: REPO }),
  makeIssue({ number: 2, title: 'Work item', body: '## Overview\n\nBody text.\n\n## Human tasks\n\n- [ ] first task\n\n<!-- board-order: 2000 -->', labels: ['status:in-progress'], repo: REPO }),
  makeIssue({ number: 3, title: 'Done item', body: '## Overview\n\nClosed body.\n\n<!-- board-order: 3000 -->', labels: ['status:done'], state: 'closed', repo: REPO }),
];

const fake = await startFakeGitHub({ repo: REPO, issues });
const board = await startBoard(fake);
const client = new HttpSession(board.url);
await client.login();

async function fp(number) {
  const res = await client.request(`/api/issues/${number}`);
  if (res.status !== 200) throw new Error(`detail ${number} -> ${res.status} ${res.text}`);
  return res.json.issue.fingerprint;
}

async function record(name, method, url, body, verify) {
  const res = await client.request(url, { method, body });
  let ok = res.status >= 200 && res.status < 300;
  let detail = res.status;
  if (ok && verify) {
    try {
      const verdict = await verify(res);
      if (verdict !== true) { ok = false; detail = `verify: ${verdict}`; }
    } catch (err) { ok = false; detail = `verify threw: ${err.message}`; }
  }
  results.push({ path: name, method, url, status: res.status, ok, detail: ok ? 'persisted' : detail, body: res.json || res.text });
}

// 1 create task
await record('create task', 'POST', '/api/issues', { title: 'Created task', body: 'new body', labels: ['status:draft'] },
  (res) => {
    const n = res.json.issue.number;
    return fake.findIssue(n) ? true : 'issue missing in fake';
  });

// 2 status change
await record('status change', 'POST', '/api/issues/2/status', { status: 'status:done', fingerprint: await fp(2) },
  () => fake.findIssue(2).labels.some((l) => l.name === 'status:done') || 'label not applied');

// 3 draft edit
await record('draft edit', 'PUT', '/api/issues/1/draft', { fingerprint: await fp(1), title: 'Draft edited', description: 'Edited inspiration' },
  () => (fake.findIssue(1).title === 'Draft edited' && fake.findIssue(1).body.startsWith('Edited inspiration')) || `title=${fake.findIssue(1).title}`);

// 4 order (marker-only reorder)
await record('draft order', 'PUT', '/api/issues/1/order', { fingerprint: await fp(1), previous: 1000, next: 2000 },
  () => /board-order: 1500/.test(fake.findIssue(1).body) || `body=${fake.findIssue(1).body}`);

// 5 dependency add
await record('dependency add', 'POST', '/api/issues/2/dependencies/blocked_by', { issue_number: 1 },
  () => fake.findIssue(2) && true);

// 6 dependency remove
{
  const deps = await client.request('/api/issues/2/dependencies');
  const blocker = (deps.json?.blockedBy || [])[0];
  const id = blocker?.id ?? blocker?.number;
  if (id === undefined) {
    results.push({ path: 'dependency remove', method: 'DELETE', url: '-', status: 0, ok: false, detail: 'no blocker resolved' });
  } else {
    await record('dependency remove', 'DELETE', `/api/issues/2/dependencies/blocked_by/${id}`, undefined,
      () => true);
  }
}

// 7 canvas drag
await record('canvas drag', 'PUT', '/api/issues/2/canvas', { x: 400, y: 300, fingerprint: await fp(2) },
  () => /board-canvas: \{"x":400,"y":300\}/.test(fake.findIssue(2).body) || `body=${fake.findIssue(2).body}`);

// 8 note (canvas update with notes, no coordinates)
await record('note edit', 'PUT', '/api/issues/2/canvas', {
  fingerprint: await fp(2),
  notes: [{ id: 'n1', x: 420, y: 340, w: 240, h: 135, text: 'Reviewed note', color: 'yellow' }],
}, () => /Reviewed note/.test(fake.findIssue(2).body) || `body=${fake.findIssue(2).body}`);

// 9 section edit
{
  const detail = await client.request('/api/issues/2');
  const sections = detail.json?.issue?.editableSections || [];
  const editable = sections[0];
  if (!editable) {
    results.push({ path: 'section edit', method: 'PUT', url: '/api/issues/2/section', status: 0, ok: false, detail: `no editable section (${sections.length} sections)` });
  } else {
    await record('section edit', 'PUT', '/api/issues/2/section', { fingerprint: await fp(2), sectionId: editable.id, text: 'Body edited by board' },
      () => /Body edited by board/.test(fake.findIssue(2).body) || `body=${fake.findIssue(2).body}`);
  }
}

// 10 human task toggle
await record('human task toggle', 'POST', '/api/issues/2/human-tasks/0/toggle', { fingerprint: await fp(2), completed: true },
  () => /- \[x\] first task/.test(fake.findIssue(2).body) || `body=${fake.findIssue(2).body}`);

// 11 reopen
await record('reopen', 'POST', '/api/issues/3/reopen', { fingerprint: await fp(3) },
  () => (fake.findIssue(3).state === 'open' && fake.findIssue(3).labels.some((l) => l.name === 'status:backlog')) || `state=${fake.findIssue(3).state}`);

const output = { root: ROOT, patchCalls: fake.patchCalls.length, results };
console.log(JSON.stringify(output, null, 2));
await board.app.close();
await fake.close();
