// ==========================================
// Containment counts and lane planning
//
// The engine prints a tree, not a summary. "N inside · M done" and the global
// "1 of 7 done · 2 skipped" are rolled up here, from `children`, once per render.
// Nothing in this module reads `counts` from the read model: those are the
// engine's own per-state totals over every placed row, which is a different
// question from "what is under this task".
// ==========================================

import type { RestState, TreeRow } from './model.ts';

export interface Containment {
  // Live descendants, not including the row itself. An archived descendant is
  // named in `archived`, never counted as live work.
  inside: number;
  done: number;
  archived: number;
}

export interface Progress {
  done: number;
  failed: number;
  cancelled: number;
  skipped: number;
  total: number;
  archived: number;
}

export function containment(row: TreeRow): Containment {
  let inside = 0;
  let done = 0;
  let archived = 0;
  const walk = (rows: readonly TreeRow[]): void => {
    for (const child of rows) {
      if (child.archived_at !== null) {
        archived += 1;
      } else {
        inside += 1;
        if (child.rest_state === 'done') {
          done += 1;
        }
      }
      walk(child.children);
    }
  };
  walk(row.children);
  return { inside, done, archived };
}

// Every live placed row, the roots included: the header's denominator is the
// tree, not the top level. Archived rows are counted apart so the denominator
// is live work only.
export function progress(roots: readonly TreeRow[]): Progress {
  let total = 0;
  let done = 0;
  let failed = 0;
  let cancelled = 0;
  let skipped = 0;
  let archived = 0;
  const walk = (rows: readonly TreeRow[]): void => {
    for (const row of rows) {
      if (row.archived_at !== null) {
        archived += 1;
      } else {
        total += 1;
        if (row.rest_state === 'done') done += 1;
        else if (row.rest_state === 'failed') failed += 1;
        else if (row.rest_state === 'cancelled') cancelled += 1;
        else if (row.rest_state === 'skipped') skipped += 1;
      }
      walk(row.children);
    }
  };
  walk(roots);
  return { done, failed, cancelled, skipped, total, archived };
}

// The one progress sentence both views print. The numerator is `done`, never
// `finished`: absorbing failed or skipped work into "finished" would be the
// board making a verdict the engine did not. The other settled states are
// named beside it, in lane order, so a reader can subtract and see what is
// left. Archived rows are a separate class, never part of the denominator.
export function progressText(p: Progress): string {
  if (p.total === 0) {
    return p.archived > 0
      ? `No live tasks · ${p.archived} archived`
      : 'No tasks in this tree';
  }
  let line = `${p.done} of ${p.total} done`;
  if (p.failed > 0) line += ` · ${p.failed} failed`;
  if (p.cancelled > 0) line += ` · ${p.cancelled} cancelled`;
  if (p.skipped > 0) line += ` · ${p.skipped} skipped`;
  if (p.archived > 0) line += ` · ${p.archived} archived`;
  return line;
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
  waiting: 'Waiting on a verdict',
  blocked: "Can't start yet",
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
  skipped: 'Skipped',
};

// The three counts the Board puts above its lanes. They answer "where do I
// start" without inventing a state: `canStart` is the ready lane without a
// running worker, `waiting` is the waiting and blocked lanes together, and
// `inProgress` is a task with an active attempt, which can sit in any lane.
// The words beside them reuse STATE_WORDS.
export interface FocusCounts {
  canStart: number;
  waiting: number;
  inProgress: number;
}

export function focusCounts(
  rows: readonly { rest_state: string; phase: string | null }[],
): FocusCounts {
  // Kept inside the function because the page embeds `focusCounts.toString()`;
  // a module constant would be a free variable in the inline script.
  const activePhases = ['claimed', 'launching', 'live', 'ending'];
  let canStart = 0;
  let waiting = 0;
  let inProgress = 0;
  for (const row of rows) {
    const running = row.phase !== null && activePhases.includes(row.phase);
    if (running) {
      inProgress += 1;
    } else if (row.rest_state === 'ready') {
      canStart += 1;
    } else if (row.rest_state === 'waiting' || row.rest_state === 'blocked') {
      waiting += 1;
    }
  }
  return { canStart, waiting, inProgress };
}

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

// The lane vocabulary, applied once. The page's inline script embeds this
// function's own source (`laneGroups.toString()`), so the plan the tests check
// and the plan the page draws are the same code, not two copies that can drift.
export function laneGroups(
  states: readonly string[],
  order: readonly string[],
): { lanes: LaneState[]; empty: number } {
  const lanes: LaneState[] = [];
  for (const state of order) {
    if (states.includes(state)) {
      lanes.push(state as RestState);
    }
  }
  // A state this build does not know gets one lane of its own. It is not an
  // empty vocabulary lane, so it never contributes to `empty`.
  const unknown = states.some((state) => !order.includes(state));
  if (unknown) {
    lanes.push('unknown');
  }
  return { lanes, empty: order.length + (unknown ? 1 : 0) - lanes.length };
}

export function lanePlan(rows: readonly TreeRow[]): LanePlan {
  const states = rows.map((row) => row.rest_state);
  const grouped = laneGroups(states, LANE_ORDER);
  return {
    lanes: grouped.lanes.map((state) => ({
      state,
      cards: rows.filter((row) =>
        state === 'unknown'
          ? !(LANE_ORDER as readonly string[]).includes(row.rest_state)
          : row.rest_state === state,
      ),
    })),
    empty: grouped.empty,
  };
}

// Blockers the read can see and whose own state is not one this edge accepts.
// `satisfied_by` is the engine's answer, not the board's; a read that did not
// carry it is unknown, never evidence of a disagreement. A blocker outside the
// read is not evidence either; the card still names it from the edge ref.
export function unsatisfiedBlockers(
  row: TreeRow,
  byId: ReadonlyMap<string, TreeRow>,
): TreeRow[] {
  const unsatisfied: TreeRow[] = [];
  for (const ref of row.blocked_by) {
    const blocker = byId.get(ref.task_id);
    if (blocker === undefined || ref.satisfied_by === null) {
      continue;
    }
    if (!ref.satisfied_by.includes(blocker.rest_state)) {
      unsatisfied.push(blocker);
    }
  }
  return unsatisfied;
}

// Ruling 6: a `ready` row with a blocker its edge does not accept is the
// engine's defect (R-2), not the board's mistake. The board keeps the engine's
// word and states the disagreement beside it. `satisfied_by` decides, so a
// dependency on a failed or skipped task that the edge allows never accuses a
// healthy engine. When the engine stops producing this combination the notice
// disappears on its own, which is the check.
export function engineDisagreement(
  row: TreeRow,
  byId: ReadonlyMap<string, TreeRow>,
): TreeRow | null {
  if (row.rest_state !== 'ready') {
    return null;
  }
  return unsatisfiedBlockers(row, byId)[0] ?? null;
}
