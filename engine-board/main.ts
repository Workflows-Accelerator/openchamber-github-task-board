// Build the board from the live engine.
//
//   node engine-board/main.ts --db <store> --project <id> --tree-key <key> --root <task id>
//
// Every payload comes from the engine CLI. When there is no store to read —
// no `--db`/`TASK_DB`, no file at that path, or no engine binary — the build
// answers from the committed capture in `fixtures/` instead of failing. That
// capture is itself the engine's own `--json` output, so the page has one
// renderer and two sources, not two pages.
//
// Writes two pages next to this file: `index.html` (Board, the default view)
// and `list.html` (List).

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTree } from './model.ts';
import { renderBoardPage, renderListPage } from './board-render.ts';
import { createCliSource, fixtureRequest } from './live-source.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures');

interface Options {
  db: string;
  project: string;
  treeKey: string;
  root: string;
  engine: string;
}

function usage(message: string): never {
  console.error(`engine-board: ${message}`);
  console.error(
    'usage: node engine-board/main.ts [--db PATH --project ID --tree-key KEY --root TASK_ID] [--engine PATH]',
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
  return { db, project, treeKey, root, engine };
}

const options = parseArgs(process.argv.slice(2));
const source = createCliSource({
  enginePath: options.engine,
  dbPath: options.db,
  fallbackDirectory: fixtures,
});
const snapshot = await source.load({
  project_id: options.project,
  tree_key: options.treeKey,
  root_task_id: options.root,
});
const model = buildTree(snapshot);

writeFileSync(join(here, 'index.html'), renderBoardPage(model));
writeFileSync(join(here, 'list.html'), renderListPage(model));

console.log(
  `wrote engine-board/index.html and engine-board/list.html from ${model.provenance.source_kind} task-engine@${model.provenance.engine_commit || 'unknown'} at ${model.provenance.read_at} (${model.total} tasks)`,
);
