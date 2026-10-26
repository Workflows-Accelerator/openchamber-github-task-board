import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadConfig,
  hashPassword,
  verifyPassword,
  verifyPasswordAsync,
  ConfigError,
  describeConfig,
} from '../server/config.ts';

const TOKEN = 'ghp_synthetic_test_token_do_not_use_0001';
const SECRET = 's'.repeat(48);
const PASSWORD = 'correct horse battery staple';

function validEnv(overrides = {}) {
  return {
    BOARD_GITHUB_TOKEN: TOKEN,
    BOARD_GITHUB_LOGIN: 'board-owner',
    BOARD_REPO: 'owner/repo',
    BOARD_PASSWORD: PASSWORD,
    BOARD_SESSION_SECRET: SECRET,
    ...overrides,
  };
}

test('loadConfig accepts a complete environment', () => {
  const cfg = loadConfig(validEnv());
  assert.equal(cfg.githubToken, TOKEN);
  assert.equal(cfg.githubLogin, 'board-owner');
  assert.equal(cfg.repo.full, 'owner/repo');
  assert.equal(cfg.repo.owner, 'owner');
  assert.equal(cfg.repo.name, 'repo');
  assert.equal(cfg.port, 8787);
  assert.equal(cfg.host, '127.0.0.1');
  assert.equal(cfg.sessionSecret, SECRET);
  assert.equal(cfg.baseUrl, null);
  assert.equal(cfg.passwordWasGenerated, true);
  assert.equal(cfg.githubApiBase, 'https://api.github.com');
  assert.ok(cfg.passwordHash.startsWith('scrypt$'));
  assert.equal(verifyPassword(PASSWORD, cfg.passwordHash), true);
});

test('loadConfig prefers an explicit BOARD_PASSWORD_HASH over BOARD_PASSWORD', () => {
  const stored = hashPassword('hash-password-value');
  const cfg = loadConfig(validEnv({ BOARD_PASSWORD_HASH: stored }));
  assert.equal(cfg.passwordHash, stored);
  assert.equal(cfg.passwordWasGenerated, false);
  assert.equal(verifyPassword('hash-password-value', cfg.passwordHash), true);
  assert.equal(verifyPassword(PASSWORD, cfg.passwordHash), false);
});

test('loadConfig reports each missing core variable by name', () => {
  const cases = [
    ['BOARD_GITHUB_TOKEN', 'BOARD_GITHUB_TOKEN'],
    ['BOARD_GITHUB_LOGIN', 'BOARD_GITHUB_LOGIN'],
    ['BOARD_SESSION_SECRET', 'BOARD_SESSION_SECRET'],
  ];
  for (const [variable] of cases) {
    const env = validEnv();
    delete env[variable];
    assert.throws(
      () => loadConfig(env),
      (err) => err instanceof ConfigError && err.variable === variable && err.message.includes(variable),
      `expected refusal naming ${variable}`,
    );
  }
  const env = validEnv();
  delete env.BOARD_PASSWORD;
  assert.throws(
    () => loadConfig(env),
    (err) =>
      err instanceof ConfigError &&
      err.variable === 'BOARD_PASSWORD_HASH' &&
      /BOARD_PASSWORD/.test(err.message),
  );
});

test('loadConfig rejects invalid values and names the variable', () => {
  const cases = [
    ['BOARD_REPO', 'not-a-repo'],
    ['BOARD_REPO', 'owner/repo/extra'],
    ['BOARD_REPO', '/repo'],
    ['BOARD_GITHUB_LOGIN', 'bad login!'],
    ['BOARD_PORT', 'abc'],
    ['BOARD_PORT', '0'],
    ['BOARD_PORT', '70000'],
    ['BOARD_SESSION_SECRET', 'too-short'],
    ['BOARD_PASSWORD', 'short'],
    ['BOARD_PASSWORD_HASH', 'scrypt$nope'],
    ['BOARD_BASE_URL', 'ftp://example.test'],
    ['BOARD_GITHUB_TOKEN', '   '],
    ['BOARD_HOST', 'invalid host with spaces'],
    ['BOARD_HOST', '999.999.999.999'],
    ['BOARD_HOST', '127.0.0.256'],
    ['BOARD_HOST', '-leading-dash'],
    ['BOARD_HOST', 'http://localhost'],
  ];
  for (const [variable, value] of cases) {
    assert.throws(
      () => loadConfig(validEnv({ [variable]: value })),
      (err) => err instanceof ConfigError && err.variable === variable && err.message.includes(variable),
      `expected refusal naming ${variable} for ${JSON.stringify(value)}`,
    );
  }
});

