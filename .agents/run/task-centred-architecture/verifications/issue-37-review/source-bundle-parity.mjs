// Final source-entry versus exact built bundle behavior, synthetic localhost only.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { startFakeGitHub, makeIssue } from '../../../../../web/tests/fake-github.mjs';
import { HttpSession, BOARD_PASSWORD, SESSION_SECRET, SYNTHETIC_TOKEN } from '../../../../../web/tests/helpers.mjs';

const proof = path.dirname(new URL(import.meta.url).pathname);
const preload = `
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.origin !== 'https://api.github.com') throw new Error('Non-synthetic upstream refused');
  return originalFetch(process.env.__TEST_FAKE_GITHUB_URL + url.pathname + url.search, options);
};
`;
const preloadUrl = 'data:text/javascript;base64,' + Buffer.from(preload).toString('base64');
const digest = text => createHash('sha256').update(text).digest('hex');
const volatile = new Set(['fetchedAt', 'lastSeenAt', 'savedAt', 'updatedAt', 'csrfToken', 'expiresAt', 'uptime']);
function stable(value) {
  if (Array.isArray(value)) {
    const items = value.map(stable);
    return items.every(item => item && typeof item === 'object' && item.key)
      ? items.sort((a, b) => a.key.localeCompare(b.key)) : items;
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).filter(key => !volatile.has(key)).sort().map(key => [key, stable(value[key])]));
}

