// ==========================================
// Board projection: GitHub issue shape to the standalone board's read model.
//
// Phase/attention identity and issue normalization reuse panel/core.ts by import.
// Open questions are scanned and answered in the web layer to enforce fence
// and indentation safety.
// ==========================================

import { createHash } from 'node:crypto';
import {
  normalizeGithubIssues,
  parseFriendlyTitle,
  parseTestPlan,
  resolveIssueColumn,
  resolveV2Metadata,
  type Issue,
} from '../../panel/core.ts';
import { STATUS_LABELS } from '../../panel/labels.ts';
import {
  editableSections,
  replaceSectionText,
  setStatusLabel,
  SectionError,
} from './sections.ts';

// Web-owned shared contracts. No dependency on the panel view-state implementation.
export function shortName(full: string, overrides: Record<string, string> = {}): string {
  if (overrides[full.toLowerCase()]?.trim()) return overrides[full.toLowerCase()].trim();
  const part = full.slice(full.lastIndexOf('/') + 1);
  const title = (token: string) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
  const tokens = part.split(/[-_.]+/).filter(Boolean)
    .filter((token) => !['openchamber', 'github', 'gh', 'repo'].includes(token.toLowerCase()));
  return tokens.length ? tokens.map(title).join(' ') : title(part);
}

