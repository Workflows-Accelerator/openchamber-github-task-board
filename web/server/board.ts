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
const canvasMarkerLinePattern = /^ {0,3}<!--\s*board-canvas:/i;
const canvasMarkerSingleLine = /^ {0,3}<!--\s*board-canvas:\s*(\{[\s\S]*\})\s*-->[ \t]*$/i;

export interface CanvasMarkerData {
  x?: number;
  y?: number;
  [key: string]: any;
}

interface ScannedLine {
  start: number;
  contentEnd: number;
  fullEnd: number;
  text: string;
  fenced: boolean;
  indentedCode: boolean;
  hasBom?: boolean;
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
    const hasBom = start === 0 && rawText.startsWith('\uFEFF');
    const cleanText = hasBom ? rawText.slice(1) : rawText;
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
    lines.push({ start, contentEnd, fullEnd, text: cleanText, fenced, indentedCode, hasBom });
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
  if (!body) return null;
  const lines = scanBodyLines(body);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.fenced || line.indentedCode) continue;
    const match = orderMarkerSingleLine.exec(line.text);
    if (match) {
      const num = Number(match[1]);
      return Number.isFinite(num) ? num : null;
    }
  }
  return null;
}

export function stripOrderMarker(body: string = ''): string {
  if (!body) return '';
  const lines = scanBodyLines(body);
  const orderIndices = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.fenced && !line.indentedCode && orderMarkerSingleLine.test(line.text)) {
      orderIndices.add(i);
    }
  }
  if (orderIndices.size === 0) return body;
  let result = '';
  for (let i = 0; i < lines.length; i++) {
    if (orderIndices.has(i)) continue;
    result += body.slice(lines[i].start, lines[i].fullEnd);
  }
  return result;
}

export function setOrderMarker(body: string, order: number): string {
  if (!Number.isFinite(order)) throw new BoardError('invalid', 'Order must be finite');
  const markerText = `<!-- board-order: ${order} -->`;
  const lines = scanBodyLines(body);
  const orderIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.fenced && !line.indentedCode && orderMarkerSingleLine.test(line.text)) {
      orderIndices.push(i);
    }
  }

  if (orderIndices.length > 0) {
    const lastIdx = orderIndices[orderIndices.length - 1];
    const earlierSet = new Set(orderIndices.slice(0, -1));
    let result = '';
    for (let i = 0; i < lines.length; i++) {
      if (earlierSet.has(i)) continue;
      if (i === lastIdx) {
        const lineEnding = body.slice(lines[i].contentEnd, lines[i].fullEnd);
        result += markerText + lineEnding;
      } else {
        result += body.slice(lines[i].start, lines[i].fullEnd);
      }
    }
    return result;
  }

  const eol = body.includes('\r\n') ? '\r\n' : '\n';
  if (!body.trim()) return markerText;
  if (body.endsWith('\r\n\r\n') || body.endsWith('\n\n')) {
    return body + markerText;
  }
  if (body.endsWith('\r\n') || body.endsWith('\n')) {
    return body + eol + markerText;
  }
  return body + eol + eol + markerText;
}

const canvasMarkerCommentPattern = /^ {0,3}<!--\s*board-canvas:\s*(.*?)\s*-->[ \t]*$/i;

export function hasUnfencedCanvasMarkerComment(body: string = ''): boolean {
  return scanBodyLines(body).some(
    (line) => !line.fenced && !line.indentedCode && canvasMarkerLinePattern.test(line.text),
  );
}

export function parseCanvasMarker(body: string = ''): Record<string, any> | null {
  if (!body || typeof body !== 'string') return null;
  const lines = scanBodyLines(body);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.fenced || line.indentedCode) continue;
    const match = canvasMarkerCommentPattern.exec(line.text);
    if (!match) continue;
    try {
      let rawJson = match[1].trim();
      const sepMatch = /;sep=\d+$/.exec(rawJson);
      if (sepMatch) {
        rawJson = rawJson.slice(0, sepMatch.index).trim();
      }
      const parsed = JSON.parse(rawJson);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Malformed JSON comment; keep scanning earlier lines
    }
  }
  return null;
}

export function stripCanvasMarker(body: string = ''): string {
  if (!body) return '';
  const lines = scanBodyLines(body);
  const removalRanges: Array<{ from: number; to: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.fenced && !line.indentedCode && canvasMarkerLinePattern.test(line.text)) {
      const sepMatch = /;sep=(\d+)\s*-->/.exec(line.text);
      if (sepMatch) {
        const sepLen = Number(sepMatch[1]);
        removalRanges.push({
          from: Math.max(0, line.start - sepLen),
          to: line.fullEnd,
        });
      } else {
        const from = (i > 0 && lines[i - 1].text === '' && !lines[i - 1].fenced)
          ? lines[i - 1].start
          : line.start;
        removalRanges.push({
          from,
          to: line.fullEnd,
        });
      }
    }
  }

  if (removalRanges.length === 0) return body;

  // Merge overlapping or adjacent removal ranges
  removalRanges.sort((a, b) => a.from - b.from);
  let result = '';
  let lastPos = 0;
  for (const range of removalRanges) {
    if (range.from > lastPos) {
      result += body.slice(lastPos, range.from);
    }
    lastPos = Math.max(lastPos, range.to);
  }
  result += body.slice(lastPos);
  return result;
}

