import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import {
  SessionStore,
  LoginRateLimiter,
  parseCookieHeader,
  buildSessionCookie,
  buildClearCookie,
  csrfMatches,
  DEFAULT_ABSOLUTE_TTL_MS,
  DEFAULT_IDLE_TTL_MS,
  THIRTY_DAYS_MS,
} from '../server/auth.ts';

const SECRET = 's'.repeat(48);

test('session cookie is HttpOnly, Secure, SameSite=Strict and path scoped', () => {
  const header = buildSessionCookie('abc.def', 600);
  assert.match(header, /^board_session=abc\.def;/);
  assert.match(header, /HttpOnly/i);
  assert.match(header, /Secure/i);
  assert.match(header, /SameSite=Strict/i);
  assert.match(header, /Path=\//);
  assert.match(header, /Max-Age=600/);
});

test('clear cookie expires the session cookie', () => {
  const header = buildClearCookie();
  assert.match(header, /^board_session=;/);
  assert.match(header, /Max-Age=0/);
  assert.match(header, /HttpOnly/i);
  assert.match(header, /Secure/i);
  assert.match(header, /SameSite=Strict/i);
});

test('parseCookieHeader handles multiple cookies and encoding', () => {
  const parsed = parseCookieHeader('a=1; board_session=id%2Esig; b=two');
  assert.equal(parsed.board_session, 'id.sig');
  assert.equal(parsed.a, '1');
  assert.equal(parsed.b, 'two');
  assert.deepEqual(parseCookieHeader(undefined), {});
});

test('sessions are created, signed, validated and destroyed', () => {
  let now = 1_000_000;
  const store = new SessionStore({ secret: SECRET, now: () => now });
  const created = store.create('127.0.0.1');
  assert.ok(created.cookieValue.includes('.'));
  assert.equal(created.csrfToken.length >= 32, true);

  const loaded = store.get(created.cookieValue);
  assert.ok(loaded);
  assert.equal(loaded.id, created.id);
  assert.equal(loaded.csrfToken, created.csrfToken);

  store.destroy(created.cookieValue);
  assert.equal(store.get(created.cookieValue), null);

  // A re-created session with the same id cannot be forged from the old signature.
  const again = store.create('127.0.0.1');
  const tampered = `${created.id}.${again.cookieValue.split('.')[1]}`;
  assert.equal(store.get(tampered), null);
});

test('sessions reject forged and unsigned cookie values', () => {
  const store = new SessionStore({ secret: SECRET });
  const created = store.create();
  const [id, signature] = created.cookieValue.split('.');
  assert.equal(store.get(`${id}.${'0'.repeat(signature.length)}`), null);
  assert.equal(store.get(id), null);
  assert.equal(store.get(''), null);
  assert.equal(store.get('nonsense'), null);
});

test('sessions expire on absolute and idle timeouts', () => {
  let now = 5_000_000;
  const idleStore = new SessionStore({
    secret: SECRET,
    absoluteTtlMs: 60_000,
    idleTtlMs: 4_000,
    now: () => now,
  });
  const created = idleStore.create();

  now += 3_000;
  assert.ok(idleStore.get(created.cookieValue), 'within idle window');

  now += 4_500;
  assert.equal(idleStore.get(created.cookieValue), null, 'idle timeout');

  const absoluteStore = new SessionStore({
    secret: SECRET,
    absoluteTtlMs: 10_000,
    idleTtlMs: 60_000,
    now: () => now,
  });
  const second = absoluteStore.create();
  now += 6_000;
  assert.ok(absoluteStore.get(second.cookieValue), 'touched inside absolute window');
  now += 5_000;
  assert.equal(absoluteStore.get(second.cookieValue), null, 'absolute timeout');
});

test('csrfMatches compares exact tokens', () => {
  const token = 'a'.repeat(64);
  assert.equal(csrfMatches(token, token), true);
  assert.equal(csrfMatches(token, 'b'.repeat(64)), false);
  assert.equal(csrfMatches(token, ''), false);
  assert.equal(csrfMatches(token, undefined), false);
  assert.equal(csrfMatches('short', token), false);
});

test('login limiter blocks repeated failures, then recovers after the window', () => {
  let now = 0;
  const limiter = new LoginRateLimiter({ maxFailures: 3, windowMs: 10_000, now: () => now });
  const key = '127.0.0.1';

  assert.deepEqual(limiter.check(key), { allowed: true, retryAfterSeconds: 0 });
  limiter.recordFailure(key);
  limiter.recordFailure(key);
  assert.deepEqual(limiter.check(key), { allowed: true, retryAfterSeconds: 0 });
  limiter.recordFailure(key);

  const blocked = limiter.check(key);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds > 0, true);

  // A different client is unaffected.
  assert.equal(limiter.check('10.0.0.9').allowed, true);

  now += 10_001;
  assert.deepEqual(limiter.check(key), { allowed: true, retryAfterSeconds: 0 });

  limiter.recordFailure(key);
  limiter.recordFailure(key);
  limiter.recordSuccess(key);
  limiter.recordFailure(key);
  assert.equal(limiter.check(key).allowed, true, 'success clears the failure window');
});

