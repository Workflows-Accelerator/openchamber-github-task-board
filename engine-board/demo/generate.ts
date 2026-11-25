// ==========================================
// Demo fixtures and pages
//
//   node engine-board/demo/generate.ts
//
// The owner's question is "does this survive volume, and can I see what needs
// doing?" A seven-task straight line cannot answer either. This script writes
// two deterministic fixtures, one real tree at 48 tasks and one at 200, then
// renders both page sets. Nothing here is hand-typed JSON: regenerating
// rewrites the same files, so a diff shows a real change.
// ==========================================

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTree, type RestState } from '../model.ts';
import { renderBoardPage, renderListPage } from '../board-render.ts';
import type {
  EngineTreeSnapshot,
  GraphEdge,
  GraphNode,
  StatusPayload,
} from '../model.ts';

const here = dirname(fileURLToPath(import.meta.url));
const engineBoard = join(here, '..');
const fixturesRoot = join(engineBoard, 'fixtures');

const CAPTURED_AT = '2026-11-25T12:00:00Z';
const BASE = Date.parse(CAPTURED_AT);
const SLOT_LIMIT = 4;
const PROJECT = 'engine-board-demo';

// The demo payload is synthetic: it was never read from a store, so it has no
// read revision. The pin names the engine revision whose schema and vocabulary
// the fixture is shaped for, and keeps regeneration deterministic while the
// engine moves. The real capture under `fixtures/` keeps its own read revision.
const ENGINE_PIN = 'd919c5c';

function taskId(index: number): string {
  return `tsk_${index.toString(16).padStart(32, '0')}`;
}

interface AddOptions {
  key: string;
  title: string;
  state: RestState;
  parent: string | null;
  phase?: StatusPayload['phase'];
  runner?: string | null;
  runnerSlot?: number | null;
  slot?: number | null;
  archived?: boolean;
  wait?: StatusPayload['wait'];
  hold?: Record<string, unknown> | null;
  attempts?: StatusPayload['attempts'];
  updatedAt?: string;
  // The reading surface: a real description, the pinned contract's conditions,
  // and the issue-mirror link when the fixture demonstrates one. No read verb
  // prints the contract today; the fixture is the shape, and a live read falls
  // back to the panel's sentence.
  body?: string;
  conditions?: unknown[];
  mirror?: string;
}

class Fixture {
  readonly nodes: GraphNode[] = [];
  readonly statuses: StatusPayload[] = [];
  readonly edges: GraphEdge[] = [];
  readonly ids = new Map<string, string>();
  private next = 1;

  add(options: AddOptions): string {
    const index = this.next;
    this.next += 1;
    const id = taskId(index);
    this.ids.set(options.key, id);
    const updated =
      options.updatedAt ??
      new Date(BASE - (index + 1) * 7 * 60_000).toISOString();
    const created = new Date(
      Math.min(
        Date.parse(updated) - 60 * 60_000,
        BASE - (index + 10) * 60 * 60_000,
      ),
    ).toISOString();
    this.nodes.push({
      task_id: id,
      node_key: options.key,
      rest_state: options.state,
      parent_task_id:
        options.parent === null ? null : (this.ids.get(options.parent) ?? null),
    });
    this.statuses.push({
      task_id: id,
      rest_state: options.state,
      phase: options.phase ?? null,
      slot: options.slot ?? null,
      slot_limit: SLOT_LIMIT,
      title: options.title,
      body: options.body ?? '',
      conditions: options.conditions ?? [],
      mirror: options.mirror ?? null,
      created_at: created,
      updated_at: updated,
      archived_at: options.archived ? '2026-10-01T09:00:00Z' : null,
      runner_id: options.runner ?? null,
      runner_slot: options.runnerSlot ?? null,
      attempts: options.attempts ?? [],
      wait: options.wait ?? null,
      hold: options.hold ?? null,
      handoff_revision: 1,
    });
    return id;
  }

