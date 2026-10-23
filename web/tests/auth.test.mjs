import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SessionStore,
  LoginRateLimiter,
  parseCookieHeader,
  buildSessionCookie,
  buildClearCookie,
  csrfMatches,
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
