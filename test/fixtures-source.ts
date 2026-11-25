// ==========================================
// Fixture source (tests only)
//
// The same `EngineTreeSource` seam as the live source, over the frozen verb
// payloads in `engine-board/fixtures/`. It lives under `test/` because no
// shipped page imports it: the pages are built from the live engine, and this
// is a fixture, not an alternative implementation.
// ==========================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  EngineTreeSnapshot,
  EngineTreeSource,
  GraphPayload,
  ProjectPayload,
  RestState,
  RunnerRow,
  StatusPayload,
  TreeRequest,
} from '../engine-board/model.ts';

export interface FixtureMeta {
  engine: {
    path: string;
    commit: string;
    schema_revision: number;
  };
  captured_at: string;
  project_id: string;
  tree_key: string;
  root_task_id: string;
  container_node_key: string;
  read_verbs: string[];
  port_only_steps: string[];
  unobserved_states: RestState[];
  notes: string[];
}

interface RunnersPayload {
  runners: RunnerRow[];
}

interface StatusesPayload {
  tasks: StatusPayload[];
}

function readJson<T>(directory: string, name: string): T {
  return JSON.parse(readFileSync(join(directory, name), 'utf8')) as T;
}

export function readFixtureMeta(directory: string): FixtureMeta {
  return readJson<FixtureMeta>(directory, 'meta.json');
}

export function loadFixtureSnapshot(
  directory: string,
  meta: FixtureMeta = readFixtureMeta(directory),
): EngineTreeSnapshot {
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
    project: readJson<ProjectPayload>(directory, 'project.json'),
    runners: readJson<RunnersPayload>(directory, 'runners.json').runners,
    // The fixture capture read the runner list; a failed read would have
    // stopped the capture instead of writing an empty file.
    runners_available: true,
    graph: readJson<GraphPayload>(directory, 'graph.json'),
    statuses: readJson<StatusesPayload>(directory, 'status.json').tasks,
    tree_key: meta.tree_key,
    root_task_id: meta.root_task_id,
  };
}

export function createFixtureSource(directory: string): EngineTreeSource {
  return {
    async load(request: TreeRequest): Promise<EngineTreeSnapshot> {
      const meta = readFixtureMeta(directory);
      if (meta.project_id !== request.project_id) {
        throw new Error(
          `fixture project is ${meta.project_id}, requested ${request.project_id}`,
        );
      }
      if (meta.tree_key !== request.tree_key) {
        throw new Error(
          `fixture tree_key is ${meta.tree_key}, requested ${request.tree_key}`,
        );
      }
      if (meta.root_task_id !== request.root_task_id) {
        throw new Error(
          `fixture root_task_id is ${meta.root_task_id}, requested ${request.root_task_id}`,
        );
      }
      return loadFixtureSnapshot(directory, meta);
    },
  };
}
