import test from 'node:test';
import assert from 'node:assert/strict';
import { guestStatusViewSchema } from '@openchamber/sdk/schemas';
import { buildStatusView, CLAMP, topValue } from '../service/status-view.ts';

/**
 * The six rows, the three states and the clamp rule, asserted against the copy
 * in `697a173` §2-§3 and parsed with the real installed SDK schema. A view that
 * does not parse would replace the whole section with "invalid", so every case
 * here also checks `guestStatusViewSchema.safeParse`.
 */

const NOW = 1_763_136_000_000;

const snapshot = (over = {}) => ({
  directory: '/workspace/project',
  at: NOW - 60_000,
  complete: true,
  counts: { needsMe: 8, running: 2, blocked: 1, done: 12, total: 40 },
  top: { repo: 'owner/repo', number: 123, title: 'Fix the parser' },
  ...over,
});

const parseView = (view) => {
  const parsed = guestStatusViewSchema.safeParse(view);
  assert.equal(parsed.success, true, parsed.success ? '' : JSON.stringify(parsed.error.issues));
  return parsed.data;
};

const row = (view, id) => view.rows.find((entry) => entry.id === id);

test('status-view: empty state is one muted note, EN and FR, no counts and no zeros', () => {
  const en = parseView(buildStatusView(undefined, 'en', NOW));
  assert.equal(en.rows.length, 1);
  assert.deepEqual(en.rows[0], {
    kind: 'note',
    id: 'empty',
    text: 'No board data yet. Open the board once to load it.',
    tone: 'muted',
  });

  const fr = parseView(buildStatusView(undefined, 'fr', NOW));
  assert.deepEqual(fr.rows[0], {
    kind: 'note',
    id: 'empty',
    text: "Aucune donnée du tableau pour l'instant. Ouvrez le tableau une fois pour le charger.",
    tone: 'muted',
  });
});

test('status-view: live state renders the six rows exactly as designed (EN)', () => {
  const view = parseView(buildStatusView(snapshot(), 'en', NOW));
  assert.deepEqual(view.rows, [
    { kind: 'line', id: 'needs-me', label: 'Needs me', value: '8 tasks', dot: 'warning' },
    {
      kind: 'line',
      id: 'top',
      label: 'Next task',
      value: 'owner/repo#123 Fix the parser',
      dot: 'warning',
      content: {
        kind: 'chips',
        chips: [{ id: 'issue', label: '#123', url: 'https://github.com/owner/repo/issues/123' }],
      },
    },
    {
      kind: 'line',
      id: 'progress',
      label: 'Progress',
      value: '12 of 40 done',
      dot: 'default',
      content: { kind: 'bar', value: 30 },
    },
    { kind: 'line', id: 'running', label: 'Running agents', value: '2 running', dot: 'success' },
    { kind: 'line', id: 'blocked', label: 'Blocked by dependencies', value: '1 task', dot: 'error' },
    { kind: 'note', id: 'age', text: 'Loaded 1 min ago', tone: 'muted' },
  ]);
});

test('status-view: live state renders the six rows exactly as designed (FR)', () => {
  const view = parseView(buildStatusView(snapshot(), 'fr', NOW));
  assert.deepEqual(view.rows, [
    { kind: 'line', id: 'needs-me', label: 'À traiter', value: '8 tâches', dot: 'warning' },
    {
      kind: 'line',
      id: 'top',
      label: 'Prochaine tâche',
      value: 'owner/repo#123 Fix the parser',
      dot: 'warning',
      content: {
        kind: 'chips',
        chips: [{ id: 'issue', label: '#123', url: 'https://github.com/owner/repo/issues/123' }],
      },
    },
    {
      kind: 'line',
      id: 'progress',
      label: 'Avancement',
      value: '12 sur 40 terminées',
      dot: 'default',
      content: { kind: 'bar', value: 30 },
    },
    { kind: 'line', id: 'running', label: 'Agents en cours', value: '2 en cours', dot: 'success' },
    { kind: 'line', id: 'blocked', label: 'Bloquées par des dépendances', value: '1 tâche', dot: 'error' },
    { kind: 'note', id: 'age', text: 'Chargé il y a 1 min', tone: 'muted' },
  ]);
});

test('status-view: live age note is "just now" under a minute and minutes after', () => {
  const fresh = buildStatusView(snapshot({ at: NOW - 20_000 }), 'en', NOW);
  assert.equal(row(fresh, 'age').text, 'Loaded just now');
  const frenchFresh = buildStatusView(snapshot({ at: NOW - 20_000 }), 'fr', NOW);
  assert.equal(row(frenchFresh, 'age').text, "Chargé à l'instant");
});

test('status-view: stale keeps the last values and warns; never rewrites a count to zero', () => {
  const live = parseView(buildStatusView(snapshot(), 'en', NOW));
  const stale = parseView(buildStatusView(snapshot(), 'en', NOW + 22 * 60_000));

  assert.equal(stale.rows.length, 6);
  for (const id of ['needs-me', 'top', 'progress', 'running', 'blocked']) {
    assert.deepEqual(row(stale, id), row(live, id), `${id} keeps its last value`);
  }
  assert.deepEqual(row(stale, 'age'), {
    kind: 'note',
    id: 'age',
    text: 'Data loaded 23 min ago. Open the board to refresh.',
    tone: 'warning',
  });

  const frenchStale = buildStatusView(snapshot(), 'fr', NOW + 22 * 60_000);
  assert.deepEqual(row(frenchStale, 'age'), {
    kind: 'note',
    id: 'age',
    text: 'Données chargées il y a 23 min. Ouvrez le tableau pour actualiser.',
    tone: 'warning',
  });
});

