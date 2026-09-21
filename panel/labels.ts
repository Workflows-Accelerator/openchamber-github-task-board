// ==========================================
// Label, Priority, Complexity & Sorting Helpers
// ==========================================

import type { ColumnId, TabId, Issue, SessionInfo, IssueGroup } from './types.js';

function extractWorktreeName(wt: any): string {
  if (!wt) return '';
  if (typeof wt === 'string') return wt;
  if (typeof wt === 'object') {
    return wt.name || wt.branch || wt.directory || '';
  }
  return '';
}

function checkVague(issue: { title?: string; body?: string; subtasks?: any[]; openQuestions?: any[]; labels?: any[] } | any): boolean {
  if (!issue) return true;
  const labels = (issue.labels || []).map((l: any) => (typeof l === 'string' ? l : l.name || '').toLowerCase());
  if (labels.includes('status:needs-alignment')) {
    return true;
  }
  const openQuestions = issue.openQuestions || [];
  const hasUnansweredQuestions = openQuestions.some((q: any) => !q.completed);
  if (hasUnansweredQuestions) {
    return true;
  }
  const body = issue.body || '';
  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
  const subtaskCount = (issue.subtasks || []).length;
  return subtaskCount === 0 && wordCount < 20;
}

function extractTheme(issue: Issue | any): string {
  if (!issue || !issue.labels || issue.labels.length === 0) return 'No Theme';
  for (const l of issue.labels) {
    const name = (typeof l === 'string' ? l : l.name || '').trim();
    if (name.toLowerCase().startsWith('theme:')) {
      const themeName = name.slice(6).trim();
      if (themeName) return themeName;
    }
  }
  for (const l of issue.labels) {
    const name = (typeof l === 'string' ? l : l.name || '').trim();
    const lower = name.toLowerCase();
    if (
      name &&
      !lower.startsWith('status:') &&
      !lower.startsWith('priority:') &&
      !lower.startsWith('complexity:') &&
      !lower.startsWith('theme:') &&
      !['archived', 'archive'].includes(lower)
    ) {
      return name;
    }
  }
  return 'No Theme';
}

// Status label constants for the 8-stage workflow model
export const STATUS_DRAFT = 'status:draft';
export const STATUS_BACKLOG = 'status:backlog';
export const STATUS_TODO = 'status:todo';
export const STATUS_PLANNED = 'status:planned';
export const STATUS_IN_PROGRESS = 'status:in-progress';
export const STATUS_NEEDS_HUMAN = 'status:needs-human';
export const STATUS_IN_REVIEW = 'status:in-review';
export const STATUS_DONE = 'status:done';

export const STATUS_LABELS = [
  STATUS_DRAFT,
  STATUS_BACKLOG,
  STATUS_TODO,
  STATUS_PLANNED,
  STATUS_IN_PROGRESS,
  STATUS_NEEDS_HUMAN,
  STATUS_IN_REVIEW,
  STATUS_DONE,
] as const;

export const STATUS_COLUMNS: ColumnId[] = [
  'draft',
  'backlog',
  'todo',
  'planned',
  'in-progress',
  'needs-human',
  'in-review',
  'done',
];

export interface StatusLabelMetadata {
  id: ColumnId;
  label: string;
  name: string;
  displayName: string;
  color: string;
  description: string;
}

