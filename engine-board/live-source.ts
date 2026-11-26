// ==========================================
// Live source
//
// The same `EngineTreeSource` seam the fixture fills, but every payload comes
// from the engine's own CLI. No capture sits in between: the engine binary is
// invoked, its `--json` is parsed, and the provenance names the revision that
// answered and the moment it answered.
//
// Two shapes had to be read defensively because the CLI is a moving surface:
//
//   - `task status --json` prints a bare object for one id and `{"tasks":[…]}` for
//     two or more (GAPS G10a). Both are accepted.
//   - `task graph --json` printed `{from,to,kind}` edges at schema 7 and prints
//     `{blocker_task_id,blocked_task_id,kind}` now. Both are accepted, and the
//     model keeps its single `{from,to,kind}` shape.
// ==========================================

import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  EngineTreeSnapshot,
  EngineTreeSource,
  GraphEdge,
  GraphNode,
  GraphPayload,
  ProjectPayload,
  RestState,
  RunnerRow,
  StatusPayload,
  TreeRequest,
} from './model.ts';
import { REST_STATES } from './model.ts';

export interface LiveSourceOptions {
  // The engine repository. Its `bin/task` is the entry point.
  enginePath: string;
  // The store file, passed as `--db`.
  dbPath: string;
  // Test seams. Production leaves both unset.
  command?: (args: string[]) => Promise<string>;
  readCommit?: () => Promise<string>;
  now?: () => Date;
}

export interface CliSourceOptions extends LiveSourceOptions {
  // Where the committed capture lives. A source with no readable store, or no
  // engine binary, answers from here instead of failing to draw a page.
  fallbackDirectory: string;
}

interface FixtureMeta {
  engine: {
    commit: string;
    schema_revision: number;
  };
  captured_at: string;
  project_id: string;
  tree_key: string;
  root_task_id: string;
  read_verbs: string[];
  port_only_steps: string[];
  unobserved_states: RestState[];
}

interface GraphPayloadRead {
  nodes?: unknown;
  edges?: unknown;
  truncated?: unknown;
  omitted?: unknown;
  next_cursor?: unknown;
}

function recordOf(value: unknown, what: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${what} is not a JSON object`);
  }
  return value as Record<string, unknown>;
}

function requiredString(
  record: Record<string, unknown>,
  field: string,
  what: string,
): string {
  const value = record[field];
  if (typeof value !== 'string' || value === '') {
    throw new Error(`${what} has no ${field}`);
  }
  return value;
}

function optionalString(
  record: Record<string, unknown>,
  field: string,
): string | null {
  const value = record[field];
  return typeof value === 'string' ? value : null;
}

function parseJson(text: string, what: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${what} is not JSON: ${(error as Error).message}`);
  }
}

function runFile(argv: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      argv[0],
      argv.slice(1),
      { maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `${argv.join(' ')} failed: ${(stderr || error.message).trim()}`,
            ),
          );
          return;
        }
        resolve(stdout);
      },
    );
  });
}

// `task graph` at the current revision prints names that say which end is
// which; older payloads print `from`/`to`. One internal shape, no guessing
// beyond those two spellings.
function normalizeEdge(value: unknown): GraphEdge {
  const record = recordOf(value, 'graph edge');
  const from =
    optionalString(record, 'from') ??
    optionalString(record, 'blocker_task_id');
  const to =
    optionalString(record, 'to') ??
    optionalString(record, 'blocked_task_id');
  const kind = record.kind;
  if (from === null || to === null) {
    throw new Error('graph edge names no both ends');
  }
  if (kind !== 'blocked_by' && kind !== 'after') {
    throw new Error(`graph edge has an unknown kind: ${String(kind)}`);
  }
  // The engine's own answer to "which blocker states satisfy this edge". A
  // schema-7 payload has no field at all; null is "not read", never `done`.
  const rawSatisfied = record.satisfied_by;
  let satisfiedBy: string[] | null = null;
  if (rawSatisfied !== undefined && rawSatisfied !== null) {
    if (
      !Array.isArray(rawSatisfied) ||
      rawSatisfied.some((state) => typeof state !== 'string')
    ) {
      throw new Error(`graph edge has an unreadable satisfied_by: ${String(rawSatisfied)}`);
    }
    satisfiedBy = [...rawSatisfied];
  }
  return { from, to, kind, satisfied_by: satisfiedBy };
}

function normalizeNode(value: unknown): GraphNode {
  const record = recordOf(value, 'graph node');
  const taskId = requiredString(record, 'task_id', 'graph node');
  requiredString(record, 'node_key', `graph node ${taskId}`);
  const parent = record.parent_task_id;
  if (parent !== null && typeof parent !== 'string') {
    throw new Error(`graph node ${taskId} has no parent_task_id`);
  }
  // `rest_state` is passed through untouched, null included: the model flags
  // a value outside the vocabulary instead of the source dropping the node.
  return record as unknown as GraphNode;
}