const statusSet = new Set<string>(STATUS_LABELS as readonly string[]);
const fencePattern = /^ {0,3}(`{3,}|~{3,})/;
const closeFencePattern = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
// A tab after zero to three spaces advances to Markdown column four;
// four leading spaces already reach code indentation, regardless of what follows.
const indentedCodeLinePattern = /^(?: {4}| {0,3}\t)/;
const orderMarkerSingleLine = /^ {0,3}<!--\s*board-order:\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?)\s*-->[ \t]*$/i;

interface ScannedLine {
  start: number;
  contentEnd: number;
  fullEnd: number;
  text: string;
  fenced: boolean;
  indentedCode: boolean;
}

function scanBodyLines(body: string): ScannedLine[] {
  const lines: ScannedLine[] = [];
  let inCodeFence = false;
  let fenceChar = '';
  let fenceLen = 0;
  let i = 0;
  while (i < body.length) {
    const start = i;
    while (i < body.length && body.charCodeAt(i) !== 10 && body.charCodeAt(i) !== 13) {
      i += 1;
    }
    const contentEnd = i;
    if (i < body.length) {
      if (body.charCodeAt(i) === 13 && i + 1 < body.length && body.charCodeAt(i + 1) === 10) {
        i += 2;
      } else {
        i += 1;
      }
    }
    const fullEnd = i;
    const rawText = body.slice(start, contentEnd);
    const cleanText = start === 0 && rawText.startsWith('\uFEFF') ? rawText.slice(1) : rawText;
    let fenced = inCodeFence;
    if (!inCodeFence) {
      const m = fencePattern.exec(cleanText);
      if (m) {
        inCodeFence = true;
        fenced = true;
        fenceChar = m[1][0];
        fenceLen = m[1].length;
      }
    } else {
      const m = closeFencePattern.exec(cleanText);
      if (m && m[1][0] === fenceChar && m[1].length >= fenceLen) {
        inCodeFence = false;
      }
    }
    const indentedCode = !fenced && indentedCodeLinePattern.test(cleanText);
    lines.push({ start, contentEnd, fullEnd, text: cleanText, fenced, indentedCode });
  }
  return lines;
}

function parseMarkerLineValue(line: ScannedLine): number | null {
  if (line.fenced || line.indentedCode) return null;
  const match = orderMarkerSingleLine.exec(line.text);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
}

function locateTerminalOrderMarker(body: string): { order: number; cutOffset: number } | null {
  if (!body) return null;
  const lines = scanBodyLines(body);
  let idx = lines.length - 1;
  while (idx >= 0 && !lines[idx].fenced && /^[ \t]*$/.test(lines[idx].text)) {
    idx -= 1;
  }
  if (idx < 0) return null;
  const order = parseMarkerLineValue(lines[idx]);
  if (order === null) return null;
  let firstMarkerIdx = idx;
  let probe = idx - 1;
  while (probe >= 0) {
    let blankProbe = probe;
    while (blankProbe >= 0 && !lines[blankProbe].fenced && /^[ \t]*$/.test(lines[blankProbe].text)) {
      blankProbe -= 1;
    }
    if (blankProbe >= 0 && parseMarkerLineValue(lines[blankProbe]) !== null) {
      firstMarkerIdx = blankProbe;
      probe = blankProbe - 1;
    } else {
      break;
    }
  }
  return { order, cutOffset: lines[firstMarkerIdx].start };
}

function trimTrailingBlankLines(value: string): string {
  const lines = scanBodyLines(value);
  let idx = lines.length - 1;
  while (idx >= 0 && !/\S/.test(lines[idx].text)) {
    idx -= 1;
  }
  return idx >= 0 ? value.slice(0, lines[idx].contentEnd) : '';
}

export function hasUnfencedOrderMarkerComment(body: string = ''): boolean {
  return scanBodyLines(body).some(
    (line) => !line.fenced && !line.indentedCode && /^ {0,3}<!--\s*board-order:/i.test(line.text),
  );
}

export function parseOrderMarker(body: string = ''): number | null {
  const located = locateTerminalOrderMarker(body);
  return located ? located.order : null;
}

export function stripOrderMarker(body: string = ''): string {
  // Strip only the terminal unfenced marker line(s), leaving every non-marker byte untouched.
  const located = locateTerminalOrderMarker(body);
  return located ? body.slice(0, located.cutOffset) : body;
}

export function setOrderMarker(body: string, order: number): string {
  if (!Number.isFinite(order)) throw new BoardError('invalid', 'Order must be finite');
  const base = trimTrailingBlankLines(stripOrderMarker(body));
  const eol = body.includes('\r\n') ? '\r\n' : '\n';
  return (base ? base + eol + eol : '') + `<!-- board-order: ${order} -->`;
}

export function midpointOrder(previous: number | null, next: number | null): number {
  return previous === null ? (next === null ? 1000 : next - 1000) :
    next === null ? previous + 1000 : previous / 2 + next / 2;
}

function listFields(raw: any, repository: BoardRepository | null) {
  const body = typeof raw.body === 'string' ? raw.body : '';
  const description = trimTrailingBlankLines(stripOrderMarker(body));
  const dependencies: number[] = [];
  for (const line of scanBodyLines(description)) {
    if (line.fenced || line.indentedCode) continue;
    if (/^\s*(?:(?:[-*+]|\d+[.)])\s*(?:\[[ xX]\]\s*)?)?(?:blocked by|depends on|requires)\b/i.test(line.text)) {
      for (const match of line.text.matchAll(/#(\d+)/g)) {
        const dep = Number(match[1]);
        if (Number.isInteger(dep) && dep > 0 && !dependencies.includes(dep)) {
          dependencies.push(dep);
        }
      }
    }
  }
  return { createdAt: raw.created_at ?? null, description, order: parseOrderMarker(body),
    fingerprint: issueFingerprint(raw, repository), dependencies,
    pendingItems: [...(normalizedOf(raw)?.humanTasks ?? []), ...parseWebOpenQuestions(body)]
      .map((item) => ({ text: item.text, completed: item.completed })) };
}

export type BoardErrorCode = 'not_an_issue' | 'not_editable' | 'invalid';

export class BoardError extends Error {
  code: BoardErrorCode;

  constructor(code: BoardErrorCode, message: string) {
    super(message);
    this.name = 'BoardError';
    this.code = code;
  }
}
const checklistRegex = /^(\s*(?:[-*+]|\d+\.)\s*\[)([ xX])(\]\s+)(.+)$/;
const questionsSectionRegex = /^[ \t]*#{1,6}\s*(?:open\s+)?questions(?:\s*:)?/i;
const humanTasksSectionRegex = /^[ \t]*#{1,6}\s*human\s+tasks?(?:\s*:)?/i;
const headingRegex = /^[ ]{0,3}#{1,6}\s+/;

export function parseWebOpenQuestions(body: string | null | undefined): Array<{
  id: string;
  lineIndex: number;
  completed: boolean;
  text: string;
  rawLine: string;
}> {
  if (!body || typeof body !== 'string' || !body.includes('[')) return [];
  const cleanBody = body.startsWith('\uFEFF') ? body.slice(1) : body;
  if (!/question/i.test(cleanBody)) return [];
  const hasCR = cleanBody.includes('\r');
  const lines = cleanBody.split('\n');
  const questions: Array<{
    id: string;
    lineIndex: number;
    completed: boolean;
    text: string;
    rawLine: string;
  }> = [];
  let inQuestionsSection = false;
  let inHumanTasksSection = false;
  let inCodeFence = false;
  let fenceChar = '';
  let fenceLen = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const line = hasCR && rawLine.includes('\r') ? rawLine.replace(/\r/g, '') : rawLine;
    const cleanLine = line.replace(/\r$/, '');

    if (!inCodeFence) {
      const match = fencePattern.exec(cleanLine);
      if (match) {
        inCodeFence = true;
        fenceChar = match[1][0];
        fenceLen = match[1].length;
        continue;
      }
    } else {
      const match = closeFencePattern.exec(cleanLine);
      if (match && match[1][0] === fenceChar && match[1].length >= fenceLen) {
        inCodeFence = false;
      }
      continue;
    }

    if (indentedCodeLinePattern.test(cleanLine)) {
      continue;
    }

    if (line.includes('#')) {
      const isQuestions = questionsSectionRegex.test(line);
      const isHuman = humanTasksSectionRegex.test(line);
      if (isQuestions || isHuman || headingRegex.test(line)) {
        inQuestionsSection = isQuestions;
        inHumanTasksSection = isHuman;
        continue;
      }
    }

    if (inQuestionsSection) {
      let completed = false;
      let text = '';
      if (
        line.charCodeAt(0) === 45 &&
        line.charCodeAt(1) === 32 &&
        line.charCodeAt(2) === 91 &&
        (line.charCodeAt(3) === 32 || line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88) &&
        line.charCodeAt(4) === 93 &&
        line.charCodeAt(5) === 32
      ) {
        completed = line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88;
        text = line.slice(6).trim();
      } else {
        const match = line.match(checklistRegex);
        if (match) {
          completed = match[2].toLowerCase() === 'x';
          text = match[4].trim();
        }
      }
      if (text) {
        questions.push({
          id: `question-${i}`,
          lineIndex: i,
          completed,
          text,
          rawLine,
        });
      }
    } else if (!inHumanTasksSection) {
      if (line.includes('?') || line.includes('Q:') || line.includes('q:') || /question/i.test(line)) {
        let completed = false;
        let text = '';
        if (
          line.charCodeAt(0) === 45 &&
          line.charCodeAt(1) === 32 &&
          line.charCodeAt(2) === 91 &&
          (line.charCodeAt(3) === 32 || line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88) &&
          line.charCodeAt(4) === 93 &&
          line.charCodeAt(5) === 32
        ) {
          completed = line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88;
          text = line.slice(6).trim();
        } else {
          const match = line.match(checklistRegex);
          if (match) {
            completed = match[2].toLowerCase() === 'x';
            text = match[4].trim();
          }
        }
        if (text && /^(?:\?|Q:|Question:)/i.test(text)) {
          const qText = text.replace(/^(?:\?|Q:|Question:)\s*/i, '').trim();
          if (qText) {
            questions.push({
              id: `question-${i}`,
              lineIndex: i,
              completed,
              text: qText,
              rawLine,
            });
          }
        }
      }
    }
  }

  return questions;
}

export interface BoardRepository {
  owner: string;
  name: string;
  full: string;
  id: number | null;
  archived: boolean;
  hasIssues: boolean;
}

export function issueKey(
  repository: { full: string } | null | undefined,
  number: number,
): string {
  return repository && repository.full ? `${repository.full}#${number}` : `#${number}`;
}