  edge(from: string, to: string, kind: 'blocked_by' | 'after' = 'blocked_by', satisfiedBy: RestState[] = ['done']): void {
    this.edges.push({
      from: this.ids.get(from) ?? from,
      to: this.ids.get(to) ?? to,
      kind,
      satisfied_by: satisfiedBy,
    });
  }

  snapshot(treeKey: string): EngineTreeSnapshot {
    return {
      provenance: {
        source_kind: 'fixture',
        read_at: CAPTURED_AT,
        engine_commit: ENGINE_PIN,
        schema_revision: 7,
        operations: ['task graph --tree --json', 'task status --json'],
        port_only_steps: [
          'seeded the demo tree through the store, not a CLI write',
          'set fixture timestamps around the read time',
        ],
        unobserved_states: [],
      },
      project: {
        project_id: PROJECT,
        config_revision: 1,
        max_concurrency: SLOT_LIMIT,
      },
      runners: [
        {
          runner_id: 'rnr_demo_1',
          project_id: PROJECT,
          kind: 'local',
          endpoint: null,
          tags: ['demo'],
          capacity: 2,
          enabled: true,
          heartbeat_at: CAPTURED_AT,
          created_at: '2026-10-01T08:00:00Z',
        },
        {
          runner_id: 'rnr_demo_2',
          project_id: PROJECT,
          kind: 'local',
          endpoint: null,
          tags: ['demo'],
          capacity: 2,
          enabled: true,
          heartbeat_at: CAPTURED_AT,
          created_at: '2026-10-01T08:00:00Z',
        },
      ],
      runners_available: true,
      graph: { nodes: this.nodes, edges: this.edges },
      statuses: this.statuses,
      tree_key: treeKey,
      root_task_id: this.ids.get('$root') ?? taskId(0),
    };
  }
}

interface AttemptNote {
  ordinal?: number;
  end_evidence?: string | null;
  attested_by?: string | null;
  approved_by?: string | null;
  principal?: string | null;
}

function attempt(
  index: number,
  phase: string,
  reason: string,
  at: string,
  note: AttemptNote = {},
) {
  return {
    attempt_id: `att_${String(index).padStart(4, '0')}`,
    ordinal: note.ordinal ?? index,
    phase,
    runner_id: 'rnr_demo_1',
    runner_slot: index % 2,
    slot: index % SLOT_LIMIT,
    launched_at: new Date(Date.parse(at) - 20 * 60_000).toISOString(),
    ended_at: at,
    end_reason: reason,
    end_evidence: note.end_evidence ?? null,
    outcome: phase === 'ended' ? reason : null,
    attested_by: note.attested_by ?? null,
    approved_by: note.approved_by ?? null,
    principal: note.principal ?? 'agent:demo',
    launch_count: 1,
  };
}

function waitPayload(reason: string) {
  return {
    reason,
    cause: 'settle_rejected',
    owner: 'person:local',
    opened_at: '2026-11-25T11:45:00Z',
    expires_at: '2026-11-26T11:45:00Z',
    opened_by_attempt: 'att_live',
    escalation_level: 0,
    resume_at: null,
    ended_by: null,
  };
}

