import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CanvasLayoutStore,
  LayoutValidationError,
  DEFAULT_MAX_SCOPES,
  DEFAULT_MAX_POSITIONS_PER_SCOPE,
  MAX_EXPANDED_GROUPS,
} from '../server/layout.ts';

const DEFAULT_SCOPE = { direction: 'auto', expandedGroups: [], positions: {}, updatedAt: null };

function makeStore(options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-test-'));
  const filePath = path.join(dir, 'canvas-layout.json');
  return {
    dir,
    filePath,
    store: new CanvasLayoutStore({ filePath, ...options }),
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

function readLayout(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isLayoutError(code) {
  return (error) => {
    assert.ok(error instanceof LayoutValidationError, `expected LayoutValidationError, got ${error?.name}`);
    assert.equal(error.name, 'LayoutValidationError');
    assert.equal(error.code, code);
    assert.ok(typeof error.message === 'string' && error.message.length > 0);
    return true;
  };
}

test('layout store exports sane defaults', () => {
  assert.equal(DEFAULT_MAX_SCOPES > 0, true);
  assert.equal(DEFAULT_MAX_POSITIONS_PER_SCOPE > 0, true);
  assert.equal(MAX_EXPANDED_GROUPS > 0, true);
});

test('missing file returns the clean default scope and writes nothing', async () => {
  const { filePath, store, cleanup } = makeStore();
  try {
    assert.deepEqual(await store.getScope('all'), DEFAULT_SCOPE);
    assert.deepEqual(await store.getScope('acme/widgets'), DEFAULT_SCOPE);
    assert.equal(fs.existsSync(filePath), false, 'reading must not create the file');
  } finally {
    cleanup();
  }
});

test('patchScope creates a scope with direction, expanded groups and positions', async () => {
  const { filePath, store, cleanup } = makeStore();
  try {
    const layout = await store.patchScope('all', {
      direction: 'LR',
      expandedGroups: ['repo:acme/widgets', 'group:blocked'],
      setPositions: { 'card-1': { x: 10, y: 20.5 } },
    });

    assert.equal(layout.direction, 'LR');
    assert.deepEqual(layout.expandedGroups, ['repo:acme/widgets', 'group:blocked']);
    assert.deepEqual(layout.positions, { 'card-1': { x: 10, y: 20.5 } });
    assert.match(layout.updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const parsed = readLayout(filePath);
    assert.equal(parsed.version, 1);
    assert.deepEqual(Object.keys(parsed.scopes), ['all']);
    assert.equal(parsed.scopes.all.direction, 'LR');
    assert.deepEqual(parsed.scopes.all.positions, { 'card-1': { x: 10, y: 20.5 } });
    assert.equal(parsed.scopes.all.updatedAt, layout.updatedAt);
  } finally {
    cleanup();
  }
});

test('patchScope merges positions, updates existing keys and deletes with null', async () => {
  const { store, cleanup } = makeStore();
  try {
    await store.patchScope('all', {
      setPositions: { a: { x: 1, y: 2 }, b: { x: 3, y: 4 } },
    });
    await store.patchScope('all', {
      setPositions: { b: { x: 30, y: 40 }, c: { x: 5, y: 6 } },
    });
    let layout = await store.getScope('all');
    assert.deepEqual(layout.positions, { a: { x: 1, y: 2 }, b: { x: 30, y: 40 }, c: { x: 5, y: 6 } });

    layout = await store.patchScope('all', { setPositions: { a: null } });
    assert.deepEqual(layout.positions, { b: { x: 30, y: 40 }, c: { x: 5, y: 6 } });

    layout = await store.patchScope('all', { setPositions: { missing: null } });
    assert.deepEqual(layout.positions, { b: { x: 30, y: 40 }, c: { x: 5, y: 6 } });
  } finally {
    cleanup();
  }
});

test('resetPositions clears saved positions but keeps direction and expanded groups', async () => {
  const { store, cleanup } = makeStore();
  try {
    await store.patchScope('all', {
      direction: 'TD',
      expandedGroups: ['group:a'],
      setPositions: { a: { x: 1, y: 2 }, b: { x: 3, y: 4 } },
    });

    const layout = await store.patchScope('all', { resetPositions: true });
    assert.deepEqual(layout.positions, {});
    assert.equal(layout.direction, 'TD');
    assert.deepEqual(layout.expandedGroups, ['group:a']);
  } finally {
    cleanup();
  }
});

test('resetPositions combined with setPositions applies the reset first', async () => {
  const { store, cleanup } = makeStore();
  try {
    await store.patchScope('all', { setPositions: { old: { x: 1, y: 1 } } });
    const layout = await store.patchScope('all', {
      resetPositions: true,
      setPositions: { fresh: { x: 9, y: 8 } },
    });
    assert.deepEqual(layout.positions, { fresh: { x: 9, y: 8 } });
  } finally {
    cleanup();
  }
});

test('expandedGroups are deduplicated in order and replace the previous list', async () => {
  const { store, cleanup } = makeStore();
  try {
    let layout = await store.patchScope('all', {
      expandedGroups: ['b', 'a', 'b', 'a'],
    });
    assert.deepEqual(layout.expandedGroups, ['b', 'a']);

    layout = await store.patchScope('all', { expandedGroups: ['c'] });
    assert.deepEqual(layout.expandedGroups, ['c']);
  } finally {
    cleanup();
  }
});

test('direction, expanded groups and positions persist across store re-instantiation', async () => {
  const { filePath, store, cleanup } = makeStore();
  try {
    await store.patchScope('acme/widgets', {
      direction: 'LR',
      expandedGroups: ['group:one'],
      setPositions: { 'acme/widgets#7': { x: -12.25, y: 480 } },
    });

    const reopened = new CanvasLayoutStore({ filePath });
    const layout = await reopened.getScope('acme/widgets');
    assert.equal(layout.direction, 'LR');
    assert.deepEqual(layout.expandedGroups, ['group:one']);
    assert.deepEqual(layout.positions, { 'acme/widgets#7': { x: -12.25, y: 480 } });
    assert.match(layout.updatedAt, /Z$/);

    assert.deepEqual(await reopened.getScope('all'), DEFAULT_SCOPE, 'other scopes stay default');
  } finally {
    cleanup();
  }
});

test('20 concurrent patchScope calls preserve every write', async () => {
  const { filePath, store, cleanup } = makeStore();
  try {
    const writes = Array.from({ length: 20 }, (_, index) =>
      store.patchScope('all', {
        setPositions: { [`card-${index}`]: { x: index, y: index * 2 } },
      }),
    );
    await Promise.all(writes);

    const layout = await store.getScope('all');
    assert.equal(Object.keys(layout.positions).length, 20);
    for (let index = 0; index < 20; index += 1) {
      assert.deepEqual(layout.positions[`card-${index}`], { x: index, y: index * 2 });
    }

    const reopened = new CanvasLayoutStore({ filePath });
    const persisted = await reopened.getScope('all');
    assert.equal(Object.keys(persisted.positions).length, 20, 'every concurrent write reached disk');
  } finally {
    cleanup();
  }
});

test('atomic writes leave no temp files behind and use mode 0600', async () => {
  const { dir, filePath, store, cleanup } = makeStore();
  try {
    await store.patchScope('all', { setPositions: { a: { x: 1, y: 1 } } });
    await store.patchScope('all', { direction: 'TD' });
    await store.patchScope('all', { setPositions: { b: { x: 2, y: 2 } } });

    const entries = fs.readdirSync(dir);
    assert.deepEqual(entries, ['canvas-layout.json']);
    assert.equal(entries.some((name) => name.endsWith('.tmp')), false);
    assert.equal(fs.statSync(filePath).mode & 0o777, 0o600);
  } finally {
    cleanup();
  }
});

test('corrupt JSON is backed up, ignored and repaired by the next patch', async () => {
  const { filePath, store, cleanup } = makeStore();
  try {
    fs.writeFileSync(filePath, '{ this is not json', { mode: 0o600 });

    assert.deepEqual(await store.getScope('all'), DEFAULT_SCOPE);
    assert.equal(fs.readFileSync(`${filePath}.corrupt`, 'utf8'), '{ this is not json');

    const layout = await store.patchScope('all', { direction: 'TD' });
    assert.equal(layout.direction, 'TD');

    const parsed = readLayout(filePath);
    assert.equal(parsed.version, 1);
    assert.equal(parsed.scopes.all.direction, 'TD');
  } finally {
    cleanup();
  }
});

test('structurally invalid scope data is sanitized instead of crashing', async () => {
  const { filePath, store, cleanup } = makeStore();
  try {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        version: 1,
        scopes: {
          all: {
            direction: 'RL',
            expandedGroups: ['group-a', 7, 'group-a', 'group-b'],
            positions: {
              good: { x: 1, y: 2 },
              stringy: { x: '3', y: 4 },
              nan: { x: null, y: 2 },
              infinite: { x: 1e999, y: 2 },
            },
            updatedAt: 'not-a-date',
          },
          'bad scope': { direction: 'LR' },
        },
      }),
    );

    const layout = await store.getScope('all');
    assert.equal(layout.direction, 'auto');
    assert.deepEqual(layout.expandedGroups, ['group-a', 'group-b']);
    assert.deepEqual(layout.positions, { good: { x: 1, y: 2 } });
    assert.equal(layout.updatedAt, null);

    await store.patchScope('all', { direction: 'LR' });
    assert.deepEqual(Object.keys(readLayout(filePath).scopes), ['all'], 'invalid scope keys are dropped');
  } finally {
    cleanup();
  }
});

test('validation rejects invalid directions, scopes and position keys without writing', async () => {
  const { filePath, store, cleanup } = makeStore();
  try {
    await assert.rejects(store.patchScope('all', { direction: 'RL' }), isLayoutError('invalid-direction'));
    await assert.rejects(store.patchScope('all', { direction: 'lr' }), isLayoutError('invalid-direction'));
    await assert.rejects(store.patchScope('', { direction: 'LR' }), isLayoutError('invalid-scope'));
    await assert.rejects(store.patchScope('bad scope', { direction: 'LR' }), isLayoutError('invalid-scope'));
    await assert.rejects(store.patchScope('a/b/c', { direction: 'LR' }), isLayoutError('invalid-scope'));
    await assert.rejects(store.getScope('bad scope'), isLayoutError('invalid-scope'));
    await assert.rejects(
      store.patchScope('all', { setPositions: { '': { x: 1, y: 2 } } }),
      isLayoutError('invalid-position'),
    );
    await assert.rejects(
      store.patchScope('all', { setPositions: { a: { x: 1 } } }),
      isLayoutError('invalid-position'),
    );
    await assert.rejects(
      store.patchScope('all', { expandedGroups: ['ok', 5] }),
      isLayoutError('invalid-expanded-groups'),
    );
    await assert.rejects(
      store.patchScope('all', { expandedGroups: [''] }),
      isLayoutError('invalid-expanded-groups'),
    );

    assert.equal(fs.existsSync(filePath), false, 'rejected patches never touch the file');
  } finally {
    cleanup();
  }
});

test('validation rejects non-finite positions with LayoutValidationError', async () => {
  const { filePath, store, cleanup } = makeStore();
  try {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      await assert.rejects(
        store.patchScope('all', { setPositions: { a: { x: bad, y: 0 } } }),
        isLayoutError('invalid-position'),
      );
      await assert.rejects(
        store.patchScope('all', { setPositions: { a: { x: 0, y: bad } } }),
        isLayoutError('invalid-position'),
      );
    }
    assert.equal(fs.existsSync(filePath), false);
  } finally {
    cleanup();
  }
});

