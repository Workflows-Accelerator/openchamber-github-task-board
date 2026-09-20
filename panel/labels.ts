// ==========================================
// Label, Priority, Complexity & Sorting Helpers
// ==========================================

import type { Issue } from './types.js';

export function isSystemLabel(labelName: string): boolean {
  if (!labelName || typeof labelName !== 'string') return false;
  const lower = labelName.trim().toLowerCase();
  return (
    lower.startsWith('status:') ||
    lower.startsWith('priority:') ||
    lower.startsWith('complexity:') ||
    lower.startsWith('theme:') ||
    lower === 'archived' ||
    lower === 'archive'
  );
}

export function filterDisplayLabels(
  labels: Array<{ name: string; color?: string }>
): Array<{ name: string; color?: string }> {
  if (!labels || !Array.isArray(labels)) return [];
  return labels.filter((l) => !isSystemLabel(typeof l === 'string' ? l : l.name || ''));
}

export function getIssuePriority(issue: Issue): string | null {
  if (!issue || !issue.labels) return null;
  for (const l of issue.labels) {
    const name = (typeof l === 'string' ? l : l.name || '').toLowerCase();
    if (name === 'priority:critical') return 'critical';
    if (name === 'priority:important') return 'important';
    if (name === 'priority:useful') return 'useful';
    if (name === 'priority:optional') return 'optional';
  }
  return null;
}

export function updatePriorityLabels(currentLabels: any[], newPriority: string | null): string[] {
  const cleanExisting = currentLabels
    .map((l) => (typeof l === 'string' ? l : l.name || ''))
    .filter((name) => !name.toLowerCase().startsWith('priority:'));

  if (newPriority && typeof newPriority === 'string' && newPriority.trim().toLowerCase() !== 'none') {
    cleanExisting.push(`priority:${newPriority.trim().toLowerCase()}`);
  }
  return cleanExisting;
}

export function getIssueComplexity(issue: Issue): string | null {
  if (!issue || !issue.labels) return null;
  for (const l of issue.labels) {
    const name = (typeof l === 'string' ? l : l.name || '').toLowerCase();
    if (name === 'complexity:xl') return 'XL';
    if (name === 'complexity:l') return 'L';
    if (name === 'complexity:m') return 'M';
    if (name === 'complexity:s') return 'S';
    if (name === 'complexity:xs') return 'XS';
  }
  return null;
}

export function updateComplexityLabel(currentLabels: any[], newComplexity: string | null): string[] {
  const cleanExisting = currentLabels
    .map((l) => (typeof l === 'string' ? l : l.name || ''))
    .filter((name) => !name.toLowerCase().startsWith('complexity:'));

  if (newComplexity && typeof newComplexity === 'string' && newComplexity.trim().toLowerCase() !== 'none') {
    cleanExisting.push(`complexity:${newComplexity.trim().toUpperCase()}`);
  }
  return cleanExisting;
}

const PRIORITY_WEIGHTS: Record<string, number> = { critical: 4, important: 3, useful: 2, optional: 1 };
const COMPLEXITY_WEIGHTS: Record<string, number> = { XL: 5, L: 4, M: 3, S: 2, XS: 1 };

export function sortIssuesList(list: Issue[], sortKey: string): Issue[] {
  const copy = [...list];
  switch (sortKey) {
    case 'newest':
      return copy.sort((a, b) => b.number - a.number);
    case 'oldest':
      return copy.sort((a, b) => a.number - b.number);
    case 'priority':
      return copy.sort((a, b) => {
        const pA = PRIORITY_WEIGHTS[getIssuePriority(a) || ''] || 0;
        const pB = PRIORITY_WEIGHTS[getIssuePriority(b) || ''] || 0;
        return pB !== pA ? pB - pA : b.number - a.number;
      });
    case 'complexity':
      return copy.sort((a, b) => {
        const cA = COMPLEXITY_WEIGHTS[getIssueComplexity(a) || ''] || 0;
        const cB = COMPLEXITY_WEIGHTS[getIssueComplexity(b) || ''] || 0;
        return cB !== cA ? cB - cA : b.number - a.number;
      });
    case 'subtasks':
      return copy.sort((a, b) => {
        const remA = a.subtasks.filter((s) => !s.completed).length;
        const remB = b.subtasks.filter((s) => !s.completed).length;
        return remB !== remA ? remB - remA : b.number - a.number;
      });
    case 'title':
      return copy.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    default:
      return copy;
  }
}

export function findRelatedIssues(targetIssue: Issue, allIssues: Issue[], limit = 4): Issue[] {
  if (!targetIssue || !allIssues) return [];
  const targetNum = targetIssue.number;
  const targetLabels = new Set(
    (targetIssue.labels || [])
      .map((l) => (typeof l === 'string' ? l : l.name || '').toLowerCase())
      .filter((n) => !n.startsWith('status:') && n !== 'archived')
  );
  const targetWords = new Set(
    (targetIssue.title || '')
      .toLowerCase()
      .split(/[^a-z0-9_-]+/)
      .filter((w) => w.length > 3)
  );

  const scored: Array<{ issue: Issue; score: number }> = [];
  for (const other of allIssues) {
    if (other.number === targetNum) continue;

    let score = 0;
    const otherLabels = (other.labels || []).map((l) => (typeof l === 'string' ? l : l.name || '').toLowerCase());
    for (const l of otherLabels) {
      if (targetLabels.has(l)) score += 3;
    }

    const otherText = `${other.title || ''} ${other.body || ''}`;
    if (otherText.includes(`#${targetNum}`)) score += 5;
    const targetText = `${targetIssue.title || ''} ${targetIssue.body || ''}`;
    if (targetText.includes(`#${other.number}`)) score += 5;

    const otherWords = (other.title || '').toLowerCase().split(/[^a-z0-9_-]+/);
    for (const w of otherWords) {
      if (w.length > 3 && targetWords.has(w)) score += 1;
    }

    if (score > 0) {
      scored.push({ issue: other, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || b.issue.number - a.issue.number)
    .slice(0, limit)
    .map((s) => s.issue);
}
