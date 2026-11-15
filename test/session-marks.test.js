import test from 'node:test';
import assert from 'node:assert/strict';
import { MARK_TEXT, MARK_POLL_MS, SessionMarks } from '../service/session-marks.ts';

/**
 * The mark rule of D49.3 and D50.1: two states, one mark per session, a
 * subagent ignored, a waiting mark polled until it resolves, and a failed poll
 * that keeps the mark instead of showing a false all-clear.
 */

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function event(type, { sessionId = 'ses-1', parentId = null } = {}) {
  return {
    v: 1,
    requestId: 'req',
    event: {
      id: `evt-${type}`,
      type,
      at: Date.now(),
      session: { id: sessionId, parentId },
      project: { directory: '/workspace/project' },
      linked: [],
    },
  };
}

function harness(options = {}) {
  const calls = [];
  const state = {
    nextStatus: options.nextStatus ?? 'waiting',
    error: null,
    statusCalls: 0,
  };
  const host = {
    setMark: async (target, mark) => {
      calls.push({ target, mark });
    },
    sessionStatus: async () => {
      state.statusCalls += 1;
      if (state.error) throw state.error;
      return state.nextStatus;
    },
  };
  const marks = new SessionMarks(host, { pollMs: options.pollMs ?? 10 });
  return { calls, state, marks };
}

test('session-marks: turn-started sets the running mark, French by default', async () => {
  const { calls, marks } = harness();
  try {
    marks.handleEvent(event('turn-started'));
    await flush();
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      target: { sessionId: 'ses-1' },
      mark: { icon: 'time', tone: 'info', text: MARK_TEXT.running.fr },
    });
    assert.equal(marks.stateOf('ses-1'), 'running');
    assert.equal(marks.languageOf(), 'fr');
  } finally {
    marks.stop();
  }
});

test('session-marks: question-asked overrides running with the waiting mark', async () => {
  const { calls, marks } = harness();
  try {
    marks.handleEvent(event('turn-started'));
    await flush();
    marks.handleEvent(event('question-asked'));
    await flush();
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].mark, {
      icon: 'question',
      tone: 'warning',
      text: MARK_TEXT.waiting.fr,
    });
    assert.equal(marks.stateOf('ses-1'), 'waiting');
  } finally {
    marks.stop();
  }
});

test('session-marks: turn-finished and turn-failed clear the mark', async () => {
  for (const type of ['turn-finished', 'turn-failed']) {
    const { calls, marks } = harness();
    try {
      marks.handleEvent(event('turn-started'));
      await flush();
      marks.handleEvent(event(type));
      await flush();
      assert.equal(calls.length, 2);
      assert.deepEqual(calls[1], { target: { sessionId: 'ses-1' }, mark: null });
      assert.equal(marks.stateOf('ses-1'), undefined);
    } finally {
      marks.stop();
    }
  }
});

test('session-marks: a subagent session is ignored', async () => {
  const { calls, marks } = harness();
  try {
    marks.handleEvent(event('turn-started', { sessionId: 'child', parentId: 'ses-1' }));
    marks.handleEvent(event('question-asked', { sessionId: 'child', parentId: 'ses-1' }));
    marks.handleEvent(event('turn-finished', { sessionId: 'child', parentId: 'ses-1' }));
    await flush();
    assert.equal(calls.length, 0);
    assert.equal(marks.stateOf('child'), undefined);
  } finally {
    marks.stop();
  }
});

test('session-marks: setMark is not called again when the state did not change', async () => {
  const { calls, marks } = harness();
  try {
    marks.handleEvent(event('turn-started'));
    marks.handleEvent(event('turn-started'));
    marks.handleEvent(event('turn-started'));
    await flush();
    assert.equal(calls.length, 1);
  } finally {
    marks.stop();
  }
});

test('session-marks: the poll turns waiting into running on busy', async () => {
  const { calls, state, marks } = harness({ nextStatus: 'busy' });
  try {
    marks.handleEvent(event('question-asked'));
    await flush();
    assert.equal(calls.length, 1);
    await sleep(40);
    assert.ok(state.statusCalls >= 1);
    const last = calls[calls.length - 1];
    assert.deepEqual(last.mark, { icon: 'time', tone: 'info', text: MARK_TEXT.running.fr });
    assert.equal(marks.stateOf('ses-1'), 'running');
  } finally {
    marks.stop();
  }
});

