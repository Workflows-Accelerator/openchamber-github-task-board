import test from 'node:test';
import assert from 'node:assert/strict';
import { installDocument, collectText, collectElements, structureOf } from './dom-shim.js';
import {
  copyText,
  decisionRepoKeys,
  formatWaiting,
  provenanceLine,
  renderDecisionBadge,
  renderDecisionBlock,
  renderDecisionStatusNote,
  resolveDecisionBinding,
  sanitizeAgentText,
  sortDecisions,
} from '../panel/decisions.ts';

/**
 * The decision block, as a pure function of the event content.
 *
 * The assertions that matter: agent text is a text node, never markup; an
 * option sends its `value`, never its label; a hidden field is omitted; a
 * failed or confirming answer never looks answered; EN and FR produce the same
 * structure.
 */

installDocument();

const NOW = 1_763_136_000_000;

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
    askedAt: NOW - 4 * 60_000,
    state: 'pending',
    confirmedAt: NOW - 60_000,
    answeredAt: null,
    linked: [{ id: 'acme/board#52', number: 52, url: 'https://github.com/acme/board/issues/52' }],
    fields: [],
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

const basicFields = [
  { key: 'name', type: 'string', title: 'Name', description: 'Your name', required: true },
  { key: 'layout', type: 'string', title: 'Layout', description: null, required: true,
    options: [{ value: 'split', label: 'Split view' }, { value: 'stack', label: 'Stacked' }] },
  { key: 'many', type: 'string', title: 'Many', description: null, required: false,
    options: Array.from({ length: 8 }, (_, i) => ({ value: `v${i}`, label: `Option ${i}` })) },
  { key: 'count', type: 'integer', title: 'Count', description: null, required: false },
  { key: 'ratio', type: 'number', title: 'Ratio', description: null, required: false },
  { key: 'flag', type: 'boolean', title: 'Flag', description: null, required: false },
  { key: 'tags', type: 'multiselect', title: 'Tags', description: null, required: false,
    options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
];

test('decision-render: every field type gets its control, and no default is invented', () => {
  const block = renderDecisionBlock(decision({ fields: basicFields }), context());
  const inputs = collectElements(block).filter((node) => node.tagName === 'INPUT');
  assert.ok(inputs.some((node) => node.type === 'text'));
  assert.ok(inputs.some((node) => node.type === 'radio'));
  assert.ok(inputs.some((node) => node.type === 'number' && node.step === '1'));
  assert.ok(inputs.some((node) => node.type === 'number' && node.step === 'any'));
  assert.ok(inputs.some((node) => node.type === 'checkbox'));
  assert.equal(collectElements(block).filter((node) => node.tagName === 'SELECT').length, 1, 'more than six options becomes a select');
  assert.equal(block.querySelector('[data-field-key="name"]').querySelector('input').value, '');
  assert.equal(inputs.filter((node) => node.type === 'number').every((node) => node.value === ''), true);
  assert.equal(inputs.every((node) => node.checked === false), true);

  const submit = block.querySelector('.decision-submit');
  assert.equal(submit.disabled, true, 'required fields start unanswered');
});

test('decision-render: a choice sends the option value, never its label', () => {
  let sent = null;
  const block = renderDecisionBlock(decision({ fields: basicFields }), context({
    onSubmit: (_decision, values) => { sent = values; },
  }));
  const name = block.querySelectorAll('input').find((node) => node.type === 'text');
  name.value = 'Ada';
  name.dispatch('input');
  const radios = block.querySelectorAll('input').filter((node) => node.type === 'radio' && node.value === 'split');
  radios[0].checked = true;
  radios[0].dispatch('change');

  const submit = block.querySelector('.decision-submit');
  assert.equal(submit.disabled, false);
  submit.dispatch('click');
  assert.equal(sent.layout, 'split');
  assert.notEqual(sent.layout, 'Split view');
});

test('decision-render: a select sends the chosen option value', () => {
  const fields = [{
    key: 'many', type: 'string', title: 'Many', description: null, required: true,
    options: Array.from({ length: 8 }, (_, i) => ({ value: `v${i}`, label: `Option ${i}` })),
  }];
  let sent = null;
  const block = renderDecisionBlock(decision({ fields }), context({ onSubmit: (_d, values) => { sent = values; } }));
  const select = block.querySelector('select');
  select.value = 'v3';
  select.dispatch('change');
  block.querySelector('.decision-submit').dispatch('click');
  assert.deepEqual(sent, { many: 'v3' });
});

test('decision-render: when hides a field, omits it from values and re-validates on reveal', () => {
  const fields = [
    { key: 'mode', type: 'string', title: 'Mode', description: null, required: true,
      options: [{ value: 'simple', label: 'Simple' }, { value: 'advanced', label: 'Advanced' }] },
    { key: 'detail', type: 'string', title: 'Detail', description: null, required: true,
      when: [{ key: 'mode', op: 'eq', value: 'advanced' }] },
  ];
  let sent = null;
  const block = renderDecisionBlock(decision({ fields }), context({ onSubmit: (_d, values) => { sent = values; } }));
  const detailRow = block.querySelector('[data-field-key="detail"]');
  assert.equal(detailRow.style.display, 'none');
  assert.equal(block.querySelector('.decision-submit').disabled, true);

  const advanced = block.querySelectorAll('input').find((node) => node.type === 'radio' && node.value === 'advanced');
  advanced.checked = true;
  advanced.dispatch('change');
  assert.equal(detailRow.style.display, '');
  assert.equal(block.querySelector('.decision-submit').disabled, true, 'the revealed field is required');

  const detailInput = detailRow.querySelector('input');
  detailInput.value = 'detail text';
  detailInput.dispatch('input');
  assert.equal(block.querySelector('.decision-submit').disabled, false);
  block.querySelector('.decision-submit').dispatch('click');
  assert.deepEqual(sent, { mode: 'advanced', detail: 'detail text' });
});

test('decision-render: a hidden field is never sent even when it was filled first', () => {
  const fields = [
    { key: 'mode', type: 'string', title: 'Mode', description: null, required: true,
      options: [{ value: 'simple', label: 'Simple' }, { value: 'advanced', label: 'Advanced' }] },
    { key: 'detail', type: 'string', title: 'Detail', description: null, required: false,
      when: [{ key: 'mode', op: 'eq', value: 'advanced' }] },
  ];
  let sent = null;
  const block = renderDecisionBlock(decision({ fields }), context({ onSubmit: (_d, values) => { sent = values; } }));
  const advanced = block.querySelectorAll('input').find((node) => node.type === 'radio' && node.value === 'advanced');
  advanced.checked = true;
  advanced.dispatch('change');
  const detailInput = block.querySelector('[data-field-key="detail"]').querySelector('input');
  detailInput.value = 'stale';
  detailInput.dispatch('input');

  const simple = block.querySelectorAll('input').find((node) => node.type === 'radio' && node.value === 'simple');
  simple.checked = true;
  simple.dispatch('change');
  block.querySelector('.decision-submit').dispatch('click');
  assert.deepEqual(sent, { mode: 'simple' });
});

test('decision-render: custom "Other" accepts a typed value', () => {
  const fields = [{
    key: 'layout', type: 'string', title: 'Layout', description: null, required: true, custom: true,
    options: [{ value: 'split', label: 'Split' }],
  }];
  let sent = null;
  const block = renderDecisionBlock(decision({ fields }), context({ onSubmit: (_d, values) => { sent = values; } }));
  const custom = block.querySelector('.decision-custom-input');
  custom.value = '  my own layout  ';
  custom.dispatch('input');
  block.querySelector('.decision-submit').dispatch('click');
  assert.deepEqual(sent, { layout: 'my own layout' });
});

test('decision-render: a boolean is answered only once touched, and false is a real answer', () => {
  const fields = [{ key: 'flag', type: 'boolean', title: 'Flag', description: null, required: false }];
  let sent = null;
  const block = renderDecisionBlock(decision({ fields }), context({ onSubmit: (_d, values) => { sent = values; } }));
  const checkbox = block.querySelector('input');
  block.querySelector('.decision-submit').dispatch('click');
  assert.deepEqual(sent, {}, 'an untouched box is not an answer');
  checkbox.checked = true;
  checkbox.dispatch('change');
  block.querySelector('.decision-submit').dispatch('click');
  assert.deepEqual(sent, { flag: true });
  checkbox.checked = false;
  checkbox.dispatch('change');
  block.querySelector('.decision-submit').dispatch('click');
  assert.deepEqual(sent, { flag: false });
});

test('decision-render: an external field makes the form read-only with a reason', () => {
  const fields = [{ key: 'link', type: 'external', title: 'Open the link', description: null, required: true }];
  const block = renderDecisionBlock(decision({ fields }), context());
  assert.equal(block.querySelector('.decision-submit'), null);
  assert.match(collectText(block).join(' '), /another app/);
  assert.equal(block.querySelectorAll('input').length, 0);
});

test('decision-render: clamped fields disable Submit and say how many are missing', () => {
  const block = renderDecisionBlock(decision({ fields: basicFields, droppedFields: 1, droppedOptions: 2 }), context());
  assert.equal(block.querySelector('.decision-submit').disabled, true);
  const text = collectText(block).join(' ');
  assert.match(text, /1 fields not shown/);
  assert.match(text, /2 options not shown/);
});

test('decision-render: without content the block is blind, offers Open session, no answer control', () => {
  const block = renderDecisionBlock(decision({ fields: null, title: null }), context());
  const text = collectText(block).join(' ');
  assert.match(text, /A decision is waiting in a session/);
  assert.equal(block.querySelector('.decision-submit'), null);
  assert.notEqual(block.querySelector('.decision-open-session'), null);
  assert.equal(collectElements(block).filter((node) => node.tagName === 'BUTTON').length, 1);
});

test('decision-render: a page shows its title and the content-not-available state, no frame', () => {
  const page = decision({
    id: 'ses_1:page:call_7', kind: 'page', askId: 'call_7', title: 'Preview', fields: null,
    page: { hasHtml: false, hasUi: false, htmlChars: 0, mode: null },
  });
  const block = renderDecisionBlock(page, context());
  const text = collectText(block).join(' ');
  assert.match(text, /Preview/);
  assert.match(text, /not available here yet/);
  assert.equal(collectElements(block).filter((node) => node.tagName === 'IFRAME').length, 0);
  assert.equal(block.querySelector('.decision-submit'), null);
});

test('decision-render: agent text is a text node, and no element gains markup, style or a handler', () => {
  const hostile = '<img src=x onerror="alert(1)">';
  const fields = [{
    key: 'x', type: 'string', title: hostile, description: `${hostile}`, required: false,
    options: [{ value: 'v', label: hostile }],
  }];
  const block = renderDecisionBlock(decision({ title: hostile, fields }), context());
  const text = collectText(block).join(' ');
  assert.ok(text.includes(hostile), 'the hostile string appears verbatim as text');
  const elements = collectElements(block);
  assert.equal(elements.some((node) => node.tagName === 'IMG'), false);
  for (const node of elements) {
    for (const name of node.getAttributeNames()) {
      assert.equal(name.toLowerCase().startsWith('on'), false, `handler attribute ${name}`);
      assert.notEqual(name.toLowerCase(), 'style');
    }
    // Our own layout styles are allowed; nothing agent-authored may reach one.
    for (const value of Object.values(node.style)) {
      assert.equal(String(value).includes('<img'), false);
    }
  }
});

test('decision-render: control characters and bidi overrides are stripped before display', () => {
  assert.equal(sanitizeAgentText('a\u202Eb\u0007c'), 'abc');
  const block = renderDecisionBlock(decision({ title: 'safe\u202Eevil' }), context());
  assert.equal(collectText(block).some((line) => line.includes('\u202E')), false);
});

test('decision-render: EN and FR produce identical structure', () => {
  const en = renderDecisionBlock(decision({ fields: basicFields }), context({ language: 'en' }));
  const fr = renderDecisionBlock(decision({ fields: basicFields }), context({ language: 'fr' }));
  assert.deepEqual(structureOf(fr), structureOf(en));
});

test('decision-render: no fixed string carries an emoji or an exclamation mark', () => {
  const emoji = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F1E0}-\u{1F1FF}]/u;
  const keys = [
    'waiting', 'answering', 'confirming', 'unconfirmed', 'answeredSent', 'dismissalSent',
    'blindWait', 'pageUnavailable', 'readonly', 'permissionMissing', 'credentialWarning',
    'notLinked', 'noDecision', 'serviceDown', 'restart', 'gone', 'failed', 'unknownOutcome',
    'openSession', 'sendAnswer', 'dismiss', 'sendDismissal', 'dismissReason', 'recheck',
    'fieldsNotShown', 'optionsNotShown', 'external', 'notAnswered', 'yes', 'other',
    'subagentOf', 'unlinkedProvenance', 'waitingSince', 'older', 'moreInAnother',
    'inboxNeeds', 'inboxConfirming', 'inboxUnbound', 'inboxHuman', 'noHuman',
  ];
  for (const language of ['en', 'fr']) {
    for (const key of keys) {
      const value = copyText(language, key, { n: 1, time: '10:00' });
      assert.equal(emoji.test(value), false, `${language}.${key}`);
      assert.equal(value.includes('!'), false, `${language}.${key}`);
    }
  }
});

