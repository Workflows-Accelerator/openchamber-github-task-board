/**
 * The decision block (D53 S1 + S2).
 *
 * One deterministic renderer over data the host sent, in the owner's language,
 * with no model call and no `innerHTML`:
 *
 * - every agent-authored string goes through `textContent` after
 *   `sanitizeAgentText` strips control characters and bidi overrides, so a
 *   title cannot reorder the provenance line or inject markup (§6.2);
 * - a form is rendered from `content.ask` only, never from a fetched message;
 * - a page shows its title and an explicit "content not available" state until
 *   S3 adds the sandboxed frame;
 * - every fixed string comes from `DECISION_COPY`, and no string is built by
 *   concatenating two languages. No emoji, no exclamation mark.
 *
 * The block never claims more than it observed: "answered, confirming" is the
 * strongest state, and a failed answer never looks answered.
 */

import {
  formIsAnswerable,
  formIsComplete,
  visibleFieldKeys,
  type FormField,
  type FormValue,
  type FormValues,
} from '../service/decision-form.ts';

export type DecisionLanguage = 'en' | 'fr';

/**
 * Ten minutes, the same window the service enforces in `answer()` (§7.2). The
 * overlay and the 409 must agree: a decision the panel shows as live but the
 * service refuses (or the reverse) is a lie either way. `decision-render`
 * pins the two constants together.
 */
export const DECISION_STALENESS_MS = 10 * 60_000;

/**
 * Thirty minutes from a decision's own first observation. The ten-minute rule
 * above measures silence, and silence is re-armed by a `waiting` status poll or
 * a re-delivery of the same ask, so a form superseded by a newer ask stayed
 * answerable for as long as the session kept reporting waiting. This bound is
 * never re-armed: past it the board cannot prove the ask is still the one the
 * session waits on, so it refuses and sends the owner to the session. The
 * service enforces the same constant (`decision-store.ts`).
 */
export const DECISION_MAX_AGE_MS = 30 * 60_000;

/** How often a snapshot or a visibility return may read `GET /decisions`. */
export const DECISION_REFRESH_MIN_MS = 1_500;

export interface DecisionLinkedItem {
  id: string;
  number: number | null;
  url: string;
}

/** One entry of `GET /decisions` (service/decision-store.ts, §3.8). */
export interface DecisionView {
  id: string;
  kind: 'form' | 'page';
  sessionId: string;
  parentId: string | null;
  directory: string | null;
  askId: string;
  title: string | null;
  sessionTitle: string | null;
  askedAt: number;
  state: 'pending' | 'answering' | 'answered-unconfirmed';
  confirmedAt: number;
  /** When the service first saw this decision. Never re-armed by a re-delivery. */
  firstSeenAt: number;
  answeredAt: number | null;
  linked: DecisionLinkedItem[];
  fields: FormField[] | null;
  page: { hasHtml: boolean; hasUi: boolean; htmlChars: number; mode: string | null } | null;
  droppedFields?: number;
  droppedOptions?: number;
}

export type AnswerState =
  | 'idle'
  | 'answering'
  | 'sent'
  | 'failed'
  | 'stale'
  | 'permission-missing'
  | 'unknown-outcome'
  /** The service said another answer is already in flight (409, entry `answering`). */
  | 'in-flight'
  /** The service said this decision was already answered (409, entry `answered-unconfirmed`). */
  | 'already-answered'
  /** The service refused because the observation is past the staleness window (409 DECISION_STALE). */
  | 'unconfirmed'
  /** The service refused because the decision is past its absolute maximum age (409 DECISION_EXPIRED). */
  | 'expired'
  /** The service refused because the session is not linked to a board task. */
  | 'not-linked';

export interface DecisionRenderContext {
  language: DecisionLanguage;
  now: number;
  /** `sessionAnswers` is granted and this decision is still pending. */
  canAnswer: boolean;
  /** Last failed fetch: the body stays, controls are disabled, a stamp is shown. */
  unconfirmedSince?: number | null;
  /** Bound issue number, or `null` for a decision the inbox shows as unlinked. */
  issueNumber?: number | null;
  unbound?: boolean;
  answerState?: AnswerState;
  /** The host's own sentence for a refusal (§5.1). Agent/host text, sanitized. */
  answerMessage?: string | null;
  /** The successful answer was a dismissal, so the note says "Dismissal sent". */
  dismissal?: boolean;
  /** No successful read yet: nothing was checked, so nothing can be said about waiting. */
  checking?: boolean;
  onSubmit?: (decision: DecisionView, values: FormValues) => void;
  onDismiss?: (decision: DecisionView, message: string) => void;
  onOpenSession?: (decision: DecisionView) => void;
  onRecheck?: (decision: DecisionView) => void;
}