export const STATUS_METADATA: Record<ColumnId, StatusLabelMetadata> = {
  'draft': {
    id: 'draft',
    label: STATUS_DRAFT,
    name: 'Draft',
    displayName: 'Draft',
    color: '#6e7681',
    description: 'Initial ideas or drafting phase requiring further clarification',
  },
  'backlog': {
    id: 'backlog',
    label: STATUS_BACKLOG,
    name: 'Backlog',
    displayName: 'Backlog',
    color: '#8b949e',
    description: 'Prioritized ideas and incoming work not yet scheduled',
  },
  'todo': {
    id: 'todo',
    label: STATUS_TODO,
    name: 'To Do',
    displayName: 'To Do',
    color: '#d29922',
    description: 'Well-formed work ready to be picked up',
  },
  'planned': {
    id: 'planned',
    label: STATUS_PLANNED,
    name: 'Planned',
    displayName: 'Planned',
    color: '#58a6ff',
    description: 'Scheduled or queued for execution',
  },
  'in-progress': {
    id: 'in-progress',
    label: STATUS_IN_PROGRESS,
    name: 'In Progress',
    displayName: 'In Progress',
    color: '#bc8cff',
    description: 'Actively being worked on by an agent or human',
  },
  'needs-human': {
    id: 'needs-human',
    label: STATUS_NEEDS_HUMAN,
    name: 'Needs Human',
    displayName: 'Needs Human',
    color: '#f85149',
    description: 'Blocked waiting on human permission, answers, or input',
  },
  'in-review': {
    id: 'in-review',
    label: STATUS_IN_REVIEW,
    name: 'In Review',
    displayName: 'In Review',
    color: '#3fb950',
    description: 'Execution finished and awaiting human review or PR validation',
  },
  'done': {
    id: 'done',
    label: STATUS_DONE,
    name: 'Done',
    displayName: 'Done',
    color: '#238636',
    description: 'Completed or closed',
  },
};

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

export function isIssueClosed(issue: Issue | any): boolean {
  if (!issue) return false;
  if (typeof issue.state === 'string' && issue.state.toLowerCase() === 'closed') {
    return true;
  }
  if (issue.state_reason === 'completed') {
    return true;
  }
  const labelNames = (issue.labels || []).map((l: any) => (typeof l === 'string' ? l : l.name || '').toLowerCase());
  if (
    labelNames.includes('status:done') ||
    labelNames.includes('status:closed') ||
    labelNames.includes('closed') ||
    labelNames.includes('done')
  ) {
    return true;
  }
  return false;
}

export function resolveIssueColumn(
  issue: Issue | any,
  sessionOrList?: SessionInfo | SessionInfo[] | null
): ColumnId | null {
  if (!issue) return null;
  if (isIssueClosed(issue)) {
    return 'done';
  }

  const labelNames = (issue.labels || []).map((l: any) => (typeof l === 'string' ? l : l.name || '').toLowerCase());
  if (labelNames.includes('status:done')) return 'done';
  if (labelNames.includes('status:in-review')) return 'in-review';
  if (labelNames.includes('status:needs-human')) return 'needs-human';

  // Check attached session activity
  let session: SessionInfo | null = null;
  if (sessionOrList) {
    if (Array.isArray(sessionOrList)) {
      const issueNumStr = String(issue.number);
      session =
        sessionOrList.find((s) => {
          if (
            s.items &&
            s.items.some(
              (it) =>
                it.id === issueNumStr ||
                (it.data && it.data.issueNumber === issue.number) ||
                (it.data && Array.isArray(it.data.issueNumbers) && it.data.issueNumbers.includes(issue.number))
            )
          ) {
            return true;
          }
          if (
            s.data &&
            (s.data.issueNumber === issue.number ||
              (Array.isArray(s.data.issueNumbers) && s.data.issueNumbers.includes(issue.number)))
          ) {
            return true;
          }
          if (s.title && s.title.includes(`#${issue.number}`)) {
            return true;
          }
          const wtStrings = typeof s.worktree === 'string'
            ? [s.worktree]
            : s.worktree
            ? [s.worktree.name, s.worktree.branch, s.worktree.directory].filter(Boolean)
            : [];
          if (wtStrings.some((str: any) => String(str).includes(`issue-${issue.number}`))) {
            return true;
          }
          return false;
        }) || null;
    } else {
      session = sessionOrList;
    }
  }

  const isSessionRunning = Boolean(session && session.activity === 'running');
  const isSessionWaiting = Boolean(
    session &&
      (session.activity === 'waiting-permission' ||
        session.activity === 'waiting-question' ||
        session.activity.startsWith('waiting'))
  );
  const isSessionIdle = Boolean(session && session.activity === 'idle');

  // Explicit status:in-progress label
  if (labelNames.includes('status:in-progress')) {
    if (isSessionIdle) {
      return 'in-review';
    }
    if (isSessionWaiting) {
      return 'needs-human';
    }
    return 'in-progress';
  }

  // Explicit status:planned label
  if (labelNames.includes('status:planned')) {
    if (isSessionRunning) {
      return 'in-progress';
    }
    if (isSessionWaiting) {
      return 'needs-human';
    }
    return 'planned';
  }

  // Explicit status:todo label
  if (labelNames.includes('status:todo')) {
    if (isSessionRunning) {
      return 'in-progress';
    }
    if (isSessionWaiting) {
      return 'needs-human';
    }
    return 'todo';
  }

  // Explicit status:backlog label
  if (labelNames.includes('status:backlog')) {
    if (isSessionRunning) {
      return 'in-progress';
    }
    if (isSessionWaiting) {
      return 'needs-human';
    }
    return 'backlog';
  }

  // Explicit status:draft or isVagueIdea(issue)
  if (labelNames.includes('status:draft') || checkVague(issue)) {
    if (isSessionRunning) {
      return 'in-progress';
    }
    if (isSessionWaiting) {
      return 'needs-human';
    }
    return 'draft';
  }

  // Dynamic session detection for issues without explicit status labels
  if (session) {
    if (isSessionRunning) {
      return 'in-progress';
    }
    if (isSessionWaiting) {
      return 'needs-human';
    }
    if (isSessionIdle) {
      return 'in-review';
    }
  }

  // Default for unlabelled well-formed issues -> 'todo'
  return 'todo';
}

