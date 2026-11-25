// ==========================================
// Scope is a node, and the node lives in the URL
//
// One encoding, used by the renderer and by the inline script:
//
//   #board                 the default scope
//   #board/build/render    the scope whose node_key is build/render
//   #list/build/render     the flat view with that node marked Here
//
// node_key is already a `/`-separated path, so it is the path; each segment is
// percent-encoded so a key with a space or a `?` survives a round trip.
// ==========================================

import type { TreeRow } from './model.ts';

export type BoardView = 'board' | 'list';

export interface ScopeLocation {
  // null when the hash names no known view.
  view: BoardView | null;
  // null when the hash names no node (the tree's own scope).
  node_key: string | null;
}

const VIEWS: readonly string[] = ['board', 'list'];

export function encodeScopeKey(nodeKey: string | null): string {
  if (nodeKey === null || nodeKey === '') {
    return '';
  }
  return nodeKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function scopeHref(view: BoardView, nodeKey: string | null): string {
  const key = encodeScopeKey(nodeKey);
  return key === '' ? `#${view}` : `#${view}/${key}`;
}

export function parseHash(hash: string): ScopeLocation {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const parts = raw.split('/');
  const view = VIEWS.includes(parts[0] ?? '') ? (parts[0] as BoardView) : null;
  const rest = parts.slice(1).filter((segment) => segment !== '');
  let nodeKey: string | null = null;
  if (rest.length > 0) {
    try {
      nodeKey = rest.map((segment) => decodeURIComponent(segment)).join('/');
    } catch {
      nodeKey = null;
    }
  }
  return { view, node_key: nodeKey };
}

export interface ScopePath {
  // Ancestors first, the scope last. Empty for the tree's own scope.
  rows: TreeRow[];
}

export function findRowByKey(
  roots: readonly TreeRow[],
  nodeKey: string | null,
): TreeRow | null {
  if (nodeKey === null || nodeKey === '') {
    return null;
  }
  const walk = (rows: readonly TreeRow[]): TreeRow | null => {
    for (const row of rows) {
      if (row.node_key === nodeKey) {
        return row;
      }
      const found = walk(row.children);
      if (found !== null) {
        return found;
      }
    }
    return null;
  };
  return walk(roots);
}

// The path to the scope: every ancestor, the scope itself last.
export function scopePath(
  roots: readonly TreeRow[],
  nodeKey: string | null,
): TreeRow[] {
  if (nodeKey === null || nodeKey === '') {
    return [];
  }
  const path: TreeRow[] = [];
  const walk = (rows: readonly TreeRow[]): boolean => {
    for (const row of rows) {
      path.push(row);
      if (row.node_key === nodeKey || walk(row.children)) {
        return true;
      }
      path.pop();
    }
    return false;
  };
  return walk(roots) ? path : [];
}

// The rows a board shows at one scope: the children of the scope node, or the
// tree's top level for the tree's own scope.
export function scopeChildren(
  roots: readonly TreeRow[],
  nodeKey: string | null,
): TreeRow[] {
  if (nodeKey === null || nodeKey === '') {
    return [...roots];
  }
  const row = findRowByKey(roots, nodeKey);
  return row === null ? [] : row.children;
}
