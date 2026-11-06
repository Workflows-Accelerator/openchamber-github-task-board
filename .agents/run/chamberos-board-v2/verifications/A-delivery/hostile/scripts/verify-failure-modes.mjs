// Verification script for Criterion 2: Discovery failure vs partial per-repo failure behavior

import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const { makeIssue, startFakeGitHub } = await import(pathToFileURL(path.resolve(rootDir, 'web/tests/fake-github.mjs')).href);
const { startBoard, HttpSession } = await import(pathToFileURL(path.resolve(rootDir, 'web/tests/helpers.mjs')).href);

async function run() {
  console.log('--- Starting Criterion 2 Failure Modes Verification ---');
  const results = [];

  // Helper to record
  const check = (name, pass, extra = {}) => {
    results.push({ name, verdict: pass ? 'PASS' : 'FAIL', ...extra });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}`, extra);
    if (!pass) throw new Error(`Assertion failed: ${name}`);
  };

  // 1. Initial Discovery Outages: 401, 403, 500
  for (const status of [401, 403, 500]) {
    const fake = await startFakeGitHub({
      repositories: [{ repo: 'owner/repo', issues: [makeIssue({ number: 1, repo: 'owner/repo' })] }],
    });
    const board = await startBoard(fake, { repositoryTtlMs: 0 });
    try {
      const session = new HttpSession(board.url);
      await session.login();

      // Inject discovery failure after board startup and login
      fake.setInjectedResponse(status, { message: `Discovery error ${status}` });

      // Operations combined route
      const opsRes = await session.request('/api/combined/operations');
      check(`Discovery ${status} on /api/combined/operations returns 502 discovery_unavailable`,
        opsRes.status === 502 && opsRes.json?.error === 'discovery_unavailable',
        { status: opsRes.status, body: opsRes.json }
      );

      // Archive combined route
      const archiveRes = await session.request('/api/combined/archive');
      check(`Discovery ${status} on /api/combined/archive returns 502 discovery_unavailable`,
        archiveRes.status === 502 && archiveRes.json?.error === 'discovery_unavailable',
        { status: archiveRes.status, body: archiveRes.json }
      );
    } finally {
      await board.app.close();
      await fake.close();
    }
  }

  // 2. Partial Per-Repo Failure (1 repo fails, 1 repo succeeds)
  {
    const fake = await startFakeGitHub({
      repositories: [
        {
          repo: 'owner/repo-good',
          id: 1,
          issues: [
            makeIssue({ number: 1, repo: 'owner/repo-good', title: 'Good Task', labels: ['status:in-progress'] }),
          ],
        },
        {
          repo: 'owner/repo-fail',
          id: 2,
          issues: [
            makeIssue({ number: 10, repo: 'owner/repo-fail', title: 'Fail Task', labels: ['status:todo'] }),
          ],
        },
      ],
    });

    const board = await startBoard(fake, { repositoryTtlMs: 60_000 });
    try {
      const session = new HttpSession(board.url);
      await session.login();

      // Fail issue requests for repo-fail
      fake.setRepoFailing('owner/repo-fail', true);

      const opsRes = await session.request('/api/combined/operations');
      check('Partial failure returns 200 with partial:true and failures list',
        opsRes.status === 200 && opsRes.json?.partial === true && Array.isArray(opsRes.json?.failures) && opsRes.json.failures.length === 1,
        {
          status: opsRes.status,
          partial: opsRes.json?.partial,
          failures: opsRes.json?.failures,
          statusPerProject: opsRes.json?.statusPerProject,
        }
      );

      // The good repo should still have its task counted
      check('Partial failure retains good repo tasks',
        opsRes.json?.statusPerProject?.['owner/repo-good']?.['in-progress'] === 1,
        { goodRepo: opsRes.json?.statusPerProject?.['owner/repo-good'] }
      );

      // The failed repo has 0 counts and is listed in failures
      check('Partial failure identifies failing repo in failures list',
        opsRes.json?.failures[0]?.repository?.full === 'owner/repo-fail' || opsRes.json?.failures[0]?.repository === 'owner/repo-fail',
        { failureItem: opsRes.json?.failures[0] }
      );
    } finally {
      await board.app.close();
      await fake.close();
    }
  }

  // 3. Cached Fallback on Subsequent Per-Repo Failure
  {
    const fake = await startFakeGitHub({
      repositories: [
        {
          repo: 'owner/repo-cached',
          id: 1,
          issues: [
            makeIssue({ number: 1, repo: 'owner/repo-cached', title: 'Cached Task', labels: ['status:in-progress'] }),
          ],
        },
      ],
    });

    let clock = Date.parse('2026-11-06T00:00:00Z');
    const board = await startBoard(fake, {
      now: () => clock,
      repositoryTtlMs: 60_000,
      boardCacheTtlMs: 30_000,
      aggregateTimeoutMs: 12_000,
    });
    try {
      const session = new HttpSession(board.url);
      await session.login();

      // First call primes the cache
      const firstRes = await session.request('/api/combined/operations');
      check('First call populates cache', firstRes.status === 200 && firstRes.json?.statusPerProject?.['owner/repo-cached']?.['in-progress'] === 1);

      // Advance clock past cache TTL (30s) and inject failure on repo-cached
      clock += 35_000;
      fake.setRepoFailing('owner/repo-cached', true);

      // Second call: board should serve cached tasks with failure message
      const secondRes = await session.request('/api/combined/operations');
      check('Cached fallback serves cached tasks and marks partial with message',
        secondRes.status === 200 &&
        secondRes.json?.partial === true &&
        secondRes.json?.statusPerProject?.['owner/repo-cached']?.['in-progress'] === 1 &&
        secondRes.json?.failures?.some(f => f.message.includes('showing cached tasks')),
        {
          partial: secondRes.json?.partial,
          failures: secondRes.json?.failures,
          cachedCounts: secondRes.json?.statusPerProject?.['owner/repo-cached'],
        }
      );
    } finally {
      await board.app.close();
      await fake.close();
    }
  }

  // 4. All Repositories Failing After Successful Discovery
  {
    const fake = await startFakeGitHub({
      repositories: [
        {
          repo: 'owner/repo-a',
          id: 1,
          issues: [makeIssue({ number: 1, repo: 'owner/repo-a', labels: ['status:todo'] })],
        },
        {
          repo: 'owner/repo-b',
          id: 2,
          issues: [makeIssue({ number: 2, repo: 'owner/repo-b', labels: ['status:todo'] })],
        },
      ],
    });

    const board = await startBoard(fake, { repositoryTtlMs: 60_000 });
    try {
      const session = new HttpSession(board.url);
      await session.login();

      // Discovery has already succeeded at startup.
      // Now fail both repositories:
      fake.setRepoFailing('owner/repo-a', true);
      fake.setRepoFailing('owner/repo-b', true);

      const opsRes = await session.request('/api/combined/operations');
      // Hostile analysis: Does discovery guard trigger here?
      // Discovery succeeded, so discoveryFailed is false!
      // Thus discovery guard does NOT trigger!
      // Instead, it returns 200 with partial: true and failures for BOTH repos!
      const guardTriggered = opsRes.status === 502;
      const returnedPartialFailures = opsRes.status === 200 && opsRes.json?.partial === true && opsRes.json?.failures?.length === 2;

      check('All repos failing after discovery: returns 200 with partial:true and 2 failures (discovery guard bypassed)',
        returnedPartialFailures,
        {
          guardTriggered,
          status: opsRes.status,
          partial: opsRes.json?.partial,
          failureCount: opsRes.json?.failures?.length,
          failures: opsRes.json?.failures,
        }
      );
    } finally {
      await board.app.close();
      await fake.close();
    }
  }

  // 5. Single-Repo Endpoint Direct Outage: /api/repos/:owner/:name/operations
  {
    const fake = await startFakeGitHub({
      repositories: [
        {
          repo: 'owner/single-repo',
          id: 1,
          issues: [makeIssue({ number: 1, repo: 'owner/single-repo' })],
        },
      ],
    });

    const board = await startBoard(fake, { repositoryTtlMs: 60_000 });
    try {
      const session = new HttpSession(board.url);
      await session.login();

      // Fail single repo
      fake.setRepoFailing('owner/single-repo', true);

      const singleOpsRes = await session.request('/api/repos/owner/single-repo/operations');
      check('Single-repo endpoint direct outage returns HTTP error status (not 200 all-zero)',
        singleOpsRes.status >= 500,
        { status: singleOpsRes.status, body: singleOpsRes.json }
      );

      const singleArchiveRes = await session.request('/api/repos/owner/single-repo/archive');
      check('Single-repo archive endpoint direct outage returns HTTP error status (not 200 all-zero)',
        singleArchiveRes.status >= 500,
        { status: singleArchiveRes.status, body: singleArchiveRes.json }
      );
    } finally {
      await board.app.close();
      await fake.close();
    }
  }

  console.log('\n--- All Criterion 2 Verification Checks Passed ---');
}

run().catch((err) => {
  console.error('Criterion 2 verification failed:', err);
  process.exit(1);
});