export function stripHiddenMarkers(body: string = ''): string {
  return stripCanvasMarker(stripOrderMarker(body));
}

// ==========================================
// Quick notes: a note is a real GitHub issue comment carrying a hidden marker.
// The GitHub comment stays the only stored copy; the board reads it back.
//
// Authoring convention, written by the board and never hand-edited:
//
//   <!-- board-note: 1 -->
//   Note for the agent
//
//   <the text the user typed>
//
// Rules enforced by parseNoteComment:
// - the marker must be the FIRST non-blank line, so a human comment that only
//   quotes the marker further down can never be mistaken for a board note;
// - the marker carries a version, so a future format stays recognisable;
// - the visible lead-in is localised at write time and both languages are read;
// - a note is append-only: the board never edits, replaces or deletes comments.
// ==========================================
export const NOTE_MARKER_VERSION = 1;
export const NOTE_MAX_LENGTH = 4000;
const noteMarkerLinePattern = /^ {0,3}<!--\s*board-note:\s*(\d+)\s*-->[ \t]*$/i;
const noteLeadIns = ['note for the agent', 'note pour l’agent', 'note pour l\'agent'];

export function buildNoteCommentBody(text: unknown, language: unknown = 'en'): string {
  const clean = typeof text === 'string' ? text.trim() : '';
  if (!clean) throw new BoardError('invalid', 'A note is required');
  if (clean.length > NOTE_MAX_LENGTH) {
    throw new BoardError('note_too_long', `A note cannot exceed ${NOTE_MAX_LENGTH} characters`);
  }
  const lead = language === 'fr' ? 'Note pour l’agent' : 'Note for the agent';
  return `<!-- board-note: ${NOTE_MARKER_VERSION} -->\n${lead}\n\n${clean}`;
}

export interface IssueNoteView {
  id: number;
  text: string;
  author: string;
  createdAt: string | null;
  url: string | null;
}

export function parseNoteComment(raw: any): IssueNoteView | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (typeof raw.id !== 'number' || !Number.isFinite(raw.id)) return null;
  if (typeof raw.body !== 'string') return null;
  const lines = raw.body.replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i += 1;
  if (i >= lines.length) return null;
  const marker = noteMarkerLinePattern.exec(lines[i]);
  if (!marker) return null;
  const version = Number(marker[1]);
  if (!Number.isInteger(version) || version < 1 || version > NOTE_MARKER_VERSION) return null;
  i += 1;
  while (i < lines.length && !lines[i].trim()) i += 1;
  if (i < lines.length) {
    const lead = lines[i].trim().replace(/[:.]+$/, '').toLowerCase();
    if (noteLeadIns.includes(lead)) i += 1;
  }
  while (i < lines.length && !lines[i].trim()) i += 1;
  const text = lines.slice(i).join('\n').trim();
  if (!text) return null;
  const author = typeof raw.user?.login === 'string' ? raw.user.login : '';
  const createdAt = typeof raw.created_at === 'string' ? raw.created_at : null;
  const url = typeof raw.html_url === 'string' ? raw.html_url : null;
  return { id: raw.id, text: text.slice(0, NOTE_MAX_LENGTH), author, createdAt, url };
}

export function parseIssueNotes(rawComments: unknown, limit = 20): IssueNoteView[] {
  if (!Array.isArray(rawComments)) return [];
  const notes: IssueNoteView[] = [];
  for (const raw of rawComments) {
    const note = parseNoteComment(raw);
    if (note) notes.push(note);
  }
  notes.sort((a, b) => {
    const timeA = a.createdAt ? Date.parse(a.createdAt) : 0;
    const timeB = b.createdAt ? Date.parse(b.createdAt) : 0;
    if (timeB !== timeA) return timeB - timeA;
    return b.id - a.id;
  });
  return notes.slice(0, Math.max(1, limit));
}

const ALLOWED_NOTE_COLORS = new Set(['yellow', 'pink', 'blue', 'green', 'purple']);

