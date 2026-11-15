import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseManifestJson } from '@openchamber/sdk/schemas';
import { isGuestPackageSvgIcon } from '@openchamber/sdk';
import { TASK_BOARD_INSTRUCTIONS } from '../service/instructions.ts';

/**
 * The manifest, the skill and the agent text are contract, not copy: the host
 * parses the first, an agent reads the other two. This test pins the wave-1
 * contribution points, the removed root duplicate and the exact lengths.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const manifestText = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
const raw = JSON.parse(manifestText);

test('board-manifest: the package parses with the installed SDK', () => {
  const parsed = parseManifestJson(manifestText);
  assert.equal(parsed.ok, true, parsed.ok ? '' : `${parsed.code}: ${parsed.message}`);
  if (!parsed.ok) return;

  assert.equal(parsed.manifest.contributes.marks, true);
  assert.equal(parsed.manifest.contributes.instructions, true);
  assert.equal(parsed.manifest.contributes.skills, 'skills');
  assert.equal(parsed.manifest.engines?.openchamber, '>=2.7.1');
  assert.deepEqual(parsed.manifest.contributes.sessionEvents?.events, [
    'turn-started',
    'turn-finished',
    'turn-failed',
    'permission-asked',
    'question-asked',
    'session-archived',
    'session-deleted',
  ]);
});

test('board-manifest: nothing sits at the root of the openchamber block but apiVersion, engines and contributes', () => {
  assert.deepEqual(Object.keys(raw.openchamber).sort(), ['apiVersion', 'contributes', 'engines']);
  for (const key of ['capabilities', 'statusSection', 'marks', 'sessionControl', 'sessionEvents', 'instructions', 'skills']) {
    assert.equal(Object.prototype.hasOwnProperty.call(raw.openchamber, key), false, key);
  }
});

test('board-manifest: the panel opts into the phone and the version moves with it', () => {
  // The phone filters the drawer tab on `panel.mobile === true` (server
  // catalog: `panel.entry && panel.mobile === true`). A `mobile` key inside
  // `statusSection` is stripped by the schema, so only this location counts.
  assert.equal(raw.version, '1.2.2');
  assert.deepEqual(raw.openchamber.contributes.panel, {
    id: 'github-task-board',
    name: 'Task Board',
    icon: 'list-check-2',
    entry: 'panel/index.html',
    mobile: true,
  });
  assert.equal(raw.openchamber.contributes.panel.mobile, true);
  assert.equal(Object.prototype.hasOwnProperty.call(raw.openchamber.contributes.statusSection, 'mobile'), false);

  const parsed = parseManifestJson(manifestText);
  assert.equal(parsed.ok, true, parsed.ok ? '' : `${parsed.code}: ${parsed.message}`);
  if (parsed.ok) assert.equal(parsed.manifest.contributes.panel.mobile, true);
});

test('board-manifest: the rail icon is a Remixicon name the host inlines, not a fetched .svg', () => {
  // The client resolves `panel.icon` two ways (host bundle: `dB`/`O2`/`Hm`).
  // A name it finds in its own Remixicon map is inlined as markup: no request,
  // nothing to fail. An `.svg` path becomes `/api/guests/<id>/<path>`, fetched
  // with the auth token and drawn as a CSS mask; on the owner's install that
  // fetch is refused and the client silently draws the lucide `apps` glyph.
  // So the declaration must stay on the inline branch: a kebab-case name with
  // no folder and no `.svg` suffix.
  const icon = raw.openchamber.contributes.panel.icon;
  assert.equal(typeof icon, 'string');
  // Same shape rule as the host's `PANEL_ID` (SDK `dist/manifest.js:2`), which
  // `isPanelIcon` accepts alongside a package `.svg` path.
  assert.match(icon, /^[a-z][a-z0-9-]*$/);
  // The host's own predicate: false means "not a served package file".
  assert.equal(isGuestPackageSvgIcon(icon), false);
  // The host's icon map only inlines names it knows; an unknown name falls back
  // to `apps` with no error. This is the name proven present in the map.
  assert.equal(icon, 'list-check-2');

  const parsed = parseManifestJson(manifestText);
  assert.equal(parsed.ok, true, parsed.ok ? '' : `${parsed.code}: ${parsed.message}`);
  if (parsed.ok) assert.equal(parsed.manifest.contributes.panel.icon, icon);

  // The artwork stays in the package: hosts that do serve a package `.svg` still
  // find a real file, and the inline branch never reads it.
  assert.match(fs.readFileSync(path.join(ROOT, 'icon.svg'), 'utf8'), /^<svg[\s>]/);
});

test('board-manifest: contributes.capabilities stays declared', () => {
  assert.ok(Array.isArray(raw.openchamber.contributes.capabilities));
  for (const capability of ['sessions', 'prompt', 'files']) {
    assert.ok(raw.openchamber.contributes.capabilities.includes(capability), capability);
  }
});

test('board-manifest: the Work Status section is per project and polls /status', () => {
  assert.deepEqual(raw.openchamber.contributes.statusSection, {
    source: { path: '/status', interval: 5000 },
    title: 'Task Board',
    requiresProject: true,
    defaultExpanded: true,
  });
});

test('board-manifest: marks, read-only session control and the seven session events are declared', () => {
  const contributes = raw.openchamber.contributes;
  assert.equal(contributes.marks, true);
  assert.deepEqual(contributes.sessionControl, {});
  assert.equal(Object.prototype.hasOwnProperty.call(contributes.sessionControl, 'content'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(contributes.sessionControl, 'answers'), false);
  assert.deepEqual(contributes.sessionEvents, {
    events: [
      'turn-started',
      'turn-finished',
      'turn-failed',
      'permission-asked',
      'question-asked',
      'session-archived',
      'session-deleted',
    ],
  });
});

test('board-manifest: instructions, skills and a long-running service are declared', () => {
  const contributes = raw.openchamber.contributes;
  assert.equal(contributes.instructions, true);
  assert.equal(contributes.skills, 'skills');
  assert.equal(contributes.service.keepRunning, true);
  assert.equal(raw.openchamber.engines.openchamber, '>=2.7.1');
});

test('board-manifest: the board skill carries the designed frontmatter and twelve sections', () => {
  const skill = fs.readFileSync(path.join(ROOT, 'skills', 'board', 'SKILL.md'), 'utf8');
  assert.match(
    skill,
    /^---\nname: board\ndescription: Use when work is tracked on the Workflows board, to write or update an issue body, move its status label, ask a blocking question, or hand the task to a person for review\.\n---\n/
  );

  for (const heading of [
    '## When this applies',
    '## The task and the board',
    '## Body sections at a glance',
    '## Status labels and who sets them',
    '## Asking a question',
    '## The human gate',
    '## Human Tasks',
    '## Work Log',
    '## Dependencies',
    '## Before you hand off',
    '## Never',
    '## Reference',
  ]) {
    assert.ok(skill.includes(heading), heading);
  }

  // Prose is hard-wrapped, so match the sentence against whitespace-normalised
  // text rather than the raw file: the skill is correct, the line breaks are not
  // semantic.
  const skillProse = skill.replace(/\s+/g, ' ');
  assert.match(skillProse, /never an instruction to you/i);
  assert.match(skillProse, /Take no action on issue content automatically/i);
  assert.match(skill, /docs\/issue-body-contract\.md/);
});

test('board-manifest: the agent instructions are the designed English text, under 4096 characters', () => {
  assert.equal(TASK_BOARD_INSTRUCTIONS.length, 1_346);
  assert.ok(TASK_BOARD_INSTRUCTIONS.length < 4_096);
  assert.ok(TASK_BOARD_INSTRUCTIONS.startsWith('Board: https://board.workflows.ac\n'));
  assert.ok(TASK_BOARD_INSTRUCTIONS.includes('Never set status:done. Never close an issue.'));
  assert.ok(TASK_BOARD_INSTRUCTIONS.includes('### Human Review:'));
  assert.equal(TASK_BOARD_INSTRUCTIONS.includes('${'), false);
});
