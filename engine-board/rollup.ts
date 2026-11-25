// ==========================================
// Containment counts and lane planning
//
// The engine prints a tree, not a summary. "N inside · M done" and the global
// "1 of 7 done · 2 skipped" are rolled up here, from `children`, once per render.
// Nothing in this module reads `counts` from the read model: those are the
// engine's own per-state totals over every placed row, which is a different
// question from "what is under this task".
// ==========================================

import type { EdgeKind, RestState, TreeRow } from './model.ts';

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

// The lanes are the reader's answer to "what do I do about this", not the
// engine's state names. Eight lanes for eight rest states, which is not a
// coincidence: the only many-to-one entry is Set aside, which takes both
// `skipped` and `cancelled` because the reader's action on both is "ignore it".
// `laneOf` is the map, and it is total: a state it does not know lands in its
// own `unknown` lane rather than silently borrowing one that means something
// else.
export const LANE_ORDER = [
  'not-started',
  'can-start',
  'in-progress',
  'waiting-for-someone',
  'waiting-for-other-work',
  'needs-attention',
  'done',
  'set-aside',
] as const;

export type Lane = (typeof LANE_ORDER)[number];

export const LANE_WORDS: Record<Lane | 'unknown', string> = {
  'not-started': 'Not started',
  'can-start': 'Can start now',
  'in-progress': 'In progress',
  'waiting-for-someone': 'Waiting for someone',
  'waiting-for-other-work': 'Waiting for other work',
  'needs-attention': 'Needs attention',
  done: 'Done',
  'set-aside': 'Set aside',
  unknown: 'Unknown state',
};

// The engine's words, kept for the one place they are the subject: a defect
// notice that quotes what the read actually said.
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

export function laneOf(state: string, phase: string | null): Lane | 'unknown' {
  // Both tables live inside the function because the page embeds this
  // function's own source; a module constant would be a free variable there.
  const byState: Record<string, Lane> = {
    draft: 'not-started',
    ready: 'can-start',
    waiting: 'waiting-for-someone',
    blocked: 'waiting-for-other-work',
    failed: 'needs-attention',
    done: 'done',
    skipped: 'set-aside',
    cancelled: 'set-aside',
  };
  const activePhases = ['claimed', 'launching', 'live', 'ending'];
  if (phase !== null && activePhases.includes(phase)) {
    return 'in-progress';
  }
  return byState[state] ?? 'unknown';
}

// The three counts the Board puts above its lanes: where to look, in the words
// a glance can hold. They are lane counts, not a second taxonomy.
export interface FocusCounts {
  canStart: number;
  inProgress: number;
  waiting: number;
}

export function focusCounts(
  rows: readonly { rest_state: string; phase: string | null }[],
): FocusCounts {
  let canStart = 0;
  let inProgress = 0;
  let waiting = 0;
  for (const row of rows) {
    const lane = laneOf(row.rest_state, row.phase);
    if (lane === 'can-start') canStart += 1;
    else if (lane === 'in-progress') inProgress += 1;
    else if (lane === 'waiting-for-someone' || lane === 'waiting-for-other-work') {
      waiting += 1;
    }
  }
  return { canStart, inProgress, waiting };
}

export type LaneId = Lane | 'unknown';

export interface LaneGroup {
  lane: LaneId;
  cards: TreeRow[];
}

export interface LanePlan {
  // Only lanes that hold a card. An empty lane is never drawn.
  lanes: LaneGroup[];
  // Lanes that exist in the vocabulary and hold nothing, so the page can say
  // it once.
  empty: number;
}

// The lane vocabulary, applied once. The page's inline script embeds this
// function's own source (`laneGroups.toString()`), so the plan the tests check
// and the plan the page draws are the same code, not two copies that can drift.
export function laneGroups(
  lanes: readonly string[],
  order: readonly string[],
): { lanes: LaneId[]; empty: number } {
  const present: LaneId[] = [];
  for (const lane of order) {
    if (lanes.includes(lane)) {
      present.push(lane as Lane);
    }
  }
  // A lane this build does not know gets one of its own. It is not an empty
  // vocabulary lane, so it never contributes to `empty`.
  const unknown = lanes.some((lane) => !order.includes(lane));
  if (unknown) {
    present.push('unknown');
  }
  return { lanes: present, empty: order.length + (unknown ? 1 : 0) - present.length };
}

export function lanePlan(rows: readonly TreeRow[]): LanePlan {
  const lanes = rows.map((row) => laneOf(row.rest_state, row.phase));
  const grouped = laneGroups(lanes, LANE_ORDER);
  return {
    lanes: grouped.lanes.map((lane) => ({
      lane,
      cards: rows.filter(
        (row) => laneOf(row.rest_state, row.phase) === lane,
      ),
    })),
    empty: grouped.empty,
  };
}

// Ruling 3: an edge is drawable inside a level only when both of its ends are
// drawn there. The edge data is the read's own `blocked_by` / `after` refs; a
// ref to a task outside the level is left to the card's sentence, never turned
// into a line to nothing.
export interface LevelEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

export function levelEdges(rows: readonly TreeRow[]): LevelEdge[] {
  const ids = new Set(rows.map((row) => row.task_id));
  const edges: LevelEdge[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const refs: [EdgeKind, TreeRow['blocked_by']][] = [
      ['blocked_by', row.blocked_by],
      ['after', row.after],
    ];
    for (const [kind, list] of refs) {
      for (const ref of list) {
        if (!ids.has(ref.task_id)) {
          continue;
        }
        const key = `${kind}:${ref.task_id}:${row.task_id}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        edges.push({ from: ref.task_id, to: row.task_id, kind });
      }
    }
  }
  return edges;
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