test('position and scope caps reject oversized patches atomically', async () => {
  const capped = makeStore({ maxPositionsPerScope: 2, maxScopes: 1 });
  try {
    await capped.store.patchScope('all', {
      setPositions: { a: { x: 1, y: 1 }, b: { x: 2, y: 2 } },
    });

    await assert.rejects(
      capped.store.patchScope('all', { setPositions: { c: { x: 3, y: 3 } } }),
      isLayoutError('too-many-positions'),
    );
    assert.deepEqual(Object.keys((await capped.store.getScope('all')).positions), ['a', 'b']);

    await assert.rejects(
      capped.store.patchScope('acme/widgets', { direction: 'LR' }),
      isLayoutError('too-many-scopes'),
    );
  } finally {
    capped.cleanup();
  }
});

test('oversized expandedGroups lists are rejected', async () => {
  const { filePath, store, cleanup } = makeStore();
  try {
    const groups = Array.from({ length: MAX_EXPANDED_GROUPS + 1 }, (_, index) => `group-${index}`);
    await assert.rejects(
      store.patchScope('all', { expandedGroups: groups }),
      isLayoutError('invalid-expanded-groups'),
    );
    assert.equal(fs.existsSync(filePath), false);
  } finally {
    cleanup();
  }
});

test('empty patch is a read-only no-op', async () => {
  const { filePath, store, cleanup } = makeStore();
  try {
    const layout = await store.patchScope('all', {});
    assert.deepEqual(layout, DEFAULT_SCOPE);
    assert.equal(fs.existsSync(filePath), false);
  } finally {
    cleanup();
  }
});