export function resolveDefaultTab(
  issues: Issue[],
  sessionOrList?: SessionInfo | SessionInfo[] | null
): TabId {
  if (!issues || issues.length === 0) return 'all';

  const hasNeedsHuman = issues.some((i) => resolveIssueColumn(i, sessionOrList) === 'needs-human');
  if (hasNeedsHuman) return 'needs-human';

  const hasReview = issues.some((i) => resolveIssueColumn(i, sessionOrList) === 'in-review');
  if (hasReview) return 'in-review';

  const hasProgress = issues.some((i) => resolveIssueColumn(i, sessionOrList) === 'in-progress');
  if (hasProgress) return 'in-progress';

  const hasTodo = issues.some((i) => resolveIssueColumn(i, sessionOrList) === 'todo');
  if (hasTodo) return 'todo';

  const hasPlanned = issues.some((i) => resolveIssueColumn(i, sessionOrList) === 'planned');
  if (hasPlanned) return 'planned';

  const hasBacklog = issues.some((i) => resolveIssueColumn(i, sessionOrList) === 'backlog');
  if (hasBacklog) return 'backlog';

  const hasDraft = issues.some((i) => resolveIssueColumn(i, sessionOrList) === 'draft');
  if (hasDraft) return 'draft';

  return 'all';
}

export function groupIssuesBy(
  issuesList: Issue[],
  groupBy: string,
  sessionOrList?: SessionInfo | SessionInfo[] | null
): IssueGroup[] {
  if (groupBy === 'priority') {
    const groups: IssueGroup[] = [
      { id: 'critical', title: 'Critical', issues: [] },
      { id: 'important', title: 'Important', issues: [] },
      { id: 'useful', title: 'Useful', issues: [] },
      { id: 'optional', title: 'Optional', issues: [] },
      { id: 'none', title: 'No Priority', issues: [] },
    ];
    const map = new Map(groups.map((g) => [g.id, g]));
    for (const issue of issuesList) {
      const p = getIssuePriority(issue) || 'none';
      map.get(p)?.issues.push(issue);
    }
    return groups;
  }

  if (groupBy === 'theme' || groupBy === 'tag') {
    const map = new Map<string, IssueGroup>();
    for (const issue of issuesList) {
      const theme = extractTheme(issue);
      if (!map.has(theme)) {
        map.set(theme, { id: theme, title: theme, issues: [] });
      }
      map.get(theme)!.issues.push(issue);
    }
    if (map.size === 0) {
      map.set('No Theme', { id: 'No Theme', title: 'No Theme', issues: [] });
    }
    return Array.from(map.values());
  }

  // Default: groupBy === 'status' -> 8-stage columns in canonical order:
  // Draft | Backlog | To Do | Planned | In Progress | Needs Human | Review | Done
  const groups: IssueGroup[] = [
    { id: 'draft', title: 'Draft', issues: [] },
    { id: 'backlog', title: 'Backlog', issues: [] },
    { id: 'todo', title: 'To Do', issues: [] },
    { id: 'planned', title: 'Planned', issues: [] },
    { id: 'in-progress', title: 'In Progress', issues: [] },
    { id: 'needs-human', title: 'Needs Human', issues: [] },
    { id: 'in-review', title: 'In Review', issues: [] },
    { id: 'done', title: 'Done', issues: [] },
  ];
  const map = new Map(groups.map((g) => [g.id, g]));
  for (const issue of issuesList) {
    const col = resolveIssueColumn(issue, sessionOrList);
    if (col && map.has(col)) {
      map.get(col)!.issues.push(issue);
    }
  }
  return groups;
}