test('login limiter enforces bounded cooldown of at most 60 seconds with no accumulating lockout', () => {
  let now = 1_000_000;
  const limiter = new LoginRateLimiter({ maxFailures: 3, windowMs: 60_000, now: () => now });
  const key = '192.168.1.1';

  for (let i = 0; i < 3; i += 1) {
    limiter.recordFailure(key);
  }

  const initialVerdict = limiter.check(key);
  assert.equal(initialVerdict.allowed, false);
  assert.ok(initialVerdict.retryAfterSeconds > 0 && initialVerdict.retryAfterSeconds <= 60);

  // Advance time partially and verify repeated checks do not extend lockout
  now += 30_000;
  const midVerdict = limiter.check(key);
  assert.equal(midVerdict.allowed, false);
  assert.equal(midVerdict.retryAfterSeconds, 30);

  // Once window expires from original failure, limiter recovers cleanly
  now += 30_001;
  assert.deepEqual(limiter.check(key), { allowed: true, retryAfterSeconds: 0 });
});

test('session store caps stored sessions and evicts least recently used when full', () => {
  // Per manager ruling R6: session store uses true LRU eviction (accessing s1 promotes it so s2 is evicted when full)
  const store = new SessionStore({ secret: SECRET, maxSessions: 3 });
  const s1 = store.create();
  const s2 = store.create();
  const s3 = store.create();

  assert.equal(store.size, 3);
  assert.ok(store.get(s1.cookieValue), 's1 accessed and promoted to most recently used');

  const s4 = store.create();
  assert.equal(store.size, 3);
  assert.equal(store.get(s2.cookieValue), null, 'least recently used session (s2) evicted');
  assert.ok(store.get(s1.cookieValue), 'recently accessed session (s1) retained');
  assert.ok(store.get(s3.cookieValue));
  assert.ok(store.get(s4.cookieValue));
});

test('login limiter bounds failure map size and does not grow without bound on 5000 failures', () => {
  const limiter = new LoginRateLimiter({ maxEntries: 100 });
  for (let i = 0; i < 5000; i += 1) {
    limiter.recordFailure(`client-${i}`);
  }
  assert.ok(limiter.size <= 100);
});

test('session store defaults to 30-day absolute and idle TTL, and 30-day cookie Max-Age', () => {
  const expectedTtl = 30 * 24 * 60 * 60 * 1000;
  assert.equal(THIRTY_DAYS_MS, expectedTtl);
  assert.equal(DEFAULT_ABSOLUTE_TTL_MS, expectedTtl);
  assert.equal(DEFAULT_IDLE_TTL_MS, expectedTtl);

  const store = new SessionStore({ secret: SECRET });
  assert.equal(store.maxAgeSeconds, 30 * 24 * 60 * 60); // 2,592,000 seconds

  const created = store.create();
  assert.equal(created.maxAgeSeconds, 2592000);
  const cookieHeader = buildSessionCookie(created.cookieValue, created.maxAgeSeconds);
  assert.match(cookieHeader, /Max-Age=2592000/);
});

