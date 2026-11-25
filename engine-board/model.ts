// ==========================================
// Engine board read model
//
// Field names are INTERFACE §2's, not the board's: `rest_state`, `tree_key`,
// `runner_slot`, `blocked_by`. The only job here is to fold the engine's own
// verb payloads into a tree without renaming anything.
//
// This module is DOM-free and Node-free so it can be imported by the renderer
// and by node:test directly.
// ==========================================

export const REST_STATES = [
  'draft',
  'blocked',
  'ready',
  'waiting',
  'done',
  'failed',
  'cancelled',
  'skipped',
] as const;

export type RestState = (typeof REST_STATES)[number];

export const ATTEMPT_PHASES = [
  'claimed',
  'launching',
  'live',
  'ending',
  'ended',
] as const;

export type AttemptPhase = (typeof ATTEMPT_PHASES)[number];

export const EDGE_KINDS = ['blocked_by', 'after'] as const;

export type EdgeKind = (typeof EDGE_KINDS)[number];

// `task graph --json` node. Exactly these four fields; no title, no tree_key.
// A source that reads more fields may add them; capability detection below
// looks for them by name rather than assuming this shape.
export interface GraphNode {
  task_id: string;
  node_key: string;
  rest_state: RestState;
  parent_task_id: string | null;
  [field: string]: unknown;
}

// `task graph --json` edge. `from` is the blocker; `to` is the blocked task.
// `satisfied_by` is the engine's own answer to "which blocker states satisfy
// this edge"; null means the payload did not carry it (schema 7), which is not
// a licence to assume `done`.
export interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  satisfied_by: string[] | null;
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// The real shape a rejected settle writes into `task.wait`.
export interface WaitPayload {
  reason: string;
  cause: string;
  owner: string;
  opened_at: string;
  expires_at: string | null;
  opened_by_attempt: string | null;
  escalation_level: number;
  resume_at: string | null;
  ended_by: string | null;
}

// `task status --json` for one task. `slot` is the project slot. A source that
// can read the attempt row may add `runner_slot` / `runner_id`; the capability
// scan below reports whether it did.
export interface StatusPayload {
  task_id: string;
  rest_state: RestState;
  phase: AttemptPhase | null;
  slot: number | null;
  wait: WaitPayload | null;
  hold: Record<string, unknown> | null;
  handoff_revision: number;
  [field: string]: unknown;
}

// One condition of the pinned contract, as the read prints it. The engine
// accepts `evidence`, `answer`, `verdict`, `check` and `child`; an unknown kind
// is kept so the panel can say it cannot describe it rather than dropping it.
export interface ContractCondition {
  kind: string;
  name: string | null;
  field: string | null;
  equals: unknown;
  settle: string | null;
  verdict: string | null;
  evidence_kind: string | null;
}

// One attempt row as `task status` prints it. Only the fields the board shows;
// everything else stays in the payload for a later panel. The note fields
// (`end_evidence`, `attested_by`, `approved_by`, `principal`) are what ruling 6
// turns into a plain sentence.
export interface AttemptRecord {
  attempt_id: string | null;
  ordinal: number | null;
  phase: AttemptPhase | null;
  runner_id: string | null;
  runner_slot: number | null;
  slot: number | null;
  launched_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
  end_evidence: string | null;
  outcome: string | null;
  attested_by: string | null;
  approved_by: string | null;
  principal: string | null;
  launch_count: number | null;
}

export interface RunnerRow {
  runner_id: string;
  project_id: string;
  kind: string;
  endpoint: string | null;
  tags: string[];
  capacity: number;
  enabled: boolean;
  heartbeat_at: string | null;
  created_at: string;
}

export interface ProjectPayload {
  project_id: string;
  config_revision: number;
  // Not printed by any read verb at schema revision 7 (GAPS G11); a source that
  // learns either may set it and the board will show the denominator.
  max_concurrency?: number | null;
  slot_limit?: number | null;
  [field: string]: unknown;
}

export type SourceKind = 'fixture' | 'live';

// What this page is, when it was read and what was read. A live source fills
// the same shape; the renderer prints what it is given and never assumes a
// capture.
export interface ReadProvenance {
  source_kind: SourceKind;
  read_at: string;
  engine_commit: string;
  schema_revision: number;
  operations: string[];
  // Writes the read could not have performed through a CLI verb. Fixture-only
  // in practice, but it is data: a live source passes an empty list.
  port_only_steps: string[];
  // States this read could not produce. Their zero count is "not captured",
  // not "the tree never reached it". A live read passes an empty list.
  unobserved_states: RestState[];
}

