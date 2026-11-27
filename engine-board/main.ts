// Build the board from the live engine, or from one snapshot the serve layer
// wrote.
//
//   node engine-board/main.ts --db <store> --project <id> --tree-key <key> --root <task id>
//   node engine-board/main.ts --snapshot <abs path> --out <abs dir>
//
// Every payload comes from the engine CLI. When there is no store to read —
// no `--db`/`TASK_DB`, no file at that path, or no engine binary — the build
// answers from the committed capture in `fixtures/` instead of failing. That
// capture is itself the engine's own `--json` output, so the page has one
// renderer and two sources, not two pages.
//
// `--snapshot` replaces the engine read with one file the serve layer wrote:
// the `EngineTreeSnapshot` shape plus `served: true`. A missing or unreadable
// snapshot fails; it never falls back to the capture. The file's `served`
// value alone decides whether the authoring client is rendered.
//
// `--out` writes the two pages into that directory, created if absent, instead
// of next to this file. With neither flag the repo artefact is built exactly as
// before: `index.html` (Board, the default view) and `list.html` (List).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTree } from './model.ts';
import type { EngineTreeSnapshot, TreeModel } from './model.ts';
import { renderBoardPage, renderListPage } from './board-render.ts';
import { createCliSource, fixtureRequest } from './live-source.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures');

interface Options {
  // The serve layer's one file, or null to read the engine / capture.
  snapshot: string | null;
  // The directory to write into, or null for the repo's engine-board/.
  out: string | null;
  db: string;
  project: string;
  treeKey: string;
  root: string;
  engine: string;
}

// The snapshot is the live read's own shape plus the serve layer's two
// additions: `served` on the file and `actions` on each node.
interface SnapshotFile extends EngineTreeSnapshot {
  served?: boolean;
}

function usage(message: string): never {
  console.error(`engine-board: ${message}`);
  console.error(
    'usage: node engine-board/main.ts [--db PATH --project ID --tree-key KEY --root TASK_ID] [--engine PATH]',
  );
  console.error(
    '   or: node engine-board/main.ts --snapshot FILE [--out DIR]',
  );
  console.error(
    'without --db (or TASK_DB) the committed capture in engine-board/fixtures is rendered',
  );
  process.exit(2);
}

function parseArgs(argv: string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!flag.startsWith('--')) {
      usage(`unexpected argument ${flag}`);
    }
    const value = argv[index + 1];
    if (value === undefined) {
      usage(`${flag} takes a value`);
    }
    values.set(flag.slice(2), value);
    index += 1;
  }
  const snapshot = values.get('snapshot') ?? null;
  const out = values.get('out') ?? null;
  if (snapshot !== null && snapshot === '') {
    usage('--snapshot takes a file');
  }
  if (out !== null && out === '') {
    usage('--out takes a directory');
  }
  // A snapshot is the whole read. Mixing it with source flags would leave two
  // answers for one page, so the contradiction is refused rather than ranked.
  if (snapshot !== null) {
    for (const flag of ['db', 'project', 'tree-key', 'root', 'engine']) {
      if (values.has(flag)) {
        usage(`--snapshot replaces the engine read; drop --${flag}`);
      }
    }
    return {
      snapshot,
      out,
      db: '',
      project: '',
      treeKey: '',
      root: '',
      engine: '',
    };
  }

  const db = values.get('db') ?? process.env.TASK_DB ?? '';
  const engine =
    values.get('engine') ??
    process.env.ENGINE_PATH ??
    '/workspace/code/task-engine';

  // With no store the capture names the request it answered. Explicit flags
  // still win, and a mismatch is refused by the source rather than ignored.
  let fallback = { project_id: '', tree_key: '', root_task_id: '' };
  if (db === '') {
    fallback = fixtureRequest(fixtures);
  }
  const project =
    values.get('project') ?? process.env.ENGINE_PROJECT ?? fallback.project_id;
  const treeKey =
    values.get('tree-key') ?? process.env.ENGINE_TREE_KEY ?? fallback.tree_key;
  const root =
    values.get('root') ?? process.env.ENGINE_ROOT_TASK_ID ?? fallback.root_task_id;
  if (project === '') usage('no project; pass --project');
  if (treeKey === '') usage('no tree key; pass --tree-key');
  if (root === '') usage('no tree root; pass --root');
  return { snapshot: null, out, db, project, treeKey, root, engine };
}

