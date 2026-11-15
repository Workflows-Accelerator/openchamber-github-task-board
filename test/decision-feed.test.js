import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDocument, collectText } from './dom-shim.js';
import {
  DECISION_MAX_AGE_MS,
  DECISION_REFRESH_MIN_MS,
  DECISION_STALENESS_MS,
  decisionAnswerStateFromResponse,
  decisionEmptyBoxSuppressed,
  decisionFeedFromResponse,
  decisionFeedNote,
  decisionObservation,
  formatClock,
  renderDecisionBlock,
  renderDecisionStatusNote,
  shouldRefreshDecisions,
} from '../panel/decisions.ts';

/**
 * The decision feed, its states and the panel wiring (D53 S1/S2 delta fix).
 *
 * Every rule here was previously only in `panel/main.ts`, which no test
 * imports, so removing it left the suite green. The rule now lives in
 * `panel/decisions.ts` and a source assertion holds `main.ts` to calling it.
 * Each test below dies when its rule is reverted.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const MAIN_TS = fs.readFileSync(path.join(here, '..', 'panel', 'main.ts'), 'utf8');

installDocument();

const NOW = 1_763_136_000_000;

const fields = [
  { key: 'name', type: 'string', title: 'Name', description: null, required: false },
];

function decision(overrides = {}) {
  return {
    id: 'ses_1:form:q_1',
    kind: 'form',
    sessionId: 'ses_1',
    parentId: null,
    directory: '/workspace/code/x',
    askId: 'q_1',
    title: 'Choose a layout',
    sessionTitle: 'issue-52-worktree',
    askedAt: NOW - 60_000,
    state: 'pending',
    confirmedAt: NOW - 60_000,
    firstSeenAt: NOW - 60_000,
    answeredAt: null,
    linked: [{ id: 'acme/board#52', number: 52, url: 'https://github.com/acme/board/issues/52' }],
    fields,
    page: null,
    droppedFields: 0,
    droppedOptions: 0,
    ...overrides,
  };
}

const context = (overrides = {}) => ({
  language: 'en',
  now: NOW,
  canAnswer: true,
  issueNumber: 52,
  ...overrides,
});

const feed = (overrides = {}) => ({
  status: 'ok',
  at: NOW,
  startedAt: 1,
  restartedAt: null,
  decisions: [],
  lastAttemptAt: NOW,
  ...overrides,
});

test('decision-feed: a 404 block says closed in the session, never waiting for you', () => {
  const block = renderDecisionBlock(decision(), context({ answerState: 'stale' }));
  const text = collectText(block).join(' ');
  assert.match(text, /closed in the session/);
  assert.match(text, /already closed in the session/);
  assert.equal(text.includes('waiting for you'), false, 'one block cannot say waiting and closed at once');
});

test('decision-feed: a 409 names the entry state, so an answered entry is not "in flight"', () => {
  assert.deepEqual(
    decisionAnswerStateFromResponse(409, 'DECISION_NOT_PENDING', null, 'answering'),
    { state: 'in-flight' }
  );
  assert.deepEqual(
    decisionAnswerStateFromResponse(409, 'DECISION_NOT_PENDING', null, 'answered-unconfirmed'),
    { state: 'already-answered' }
  );
  const block = renderDecisionBlock(decision(), context({ answerState: 'already-answered' }));
  const text = collectText(block).join(' ');
  assert.match(text, /already answered/);
  assert.match(text, /already sent in the session/);
  assert.equal(text.includes('answer in flight'), false);
  assert.equal(text.includes('waiting for you'), false);
  assert.ok(
    MAIN_TS.includes('decisionAnswerStateFromResponse(status, code, message, entryState)'),
    'the panel must pass the entry state the service named, or both 409s collapse into one'
  );
  assert.ok(
    MAIN_TS.includes('decisionAnswerStateFromResponse(status, code, errorMessage, entryState)'),
    'the dismissal path must pass it too'
  );
});

test('decision-feed: DECISION_NOT_PENDING with no state still means an answer is running', () => {
  assert.equal(decisionAnswerStateFromResponse(409, 'DECISION_NOT_PENDING', null, null).state, 'in-flight');
});

test('decision-feed: a down feed names the last confirmation, not the failed attempt', () => {
  const at = NOW - 10 * 60_000;
  const down = feed({ status: 'down', at, lastAttemptAt: NOW });
  const observation = decisionObservation(decision({ confirmedAt: NOW - 20 * 60_000 }), down, NOW, false);
  assert.equal(observation.unconfirmedSince, at);
  assert.notEqual(observation.unconfirmedSince, down.lastAttemptAt);
  const block = renderDecisionBlock(
    decision({ confirmedAt: NOW - 20 * 60_000 }),
    context({ unconfirmedSince: observation.unconfirmedSince })
  );
  const text = collectText(block).join(' ');
  assert.ok(text.includes(formatClock(at, 'en')), 'the block names the last successful read');
  assert.equal(text.includes(formatClock(down.lastAttemptAt, 'en')), false, 'the failed attempt is not a confirmation');
});

test('decision-feed: the restart note clears when a decision is confirmed after the restart', () => {
  const restarted = feed({ startedAt: NOW - 60_000, at: NOW - 30_000, restartedAt: NOW - 30_000 });
  const payload = (entries) => JSON.stringify({
    v: 1, at: NOW, startedAt: restarted.startedAt, decisions: entries,
  });
  const kept = decisionFeedFromResponse(
    restarted, 200, payload([decision({ confirmedAt: NOW - 90_000 })]), NOW
  );
  assert.equal(kept.restartedAt, restarted.restartedAt, 'an entry confirmed before the restart does not clear it');
  const cleared = decisionFeedFromResponse(
    restarted, 200, payload([decision({ confirmedAt: NOW - 10_000 })]), NOW
  );
  assert.equal(cleared.restartedAt, null, 'the session spoke again after the restart');
  assert.equal(decisionFeedNote(cleared, 1), null, 'the restart note is gone once a confirmation arrives');
});

test('decision-feed: a 429 is a rate limit, never an outage', () => {
  const previous = feed({ at: NOW - 5_000 });
  const limited = decisionFeedFromResponse(previous, 429, '', NOW);
  assert.equal(limited.status, 'limited');
  assert.equal(limited.status === 'down', false);
  assert.equal(limited.at, previous.at, 'the last successful read is kept');
  assert.equal(decisionFeedNote(limited, 1), 'rate-limited');
  assert.equal(decisionFeedNote(limited, 0), 'rate-limited');
  const text = collectText(renderDecisionStatusNote('rate-limited', 'en', previous.at)).join(' ');
  assert.match(text, /is answering/);
  assert.equal(text.includes('not answering'), false, 'a rate limit is not an outage');

  const outage = decisionFeedFromResponse(previous, 503, '', NOW);
  assert.equal(outage.status, 'down');
  assert.equal(decisionFeedNote(outage, 0), 'service-down');
  // The service is up: a 429 does not make a freshly confirmed decision stale.
  const observation = decisionObservation(decision({ confirmedAt: NOW - 60_000 }), limited, NOW, false);
  assert.equal(observation.canAnswer, true, 'a rate-limited read does not block answering');
  assert.equal(observation.unconfirmedSince, null);
});

test('decision-feed: an all-optional form is inert while another device answers', () => {
  let sent = 0;
  const block = renderDecisionBlock(
    decision({ state: 'answering' }),
    context({ onSubmit: () => { sent += 1; } })
  );
  const submit = block.querySelector('.decision-submit');
  assert.notEqual(submit, null);
  assert.equal(submit.disabled, true, 'inert must disable Send even when the form is complete');
  submit.dispatch('click');
  assert.equal(sent, 0);
});

test('decision-feed: the empty box is suppressed unless the feed is current', () => {
  assert.equal(decisionEmptyBoxSuppressed(feed()), false);
  assert.equal(decisionEmptyBoxSuppressed(feed({ status: 'down' })), true);
  assert.equal(decisionEmptyBoxSuppressed(feed({ status: 'unknown' })), true);
  assert.equal(decisionEmptyBoxSuppressed(feed({ status: 'limited' })), true);
  assert.equal(decisionEmptyBoxSuppressed(feed({ restartedAt: NOW })), true);
  assert.ok(
    MAIN_TS.includes('if (decisionEmptyBoxSuppressed(decisionFeed)) return;'),
    'the human view must consult the rule before it can print "Nothing is waiting on you"'
  );
});

test('decision-feed: an observation older than the window is not answerable and says so', () => {
  const confirmedAt = NOW - DECISION_STALENESS_MS - 1;
  const observation = decisionObservation(decision({ confirmedAt }), feed(), NOW, false);
  assert.equal(observation.staleByObservation, true);
  assert.equal(observation.canAnswer, false);
  assert.equal(observation.unconfirmedSince, confirmedAt);
  const block = renderDecisionBlock(
    decision({ confirmedAt }),
    context({ canAnswer: false, unconfirmedSince: confirmedAt })
  );
  const text = collectText(block).join(' ');
  assert.match(text, /not confirmed since/);
  assert.equal(text.includes('waiting for you'), false);
  assert.equal(block.querySelector('.decision-submit'), null, 'a stale observation offers no answer control');
  assert.ok(
    MAIN_TS.includes('decisionObservation(decision, decisionFeed, now, unbound)'),
    'main.ts must take the overlay from the rule, not compute its own'
  );
});

test('decision-feed: a form past its absolute age is not answerable', () => {
  const firstSeenAt = NOW - DECISION_MAX_AGE_MS - 1;
  const observation = decisionObservation(decision({ firstSeenAt }), feed(), NOW, false);
  assert.equal(observation.expired, true);
  assert.equal(observation.canAnswer, false);
  const block = renderDecisionBlock(
    decision({ firstSeenAt }),
    context({ canAnswer: false, answerState: 'expired' })
  );
  const text = collectText(block).join(' ');
  assert.match(text, /too old to answer/);
  assert.match(text, /Open the session to answer/);
  assert.equal(text.includes('waiting for you'), false);
  assert.equal(block.querySelector('.decision-submit'), null, 'an expired form offers no answer control');
  assert.equal(decisionAnswerStateFromResponse(409, 'DECISION_EXPIRED', null, 'pending').state, 'expired');
});

test('decision-feed: a snapshot and a visibility return refresh the feed, throttled', () => {
  assert.equal(shouldRefreshDecisions('snapshot', 0, NOW, false), true, 'the first snapshot reads');
  assert.equal(shouldRefreshDecisions('snapshot', NOW - 100, NOW, false), false, 'a snapshot burst is throttled');
  assert.equal(shouldRefreshDecisions('snapshot', NOW - DECISION_REFRESH_MIN_MS, NOW, false), true);
  assert.equal(shouldRefreshDecisions('visible', NOW - 100, NOW, false), false);
  assert.equal(shouldRefreshDecisions('visible', 0, NOW, false), true);
  assert.equal(shouldRefreshDecisions('recheck', NOW, NOW, false), true, 'an explicit Recheck is never throttled');
  assert.equal(shouldRefreshDecisions('snapshot', NOW - DECISION_REFRESH_MIN_MS, NOW, true), false, 'one read at a time');
  assert.ok(MAIN_TS.includes("maybeRefreshDecisions('snapshot')"), 'a later session snapshot refreshes the feed');
  assert.ok(MAIN_TS.includes("maybeRefreshDecisions('visible')"), 'returning to the board refreshes the feed');
});

test('decision-feed: the restart note is built from the service startedAt and rendered', () => {
  const previous = feed({ startedAt: NOW - 60_000 });
  const next = decisionFeedFromResponse(
    previous, 200, JSON.stringify({ v: 1, at: NOW, startedAt: NOW - 1_000, decisions: [] }), NOW
  );
  assert.equal(next.restartedAt, NOW);
  assert.equal(decisionFeedNote(next, 0), 'restarted');
  assert.match(collectText(renderDecisionStatusNote('restarted', 'en', next.restartedAt)).join(' '), /restarted at/);
  assert.ok(
    MAIN_TS.includes('decisionFeedFromResponse(decisionFeed, status, res && res.body, now)'),
    'main.ts must build the feed from the service startedAt'
  );
  assert.ok(
    MAIN_TS.includes('decisionFeedNote(decisionFeed, decisionFeed.decisions.length)'),
    'the inbox note must come from the feed rule'
  );
});

test('decision-feed: the panel and the service share the age bound', async () => {
  const { DECISION_MAX_AGE_MS: serviceMaxAge } = await import('../service/decision-store.ts');
  assert.equal(DECISION_MAX_AGE_MS, serviceMaxAge, 'the overlay and the 409 must agree on the age bound');
  assert.equal(DECISION_MAX_AGE_MS, 30 * 60_000);
  assert.ok(DECISION_REFRESH_MIN_MS > 0);
});
