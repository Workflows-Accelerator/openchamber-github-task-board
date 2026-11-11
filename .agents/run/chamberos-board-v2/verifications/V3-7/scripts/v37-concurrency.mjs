// V3-7 hostile review: concurrency guarantees after If-Match removal.
import path from 'node:path';
const ROOT = process.argv[2];
const { startFakeGitHub, makeIssue } = await import(path.join(ROOT, 'web/tests/fake-github.mjs'));
const { startBoard, HttpSession } = await import(path.join(ROOT, 'web/tests/helpers.mjs'));

const REPO = 'owner/alpha';
const fixture = (n, body, labels) => makeIssue({ number: n, title: `Issue ${n}`, body, labels, repo: REPO });

const fake = await startFakeGitHub({
  repo: REPO,
  issues: [
    fixture(1, 'Alpha body\n\n<!-- board-order: 1000 -->', ['status:in-progress']),
    fixture(2, 'Beta body\n\n<!-- board-order: 2000 -->', ['status:in-progress']),
    fixture(3, 'Gamma body\n\n<!-- board-order: 3000 -->', ['status:in-progress']),
    fixture(4, 'Delta body\n\n<!-- board-order: 4000 -->', ['status:in-progress']),
  ],
});
const board = await startBoard(fake);
const tabA = new HttpSession(board.url);
const tabB = new HttpSession(board.url);
await tabA.login();
await tabB.login();

async function fp(client, n) {
  const res = await client.request(`/api/issues/${n}`);
  if (res.status !== 200) throw new Error(`detail ${n} ${res.status} ${res.text}`);
  return res.json.issue.fingerprint;
}

const out = {};

// 1. two tabs editing the same card with the same observed fingerprint
{
  const f = await fp(tabA, 1);
  const before = fake.patchCalls.length;
  const [a, b] = await Promise.all([
    tabA.request('/api/issues/1/canvas', { method: 'PUT', body: { x: 100, y: 100, fingerprint: f } }),
    tabB.request('/api/issues/1/canvas', { method: 'PUT', body: { x: 900, y: 900, fingerprint: f } }),
  ]);
  out.twoTabs = {
    statuses: [a.status, b.status].sort(),
    errors: [a.json?.error, b.json?.error].filter(Boolean),
    patches: fake.patchCalls.length - before,
    finalBody: fake.findIssue(1).body,
  };
}

// 2. drag racing a status change, same observed fingerprint
{
  const f = await fp(tabA, 2);
  const before = fake.patchCalls.length;
  const [drag, status] = await Promise.all([
    tabA.request('/api/issues/2/canvas', { method: 'PUT', body: { x: 50, y: 60, fingerprint: f } }),
    tabB.request('/api/issues/2/status', { method: 'POST', body: { status: 'status:done', fingerprint: f } }),
  ]);
  out.dragVsStatus = {
    drag: drag.status,
    status: status.status,
    errors: [drag.json?.error, status.json?.error].filter(Boolean),
    patches: fake.patchCalls.length - before,
    finalLabels: fake.findIssue(2).labels.map((l) => l.name),
    finalBody: fake.findIssue(2).body,
    consistent:
      (drag.status === 200 && status.status === 409) || (status.status === 200 && drag.status === 409),
  };
}

// 3. body-deleting (section clear) write racing a note write
{
  const f = await fp(tabA, 3);
  const detail = await tabA.request('/api/issues/3');
  const section = (detail.json.issue.editableSections || [])[0];
  const before = fake.patchCalls.length;
  const [clear, note] = await Promise.all([
    tabA.request('/api/issues/3/section', { method: 'PUT', body: { fingerprint: f, sectionId: section ? section.id : 'overview', text: '' } }),
    tabB.request('/api/issues/3/canvas', { method: 'PUT', body: { fingerprint: f, notes: [{ id: 'n1', x: 10, y: 10, text: 'Racing note', w: 240, h: 135 }] } }),
  ]);
  out.sectionVsNote = {
    clear: clear.status,
    note: note.status,
    errors: [clear.json?.error, note.json?.error].filter(Boolean),
    patches: fake.patchCalls.length - before,
    finalBody: fake.findIssue(3).body,
  };
}

// 4. residual window: an external writer lands between the server read and the PATCH
{
  const f = await fp(tabA, 4);
  let fired = 0;
  fake.setBeforePatchHook((issue) => {
    if (fired === 0 && issue.number === 4) {
      fired += 1;
      issue.body = 'EXTERNAL EDIT by another author\n\n<!-- board-order: 4000 -->';
    }
  });
  const before = fake.patchCalls.length;
  const res = await tabA.request('/api/issues/4/canvas', { method: 'PUT', body: { x: 5, y: 5, fingerprint: f } });
  out.externalWriterWindow = {
    status: res.status,
    patches: fake.patchCalls.length - before,
    finalBody: fake.findIssue(4).body,
    externalEditSurvived: /EXTERNAL EDIT/.test(fake.findIssue(4).body),
  };
  fake.setBeforePatchHook(null);
}

console.log(JSON.stringify(out, null, 2));
await board.app.close();
await fake.close();