function recordAt(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

// What the snapshot file must carry for the model to draw the same page a live
// read would. A shape this page cannot read is a bad handover, not an empty
// tree: name the file and stop.
function snapshotProblem(value: unknown): string | null {
  const root = recordAt(value);
  if (root === null) return 'the file is not a JSON object';
  if (recordAt(root.provenance) === null) return 'no provenance object';
  if (recordAt(root.project) === null) return 'no project object';
  if (!Array.isArray(root.runners)) return 'no runners array';
  // False and an empty list mean different things: not read vs none.
  if (typeof root.runners_available !== 'boolean') {
    return 'no runners_available flag';
  }
  const graph = recordAt(root.graph);
  if (graph === null) return 'no graph object';
  if (!Array.isArray(graph.nodes)) return 'no graph.nodes array';
  if (!Array.isArray(graph.edges)) return 'no graph.edges array';
  if (!Array.isArray(root.statuses)) return 'no statuses array';
  if (typeof root.tree_key !== 'string' || root.tree_key === '') {
    return 'no tree_key';
  }
  if (typeof root.root_task_id !== 'string' || root.root_task_id === '') {
    return 'no root_task_id';
  }
  if ('served' in root && typeof root.served !== 'boolean') {
    return 'served is not a boolean';
  }
  return null;
}

function snapshotFatal(path: string, detail: string): never {
  console.error(`engine-board: snapshot ${path}: ${detail}`);
  process.exit(1);
}

function readSnapshot(path: string): SnapshotFile {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    snapshotFatal(path, (error as Error).message);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    snapshotFatal(path, `not JSON: ${(error as Error).message}`);
  }
  const problem = snapshotProblem(parsed);
  if (problem !== null) {
    snapshotFatal(path, problem);
  }
  return parsed as SnapshotFile;
}

function buildFromSnapshot(path: string): {
  model: TreeModel;
  served: boolean;
} {
  const snapshot = readSnapshot(path);
  try {
    return {
      model: buildTree(snapshot),
      // Serve v1.2: the file alone decides. There is no second flag to
      // disagree with it.
      served: snapshot.served === true,
    };
  } catch (error) {
    snapshotFatal(path, (error as Error).message);
  }
}

const options = parseArgs(process.argv.slice(2));
const built =
  options.snapshot !== null
    ? buildFromSnapshot(options.snapshot)
    : {
        model: buildTree(
          await createCliSource({
            enginePath: options.engine,
            dbPath: options.db,
            fallbackDirectory: fixtures,
          }).load({
            project_id: options.project,
            tree_key: options.treeKey,
            root_task_id: options.root,
          }),
        ),
        served: false,
      };
const { model, served } = built;

const outDir = options.out ?? here;
if (options.out !== null) {
  // The engine hands over a directory it may not have created yet. Nothing is
  // read back from here, so an absent directory is the normal case.
  mkdirSync(options.out, { recursive: true });
}
const pageOptions = served ? { served: true } : {};
writeFileSync(join(outDir, 'index.html'), renderBoardPage(model, pageOptions));
writeFileSync(join(outDir, 'list.html'), renderListPage(model, pageOptions));

const shown = options.out ?? 'engine-board';
const from =
  options.snapshot !== null
    ? `snapshot ${options.snapshot}`
    : model.provenance.source_kind;
console.log(
  `wrote ${join(shown, 'index.html')} and ${join(shown, 'list.html')} from ${from} task-engine@${model.provenance.engine_commit || 'unknown'} at ${model.provenance.read_at} (${model.total} tasks)`,
);