export interface BoardListItem {
  number: number;
  key: string;
  repository: BoardRepository | null;
  title: string;
  friendlyTitle?: string | null;
  state: 'open' | 'closed';
  htmlUrl: string;
  labels: string[];
  statusLabel: string | null;
  phase: string;
  attention: string;
  column: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  description: string;
  order: number | null;
  fingerprint: string;
  dependencies: number[];
  pendingItems: Array<{ text: string; completed: boolean }>;
  counts: {
    subtasks: { total: number; done: number };
    openQuestions: { total: number; open: number };
    humanTasks: { total: number; open: number };
  };
}

export interface OpenQuestionView {
  index: number;
  answerIndex: number | null;
  text: string;
  completed: boolean;
}

export interface IssueDetail {
  number: number;
  key: string;
  repository: BoardRepository | null;
  title: string;
  friendlyTitle?: string | null;
  state: 'open' | 'closed';
  htmlUrl: string;
  body: string;
  fingerprint: string;
  labels: string[];
  statusLabel: string | null;
  phase: string;
  attention: string;
  column: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  editableSections: Array<{ id: string; title: string; text: string }>;
  openQuestions: OpenQuestionView[];
  humanTasks: Array<{ text: string; completed: boolean; lineIndex?: number }>;
  acceptanceCriteria: Array<{ text: string; completed: boolean; lineIndex?: number }>;
  subtasks: Array<{ text: string; completed: boolean; lineIndex?: number }>;
  testPlan: {
    issue: Array<{ text: string; completed: boolean }>;
    batch: Array<{ text: string; completed: boolean }>;
  };
}

