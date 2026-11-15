/**
 * The form model shared by the service and the panel.
 *
 * A `question-asked` event carries the agent's fields verbatim in
 * `content.ask.fields` (`GuestFormField`, sdk/dist/session-events.d.ts). This
 * module is the one place that decides:
 *
 * - which fields are asked, given the answers so far (`when`);
 * - whether an answer is well formed.
 *
 * The panel validates before sending and the service validates again before
 * calling the host (§5.1). Both call this file, so the two checks cannot drift:
 * a value the panel accepted is a value the service accepts, and a value the
 * service refuses is a value the panel would have refused.
 *
 * Nothing here touches the DOM, the host or the network.
 */

export type FormFieldType = 'string' | 'number' | 'integer' | 'boolean' | 'multiselect' | 'external';

export interface FormFieldCondition {
  key: string;
  op: 'eq' | 'neq';
  value: string | number | boolean;
}

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormField {
  key: string;
  type: FormFieldType;
  title: string;
  description: string | null;
  required: boolean;
  options?: FormFieldOption[];
  custom?: boolean;
  when?: FormFieldCondition[];
}

export type FormValue = string | number | boolean | string[];
export type FormValues = Record<string, FormValue>;

/** Spec §3.3 caps, applied once when the event is stored. */
export const FORM_MAX_FIELDS = 40;
export const FORM_MAX_OPTIONS = 50;
export const FORM_MAX_TITLE = 200;
export const FORM_MAX_DESCRIPTION = 500;
export const FORM_MAX_CUSTOM = 2000;

export interface ClampedFields {
  fields: FormField[];
  /** Fields dropped past the 40-field cap. */
  droppedFields: number;
  /** Options dropped past the 50-option cap, summed over fields. */
  droppedOptions: number;
  /** True when any title or description was cut. */
  truncated: boolean;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  Object(value) === value && !Array.isArray(value);

/** Cuts at `max` without splitting a surrogate pair. */
export function cutText(value: string, max: number): { text: string; cut: boolean } {
  if (value.length <= max) return { text: value, cut: false };
  let end = max;
  const code = value.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return { text: value.slice(0, end), cut: true };
}

const isFieldType = (value: unknown): value is FormFieldType =>
  value === 'string' ||
  value === 'number' ||
  value === 'integer' ||
  value === 'boolean' ||
  value === 'multiselect' ||
  value === 'external';

/**
 * Reads the agent's fields into our own shape, applying the caps. A field that
 * cannot be read at all is dropped rather than guessed: a malformed field is
 * not a question the owner can answer.
 */
export function clampFormFields(raw: unknown): ClampedFields {
  const result: ClampedFields = { fields: [], droppedFields: 0, droppedOptions: 0, truncated: false };
  if (!Array.isArray(raw)) return result;

  const seenKeys = new Set<string>();
  for (const candidate of raw) {
    if (!isObject(candidate)) continue;
    const key = candidate.key;
    if (typeof key !== 'string' || key.length === 0 || seenKeys.has(key)) continue;
    if (!isFieldType(candidate.type)) continue;
    const rawTitle = candidate.title;
    if (typeof rawTitle !== 'string') continue;
    if (result.fields.length >= FORM_MAX_FIELDS) {
      result.droppedFields += 1;
      continue;
    }

    const title = cutText(rawTitle, FORM_MAX_TITLE);
    if (title.cut) result.truncated = true;
    const rawDescription = candidate.description;
    const description = typeof rawDescription === 'string'
      ? cutText(rawDescription, FORM_MAX_DESCRIPTION)
      : { text: null as string | null, cut: false };
    if (description.cut) result.truncated = true;

    const field: FormField = {
      key,
      type: candidate.type,
      title: title.text,
      description: description.text,
      required: candidate.required === true,
    };

    if (Array.isArray(candidate.options)) {
      const options: FormFieldOption[] = [];
      for (const option of candidate.options) {
        if (!isObject(option)) continue;
        const value = option.value;
        const label = option.label;
        if (typeof value !== 'string' || typeof label !== 'string') continue;
        if (options.length >= FORM_MAX_OPTIONS) {
          result.droppedOptions += 1;
          continue;
        }
        options.push({ value, label });
      }
      if (options.length > 0) field.options = options;
    }

    if (candidate.custom === true) field.custom = true;

    if (Array.isArray(candidate.when)) {
      const when: FormFieldCondition[] = [];
      for (const condition of candidate.when) {
        if (!isObject(condition)) continue;
        const op = condition.op;
        const conditionValue = condition.value;
        if (typeof condition.key !== 'string' || condition.key.length === 0) continue;
        if (op !== 'eq' && op !== 'neq') continue;
        if (
          typeof conditionValue !== 'string' &&
          typeof conditionValue !== 'number' &&
          typeof conditionValue !== 'boolean'
        ) {
          continue;
        }
        when.push({ key: condition.key, op, value: conditionValue });
      }
      if (when.length > 0) field.when = when;
    }

    seenKeys.add(key);
    result.fields.push(field);
  }
  return result;
}

/**
 * `eq`/`neq` compare against the condition's own JSON type: `"3"` and `3` are
 * the same answer. An absent answer is `undefined`, which never equals a
 * condition value.
 */
export function conditionHolds(actual: unknown, condition: FormFieldCondition): boolean {
  if (actual === undefined || actual === null) return condition.op === 'neq';
  const expected = condition.value;
  let equal: boolean;
  if (typeof expected === 'number') {
    equal = typeof actual === 'number' ? actual === expected : Number(actual) === expected;
  } else if (typeof expected === 'boolean') {
    equal = typeof actual === 'boolean' ? actual === expected : String(actual) === String(expected);
  } else {
    equal = typeof actual === 'string' ? actual === expected : String(actual) === expected;
  }
  return condition.op === 'eq' ? equal : !equal;
}

/**
 * The keys of the fields that are asked, given the answers so far.
 *
 * A field is visible when every `when` condition holds. Conditions are read
 * against answers already given, in field order, so a chain of conditions is
 * evaluated the way the owner fills the form. A condition naming an unknown key
 * hides the field (fail closed, no crash).
 */
export function visibleFieldKeys(fields: FormField[], values: FormValues): Set<string> {
  const known = new Set(fields.map((field) => field.key));
  const visible = new Set<string>();
  for (const field of fields) {
    const conditions = field.when ?? [];
    const holds = conditions.every((condition) => {
      if (!known.has(condition.key)) return false;
      return conditionHolds(values[condition.key], condition);
    });
    if (holds) visible.add(field.key);
  }
  return visible;
}

const isEmpty = (value: FormValue | undefined): boolean => {
  if (value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
};

const isPlainValue = (value: unknown): value is FormValue => {
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
};

export interface AnswerValidation {
  ok: true;
  /** Visible values only, in field order. */
  values: FormValues;
  /** Keys submitted for hidden fields; they are dropped, never sent. */
  dropped: string[];
}

export interface AnswerRejection {
  ok: false;
  code: 'ANSWER_INVALID' | 'ANSWER_NEEDS_EXTERNAL';
  /** Field keys at fault, for the block's own message. Never agent text. */
  detail: string[];
}

/**
 * Validates one answer against the stored fields (§4.2, §5.1 step 3).
 *
 * Rejects: a value for a key the form does not have; a missing or empty
 * required visible field; a number that is not finite; an integer that is not
 * an integer; a choice outside the offered options unless `custom`; a
 * multiselect with no option; a custom string past 2 000 characters. Drops,
 * rather than rejects, values for hidden fields.
 *
 * A form with an `external` field cannot be answered here at all: its value
 * comes from another app and sending a guess would be an invented answer.
 */
export function validateFormAnswer(fields: FormField[], raw: unknown): AnswerValidation | AnswerRejection {
  if (!isObject(raw)) return { ok: false, code: 'ANSWER_INVALID', detail: [] };
  const submitted: FormValues = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isPlainValue(value)) return { ok: false, code: 'ANSWER_INVALID', detail: [key] };
    submitted[key] = value;
  }
  if (Object.keys(submitted).length === 0) return { ok: false, code: 'ANSWER_INVALID', detail: [] };

