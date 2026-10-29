// ==========================================
// View / Filter / Sort state, short project names and draft order marker.
//
// Pure module: no DOM, no host, no imports. The web board can copy or import
// it as-is. Implements the "Shared contracts" of the simplify-views decision:
//   - short project name rule (with user rename override)
//   - draft order marker `<!-- board-order: <number> -->`
//   - remembered View / Filter / Sort state with defaults
// ==========================================

// ------------------------------------------
// Short project names
// ------------------------------------------

const SHORT_NAME_DROP_TOKENS = new Set(['openchamber', 'github', 'gh', 'repo']);

function titleCaseToken(token: string): string {
  if (!token) return '';
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

/** Lower-cased lookup key for a full `owner/repo` string. */
export function projectNameKey(fullRepo: string): string {
  return String(fullRepo || '').trim().toLowerCase();
}

/**
 * Short, readable project name for a repository.
 *
 * Rule: take the part after `/`; split on `-`, `_`, `.`; drop tokens
 * (case-insensitive) in {openchamber, github, gh, repo}; Title Case each
 * remaining token; join with a space. If nothing remains, Title Case the whole
 * repo part. A non-empty user rename (keyed by full owner/repo, case-insensitive)
 * overrides the rule.
 */
export function shortName(fullRepo: string, overrides?: Record<string, string> | null): string {
  const raw = String(fullRepo || '').trim();
  if (!raw) return '';
  if (overrides) {
    const override = overrides[projectNameKey(raw)];
    if (typeof override === 'string' && override.trim()) return override.trim();
  }
  const slash = raw.lastIndexOf('/');
  const repoPart = slash >= 0 ? raw.slice(slash + 1) : raw;
  if (!repoPart) return raw;
  const tokens = repoPart.split(/[-_.]+/).filter(Boolean);
  const kept = tokens.filter((t) => !SHORT_NAME_DROP_TOKENS.has(t.toLowerCase()));
  if (kept.length === 0) return titleCaseToken(repoPart);
  return kept.map(titleCaseToken).join(' ');
}

/** Drop empty values and normalise keys of a stored rename map. */
export function normalizeProjectNameOverrides(stored: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return out;
  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    if (typeof value !== 'string') continue;
    const name = value.trim();
    const k = projectNameKey(key);
    if (!k || !name) continue;
    out[k] = name;
  }
  return out;
}

// ------------------------------------------
// Draft order marker
// ------------------------------------------

/** Spacing used for first/last positions and for new items appended at the end. */
export const ORDER_GAP = 1000;

const ORDER_MARKER_LINE_REGEX = /^[ \t]*<!--\s*board-order:\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?)\s*-->[ \t]*$/gim;

/** Order number from the last `<!-- board-order: N -->` line in a body, or null. */
export function parseOrderMarker(body: string | null | undefined): number | null {
  if (!body || typeof body !== 'string') return null;
  let result: number | null = null;
  ORDER_MARKER_LINE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ORDER_MARKER_LINE_REGEX.exec(body)) !== null) {
    const n = Number(match[1]);
    if (Number.isFinite(n)) result = n;
  }
  return result;
}

/** Body with every order marker line removed (and trailing blank lines trimmed). */
export function stripOrderMarker(body: string | null | undefined): string {
  if (!body || typeof body !== 'string') return '';
  ORDER_MARKER_LINE_REGEX.lastIndex = 0;
  if (!ORDER_MARKER_LINE_REGEX.test(body)) return body;
  ORDER_MARKER_LINE_REGEX.lastIndex = 0;
  return body
    .replace(ORDER_MARKER_LINE_REGEX, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+$/, '');
}

/** Number formatted for the marker (plain decimal, no exponent). */
export function formatOrderNumber(order: number): string {
  if (!Number.isFinite(order)) return '0';
  if (Number.isInteger(order)) return String(order);
  const fixed = order.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
  return fixed === '-0' ? '0' : fixed;
}

