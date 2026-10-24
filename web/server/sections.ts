// ==========================================
// Byte-preserving Markdown section editing.
//
// Only the Overview prose is writable. Every other byte of the issue body
// (checklists, questions, human tasks, test plans, trailing whitespace) is
// passed through untouched. Open-question answers reuse panel/core.ts.
// ==========================================

import { STATUS_LABELS } from '../../panel/labels.ts';

export class SectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SectionError';
  }
}

export interface Section {
  id: string;
  title: string;
  level: number;
  headingLine: number;
  startLine: number;
  endLine: number;
  text: string;
  editable: boolean;
}

const statusSet = new Set<string>(STATUS_LABELS as readonly string[]);
const headingPattern = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*$/;
const fencePattern = /^ {0,3}(`{3,}|~{3,})/;
const closeFencePattern = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const overviewTitlePattern = /^(?:overview|summary|description|context|background|goals?)$/i;

function slugifyHeading(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[`*_~]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

function trimRange(lines: string[], start: number, end: number): string[] {
  let from = start;
  let to = end;
  while (from < to && lines[from].trim() === '') from += 1;
  while (to > from && lines[to - 1].trim() === '') to -= 1;
  return lines.slice(from, to);
}

export function findSections(body: string): Section[] {
  if (typeof body !== 'string') return [];
  const cleanBody = body.startsWith('\uFEFF') ? body.slice(1) : body;
  const lines = cleanBody.split(/\r?\n/);
  const headings: Array<{ line: number; level: number; title: string }> = [];

  let inFence = false;
  let fenceChar = '';
  let fenceLen = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const cleanLine = lines[index].replace(/\r$/, '');
    if (!inFence) {
      const fenceMatch = fencePattern.exec(cleanLine);
      if (fenceMatch) {
        inFence = true;
        fenceChar = fenceMatch[1][0];
        fenceLen = fenceMatch[1].length;
        continue;
      }
      const match = headingPattern.exec(cleanLine);
      if (match) {
        headings.push({ line: index, level: match[1].length, title: match[2] });
      }
    } else {
      const fenceMatch = closeFencePattern.exec(cleanLine);
      if (fenceMatch && fenceMatch[1][0] === fenceChar && fenceMatch[1].length >= fenceLen) {
        inFence = false;
      }
    }
  }

  const sections: Section[] = [];
  const usedIds = new Set<string>();

  const firstHeadingLine = headings.length > 0 ? headings[0].line : lines.length;
  const preambleLines = lines.slice(0, firstHeadingLine);
  const preambleText = trimRange(lines, 0, firstHeadingLine).join('\n');
  const hasPreamble = preambleText.trim() !== '';

  const isPreambleAmbiguous =
    preambleLines.some((l) => /^ {0,3}(?:`{3,}|~{3,}|#{1,6})/.test(l.replace(/\r$/, '')));

  if (hasPreamble) {
    usedIds.add('overview');
    sections.push({
      id: 'overview',
      title: '(overview)',
      level: 0,
      headingLine: -1,
      startLine: 0,
      endLine: firstHeadingLine,
      text: preambleText,
      editable: !isPreambleAmbiguous,
    });
  }

  headings.forEach((heading, index) => {
    const end = index + 1 < headings.length ? headings[index + 1].line : lines.length;
    const text = trimRange(lines, heading.line + 1, end).join('\n');
    const isOverviewHeading =
      !hasPreamble && index === 0 && overviewTitlePattern.test(heading.title.trim());
    let id = isOverviewHeading ? 'overview' : slugifyHeading(heading.title);
    if (usedIds.has(id)) {
      let suffix = 2;
      while (usedIds.has(`${id}-${suffix}`)) suffix += 1;
      id = `${id}-${suffix}`;
    }
    usedIds.add(id);
    sections.push({
      id,
      title: heading.title,
      level: heading.level,
      headingLine: heading.line,
      startLine: heading.line + 1,
      endLine: end,
      text,
      editable: isOverviewHeading,
    });
  });

  return sections;
}

export function editableSections(body: string): Array<{ id: string; title: string; text: string }> {
  return findSections(body)
    .filter((section) => section.editable)
    .map((section) => ({ id: section.id, title: section.title, text: section.text }));
}

function withEol(lines: string[], eol: string): string[] {
  if (eol !== '\r\n') return lines;
  return lines.map((line) => (line.endsWith('\r') ? line : `${line}\r`));
}

function replaceRange(
  lines: string[],
  start: number,
  end: number,
  textLines: string[],
  eol: string,
): string[] {
  const range = lines.slice(start, end);
  let trailingBlanks = 0;
  for (let index = range.length - 1; index >= 0; index -= 1) {
    if (range[index].trim() !== '') break;
    trailingBlanks += 1;
  }
  const blankLines = new Array<string>(Math.max(trailingBlanks, 1)).fill('');
  const replacement = [...withEol(textLines, eol), ...withEol(blankLines, eol)];
  lines.splice(start, end - start, ...replacement);
  return lines;
}

export function replaceSectionText(body: string, sectionId: string, text: unknown): string {
  if (typeof text !== 'string') {
    throw new SectionError('section text must be a string');
  }
  if (typeof body !== 'string') {
    throw new SectionError('issue body must be a string');
  }
  if (body.startsWith('\uFEFF')) {
    return '\uFEFF' + replaceSectionText(body.slice(1), sectionId, text);
  }
  const eol = body.includes('\r\n') ? '\r\n' : '\n';
  const textLines = text.replace(/\r\n?/g, '\n').split('\n');
  const lines = body.split('\n');

  const section = findSections(body).find((candidate) => candidate.id === sectionId);
  if (section) {
    if (!section.editable) {
      throw new SectionError(`section ${sectionId} is not editable`);
    }
    const from = section.headingLine === -1 ? 0 : section.headingLine + 1;
    return replaceRange(lines, from, section.endLine, textLines, eol).join('\n');
  }

  if (sectionId !== 'overview') {
    throw new SectionError(`section ${sectionId} is not editable`);
  }

  // No overview exists yet: insert one at the top of the body.
  const block = withEol([...textLines, ''], eol);
  if (body === '') return withEol([...textLines, ''], eol).join('\n');
  return [...block, ...lines].join('\n');
}

export function isStatusLabel(name: string): boolean {
  return statusSet.has(name.trim().toLowerCase());
}

export function setStatusLabel(
  labels: ReadonlyArray<string>,
  status: string | null,
): string[] {
  if (!Array.isArray(labels)) {
    throw new SectionError('labels must be an array');
  }
  if (status !== null) {
    if (typeof status !== 'string' || !statusSet.has(status)) {
      throw new SectionError('status is not part of the agreed status label set');
    }
  }
  const kept = labels
    .filter((label) => typeof label === 'string')
    .filter((label) => !isStatusLabel(label));
  if (status !== null) kept.push(status);
  return kept;
}
