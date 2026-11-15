import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampFormFields,
  formIsAnswerable,
  formIsComplete,
  validateFormAnswer,
  visibleFieldKeys,
} from '../service/decision-form.ts';

/**
 * The one form model both the panel and the service use. If these two ever
 * disagree, the panel offers an answer the service refuses, or worse the
 * service accepts a value the form no longer offers.
 */

const field = (overrides) => ({
  key: 'f',
  type: 'string',
  title: 'Field',
  description: null,
  required: false,
  ...overrides,
});

test('decision-form: when eq/neq compares against the condition JSON type', () => {
  const fields = [
    field({ key: 'count', type: 'number', required: true }),
    field({ key: 'detail', required: true, when: [{ key: 'count', op: 'eq', value: 3 }] }),
  ];
  assert.deepEqual([...visibleFieldKeys(fields, { count: 3 })], ['count', 'detail']);
  assert.deepEqual([...visibleFieldKeys(fields, { count: '3' })], ['count', 'detail']);
  assert.deepEqual([...visibleFieldKeys(fields, { count: 4 })], ['count']);
  assert.deepEqual([...visibleFieldKeys(fields, {})], ['count']);
});

test('decision-form: neq hides until the value differs, and an unknown key hides the field', () => {
  const fields = [
    field({ key: 'mode', required: true }),
    field({ key: 'other', when: [{ key: 'mode', op: 'neq', value: 'simple' }] }),
    field({ key: 'broken', when: [{ key: 'missing', op: 'eq', value: 'x' }] }),
  ];
  assert.deepEqual([...visibleFieldKeys(fields, { mode: 'simple' })], ['mode']);
  assert.deepEqual([...visibleFieldKeys(fields, { mode: 'advanced' })], ['mode', 'other']);
  assert.equal(visibleFieldKeys(fields, { mode: 'advanced' }).has('broken'), false);
});

test('decision-form: a hidden value is dropped, not sent and not rejected', () => {
  const fields = [
    field({ key: 'mode', required: true, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }),
    field({ key: 'detail', required: true, when: [{ key: 'mode', op: 'eq', value: 'b' }] }),
  ];
  const result = validateFormAnswer(fields, { mode: 'a', detail: 'not asked' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.values, { mode: 'a' });
  assert.deepEqual(result.dropped, ['detail']);
});

test('decision-form: a required visible field must be answered', () => {
  const fields = [field({ key: 'name', required: true })];
  const empty = validateFormAnswer(fields, { name: '   ' });
  assert.equal(empty.ok, false);
  assert.deepEqual(empty.detail, ['name']);
  assert.equal(validateFormAnswer(fields, { name: 'ok' }).ok, true);
});

test('decision-form: types are checked, not coerced', () => {
  const fields = [
    field({ key: 'n', type: 'number', required: true }),
    field({ key: 'i', type: 'integer', required: true }),
    field({ key: 'b', type: 'boolean', required: true }),
  ];
  assert.equal(validateFormAnswer(fields, { n: 1.5, i: 2, b: false }).ok, true);
  assert.deepEqual(validateFormAnswer(fields, { n: 1.5, i: 2.5, b: false }).detail, ['i']);
  assert.deepEqual(validateFormAnswer(fields, { n: '1', i: 2, b: false }).detail, ['n']);
  assert.deepEqual(validateFormAnswer(fields, { n: 1, i: 2, b: 'yes' }).detail, ['b']);
});

test('decision-form: a choice must be an offered value, never its label', () => {
  const fields = [field({
    key: 'layout', required: true,
    options: [{ value: 'split', label: 'Split view' }, { value: 'stack', label: 'Stacked' }],
  })];
  assert.equal(validateFormAnswer(fields, { layout: 'split' }).ok, true);
  assert.deepEqual(validateFormAnswer(fields, { layout: 'Split view' }).detail, ['layout']);
});

test('decision-form: custom accepts a typed value, trimmed length-capped', () => {
  const fields = [field({ key: 'layout', required: true, custom: true, options: [{ value: 'split', label: 'Split' }] })];
  assert.equal(validateFormAnswer(fields, { layout: 'my own' }).ok, true);
  assert.deepEqual(validateFormAnswer(fields, { layout: 'x'.repeat(2001) }).detail, ['layout']);
  assert.deepEqual(validateFormAnswer(fields, { layout: '   ' }).detail, ['layout']);
});

test('decision-form: multiselect needs at least one offered value', () => {
  const fields = [field({
    key: 'tags', type: 'multiselect', required: true,
    options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
  })];
  assert.equal(validateFormAnswer(fields, { tags: ['a', 'b'] }).ok, true);
  assert.deepEqual(validateFormAnswer(fields, { tags: [] }).detail, ['tags']);
  assert.deepEqual(validateFormAnswer(fields, { tags: ['c'] }).detail, ['tags']);
  assert.deepEqual(validateFormAnswer(fields, { tags: 'a' }).detail, ['tags']);
});

test('decision-form: an external field makes the whole form unanswerable here', () => {
  const fields = [field({ key: 'link', type: 'external', required: true })];
  assert.equal(formIsAnswerable(fields), false);
  const result = validateFormAnswer(fields, { link: 'https://example.test' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ANSWER_NEEDS_EXTERNAL');
});

test('decision-form: an empty object is not an answer', () => {
  const fields = [field({ key: 'note' })];
  const result = validateFormAnswer(fields, {});
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ANSWER_INVALID');
});

test('decision-form: clamps fields at 40 and options at 50 without splitting a surrogate pair', () => {
  const many = Array.from({ length: 41 }, (_, i) => field({ key: `f${i}` }));
  const clamped = clampFormFields(many);
  assert.equal(clamped.fields.length, 40);
  assert.equal(clamped.droppedFields, 1);

  const manyOptions = [field({
    key: 'o', options: Array.from({ length: 51 }, (_, i) => ({ value: `v${i}`, label: `L${i}` })),
  })];
  const options = clampFormFields(manyOptions);
  assert.equal(options.fields[0].options.length, 50);
  assert.equal(options.droppedOptions, 1);

  const emoji = '😀'.repeat(150);
  const cut = clampFormFields([field({ key: 't', title: emoji })]);
  assert.equal(cut.truncated, true);
  assert.equal(cut.fields[0].title.length, 200);
  assert.equal(cut.fields[0].title.charCodeAt(199) >= 0xd800 && cut.fields[0].title.charCodeAt(199) <= 0xdbff, false);
});

test('decision-form: a malformed field is dropped, never guessed', () => {
  const clamped = clampFormFields([
    null,
    { key: '', type: 'string', title: 'no key' },
    { key: 'bad', type: 'video', title: 'unknown type' },
    { key: 'ok', type: 'string', title: 'Fine' },
    { key: 'ok', type: 'string', title: 'Duplicate key' },
  ]);
  assert.deepEqual(clamped.fields.map((entry) => entry.key), ['ok']);
});

test('decision-form: formIsComplete is the panel Submit gate', () => {
  const fields = [
    field({ key: 'name', required: true }),
    field({ key: 'detail', required: true, when: [{ key: 'name', op: 'eq', value: 'other' }] }),
  ];
  assert.equal(formIsComplete(fields, {}), false);
  assert.equal(formIsComplete(fields, { name: 'x' }), true);
  assert.equal(formIsComplete(fields, { name: 'other' }), false);
  assert.equal(formIsComplete(fields, { name: 'other', detail: 'd' }), true);
});