export function setCanvasMarker(body: string = '', data: Record<string, any>): string {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new BoardError('invalid', 'Canvas data must be a valid JSON object');
  }
  if (data.x !== undefined && data.x !== null && (typeof data.x !== 'number' || !Number.isFinite(data.x))) {
    throw new BoardError('invalid', 'Canvas x coordinate must be finite');
  }
  if (data.y !== undefined && data.y !== null && (typeof data.y !== 'number' || !Number.isFinite(data.y))) {
    throw new BoardError('invalid', 'Canvas y coordinate must be finite');
  }
  if (data.notes !== undefined) {
    if (!Array.isArray(data.notes)) {
      throw new BoardError('invalid', 'Canvas notes must be an array');
    }
    const seenNoteIds = new Set<string>();
    for (const note of data.notes) {
      if (!note || typeof note !== 'object' || Array.isArray(note)) {
        throw new BoardError('invalid', 'Canvas note must be an object');
      }
      if (typeof note.id !== 'string' || !note.id.trim()) {
        throw new BoardError('invalid', 'Note id must be a non-empty string');
      }
      if (seenNoteIds.has(note.id)) {
        throw new BoardError('invalid', `Duplicate note id: ${note.id}`);
      }
      seenNoteIds.add(note.id);
      if (note.text !== undefined && typeof note.text !== 'string') {
        throw new BoardError('invalid', 'Note text must be a string');
      }
      if (typeof note.text === 'string' && note.text.length > 4000) {
        throw new BoardError('note_too_long', 'Note text cannot exceed 4,000 characters');
      }
      if (note.x !== undefined && (typeof note.x !== 'number' || !Number.isFinite(note.x))) {
        throw new BoardError('invalid', 'Note x coordinate must be finite');
      }
      if (note.y !== undefined && (typeof note.y !== 'number' || !Number.isFinite(note.y))) {
        throw new BoardError('invalid', 'Note y coordinate must be finite');
      }
      if (note.w !== undefined && (typeof note.w !== 'number' || !Number.isFinite(note.w) || note.w <= 0)) {
        throw new BoardError('invalid', 'Note width must be a positive number');
      }
      if (note.h !== undefined && (typeof note.h !== 'number' || !Number.isFinite(note.h) || note.h <= 0)) {
        throw new BoardError('invalid', 'Note height must be a positive number');
      }
      if (note.color !== undefined) {
        if (typeof note.color !== 'string' || (!ALLOWED_NOTE_COLORS.has(note.color.toLowerCase()) && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(note.color))) {
          throw new BoardError('invalid', 'Invalid note color');
        }
      }
    }
  }
  const existing = parseCanvasMarker(body) || {};
  const merged: Record<string, any> = { ...existing };

  if (data.clearPosition || data.x === null || data.y === null) {
    delete merged.x;
    delete merged.y;
  } else {
    if (data.x !== undefined) merged.x = data.x;
    if (data.y !== undefined) merged.y = data.y;
  }

  if (data.notes !== undefined) {
    if (Array.isArray(data.notes) && data.notes.length === 0) {
      delete merged.notes;
    } else {
      merged.notes = data.notes;
    }
  }

  // Preserve any other incoming custom or unknown keys (excluding control flags)
  for (const k of Object.keys(data)) {
    if (k !== 'x' && k !== 'y' && k !== 'notes' && k !== 'clearPosition') {
      merged[k] = data[k];
    }
  }

  // If merged has zero keys remaining, strip the marker completely
  if (Object.keys(merged).length === 0) {
    return stripCanvasMarker(body);
  }

  // U+2028/U+2029 are line terminators for the marker regex, so leaving them raw would
  // write a marker that can never be parsed back (all canvas data lost on next read).
  const jsonStr = JSON.stringify(merged)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const markerText = `<!-- board-canvas: ${jsonStr} -->`;

  let finalBody = '';
  const lines = scanBodyLines(body);
  const canvasIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.fenced && !line.indentedCode && canvasMarkerLinePattern.test(line.text)) {
      canvasIndices.push(i);
    }
  }

  if (canvasIndices.length > 0) {
    const lastIdx = canvasIndices[canvasIndices.length - 1];
    const earlierSet = new Set(canvasIndices.slice(0, -1));
    const lastLineText = lines[lastIdx].text;
    const existingSepMatch = /;sep=(\d+)/.exec(lastLineText);
    const sepSuffix = existingSepMatch ? ` ;sep=${existingSepMatch[1]}` : '';
    const updatedMarkerText = `<!-- board-canvas: ${jsonStr}${sepSuffix} -->`;
    for (let i = 0; i < lines.length; i++) {
      if (earlierSet.has(i)) continue;
      if (i === lastIdx) {
        const lineEnding = body.slice(lines[i].contentEnd, lines[i].fullEnd);
        finalBody += updatedMarkerText + lineEnding;
      } else {
        finalBody += body.slice(lines[i].start, lines[i].fullEnd);
      }
    }
  } else {
    const eol = body.includes('\r\n') ? '\r\n' : '\n';
    let separator = '';
    if (body.length === 0) {
      separator = '';
    } else if (body.endsWith('\r\n') || body.endsWith('\n')) {
      separator = eol;
    } else {
      separator = eol + eol;
    }
    const markerWithSep = `<!-- board-canvas: ${jsonStr} ;sep=${separator.length} -->`;
    finalBody = body + separator + markerWithSep;
  }

  if (finalBody.length > 65536) {
    throw new BoardError('body_too_long', 'Issue body cannot exceed 65,536 characters (GitHub limit)');
  }
  return finalBody;
}

export function midpointOrder(previous: number | null, next: number | null): number {
  return previous === null ? (next === null ? 1000 : next - 1000) :
    next === null ? previous + 1000 : previous / 2 + next / 2;
}

function extractDependencyRepository(item: any, fallbackRepo: BoardRepository | null): string | undefined {
  if (!item) return fallbackRepo?.full;
  if (typeof item.repository === 'string' && item.repository.trim()) return item.repository.trim();
  const repoObj = item.repository?.full ?? item.repository?.nameWithOwner ?? item.repository?.full_name;
  if (typeof repoObj === 'string' && repoObj.trim()) return repoObj.trim();
  if (typeof item.repository_url === 'string') {
    const match = /\/repos\/([^/]+\/[^/]+)\/?$/.exec(item.repository_url);
    if (match) return match[1];
  }
  if (typeof item.html_url === 'string') {
    const match = /github\.com\/([^/]+\/[^/]+)\/(?:issues|pull)\/\d+/.exec(item.html_url);
    if (match) return match[1];
  }
  return fallbackRepo?.full;
}