test('decision-render: the provenance line always names the session and the project', () => {
  const line = provenanceLine(decision(), context());
  assert.match(line, /ses_1/);
  assert.match(line, /issue-52-worktree/);
  assert.match(line, /x/);
  assert.match(line, /#52/);
  assert.match(line, /4 min/);
  const unbound = provenanceLine(decision(), context({ unbound: true, issueNumber: null }));
  assert.match(unbound, /not linked to a task/);
  const child = provenanceLine(decision({ parentId: 'ses_parent' }), context());
  assert.match(child, /subagent of ses_parent/);
});

test('decision-render: a confirming block never shows answer controls and never says answered', () => {
  const block = renderDecisionBlock(decision({ state: 'answered-unconfirmed' }), context());
  const text = collectText(block).join(' ');
  assert.match(text, /answered, confirming/);
  assert.equal(block.querySelector('.decision-submit'), null);
  assert.equal(text.includes('Answer sent'), false);
});

test('decision-render: a failed answer never looks answered', () => {
  const block = renderDecisionBlock(decision({ fields: basicFields }), context({ answerState: 'failed' }));
  const text = collectText(block).join(' ');
  assert.match(text, /was not sent/);
  assert.equal(text.includes('answered, confirming'), false);
  assert.equal(text.includes('Answer sent'), false);
});

test('decision-render: the credential warning is present on every form and absent on a page', () => {
  const form = collectText(renderDecisionBlock(decision({ fields: basicFields }), context())).join(' ');
  assert.match(form, /Do not type a password, token or key here/);
  const page = collectText(renderDecisionBlock(decision({ kind: 'page', fields: null, page: null }), context())).join(' ');
  assert.equal(page.includes('password'), false);
});

test('decision-render: badge is one line with no controls, and status notes name the time', () => {
  const badge = renderDecisionBadge(decision(), 'en', 1);
  assert.equal(collectElements(badge).some((node) => node.tagName === 'BUTTON'), false);
  assert.match(collectText(badge).join(' '), /waiting for you/);
  assert.match(collectText(badge).join(' '), /Choose a layout/);
  assert.match(collectText(badge).join(' '), /1 more decisions in another session/);

  assert.match(collectText(renderDecisionStatusNote('no-decisions', 'en', NOW)).join(' '), /No decision is waiting/);
  assert.match(collectText(renderDecisionStatusNote('service-down', 'en', NOW)).join(' '), /not answering/);
  assert.match(collectText(renderDecisionStatusNote('restarted', 'fr', NOW)).join(' '), /a redémarré/);
});

test('decision-render: ordering is waiting before confirming, newest first, then ask id', () => {
  const ordered = sortDecisions([
    { state: 'answered-unconfirmed', askedAt: NOW, askId: 'z' },
    { state: 'pending', askedAt: NOW - 10, askId: 'a' },
    { state: 'pending', askedAt: NOW - 10, askId: 'b' },
    { state: 'pending', askedAt: NOW - 5, askId: 'c' },
  ]);
  assert.deepEqual(ordered.map((entry) => entry.askId), ['c', 'b', 'a', 'z']);
});

test('decision-render: binding uses the panel index, falls back to linked[], and refuses a disagreement', () => {
  const entry = decision();
  assert.deepEqual(decisionRepoKeys(entry), ['acme/board#52']);
  assert.deepEqual(resolveDecisionBinding(entry, ['acme/board#52']), { keys: ['acme/board#52'], unbound: false });
  assert.deepEqual(resolveDecisionBinding(entry, []), { keys: ['acme/board#52'], unbound: false });
  assert.deepEqual(resolveDecisionBinding(entry, ['other/repo#52']), { keys: [], unbound: true });
  assert.deepEqual(resolveDecisionBinding(decision({ linked: [] }), []), { keys: [], unbound: true });
});

test('decision-render: formatWaiting is relative under an hour and absolute after', () => {
  assert.equal(formatWaiting(NOW - 4 * 60_000, NOW, 'en'), '4 min');
  assert.match(formatWaiting(NOW - 2 * 60 * 60_000, NOW, 'en'), /\d{2}:\d{2}/);
});