  if (fields.some((field) => field.type === 'external')) {
    return { ok: false, code: 'ANSWER_NEEDS_EXTERNAL', detail: fields.filter((f) => f.type === 'external').map((f) => f.key) };
  }

  const known = new Set(fields.map((field) => field.key));
  for (const key of Object.keys(submitted)) {
    if (!known.has(key)) return { ok: false, code: 'ANSWER_INVALID', detail: [key] };
  }

  const visible = visibleFieldKeys(fields, submitted);
  const values: FormValues = {};
  const dropped: string[] = [];
  const invalid: string[] = [];

  for (const field of fields) {
    const value = submitted[field.key];
    if (!visible.has(field.key)) {
      if (value !== undefined) dropped.push(field.key);
      continue;
    }
    if (value === undefined) {
      if (field.required) invalid.push(field.key);
      continue;
    }
    if (!fieldValid(field, value)) {
      invalid.push(field.key);
      continue;
    }
    values[field.key] = value;
  }

  if (invalid.length > 0) return { ok: false, code: 'ANSWER_INVALID', detail: invalid };
  return { ok: true, values, dropped };
}

function fieldValid(field: FormField, value: FormValue): boolean {
  switch (field.type) {
    case 'string': {
      if (typeof value !== 'string') return false;
      if (field.required && value.trim().length === 0) return false;
      if (field.options && field.options.length > 0) {
        if (field.options.some((option) => option.value === value)) return true;
        return field.custom === true && value.trim().length > 0 && value.trim().length <= FORM_MAX_CUSTOM;
      }
      return true;
    }
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'multiselect': {
      if (!Array.isArray(value) || value.length === 0) return false;
      const offered = new Set((field.options ?? []).map((option) => option.value));
      return value.every((entry) => offered.has(entry) || (field.custom === true && entry.length <= FORM_MAX_CUSTOM));
    }
    case 'external':
      return false;
  }
}

/** True when a form can be answered from the board at all. */
export function formIsAnswerable(fields: FormField[]): boolean {
  return !fields.some((field) => field.type === 'external');
}

/** True when every required visible field has a value: the panel's Submit gate. */
export function formIsComplete(fields: FormField[], values: FormValues): boolean {
  const visible = visibleFieldKeys(fields, values);
  return fields.every((field) => {
    if (!visible.has(field.key) || !field.required) return true;
    const value = values[field.key];
    if (isEmpty(value)) return false;
    return fieldValid(field, value as FormValue);
  });
}
