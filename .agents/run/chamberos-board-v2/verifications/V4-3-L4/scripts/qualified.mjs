// V4-3-L4 qualified-route attack: every write path also exists under
// /api/repos/:owner/:name. The guard must hold there too, with zero writes.
//
//   node scripts/qualified.mjs

import { startFakeGitHub, makeIssue } from '../../../../../../web/tests/fake-github.mjs';
import { startBoard, browserConfig, HttpSession, SYNTHETIC_TOKEN } from '../../../../../../web/tests/helpers.mjs';

const IMAGE = '### Human Review:\n- Artifact: image\n- URL: https://example.com/a.png\n- Instruction: Look.\n';
const noArtifact = '## Overview\n\nNothing to click.\n';
const fake = await startFakeGitHub({
  token: SYNTHETIC_TOKEN,
  repositories: [
    {
      repo: 'owner/alpha',
      id: 101,
      issues: [
        makeIssue({ number: 1, body: noArtifact, labels: ['status:todo'] }),
        makeIssue({ number: 2, body: IMAGE, labels: ['status:needs-human'] }),
        makeIssue({ number: 3, body: noArtifact, state: 'closed', labels: ['status:needs-human'] }),
      ],
    },
  ],
});
const board = await startBoard(fake, { config: browserConfig(fake, {}) });
const out = [];
try {
  const session = new HttpSession(board.url);
  await session.login();
  const read = async (number) => (await session.request(`/api/repos/owner/alpha/issues/${number}`)).json.issue;
  const writes = () => fake.requests.filter((request) => request.method !== 'GET').length;
  const stored = (number) => fake.issues.find((issue) => issue.number === number);
  const run = async (name, fn) => {
    const before = writes();
    const response = await fn();
    out.push({ name, status: response?.status, error: response?.json?.error, writes: writes() - before });
  };

  await run('qualified create needs-human with no artifact', () => session.request('/api/repos/owner/alpha/issues', {
    method: 'POST', body: { title: 'Qualified born waiting', body: noArtifact, labels: ['status:needs-human'] },
  }));
  await run('qualified status needs-human with no artifact', async () => {
    const current = await read(1);
    return session.request('/api/repos/owner/alpha/issues/1/status', { method: 'POST', body: { status: 'status:needs-human', fingerprint: current.fingerprint } });
  });
  await run('qualified PATCH state open on a closed waiting task', async () => {
    const current = await read(3);
    return session.request('/api/repos/owner/alpha/issues/3', { method: 'PATCH', body: { fingerprint: current.fingerprint, state: 'open' } });
  });
  await run('qualified PATCH body removing a ready gate', async () => {
    const current = await read(2);
    return session.request('/api/repos/owner/alpha/issues/2', { method: 'PATCH', body: { fingerprint: current.fingerprint, body: noArtifact } });
  });
  await run('qualified /reopen on a closed legacy waiting task', async () => {
    const current = await read(3);
    return session.request('/api/repos/owner/alpha/issues/3/reopen', { method: 'POST', body: { fingerprint: current.fingerprint } });
  });
  out.push({
    name: 'final stored state',
    issues: fake.issues.map((issue) => ({ number: issue.number, state: issue.state, labels: issue.labels.map((label) => label.name), body: issue.body.slice(0, 40) })),
  });
} finally {
  await board.app.close();
  await fake.close();
}
console.log(JSON.stringify(out, null, 2));
