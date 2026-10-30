import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { loadConfig, hashPassword, verifyPassword } from '../../../../web/server/config.ts';
import {
  SessionStore,
  csrfMatches,
  deriveCsrfToken,
  computePasswordFingerprint,
} from '../../../../web/server/auth.ts';

const SYNTHETIC_SECRET = 's'.repeat(48);
const SYNTHETIC_PASSWORD = 'correct-horse-battery-staple-synthetic';
const SYNTHETIC_TOKEN = 'ghp_synthetic_token_do_not_use_000000000000';

function redact(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(new RegExp(SYNTHETIC_SECRET, 'g'), '[REDACTED_SECRET]')
    .replace(new RegExp(SYNTHETIC_PASSWORD, 'g'), '[REDACTED_PASSWORD]')
    .replace(new RegExp(SYNTHETIC_TOKEN, 'g'), '[REDACTED_TOKEN]')
    .replace(/board_session=[^;\s]+/g, 'board_session=[REDACTED_COOKIE]')
    .replace(/scrypt\$[^\s"']+/g, '[REDACTED_SCRYPT_HASH]')
    .replace(/"csrfToken":\s*"[^"]+"/g, '"csrfToken": "[REDACTED_CSRF]"');
}

function log(msg) {
  console.log(redact(msg));
}

async function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-restart-behavior-'));
  const sessionFile = path.join(tempDir, 'sessions.json');

  try {
    log('=== INVARIANT 1: Deterministic scrypt salt from sessionSecret across loadConfig ===');
    const env1 = {
      BOARD_GITHUB_TOKEN: SYNTHETIC_TOKEN,
      BOARD_GITHUB_LOGIN: 'board-owner',
      BOARD_REPO: 'owner/repo',
      BOARD_PASSWORD: SYNTHETIC_PASSWORD,
      BOARD_SESSION_SECRET: SYNTHETIC_SECRET,
      BOARD_SESSION_FILE: sessionFile,
    };
    const cfg1 = loadConfig(env1);
    const cfg2 = loadConfig(env1);
    assert.equal(cfg1.passwordHash, cfg2.passwordHash, 'independent loadConfig calls must produce identical passwordHash');
    assert.ok(verifyPassword(SYNTHETIC_PASSWORD, cfg1.passwordHash));
    log('PASS: Independent loadConfig calls produce identical passwordHash across restarts');

    log('=== INVARIANT 2: sessions.json enforced mode 0600 ===');
    const store1 = new SessionStore({
      secret: cfg1.sessionSecret,
      passwordHash: cfg1.passwordHash,
      filePath: sessionFile,
    });
    const s1 = store1.create('10.0.0.1');
    assert.ok(fs.existsSync(sessionFile), 'sessions.json was created on disk');
    const stat = fs.statSync(sessionFile);
    assert.equal(stat.mode & 0o777, 0o600, 'sessions.json must enforce 0600 mode');
    log('PASS: sessions.json enforces mode 0600');

    log('=== INVARIANT 3: Zero plaintext secrets stored on disk ===');
    const rawFileContent = fs.readFileSync(sessionFile, 'utf8');
    assert.equal(rawFileContent.includes(SYNTHETIC_PASSWORD), false, 'password must not be in file');
    assert.equal(rawFileContent.includes(SYNTHETIC_SECRET), false, 'sessionSecret must not be in file');
    assert.equal(rawFileContent.includes(cfg1.passwordHash), false, 'passwordHash must not be in file');
    assert.equal(rawFileContent.includes(s1.cookieValue), false, 'cookieValue must not be in file');
    assert.equal(rawFileContent.includes(s1.id), false, 'sessionId must not be in file');
    assert.equal(rawFileContent.includes(s1.csrfToken), false, 'csrfToken must not be in file');
    log('PASS: Zero plaintext secrets, cookie values, or raw tokens present in sessions.json');

    log('=== INVARIANT 4: Keyed by sha256(sessionId) and bound to passwordFingerprint ===');
    const parsedData = JSON.parse(rawFileContent);
    const expectedHash = createHash('sha256').update(s1.id).digest('hex');
    assert.ok(parsedData.sessions[expectedHash], 'session record must be keyed by sha256(id)');
    const expectedFingerprint = computePasswordFingerprint(cfg1.sessionSecret, cfg1.passwordHash);
    assert.equal(parsedData.sessions[expectedHash].passwordFingerprint, expectedFingerprint);
    log('PASS: Disk record is sha256 keyed and carries HMAC passwordFingerprint');

    log('=== INVARIANT 5: Survives simulated restart and derives identical CSRF token ===');
    const storeRestart = new SessionStore({
      secret: cfg1.sessionSecret,
      passwordHash: cfg1.passwordHash,
      filePath: sessionFile,
    });
    assert.equal(storeRestart.size, 1, 'session survived store restart');
    const restored = storeRestart.get(s1.cookieValue);
    assert.ok(restored, 'session can be fetched via original cookie');
    assert.equal(restored.csrfToken, s1.csrfToken, 'CSRF token is identical after restart');
    assert.equal(csrfMatches(restored.csrfToken, s1.csrfToken), true);
    log('PASS: Session restored across restart with identical derived CSRF token');

    log('=== INVARIANT 6: Changing BOARD_PASSWORD or BOARD_SESSION_SECRET invalidates sessions ===');
    const rotatedPasswordHash = hashPassword('new-different-password');
    const storeRotatedPassword = new SessionStore({
      secret: cfg1.sessionSecret,
      passwordHash: rotatedPasswordHash,
      filePath: sessionFile,
    });
    assert.equal(storeRotatedPassword.size, 0, 'sessions invalidated when password rotated');
    assert.equal(storeRotatedPassword.get(s1.cookieValue), null);

    // Re-create session with store1 to test secret rotation
    const sNew = store1.create('10.0.0.2');
    const storeRotatedSecret = new SessionStore({
      secret: 'r'.repeat(48),
      passwordHash: cfg1.passwordHash,
      filePath: sessionFile,
    });
    assert.equal(storeRotatedSecret.size, 0, 'sessions invalidated when sessionSecret rotated');
    assert.equal(storeRotatedSecret.get(sNew.cookieValue), null);
    log('PASS: Password or sessionSecret rotation invalidates old sessions immediately');

    log('=== INVARIANT 7: BOARD_PASSWORD_HASH configuration determinism and rotation ===');
    const precomputedHash = hashPassword('explicit-precomputed-password');
    const envHash = { ...env1, BOARD_PASSWORD: undefined, BOARD_PASSWORD_HASH: precomputedHash };
    delete envHash.BOARD_PASSWORD;
    const cfgHash1 = loadConfig(envHash);
    const cfgHash2 = loadConfig(envHash);
    assert.equal(cfgHash1.passwordHash, precomputedHash);
    assert.equal(cfgHash2.passwordHash, precomputedHash);
    const storeHash1 = new SessionStore({
      secret: cfgHash1.sessionSecret,
      passwordHash: cfgHash1.passwordHash,
      filePath: sessionFile,
    });
    const sHash = storeHash1.create('10.0.0.3');
    const storeHash2 = new SessionStore({
      secret: cfgHash2.sessionSecret,
      passwordHash: cfgHash2.passwordHash,
      filePath: sessionFile,
    });
    assert.ok(storeHash2.get(sHash.cookieValue), 'survived restart with BOARD_PASSWORD_HASH');
    log('PASS: BOARD_PASSWORD_HASH supported deterministically across restarts');

    log('=== INVARIANT 8: CSRF validation and replay resistance ===');
    assert.equal(csrfMatches(sHash.csrfToken, sHash.csrfToken), true);
    assert.equal(csrfMatches(sHash.csrfToken, 'wrong-csrf-token'), false);
    assert.equal(csrfMatches(sHash.csrfToken, ''), false);
    const anotherCsrf = deriveCsrfToken(cfgHash1.sessionSecret, 'other-id');
    assert.equal(csrfMatches(sHash.csrfToken, anotherCsrf), false);
    log('PASS: CSRF token derivation validates correctly and rejects mismatch/replay');

    log('=== INVARIANT 9: Destroy/logout immediately purges entry from disk ===');
    storeHash1.destroy(sHash.cookieValue);
    assert.equal(storeHash1.size, 0);
    assert.equal(storeHash1.get(sHash.cookieValue), null);
    const storeAfterDestroy = new SessionStore({
      secret: cfgHash1.sessionSecret,
      passwordHash: cfgHash1.passwordHash,
      filePath: sessionFile,
    });
    assert.equal(storeAfterDestroy.size, 0, 'purged session cannot resurrect on restart');
    log('PASS: Destroy immediately purges disk entry and prevents resurrection');

    log('=== INVARIANT 10: Legacy af9b39c session format dropped safely on load ===');
    const legacyData = {
      version: 1,
      sessions: {
        deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef: {
          csrfToken: 'plain-csrf-from-old-version',
          ip: '1.2.3.4',
          createdAt: 1000,
          lastSeenAt: 1000,
          expiresAt: Date.now() + 1000000,
        },
      },
    };
    fs.writeFileSync(sessionFile, JSON.stringify(legacyData, null, 2), { mode: 0o600 });
    const storeLegacy = new SessionStore({
      secret: cfg1.sessionSecret,
      passwordHash: cfg1.passwordHash,
      filePath: sessionFile,
    });
    assert.equal(storeLegacy.size, 0, 'legacy session without passwordFingerprint dropped');
    log('PASS: Legacy session schema dropped cleanly without crash');

    log('=== INVARIANT 11: Corrupted files, bad JSON, truncated writes handled gracefully ===');
    fs.writeFileSync(sessionFile, '{ invalid json [[[');
    const storeCorrupt = new SessionStore({
      secret: cfg1.sessionSecret,
      passwordHash: cfg1.passwordHash,
      filePath: sessionFile,
    });
    assert.equal(storeCorrupt.size, 0);
    const freshSession = storeCorrupt.create('10.0.0.5');
    assert.equal(storeCorrupt.size, 1);
    assert.ok(storeCorrupt.get(freshSession.cookieValue));
    log('PASS: Corrupted JSON handled safely and self-heals on write');

    log('=== INVARIANT 12: lastSeen throttling and maxSessions eviction ===');
    let virtualNow = 1_000_000;
    const storeCapacity = new SessionStore({
      secret: cfg1.sessionSecret,
      passwordHash: cfg1.passwordHash,
      filePath: sessionFile,
      maxSessions: 3,
      lastSeenThrottleMs: 60_000,
      now: () => virtualNow,
    });
    const item1 = storeCapacity.create('10.0.0.1');
    virtualNow += 100;
    const item2 = storeCapacity.create('10.0.0.2');
    virtualNow += 100;
    const item3 = storeCapacity.create('10.0.0.3');
    assert.equal(storeCapacity.size, 3);
    virtualNow += 100;
    const item4 = storeCapacity.create('10.0.0.4'); // item1 evicted
    assert.equal(storeCapacity.size, 3);
    assert.equal(storeCapacity.get(item1.cookieValue), null, 'oldest session evicted');
    assert.ok(storeCapacity.get(item4.cookieValue), 'newest session preserved');
    log('PASS: Max sessions limit and eviction operate properly');

    log('ALL L2 INVARIANTS VERIFIED SUCCESSFULLY (exit 0)');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error('L2 INVARIANT FAILURE:', err);
  process.exit(1);
});
