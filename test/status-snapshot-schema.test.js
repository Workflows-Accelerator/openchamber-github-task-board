import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COUNT_MAX,
  SnapshotStore,
  parseSnapshotBody,
  normalizeDirectory,
} from '../service/snapshot.ts';

const NOW = 1_763_136_000_000;
const DIRECTORY = '/workspace/project-a';

function validBody(overrides = {}) {
  return JSON.stringify({
    v: 1,
    directory: DIRECTORY,
    at: NOW - 1_000,
    complete: true,
    counts: { needsMe: 2, running: 1, blocked: 0, done: 3, total: 5 },
    top: { repo: 'owner/repo', number: 12, title: 'Fix the parser' },
    ...overrides,
  });
}

function parse(raw) {
  return parseSnapshotBody(raw, NOW);
}

test('status-snapshot-schema: a valid body is accepted and normalized', () => {
  const result = parse(validBody({ directory: `${DIRECTORY}/` }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.snapshot, {
    directory: DIRECTORY,
    at: NOW - 1_000,
    complete: true,
    counts: { needsMe: 2, running: 1, blocked: 0, done: 3, total: 5 },
    top: { repo: 'owner/repo', number: 12, title: 'Fix the parser' },
  });
});

test('status-snapshot-schema: unknown key, __proto__, and wrong types are rejected', () => {
  const cases = {
    unknownRootKey: validBody({ extra: 1 }),
    // A raw key, not an object literal `__proto__:` which would set the prototype instead.
    protoKey: validBody().replace('"v":1', '"v":1,"__proto__":{"polluted":true}'),
    wrongVersion: validBody({ v: '1' }),
    incomplete: validBody({ complete: false }),
    directoryRelative: validBody({ directory: 'relative/path' }),
    directoryDotDot: validBody({ directory: '/workspace/../etc' }),
    atString: validBody({ at: String(NOW) }),
    atFraction: validBody({ at: NOW + 0.5 }),
    countsMissing: validBody({ counts: { needsMe: 1, running: 0, blocked: 0, done: 0 } }),
    countsUnknownKey: validBody({
      counts: { needsMe: 1, running: 0, blocked: 0, done: 0, total: 1, extra: 0 },
    }),
    countsWrongType: validBody({
      counts: { needsMe: '1', running: 0, blocked: 0, done: 0, total: 1 },
    }),
    countsNegative: validBody({
      counts: { needsMe: -1, running: 0, blocked: 0, done: 0, total: 1 },
    }),
    countsOverMax: validBody({
      counts: { needsMe: COUNT_MAX + 1, running: 0, blocked: 0, done: 0, total: 1 },
    }),
    doneOverTotal: validBody({
      counts: { needsMe: 0, running: 0, blocked: 0, done: 5, total: 1 },
    }),
    // `needsMe` and `blocked` are subsets of the issue list, so neither can
    // exceed `total`. A body that says 8 tasks need the owner while the board
    // holds 1 task is internally impossible: the section would show "8 tasks"
    // beside "1 of 1 done" and a bar that disagrees with both.
    needsMeOverTotal: validBody({
      counts: { needsMe: 8, running: 0, blocked: 0, done: 0, total: 1 },
      top: { repo: 'owner/repo', number: 1, title: 't' },
    }),
    blockedOverTotal: validBody({
      counts: { needsMe: 0, running: 0, blocked: 3, done: 0, total: 1 },
    }),
    topUnknownKey: validBody({
      top: { repo: 'owner/repo', number: 1, title: 't', extra: true },
    }),
    topBadRepo: validBody({ top: { repo: 'not-a-repo', number: 1, title: 't' } }),
    topBadNumber: validBody({ top: { repo: 'owner/repo', number: 0, title: 't' } }),
    topEmptyTitle: validBody({ top: { repo: 'owner/repo', number: 1, title: '   ' } }),
    topControlChar: validBody({ top: { repo: 'owner/repo', number: 1, title: 'a\u0000b' } }),
    // A lone surrogate is not valid text: a slice of one produces half a
    // character on the owner's row, so it never enters the store.
    topLoneSurrogate: validBody({ top: { repo: 'owner/repo', number: 1, title: 'a\uD800b' } }),
    directoryLoneSurrogate: validBody({ directory: '/workspace/\uDC00project' }),
    // `1e999` parses to Infinity: an age that cannot be computed.
    atInfinite: validBody().replace('"at":' + (NOW - 1_000), '"at":1e999'),
    topCredential: validBody({
      top: { repo: 'owner/repo', number: 1, title: 'ghp_abcdefghijklmnopqrstuvwxyz0123' },
    }),
    notJson: 'not json',
    arrayRoot: '[]',
  };

  for (const [name, raw] of Object.entries(cases)) {
    const result = parse(raw);
    assert.equal(result.ok, false, `${name} must be rejected`);
    assert.equal(result.reason, 'invalid_snapshot');
  }
});

test('status-snapshot-schema: stale and future timestamps are rejected at the boundaries', () => {
  assert.equal(parse(validBody({ at: NOW - 90_000 })).ok, true);
  assert.equal(parse(validBody({ at: NOW - 90_001 })).ok, false);
  assert.equal(parse(validBody({ at: NOW + 5_000 })).ok, true);
  assert.equal(parse(validBody({ at: NOW + 5_001 })).ok, false);
});

test('status-snapshot-schema: top with needsMe 0 is rejected', () => {
  const result = parse(
    validBody({
      counts: { needsMe: 0, running: 0, blocked: 0, done: 0, total: 0 },
      top: { repo: 'owner/repo', number: 1, title: 't' },
    })
  );
  assert.equal(result.ok, false);
});

test('status-snapshot-schema: top null with needsMe 0 is accepted', () => {
  const result = parse(
    validBody({
      counts: { needsMe: 0, running: 0, blocked: 0, done: 2, total: 4 },
      top: null,
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.top, null);
});

test('status-snapshot-schema: a rejected body never changes the stored snapshot', () => {
  const store = new SnapshotStore();
  const good = parse(validBody());
  assert.equal(good.ok, true);
  store.set(good.snapshot);
  const before = store.get(DIRECTORY);
  const beforeJson = JSON.stringify(before);

  const rejected = [
    validBody({ extra: 1 }),
    validBody().replace('"v":1', '"v":1,"__proto__":{"polluted":true}'),
    validBody({ at: NOW - 200_000 }),
    validBody({ at: NOW + 200_000 }),
    validBody({ counts: { needsMe: 0, running: 0, blocked: 0, done: 0, total: 0 }, top: { repo: 'a/b', number: 1, title: 't' } }),
    validBody({ top: { repo: 'not-a-repo', number: 1, title: 't' } }),
    'not json',
  ];

  for (const raw of rejected) {
    const result = parse(raw);
    assert.equal(result.ok, false);
    // The route stores only on `ok`; the store itself must still hold the same object.
    assert.equal(store.get(DIRECTORY), before);
    assert.equal(JSON.stringify(store.get(DIRECTORY)), beforeJson);
  }
});

test('status-snapshot-schema: the store is keyed by the exact normalized directory', () => {
  const store = new SnapshotStore();
  const good = parse(validBody());
  store.set(good.snapshot);

  assert.equal(store.get(DIRECTORY), good.snapshot);
  assert.equal(store.get(`${DIRECTORY}/`), good.snapshot);
  assert.equal(store.get('/workspace/project-b'), undefined);
  assert.equal(store.get(null), undefined);
  assert.equal(store.get(undefined), undefined);
  assert.equal(store.get('relative'), undefined);
});

test('status-snapshot-schema: normalizeDirectory refuses values that cannot name a project folder', () => {
  assert.equal(normalizeDirectory('/a/b/'), '/a/b');
  assert.equal(normalizeDirectory('/'), '/');
  assert.equal(normalizeDirectory(''), null);
  assert.equal(normalizeDirectory('a/b'), null);
  assert.equal(normalizeDirectory('/a/../b'), null);
  assert.equal(normalizeDirectory('/a\u0000b'), null);
  assert.equal(normalizeDirectory(42), null);
  assert.equal(normalizeDirectory('/' + 'x'.repeat(1_100)), null);
});