test('loadConfig accepts a valid base URL and port', () => {
  const cfg = loadConfig(
    validEnv({
      BOARD_BASE_URL: 'https://board.example.test',
      BOARD_PORT: '9443',
      BOARD_HOST: '0.0.0.0',
    }),
  );
  assert.equal(cfg.baseUrl, 'https://board.example.test');
  assert.equal(cfg.port, 9443);
  assert.equal(cfg.host, '0.0.0.0');
});

test('config errors never contain secret values', () => {
  const attempts = [
    () => loadConfig(validEnv({ BOARD_PORT: 'abc' })),
    () => loadConfig(validEnv({ BOARD_REPO: 'nope' })),
    () => loadConfig(validEnv({ BOARD_GITHUB_LOGIN: 'bad login!' })),
  ];
  for (const attempt of attempts) {
    try {
      attempt();
      assert.fail('expected a ConfigError');
    } catch (err) {
      assert.ok(err instanceof ConfigError);
      assert.equal(err.message.includes(TOKEN), false);
      assert.equal(err.message.includes(PASSWORD), false);
      assert.equal(err.message.includes(SECRET), false);
    }
  }
});

test('describeConfig exposes no secrets', () => {
  const cfg = loadConfig(validEnv());
  const text = JSON.stringify(describeConfig(cfg));
  assert.equal(text.includes(TOKEN), false);
  assert.equal(text.includes(PASSWORD), false);
  assert.equal(text.includes(SECRET), false);
  assert.equal(text.includes(cfg.passwordHash), false);
  assert.match(text, /owner\/repo/);
});

test('hashPassword round-trips and salts every call', () => {
  const a = hashPassword('password-one');
  const b = hashPassword('password-one');
  assert.notEqual(a, b);
  assert.equal(verifyPassword('password-one', a), true);
  assert.equal(verifyPassword('password-one', b), true);
  assert.equal(verifyPassword('password-two', a), false);
  assert.equal(verifyPassword('', a), false);
});

test('verifyPassword returns false for malformed stored hashes', () => {
  for (const stored of ['', 'plain', 'scrypt$1$2$3', 'scrypt$16384$8$1$!!!$!!!', 'bcrypt$x$y']) {
    assert.equal(verifyPassword(PASSWORD, stored), false, `stored=${stored}`);
  }
});

test('BOARD_TRUST_PROXY is removed and forwarded headers are untrusted (R3)', () => {
  // Per manager ruling R3: blanket forwarded-header trust removed; config no longer parses or exposes trustProxy
  const config = loadConfig(validEnv({ BOARD_TRUST_PROXY: 'true' }));
  assert.equal('trustProxy' in config, false);
});

test('hash-password CLI tool runs on Node 22 via stdin pipe (R5)', async () => {
  const { execFile } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const path = await import('node:path');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const tool = path.resolve(here, '../tools/hash-password.mjs');
  const child = execFile(process.execPath, [tool]);
  child.stdin.end('test-cli-password-1234\n');
  const { stdout } = await new Promise((resolve, reject) => {
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout: out, stderr: err });
      else reject(new Error(`hash-password exited ${code}: ${err}`));
    });
  });
  const hash = stdout.trim();
  assert.ok(hash.startsWith('scrypt$'), `expected scrypt hash, got: ${hash}`);
  assert.equal(verifyPassword('test-cli-password-1234', hash), true);
});

test('verifyPasswordAsync matches valid password and rejects invalid', async () => {
  const hash = hashPassword('async-secret-pass');
  assert.equal(await verifyPasswordAsync('async-secret-pass', hash), true);
  assert.equal(await verifyPasswordAsync('wrong-pass', hash), false);
  assert.equal(await verifyPasswordAsync('', hash), false);
  assert.equal(await verifyPasswordAsync('async-secret-pass', 'invalid-hash'), false);
});

test('BOARD_REPO is optional for token-wide discovery; supplied invalid values still refuse', () => {
  const config = loadConfig(validEnv({ BOARD_REPO: undefined }));
  assert.equal(config.repo, null);
});