export function labelNames(raw: any): string[] {
  if (!Array.isArray(raw?.labels)) return [];
  return raw.labels
    .map((label: any) => (typeof label === 'string' ? label : label?.name ?? ''))
    .filter((name: string) => name !== '');
}

export function statusLabelOf(labels: string[]): string | null {
  for (const label of labels) {
    const normalized = label.trim().toLowerCase();
    if (statusSet.has(normalized)) return normalized;
  }
  return null;
}

function countsOf(items: Array<{ completed: boolean }> = []) {
  return {
    total: items.length,
    done: items.filter((item) => item.completed).length,
    open: items.filter((item) => !item.completed).length,
  };
}

export function issueFingerprint(raw: any, repository: BoardRepository | null = null): string {
  const body = typeof raw?.body === 'string' ? raw.body : '';
  const labels = labelNames(raw)
    .map((label) => label.trim().toLowerCase())
    .sort();
  const state = raw?.state === 'closed' ? 'closed' : 'open';
  return createHash('sha256')
    .update(JSON.stringify({ body, title: raw?.title ?? '', labels, state, ...(repository ? { repository: repository.id ?? repository.full, full: repository.full, number: raw.number } : {}) }))
    .digest('hex');
}

function normalizedOf(raw: any): Issue | null {
  const issues = normalizeGithubIssues([raw]);
  return issues.length > 0 ? issues[0] : null;
}

export function buildBoardListItem(rawItem: any, repository: BoardRepository | null = null): BoardListItem {
  const normalized = normalizeGithubIssues([rawItem]);
  if (!normalized.length) {
    throw new BoardError('not_an_issue', 'That item is not an issue');
  }
  const issue = normalized[0];
  const metadata = resolveV2Metadata(issue);
  const labels = labelNames(issue);
  const questions = parseWebOpenQuestions(issue.body ?? '');
  const friendly = parseFriendlyTitle(stripOrderMarker(issue.body), issue.title);
  const friendlyTitle = friendly.subtitle && friendly.title !== issue.title ? friendly.title : null;
  return {
    ...listFields(rawItem, repository),
    number: issue.number,
    key: issueKey(repository, issue.number),
    repository,
    title: issue.title,
    friendlyTitle,
    state: issue.state,
    htmlUrl: issue.html_url,
    labels,
    statusLabel: statusLabelOf(labels),
    phase: metadata.phase,
    attention: metadata.attention,
    column: resolveIssueColumn(issue),
    updatedAt: issue.updated_at ?? null,
    counts: {
      subtasks: countsOf(issue.subtasks),
      openQuestions: countsOf(questions),
      humanTasks: countsOf(issue.humanTasks ?? []),
    },
  };
}

export function buildBoardList(rawItems: any[], repository: BoardRepository | null = null): { issues: BoardListItem[]; excluded: number } {
  const raw = Array.isArray(rawItems) ? rawItems : [];
  const issues = raw.filter((item) => normalizedOf(item)).map((item) => buildBoardListItem(item, repository));
  return { issues, excluded: raw.length - issues.length };
}

