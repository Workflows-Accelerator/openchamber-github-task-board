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

export type BoardErrorCode = 'not_an_issue' | 'not_editable' | 'invalid';

export class BoardError extends Error {
  code: BoardErrorCode;

  constructor(code: BoardErrorCode, message: string) {
    super(message);
    this.name = 'BoardError';
    this.code = code;
  }
}

const statusSet = new Set<string>(STATUS_LABELS as readonly string[]);
const fencePattern = /^ {0,3}(`{3,}|~{3,})/;
const closeFencePattern = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const indentedCodeLinePattern = /^(?: {4,}|\t)/;
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

export interface BoardListItem {
  number: number;
  title: string;
  state: 'open' | 'closed';
  htmlUrl: string;
  labels: string[];
  statusLabel: string | null;
  phase: string;
  attention: string;
  column: string | null;
  updatedAt: string | null;
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
  title: string;
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
  humanTasks: Array<{ text: string; completed: boolean }>;
  acceptanceCriteria: Array<{ text: string; completed: boolean }>;
  subtasks: Array<{ text: string; completed: boolean }>;
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

export function issueFingerprint(raw: any): string {
  const body = typeof raw?.body === 'string' ? raw.body : '';
  const labels = labelNames(raw)
    .map((label) => label.trim().toLowerCase())
    .sort();
  const state = raw?.state === 'closed' ? 'closed' : 'open';
  return createHash('sha256')
    .update(JSON.stringify({ body, labels, state }))
    .digest('hex');
}

function normalizedOf(raw: any): Issue | null {
  const issues = normalizeGithubIssues([raw]);
  return issues.length > 0 ? issues[0] : null;
}

export function buildBoardList(rawItems: any[]): { issues: BoardListItem[]; excluded: number } {
  const raw = Array.isArray(rawItems) ? rawItems : [];
  const normalized = normalizeGithubIssues(raw);
  const issues: BoardListItem[] = normalized.map((issue) => {
    const metadata = resolveV2Metadata(issue);
    const labels = labelNames(issue);
    const questions = parseWebOpenQuestions(issue.body ?? '');
    return {
      number: issue.number,
      title: issue.title,
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
  });
  return { issues, excluded: raw.length - normalized.length };
}

export function buildIssueDetail(raw: any): IssueDetail {
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

  return {
    number: issue.number,
    title: issue.title,
    state: issue.state,
    htmlUrl: issue.html_url,
    body: issue.body,
    fingerprint: issueFingerprint(raw),
    labels,
    statusLabel: statusLabelOf(labels),
    phase: metadata.phase,
    attention: metadata.attention,
    column: resolveIssueColumn(issue),
    updatedAt: issue.updated_at ?? null,
    createdAt: issue.created_at ?? null,
    editableSections: editableSections(issue.body),
    openQuestions,
    humanTasks: (issue.humanTasks ?? []).map((task) => ({ text: task.text, completed: task.completed })),
    acceptanceCriteria: (issue.acceptanceCriteria ?? []).map((item) => ({
      text: item.text,
      completed: item.completed,
    })),
    subtasks: issue.subtasks.map((item) => ({ text: item.text, completed: item.completed })),
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
