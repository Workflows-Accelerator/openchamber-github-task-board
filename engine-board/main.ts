// Regenerate engine-board/index.html from the frozen capture.
//
//   node engine-board/main.ts
//
// No bundler: Node 22 runs the TypeScript directly, and the page is static.
// The source seam is the only place a later live reader has to change.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTree } from './model.ts';
import { renderBoard } from './render.ts';
import { createFixtureSource, readFixtureMeta } from './fixtures/source.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures');
const meta = readFixtureMeta(fixtures);
const source = createFixtureSource(fixtures);
const snapshot = await source.load({
  project_id: meta.project_id,
  tree_key: meta.tree_key,
  root_task_id: meta.root_task_id,
});
const model = buildTree(snapshot);
const html = renderBoard(model);

writeFileSync(join(here, 'index.html'), html);
console.log(
  `wrote engine-board/index.html from ${model.provenance.engine_commit} (${model.total} tasks)`,
);
