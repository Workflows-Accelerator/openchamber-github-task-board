// ==========================================
// Containment counts and lane planning
//
// The engine prints a tree, not a summary. "N inside · M done" and the global
// "1 of 7 finished" are rolled up here, from `children`, once per render.
// Nothing in this module reads `counts` from the read model: those are the
// engine's own per-state totals over every placed row, which is a different
// question from "what is under this task".
// ==========================================

import type { RestState, TreeRow } from './model.ts';

export interface Containment {
  // Descendants, not including the row itself.
  inside: number;
  done: number;
}

export interface Progress {
  done: number;
  total: number;
}

export function containment(row: TreeRow): Containment {
  let inside = 0;
  let done = 0;
  const walk = (rows: readonly TreeRow[]): void => {
    for (const child of rows) {
      inside += 1;
      if (child.rest_state === 'done') {
        done += 1;
      }
      walk(child.children);
    }
  };
  walk(row.children);
  return { inside, done };
}

// Every placed row, the roots included: the header's denominator is the tree,
// not the top level.
export function progress(roots: readonly TreeRow[]): Progress {
  let total = 0;
  let done = 0;
  const walk = (rows: readonly TreeRow[]): void => {
    for (const row of rows) {
      total += 1;
      if (row.rest_state === 'done') {
        done += 1;
      }
      walk(row.children);
    }
  };
  walk(roots);
  return { done, total };
}

// The order the lanes are drawn in: the work moves left to right. `failed`,
// `cancelled` and `skipped` sit after `done` and are almost always empty, so
// they cost nothing until the engine produces one.
export const LANE_ORDER: readonly RestState[] = [
  'draft',
  'ready',
  'waiting',
  'blocked',
  'done',
  'failed',
  'cancelled',
  'skipped',
];

export const STATE_WORDS: Record<RestState, string> = {
  draft: 'Draft',
  ready: 'Ready to start',
  waiting: 'Waiting on review',
  blocked: "Can't start yet",
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
  skipped: 'Skipped',
};

export type LaneState = RestState | 'unknown';

export interface Lane {
  state: LaneState;
  cards: TreeRow[];
}

export interface LanePlan {
  // Only lanes that hold a card. An empty lane is never drawn.
  lanes: Lane[];
  // Lanes that exist in the vocabulary and hold nothing, so the page can say
  // it once.
  empty: number;
}

export function lanePlan(rows: readonly TreeRow[]): LanePlan {
  const known = new Set<string>(LANE_ORDER);
  const cards = [...rows];
  const lanes: Lane[] = [];
  for (const state of LANE_ORDER) {
    const inLane = cards.filter((row) => row.rest_state === state);
    if (inLane.length > 0) {
      lanes.push({ state, cards: inLane });
    }
  }
  const unknown = cards.filter((row) => !known.has(row.rest_state));
  let total = LANE_ORDER.length;
  if (unknown.length > 0) {
    lanes.push({ state: 'unknown', cards: unknown });
    total += 1;
  }
  return { lanes, empty: total - lanes.length };
}

// Blockers the read can see and that are not done. A blocker outside the read
// is not evidence of a disagreement, so it is not counted here; the card still
// names it from the edge ref.
export function unsatisfiedBlockers(
  row: TreeRow,
  byId: ReadonlyMap<string, TreeRow>,
): TreeRow[] {
  const unsatisfied: TreeRow[] = [];
  for (const ref of row.blocked_by) {
    const blocker = byId.get(ref.task_id);
    if (blocker !== undefined && blocker.rest_state !== 'done') {
      unsatisfied.push(blocker);
    }
  }
  return unsatisfied;
}

// Ruling 6: a `ready` row with an unsatisfied `blocked_by` is the engine's
// current defect (R-2), not the board's mistake. The board keeps the engine's
// word and states the disagreement beside it. When the engine stops producing
// this combination the notice disappears on its own, which is the check.
export function engineDisagreement(
  row: TreeRow,
  byId: ReadonlyMap<string, TreeRow>,
): TreeRow | null {
  if (row.rest_state !== 'ready') {
    return null;
  }
  return unsatisfiedBlockers(row, byId)[0] ?? null;
}