function listFields(raw: any, repository: BoardRepository | null) {
  const body = typeof raw.body === 'string' ? raw.body : '';
  const description = trimTrailingBlankLines(stripHiddenMarkers(body));
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
  const textDependencies = [...dependencies];
  const rawBlockedBy = Array.isArray(raw.blocked_by)
    ? raw.blocked_by
    : Array.isArray(raw.blockedBy)
      ? raw.blockedBy
      : Array.isArray(raw.blocked_by_issues)
        ? raw.blocked_by_issues
        : [];
  const blockedBy = rawBlockedBy.map((item: any) => ({
    id: typeof item.id === 'number' ? item.id : Number(item.databaseId) || 0,
    number: item.number,
    title: item.title ?? '',
    state: (item.state ?? 'open').toLowerCase(),
    repository: extractDependencyRepository(item, repository),
  }));
  const rawBlocking = Array.isArray(raw.blocking) ? raw.blocking : [];
  const blocking = rawBlocking.map((item: any) => ({
    id: typeof item.id === 'number' ? item.id : Number(item.databaseId) || 0,
    number: item.number,
    title: item.title ?? '',
    state: (item.state ?? 'open').toLowerCase(),
    repository: extractDependencyRepository(item, repository),
  }));

  return {
    id: typeof raw.id === 'number' ? raw.id : null,
    createdAt: raw.created_at ?? null,
    closedAt: raw.closed_at ?? (normalizedOf(raw) as any)?.closed_at ?? null,
    description,
    order: parseOrderMarker(body),
    canvas: parseCanvasMarker(body),
    humanReview: parseHumanReview(body),
    fingerprint: issueFingerprint(raw, repository),
    dependencies,
    textDependencies,
    blockedBy,
    blocking,
    commentCount: typeof raw.comments === 'number' && Number.isFinite(raw.comments) && raw.comments >= 0
      ? raw.comments
      : 0,
    pendingItems: [...(normalizedOf(raw)?.humanTasks ?? []), ...parseWebOpenQuestions(body)]
      .map((item) => ({ text: item.text, completed: item.completed })),
  };
}

export type BoardErrorCode = 'not_an_issue' | 'not_editable' | 'invalid' | 'note_too_long' | 'body_too_long';

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

// ==========================================
// Preset answer options for an open question.
//
// Authoring convention (one convention only, parsed here and nowhere else):
//
//   ## Open Questions
//   - [ ] Which database should we use?
//     - PostgreSQL :: Mature and familiar :: **Operations stay unchanged**.
//     - SQLite :: Zero operations :: A single file, but no concurrent writers.
//
// - Option lines are single-line list items indented 2 to 3 spaces and must directly follow
//   the question line; a blank line, an indented code block or an unindented
//   line ends the list.
// - Fields are separated by " :: ". Only the label is required:
//   `label :: one-line gist :: details paragraph`.
//   The details field keeps any later " :: " separators and is Markdown.
// - A nested checklist item (`  - [ ] step`) is a subtask, not an option.
// - A question without such lines keeps rendering and answering exactly as
//   before: no options are produced and the free-text answer stays primary.
// Backward compatibility is therefore structural, not a version flag.
// ==========================================
export interface OpenQuestionOption {
  label: string;
  gist: string;
  details: string;
}

export const QUESTION_OPTION_MAX = 8;
const optionLinePattern = /^([ ]{2,3})(?:[-*+]|\d+[.)])[ \t]+(.*)$/;
const optionFieldSeparator = /\s+::\s+/;

function parseQuestionOptionLines(lines: string[], startIndex: number): OpenQuestionOption[] {
  const options: OpenQuestionOption[] = [];
  for (let i = startIndex; i < lines.length && options.length < QUESTION_OPTION_MAX; i += 1) {
    const line = lines[i].replace(/\r$/, '');
    if (!line.trim()) break;
    if (!/^[ \t]/.test(line)) break;
    if (indentedCodeLinePattern.test(line)) break;
    if (fencePattern.test(line)) break;
    const match = optionLinePattern.exec(line);
    if (!match) break;
    const content = match[2].trim();
    if (!content) continue;
    if (/^\[[ xX]\][ \t]+/.test(content)) break;
    // "-  :: gist" has an empty label; trimming removed the space the
    // separator needs, so without this the separator would become the label.
    if (/^::(?:\s|$)/.test(content)) continue;
    const fields = content.split(optionFieldSeparator);
    const label = (fields[0] || '').trim();
    if (!label || label.length > 120) continue;
    const gist = (fields.length > 1 ? fields[1] : '').trim().slice(0, 200);
    const details = (fields.length > 2 ? fields.slice(2).join(' :: ') : '').trim().slice(0, 2000);
    options.push({ label, gist, details });
  }
  return options;
}

export function parseWebOpenQuestions(body: string | null | undefined): Array<{
  id: string;
  lineIndex: number;
  completed: boolean;
  text: string;
  rawLine: string;
  options?: OpenQuestionOption[];
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
    options?: OpenQuestionOption[];
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
        const options = parseQuestionOptionLines(lines, i + 1);
        questions.push({
          id: `question-${i}`,
          lineIndex: i,
          completed,
          text,
          rawLine,
          ...(options.length ? { options } : {}),
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
            const options = parseQuestionOptionLines(lines, i + 1);
            questions.push({
              id: `question-${i}`,
              lineIndex: i,
              completed,
              text: qText,
              rawLine,
              ...(options.length ? { options } : {}),
            });
          }
        }
      }
    }
  }

  return questions;
}

