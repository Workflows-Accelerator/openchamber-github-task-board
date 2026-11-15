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

const fixtures = {
  turnStarted: wire(),
  turnFinished: wire({ type: 'turn-finished' }),
  turnFailed: wire({ type: 'turn-failed' }),
  permissionAsked: wire({ type: 'permission-asked', permission: { requestId: 'perm-1' } }),
  questionAskedForm: wire({ type: 'question-asked', question: { kind: 'form', id: 'q-1' } }),
  questionAskedPage: wire({ type: 'question-asked', question: { kind: 'page', id: 'q-2' } }),
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

test('session-event: the route path is the SDK session-events path', () => {
  assert.equal(SESSION_EVENTS_PATH, '/session-events');
});