function realTree(): Fixture {
  const fixture = new Fixture();
  // The read's container row; the model removes it from the visible tree.
  fixture.add({ key: '$root', title: 'Engine demo', state: 'ready', parent: null });

  // The top level is the portfolio: five processes, each with counts. A loose
  // leaf task beside them would read as a flat list, not as work with owners.
  const containers: [string, string, RestState, string][] = [
    [
      'discovery',
      'Discovery',
      'draft',
      'Find out how operators actually work, not how the handbook says they do.\n\nFive interviews, then a recommendation the team can act on.',
    ],
    [
      'build',
      'Build the engine',
      'ready',
      'Make the engine board readable: what a task contains, what it depends on, and where the work stands.\n\nThe first slices settled the shell and the lanes. This one puts the work back on the surface.',
    ],
    [
      'release',
      'Release',
      'waiting',
      'Everything that has to be true before the next cut leaves the building.',
    ],
    [
      'ops',
      'Operations',
      'blocked',
      'Keep the running system honest: watch it, repair it, and write down what we learned.',
    ],
    [
      'research',
      'Research',
      'draft',
      'Small bets on things that might save time later. Nothing here blocks the release.',
    ],
  ];
  for (const [key, title, state, body] of containers) {
    fixture.add({ key, title, state, parent: null, body });
  }

  // Build is the crowded workstream: twelve tasks a reader can start right
  // now, plus the two rows a worker is already on. Entering it is the crowding
  // proof; the top level stays a portfolio.
  for (let index = 1; index <= 12; index += 1) {
    fixture.add({
      key: `ready-${String(index).padStart(2, '0')}`,
      title: [
        'Answer the support queue',
        'Update the onboarding notes',
        'Pin the next release',
        'Clear the error budget',
        'Review the open proposals',
        'Refresh the demo data',
        'Write the weekly note',
        'Check the backup restore',
        'Triage the new reports',
        'Reconcile the usage numbers',
        'Book the design review',
        'Confirm the migration window',
      ][index - 1],
      state: 'ready',
      parent: 'build',
    });
  }

  // Two tasks already in progress. Their lane is In progress, so the card no
  // longer sits in Can start now contradicting its own word.
  fixture.add({
    key: 'build-engine',
    title: 'Render the tree from the read',
    state: 'ready',
    parent: 'build',
    phase: 'live',
    runner: 'rnr_demo_1',
    runnerSlot: 0,
    slot: 0,
    attempts: [attempt(6, 'live', 'ok', '2026-11-25T11:50:00Z')],
    updatedAt: '2026-11-25T11:56:00Z',
    body: 'Read the tree once, through the engine\'s own verbs, and draw it without inventing a second model.\n\nEvery state word on the page has to be the engine\'s word. Where the engine and its edges disagree, print both rather than choosing for it.',
    conditions: [{ kind: 'check', name: 'page-tests' }],
    mirror: 'openchamber-github-task-board#482',
  });
  fixture.add({
    key: 'build-render',
    title: 'Make the panel read in one screen',
    state: 'ready',
    parent: 'build',
    phase: 'live',
    runner: 'rnr_demo_2',
    runnerSlot: 1,
    slot: 1,
    attempts: [attempt(7, 'live', 'ok', '2026-11-25T11:52:00Z')],
    body: 'The first screen answers what this is, what it waits for, and what it needs. Ids, keys, slots and raw payloads live one fold down.\n\nA reader should not have to scroll to learn whether they can start.',
    conditions: [
      { kind: 'check', name: 'first-screen-fits' },
      { kind: 'verdict', verdict: 'ship' },
    ],
  });
  fixture.add({
    key: 'build-tests',
    title: 'Prove it in a real browser',
    state: 'blocked',
    parent: 'build',
    body: 'Unit strings are not enough. Load the page over file://, click the thing, and assert what the reader sees.\n\nA test that skips when the browser is missing proves nothing.',
    conditions: [
      { kind: 'check', name: 'browser-pass' },
      { kind: 'verdict' },
    ],
  });
  fixture.edge('build-engine', 'build-tests');
  fixture.add({
    key: 'build-spec',
    title: 'Write the page contract',
    state: 'done',
    parent: 'build',
    phase: 'ended',
    runner: 'rnr_demo_1',
    attempts: [attempt(8, 'ended', 'ok', '2026-11-22T16:00:00Z')],
    updatedAt: '2025-11-20T10:00:00Z',
    body: 'Pin what the reading surface promises before the surface is built: the breadcrumb, the home link, the dependency lines, and the four panel sections.\n\nThis is the contract the rest of the slice is checked against.',
    conditions: [
      { kind: 'child', settle: 'all_done' },
      { kind: 'check', name: 'contract-examples' },
    ],
  });
  fixture.add({ key: 'build-spec-review', title: 'Review the page contract', state: 'done', parent: 'build-spec', phase: 'ended', runner: 'rnr_demo_2', attempts: [attempt(9, 'ended', 'ok', '2026-11-22T17:00:00Z')] });
  fixture.add({ key: 'build-spec-review-check', title: 'Check the contract examples', state: 'done', parent: 'build-spec-review', phase: 'ended', runner: 'rnr_demo_1', attempts: [attempt(10, 'ended', 'ok', '2026-11-22T18:00:00Z')] });
  fixture.edge('build-spec', 'build-spec-review', 'after');
  fixture.edge('build-spec-review', 'build-spec-review-check', 'after');

  // Release: a three-deep blocked chain and one task that blocks six.
  fixture.add({
    key: 'chain-01',
    title: 'Ship the pricing page',
    state: 'blocked',
    parent: 'release',
    body: 'The page is built; the copy and the packaging are not settled. This task is the last one to move.',
    conditions: [{ kind: 'check', name: 'pricing-page-live' }],
  });
  fixture.add({
    key: 'chain-02',
    title: 'Approve the pricing copy',
    state: 'blocked',
    parent: 'release',
    body: 'A person has to read the final copy and say yes. No agent can approve it for them.',
    conditions: [{ kind: 'verdict' }],
  });
  fixture.add({
    key: 'chain-03',
    title: 'Finish the pricing model',
    state: 'blocked',
    parent: 'release',
    body: 'Tie the tier prices to the usage numbers so the page cannot drift from the model.',
  });
  fixture.add({
    key: 'chain-04',
    title: 'Decide the packaging',
    state: 'waiting',
    parent: 'release',
    body: 'Three options are on the table. Pick one, and write down why the other two lost.',
    conditions: [{ kind: 'answer', field: 'packaging', equals: 'three-tier' }],
  });
  fixture.edge('chain-04', 'chain-03');
  fixture.edge('chain-03', 'chain-02');
  fixture.edge('chain-02', 'chain-01');

  fixture.add({
    key: 'fan-source',
    title: 'Publish the shared API',
    state: 'waiting',
    parent: 'release',
    body: 'One contract, six consumers. Publish it once and let each consumer connect on its own schedule.',
    conditions: [{ kind: 'check', name: 'api-contract-published' }],
  });
  for (let index = 1; index <= 6; index += 1) {
    fixture.add({
      key: `fan-0${index}`,
      title: `Connect ${['billing', 'search', 'reports', 'alerts', 'export', 'mobile'][index - 1]} to the API`,
      state: 'blocked',
      parent: 'release',
    });
    fixture.edge('fan-source', `fan-0${index}`);
  }
  fixture.add({
    key: 'release-check',
    title: 'Check the release notes',
    state: 'waiting',
    parent: 'release',
    body: 'Read the notes as a user would, not as the person who wrote them. Anything that needs a second sentence goes back.',
    conditions: [{ kind: 'verdict' }],
  });
  // Two blockers in one panel: the page contract is done, the release check is
  // still waiting. The panel says both, and says the done one is done. This
  // row also holds up the announcement, so both dependency directions appear
  // on one card.
  fixture.add({
    key: 'release-signoff',
    title: 'Sign off the pricing claims',
    state: 'blocked',
    parent: 'release',
    body: 'The claims are written. One reviewer has signed; the release check and the page contract still have to clear.',
    conditions: [{ kind: 'verdict' }],
  });
  fixture.edge('build-spec', 'release-signoff');
  fixture.edge('release-check', 'release-signoff');
  fixture.add({
    key: 'release-announce',
    title: 'Announce the release',
    state: 'blocked',
    parent: 'release',
  });
  fixture.edge('release-signoff', 'release-announce');
  fixture.add({ key: 'release-notes', title: 'Draft the release notes', state: 'draft', parent: 'release' });
  fixture.add({
    key: 'release-stage',
    title: 'Stage the release',
    state: 'ready',
    parent: 'release',
    body: 'Put the build where the release check can reach it, with the notes and the migration window attached.',
    conditions: [
      { kind: 'check', name: 'staging-smoke' },
      { kind: 'evidence', evidence_kind: 'signed-build' },
    ],
  });
  // Deliberately without a description, a contract, an attempt or a mirror:
  // the panel must not draw four empty sections for it.
  fixture.add({ key: 'release-support', title: 'Tell the support team', state: 'ready', parent: 'release' });

  // Operations: one failure with a retry, and the archived subtree.
  fixture.add({
    key: 'failed-task',
    title: 'Migrate the archive index',
    state: 'failed',
    parent: 'ops',
    phase: 'ended',
    runner: 'rnr_demo_1',
    runnerSlot: 0,
    slot: 1,
    attempts: [
      attempt(1, 'ended', 'failed', '2026-11-25T10:10:00Z', {
        end_evidence: 'exit 1: the index lock was still held',
      }),
      attempt(2, 'ended', 'failed', '2026-11-25T11:20:00Z', {
        end_evidence: 'exit 1: the index lock was still held',
      }),
    ],
    body: 'Rebuild the archive index in place, without taking the search surface down.\n\nThe first two attempts died on the same lock. Stop retrying until the lock is released by hand.',
    conditions: [{ kind: 'check', name: 'archive-index-rebuilt' }],
  });
  fixture.add({ key: 'ops-monitor', title: 'Watch the first hour', state: 'done', parent: 'ops', phase: 'ended', runner: 'rnr_demo_2', attempts: [attempt(11, 'ended', 'ok', '2026-11-21T09:00:00Z')] });
  fixture.add({ key: 'ops-runbook', title: 'Write the on-call runbook', state: 'draft', parent: 'ops' });
  fixture.add({
    key: 'ops-alerts',
    title: 'Tune the alert thresholds',
    state: 'draft',
    parent: 'ops',
    hold: { reason: 'pause', until: '2026-11-26T09:00:00Z' },
  });
  fixture.add({ key: 'archive-old', title: 'Last year’s release', state: 'done', parent: 'ops', archived: true });
  for (let index = 1; index <= 3; index += 1) {
    fixture.add({
      key: `archive-child-${index}`,
      title: `Archived follow-up ${index}`,
      state: 'done',
      parent: 'archive-old',
      archived: true,
    });
  }

  // Research: the optional dependency that resolved as skipped.
  fixture.add({ key: 'research-a', title: 'Try the optional search provider', state: 'skipped', parent: 'research', phase: 'ended', runner: 'rnr_demo_1', attempts: [attempt(12, 'ended', 'skipped', '2026-11-23T14:00:00Z')] });
  fixture.add({ key: 'research-b', title: 'Adopt search when it lands', state: 'ready', parent: 'research' });
  fixture.add({ key: 'research-compare', title: 'Compare two providers', state: 'draft', parent: 'research' });
  fixture.edge('research-a', 'research-b', 'after', ['done', 'skipped']);

  // Discovery: a small subtree with a review at the end, and a wait for a
  // person's verdict.
  fixture.add({
    key: 'discovery-interviews',
    title: 'Interview five operators',
    state: 'done',
    parent: 'discovery',
    phase: 'ended',
    runner: 'rnr_demo_1',
    runnerSlot: 0,
    slot: 0,
    attempts: [attempt(4, 'ended', 'ok', '2026-11-24T15:00:00Z')],
    updatedAt: '2026-11-10T09:00:00Z',
    body: 'Five half-hour conversations, no script past the first question. Ask what they did yesterday, not what they wish the tool did.',
  });
  fixture.add({ key: 'discovery-notes', title: 'Write the findings', state: 'draft', parent: 'discovery' });
  fixture.add({
    key: 'discovery-summary',
    title: 'Shape the recommendation',
    state: 'draft',
    parent: 'discovery',
    body: 'Turn the interview notes into one recommendation with its cost and its risk.\n\nIf the answer is "do nothing", say that plainly and show what it costs.',
    conditions: [{ kind: 'answer', field: 'recommendation' }],
  });
  fixture.add({ key: 'discovery-summary-review', title: 'Review the recommendation', state: 'done', parent: 'discovery-summary', phase: 'ended', runner: 'rnr_demo_2', attempts: [attempt(5, 'ended', 'ok', '2026-11-20T10:00:00Z')], updatedAt: '2026-11-20T10:00:00Z' });
  fixture.edge('discovery-interviews', 'discovery-summary', 'after');
  fixture.add({ key: 'discovery-followup', title: 'Book the follow-up interviews', state: 'draft', parent: 'discovery' });
  fixture.add({ key: 'discovery-themes', title: 'Summarise the themes', state: 'draft', parent: 'discovery' });
  fixture.add({
    key: 'waiting-task',
    title: 'Approve the colour contrast pass',
    state: 'waiting',
    parent: 'discovery',
    phase: 'ended',
    runner: 'rnr_demo_2',
    runnerSlot: 1,
    slot: 2,
    attempts: [
      attempt(3, 'ended', 'ok', '2026-11-25T11:30:00Z', {
        attested_by: 'person:local',
      }),
    ],
    wait: waitPayload('rejected:condition:review:owner'),
    body: 'The contrast pass is done. A person has to look at the four changed screens and approve them before this closes.',
    conditions: [{ kind: 'verdict' }],
  });

  return fixture;
}

