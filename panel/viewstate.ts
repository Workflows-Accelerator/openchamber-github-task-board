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

const ORDER_MARKER_SINGLE_REGEX = /^[ \t]*<!--\s*board-order:\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?)\s*-->[ \t]*$/i;
const FENCE_OPEN_REGEX = /^[ \t]{0,3}(`{3,}|~{3,})/;

interface TerminalMarkerScan {
  order: number;
  contentEnd: number;
}

function scanTerminalOrderMarker(body: string): TerminalMarkerScan | null {
  const lines: Array<{ text: string; start: number; end: number; inFence: boolean }> = [];
  let fenceChar = '';
  let fenceLen = 0;
  let pos = 0;
  while (pos <= body.length) {
    let lineEnd = body.indexOf('\n', pos);
    let nextPos: number;
    if (lineEnd === -1) {
      lineEnd = body.length;
      nextPos = body.length + 1;
    } else {
      nextPos = lineEnd + 1;
      if (lineEnd > pos && body.charCodeAt(lineEnd - 1) === 13) {
        lineEnd -= 1;
      }
    }
    const text = body.slice(pos, lineEnd);
    let inFence = fenceLen > 0;
    const fenceMatch = FENCE_OPEN_REGEX.exec(text);
    if (fenceMatch) {
      const run = fenceMatch[1];
      if (!inFence) {
        fenceChar = run[0];
        fenceLen = run.length;
        inFence = true;
      } else if (run[0] === fenceChar && run.length >= fenceLen && /^[ \t]*$/.test(text.slice(fenceMatch[0].length))) {
        fenceChar = '';
        fenceLen = 0;
      }
    }
    lines.push({ text, start: pos, end: lineEnd, inFence });
    pos = nextPos;
  }

  let i = lines.length - 1;
  while (i >= 0 && !/\S/.test(lines[i].text)) i--;
  if (i < 0 || lines[i].inFence) return null;
  const lastMatch = ORDER_MARKER_SINGLE_REGEX.exec(lines[i].text);
  if (!lastMatch) return null;
  const order = Number(lastMatch[1]);
  if (!Number.isFinite(order)) return null;

  let firstMarkerLine = i;
  i--;
  while (i >= 0) {
    if (!/\S/.test(lines[i].text)) {
      i--;
      continue;
    }
    if (!lines[i].inFence) {
      const m = ORDER_MARKER_SINGLE_REGEX.exec(lines[i].text);
      if (m && Number.isFinite(Number(m[1]))) {
        firstMarkerLine = i;
        i--;
        continue;
      }
    }
    break;
  }

  let lastContentLine = firstMarkerLine - 1;
  while (lastContentLine >= 0 && !/\S/.test(lines[lastContentLine].text)) {
    lastContentLine--;
  }
  return {
    order,
    contentEnd: lastContentLine >= 0 ? lines[lastContentLine].end : 0,
  };
}

/** Order number from the terminal unfenced `<!-- board-order: N -->` line in a body, or null. */
export function parseOrderMarker(body: string | null | undefined): number | null {
  if (!body || typeof body !== 'string') return null;
  const scan = scanTerminalOrderMarker(body);
  return scan ? scan.order : null;
}

/** Body with the terminal unfenced order marker line(s) removed, preserving line endings and trailing spaces. */
export function stripOrderMarker(body: string | null | undefined): string {
  if (!body || typeof body !== 'string') return '';
  const scan = scanTerminalOrderMarker(body);
  if (!scan) return body;
  return body.slice(0, scan.contentEnd);
}

/** Round-trip the number without rounding away fractional order positions. */
export function formatOrderNumber(order: number): string {
  if (!Number.isFinite(order)) throw new Error('Order must be finite');
  const text = String(order);
  if (!/[eE]/.test(text)) return text;
  const [coefficient, exponent] = text.toLowerCase().split('e');
  const negative = coefficient.startsWith('-');
  const unsigned = negative ? coefficient.slice(1) : coefficient;
  const [whole, fraction = ''] = unsigned.split('.');
  const digits = whole + fraction;
  const point = whole.length + Number(exponent);
  const decimal = point <= 0 ? `0.${'0'.repeat(-point)}${digits}`
    : point >= digits.length ? digits + '0'.repeat(point - digits.length)
    : `${digits.slice(0, point)}.${digits.slice(point)}`;
  return negative ? `-${decimal}` : decimal;
}

/**
 * Body with the order marker set: any existing marker is removed and the new
 * marker is appended on its own line at the end of the body.
 */
export function setOrderMarker(body: string | null | undefined, order: number): string {
  const raw = body || '';
  const base = stripOrderMarker(raw);
  const marker = `<!-- board-order: ${formatOrderNumber(order)} -->`;
  if (!base) return marker;
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  return `${base}${eol}${eol}${marker}`;
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
  const repoCmp = (a.repo || '').localeCompare(b.repo || '');
  if (repoCmp !== 0) return repoCmp;
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

export interface MoveWrite {
  /** Index in `ordered` of an item whose marker is written. */
  index: number;
  /** New marker value for that item. */
  order: number;
}

export type MoveResult = MoveWrite[];

function slotOrder<T extends OrderableItem>(rest: T[], slot: number): number | null {
  const prev: T | null = slot > 0 ? rest[slot - 1] : null;
  const next: T | null = slot < rest.length ? rest[slot] : null;
  const prevOrder = prev ? parseOrderMarker(prev.body) : null;
  if (prev && prevOrder === null) return null;
  const nextOrder = next ? parseOrderMarker(next.body) : null;
  const order = midpointOrder(prevOrder, nextOrder);
  if (!Number.isFinite(order)) return null;
  if (prevOrder !== null && order <= prevOrder) return null;
  if (nextOrder !== null && order >= nextOrder) return null;
  return order;
}

function buildSpanOrders(low: number | null, high: number | null, count: number): number[] | null {
  if (count <= 0) return null;
  if (low !== null && high !== null && !(low < high)) return null;
  const values: number[] = [];
  for (let k = 0; k < count; k++) {
    let v: number;
    if (low === null && high === null) {
      v = (k + 1) * ORDER_GAP;
    } else if (low !== null && high === null) {
      v = low + (k + 1) * ORDER_GAP;
    } else if (low === null && high !== null) {
      v = high - (count - k) * ORDER_GAP;
    } else {
      const l = low as number;
      const h = high as number;
      const delta = h - l;
      v = Number.isFinite(delta)
        ? l + (delta * (k + 1)) / (count + 1)
        : ((count - k) * l + (k + 1) * h) / (count + 1);
    }
    if (!Number.isFinite(v)) return null;
    if (k === 0 && low !== null && !(v > low)) return null;
    if (k > 0 && !(v > values[k - 1])) return null;
    if (k === count - 1 && high !== null && !(v < high)) return null;
    values.push(v);
  }
  return values;
}

/**
 * Compute the minimal ordered list of `{ index, order }` marker writes for a move.
 * `ordered` is the list in its current manual order (see sortByManualOrder);
 * the item at `fromIndex` ends up at `toIndex`. Returns null for a no-op or
 * out-of-range move.
 *
 * When a single midpoint write suffices, only the moved item is written. When
 * moving into/past unmarked items or across equal/exhausted markers, lazily
 * initializes unmarked prefix/neighbours up to `toIndex` with `ORDER_GAP`
 * spacing or rebalances the minimal contiguous span around `toIndex`.
 */
export function computeMove<T extends OrderableItem>(ordered: T[], fromIndex: number, toIndex: number): MoveResult | null {
  if (fromIndex < 0 || fromIndex >= ordered.length) return null;
  const to = Math.max(0, Math.min(ordered.length - 1, toIndex));
  if (to === fromIndex) return null;
  const rest = ordered.filter((_, i) => i !== fromIndex);
  const direct = slotOrder(rest, to);
  if (direct !== null) return [{ index: fromIndex, order: direct }];

  const entries = ordered.map((item, index) => ({
    item,
    index,
    order: parseOrderMarker(item.body),
  }));
  const [moved] = entries.splice(fromIndex, 1);
  entries.splice(to, 0, moved);

  let lastMarked = -1;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].order !== null) lastMarked = i;
  }
  const markedCount = Math.max(to + 1, lastMarked + 1);

  let firstUnmarked = -1;
  for (let i = 0; i <= to; i++) {
    if (entries[i].order === null) {
      firstUnmarked = i;
      break;
    }
  }

  if (firstUnmarked !== -1 && lastMarked <= to) {
    const baseOrder = firstUnmarked > 0 ? (entries[firstUnmarked - 1].order as number) : 0;
    const writes: MoveWrite[] = [];
    let valid = true;
    for (let i = firstUnmarked; i <= to; i++) {
      const nextOrder = baseOrder + (i - firstUnmarked + 1) * ORDER_GAP;
      if (!Number.isFinite(nextOrder)) {
        valid = false;
        break;
      }
      if (entries[i].order !== nextOrder) {
        writes.push({ index: entries[i].index, order: nextOrder });
      }
    }
    if (valid && writes.length > 0) return writes;
  }

  for (let len = 1; len <= markedCount; len++) {
    const startL = Math.max(0, to - len + 1);
    const endL = Math.min(to, markedCount - len);
    let best: MoveWrite[] | null = null;
    for (let left = startL; left <= endL; left++) {
      const right = left + len - 1;
      const low = left > 0 ? entries[left - 1].order : null;
      const high = right + 1 < markedCount ? entries[right + 1].order : null;
      if ((left > 0 && low === null) || (right + 1 < markedCount && high === null)) continue;
      const values = buildSpanOrders(low, high, len);
      if (!values) continue;
      const candidate: MoveWrite[] = [];
      for (let k = 0; k < len; k++) {
        if (entries[left + k].order !== values[k]) {
          candidate.push({ index: entries[left + k].index, order: values[k] });
        }
      }
      if (candidate.length > 0 && (!best || candidate.length < best.length)) {
        best = candidate;
      }
    }
    if (best) return best;
  }

  return null;
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
  const byNumberDesc = (a: T, b: T) => {
    const repoCmp = (a.repo || '').localeCompare(b.repo || '');
    if (repoCmp !== 0) return repoCmp;
    return (b.number || 0) - (a.number || 0);
  };
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