test('session-marks: the poll clears the waiting mark on idle', async () => {
  const { calls, marks } = harness({ nextStatus: 'idle' });
  try {
    marks.handleEvent(event('question-asked'));
    await flush();
    await sleep(40);
    const last = calls[calls.length - 1];
    assert.deepEqual(last, { target: { sessionId: 'ses-1' }, mark: null });
    assert.equal(marks.stateOf('ses-1'), undefined);
  } finally {
    marks.stop();
  }
});

test('session-marks: the poll keeps the waiting mark on waiting without re-sending it', async () => {
  const { calls, state, marks } = harness({ nextStatus: 'waiting' });
  try {
    marks.handleEvent(event('question-asked'));
    await flush();
    assert.equal(calls.length, 1);
    await sleep(45);
    assert.ok(state.statusCalls >= 2, `polled ${state.statusCalls} times`);
    assert.equal(calls.length, 1, 'setMark is called only when the state changes');
    assert.equal(marks.stateOf('ses-1'), 'waiting');
  } finally {
    marks.stop();
  }
});

test('session-marks: a failed poll keeps the mark, never sends null, and retries with backoff', async () => {
  const { calls, state, marks } = harness();
  try {
    state.error = new Error('host unavailable');
    marks.handleEvent(event('question-asked'));
    await flush();
    assert.equal(calls.length, 1);

    await sleep(60);
    assert.ok(state.statusCalls >= 2, `retried ${state.statusCalls} times`);
    assert.equal(calls.filter((call) => call.mark === null).length, 0);
    assert.equal(marks.stateOf('ses-1'), 'waiting');
  } finally {
    marks.stop();
  }
});

test('session-marks: the poll stops once the mark is cleared', async () => {
  const { state, marks } = harness({ nextStatus: 'waiting' });
  try {
    marks.handleEvent(event('question-asked'));
    await flush();
    await sleep(25);
    marks.handleEvent(event('turn-finished'));
    await flush();
    const afterClear = state.statusCalls;
    await sleep(50);
    assert.equal(state.statusCalls, afterClear);
  } finally {
    marks.stop();
  }
});

test('session-marks: the locale of /status re-sets live marks in the other language', async () => {
  const { calls, marks } = harness();
  try {
    marks.handleEvent(event('turn-started'));
    await flush();
    marks.noteLocale('en-US');
    await flush();
    assert.equal(marks.languageOf(), 'en');
    assert.deepEqual(calls[calls.length - 1].mark, {
      icon: 'time',
      tone: 'info',
      text: MARK_TEXT.running.en,
    });
    marks.noteLocale('en-GB');
    await flush();
    assert.equal(calls.length, 2, 'no re-send when the language did not change');
    marks.noteLocale('fr');
    await flush();
    assert.equal(calls[calls.length - 1].mark.text, MARK_TEXT.running.fr);
  } finally {
    marks.stop();
  }
});

test('session-marks: no mark text ever carries a snapshot value', async () => {
  const allowed = new Set([
    MARK_TEXT.running.en,
    MARK_TEXT.running.fr,
    MARK_TEXT.waiting.en,
    MARK_TEXT.waiting.fr,
  ]);
  const { calls, marks } = harness();
  try {
    marks.handleEvent(event('turn-started'));
    await flush();
    marks.handleEvent(event('question-asked'));
    await flush();
    marks.noteLocale('en');
    await flush();
    for (const call of calls) {
      if (call.mark === null) continue;
      assert.equal(allowed.has(call.mark.text), true, call.mark.text);
      assert.equal(call.mark.text.includes('owner/repo'), false);
      assert.equal(call.mark.text.includes('Fix the parser'), false);
      assert.equal(call.mark.url, undefined);
    }
    assert.equal(MARK_POLL_MS, 30_000);
  } finally {
    marks.stop();
  }
});
