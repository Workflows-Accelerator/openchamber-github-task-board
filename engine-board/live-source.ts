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
import { join } from 'node:path';

import type {
  EngineTreeSnapshot,
  EngineTreeSource,
  GraphEdge,
  GraphNode,
  GraphPayload,
  ProjectPayload,
  StatusPayload,
  TreeRequest,
} from './model.ts';

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
  if (raw.next_cursor !== null) {
    throw new Error(
      'graph tree read did not prove it is whole: next_cursor is not null',
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

function normalizeProject(text: string): ProjectPayload {
  const record = recordOf(parseJson(text, 'project'), 'project payload');
  requiredString(record, 'project_id', 'project payload');
  if (typeof record.config_revision !== 'number') {
    throw new Error('project payload has no config_revision');
  }
  return record as unknown as ProjectPayload;
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
      const project = normalizeProject(
        await command(['project', 'show', '--project', request.project_id, '--json']),
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
            'task store check --json',
          ],
          // A live read writes nothing and observes whatever the store holds;
          // an empty count is the store's answer, not a missing capture.
          port_only_steps: [],
          unobserved_states: [],
        },
        project,
        // `task runner list` is not read: the detail panel's runner fields come
        // from `task status`, and `false` keeps an empty list from meaning
        // "there are none".
        runners: [],
        runners_available: false,
        graph,
        statuses,
        tree_key: request.tree_key,
        root_task_id: request.root_task_id,
      };
    },
  };
}