// ==========================================
// Human review artifact: the only thing allowed to make a task "wait for you".
//
// A task may sit in status:needs-human only when the human can settle it by
// clicking: a screenshot, a short video, a link, or a question with preset
// answers. Anything that would need the human to write code, run a command or
// start a server is not a human gate and must stay with the agent.
//
// Authoring convention (one convention only, parsed here and nowhere else):
//
//   ### Human Review:
//   - Artifact: image
//   - URL: https://example.com/screenshots/login-empty.png
//   - Instruction: Compare the empty state with the approved mockup.
//
// - The heading is `Human Review` at any level 1-6, case-insensitive, with an
//   optional colon. The last such section wins, like the canvas and order markers.
// - Fields are single-line list items `- Name: value` with the names Artifact,
//   URL and Instruction. Blank lines and ordinary prose inside the section are
//   ignored, so the section still reads as prose; a repeated known field is malformed.
// - Artifact is one of image, video, link or question.
// - image, video and link need an http(s) URL and a one-line Instruction.
// - question needs an unanswered `### Open Questions:` item, whose text is the
//   instruction; URL and Instruction are not used for it. Preset answer lines
//   (`  - label :: gist :: details`) are read by parseWebOpenQuestions, so the
//   gate and the drawer render exactly the same options. Once that question is
//   answered the artifact is "settled": nothing is asked of the human any more.
// - A malformed section is reported as malformed with its precise reason, never
//   silently accepted as a gate.
// ==========================================
export type HumanReviewKind = 'image' | 'video' | 'link' | 'question';
export type HumanReviewState = 'ready' | 'settled' | 'missing' | 'malformed';
export type HumanReviewReason =
  | 'no_section'
  | 'no_artifact'
  | 'unknown_artifact'
  | 'duplicate_field'
  | 'missing_url'
  | 'invalid_url'
  | 'missing_instruction'
  | 'long_instruction'
  | 'missing_question'
  | 'question_answered';

export interface HumanReviewQuestion {
  index: number;
  answerIndex: number | null;
  text: string;
  options?: OpenQuestionOption[];
}

export interface HumanReviewView {
  state: HumanReviewState;
  kind: HumanReviewKind | null;
  url: string | null;
  instruction: string | null;
  question: HumanReviewQuestion | null;
  reason: HumanReviewReason | null;
  message: string;
}

export const HUMAN_REVIEW_INSTRUCTION_MAX = 200;
export const HUMAN_REVIEW_URL_MAX = 2048;
const HUMAN_REVIEW_KINDS: HumanReviewKind[] = ['image', 'video', 'link', 'question'];
// `- Artifact: image`. Only the three known names are fields; every other line
// inside the section is prose and is ignored.
const humanReviewFieldPattern = /^ {0,3}[-*+][ \t]+(artifact|url|instruction)[ \t]*:[ \t]*(.*)$/i;

function humanReviewView(
  state: HumanReviewState,
  reason: HumanReviewReason | null,
  message: string,
  fields: { kind?: HumanReviewKind | null; url?: string | null; instruction?: string | null; question?: HumanReviewQuestion | null } = {},
): HumanReviewView {
  return {
    state,
    kind: fields.kind ?? null,
    url: fields.url ?? null,
    instruction: fields.instruction ?? null,
    question: fields.question ?? null,
    reason,
    message,
  };
}

