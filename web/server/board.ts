// ==========================================
// Board projection: GitHub issue shape to the standalone board's read model.
//
// Parsing, phase/attention identity and open-question answering all reuse
// panel/core.ts by import. Nothing here is a second parser.
// ==========================================

import { createHash } from 'node:crypto';
import {
  answerOpenQuestionInMarkdown,
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
        openQuestions: countsOf(issue.openQuestions ?? []),
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
  const questions = issue.openQuestions ?? [];
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
  const next = answerOpenQuestionInMarkdown(body, index, answer);
  if (next === body) {
    throw new BoardError('invalid', 'That open question is no longer answerable');
  }
  return next;
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