test('sessions survive constructing a new SessionStore from the same file', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-test-'));
  const filePath = path.join(tempDir, 'sessions.json');

  try {
    const store1 = new SessionStore({ secret: SECRET, filePath });
    const created = store1.create('192.168.1.50');
    assert.equal(store1.size, 1);

    const store2 = new SessionStore({ secret: SECRET, filePath });
    assert.equal(store2.size, 1);
    const loaded = store2.get(created.cookieValue);
    assert.ok(loaded);
    assert.equal(loaded.csrfToken, created.csrfToken);
    assert.equal(loaded.ip, '192.168.1.50');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('persisted session file contains only SHA-256 hashes and no raw secrets or cookie values', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-test-'));
  const filePath = path.join(tempDir, 'sessions.json');

  try {
    const store = new SessionStore({ secret: SECRET, filePath });
    const created = store.create('10.0.0.1');

    assert.ok(fs.existsSync(filePath), 'session file was created');
    const stat = fs.statSync(filePath);
    assert.equal(stat.mode & 0o777, 0o600, 'file permissions are 0600');

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(fileContent);

    assert.equal(parsed.version, 1);
    assert.ok(parsed.sessions);

    const sessionKeys = Object.keys(parsed.sessions);
    assert.equal(sessionKeys.length, 1);
    const idHash = sessionKeys[0];
    assert.match(idHash, /^[a-f0-9]{64}$/, 'session key is a 64-char hex SHA-256 hash');

    const expectedHash = createHash('sha256').update(created.id).digest('hex');
    assert.equal(idHash, expectedHash);

    // Ensure raw secrets and cookie values NEVER appear anywhere in the persisted content
    assert.equal(fileContent.includes(SECRET), false, 'raw secret not in file');
    assert.equal(fileContent.includes(created.cookieValue), false, 'raw cookie value not in file');
    assert.equal(fileContent.includes(created.id), false, 'raw id string not in file');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('expired sessions on disk are rejected and pruned on store initialization', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-test-'));
  const filePath = path.join(tempDir, 'sessions.json');

  try {
    let now = 1_000_000;
    const store1 = new SessionStore({
      secret: SECRET,
      filePath,
      absoluteTtlMs: 5000,
      idleTtlMs: 2000,
      now: () => now,
    });
    const created = store1.create();
    assert.equal(store1.size, 1);

    // Advance time past expiry
    now += 6000;
    const store2 = new SessionStore({
      secret: SECRET,
      filePath,
      absoluteTtlMs: 5000,
      idleTtlMs: 2000,
      now: () => now,
    });

    assert.equal(store2.size, 0, 'expired sessions not loaded into memory');
    assert.equal(store2.get(created.cookieValue), null, 'get returns null for expired session');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('sign-out removes the record from memory and persists immediately to disk', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-test-'));
  const filePath = path.join(tempDir, 'sessions.json');

  try {
    const store = new SessionStore({ secret: SECRET, filePath });
    const created = store.create();
    assert.equal(store.size, 1);

    const contentBefore = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(Object.keys(contentBefore.sessions).length, 1);

    store.destroy(created.cookieValue);
    assert.equal(store.size, 0);
    assert.equal(store.get(created.cookieValue), null);

    const contentAfter = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(Object.keys(contentAfter.sessions).length, 0);

    const storeReloaded = new SessionStore({ secret: SECRET, filePath });
    assert.equal(storeReloaded.size, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('corrupted session file is tolerated without crashing and starts empty', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-test-'));
  const filePath = path.join(tempDir, 'sessions.json');

  try {
    fs.writeFileSync(filePath, '{ invalid json: bad syntax ]]]');

    const store = new SessionStore({ secret: SECRET, filePath });
    assert.equal(store.size, 0);

    const created = store.create();
    assert.equal(store.size, 1);
    assert.ok(store.get(created.cookieValue));

    // File is now written cleanly
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(content.version, 1);
    assert.equal(Object.keys(content.sessions).length, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('throttles lastSeen writes to disk during session activity', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-test-'));
  const filePath = path.join(tempDir, 'sessions.json');

  try {
    let now = 1_000_000;
    const store = new SessionStore({
      secret: SECRET,
      filePath,
      lastSeenThrottleMs: 60_000,
      now: () => now,
    });
    const created = store.create();

    const initialStat = fs.statSync(filePath);
    const initialContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const idHash = Object.keys(initialContent.sessions)[0];
    const initialLastSeen = initialContent.sessions[idHash].lastSeenAt;

    // Advance 10 seconds (less than 60s throttle window) and touch session
    now += 10_000;
    const touched = store.get(created.cookieValue);
    assert.ok(touched);
    assert.equal(touched.lastSeenAt, now);

    // On disk, lastSeenAt should NOT have been rewritten yet
    const throttledContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(throttledContent.sessions[idHash].lastSeenAt, initialLastSeen);

    // Advance past the throttle window (60s)
    now += 55_000; // now is initial + 65s
    const touchedAgain = store.get(created.cookieValue);
    assert.ok(touchedAgain);

    // On disk, lastSeenAt should now be updated
    const updatedContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(updatedContent.sessions[idHash].lastSeenAt, now);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