test('status-view: stale switches to the hour form after an hour', () => {
  const stale = buildStatusView(snapshot(), 'en', NOW + 2 * 3_600_000);
  assert.equal(row(stale, 'age').text, 'Data loaded 2 h ago. Open the board to refresh.');
  assert.equal(row(stale, 'age').tone, 'warning');
});

test('status-view: zero counts use the designed singular/plural copy', () => {
  const zero = parseView(
    buildStatusView(
      snapshot({ counts: { needsMe: 0, running: 0, blocked: 0, done: 0, total: 0 }, top: null }),
      'en',
      NOW
    )
  );
  assert.equal(row(zero, 'needs-me').value, 'Nothing waiting');
  assert.equal(row(zero, 'needs-me').dot, 'success');
  assert.equal(row(zero, 'top').value, 'No task needs you');
  assert.equal(row(zero, 'top').dot, 'success');
  assert.equal(row(zero, 'top').content, undefined);
  assert.equal(row(zero, 'progress').value, 'No tasks yet');
  assert.equal(row(zero, 'progress').content.value, 0);
  assert.equal(row(zero, 'running').value, 'None');
  assert.equal(row(zero, 'running').dot, 'muted');
  assert.equal(row(zero, 'blocked').value, 'None');
  assert.equal(row(zero, 'blocked').dot, 'success');

  const frenchZero = parseView(
    buildStatusView(
      snapshot({ counts: { needsMe: 0, running: 0, blocked: 0, done: 0, total: 0 }, top: null }),
      'fr',
      NOW
    )
  );
  assert.equal(row(frenchZero, 'needs-me').value, 'Rien en attente');
  assert.equal(row(frenchZero, 'top').value, 'Aucune tâche ne vous attend');
  assert.equal(row(frenchZero, 'progress').value, 'Aucune tâche');
  assert.equal(row(frenchZero, 'running').value, 'Aucun');
  assert.equal(row(frenchZero, 'blocked').value, 'Aucune');
});

test('status-view: one task and one running agent use the singular', () => {
  const one = buildStatusView(
    snapshot({ counts: { needsMe: 1, running: 1, blocked: 1, done: 1, total: 2 } }),
    'en',
    NOW
  );
  assert.equal(row(one, 'needs-me').value, '1 task');
  assert.equal(row(one, 'running').value, '1 running');
  assert.equal(row(one, 'blocked').value, '1 task');
  const frenchOne = buildStatusView(
    snapshot({ counts: { needsMe: 1, running: 1, blocked: 1, done: 1, total: 2 } }),
    'fr',
    NOW
  );
  assert.equal(row(frenchOne, 'needs-me').value, '1 tâche');
  assert.equal(row(frenchOne, 'running').value, '1 en cours');
  assert.equal(row(frenchOne, 'blocked').value, '1 tâche');
});

test('status-view: locale fr, fr-FR and fr-CA are French; en and anything else English', () => {
  for (const locale of ['fr', 'fr-FR', 'fr-CA', 'FR']) {
    assert.equal(row(buildStatusView(snapshot(), locale, NOW), 'needs-me').label, 'À traiter', locale);
  }
  for (const locale of ['en', 'en-GB', 'de', null, undefined, '']) {
    assert.equal(row(buildStatusView(snapshot(), locale, NOW), 'needs-me').label, 'Needs me', String(locale));
  }
});

test('status-view: a 400-character issue title is clamped to an 80-character value and still parses', () => {
  const view = parseView(
    buildStatusView(snapshot({ top: { repo: 'owner/repo', number: 7, title: 'A'.repeat(400) } }), 'en', NOW)
  );
  const top = row(view, 'top');
  assert.ok(top.value.length <= CLAMP.value, `value is ${top.value.length}`);
  assert.ok(top.value.endsWith('...'));
  assert.ok(top.value.startsWith('owner/repo#7 '));
});

test('status-view: a repository too long for the value falls back to its last path segment', () => {
  const repo = `${'a'.repeat(50)}/${'b'.repeat(50)}`;
  const value = topValue({ repo, number: 12_345, title: 'A'.repeat(400) }, CLAMP.value);
  assert.ok(value.length <= CLAMP.value, `value is ${value.length}`);
  assert.ok(value.startsWith(`${'b'.repeat(50)}#12345 `));
});

test('status-view: control characters and bidi overrides never reach the wire', () => {
  const view = parseView(
    buildStatusView(
      snapshot({ top: { repo: 'owner/repo', number: 9, title: 'Fix\u202e the\u0007 parser\nnow' } }),
      'en',
      NOW
    )
  );
  const top = row(view, 'top');
  assert.equal(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/.test(top.value), false);
  assert.ok(top.value.includes('Fix the parser now'));
});

test('status-view: every label, value and note stays inside its host limit', () => {
  const view = buildStatusView(
    snapshot({
      top: { repo: `${'o'.repeat(60)}/${'r'.repeat(60)}`, number: 1, title: 'T'.repeat(2048) },
    }),
    'en',
    NOW
  );
  parseView(view);
  for (const entry of view.rows) {
    if (entry.kind === 'line') {
      assert.ok(entry.label.length <= CLAMP.label, entry.label);
      assert.ok(entry.value.length <= CLAMP.value, entry.value);
    } else {
      assert.ok(entry.text.length <= CLAMP.note, entry.text);
    }
  }
});