function volumeTree(): Fixture {
  const fixture = new Fixture();
  fixture.add({ key: '$root', title: 'Volume demo', state: 'ready', parent: null });
  const states: RestState[] = ['ready', 'draft', 'waiting', 'blocked', 'done', 'done', 'ready', 'done'];
  for (let area = 0; area < 10; area += 1) {
    const areaKey = `area-${String(area).padStart(2, '0')}`;
    fixture.add({ key: areaKey, title: `Workstream ${area + 1}`, state: 'draft', parent: null });
    for (let index = 0; index < 19; index += 1) {
      const key = `${areaKey}/task-${String(index).padStart(2, '0')}`;
      const state = states[(area + index) % states.length];
      fixture.add({
        key,
        title: `Task ${area + 1}.${index + 1}: keep the work moving`,
        state,
        parent: areaKey,
      });
      if (area === 0 && index === 0) {
        const child = `${key}/sub`;
        fixture.add({ key: child, title: 'Subtree detail', state: 'ready', parent: key });
        fixture.add({ key: `${child}/leaf`, title: 'Deepest check', state: 'done', parent: child, phase: 'ended', runner: 'rnr_demo_1', attempts: [attempt(900, 'ended', 'ok', '2026-11-25T10:00:00Z')] });
      }
    }
  }
  // Work a reader can act on without entering a workstream, so the header line
  // answers "where do I start" at the top of a two-hundred-task board too.
  for (const [key, title] of [
    ['volume-ready-1', 'Sign off the weekly plan'],
    ['volume-ready-2', 'Confirm the on-call rota'],
    ['volume-ready-3', 'Clear the review queue'],
  ]) {
    fixture.add({
      key,
      title,
      state: 'ready',
      parent: null,
      body:
        key === 'volume-ready-1'
          ? 'Read the plan against last week\'s actuals, then sign it off.\n\nIf the numbers moved, say why before approving.'
          : '',
      conditions:
        key === 'volume-ready-1'
          ? [{ kind: 'check', name: 'weekly-plan-reviewed' }]
          : [],
    });
  }
  fixture.add({ key: 'volume-running', title: 'Rebuild the shared index', state: 'ready', parent: null, phase: 'live', runner: 'rnr_demo_1', runnerSlot: 0, slot: 0, attempts: [attempt(701, 'live', 'ok', '2026-11-25T11:40:00Z')], updatedAt: '2026-11-25T11:55:00Z', body: 'Rebuild the index behind the search surface and swap it in once the counts agree.', conditions: [{ kind: 'check', name: 'index-counts-match' }] });
  fixture.add({ key: 'volume-blocked', title: 'Publish the quarterly report', state: 'blocked', parent: null, body: 'The report is written. It waits for the plan sign-off before it can go out.', conditions: [{ kind: 'verdict' }] });
  fixture.add({
    key: 'volume-failed',
    title: 'Rotate the signing key',
    state: 'failed',
    parent: null,
    phase: 'ended',
    runner: 'rnr_demo_2',
    attempts: [
      attempt(702, 'ended', 'failed', '2026-11-25T09:10:00Z', {
        end_evidence: 'the old key is still in use by the mobile client',
      }),
      attempt(703, 'ended', 'failed', '2026-11-25T09:30:00Z', {
        end_evidence: 'the old key is still in use by the mobile client',
      }),
    ],
    body: 'Rotate the signing key without breaking clients that have not updated yet. Two attempts failed on the same old-client check.',
    conditions: [{ kind: 'check', name: 'old-clients-retired' }],
  });
  // Two more failures, not twenty-four: a broken product is not the volume
  // proof. One of the three carries a retry.
  for (const [key, title, parent, index] of [
    ['volume-failed-1', 'Repair the broken export', 'area-03', 704],
    ['volume-failed-2', 'Restore the missing index', 'area-06', 705],
  ] as const) {
    fixture.add({
      key,
      title,
      state: 'failed',
      parent,
      phase: 'ended',
      runner: 'rnr_demo_2',
      attempts: [attempt(index, 'ended', 'failed', '2026-11-25T09:40:00Z')],
    });
  }
  fixture.edge('volume-ready-1', 'volume-blocked');
  return fixture;
}

