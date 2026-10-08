import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestApp } from './test-app-harness.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// D12 Manifest Shape Verification (Real Oracle)
// ==========================================
test('D12 Manifest: package.json declares origins capability and api.github.com in contributes.origins', () => {
  const pkgPath = path.resolve(__dirname, '../package.json');
  const pkgRaw = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(pkgRaw);

  assert.ok(pkg.openchamber, 'package.json must contain openchamber config block');

  // Verify capabilities includes "origins"
  assert.ok(
    Array.isArray(pkg.openchamber.capabilities),
    'openchamber.capabilities must be an array'
  );
  assert.ok(
    pkg.openchamber.capabilities.includes('origins'),
    'openchamber.capabilities must include "origins"'
  );

  // Verify contributes.origins includes "https://api.github.com"
  assert.ok(
    pkg.openchamber.contributes,
    'openchamber.contributes must exist'
  );
  assert.ok(
    Array.isArray(pkg.openchamber.contributes.origins),
    'openchamber.contributes.origins must be an array'
  );
  assert.ok(
    pkg.openchamber.contributes.origins.includes('https://api.github.com'),
    'openchamber.contributes.origins must include "https://api.github.com"'
  );
});

// ==========================================
// D12 Fallback Integrity Proofs (Driven via Real Compiled Bundle)
// ==========================================
test('D12 Fallback Integrity: missing workspace token falls back directly to host.request without invoking fetch', async () => {
  const hostRequests = [];
  const { app } = createTestApp({
    onRequest: (payload) => {
      hostRequests.push(payload);
      return {
        status: 200,
        body: JSON.stringify([{ id: 101, title: 'From Host Proxy (no token)' }]),
      };
    },
  });

  // Ensure no token is available
  app.setWorkspaceGitToken(null);

  let fetchInvoked = false;
  global.fetch = async () => {
    fetchInvoked = true;
    throw new Error('fetch should not be invoked when workspace token is absent');
  };

  const res = await app.githubRequest('GET', '/repos/owner/repo/issues');

  assert.equal(fetchInvoked, false, 'Direct fetch must not be attempted without token');
  assert.ok(Array.isArray(res), 'Result should be parsed issue array from host proxy');
  assert.equal(res[0]?.title, 'From Host Proxy (no token)');

  const issueHostRequests = hostRequests.filter((r) => r.path === '/repos/owner/repo/issues');
  assert.equal(issueHostRequests.length, 1, 'Exactly one host.request must be sent for the issues path');
  assert.equal(issueHostRequests[0].method, 'GET');
});

test('D12 Fallback Integrity: direct fetch network/CSP failure falls back to host.request for GET', async () => {
  const hostRequests = [];
  const { app } = createTestApp({
    onRequest: (payload) => {
      hostRequests.push(payload);
      return {
        status: 200,
        body: JSON.stringify([{ id: 102, title: 'From Host Proxy (CSP fallback)' }]),
      };
    },
  });

  // Safe synthetic stub (never a real secret or prefix)
  app.setWorkspaceGitToken('stub-workspace-token');

  let fetchAttempted = false;
  global.fetch = async () => {
    fetchAttempted = true;
    // Simulate browser CSP connect-src violation or network failure
    throw new TypeError('Failed to fetch');
  };

  const res = await app.githubRequest('GET', '/repos/owner/repo/issues');

  assert.equal(fetchAttempted, true, 'Direct fetch should have been attempted first');
  assert.ok(Array.isArray(res), 'Result should be parsed issue array from host fallback');
  assert.equal(res[0]?.title, 'From Host Proxy (CSP fallback)');

  const issueHostRequests = hostRequests.filter((r) => r.path === '/repos/owner/repo/issues');
  assert.equal(issueHostRequests.length, 1, 'host.request fallback must be invoked upon fetch error');
  assert.equal(issueHostRequests[0].method, 'GET');
});