export interface StatusReconcilerOptions {
  debounceMs?: number;
  updateStatus: (issue: Issue, targetColumn: ColumnId) => Promise<void>;
  getSession?: (issue: Issue) => SessionInfo | null;
  onReconciled?: (issue: Issue, targetColumn: ColumnId) => void;
}

export class StatusReconciler {
  private inFlight = new Set<string>();
  private lastReconciled = new Map<string, ColumnId>();
  private timer: any = null;
  private debounceMs: number;
  private updateStatus: (issue: Issue, targetColumn: ColumnId) => Promise<void>;
  private getSession?: (issue: Issue) => SessionInfo | null;
  private onReconciled?: (issue: Issue, targetColumn: ColumnId) => void;

  constructor(options: StatusReconcilerOptions) {
    this.debounceMs = options.debounceMs ?? 300;
    this.updateStatus = options.updateStatus;
    this.getSession = options.getSession;
    this.onReconciled = options.onReconciled;
  }

  // Repo-qualified key so two same-numbered issues in different repositories
  // are tracked independently and never block or overwrite each other.
  private keyFor(issue: Issue | any): string {
    const repo = issue && typeof issue.repo === 'string' ? issue.repo.trim().toLowerCase() : '';
    if (repo && Number.isFinite(issue?.number)) return `${repo}#${issue.number}`;
    return `#${issue?.number}`;
  }

  public schedule(issues: Issue[]): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.reconcile(issues);
    }, this.debounceMs);
  }

  public async reconcile(issues: Issue[]): Promise<Array<{ issueNumber: number; target: ColumnId }>> {
    const reconciled: Array<{ issueNumber: number; target: ColumnId }> = [];
    if (!issues || !Array.isArray(issues)) return reconciled;

    for (const issue of issues) {
      if (!issue || !issue.number) continue;

      const session = this.getSession ? this.getSession(issue) : null;
      // Only reconcile when a live session state implies a transition
      if (!session) continue;

      const targetCol = resolveIssueColumn(issue, session);
      if (!targetCol) continue;
      if (issue.state === 'closed' && targetCol === 'done') continue;

      const currentLabels = (issue.labels || []).map((l: any) =>
        (typeof l === 'string' ? l : l.name || '').toLowerCase()
      );
      const currentStatus = currentLabels
        .find((n: string) => n.startsWith('status:'))
        ?.replace('status:', '')
        .trim();

      // If current label already matches target, nothing to reconcile
      if (currentStatus === targetCol) continue;

      // Prevent race conditions and loops
      const key = this.keyFor(issue);
      if (this.inFlight.has(key)) continue;
      if (this.lastReconciled.get(key) === targetCol) continue;

      this.inFlight.add(key);
      this.lastReconciled.set(key, targetCol);

      try {
        await this.updateStatus(issue, targetCol);
        reconciled.push({ issueNumber: issue.number, target: targetCol });
        this.onReconciled?.(issue, targetCol);
      } catch (err) {
        this.lastReconciled.delete(key);
      } finally {
        this.inFlight.delete(key);
      }
    }

    return reconciled;
  }

  public clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.inFlight.clear();
    this.lastReconciled.clear();
  }

  public isInFlight(issueOrNumber: Issue | number): boolean {
    const key = typeof issueOrNumber === 'number' ? `#${issueOrNumber}` : this.keyFor(issueOrNumber);
    return this.inFlight.has(key);
  }

  public getLastReconciled(issueOrNumber: Issue | number): ColumnId | undefined {
    const key = typeof issueOrNumber === 'number' ? `#${issueOrNumber}` : this.keyFor(issueOrNumber);
    return this.lastReconciled.get(key);
  }
}
