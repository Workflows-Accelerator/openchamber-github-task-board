// ==========================================
// Types & Domain Interfaces
// ==========================================

import type { Issue } from './core.js';

export type {
  Subtask,
  Issue,
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  RectLike,
} from './core.js';

export interface SessionInfo {
  id: string;
  title: string;
  activity: string;
  outcome?: string | null;
  worktree?: string | { name?: string; branch?: string; directory?: string; status?: string } | null;
  directory?: string | null;
  items?: Array<{ id?: string; providerId?: string; data?: any; url?: string }>;
}

export function extractWorktreeName(wt: any): string {
  if (!wt) return '';
  if (typeof wt === 'string') return wt;
  if (typeof wt === 'object') {
    return wt.name || wt.branch || wt.directory || '';
  }
  return '';
}

export interface ProjectItem {
  id: string;
  name: string;
  directory: string;
  gitRepo: { owner: string; repo: string } | null;
  linkedRepo: string | null;
}

export type ColumnId = 'backlog' | 'todo' | 'in-progress' | 'in-review' | 'done';
export type TabId = 'all' | ColumnId;

export interface IssueGroup {
  id: string;
  title: string;
  issues: Issue[];
}

export type NewIssueMode = 'ai' | 'manual';