/**
 * Body with the order marker set: any existing marker is removed and the new
 * marker is appended on its own line at the end of the body.
 */
export function setOrderMarker(body: string | null | undefined, order: number): string {
  const base = stripOrderMarker(body || '');
  const marker = `<!-- board-order: ${formatOrderNumber(order)} -->`;
  return base ? `${base}\n\n${marker}` : marker;
}

/**
 * New order between two neighbours. `null` means "no ordered neighbour on that
 * side". First position: next - 1000; last position: prev + 1000; no ordered
 * neighbour at all: 1000; otherwise the midpoint.
 */
export function midpointOrder(prev: number | null, next: number | null): number {
  if (prev === null && next === null) return ORDER_GAP;
  if (prev === null) return (next as number) - ORDER_GAP;
  if (next === null) return prev + ORDER_GAP;
  return (prev + next) / 2;
}

export interface OrderableItem {
  number: number;
  body?: string | null;
  created_at?: string | null;
  repo?: string | null;
}

function createdTime(item: OrderableItem): number {
  const t = item.created_at ? Date.parse(item.created_at) : NaN;
  return Number.isFinite(t) ? t : 0;
}

/**
 * Manual order: items with a marker first (lower number first), then items
 * without a marker, oldest created first. Ties break on created time, then
 * issue number, so every device computes the same order.
 */
export function compareManualOrder(a: OrderableItem, b: OrderableItem): number {
  const oa = parseOrderMarker(a.body);
  const ob = parseOrderMarker(b.body);
  if (oa !== null && ob === null) return -1;
  if (oa === null && ob !== null) return 1;
  if (oa !== null && ob !== null && oa !== ob) return oa - ob;
  const ca = createdTime(a);
  const cb = createdTime(b);
  if (ca !== cb) return ca - cb;
  return (a.number || 0) - (b.number || 0);
}

export function sortByManualOrder<T extends OrderableItem>(items: T[]): T[] {
  return [...items].sort(compareManualOrder);
}

/** Order for a new item appended at the end of the marked items. */
export function nextAppendOrder(items: OrderableItem[]): number {
  let max: number | null = null;
  for (const item of items) {
    const o = parseOrderMarker(item.body);
    if (o !== null && (max === null || o > max)) max = o;
  }
  return max === null ? ORDER_GAP : max + ORDER_GAP;
}

export interface MoveResult {
  /** Index in `ordered` of the only item whose marker is written. */
  index: number;
  /** New marker value for that item. */
  order: number;
  /**
   * False when the requested slot cannot be expressed with one marker write
   * (it sits after an item without a marker, and marked items always sort
   * before unmarked ones). The item then lands at the nearest reachable slot:
   * right after the last marked item.
   */
  exact: boolean;
}

function slotOrder<T extends OrderableItem>(rest: T[], slot: number): number | null {
  const prev: T | null = slot > 0 ? rest[slot - 1] : null;
  const next: T | null = slot < rest.length ? rest[slot] : null;
  const prevOrder = prev ? parseOrderMarker(prev.body) : null;
  if (prev && prevOrder === null) return null;
  const nextOrder = next ? parseOrderMarker(next.body) : null;
  const order = midpointOrder(prevOrder, nextOrder);
  if (prevOrder !== null && nextOrder !== null && !(order > prevOrder && order < nextOrder)) return null;
  return order;
}

/**
 * Compute the single marker write for a move. `ordered` is the list in its
 * current manual order (see sortByManualOrder); the item at `fromIndex` should
 * end up at `toIndex`. Returns null for a no-op or impossible move.
 *
 * Normally the moved item's marker is set to the midpoint of its new
 * neighbours (first/last: neighbour -/+ 1000). An adjacent swap that cannot be
 * expressed that way (moving down past an unmarked item) is written as the
 * equivalent move of the other item up by one: still exactly one write.
 */