export function parseHumanReview(body: string | null | undefined): HumanReviewView {
  if (!body || typeof body !== 'string') {
    return humanReviewView('missing', 'no_section', 'The body has no "### Human Review:" section.');
  }
  const lines = scanBodyLines(body);
  let headingIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.fenced || line.indentedCode) continue;
    if (/^ {0,3}#{1,6}[ \t]+human[ \t]+review[ \t]*:?[ \t]*$/i.test(line.text)) headingIndex = i;
  }
  if (headingIndex < 0) {
    return humanReviewView('missing', 'no_section', 'The body has no "### Human Review:" section.');
  }

  const values: Record<string, string[]> = { artifact: [], url: [], instruction: [] };
  for (let i = headingIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.fenced || line.indentedCode) continue;
    if (/^ {0,3}#{1,6}[ \t]+/.test(line.text)) break;
    const match = humanReviewFieldPattern.exec(line.text);
    if (!match) continue;
    values[match[1].toLowerCase()].push(match[2].trim());
  }

  for (const name of ['artifact', 'url', 'instruction']) {
    if (values[name].length > 1) {
      return humanReviewView(
        'malformed',
        'duplicate_field',
        `The "### Human Review:" section repeats the "${name === 'url' ? 'URL' : name === 'artifact' ? 'Artifact' : 'Instruction'}:" field.`,
      );
    }
  }

  if (values.artifact.length === 0) {
    return humanReviewView(
      'malformed',
      'no_artifact',
      'The "### Human Review:" section has no "- Artifact: image | video | link | question" line.',
    );
  }
  const rawKind = values.artifact[0].toLowerCase();
  if (!(HUMAN_REVIEW_KINDS as string[]).includes(rawKind)) {
    return humanReviewView(
      'malformed',
      'unknown_artifact',
      `The "- Artifact:" value "${values.artifact[0]}" is not image, video, link or question.`,
    );
  }
  const kind = rawKind as HumanReviewKind;
  const url = values.url.length ? values.url[0] : '';
  const instruction = values.instruction.length ? values.instruction[0] : '';

  if (kind === 'question') {
    const questions = parseWebOpenQuestions(body);
    const pending = questions.find((question) => !question.completed) ?? null;
    if (!pending) {
      if (questions.length > 0) {
        return humanReviewView(
          'settled',
          'question_answered',
          'The open question for this artifact is already answered, so nothing is waiting on you.',
          { kind, question: null, instruction: instruction || null },
        );
      }
      return humanReviewView(
        'malformed',
        'missing_question',
        'A question artifact needs an unanswered "### Open Questions:" item in the body.',
        { kind },
      );
    }
    // Same identity the drawer and Decisions already use: `index` is the array
    // position, `answerIndex` the position among the still-open questions. The
    // artifact always points at the first open question, so its answerIndex is 0.
    const question: HumanReviewQuestion = {
      index: questions.indexOf(pending),
      answerIndex: 0,
      text: pending.text,
    };
    if (pending.options && pending.options.length) question.options = pending.options;
    return humanReviewView('ready', null, 'This task waits for one answer you can pick or type.', {
      kind,
      question,
      instruction: instruction || null,
    });
  }

  const kindPhrase = kind === 'image' ? 'An image' : `A ${kind}`;
  if (!url) {
    return humanReviewView(
      'malformed',
      'missing_url',
      `${kindPhrase} artifact needs a "- URL: https://..." line.`,
      { kind },
    );
  }
  if (url.length > HUMAN_REVIEW_URL_MAX || !/^https?:\/\/[^\s<>"'`\\]+$/i.test(url)) {
    return humanReviewView(
      'malformed',
      'invalid_url',
      `The "- URL:" value must be an http:// or https:// link of at most ${HUMAN_REVIEW_URL_MAX} characters.`,
      { kind, url },
    );
  }
  if (!instruction) {
    return humanReviewView(
      'malformed',
      'missing_instruction',
      `${kindPhrase} artifact needs a one-line "- Instruction: ..." line saying what to look at.`,
      { kind, url },
    );
  }
  if (instruction.length > HUMAN_REVIEW_INSTRUCTION_MAX) {
    return humanReviewView(
      'malformed',
      'long_instruction',
      `The "- Instruction:" line is longer than ${HUMAN_REVIEW_INSTRUCTION_MAX} characters.`,
      { kind, url },
    );
  }
  return humanReviewView('ready', null, 'This task waits for one click you can settle.', {
    kind,
    url,
    instruction,
  });
}

export function isHumanReviewGateStatus(status: string | null | undefined): boolean {
  return typeof status === 'string' && status.trim().toLowerCase() === 'status:needs-human';
}

// The message a rejected transition returns. It names the missing or broken
// artifact, so the caller knows what to add before retrying.
export function humanReviewGateMessage(view: HumanReviewView): string {
  const lead = 'A task can wait for you only with a clickable review artifact (a screenshot, a short video, a link, or a question with preset answers).';
  if (view.state === 'missing') {
    return `${lead} This body carries no artifact: add a "### Human Review:" section with "- Artifact: image | video | link | question", then its "- URL: https://..." and one-line "- Instruction: ..." (or an unanswered "### Open Questions:" item for a question).`;
  }
  if (view.state === 'settled') {
    return `${lead} ${view.message} Move this task back to the agent instead.`;
  }
  return `${lead} The artifact is malformed. ${view.message}`;
}

export interface WebHumanTask {
  index: number;
  lineIndex: number;
  completed: boolean;
  text: string;
  rawLine: string;
  charOffset: number;
}

export function parseWebHumanTasks(body: string | null | undefined): WebHumanTask[] {
  if (!body || typeof body !== 'string' || !body.includes('[')) return [];
  const cleanBody = body.startsWith('\uFEFF') ? body.slice(1) : body;
  if (!/human/i.test(cleanBody)) return [];
  const lines = scanBodyLines(body);
  let inHumanTasks = false;
  const tasks: WebHumanTask[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.fenced || line.indentedCode) continue;

    if (line.text.includes('#')) {
      const isHuman = humanTasksSectionRegex.test(line.text);
      if (isHuman || questionsSectionRegex.test(line.text) || headingRegex.test(line.text)) {
        inHumanTasks = isHuman;
        continue;
      }
    }

    if (inHumanTasks) {
      const m = checklistRegex.exec(line.text);
      if (m) {
        const charOffset = line.start + (line.hasBom ? 1 : 0) + m[1].length;
        tasks.push({
          index: tasks.length,
          lineIndex: i,
          completed: m[2].toLowerCase() === 'x',
          text: m[4].trim(),
          rawLine: line.text,
          charOffset,
        });
      }
    }
  }

  return tasks;
}