// Everything one read of one tree returns. Each member is an engine payload or
// a request value the engine does not echo back, plus provenance.
export interface EngineTreeSnapshot {
  provenance: ReadProvenance;
  project: ProjectPayload;
  runners: RunnerRow[];
  // False when the runner read failed or was not attempted. Empty runners then
  // means "not read", never "there are none".
  runners_available: boolean;
  graph: GraphPayload;
  statuses: StatusPayload[];
  // Not returned by any read verb; the source carries the request value.
  tree_key: string;
  // `task create --tree-key` returns this as `root_task_id`.
  root_task_id: string;
}

export interface TreeRequest {
  project_id: string;
  tree_key: string;
  root_task_id: string;
}

// The one data-source seam. A live source in the next slice implements the same
// `load` by calling the verbs this fixture source was captured from.
export interface EngineTreeSource {
  load(request: TreeRequest): Promise<EngineTreeSnapshot>;
}

export interface TreeEdgeRef {
  task_id: string;
  // null when the edge names a task outside the visible tree.
  node_key: string | null;
  // The edge's own `satisfied_by`, or null when the read did not carry it.
  satisfied_by: string[] | null;
}

// A parent a row names but this read did not return. The whole subtree below
// that row was lifted to depth 0, not just the row.
export interface RerootedInfo {
  parent_task_id: string;
  subtree_tasks: number;
}

export interface TreeRow {
  task_id: string;
  node_key: string;
  // The parent pointer as the read returned it. The tree nests by it; the List
  // and the board's scope projection also need it as data.
  parent_task_id: string | null;
  // The engine's own title. null when the read did not print one; the board
  // then falls back to node_key and says the title was not read.
  title: string | null;
  rest_state: RestState;
  // False when the engine's string is outside the frozen enum. The row still
  // shows the engine's word, but it is not counted as a known state.
  rest_state_known: boolean;
  // The engine's archive timestamp for this row. Non-null means the row is
  // archived: it stays in the tree, labelled, and is not counted as live work.
  archived_at: string | null;
  phase: AttemptPhase | null;
  slot: number | null;
  // The attempt's slot limit as the status row prints it (R-1), not the
  // project's configured ceiling.
  slot_limit: number | null;
  created_at: string | null;
  updated_at: string | null;
  // Attempt history, newest last. Empty when the read printed none.
  attempts: AttemptRecord[];
  // The task's own description. null means the read carried no usable string;
  // `body_read` says whether the field was present at all.
  body: string | null;
  body_read: boolean;
  // The pinned contract's conditions. Empty with `conditions_read` true means
  // the contract pins none; `conditions_read` false means no read verb printed
  // the contract and the panel must say so instead of showing an empty list.
  conditions: ContractCondition[];
  conditions_read: boolean;
  // The issue-mirror reference the read carried, if any. The engine keeps no
  // comments; the panel names where a conversation lives rather than inventing
  // one. Live reads carry null because no read verb prints a mirror link.
  mirror: string | null;
  // Null means "no value"; `*_reported` says whether the field was present at
  // all. null with reported false is "unreadable", not "no runner".
  runner_slot: number | null;
  runner_slot_reported: boolean;
  runner_id: string | null;
  runner_id_reported: boolean;
  wait: WaitPayload | null;
  hold: Record<string, unknown> | null;
  handoff_revision: number | null;
  blocked_by: TreeEdgeRef[];
  after: TreeEdgeRef[];
  depth: number;
  children: TreeRow[];
  status_missing: boolean;
  rest_state_mismatch: boolean;
  // Set only on a row the read lifted to depth 0 because its parent is outside
  // the read. `subtree_tasks` counts that row and every row under it.
  rerooted: RerootedInfo | null;
}

// What this read can answer, derived from the payloads themselves. A source
// that starts returning titles flips `task_title` without an edit here or in
// the renderer.
export interface ReadModelCapabilities {
  runner_slot: boolean;
  runner_id: boolean;
  task_title: boolean;
  task_priority: boolean;
  task_tags: boolean;
  task_requires: boolean;
  tree_key_from_read: boolean;
  slot_limit: boolean;
  // True when the status payload carries attempt history (`attempts` or
  // `ended_attempt`). No read verb does at schema revision 7.
  ended_attempt: boolean;
  // The status payload carries a description.
  task_body: boolean;
  // The status payload carries the pinned contract's conditions. No read verb
  // does today (GAPS G18), so a live read falls back to the panel's sentence.
  contract_conditions: boolean;
  // The status payload names an issue-mirror conversation.
  mirror_link: boolean;
}

