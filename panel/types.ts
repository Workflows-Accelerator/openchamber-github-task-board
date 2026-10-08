// ==========================================
// Types & Domain Interfaces
// ==========================================

export type {
  Subtask,
  TestItem,
  Issue,
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  RectLike,
  ProjectItem,
  IssueGroup,
} from './core.js';

export interface SessionInfo {
  id: string;
  title: string;
  activity: string;
  outcome?: string | null;
  worktree?: string | { name?: string; branch?: string; directory?: string; status?: string } | null;
  directory?: string | null;
  items?: Array<{ id?: string; providerId?: string; data?: any; url?: string }>;
  data?: any;
}

export function extractWorktreeName(wt: any): string {
  if (!wt) return '';
  if (typeof wt === 'string') return wt;
  if (typeof wt === 'object') {
    return wt.name || wt.branch || wt.directory || '';
  }
  return '';
}

export type ColumnId = 'draft' | 'backlog' | 'todo' | 'planned' | 'in-progress' | 'needs-human' | 'in-review' | 'done';
export type TabId = 'all' | ColumnId;

export type NewIssueMode = 'ai' | 'manual';