export function toggleHumanTaskInMarkdown(
  body: string,
  taskIndex: number,
  targetCompleted?: boolean,
): { newBody: string; task: WebHumanTask } {
  const tasks = parseWebHumanTasks(body);
  if (taskIndex < 0 || taskIndex >= tasks.length) {
    throw new BoardError('invalid', `Human task at index ${taskIndex} not found`);
  }
  const task = tasks[taskIndex];
  const nextCompleted = targetCompleted !== undefined ? Boolean(targetCompleted) : !task.completed;
  const nextChar = nextCompleted ? 'x' : ' ';

  if (
    task.charOffset < 0 ||
    task.charOffset >= body.length ||
    (body[task.charOffset] !== ' ' && body[task.charOffset] !== 'x' && body[task.charOffset] !== 'X')
  ) {
    throw new BoardError('invalid', 'Task checkbox character offset could not be validated safely');
  }

  const newBody = body.slice(0, task.charOffset) + nextChar + body.slice(task.charOffset + 1);
  return {
    newBody,
    task: { ...task, completed: nextCompleted },
  };
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

export type EffectiveStage =
  | 'draft'
  | 'backlog'
  | 'todo'
  | 'planned'
  | 'in-progress'
  | 'needs-human'
  | 'in-review'
  | 'done';

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
  effectiveStage: EffectiveStage;
  isExplicitDraft: boolean;
  phase: string;
  attention: string;
  column: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  closedAt: string | null;
  description: string;
  order: number | null;
  canvas: CanvasMarkerData | null;
  // The only artifact allowed to make this task wait for the human. Present on
  // every row so a card can show the reason when a legacy body carries none.
  humanReview?: HumanReviewView;
  fingerprint: string;
  id?: number | null;
  dependencies: number[];
  textDependencies?: number[];
  blockedBy?: Array<{
    id: number;
    number: number;
    title: string;
    state: string;
    repository?: string;
  }>;
  blocking?: Array<{
    id: number;
    number: number;
    title: string;
    state: string;
    repository?: string;
  }>;
  pendingItems: Array<{ text: string; completed: boolean }>;
  counts: {
    subtasks: { total: number; done: number };
    openQuestions: { total: number; open: number };
    humanTasks: { total: number; open: number };
  };
  // Every comment on the issue, straight from the GitHub payload already
  // fetched for the board. Scoped to comments on purpose: a per-issue comment
  // page for the whole board would cost one extra GitHub call per row.
  commentCount?: number;
  noteCount?: number;
  noteCountPartial?: boolean;
  openQuestions?: OpenQuestionView[];
  humanTasks?: Array<{ index: number; text: string; completed: boolean; lineIndex?: number }>;
  overview?: string;
}

export type IssueSummary = BoardListItem;

export interface OpenQuestionView {
  index: number;
  answerIndex: number | null;
  text: string;
  completed: boolean;
  // Present only when the question uses the `label :: gist :: details`
  // convention. Absent keeps the older single-text question shape intact.
  options?: OpenQuestionOption[];
}