export function computeMove<T extends OrderableItem>(ordered: T[], fromIndex: number, toIndex: number): MoveResult | null {
  if (fromIndex < 0 || fromIndex >= ordered.length) return null;
  const to = Math.max(0, Math.min(ordered.length - 1, toIndex));
  if (to === fromIndex) return null;
  const rest = ordered.filter((_, i) => i !== fromIndex);
  const direct = slotOrder(rest, to);
  if (direct !== null) return { index: fromIndex, order: direct, exact: true };

  if (Math.abs(to - fromIndex) === 1) {
    const restSwap = ordered.filter((_, i) => i !== to);
    const swapped = slotOrder(restSwap, fromIndex);
    if (swapped !== null) return { index: to, order: swapped, exact: true };
  }

  const firstUnmarked = rest.findIndex((it) => parseOrderMarker(it.body) === null);
  if (firstUnmarked < 0) return null; // precision exhausted between two markers
  // Only fall back when it still moves the item in the requested direction.
  if (to > fromIndex ? firstUnmarked <= fromIndex : firstUnmarked >= fromIndex) return null;
  const fallback = slotOrder(rest, firstUnmarked);
  if (fallback === null) return null;
  return { index: fromIndex, order: fallback, exact: false };
}

// ------------------------------------------
// View / Filter / Sort state
// ------------------------------------------

export type ViewId = 'simple' | 'cards' | 'kanban' | 'graph' | 'pending';
export type SortId = 'priority' | 'updated' | 'created' | 'manual';
export type StageId = 'draft' | 'backlog' | 'todo' | 'planned' | 'in-progress' | 'needs-human' | 'in-review' | 'done';

export const VIEW_IDS: ViewId[] = ['simple', 'cards', 'kanban', 'graph', 'pending'];
export const SORT_IDS: SortId[] = ['priority', 'updated', 'created', 'manual'];
export const STAGE_IDS: StageId[] = ['draft', 'backlog', 'todo', 'planned', 'in-progress', 'needs-human', 'in-review', 'done'];
export const KIND_FILTERS = ['needs-me', 'human', 'questions'] as const;

export const VIEW_LABELS: Record<ViewId, string> = {
  simple: 'Simple list',
  cards: 'Cards',
  kanban: 'Kanban board',
  graph: 'Graph',
  pending: 'Pending items',
};

export const SORT_LABELS: Record<SortId, string> = {
  priority: 'Priority',
  updated: 'Recently updated',
  created: 'Recently created',
  manual: 'Manual order',
};

export const KIND_FILTER_LABELS: Record<string, string> = {
  'needs-me': 'Needs me',
  human: 'Human tasks',
  questions: 'Questions',
};

export interface ViewState {
  view: ViewId;
  /** Filter tokens: 'needs-me' | 'human' | 'questions' | 'stage:<id>' | 'project:<owner/repo>'. */
  filters: string[];
  sort: SortId;
}

export const DEFAULT_VIEW_STATE: Readonly<ViewState> = Object.freeze({ view: 'simple', filters: [], sort: 'priority' }) as Readonly<ViewState>;

export function defaultViewState(): ViewState {
  return { view: DEFAULT_VIEW_STATE.view, filters: [], sort: DEFAULT_VIEW_STATE.sort };
}

export function isValidFilterToken(token: unknown): token is string {
  if (typeof token !== 'string' || !token) return false;
  if ((KIND_FILTERS as readonly string[]).includes(token)) return true;
  if (token.startsWith('stage:')) return (STAGE_IDS as string[]).includes(token.slice(6));
  if (token.startsWith('project:')) return token.length > 'project:'.length;
  return false;
}