export function buildIssueDetail(raw: any, repository: BoardRepository | null = null): IssueDetail {
  if (!raw || raw.pull_request) {
    throw new BoardError('not_an_issue', 'That number is a pull request or not an issue');
  }
  const issue = normalizedOf(raw);
  if (!issue) {
    throw new BoardError('not_an_issue', 'That number is not an issue');
  }
  const metadata = resolveV2Metadata(issue);
  const labels = labelNames(raw);
  const questions = parseWebOpenQuestions(issue.body ?? '');
  let answerIndex = 0;
  const openQuestions: OpenQuestionView[] = questions.map((question, index) => {
    const view: OpenQuestionView = {
      index,
      answerIndex: question.completed ? null : answerIndex,
      text: question.text,
      completed: question.completed,
    };
    if (!question.completed) answerIndex += 1;
    return view;
  });
  const testPlan = parseTestPlan(issue.body);
  const friendly = parseFriendlyTitle(stripOrderMarker(issue.body), issue.title);
  const friendlyTitle = friendly.subtitle && friendly.title !== issue.title ? friendly.title : null;

  return {
    ...listFields(raw, repository),
    number: issue.number,
    key: issueKey(repository, issue.number),
    repository,
    title: issue.title,
    friendlyTitle,
    state: issue.state,
    htmlUrl: issue.html_url,
    body: stripOrderMarker(issue.body),
    fingerprint: issueFingerprint(raw, repository),
    labels,
    statusLabel: statusLabelOf(labels),
    phase: metadata.phase,
    attention: metadata.attention,
    column: resolveIssueColumn(issue),
    updatedAt: issue.updated_at ?? null,
    createdAt: issue.created_at ?? null,
    editableSections: editableSections(stripOrderMarker(issue.body)),
    openQuestions,
    humanTasks: (issue.humanTasks ?? []).map((task) => ({
      text: task.text,
      completed: task.completed,
      lineIndex: task.lineIndex,
    })),
    acceptanceCriteria: (issue.acceptanceCriteria ?? []).map((item) => ({
      text: item.text,
      completed: item.completed,
      lineIndex: item.lineIndex,
    })),
    subtasks: issue.subtasks.map((item) => ({
      text: item.text,
      completed: item.completed,
      lineIndex: item.lineIndex,
    })),
    testPlan: {
      issue: testPlan.issueTests.map((item) => ({ text: item.text, completed: item.completed })),
      batch: testPlan.batchTests.map((item) => ({ text: item.text, completed: item.completed })),
    },
  };
}

export function applySectionEdit(raw: any, sectionId: unknown, text: unknown): string {
  if (typeof sectionId !== 'string') {
    throw new BoardError('invalid', 'A section id is required');
  }
  try {
    return replaceSectionText(typeof raw?.body === 'string' ? raw.body : '', sectionId, text);
  } catch (error) {
    if (error instanceof SectionError) {
      throw new BoardError('not_editable', 'That section cannot be edited from the board');
    }
    throw error;
  }
}

export function applyQuestionAnswer(raw: any, index: unknown, answer: unknown): string {
  if (typeof answer !== 'string' || answer.trim() === '') {
    throw new BoardError('invalid', 'An answer is required');
  }
  if (answer.length > 2000) {
    throw new BoardError('invalid', 'The answer is too long');
  }
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) {
    throw new BoardError('invalid', 'A question index is required');
  }
  const body = typeof raw?.body === 'string' ? raw.body : '';
  const questions = parseWebOpenQuestions(body);
  const unresolved = questions.filter((q) => !q.completed);
  if (index >= unresolved.length) {
    throw new BoardError('invalid', 'That open question is no longer answerable');
  }
  const target = unresolved[index];
  const lines = body.split('\n');
  const rawLine = lines[target.lineIndex];
  if (!rawLine) {
    throw new BoardError('invalid', 'That open question is no longer answerable');
  }
  const hasCr = rawLine.endsWith('\r');
  const cleanLine = hasCr ? rawLine.slice(0, -1) : rawLine;
  if (indentedCodeLinePattern.test(cleanLine)) {
    throw new BoardError('invalid', 'That open question is no longer answerable');
  }
  const match = cleanLine.match(checklistRegex);
  if (!match) {
    throw new BoardError('invalid', 'That open question is no longer answerable');
  }
  const cleanAnswer = answer.trim().replace(/\r?\n+/g, ' ');
  const lineEnding = hasCr ? '\r' : '';
  const questionContent = match[4]
    .replace(/\s*\*\s*\(Answer:[\s\S]*?\)\s*\*$/i, '')
    .trimEnd();
  lines[target.lineIndex] = `${match[1]}x${match[3]}${questionContent} *(Answer: ${cleanAnswer})*${lineEnding}`;
  return lines.join('\n');
}

export function applyStatusChange(raw: any, status: unknown): string[] {
  try {
    return setStatusLabel(labelNames(raw), typeof status === 'string' ? status : null);
  } catch (error) {
    if (error instanceof SectionError) {
      throw new BoardError('not_editable', 'That status is not part of the agreed label set');
    }
    throw error;
  }
}