const COPY = {
  en: {
    waiting: 'waiting for you',
    answering: 'sending answer',
    answerInFlight: 'answer in flight',
    alreadyAnswered: 'already answered',
    closedInSession: 'closed in the session',
    expired: 'too old to answer',
    confirming: 'answered, confirming',
    unconfirmed: 'not confirmed since {time}',
    answeredSent: 'Answer sent',
    dismissalSent: 'Dismissal sent',
    blindWait: 'A decision is waiting in a session. The board cannot show what it asks.',
    pageUnavailable: 'The page content is not available here yet. Open the session to see it.',
    readonly: 'The board is not allowed to answer for you. Open the session to answer.',
    permissionMissing: 'The answer permission is missing.',
    credentialWarning: 'The agent wrote this question. Do not type a password, token or key here.',
    notLinked: 'This session is not linked to a task.',
    checking: 'Checking for decisions.',
    noDecision: 'No decision is waiting. Checked at {time}.',
    serviceDown: 'The board service is not answering. Last attempt at {time}.',
    rateLimited: 'The board service is answering; the read after {time} was rate-limited.',
    restart: 'The board service restarted at {time}. Decisions asked before then are not tracked until the session speaks again.',
    gone: 'This decision was already closed in the session.',
    alreadyAnsweredNote: 'An answer to this decision was already sent in the session.',
    expiredNote: 'This decision is too old for the board to answer. Open the session to answer.',
    failed: 'The answer was not sent.',
    unknownOutcome: 'The answer may not have reached the session.',
    openSession: 'Open session',
    sendAnswer: 'Send answer',
    dismiss: 'Dismiss',
    sendDismissal: 'Send dismissal',
    dismissReason: 'Dismissed from the task board.',
    recheck: 'Recheck',
    fieldsNotShown: '{n} fields not shown',
    optionsNotShown: '{n} options not shown',
    external: 'This form needs an answer from another app. Open the session to answer.',
    notAnswered: 'Not answered',
    yes: 'Yes',
    other: 'Other',
    subagentOf: 'subagent of',
    unlinkedProvenance: 'not linked to a task',
    waitingSince: 'waiting since {time}',
    older: 'Older decisions ({n})',
    moreInAnother: '{n} more decisions in another session',
    inboxNeeds: 'Needs an answer',
    inboxConfirming: 'Confirming',
    inboxUnbound: 'Not linked to a task',
    inboxHuman: 'Human tasks in issue bodies',
    noHuman: 'No unchecked human task in an issue body.',
    backToBoard: 'Back to board',
    showClosedIssues: 'Show closed issues',
    hideClosedIssues: 'Hide closed issues',
    markDoneClose: 'Mark done and close issue',
    reopenIssue: 'Reopen issue',
    confirmMarkDone: 'Mark {task} in {repo} done and close it on GitHub?',
    confirmReopen: 'Reopen {task} in {repo} on GitHub?',
    inspectDependency: 'Dependency',
    dependencyBlocks: '{blocker} blocks {target} in {repo}',
    openTask: 'Open task',
    removeDependency: 'Remove dependency',
    cancel: 'Cancel',
    confirmRemoveDependency: 'Remove the dependency: {blocker} blocks {target} in {repo}?',
    reopenBeforeMoving: 'Reopen {task} before moving it to another column.',
    ambiguousTask: 'This task number exists in more than one repository. Open the task and use its own action.',
    dependencyUnavailable: 'This dependency cannot be removed safely from here. Open the task and edit its body.',
    taskOutcome: 'Task outcome',
    visibility: 'Visibility',
    archiveIssue: 'Archive issue',
    unarchiveIssue: 'Unarchive issue',
    archiveClosesIssue: 'closes the GitHub issue',
    archiveReopensIssue: 'reopens the GitHub issue',
    confirmArchiveTransition: '{action} {task} in {repo}? This {effect}.',
  },
  fr: {
    waiting: 'en attente de vous',
    answering: 'envoi de la réponse',
    answerInFlight: "réponse en cours d'envoi",
    alreadyAnswered: 'déjà répondu',
    closedInSession: 'close dans la session',
    expired: 'trop ancienne pour répondre',
    confirming: 'répondu, confirmation',
    unconfirmed: 'non confirmé depuis {time}',
    answeredSent: 'Réponse envoyée',
    dismissalSent: 'Écartement envoyé',
    blindWait: 'Une décision attend dans une session. Le tableau ne peut pas afficher la question.',
    pageUnavailable: "Le contenu de la page n'est pas encore disponible ici. Ouvrez la session pour la voir.",
    readonly: "Le tableau n'est pas autorisé à répondre à votre place. Ouvrez la session pour répondre.",
    permissionMissing: "L'autorisation de répondre est absente.",
    credentialWarning: "L'agent a écrit cette question. Ne saisissez pas de mot de passe, de jeton ou de clé ici.",
    notLinked: 'Cette session ne correspond à aucune tâche.',
    checking: 'Vérification des décisions.',
    noDecision: 'Aucune décision en attente. Vérifié à {time}.',
    serviceDown: 'Le service du tableau ne répond pas. Dernière tentative à {time}.',
    rateLimited: 'Le service du tableau répond ; la lecture après {time} a été limitée.',
    restart: "Le service du tableau a redémarré à {time}. Les décisions demandées avant ne sont pas suivies tant que la session ne parle pas de nouveau.",
    gone: 'Cette décision a déjà été close dans la session.',
    alreadyAnsweredNote: 'Une réponse à cette décision a déjà été envoyée dans la session.',
    expiredNote: 'Cette décision est trop ancienne pour que le tableau y réponde. Ouvrez la session pour répondre.',
    failed: "La réponse n'a pas été envoyée.",
    unknownOutcome: "La réponse n'a peut-être pas atteint la session.",
    openSession: 'Ouvrir la session',
    sendAnswer: 'Envoyer la réponse',
    dismiss: 'Écarter',
    sendDismissal: "Envoyer l'écartement",
    dismissReason: 'Écarté depuis le tableau des tâches.',
    recheck: 'Vérifier',
    fieldsNotShown: '{n} champs non affichés',
    optionsNotShown: '{n} options non affichées',
    external: "Ce formulaire demande une réponse depuis une autre application. Ouvrez la session pour répondre.",
    notAnswered: 'Sans réponse',
    yes: 'Oui',
    other: 'Autre',
    subagentOf: 'sous-agent de',
    unlinkedProvenance: 'lié à aucune tâche',
    waitingSince: 'en attente depuis {time}',
    older: 'Décisions plus anciennes ({n})',
    moreInAnother: '{n} autres décisions dans une autre session',
    inboxNeeds: 'Demande une réponse',
    inboxConfirming: 'Confirmation',
    inboxUnbound: 'Lié à aucune tâche',
    inboxHuman: 'Tâches humaines dans les corps de tâche',
    noHuman: 'Aucune tâche humaine non cochée dans un corps de tâche.',
    backToBoard: 'Retour au tableau',
    showClosedIssues: 'Afficher les tâches fermées',
    hideClosedIssues: 'Masquer les tâches fermées',
    markDoneClose: 'Marquer terminé et fermer la tâche',
    reopenIssue: 'Rouvrir la tâche',
    confirmMarkDone: 'Marquer {task} dans {repo} terminé et la fermer sur GitHub ?',
    confirmReopen: 'Rouvrir {task} dans {repo} sur GitHub ?',
    inspectDependency: 'Dépendance',
    dependencyBlocks: '{blocker} bloque {target} dans {repo}',
    openTask: 'Ouvrir la tâche',
    removeDependency: 'Retirer la dépendance',
    cancel: 'Annuler',
    confirmRemoveDependency: 'Retirer la dépendance : {blocker} bloque {target} dans {repo} ?',
    reopenBeforeMoving: 'Rouvrez {task} avant de la déplacer vers une autre colonne.',
    ambiguousTask: 'Ce numéro de tâche existe dans plusieurs dépôts. Ouvrez la tâche et utilisez son action.',
    dependencyUnavailable: "Cette dépendance ne peut pas être retirée en toute sécurité ici. Ouvrez la tâche et modifiez son corps.",
    taskOutcome: 'Résultat de la tâche',
    visibility: 'Visibilité',
    archiveIssue: 'Archiver la tâche',
    unarchiveIssue: 'Désarchiver la tâche',
    archiveClosesIssue: 'ferme la tâche sur GitHub',
    archiveReopensIssue: 'rouvre la tâche sur GitHub',
    confirmArchiveTransition: '{action} {task} dans {repo} ? Cela {effect}.',
  },
} as const;