/** Validate a stored state; anything unknown falls back to the default. */
export function normalizeViewState(stored: unknown): ViewState {
  const state = defaultViewState();
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return state;
  const s = stored as Record<string, unknown>;
  if (typeof s.view === 'string' && (VIEW_IDS as string[]).includes(s.view)) state.view = s.view as ViewId;
  if (typeof s.sort === 'string' && (SORT_IDS as string[]).includes(s.sort)) state.sort = s.sort as SortId;
  if (Array.isArray(s.filters)) {
    const seen = new Set<string>();
    for (const f of s.filters) {
      if (isValidFilterToken(f) && !seen.has(f)) {
        seen.add(f);
        state.filters.push(f);
      }
    }
  }
  return state;
}

/** Add or remove one filter token, keeping order stable. */
export function toggleFilter(filters: string[], token: string): string[] {
  if (!isValidFilterToken(token)) return [...filters];
  return filters.includes(token) ? filters.filter((f) => f !== token) : [...filters, token];
}

export function stageFilters(filters: string[]): StageId[] {
  return filters.filter((f) => f.startsWith('stage:')).map((f) => f.slice(6) as StageId);
}

export function projectFilters(filters: string[]): string[] {
  return filters.filter((f) => f.startsWith('project:')).map((f) => f.slice(8));
}

/** Quick-capture mode: Simple list with the Draft stage filter on. */
export function isQuickCaptureMode(state: ViewState): boolean {
  return state.view === 'simple' && state.filters.includes('stage:draft');
}

export interface FilterAccessors<T> {
  stageOf: (item: T) => string;
  repoOf: (item: T) => string;
  needsMe: (item: T) => boolean;
  hasHumanTasks: (item: T) => boolean;
  hasOpenQuestions: (item: T) => boolean;
}

/**
 * Apply filter tokens. Within one group the tokens are OR-ed (any selected
 * stage, any selected project, any selected kind); groups are AND-ed.
 * No filters returns every item.
 */
export function applyFilters<T>(items: T[], filters: string[], acc: FilterAccessors<T>): T[] {
  if (!filters || filters.length === 0) return [...items];
  const kinds = filters.filter((f) => (KIND_FILTERS as readonly string[]).includes(f));
  const stages = new Set<string>(stageFilters(filters));
  const projects = new Set(projectFilters(filters).map(projectNameKey));
  return items.filter((item) => {
    if (stages.size > 0 && !stages.has(acc.stageOf(item))) return false;
    if (projects.size > 0 && !projects.has(projectNameKey(acc.repoOf(item)))) return false;
    if (kinds.length > 0) {
      const ok = kinds.some((k) =>
        k === 'needs-me' ? acc.needsMe(item) : k === 'human' ? acc.hasHumanTasks(item) : acc.hasOpenQuestions(item)
      );
      if (!ok) return false;
    }
    return true;
  });
}

export interface SortableItem extends OrderableItem {
  updated_at?: string | null;
}

function timeOf(value: string | null | undefined): number {
  const t = value ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? t : 0;
}

/**
 * Apply a sort. `priorityWeight` returns a higher number for more important
 * items. Ties break on issue number (newest first) except manual order, which
 * follows compareManualOrder.
 */
export function applySort<T extends SortableItem>(items: T[], sort: SortId, priorityWeight: (item: T) => number): T[] {
  const copy = [...items];
  const byNumberDesc = (a: T, b: T) => (b.number || 0) - (a.number || 0);
  switch (sort) {
    case 'manual':
      return copy.sort(compareManualOrder);
    case 'updated':
      return copy.sort((a, b) => {
        const d = timeOf(b.updated_at || b.created_at) - timeOf(a.updated_at || a.created_at);
        return d !== 0 ? d : byNumberDesc(a, b);
      });
    case 'created':
      return copy.sort((a, b) => {
        const d = timeOf(b.created_at) - timeOf(a.created_at);
        return d !== 0 ? d : byNumberDesc(a, b);
      });
    case 'priority':
    default:
      return copy.sort((a, b) => {
        const d = (priorityWeight(b) || 0) - (priorityWeight(a) || 0);
        return d !== 0 ? d : byNumberDesc(a, b);
      });
  }
}