test('D12 Fallback Integrity: direct fetch 401 authentication failure falls back to host.request for GET', async () => {
  const hostRequests = [];
  const { app } = createTestApp({
    onRequest: (payload) => {
      hostRequests.push(payload);
      return {
        status: 200,
        body: JSON.stringify([{ id: 103, title: 'From Host Proxy (401 fallback)' }]),
      };
    },
  });

  // Safe synthetic stub
  app.setWorkspaceGitToken('stub-workspace-token');

  let fetchAttempted = false;
  global.fetch = async () => {
    fetchAttempted = true;
    return {
      status: 401,
      ok: false,
      headers: new Headers(),
      clone: () => ({ text: async () => 'Unauthorized' }),
    };
  };

  const res = await app.githubRequest('GET', '/repos/owner/repo/issues');

  assert.equal(fetchAttempted, true, 'Direct fetch should have been attempted');
  assert.ok(Array.isArray(res), 'Result should be parsed issue array from host fallback');
  assert.equal(res[0]?.title, 'From Host Proxy (401 fallback)');

  const issueHostRequests = hostRequests.filter((r) => r.path === '/repos/owner/repo/issues');
  assert.equal(issueHostRequests.length, 1, 'host.request fallback must be invoked upon 401');
});

test('D12 Direct Activation: direct fetch sends ETag / If-None-Match and handles 304 without host.request', async () => {
  const hostRequests = [];
  const { app } = createTestApp({
    onRequest: (payload) => {
      hostRequests.push(payload);
      return { status: 200, body: JSON.stringify([]) };
    },
  });

  // Safe synthetic stub
  app.setWorkspaceGitToken('stub-workspace-token');

  const fetchCalls = [];
  global.fetch = async (url, opts) => {
    fetchCalls.push({ url, opts });
    return {
      status: 304,
      ok: false,
      headers: new Headers({ etag: 'W/"direct-304-etag"' }),
    };
  };

  const res = await app.githubRequest(
    'GET',
    '/repos/owner/repo/issues',
    undefined,
    undefined,
    { 'If-None-Match': 'W/"direct-304-etag"' }
  );

  assert.equal(fetchCalls.length, 1, 'Exactly one direct fetch should be performed');
  assert.equal(fetchCalls[0].opts.headers['If-None-Match'], 'W/"direct-304-etag"');
  assert.equal(fetchCalls[0].opts.headers['Authorization'], 'Bearer stub-workspace-token');

  assert.equal(res.notModified, true, 'Result must indicate notModified: true');
  assert.equal(res.status, 304, 'Result status must be 304');
  assert.equal(res.etag, 'W/"direct-304-etag"', 'Result must preserve ETag from response');

  const issueHostRequests = hostRequests.filter((r) => r.path === '/repos/owner/repo/issues');
  assert.equal(issueHostRequests.length, 0, 'host.request must NOT be called when direct fetch succeeds with 304');
});

// ==========================================
// D12 Origin Guard (Defense-in-Depth for Token Authorization)
// ==========================================
test('D12 Origin Guard: direct fetch confines token to https://api.github.com and falls back to host.request for non-approved origins', async () => {
  const hostRequests = [];
  const { app } = createTestApp({
    onRequest: (payload) => {
      hostRequests.push(payload);
      return {
        status: 200,
        body: JSON.stringify([{ id: 999, title: `From Host Proxy (${payload.path})` }]),
      };
    },
  });

  app.setWorkspaceGitToken('stub-workspace-token');

  let directFetchAttempted = false;
  let targetUrl = null;
  global.fetch = async (url, opts) => {
    directFetchAttempted = true;
    targetUrl = url;
    return {
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () => [{ id: 666, title: 'From Unsafe Direct Fetch' }],
    };
  };

  const untrustedUrls = [
    '//not-github.com/api/v1/repos',
    '//api.github.com.attacker.com/repos',
  ];

  for (const untrustedUrl of untrustedUrls) {
    directFetchAttempted = false;
    targetUrl = null;

    const res = await app.githubRequest('GET', untrustedUrl);

    assert.equal(
      directFetchAttempted,
      false,
      `Direct fetch must NOT be attempted for non-approved origin: ${targetUrl || untrustedUrl}`
    );
    assert.ok(
      Array.isArray(res),
      'Result should be parsed issue array from host proxy fallback'
    );
    assert.equal(
      res[0]?.title,
      `From Host Proxy (${untrustedUrl})`,
      'Should return data from host proxy fallback'
    );
  }

  const fallbackRequests = hostRequests.filter((r) => untrustedUrls.includes(r.path));
  assert.equal(
    fallbackRequests.length,
    untrustedUrls.length,
    'host.request fallback must be invoked for each non-approved origin'
  );
});