test('empty patch on a new scope stays a read-only no-op at the scope cap', async () => {
  const { filePath, store, cleanup } = makeStore({ maxScopes: 1 });
  try {
    await store.patchScope('all', { direction: 'LR' });

    const layout = await store.patchScope('acme/widgets', {});
    assert.deepEqual(layout, DEFAULT_SCOPE);
    assert.deepEqual(Object.keys(readLayout(filePath).scopes), ['all'], 'no scope was created');
  } finally {
    cleanup();
  }
});

test('non-finite maxPositionsPerScope falls back to the default cap', async () => {
  const { store, cleanup } = makeStore({ maxPositionsPerScope: Number.NaN });
  try {
    const positions = {};
    for (let index = 0; index < DEFAULT_MAX_POSITIONS_PER_SCOPE; index += 1) {
      positions[`p-${index}`] = { x: index, y: index };
    }
    await store.patchScope('all', { setPositions: positions });

    await assert.rejects(
      store.patchScope('all', { setPositions: { overflow: { x: 1, y: 1 } } }),
      isLayoutError('too-many-positions'),
    );
  } finally {
    cleanup();
  }
});

test('non-finite maxScopes falls back to the default cap', async () => {
  const { store, cleanup } = makeStore({ maxScopes: Number.POSITIVE_INFINITY });
  try {
    for (let index = 0; index < DEFAULT_MAX_SCOPES - 1; index += 1) {
      await store.patchScope(`owner-${index}/repo`, { direction: 'LR' });
    }
    await store.patchScope('all', { direction: 'LR' });

    await assert.rejects(
      store.patchScope('one/too-many', { direction: 'LR' }),
      isLayoutError('too-many-scopes'),
    );
  } finally {
    cleanup();
  }
});

