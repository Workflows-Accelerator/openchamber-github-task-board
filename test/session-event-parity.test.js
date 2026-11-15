import test from 'node:test';
import assert from 'node:assert/strict';
import { readSessionEventRequest } from '@openchamber/sdk';
import { readSessionEvent, SESSION_EVENTS_PATH } from '../service/session-event.ts';

/**
 * The service cannot import `@openchamber/sdk` (the bundle leaves packages
 * external), so `service/session-event.ts` mirrors the SDK reader. This test
 * holds the mirror to the real SDK 2.7.1 reader on valid and malformed bodies.
 */

function wire(overrides = {}) {
  return JSON.stringify({
    v: 1,
    requestId: 'req-1',
    event: {
      id: 'evt-1',
      type: 'turn-started',
      at: 1_763_136_000_000,
      session: { id: 'ses-1', parentId: null },
      project: { directory: '/workspace/project' },
      linked: [],
      ...overrides,
    },
  });
}

/** A body with the top-level `content` sibling `sessionEvents.content: true` adds. */
function wireWithContent(eventOverrides, content) {
  return JSON.stringify({ ...JSON.parse(wire(eventOverrides)), content });
}

const formAsk = {
  type: 'question-asked',
  sessionTitle: 'issue-52-worktree',
  ask: {
    kind: 'form',
    id: 'q-1',
    title: 'Choose a layout',
    fields: [{
      key: 'layout', type: 'string', title: 'Layout', description: null, required: true,
      options: [{ value: 'split', label: 'Split view' }],
    }],
  },
};

const fixtures = {
  turnStarted: wire(),
  turnFinished: wire({ type: 'turn-finished' }),
  turnFailed: wire({ type: 'turn-failed' }),
  permissionAsked: wire({ type: 'permission-asked', permission: { requestId: 'perm-1' } }),
  questionAskedForm: wire({ type: 'question-asked', question: { kind: 'form', id: 'q-1' } }),
  questionAskedPage: wire({ type: 'question-asked', question: { kind: 'page', id: 'q-2' } }),
  questionAskedFormWithContent: wireWithContent(
    { type: 'question-asked', question: { kind: 'form', id: 'q-1' } },
    formAsk
  ),
  questionAskedPageWithContent: wireWithContent(
    { type: 'question-asked', question: { kind: 'page', id: 'q-2' } },
    { type: 'question-asked', sessionTitle: 'x', ask: { kind: 'page', id: 'q-2', title: 'Preview' } }
  ),
  turnFinishedWithContent: wireWithContent(
    { type: 'turn-finished' },
    { type: 'turn-finished', sessionTitle: 'x', reply: 'Done.', replyTruncated: false }
  ),
  // §2.2: content of the wrong type, or not an object, is a malformed body.
  questionAskedContentWrongType: wireWithContent(
    { type: 'question-asked', question: { kind: 'form', id: 'q-1' } },
    { type: 'turn-finished', sessionTitle: 'x', reply: 'not an ask', replyTruncated: false }
  ),
  questionAskedContentNotObject: wireWithContent(
    { type: 'question-asked', question: { kind: 'form', id: 'q-1' } },
    'not an object'
  ),
  directoryNull: wire({ project: { directory: null } }),
  missingRequestId: JSON.stringify({ v: 1, event: JSON.parse(wire()).event }),
  wrongVersion: JSON.stringify({ ...JSON.parse(wire()), v: 2 }),
  unknownType: wire({ type: 'not-a-session-event' }),
  badParentType: wire({ session: { id: 'ses-1', parentId: 5 } }),
  missingLinked: wire({ linked: undefined }),
  permissionWithoutId: wire({ type: 'permission-asked', permission: {} }),
  questionBadKind: wire({ type: 'question-asked', question: { kind: 'dialog', id: 'q-1' } }),
  questionWithoutId: wire({ type: 'question-asked', question: { kind: 'form' } }),
  atString: wire({ at: '1763136000000' }),
  notJson: 'not json',
  arrayRoot: '[]',
  empty: '',
};

test('session-event: the local reader agrees with the installed SDK reader', () => {
  for (const [name, body] of Object.entries(fixtures)) {
    const sdk = readSessionEventRequest(body);
    const local = readSessionEvent(body);
    assert.equal(Boolean(local), Boolean(sdk), `${name}: presence must match`);
    if (sdk && local) assert.deepEqual(local, sdk, `${name}: parsed value must match`);
  }
});

test('session-event: the local reader keeps top-level content (the §0.3.4 regression)', () => {
  // Declaring `sessionEvents.content: true` while the reader rebuilt the body
  // as `{v, requestId, event}` would drop every form field with no error and
  // no failing test. This is that test.
  const local = readSessionEvent(fixtures.questionAskedFormWithContent);
  assert.ok(local);
  assert.equal(local.content.type, 'question-asked');
  assert.equal(local.content.ask.id, 'q-1');
  assert.equal(local.content.ask.fields[0].key, 'layout');
  assert.equal(readSessionEvent(fixtures.questionAskedContentWrongType), null);
});

test('session-event: the route path is the SDK session-events path', () => {
  assert.equal(SESSION_EVENTS_PATH, '/session-events');
});