function normalizeGraph(text: string): GraphPayload {
  const raw = recordOf(parseJson(text, 'graph'), 'graph payload') as GraphPayloadRead;
  if (!Array.isArray(raw.nodes)) {
    throw new Error('graph payload has no nodes array');
  }
  if (!Array.isArray(raw.edges)) {
    throw new Error('graph payload has no edges array');
  }
  // A tree read is whole by contract: `--tree` refuses a cursor and never
  // pages, and the verb says so with `next_cursor: null`. A cursor, or a
  // payload that does not say, is refused rather than rendered as a tree whose
  // missing tasks would simply look absent.
  if (raw.truncated === true) {
    const omitted = typeof raw.omitted === 'number' ? raw.omitted : 'some';
    throw new Error(`graph tree read is truncated: ${omitted} tasks omitted`);
  }
  if (!('next_cursor' in raw)) {
    throw new Error(
      'graph tree read did not declare completeness: next_cursor is missing',
    );
  }
  if (raw.next_cursor !== null) {
    throw new Error(
      `graph tree read is paged (next_cursor ${String(
        raw.next_cursor,
      )}); this is not a whole tree`,
    );
  }
  return {
    nodes: raw.nodes.map(normalizeNode),
    edges: raw.edges.map(normalizeEdge),
  };
}

// G10a: one id prints the status object itself; two or more print `tasks`.
function normalizeStatuses(text: string): StatusPayload[] {
  const parsed = parseJson(text, 'status');
  if (Array.isArray(parsed)) {
    return parsed.map((value) => {
      const record = recordOf(value, 'status row');
      requiredString(record, 'task_id', 'status row');
      return record as unknown as StatusPayload;
    });
  }
  const record = recordOf(parsed, 'status payload');
  if (Array.isArray(record.tasks)) {
    return record.tasks.map((value) => {
      const row = recordOf(value, 'status row');
      requiredString(row, 'task_id', 'status row');
      return row as unknown as StatusPayload;
    });
  }
  requiredString(record, 'task_id', 'status payload');
  return [record as unknown as StatusPayload];
}

// The model reads a row's state from `status` when the status read carries the
// row, and from the graph otherwise. The states this read did not reach must be
// computed from that same merged view: a task that changed between the two
// reads must not make the provenance contradict the page.
function unobservedIn(
  graph: GraphPayload,
  statuses: readonly StatusPayload[],
): RestState[] {
  const fromStatus = new Map(
    statuses.map((status) => [status.task_id, status.rest_state]),
  );
  const seen = new Set(
    graph.nodes.map((node) => fromStatus.get(node.task_id) ?? node.rest_state),
  );
  return REST_STATES.filter((state) => !seen.has(state));
}

function normalizeProject(text: string): ProjectPayload {
  const record = recordOf(parseJson(text, 'project'), 'project payload');
  requiredString(record, 'project_id', 'project payload');
  if (typeof record.config_revision !== 'number') {
    throw new Error('project payload has no config_revision');
  }
  return record as unknown as ProjectPayload;
}

function normalizeRunners(text: string): RunnerRow[] {
  const record = recordOf(parseJson(text, 'runner list'), 'runner list payload');
  if (!Array.isArray(record.runners)) {
    throw new Error('runner list payload has no runners array');
  }
  return record.runners.map((value) => {
    const runner = recordOf(value, 'runner row');
    requiredString(runner, 'runner_id', 'runner row');
    requiredString(runner, 'kind', 'runner row');
    return runner as unknown as RunnerRow;
  });
}

function schemaOf(text: string): number {
  const record = recordOf(parseJson(text, 'store check'), 'store check payload');
  if (typeof record.schema_revision !== 'number') {
    throw new Error('store check payload has no schema_revision');
  }
  return record.schema_revision;
}