export type TreeDefectKind = 'duplicate' | 'cycle' | 'unreachable' | 'rerooted';

// INTERFACE §1's tree state, derived at the read like the engine does: the
// root's `archived_at` decides `archived`, otherwise every terminal task decides
// `completed`, otherwise `open`.
export type TreeState = 'archived' | 'completed' | 'open';

// A placement failure. `tasks` is how many tasks are affected; `keys` names
// them (for `rerooted`, the top node of each lifted subtree).
export interface TreeDefect {
  kind: TreeDefectKind;
  tasks: number;
  keys: string[];
}

export interface TreeModel {
  project_id: string;
  config_revision: number;
  tree_key: string;
  root_task_id: string;
  // Derived the same way the engine derives it, from the root's archive stamp
  // and the rows' rest states.
  tree_state: TreeState;
  provenance: ReadProvenance;
  runners: RunnerRow[];
  runners_available: boolean;
  roots: TreeRow[];
  counts: Record<RestState, number>;
  // Rows whose rest_state is not one of REST_STATES. Counted separately so a
  // new engine state cannot silently vanish from the strip.
  unknown_rest_states: number;
  // Rows placed in the tree.
  total: number;
  // Non-container nodes the read returned, placed or not.
  nodes_read: number;
  // nodes_read - total, by construction. Never silently zero.
  unplaced: number;
  max_depth: number;
  defects: TreeDefect[];
  hidden_container: GraphNode | null;
  slot_limit: number | null;
  capabilities: ReadModelCapabilities;
}

function emptyCounts(): Record<RestState, number> {
  const counts = {} as Record<RestState, number>;
  for (const state of REST_STATES) {
    counts[state] = 0;
  }
  return counts;
}

function isRestState(value: unknown): value is RestState {
  return typeof value === 'string' && (REST_STATES as readonly string[]).includes(value);
}

// A field is "reported" when the payload has the key at all. null is a value
// (an attempt with no runner slot), a missing key is not.
function reports(records: readonly unknown[], field: string): boolean {
  return records.some(
    (record) =>
      record !== null &&
      typeof record === 'object' &&
      Object.hasOwn(record, field) &&
      (record as Record<string, unknown>)[field] !== undefined,
  );
}

function deriveCapabilities(
  snapshot: EngineTreeSnapshot,
): ReadModelCapabilities {
  const project = snapshot.project;
  const taskRecords: unknown[] = [...snapshot.graph.nodes, ...snapshot.statuses];
  return {
    runner_slot: reports(snapshot.statuses, 'runner_slot'),
    runner_id: reports(snapshot.statuses, 'runner_id'),
    task_title: reports(taskRecords, 'title'),
    task_priority: reports(taskRecords, 'priority'),
    task_tags: reports(taskRecords, 'tags'),
    task_requires: reports(taskRecords, 'requires'),
    tree_key_from_read: reports([project, ...taskRecords], 'tree_key'),
    slot_limit:
      reports([project], 'max_concurrency') || reports([project], 'slot_limit'),
    ended_attempt:
      reports(snapshot.statuses, 'attempts') ||
      reports(snapshot.statuses, 'ended_attempt'),
    task_body: reports(snapshot.statuses, 'body'),
    contract_conditions: reports(snapshot.statuses, 'conditions'),
    mirror_link: reports(snapshot.statuses, 'mirror'),
  };
}

function slotLimitOf(project: ProjectPayload): number | null {
  for (const value of [project.max_concurrency, project.slot_limit]) {
    if (typeof value === 'number') {
      return value;
    }
  }
  return null;
}

function numberField(
  record: Record<string, unknown>,
  field: string,
): number | null {
  const value = record[field];
  return typeof value === 'number' ? value : null;
}

function stringField(
  record: Record<string, unknown>,
  field: string,
): string | null {
  const value = record[field];
  return typeof value === 'string' ? value : null;
}

function isAttemptPhase(value: unknown): value is AttemptPhase {
  return (
    typeof value === 'string' &&
    (ATTEMPT_PHASES as readonly string[]).includes(value)
  );
}

