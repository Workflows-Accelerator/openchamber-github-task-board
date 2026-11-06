// Independent read-only API probes; synthetic GitHub and task-owned servers only.
import fs from 'node:fs';
import { startFakeGitHub, makeIssue } from '../web/tests/fake-github.mjs';
import { startBoard, HttpSession } from '../web/tests/helpers.mjs';
import { setCanvasMarker, stripCanvasMarker } from '../web/server/board.ts';

const observations = [];
const record = (name, verdict, details) => {
  observations.push({ name, verdict, ...details });
  console.log(JSON.stringify(observations.at(-1)));
};
async function probe(options, boardOptions, action) {
  const fake = await startFakeGitHub(options);
  const board = await startBoard(fake, boardOptions);
  try {
    const session = new HttpSession(board.url);
    await session.login();
    await action(session, fake);
  } finally {
    await board.app.close();
    await fake.close();
  }
}

let clock = Date.parse('2026-11-06T00:00:00Z');
await probe({ issues: [makeIssue({ number: 1 })] }, { now: () => clock, boardCacheTtlMs: 30000 }, async (session, fake) => {
  const first = await session.request('/api/combined/operations');
  const lists = fake.requests.filter(r => r.path.endsWith('/issues') && r.query).length;
  clock += 1000;
  const next = await session.request('/api/combined/operations');
  const listsAfter = fake.requests.filter(r => r.path.endsWith('/issues') && r.query).length;
  record('combined operations cached fetch time', next.json.fetchedAt === first.json.fetchedAt ? 'PASS' : 'FAIL', {
    first: first.json.fetchedAt, next: next.json.fetchedAt, issueListsBefore: lists, issueListsAfter: listsAfter,
  });
  fake.setRepoFailing('owner/repo', true);
  clock += 60000;
  const failure = await session.request('/api/combined/operations');
  record('combined operations failed-repo metadata', failure.json.partial && failure.json.failures.length ? 'PASS' : 'FAIL', {
    status: failure.status, partial: failure.json.partial, failures: failure.json.failures.map(f => f.message), fetchedAt: failure.json.fetchedAt,
  });
});

const many = Array.from({ length: 1001 }, (_, index) => makeIssue({
  number: index + 1, state: index === 1000 ? 'closed' : 'open',
  updated_at: '2026-10-01T00:00:00Z', closed_at: index === 1000 ? '2026-11-05T00:00:00Z' : null,
}));
await probe({ issues: many }, {}, async (session, fake) => {
  const repo = await session.request('/api/repos/owner/repo/archive?limit=200');
  const older = await session.request('/api/repos/owner/repo/archive?limit=200&offset=1000');
  const combined = await session.request('/api/combined/archive?limit=200');
  record('closed history beyond all-issues page bound', repo.json.closed.length > 0 ? 'PASS' : 'FAIL', {
    repositoryClosed: repo.json.closed.length, totalClosed: repo.json.totalClosed, hasMore: repo.json.hasMore,
    truncated: repo.json.truncated, partial: repo.json.partial, olderClosed: older.json.closed.length,
    combinedClosed: combined.json.closed.length, combinedTruncated: combined.json.truncated,
    issueListRequests: fake.requests.filter(r => r.path.endsWith('/issues') && r.query).map(r => r.path + r.query),
  });
});

await probe({ issues: [
  makeIssue({ number: 1, state: 'closed', closed_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-06T00:00:00Z' }),
  makeIssue({ number: 2, state: 'closed', closed_at: '2026-11-05T00:00:00Z' }),
  makeIssue({ number: 3, state: 'closed', closed_at: '2026-11-03T00:00:00Z' }),
] }, {}, async session => {
  const first = await session.request('/api/archive?limit=2');
  const second = await session.request('/api/archive?limit=2&offset=2');
  const ids = first.json.closed.concat(second.json.closed).map(i => i.number);
  record('archive closure order and load-more within fetched history', JSON.stringify(ids) === '[2,3,1]' && new Set(ids).size === ids.length ? 'PASS' : 'FAIL', { ids });
  for (const query of ['limit=NaN&offset=-4', 'limit=-1&offset=NaN', 'limit=999999999&offset=999999999', 'limit=Infinity&offset=Infinity', 'limit=1.7&offset=0.5']) {
    const result = await session.request('/api/archive?' + query);
    record('paging ' + query, Number.isFinite(result.json.limit) && Number.isFinite(result.json.offset) ? 'PASS' : 'FAIL', {
      status: result.status, limit: result.json.limit, offset: result.json.offset, closed: result.json.closed.length,
    });
  }
});

for (const body of ['Plain', 'Plain\n', 'Plain\n\n', 'Plain\r\n\r\n', ' \n\n']) {
  const restored = stripCanvasMarker(setCanvasMarker(body, { x: 10, y: 20 }));
  record('A4 marker set/strip byte identity', body === restored ? 'PASS' : 'FAIL', { original: body, restored });
}
const destination = '.agents/run/chamberos-board-v2/verifications/A5/independent/data.json';
fs.writeFileSync(destination, JSON.stringify(observations, null, 2) + '\n');