export type DecisionCopyKey = keyof typeof COPY.en;

/** One fixed string, with `{n}`/`{time}` filled in. Never agent text. */
export function copyText(
  language: DecisionLanguage,
  key: DecisionCopyKey,
  values: Record<string, string | number> = {}
): string {
  const template: string = COPY[language][key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match
  );
}

export function isFrenchLocale(locale: string | null | undefined): boolean {
  return typeof locale === 'string' && /^fr\b/i.test(locale.trim());
}

/**
 * Strips C0/C1 control characters and the Unicode bidi overrides before any
 * agent string is displayed (§6.2). A title that can reorder the provenance
 * line can make one session look like another.
 */
export function sanitizeAgentText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, '');
}

export function cutForDisplay(value: string, max: number): string {
  if (value.length <= max) return value;
  let end = max;
  const code = value.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return `${value.slice(0, end)}…`;
}

export function projectBasename(directory: string | null | undefined): string {
  if (typeof directory !== 'string' || directory.length === 0) return '';
  const parts = directory.replace(/\/+$/, '').split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : '';
}

export function formatClock(at: number, language: DecisionLanguage): string {
  try {
    return new Date(at).toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/** Relative under one hour, absolute after (§6.1). */
export function formatWaiting(askedAt: number, now: number, language: DecisionLanguage): string {
  const elapsed = Math.max(0, now - askedAt);
  if (elapsed < 60 * 60_000) {
    const minutes = Math.max(0, Math.floor(elapsed / 60_000));
    return language === 'fr' ? `${minutes} min` : `${minutes} min`;
  }
  return formatClock(askedAt, language);
}

/** The provenance line, always present, in every state (§6.1). */
export function provenanceLine(decision: DecisionView, context: DecisionRenderContext): string {
  const session = decision.sessionTitle
    ? `${sanitizeAgentText(decision.sessionTitle)} (${decision.sessionId})`
    : decision.sessionId;
  const parent = decision.parentId
    ? ` (${copyText(context.language, 'subagentOf')} ${decision.parentId})`
    : '';
  const project = projectBasename(decision.directory);
  const issue = context.unbound || !context.issueNumber
    ? copyText(context.language, 'unlinkedProvenance')
    : `#${context.issueNumber}`;
  const parts = [session + parent];
  if (project) parts.push(project);
  parts.push(issue);
  parts.push(copyText(context.language, 'waitingSince', {
    time: formatWaiting(decision.askedAt, context.now, context.language),
  }));
  return parts.join(' · ');
}

/** Repo-qualified keys the event's `linked[]` names, lowercased like `issueRepoKey`. */
export function decisionRepoKeys(decision: DecisionView): string[] {
  const keys = new Set<string>();
  for (const item of decision.linked ?? []) {
    if (item && typeof item.id === 'string' && item.id.includes('#')) keys.add(item.id.toLowerCase());
  }
  return [...keys];
}

/**
 * One binding, two observers (§3.2). The panel's own session index is the
 * normal path; the event's `linked[]` is the fallback when the panel has no
 * session object. When both speak and disagree, the decision is unbound — one
 * source contradicting itself is not a tie to break by preference.
 */
export function resolveDecisionBinding(
  decision: DecisionView,
  panelKeys: string[]
): { keys: string[]; unbound: boolean } {
  const eventKeys = decisionRepoKeys(decision);
  const panel = panelKeys.filter((key) => typeof key === 'string' && key.length > 0);
  if (panel.length > 0 && eventKeys.length > 0) {
    const shared = panel.some((key) => eventKeys.includes(key));
    if (!shared) return { keys: [], unbound: true };
  }
  if (panel.length > 0) return { keys: panel, unbound: false };
  if (eventKeys.length > 0) return { keys: eventKeys, unbound: false };
  return { keys: [], unbound: true };
}

/** §3.4 ordering: waiting before confirming, newest first, then ask id descending. */
export function sortDecisions<T extends Pick<DecisionView, 'state' | 'askedAt' | 'askId'>>(decisions: T[]): T[] {
  return [...decisions].sort((a, b) => {
    const aConfirming = a.state === 'answered-unconfirmed' ? 1 : 0;
    const bConfirming = b.state === 'answered-unconfirmed' ? 1 : 0;
    if (aConfirming !== bConfirming) return aConfirming - bConfirming;
    if (a.askedAt !== b.askedAt) return b.askedAt - a.askedAt;
    return a.askId < b.askId ? 1 : a.askId > b.askId ? -1 : 0;
  });
}

// ---------------------------------------------------------------------------
// DOM helpers. No innerHTML, no style attribute written from data.
// ---------------------------------------------------------------------------

function element(tag: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function textNode(tag: string, value: string, className?: string): HTMLElement {
  const node = element(tag, className);
  node.textContent = value;
  return node;
}

function button(label: string, className: string): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  node.textContent = label;
  return node;
}

interface FieldRow {
  key: string;
  row: HTMLElement;
  read: () => FormValue | undefined;
  focus: () => void;
}

/**
 * Renders one form body and returns the rows it built. Every control is a real
 * DOM node created with `createElement`; agent strings only ever reach
 * `textContent` or an option `value` that is itself an agent string compared
 * against the stored option list.
 */
function renderFormBody(
  fields: FormField[],
  context: DecisionRenderContext,
  interactive: boolean,
  onChange: () => void
): { body: HTMLElement; rows: FieldRow[]; values: () => FormValues } {
  const body = element('div', 'decision-form-body');
  const rows: FieldRow[] = [];

  for (const field of fields) {
    const row = element('div', 'decision-field');
    row.setAttribute('data-field-key', field.key);

    const label = textNode('div', sanitizeAgentText(field.title), 'decision-field-title');
    row.appendChild(label);
    if (field.description) {
      row.appendChild(textNode('div', sanitizeAgentText(field.description), 'decision-field-description'));
    }

    let read: () => FormValue | undefined = () => undefined;
    let focus: () => void = () => {};

    if (field.type === 'string' && (!field.options || field.options.length === 0)) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'decision-input';
      input.disabled = !interactive;
      input.addEventListener('input', onChange);
      row.appendChild(input);
      read = () => (input.value.trim() === '' ? undefined : input.value);
      focus = () => input.focus();
    } else if (field.type === 'string' && field.options && field.options.length > 6) {
      // More than six choices: a select keeps the block short (§4.2).
      const select = document.createElement('select');
      select.className = 'decision-input';
      select.disabled = !interactive;
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '';
      select.appendChild(placeholder);
      for (const option of field.options) {
        const entry = document.createElement('option');
        entry.value = option.value;
        entry.textContent = sanitizeAgentText(option.label);
        select.appendChild(entry);
      }
      select.addEventListener('change', onChange);
      row.appendChild(select);
      read = () => (select.value === '' ? undefined : select.value);
      focus = () => select.focus();
    } else if (field.type === 'string' && field.options && field.options.length > 0) {
      const choices = element('div', 'decision-choices');
      const radios: HTMLInputElement[] = [];
      const name = `decision-${context.language}-${field.key}`;
      for (const option of field.options) {
        const choice = element('label', 'decision-choice');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = name;
        input.value = option.value;
        input.disabled = !interactive;
        input.addEventListener('change', onChange);
        radios.push(input);
        choice.appendChild(input);
        choice.appendChild(textNode('span', sanitizeAgentText(option.label), 'decision-choice-label'));
        choices.appendChild(choice);
      }
      let customInput: HTMLInputElement | null = null;
      if (field.custom) {
        const choice = element('label', 'decision-choice');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = name;
        input.value = '';
        input.disabled = !interactive;
        radios.push(input);
        choice.appendChild(input);
        choice.appendChild(textNode('span', copyText(context.language, 'other'), 'decision-choice-label'));
        choices.appendChild(choice);
        customInput = document.createElement('input');
        customInput.type = 'text';
        customInput.className = 'decision-input decision-custom-input';
        customInput.disabled = !interactive;
        customInput.addEventListener('input', () => {
          if (customInput) input.checked = customInput.value.trim().length > 0;
          onChange();
        });
        choices.appendChild(customInput);
      }
      row.appendChild(choices);
      read = () => {
        const chosen = radios.find((radio) => radio.checked);
        if (!chosen) return undefined;
        if (field.custom && chosen.value === '' && customInput) {
          const typed = customInput.value.trim();
          return typed === '' ? undefined : typed;
        }
        return chosen.value;
      };
      focus = () => radios[0]?.focus();
    } else if (field.type === 'number' || field.type === 'integer') {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = field.type === 'integer' ? '1' : 'any';
      input.className = 'decision-input';
      input.disabled = !interactive;
      input.addEventListener('input', onChange);
      row.appendChild(input);
      read = () => {
        if (input.value.trim() === '') return undefined;
        const value = Number(input.value);
        if (!Number.isFinite(value)) return undefined;
        if (field.type === 'integer' && !Number.isInteger(value)) return Number.NaN;
        return value;
      };
      focus = () => input.focus();
    } else if (field.type === 'boolean') {
      const choice = element('label', 'decision-choice');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.disabled = !interactive;
      let touched = false;
      const state = textNode('span', copyText(context.language, 'notAnswered'), 'decision-choice-label');
      input.addEventListener('change', () => {
        touched = true;
        state.textContent = input.checked
          ? copyText(context.language, 'yes')
          : copyText(context.language, 'notAnswered');
        onChange();
      });
      choice.appendChild(input);
      choice.appendChild(state);
      row.appendChild(choice);
      // A boolean is answered only once touched: `false` is a real answer, and
      // an untouched box is not one.
      read = () => (touched ? input.checked : undefined);
      focus = () => input.focus();
    } else if (field.type === 'multiselect') {
      const choices = element('div', 'decision-choices');
      const inputs: HTMLInputElement[] = [];
      for (const option of field.options ?? []) {
        const choice = element('label', 'decision-choice');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = option.value;
        input.disabled = !interactive;
        input.addEventListener('change', onChange);
        inputs.push(input);
        choice.appendChild(input);
        choice.appendChild(textNode('span', sanitizeAgentText(option.label), 'decision-choice-label'));
        choices.appendChild(choice);
      }
      row.appendChild(choices);
      read = () => {
        const values = inputs.filter((input) => input.checked).map((input) => input.value);
        return values.length === 0 ? undefined : values;
      };
      focus = () => inputs[0]?.focus();
    } else if (field.type === 'external') {
      // The whole form becomes read-only; this branch exists so the reason is
      // attached to the field the owner can see (§4.2).
      row.appendChild(textNode('div', copyText(context.language, 'external'), 'decision-field-description'));
    }

    if (field.required) {
      row.appendChild(textNode('span', '*', 'decision-required'));
    }

    body.appendChild(row);
    rows.push({ key: field.key, row, read, focus });
  }

  const values = (): FormValues => {
    // Read every row first, then drop the values of fields the answers so far
    // hide: a hidden field is not asked, so it is not answered (§4.2).
    const collected: FormValues = {};
    for (const row of rows) {
      const value = row.read();
      if (value !== undefined) collected[row.key] = value;
    }
    const visible = visibleFieldKeys(fields, collected);
    const answered: FormValues = {};
    for (const row of rows) {
      if (!visible.has(row.key)) continue;
      const value = collected[row.key];
      if (value !== undefined) answered[row.key] = value;
    }
    return answered;
  };

  return { body, rows, values };
}

/**
 * The one block both a task and the inbox use. Returns a detached element; the
 * caller decides where it goes.
 */
export function renderDecisionBlock(decision: DecisionView, context: DecisionRenderContext): HTMLElement {
  const language = context.language;
  const block = element('div', 'decision-block');
  block.setAttribute('data-decision-id', decision.id);
  block.setAttribute('data-decision-kind', decision.kind);

  const confirming = decision.state === 'answered-unconfirmed';
  const answeringElsewhere = decision.state === 'answering';
  const answerState = context.answerState ?? 'idle';
  const stale = typeof context.unconfirmedSince === 'number' || answerState === 'unconfirmed';
  const unconfirmedSince = context.unconfirmedSince ?? decision.confirmedAt;
  // Every state that is not "waiting for you" is inert: a second tap must not
  // be invited, and an answer in flight on another device is not waiting.
  const inert = confirming || answeringElsewhere || answerState !== 'idle' || stale;

  const eyebrowText = (() => {
    if (confirming || answerState === 'sent') return copyText(language, 'confirming');
    if (answerState === 'answering') return copyText(language, 'answering');
    if (answeringElsewhere || answerState === 'in-flight') return copyText(language, 'answerInFlight');
    if (answerState === 'already-answered') return copyText(language, 'alreadyAnswered');
    if (answerState === 'expired') return copyText(language, 'expired');
    if (answerState === 'stale') return copyText(language, 'closedInSession');
    if (stale) return copyText(language, 'unconfirmed', { time: formatClock(unconfirmedSince, language) });
    return copyText(language, 'waiting');
  })();
  const eyebrow = textNode('div', eyebrowText, 'decision-eyebrow');
  block.appendChild(eyebrow);

  const title = decision.title ? cutForDisplay(sanitizeAgentText(decision.title), 200) : '';
  block.appendChild(textNode('div', title || copyText(language, 'blindWait'), 'decision-title'));
  block.appendChild(textNode('div', provenanceLine(decision, context), 'decision-provenance'));

  if (decision.kind === 'form') {
    block.appendChild(textNode('div', copyText(language, 'credentialWarning'), 'decision-warning'));
  }

  const bodySlot = element('div', 'decision-body');
  block.appendChild(bodySlot);

  const actions = element('div', 'decision-actions');
  block.appendChild(actions);

  const stateNote = textNode('div', '', 'decision-state-note');
  block.appendChild(stateNote);

  const openSession = button(copyText(language, 'openSession'), 'btn btn-sm decision-open-session');
  openSession.addEventListener('click', () => context.onOpenSession?.(decision));

  if (decision.kind === 'page') {
    bodySlot.appendChild(textNode('div', copyText(language, 'pageUnavailable'), 'decision-page-unavailable'));
    actions.appendChild(openSession);
    return block;
  }

  const fields = decision.fields ?? [];
  if (fields.length === 0) {
    // No content: `transcript` refused or the event arrived blind. The block
    // says what it knows and offers the one action that helps (§2.2).
    bodySlot.appendChild(textNode('div', copyText(language, 'blindWait'), 'decision-blind-wait'));
    actions.appendChild(openSession);
    return block;
  }

  const answerable = context.canAnswer && !inert && formIsAnswerable(fields);
  const { body, rows, values } = renderFormBody(fields, context, answerable, () => {
    update();
  });
  bodySlot.appendChild(body);

  if (!answerable) {
    // The reason must be the real one. "Not allowed to answer" is a permission
    // claim, so it is only printed when the permission is what blocks; an
    // answered, failed, in-flight or unconfirmed block says its own state.
    let reason: string | null = null;
    if (!formIsAnswerable(fields)) reason = copyText(language, 'external');
    else if (context.unbound) reason = copyText(language, 'notLinked');
    else if (answerState === 'permission-missing') reason = copyText(language, 'readonly');
    else if (!inert && !context.canAnswer && !context.checking) reason = copyText(language, 'readonly');
    if (reason) bodySlot.appendChild(textNode('div', reason, 'decision-readonly-reason'));
  }

  if ((decision.droppedFields ?? 0) > 0) {
    bodySlot.appendChild(textNode('div', copyText(language, 'fieldsNotShown', { n: decision.droppedFields ?? 0 }), 'decision-clamp-note'));
  }
  if ((decision.droppedOptions ?? 0) > 0) {
    bodySlot.appendChild(textNode('div', copyText(language, 'optionsNotShown', { n: decision.droppedOptions ?? 0 }), 'decision-clamp-note'));
  }

  const submit = button(copyText(language, 'sendAnswer'), 'btn btn-sm btn-primary decision-submit');
  const dismiss = button(copyText(language, 'dismiss'), 'btn btn-sm decision-dismiss');

  const dismissBox = element('div', 'decision-dismiss-box');
  const dismissInput = document.createElement('input');
  dismissInput.type = 'text';
  dismissInput.className = 'decision-input';
  dismissInput.value = copyText(language, 'dismissReason');
  const sendDismissal = button(copyText(language, 'sendDismissal'), 'btn btn-sm btn-primary');
  dismissBox.appendChild(dismissInput);
  dismissBox.appendChild(sendDismissal);
  dismissBox.style.display = 'none';

  const update = (): void => {
    const current = values();
    const visible = visibleFieldKeys(fields, current);
    for (const row of rows) {
      row.row.style.display = visible.has(row.key) ? '' : 'none';
    }
    const complete = formIsComplete(fields, current);
    const blockedByClamp = (decision.droppedFields ?? 0) > 0 || (decision.droppedOptions ?? 0) > 0;
    submit.disabled = !answerable || !complete || blockedByClamp;
    dismiss.disabled = !answerable;
  };

  submit.addEventListener('click', () => {
    if (submit.disabled) return;
    context.onSubmit?.(decision, values());
  });
  dismiss.addEventListener('click', () => {
    if (dismiss.disabled) return;
    dismissBox.style.display = dismissBox.style.display === 'none' ? 'flex' : 'none';
    dismissInput.focus();
  });
  sendDismissal.addEventListener('click', () => {
    const message = dismissInput.value.trim();
    if (message.length === 0 || message.length > 2000) return;
    context.onDismiss?.(decision, message);
  });

  if (context.canAnswer && formIsAnswerable(fields) && !context.unbound) {
    actions.appendChild(submit);
    actions.appendChild(dismiss);
    actions.appendChild(dismissBox);
  }
  if (stale) {
    // §7.2: every control is disabled except Recheck, which asks the service
    // once more instead of leaving the owner with a dead block.
    const recheck = button(copyText(language, 'recheck'), 'btn btn-sm decision-recheck');
    recheck.addEventListener('click', () => context.onRecheck?.(decision));
    actions.appendChild(recheck);
  }
  actions.appendChild(openSession);

  if (answerState === 'sent') {
    stateNote.textContent = copyText(language, context.dismissal ? 'dismissalSent' : 'answeredSent');
  } else if (answerState === 'failed') stateNote.textContent = copyText(language, 'failed');
  else if (answerState === 'unknown-outcome') stateNote.textContent = copyText(language, 'unknownOutcome');
  else if (answerState === 'stale') stateNote.textContent = copyText(language, 'gone');
  else if (answerState === 'already-answered') stateNote.textContent = copyText(language, 'alreadyAnsweredNote');
  else if (answerState === 'expired') stateNote.textContent = copyText(language, 'expiredNote');
  else if (answerState === 'permission-missing') stateNote.textContent = copyText(language, 'permissionMissing');
  else if (answerState === 'not-linked') stateNote.textContent = copyText(language, 'notLinked');

  const answerMessage = typeof context.answerMessage === 'string'
    ? sanitizeAgentText(context.answerMessage).trim()
    : '';
  if (answerMessage.length > 0) {
    block.appendChild(textNode('div', answerMessage, 'decision-answer-message'));
  }

  update();
  return block;
}

/**
 * The observation time of a service restart, or the previous value when there
 * was none. `startedAt` is the service's own start clock; a change means its
 * in-memory decision store was emptied, so "nothing is waiting" would be a
 * claim the board cannot make (§7.5).
 */
export function decisionRestartAt(
  previousStartedAt: number,
  startedAt: number,
  at: number,
  previous: number | null
): number | null {
  return previousStartedAt > 0 && startedAt !== previousStartedAt ? at : previous;
}

/**
 * What the panel knows about the decision feed. `status` is one of:
 *
 * - `unknown`: no read has finished yet;
 * - `ok`: the last read returned a list;
 * - `down`: the service did not answer (or answered 401/403/5xx);
 * - `limited`: the service answered but refused this read with 429. That is a
 *   rate limit, not an outage, and it must never be shown as one.
 */
export type DecisionFeedStatus = 'unknown' | 'ok' | 'down' | 'limited';

export interface DecisionFeedFacts {
  status: DecisionFeedStatus;
  /** The time of the last successful read, or 0. */
  at: number;
  startedAt: number;
  /** Set when a successful read saw a different `startedAt` than the previous one. */
  restartedAt: number | null;
  decisions: DecisionView[];
  lastAttemptAt: number;
}

/** Why the feed is being refreshed; a snapshot or a visibility return is throttled. */
export type DecisionRefreshReason = 'snapshot' | 'visible' | 'view' | 'drawer' | 'recheck' | 'answer';

/**
 * Whether a refresh may start now. A snapshot and a visibility return are the
 * two host-driven reasons that can burst (D5); `GET /decisions` allows 120
 * reads a minute, so they are capped at one per `DECISION_REFRESH_MIN_MS`.
 * An explicit reason (Recheck, a view switch, a drawer open, an answer) is
 * always allowed: the owner asked, and a stale list there is a lie.
 */
export function shouldRefreshDecisions(
  reason: DecisionRefreshReason,
  lastAttemptAt: number,
  now: number,
  inFlight: boolean
): boolean {
  if (inFlight) return false;
  if (reason === 'snapshot' || reason === 'visible') {
    return lastAttemptAt <= 0 || now - lastAttemptAt >= DECISION_REFRESH_MIN_MS;
  }
  return true;
}

function parseJsonObject(text: unknown): Record<string, unknown> | null {
  if (typeof text !== 'string' || text.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return Object(parsed) === parsed && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The next feed state after one read. A 429 is `limited`, never `down`: the
 * service answered, so telling the owner it is not answering would be false.
 * A malformed 200 body is `down` (the feed did not produce a list).
 */
export function decisionFeedFromResponse(
  previous: DecisionFeedFacts,
  httpStatus: number,
  body: unknown,
  now: number
): DecisionFeedFacts {
  if (httpStatus === 429) return { ...previous, status: 'limited', lastAttemptAt: now };
  if (httpStatus !== 200) return { ...previous, status: 'down', lastAttemptAt: now };
  const parsed = typeof body === 'string'
    ? parseJsonObject(body)
    : Object(body) === body && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
  if (!parsed || !Array.isArray(parsed.decisions)) {
    return { ...previous, status: 'down', lastAttemptAt: now };
  }
  const startedAt = typeof parsed.startedAt === 'number' ? parsed.startedAt : previous.startedAt;
  const decisions = parsed.decisions as DecisionView[];
  let restartedAt = decisionRestartAt(previous.startedAt, startedAt, now, previous.restartedAt);
  // A4: a decision confirmed after the service started is the session speaking
  // again, so the restart note has said its piece and must clear. The store was
  // emptied at `startedAt`, so any entry confirmed at or after it is post-restart.
  if (
    restartedAt !== null &&
    decisions.some((entry) => typeof entry?.confirmedAt === 'number' && entry.confirmedAt >= startedAt)
  ) {
    restartedAt = null;
  }
  return {
    status: 'ok',
    at: typeof parsed.at === 'number' ? parsed.at : now,
    startedAt,
    restartedAt,
    decisions,
    lastAttemptAt: now,
  };
}

export interface DecisionObservation {
  /** The block may offer controls: the service answered, the observation is fresh, it is bound and not expired. */
  canAnswer: boolean;
  /** The last confirmation to name when the feed is down; never the failed attempt. */
  unconfirmedSince: number | null;
  checking: boolean;
  staleByObservation: boolean;
  expired: boolean;
}

/**
 * The one place the panel decides whether a decision is answerable. Three
 * clocks: `confirmedAt` (silence, re-armed), `firstSeenAt` (the form's own age,
 * never re-armed) and the feed's last successful read (was the list confirmed).
 * The overlay and the service's 409 must agree, so the constants are shared.
 */
export function decisionObservation(
  decision: Pick<DecisionView, 'confirmedAt' | 'firstSeenAt'>,
  feed: Pick<DecisionFeedFacts, 'status' | 'at'>,
  now: number,
  unbound: boolean
): DecisionObservation {
  const confirmedAt = typeof decision.confirmedAt === 'number' ? decision.confirmedAt : 0;
  const firstSeenAt = typeof decision.firstSeenAt === 'number' && decision.firstSeenAt > 0 ? decision.firstSeenAt : 0;
  const staleByObservation = confirmedAt > 0 && now - confirmedAt > DECISION_STALENESS_MS;
  const expired = firstSeenAt > 0 && now - firstSeenAt > DECISION_MAX_AGE_MS;
  // A3: the last *confirmation* is the last successful read (`at`), not the
  // failed attempt (`lastAttemptAt`), which the failure itself advances. A 429
  // is not an outage: the service answered, so the last list still stands and
  // only the decision's own silence can make it unconfirmed.
  const unconfirmedSince = feed.status === 'down'
    ? feed.at > 0 ? feed.at : now
    : staleByObservation
    ? confirmedAt
    : null;
  const serviceAnswers = feed.status === 'ok' || feed.status === 'limited';
  return {
    canAnswer: serviceAnswers && !staleByObservation && !expired && !unbound,
    unconfirmedSince,
    checking: feed.status === 'unknown',
    staleByObservation,
    expired,
  };
}

/** The one note the feed may print. `null` means the list itself is current. */
export function decisionFeedNote(
  feed: Pick<DecisionFeedFacts, 'status' | 'restartedAt'>,
  decisionCount: number
): DecisionNoteKind | null {
  if (feed.status === 'down') return 'service-down';
  if (feed.status === 'unknown') return 'checking';
  if (feed.status === 'limited') return 'rate-limited';
  if (feed.restartedAt !== null) return 'restarted';
  if (decisionCount === 0) return 'no-decisions';
  return null;
}

/**
 * Whether "Nothing is waiting on you" may show. Only after a successful read
 * with no restart in between: unreachable, unchecked, rate-limited or restarted
 * all mean the board cannot make that claim (D3).
 */
export function decisionEmptyBoxSuppressed(
  feed: Pick<DecisionFeedFacts, 'status' | 'restartedAt'>
): boolean {
  return feed.status !== 'ok' || feed.restartedAt !== null;
}

/**
 * One answer response as an answer state that is literally true. A 409 is not
 * always "already closed": the service names the entry's state, so an answer
 * that already completed (`answered-unconfirmed`) is not shown as in flight,
 * and an answer still running (`answering`) is not shown as already answered.
 */
export function decisionAnswerStateFromResponse(
  status: number,
  code: string,
  message: string | null,
  entryState?: string | null
): { state: AnswerState; message?: string | null } {
  if (status === 200) return { state: 'sent' };
  if (status === 404) return { state: 'stale' };
  if (status === 409) {
    if (code === 'DECISION_STALE') return { state: 'unconfirmed' };
    if (code === 'DECISION_EXPIRED') return { state: 'expired' };
    if (code === 'DECISION_NOT_LINKED') return { state: 'not-linked' };
    if (code === 'DECISION_NOT_PENDING') {
      return { state: entryState === 'answered-unconfirmed' ? 'already-answered' : 'in-flight' };
    }
    return { state: 'failed' };
  }
  if (status === 403) return { state: 'permission-missing', message };
  if (status === 502) return { state: 'unknown-outcome', message };
  return { state: 'failed', message };
}

/** The card line: one short verb and object, no controls (§8.1). */
export function renderDecisionBadge(
  decision: DecisionView,
  language: DecisionLanguage,
  extraCount = 0
): HTMLElement {
  const badge = element('span', 'decision-badge');
  const label = decision.state === 'answered-unconfirmed'
    ? copyText(language, 'confirming')
    : decision.state === 'answering'
    ? copyText(language, 'answerInFlight')
    : copyText(language, 'waiting');
  badge.appendChild(textNode('span', label, 'decision-badge-label'));
  if (decision.title) {
    badge.appendChild(textNode('span', cutForDisplay(sanitizeAgentText(decision.title), 80), 'decision-badge-title'));
  }
  if (extraCount > 0) {
    badge.appendChild(textNode('span', copyText(language, 'moreInAnother', { n: extraCount }), 'decision-badge-more'));
  }
  return badge;
}

/** `NO_DECISIONS`, `SERVICE_DOWN`, the restart note and the rate-limit note (§8.5). */
export type DecisionNoteKind =
  | 'no-decisions'
  | 'service-down'
  | 'restarted'
  | 'checking'
  | 'rate-limited';

export function renderDecisionStatusNote(
  kind: DecisionNoteKind,
  language: DecisionLanguage,
  at: number
): HTMLElement {
  const node = element('div', 'decision-status-note');
  const time = formatClock(at, language);
  if (kind === 'no-decisions') node.textContent = copyText(language, 'noDecision', { time });
  else if (kind === 'service-down') node.textContent = copyText(language, 'serviceDown', { time });
  else if (kind === 'rate-limited') node.textContent = copyText(language, 'rateLimited', { time });
  else if (kind === 'checking') node.textContent = copyText(language, 'checking');
  else node.textContent = copyText(language, 'restart', { time });
  return node;
}