async function exercise(entry) {
  const body = '## Overview\nOriginal\n\n## Open Questions\n- [ ] Decide?\n';
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN, repositories: [
    ...['alpha', 'beta', 'archived'].map((name, index) => ({ repo: `owner/${name}`, id: 101 + index,
      archived: name === 'archived', issues: [makeIssue({ number: 1, title: name + ' task', repo: `owner/${name}`, body, labels: ['status:todo'] })] })),
    { repo: 'owner/empty', id: 104, issues: [] },
    { repo: 'owner/unavailable', id: 105, accessible: false, issues: [] },
  ] });
  const child = spawn(process.execPath, ['--import', preloadUrl, entry], { cwd: process.cwd(),
    env: { PATH: process.env.PATH, __TEST_FAKE_GITHUB_URL: fake.url,
      BOARD_GITHUB_TOKEN: SYNTHETIC_TOKEN, BOARD_GITHUB_LOGIN: fake.login,
      BOARD_REPO: 'owner/alpha', BOARD_PASSWORD, BOARD_SESSION_SECRET: SESSION_SECRET,
      BOARD_HOST: '127.0.0.1',
      // Sequential entries use the default loopback port; a bind collision fails.
    }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  const transcript = [];
  try {
    // Default loopback port is used sequentially; do not attach to an unrelated listener.
    const deadline = Date.now() + 10_000;
    while (!/board: listening on http:\/\/127\.0\.0\.1:(\d+)/.test(stdout)) {
      assert.equal(child.exitCode, null, 'entry stayed alive: ' + stderr);
      if (Date.now() > deadline) throw new Error('Entry did not listen: ' + stderr);
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    const port = /board: listening on http:\/\/127\.0\.0\.1:(\d+)/.exec(stdout)[1];
    const session = new HttpSession(`http://127.0.0.1:${port}`);
    async function request(route, expectedStatus = 200, options = {}) {
      const response = await session.request(route, options);
      assert.equal(response.status, expectedStatus, route);
      transcript.push({ route, method: options.method ?? 'GET', status: response.status,
        type: response.headers.get('content-type'), body: response.json === null ? { sha256: digest(response.text) } : stable(response.json) });
      return response;
    }
    await request('/health');
    for (const route of ['/', '/app.js', '/theme.css']) await request(route);
    await request('/api/repos', 401);
    await request('/api/combined/board', 401);
    const signedIn = await session.login(); assert.equal(signedIn.status, 200);
    assert.match(signedIn.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);
    transcript.push({ route: '/api/session', method: 'POST', status: signedIn.status, body: stable(signedIn.json) });
    await request('/api/session');
    const picker = await request('/api/repos'); assert.equal(picker.json.visibleCount, 4);
    const combined = await request('/api/combined/board');
    assert.equal(combined.json.complete, true); assert.equal(combined.json.issues.length, 3);
    const archived = await request('/api/repos/owner/archived/board'); assert.equal(archived.json.repository.archived, true);
    const empty = await request('/api/repos/owner/empty/board'); assert.equal(empty.json.issues.length, 0);
    await request('/api/board');
    const alpha = (await request('/api/repos/owner/alpha/issues/1')).json.issue;
    const beta = (await request('/api/repos/owner/beta/issues/1')).json.issue;
    assert.notEqual(alpha.fingerprint, beta.fingerprint);
    for (const name of ['fabricated', 'Alpha', 'unavailable']) {
      const before = fake.requests.length;
      await request(`/api/repos/owner/${name}/issues/1/status`, 400, {
        method: 'POST', body: { status: 'status:done', fingerprint: beta.fingerprint },
      });
      assert.equal(fake.requests.length, before, 'not allowlisted means zero upstream calls');
    }
    await request('/api/repos/owner/beta/issues/1/status', 403, { method: 'POST', csrf: false,
      body: { status: 'status:done', fingerprint: beta.fingerprint } });
    await request('/api/repos/owner/beta/issues/1/status', 409, { method: 'POST',
      body: { status: 'status:done', fingerprint: alpha.fingerprint } });
    let current = (await request('/api/repos/owner/beta/issues/1/section', 200, { method: 'PUT',
      body: { sectionId: 'overview', text: 'Beta confirmed', fingerprint: beta.fingerprint } })).json.issue;
    current = (await request('/api/repos/owner/beta/issues/1/status', 200, { method: 'POST',
      body: { status: 'status:done', fingerprint: current.fingerprint } })).json.issue;
    await request('/api/repos/owner/beta/issues/1/questions/0/answer', 200, { method: 'POST',
      body: { answer: 'Beta answer', fingerprint: current.fingerprint } });
    assert.deepEqual(fake.patchCalls.map(call => call.repo), ['owner/beta', 'owner/beta', 'owner/beta']);
    assert.equal(fake.findIssue(1, 'owner/alpha').body, body);
    await request('/api/combined/board');
    await request('/api/session', 204, { method: 'DELETE' });
    await request('/api/repos', 401);
    for (const secret of [SYNTHETIC_TOKEN, BOARD_PASSWORD, SESSION_SECRET]) {
      assert.equal((stdout + stderr).includes(secret), false, 'entry logs contain no synthetic secret');
    }
    return { transcript, upstreamCalls: fake.requests.length, patches: fake.patchCalls.length };
  } finally {
    if (child.exitCode === null) {
      const exited = once(child, 'exit'); child.kill('SIGTERM');
      const [code] = await exited; assert.equal(code, 0, 'clean entry shutdown');
    }
    await fake.close();
  }
}
const source = await exercise('web/server.ts');
const bundle = await exercise('web/dist/server.mjs');
assert.deepEqual(bundle, source, 'normalized source and bundle route behavior identical');
const result = { sourceEntry: 'web/server.ts', bundleEntry: 'web/dist/server.mjs',
  bundleSha256: digest(await readFile('web/dist/server.mjs')), normalizedVolatileFields: [...volatile],
  comparedCheckpoints: source.transcript.length, upstreamCallsPerEntry: source.upstreamCalls,
  qualifiedPatchesPerEntry: source.patches, equal: true, transcript: source.transcript };
await writeFile(path.join(proof, 'source-bundle-parity.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ comparedCheckpoints: result.comparedCheckpoints, upstreamCallsPerEntry: result.upstreamCallsPerEntry,
  qualifiedPatchesPerEntry: result.qualifiedPatchesPerEntry, equal: result.equal, bundleSha256: result.bundleSha256 }));