export function createLiveSource(options: LiveSourceOptions): EngineTreeSource {
  const command =
    options.command ??
    ((args: string[]) =>
      runFile([join(options.enginePath, 'bin', 'task'), '--db', options.dbPath, ...args]));
  const readCommit =
    options.readCommit ??
    (async () => {
      try {
        return (await runFile(['git', '-C', options.enginePath, 'rev-parse', '--short=7', 'HEAD'])).trim();
      } catch {
        // A read that cannot name the revision it read is still a read; the
        // provenance says so and the page prints Unknown source (ruling 7).
        return '';
      }
    });
  const now = options.now ?? (() => new Date());

  return {
    async load(request: TreeRequest): Promise<EngineTreeSnapshot> {
      const graphText = await command([
        'graph',
        '--project',
        request.project_id,
        '--tree',
        request.root_task_id,
        '--json',
      ]);
      const graph = normalizeGraph(graphText);

      if (!graph.nodes.some((node) => node.task_id === request.root_task_id)) {
        throw new Error(
          `tree root ${request.root_task_id} is not in the graph read; the request names another tree`,
        );
      }
      const rootNode = graph.nodes.find(
        (node) => node.task_id === request.root_task_id,
      );
      if (rootNode !== undefined) {
        const treeKey = rootNode.tree_key;
        if (typeof treeKey === 'string' && treeKey !== request.tree_key) {
          throw new Error(
            `tree ${request.root_task_id} is ${treeKey}, requested ${request.tree_key}`,
          );
        }
      }

      const ids = graph.nodes.map((node) => node.task_id);
      const statuses =
        ids.length === 0
          ? []
          : normalizeStatuses(
              await command(['status', ...ids, '--json']),
            );
      // The model reads a row's state from the status read when it is there.
      // A status answer that silently omits a tree row would draw that row
      // without its attempts, wait or runner, so a partial answer is refused
      // rather than rendered as a poorer task.
      const statusIds = new Set(statuses.map((status) => status.task_id));
      const missing = ids.filter((id) => !statusIds.has(id));
      if (missing.length > 0) {
        throw new Error(
          `status read omitted ${missing.length} tree task(s): ${missing.join(', ')}`,
        );
      }
      const project = normalizeProject(
        await command(['project', 'show', '--project', request.project_id, '--json']),
      );
      const runners = normalizeRunners(
        await command(['runner', 'list', '--project', request.project_id, '--json']),
      );
      const schemaRevision = schemaOf(await command(['store', 'check', '--json']));

      return {
        provenance: {
          source_kind: 'live',
          read_at: now().toISOString(),
          engine_commit: await readCommit(),
          schema_revision: schemaRevision,
          operations: [
            `task graph --project ${request.project_id} --tree ${request.root_task_id} --json`,
            'task status <every tree task id> --json',
            `task project show --project ${request.project_id} --json`,
            `task runner list --project ${request.project_id} --json`,
            'task store check --json',
          ],
          // A live read writes nothing and observes whatever the store holds.
          // It can still say which states this tree did not reach, so the page
          // is identical whichever source answered.
          port_only_steps: [],
          unobserved_states: unobservedIn(graph, statuses),
        },
        project,
        // `runner list` answers whether a runner exists; `runners_available`
        // is true because the list was read, so an empty array means none.
        runners,
        runners_available: true,
        graph,
        statuses,
        tree_key: request.tree_key,
        root_task_id: request.root_task_id,
      };
    },
  };
}

// ---------------------------------------------------------------- fallback

function readJsonFile<T>(directory: string, name: string): T {
  return JSON.parse(readFileSync(join(directory, name), 'utf8')) as T;
}

function readFixtureMeta(directory: string): FixtureMeta {
  return readJsonFile<FixtureMeta>(directory, 'meta.json');
}

// The committed capture also names the request it answered, so a build with no
// store has a tree to draw without a second copy of the project and root ids.
export function fixtureRequest(directory: string): TreeRequest {
  const meta = readFixtureMeta(directory);
  return {
    project_id: meta.project_id,
    tree_key: meta.tree_key,
    root_task_id: meta.root_task_id,
  };
}

function loadFixture(
  directory: string,
  request: TreeRequest,
): EngineTreeSnapshot {
  const meta = readFixtureMeta(directory);
  if (request.project_id !== '' && meta.project_id !== request.project_id) {
    throw new Error(
      `fixture project is ${meta.project_id}, requested ${request.project_id}`,
    );
  }
  if (request.tree_key !== '' && meta.tree_key !== request.tree_key) {
    throw new Error(
      `fixture tree_key is ${meta.tree_key}, requested ${request.tree_key}`,
    );
  }
  if (request.root_task_id !== '' && meta.root_task_id !== request.root_task_id) {
    throw new Error(
      `fixture root_task_id is ${meta.root_task_id}, requested ${request.root_task_id}`,
    );
  }
  return {
    provenance: {
      source_kind: 'fixture',
      read_at: meta.captured_at,
      engine_commit: meta.engine.commit,
      schema_revision: meta.engine.schema_revision,
      operations: meta.read_verbs,
      port_only_steps: meta.port_only_steps,
      unobserved_states: meta.unobserved_states,
    },
    project: readJsonFile<ProjectPayload>(directory, 'project.json'),
    runners: readJsonFile<{ runners: RunnerRow[] }>(directory, 'runners.json').runners,
    // The capture read the runner list; a failed read would have stopped it
    // instead of writing an empty file.
    runners_available: true,
    graph: normalizeGraph(
      readFileSync(join(directory, 'graph.json'), 'utf8'),
    ),
    statuses: readJsonFile<{ tasks: StatusPayload[] }>(directory, 'status.json').tasks,
    tree_key: meta.tree_key,
    root_task_id: meta.root_task_id,
  };
}

function storeIsReadable(options: CliSourceOptions): boolean {
  if (typeof options.command === 'function') {
    return true;
  }
  if (options.dbPath === '' || !existsSync(options.dbPath)) {
    return false;
  }
  return existsSync(join(options.enginePath, 'bin', 'task'));
}

// A page build should not turn "this machine has no store" into a stack trace.
// The absence of the CLI or the store is the one condition that falls back: a
// store that exists but refuses a read still throws, because a wrong page is
// worse than no page.
export function createCliSource(options: CliSourceOptions): EngineTreeSource {
  const live = createLiveSource(options);
  return {
    async load(request: TreeRequest): Promise<EngineTreeSnapshot> {
      if (storeIsReadable(options)) {
        return live.load(request);
      }
      return loadFixture(options.fallbackDirectory, request);
    },
  };
}