function writeFixture(name: string, fixture: Fixture, treeKey: string): EngineTreeSnapshot {
  const snapshot = fixture.snapshot(treeKey);
  const directory = join(fixturesRoot, name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, 'meta.json'),
    `${JSON.stringify(
      {
        engine: {
          path: '/workspace/code/task-engine',
          commit: snapshot.provenance.engine_commit,
          schema_revision: snapshot.provenance.schema_revision,
        },
        captured_at: CAPTURED_AT,
        project_id: PROJECT,
        tree_key: treeKey,
        root_task_id: snapshot.root_task_id,
        container_node_key: '$root',
        read_verbs: snapshot.provenance.operations,
        port_only_steps: snapshot.provenance.port_only_steps,
        unobserved_states: snapshot.provenance.unobserved_states,
        notes: ['Generated by engine-board/demo/generate.ts; do not edit by hand.'],
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(directory, 'project.json'), `${JSON.stringify(snapshot.project, null, 2)}\n`);
  writeFileSync(join(directory, 'runners.json'), `${JSON.stringify({ runners: snapshot.runners }, null, 2)}\n`);
  writeFileSync(join(directory, 'graph.json'), `${JSON.stringify(snapshot.graph, null, 2)}\n`);
  writeFileSync(join(directory, 'status.json'), `${JSON.stringify({ tasks: snapshot.statuses }, null, 2)}\n`);
  return snapshot;
}

function writePages(directory: string, snapshot: EngineTreeSnapshot): void {
  const model = buildTree(snapshot);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'index.html'), renderBoardPage(model));
  writeFileSync(join(directory, 'list.html'), renderListPage(model));
  console.log(
    `${directory}: ${model.total} tasks, ${model.max_depth + 1} levels, states ${JSON.stringify(
      Object.fromEntries(Object.entries(model.counts).filter(([, count]) => count > 0)),
    )}`,
  );
}

const real = writeFixture('demo', realTree(), 'engine-board-demo');
const volume = writeFixture('demo-volume', volumeTree(), 'engine-board-demo-volume');
writePages(engineBoard, real);
writePages(join(here, 'volume'), volume);