export interface IssueDetail {
  id?: number | null;
  number: number;
  key: string;
  repository: BoardRepository | null;
  title: string;
  friendlyTitle?: string | null;
  state: 'open' | 'closed';
  htmlUrl: string;
  body: string;
  bodyMarkdown: string;
  canvas: CanvasMarkerData | null;
  humanReview?: HumanReviewView;
  fingerprint: string;
  labels: string[];
  statusLabel: string | null;
  effectiveStage: EffectiveStage;
  isExplicitDraft: boolean;
  phase: string;
  attention: string;
  column: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  closedAt: string | null;
  dependencies: number[];
  textDependencies?: number[];
  blockedBy?: Array<{
    id: number;
    number: number;
    title: string;
    state: string;
    repository?: string;
  }>;
  blocking?: Array<{
    id: number;
    number: number;
    title: string;
    state: string;
    repository?: string;
  }>;
  editableSections: Array<{ id: string; title: string; text: string }>;
  openQuestions: OpenQuestionView[];
  humanTasks: Array<{ index: number; text: string; completed: boolean; lineIndex?: number }>;
  acceptanceCriteria: Array<{ text: string; completed: boolean; lineIndex?: number }>;
  subtasks: Array<{ text: string; completed: boolean; lineIndex?: number }>;
  testPlan: {
    issue: Array<{ text: string; completed: boolean }>;
    batch: Array<{ text: string; completed: boolean }>;
  };
  // Agent-facing note surface. The GitHub comment remains the only stored copy:
  // these entries are read back from it, newest first.
  notes?: IssueNoteView[];
  noteCount?: number;
  noteCountPartial?: boolean;
  notesDegraded?: boolean;
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

export function isExplicitDraft(
  labelsOrIssue:
    | Array<string | { name?: string }>
    | { labels?: Array<string | { name?: string }> | null }
    | null
    | undefined,
): boolean {
  const labels = Array.isArray(labelsOrIssue)
    ? labelsOrIssue
    : (labelsOrIssue && Array.isArray(labelsOrIssue.labels) ? labelsOrIssue.labels : []);
  return labels.some((label) => {
    const norm = (typeof label === 'string' ? label : label?.name ?? '').trim().toLowerCase();
    return norm === 'status:draft' || norm === 'draft';
  });
}

const VALID_EFFECTIVE_STAGES = new Set<EffectiveStage>([
  'draft',
  'backlog',
  'todo',
  'planned',
  'in-progress',
  'needs-human',
  'in-review',
  'done',
]);

export function resolveEffectiveStage(issue: {
  state?: string | null;
  statusLabel?: string | null;
  labels?: Array<string | { name?: string }> | null;
}): EffectiveStage {
  const rawLabels = Array.isArray(issue?.labels)
    ? issue.labels.map((label) => (typeof label === 'string' ? label : label?.name ?? '')).filter(Boolean)
    : [];
  const computedStatusLabel = issue?.statusLabel !== undefined
    ? issue.statusLabel
    : statusLabelOf(rawLabels);

  if (issue?.state === 'closed' || computedStatusLabel === 'status:done') {
    return 'done';
  }
  if (computedStatusLabel && computedStatusLabel.startsWith('status:')) {
    const rawStage = computedStatusLabel.slice('status:'.length).toLowerCase() as EffectiveStage;
    if (VALID_EFFECTIVE_STAGES.has(rawStage)) {
      return rawStage;
    }
  }
  const normalizedLabels = rawLabels.map((label) => label.trim().toLowerCase());
  if (normalizedLabels.some((l) => ['in progress', 'in-progress', 'wip', 'doing'].includes(l))) {
    return 'in-progress';
  }
  if (normalizedLabels.some((l) => ['in review', 'in-review', 'review', 'needs-review'].includes(l))) {
    return 'in-review';
  }
  if (normalizedLabels.some((l) => ['needs-human', 'needs human', 'blocked', 'waiting'].includes(l))) {
    return 'needs-human';
  }
  if (normalizedLabels.some((l) => ['planned', 'ready'].includes(l))) {
    return 'planned';
  }
  if (normalizedLabels.some((l) => ['backlog', 'icebox', 'later'].includes(l))) {
    return 'backlog';
  }
  if (normalizedLabels.some((l) => l === 'draft')) {
    return 'draft';
  }
  return 'todo';
}

function countsOf(items: Array<{ completed: boolean }> = []) {
  return {
    total: items.length,
    done: items.filter((item) => item.completed).length,
    open: items.filter((item) => !item.completed).length,
  };
}

// One projection for both the board row and the drawer, so a question cannot
// render differently in Decisions and in the drawer.
function openQuestionViews(
  questions: ReturnType<typeof parseWebOpenQuestions>,
): OpenQuestionView[] {
  let answerIndex = 0;
  return questions.map((question, index) => {
    const view: OpenQuestionView = {
      index,
      answerIndex: question.completed ? null : answerIndex,
      text: question.text,
      completed: question.completed,
    };
    if (question.options && question.options.length) view.options = question.options;
    if (!question.completed) answerIndex += 1;
    return view;
  });
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
  const rawBody = issue.body ?? '';
  const questions = parseWebOpenQuestions(rawBody);
  const openQuestions = openQuestionViews(questions);
  const parsedHumanTasks = parseWebHumanTasks(rawBody);
  const humanTasks = (parsedHumanTasks.length > 0 ? parsedHumanTasks : (issue.humanTasks ?? [])).map((task, idx) => ({
    index: typeof (task as any).index === 'number' ? (task as any).index : idx,
    text: task.text,
    completed: task.completed,
    lineIndex: task.lineIndex,
  }));
  const friendly = parseFriendlyTitle(stripHiddenMarkers(issue.body), issue.title);
  const friendlyTitle = friendly.subtitle && friendly.title !== issue.title ? friendly.title : null;
  const sections = editableSections(stripHiddenMarkers(rawBody));
  const overview = sections.length > 0 ? sections[0].text : '';
  const statusLabel = statusLabelOf(labels);
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
    statusLabel,
    effectiveStage: resolveEffectiveStage({ state: issue.state, statusLabel, labels }),
    isExplicitDraft: isExplicitDraft(labels),
    phase: metadata.phase,
    attention: metadata.attention,
    column: resolveIssueColumn(issue),
    updatedAt: issue.updated_at ?? null,
    counts: {
      subtasks: countsOf(issue.subtasks),
      openQuestions: countsOf(questions),
      humanTasks: countsOf(humanTasks),
    },
    openQuestions,
    humanTasks,
    overview,
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
  const statusLabel = statusLabelOf(labels);
  const cleanBody = stripHiddenMarkers(issue.body ?? '');
  const questions = parseWebOpenQuestions(issue.body ?? '');
  const openQuestions = openQuestionViews(questions);
  const testPlan = parseTestPlan(issue.body);
  const friendly = parseFriendlyTitle(cleanBody, issue.title);
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
    body: cleanBody,
    bodyMarkdown: cleanBody,
    canvas: parseCanvasMarker(issue.body ?? ''),
    fingerprint: issueFingerprint(raw, repository),
    labels,
    statusLabel,
    effectiveStage: resolveEffectiveStage({ state: issue.state, statusLabel, labels }),
    isExplicitDraft: isExplicitDraft(labels),
    phase: metadata.phase,
    attention: metadata.attention,
    column: resolveIssueColumn(issue),
    updatedAt: issue.updated_at ?? null,
    createdAt: issue.created_at ?? null,
    closedAt: raw.closed_at ?? (issue as any).closed_at ?? null,
    editableSections: editableSections(cleanBody),
    openQuestions,
    humanTasks: (parseWebHumanTasks(issue.body ?? '').length > 0 ? parseWebHumanTasks(issue.body ?? '') : (issue.humanTasks ?? [])).map((task, idx) => ({
      index: typeof (task as any).index === 'number' ? (task as any).index : idx,
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