test('negative zero coordinates are normalized so memory matches the persisted file', async () => {
  const { filePath, store, cleanup } = makeStore();
  try {
    const patched = await store.patchScope('all', { setPositions: { p: { x: -0, y: -0 } } });
    assert.equal(Object.is(patched.positions.p.x, -0), false, 'patched x is +0');
    assert.equal(Object.is(patched.positions.p.y, -0), false, 'patched y is +0');

    const reopened = new CanvasLayoutStore({ filePath });
    assert.deepEqual(patched.positions, (await reopened.getScope('all')).positions);
  } finally {
    cleanup();
  }
});

test('a failed write rolls back memory, leaves no temp file and keeps the queue usable', async () => {
  const { dir, filePath, store, cleanup } = makeStore();
  try {
    await store.patchScope('all', { direction: 'LR', setPositions: { a: { x: 1, y: 1 } } });

    fs.rmSync(filePath);
    fs.mkdirSync(filePath);
    await assert.rejects(store.patchScope('all', { direction: 'TD' }));
    assert.equal((await store.getScope('all')).direction, 'LR', 'in-memory state rolled back');
    assert.equal(fs.readdirSync(dir).some((name) => name.endsWith('.tmp')), false, 'temp file removed');

    fs.rmdirSync(filePath);
    const recovered = await store.patchScope('all', { direction: 'TD' });
    assert.equal(recovered.direction, 'TD', 'queue survived the failed write');
  } finally {
    cleanup();
  }
});

test('a rejected patch does not stall queued callers', async () => {
  const { store, cleanup } = makeStore();
  try {
    const results = await Promise.allSettled([
      store.patchScope('all', { direction: 'LR' }),
      store.patchScope('all', { direction: 'RL' }),
      store.patchScope('all', { setPositions: { a: { x: 1, y: 1 } } }),
      store.getScope('bad scope'),
      store.patchScope('all', { direction: 'TD' }),
    ]);

    assert.deepEqual(
      results.map((result) => result.status),
      ['fulfilled', 'rejected', 'fulfilled', 'rejected', 'fulfilled'],
    );
    const layout = await store.getScope('all');
    assert.equal(layout.direction, 'TD');
    assert.deepEqual(layout.positions, { a: { x: 1, y: 1 } });
  } finally {
    cleanup();
  }
});