// An attempt row that is missing or malformed yields null, never a crash: the
// panel says "not reported" for what the payload did not carry.
function parseAttempt(value: unknown): AttemptRecord | null {
  if (value === null || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const phase = record.phase;
  return {
    attempt_id: stringField(record, 'attempt_id'),
    ordinal: numberField(record, 'ordinal'),
    phase: isAttemptPhase(phase) ? phase : null,
    runner_id: stringField(record, 'runner_id'),
    runner_slot: numberField(record, 'runner_slot'),
    slot: numberField(record, 'slot'),
    launched_at: stringField(record, 'launched_at'),
    ended_at: stringField(record, 'ended_at'),
    end_reason: stringField(record, 'end_reason'),
    end_evidence: stringField(record, 'end_evidence'),
    outcome: stringField(record, 'outcome'),
    attested_by: stringField(record, 'attested_by'),
    approved_by: stringField(record, 'approved_by'),
    principal: stringField(record, 'principal'),
    launch_count: numberField(record, 'launch_count'),
  };
}

function parseAttempts(value: unknown): AttemptRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(parseAttempt)
    .filter((attempt): attempt is AttemptRecord => attempt !== null);
}

// A condition the read carried but this build cannot name is still a
// condition: its `kind` is kept and the panel says it cannot describe it.
function parseCondition(value: unknown): ContractCondition | null {
  if (value === null || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const kind = stringField(record, 'kind');
  if (kind === null) {
    return null;
  }
  return {
    kind,
    name: stringField(record, 'name'),
    field: stringField(record, 'field'),
    equals: record.equals,
    settle: stringField(record, 'settle'),
    verdict: stringField(record, 'verdict'),
    evidence_kind: stringField(record, 'evidence_kind'),
  };
}

function parseConditions(value: unknown): ContractCondition[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(parseCondition)
    .filter((condition): condition is ContractCondition => condition !== null);
}

function edgeRefs(
  taskId: string,
  edges: GraphEdge[],
  nodeKeyById: Map<string, string>,
  kind: EdgeKind,
): TreeEdgeRef[] {
  return edges
    .filter((edge) => edge.to === taskId && edge.kind === kind)
    .map((edge) => ({
      task_id: edge.from,
      node_key: nodeKeyById.get(edge.from) ?? null,
      satisfied_by: Array.isArray(edge.satisfied_by) ? edge.satisfied_by : null,
    }));
}

// Nodes that sit on a parent cycle. Iterative colouring over the parent
// pointer: 1 = on the current path, 2 = finished.
function findCycleMembers(
  nodes: readonly GraphNode[],
  nodeById: Map<string, GraphNode>,
  parentOf: Map<string, string | null>,
): Set<string> {
  const marks = new Map<string, 1 | 2>();
  const cycle = new Set<string>();

  for (const start of nodes) {
    if (marks.get(start.task_id) === 2) {
      continue;
    }
    const path: string[] = [];
    let cursor: string | null = start.task_id;
    while (cursor !== null && nodeById.has(cursor) && marks.get(cursor) !== 2) {
      if (marks.get(cursor) === 1) {
        const from = path.indexOf(cursor);
        for (const member of path.slice(from)) {
          cycle.add(member);
        }
        break;
      }
      marks.set(cursor, 1);
      path.push(cursor);
      cursor = parentOf.get(cursor) ?? null;
    }
    for (const member of path) {
      marks.set(member, 2);
    }
  }
  return cycle;
}

// Whether a node's parent chain ends outside the read (null, the container, or
// a node the read did not return) rather than in a cycle.
function escapesRead(
  startId: string,
  nodeById: Map<string, GraphNode>,
  parentOf: Map<string, string | null>,
  cycle: ReadonlySet<string>,
  memo: Map<string, boolean>,
): boolean {
  const path: string[] = [];
  const seen = new Set<string>();
  let cursor: string | null = startId;
  let result = false;

  while (true) {
    if (cursor === null || !nodeById.has(cursor)) {
      result = true;
      break;
    }
    if (cycle.has(cursor)) {
      result = false;
      break;
    }
    const known = memo.get(cursor);
    if (known !== undefined) {
      result = known;
      break;
    }
    if (seen.has(cursor)) {
      result = false;
      break;
    }
    seen.add(cursor);
    path.push(cursor);
    cursor = parentOf.get(cursor) ?? null;
  }

  for (const member of path) {
    memo.set(member, result);
  }
  return result;
}

function subtreeSize(row: TreeRow): number {
  return 1 + row.children.reduce((sum, child) => sum + subtreeSize(child), 0);
}

export function buildTree(snapshot: EngineTreeSnapshot): TreeModel {
  const statusById = new Map(
    snapshot.statuses.map((status) => [status.task_id, status]),
  );

  // `task create --tree-key` also writes the tree's container as a task row.
  // It is identified by task_id, not by the literal key: a project with more
  // than one tree has more than one `$root` row, and only the requested one is
  // this read's container.
  const hiddenContainer =
    snapshot.graph.nodes.find(
      (node) => node.task_id === snapshot.root_task_id,
    ) ?? null;

  // A graph payload that repeats a task_id must not become two roots or two
  // counted rows. First row wins, the way a map would; the repeat contributes
  // nothing, and is named as a read defect so the difference is not silent.
  // `graph --tree` does not emit one today; the model is not silent about a
  // payload that does.
  const seenNodeIds = new Set<string>();
  const duplicateKeys: string[] = [];
  const nodes = snapshot.graph.nodes.filter((node) => {
    if (node === hiddenContainer) {
      seenNodeIds.add(node.task_id);
      return false;
    }
    if (seenNodeIds.has(node.task_id)) {
      duplicateKeys.push(node.node_key);
      return false;
    }
    seenNodeIds.add(node.task_id);
    return true;
  });
  const nodeById = new Map(nodes.map((node) => [node.task_id, node]));
  const nodeKeyById = new Map(nodes.map((node) => [node.task_id, node.node_key]));
  const parentOf = new Map<string, string | null>(
    nodes.map((node) => [node.task_id, node.parent_task_id]),
  );

  const cycle = findCycleMembers(nodes, nodeById, parentOf);
  const escapeMemo = new Map<string, boolean>();
  const unreachable = new Set<string>();
  for (const node of nodes) {
    if (
      !cycle.has(node.task_id) &&
      !escapesRead(node.task_id, nodeById, parentOf, cycle, escapeMemo)
    ) {
      unreachable.add(node.task_id);
    }
  }

  const childrenByParent = new Map<string, GraphNode[]>();
  const rootNodes: GraphNode[] = [];
  for (const node of nodes) {
    if (cycle.has(node.task_id) || unreachable.has(node.task_id)) {
      continue;
    }
    const parent = node.parent_task_id;
    if (parent !== null && nodeById.has(parent)) {
      const siblings = childrenByParent.get(parent);
      if (siblings) {
        siblings.push(node);
      } else {
        childrenByParent.set(parent, [node]);
      }
    } else {
      rootNodes.push(node);
    }
  }

  const counts = emptyCounts();
  const emitted = new Set<string>();
  let unknownRestStates = 0;

  const visit = (node: GraphNode, depth: number): TreeRow => {
    emitted.add(node.task_id);
    const status = statusById.get(node.task_id);
    const statusRecord = (status ?? {}) as Record<string, unknown>;
    const restState = status ? status.rest_state : node.rest_state;
    const restStateKnown = isRestState(restState);
    const children = (childrenByParent.get(node.task_id) ?? [])
      .filter((child) => !emitted.has(child.task_id))
      .map((child) => visit(child, depth + 1));

    if (restStateKnown) {
      counts[restState] += 1;
    } else {
      unknownRestStates += 1;
    }

    const parent = node.parent_task_id;
    const parentInRead = parent !== null && nodeById.has(parent);
    const parentIsContainer = parent === snapshot.root_task_id;
    const lifted = parent !== null && !parentInRead && !parentIsContainer;

    return {
      task_id: node.task_id,
      node_key: node.node_key,
      parent_task_id: node.parent_task_id,
      title: stringField(statusRecord, 'title') ?? stringField(node, 'title'),
      rest_state: restState,
      rest_state_known: restStateKnown,
      archived_at:
        stringField(statusRecord, 'archived_at') ?? stringField(node, 'archived_at'),
      phase: status ? status.phase : null,
      slot: status ? status.slot : null,
      slot_limit: numberField(statusRecord, 'slot_limit'),
      created_at:
        stringField(statusRecord, 'created_at') ?? stringField(node, 'created_at'),
      updated_at:
        stringField(statusRecord, 'updated_at') ?? stringField(node, 'updated_at'),
      attempts: parseAttempts(statusRecord.attempts),
      body: stringField(statusRecord, 'body'),
      body_read: reports([statusRecord], 'body'),
      conditions: parseConditions(statusRecord.conditions),
      conditions_read:
        reports([statusRecord], 'conditions') &&
        Array.isArray(statusRecord.conditions),
      mirror: stringField(statusRecord, 'mirror'),
      runner_slot: numberField(statusRecord, 'runner_slot'),
      runner_slot_reported: reports([statusRecord], 'runner_slot'),
      runner_id: stringField(statusRecord, 'runner_id'),
      runner_id_reported: reports([statusRecord], 'runner_id'),
      wait: status ? (status.wait ?? null) : null,
      hold: status ? (status.hold ?? null) : null,
      handoff_revision: status ? status.handoff_revision : null,
      blocked_by: edgeRefs(
        node.task_id,
        snapshot.graph.edges,
        nodeKeyById,
        'blocked_by',
      ),
      after: edgeRefs(node.task_id, snapshot.graph.edges, nodeKeyById, 'after'),
      depth,
      children,
      status_missing: !status,
      rest_state_mismatch: status
        ? status.rest_state !== node.rest_state
        : false,
      rerooted: lifted
        ? { parent_task_id: parent, subtree_tasks: 0 }
        : null,
    };
  };

  const roots = rootNodes.map((node) => visit(node, 0));

  // The engine's `tree_state` (INTERFACE §1) is derived at read time. The root
  // row's `archived_at` decides `archived`; otherwise every row's rest state
  // decides `completed`. The hidden container is a task row too, so it is part
  // of the "every row" question exactly as it is in the engine.
  const allRows = [...(hiddenContainer === null ? [] : [hiddenContainer]), ...nodes];
  const terminal = new Set<string>(['done', 'failed', 'cancelled', 'skipped']);
  const treeState: TreeState =
    hiddenContainer !== null && stringField(hiddenContainer, 'archived_at') !== null
      ? 'archived'
      : allRows.length > 0 &&
          allRows.every((node) =>
            terminal.has(statusById.get(node.task_id)?.rest_state ?? node.rest_state),
          )
        ? 'completed'
        : 'open';

  const defects: TreeDefect[] = [];
  if (duplicateKeys.length > 0) {
    defects.push({
      kind: 'duplicate',
      tasks: duplicateKeys.length,
      keys: duplicateKeys,
    });
  }
  if (cycle.size > 0) {
    defects.push({
      kind: 'cycle',
      tasks: cycle.size,
      keys: nodes
        .filter((node) => cycle.has(node.task_id))
        .map((node) => node.node_key),
    });
  }
  if (unreachable.size > 0) {
    defects.push({
      kind: 'unreachable',
      tasks: unreachable.size,
      keys: nodes
        .filter((node) => unreachable.has(node.task_id))
        .map((node) => node.node_key),
    });
  }

  const liftedRoots = roots.filter((row) => row.rerooted !== null);
  for (const row of liftedRoots) {
    (row.rerooted as RerootedInfo).subtree_tasks = subtreeSize(row);
  }
  if (liftedRoots.length > 0) {
    defects.push({
      kind: 'rerooted',
      tasks: liftedRoots.reduce(
        (sum, row) => sum + (row.rerooted as RerootedInfo).subtree_tasks,
        0,
      ),
      keys: liftedRoots.map((row) => row.node_key),
    });
  }

  const maxDepth = roots.length === 0 ? 0 : maxDepthOf(roots);

  return {
    project_id: snapshot.project.project_id,
    config_revision: snapshot.project.config_revision,
    tree_key: snapshot.tree_key,
    root_task_id: snapshot.root_task_id,
    tree_state: treeState,
    provenance: snapshot.provenance,
    runners: snapshot.runners,
    runners_available: snapshot.runners_available,
    roots,
    counts,
    unknown_rest_states: unknownRestStates,
    total: emitted.size,
    nodes_read: nodes.length,
    unplaced: nodes.length - emitted.size,
    max_depth: maxDepth,
    defects,
    hidden_container: hiddenContainer,
    slot_limit: slotLimitOf(snapshot.project),
    capabilities: deriveCapabilities(snapshot),
  };
}

function maxDepthOf(rows: readonly TreeRow[]): number {
  let deepest = 0;
  for (const row of rows) {
    deepest = Math.max(deepest, row.depth, maxDepthOf(row.children));
  }
  return deepest;
}

// A stable flat order for tests, the renderer and a future keyboard layer.
export function flattenTree(rows: TreeRow[]): TreeRow[] {
  const flat: TreeRow[] = [];
  for (const row of rows) {
    flat.push(row);
    flat.push(...flattenTree(row.children));
  }
  return flat;
}
