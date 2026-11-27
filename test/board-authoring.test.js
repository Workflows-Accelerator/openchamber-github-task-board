// The authoring surface, against serve-contract v1.2.
//
// Two halves. The first reads the renderer's own markup: the artefact built
// for `file://` carries no control and no authoring client, the served page
// carries the server's own action list, and the line is the server's sentence
// escaped once. The second boots a loopback stub and proves the server call a
// form post makes is the call an XHR post of the same content makes.

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTree } from '../engine-board/model.ts';
import {
  boardData,
  renderBoardPage,
  renderListPage,
  taskActionsHtml,
  taskNoteHtml,
} from '../engine-board/board-render.ts';
import { startBoardStub, STUB_TASK_ID } from './board-stub-server.mjs';

function node(task_id, node_key, rest_state, parent_task_id, extra = {}) {
  return { task_id, node_key, rest_state, parent_task_id, ...extra };
}

function statusOf(task_id, rest_state, extra = {}) {
  return {
    task_id,
    rest_state,
    phase: null,
    slot: null,
    wait: null,
    hold: null,
    handoff_revision: 1,
    ...extra,
  };
}

function snapshotOf({ nodes, edges = [], statuses = [] } = {}) {
  return {
    provenance: {
      source_kind: 'fixture',
      read_at: '2026-01-01T00:00:00Z',
      engine_commit: 'authoring-test',
      schema_revision: 8,
      operations: ['task graph --json'],
      port_only_steps: [],
      unobserved_states: [],
    },
    project: { project_id: 'p', config_revision: 1 },
    runners: [],
    runners_available: true,
    graph: { nodes, edges },
    statuses,
    tree_key: 'tree',
    root_task_id: 'root',
  };
}

// One board with every case the controls care about: a waiting task (the
// server offers a settle), a ready task (the server offers a start), a done
// task, and an archived waiting task the server offers nothing for.
function authoringModel() {
  return buildTree(
    snapshotOf({
      nodes: [
        node('root', '$root', 'ready', null),
        node('plan', 'plan', 'waiting', 'root', {
          title: 'Sign off the plan',
          actions: [
            {
              verb: 'complete',
              label: 'Mark done',
              path: '/api/tasks/plan/complete',
              fields: { outcome: 'approve' },
            },
          ],
        }),
        node('write', 'write', 'ready', 'root', {
          title: 'Write the plan',
          actions: [
            {
              verb: 'start',
              label: 'Start now',
              path: '/api/tasks/write/start',
              fields: {},
            },
          ],
        }),
        node('ship', 'ship', 'blocked', 'root', { title: 'Ship the plan' }),
        node('tell', 'tell', 'blocked', 'root', { title: 'Announce the plan' }),
        node('done', 'done', 'done', 'root', { title: 'Draft the plan' }),
        node('closed', 'closed', 'waiting', 'root', { title: 'Close the old plan' }),
      ],
      statuses: [
        statusOf('plan', 'waiting', {
          title: 'Sign off the plan',
          wait: {
            reason: 'review',
            cause: 'none',
            owner: 'person:local',
            opened_at: '2026-01-01T00:00:00Z',
          },
        }),
        statusOf('write', 'ready', { title: 'Write the plan' }),
        statusOf('ship', 'blocked', { title: 'Ship the plan' }),
        statusOf('tell', 'blocked', { title: 'Announce the plan' }),
        statusOf('done', 'done', { title: 'Draft the plan' }),
        statusOf('closed', 'waiting', {
          title: 'Close the old plan',
          archived_at: '2026-01-02T00:00:00Z',
        }),
      ],
      edges: [
        {
          from: 'write',
          to: 'ship',
          kind: 'blocked_by',
          satisfied_by: ['done'],
        },
        {
          from: 'write',
          to: 'tell',
          kind: 'blocked_by',
          satisfied_by: ['done'],
        },
      ],
    }),
  );
}

// The markup a scripting-disabled parser sees: no script elements at all. The
// JSON data block is inert but is not markup either.
function markupOnly(html) {
  return html.replace(/<script[\s\S]*?<\/script>/g, '');
}

function dataOf(html) {
  const match = /<script type="application\/json" id="board-data">([\s\S]*?)<\/script>/.exec(
    html,
  );
  assert.ok(match, 'the page carries its data block');
  return JSON.parse(match[1]);
}

// ---------------------------------------------------------------------------
// B1: the artefact carries no control that cannot work.
// ---------------------------------------------------------------------------

test('the committed file:// page renders no form and no notice line', () => {
  const model = authoringModel();
  for (const html of [renderBoardPage(model), renderListPage(model)]) {
    const markup = markupOnly(html);
    assert.equal(/<form/i.test(markup), false, 'no form element');
    assert.equal(/<input/i.test(markup), false, 'no input element');
    assert.equal(/<textarea/i.test(markup), false, 'no textarea element');
    assert.equal(/id="page-line"/.test(markup), false, 'no notice line');
    assert.equal(/onclick/i.test(markup), false, 'no inline handler');
    assert.equal(/href="#"/.test(markup), false, 'no dead link');
    // v1.2: the authoring client is not shipped where nothing can use it. The
    // board client that draws the page is still there.
    for (const name of ['postJson', 'noticeUrl', 'wireAuthoring']) {
      assert.equal(html.includes(name), false, `the artefact carries no ${name}`);
    }
    assert.equal(/class="sheet-note-form"/.test(html), false, 'no note form');
    assert.equal(html.includes('/api/tasks'), false, 'no write path in the artefact');
    assert.equal(html.includes('.page-line {'), false, 'no authoring styles either');
    assert.ok(html.includes('function buildSheet'), 'the board client still draws');
    const data = dataOf(html);
    assert.equal(data.served, undefined);
    assert.equal(
      Object.values(data.rows).some((row) => row.actions !== undefined),
      false,
      'no row carries an action',
    );
  }
});

// ---------------------------------------------------------------------------
// B1/B2: the served page carries the four real forms.
// ---------------------------------------------------------------------------

test('the served board carries the add line and the row actions', () => {
  const model = authoringModel();
  const html = renderBoardPage(model, { served: true });
  const markup = markupOnly(html);

  assert.match(
    markup,
    /<form class="add-line" method="post" action="\/api\/tasks" data-post>/,
    'the add form posts its title',
  );
  assert.match(markup, /<input type="text" name="title"[^>]*placeholder="Add a task"/);
  assert.equal(/onclick/i.test(markup), false, 'no inline handler');
  assert.equal(/href="#"/.test(markup), false, 'no dead link');
  // v1.2: the success sentences are the server's. The page only carries them
  // from a response; none is a literal here.
  for (const sentence of [
    'Added as a draft',
    'Note added.',
    'Marked done.',
    'Started.',
  ]) {
    assert.equal(html.includes(sentence), false, `the page does not write "${sentence}"`);
  }
  assert.ok(html.includes('location.assign(noticeUrl('), 'a success follows the notice address');
  assert.ok(html.includes('function wireAuthoring'), 'the served page wires its forms');
  assert.ok(html.includes('.add-line {'), 'the served page carries its control styles');

  const data = dataOf(html);
  assert.equal(data.served, true);
  // v1.2: the row carries the server's own list, unchanged. The page does not
  // derive a verb from state or lane.
  assert.deepEqual(data.rows.plan.actions, [
    {
      verb: 'complete',
      label: 'Mark done',
      path: '/api/tasks/plan/complete',
      fields: { outcome: 'approve' },
    },
  ]);
  assert.deepEqual(data.rows.write.actions, [
    {
      verb: 'start',
      label: 'Start now',
      path: '/api/tasks/write/start',
      fields: {},
    },
  ]);
  assert.deepEqual(data.rows.done.actions, [], 'a row with nothing to do carries []');
  assert.deepEqual(
    data.rows.closed.actions,
    [],
    'the archived row also carries the empty list',
  );
});

test('the dialog forms carry the contract path and field for every verb', () => {
  const note = taskNoteHtml('tsk_one');
  assert.match(
    note,
    /<form class="sheet-note-form" method="post" action="\/api\/tasks\/tsk_one\/notes" data-post>/,
  );
  assert.ok(note.includes('name="text"'), 'the note field is `text`');
  assert.ok(
    note.includes('A note is added under what is already there. Nothing above it changes.'),
    'the copy says what a note is',
  );
  assert.equal(
    /tsk_/.test(note.replace(/<[^>]*>/g, '')),
    false,
    'no id in the words a person reads',
  );

  const actions = taskActionsHtml([
    {
      verb: 'start',
      label: 'Start now',
      path: '/api/tasks/tsk_one/start',
      fields: {},
    },
    {
      verb: 'complete',
      label: 'Approve',
      path: '/api/tasks/tsk_one/complete',
      fields: { outcome: 'approve' },
    },
  ]);
  assert.match(
    actions,
    /action="\/api\/tasks\/tsk_one\/start"/,
    'Start now has the start path',
  );
  assert.match(
    actions,
    /action="\/api\/tasks\/tsk_one\/complete"/,
    'the settle has the complete path',
  );
  assert.ok(actions.includes('>Start now<'));
  assert.ok(
    actions.includes('<input type="hidden" name="outcome" value="approve">'),
    'the server\'s field rides with the button',
  );
  // v1.2: several verdicts are several buttons, each with its own label.
  const verdicts = taskActionsHtml([
    { verb: 'complete', label: 'Approve', path: '/a', fields: { outcome: 'approve' } },
    { verb: 'complete', label: 'Reject', path: '/a', fields: { outcome: 'reject' } },
  ]);
  assert.equal((verdicts.match(/<form/g) ?? []).length, 2);
  assert.ok(verdicts.includes('>Approve<'));
  assert.ok(verdicts.includes('>Reject<'));
  // A hostile label is escaped, not interpreted.
  const hostile = taskActionsHtml([
    { verb: 'complete', label: '<b>Approve</b>', path: '/a', fields: {} },
  ]);
  assert.equal(hostile.includes('<b>Approve</b>'), false);
  assert.ok(hostile.includes('&lt;b&gt;Approve&lt;/b&gt;'));
  assert.equal(
    /tsk_/.test(actions.replace(/<[^>]*>/g, '')),
    false,
    'no id in the words a person reads',
  );
  // A row with no action renders no row at all.
  assert.equal(taskActionsHtml([]), '');
});

test('the line is the server sentence, escaped, and only when given', () => {
  const model = authoringModel();
  const blank = renderBoardPage(model, { served: true });
  assert.match(
    markupOnly(blank),
    /id="page-line"[^>]* hidden/,
    'an empty line stays hidden',
  );

  const notice = renderBoardPage(model, {
    served: true,
    notice: 'Task added. It is a draft.',
  });
  assert.ok(markupOnly(notice).includes('Task added. It is a draft.'));
  assert.equal(
    /id="page-line"[^>]* hidden/.test(markupOnly(notice)),
    false,
    'the line is shown when given',
  );
  assert.match(
    markupOnly(notice),
    /<p class="page-line" id="page-line"/,
    'a notice keeps the quiet tone',
  );

  const refusal = renderBoardPage(model, {
    served: true,
    refusal: 'That task is not waiting on you.',
  });
  assert.match(markupOnly(refusal), /<p class="page-line is-refusal"[^>]*>/);
  assert.ok(markupOnly(refusal).includes('That task is not waiting on you.'));

  const hostile = renderBoardPage(model, {
    served: true,
    notice: '<script>alert(1)</script>',
  });
  assert.equal(hostile.includes('<script>alert(1)</script>'), false);
  assert.ok(hostile.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

// ---------------------------------------------------------------------------
// B3: a "Can start now" card says what it holds up.
// ---------------------------------------------------------------------------

test('a can-start card shows how many tasks it holds up, and zero shows nothing', () => {
  const model = authoringModel();
  const html = renderBoardPage(model);
  const markup = markupOnly(html);

  assert.equal(
    (markup.match(/holds up \d+/g) ?? []).length,
    1,
    'only the one can-start card carries the count',
  );
  assert.ok(
    markup.includes('<p class="card-count card-holds">holds up 2</p>'),
    'the count sits in the card meta line',
  );
  assert.equal(/holds up 0/.test(markup), false, 'no zero');
  // The dialog still counts the same two tasks.
  assert.ok(html.includes('"value":"2 tasks: Ship the plan and Announce the plan."'));
});

// ---------------------------------------------------------------------------
// B2: one server call, two front doors.
// ---------------------------------------------------------------------------

test('a form post and an XHR post reach the stub as the same call', async () => {
  const model = authoringModel();
  const stub = await startBoardStub({
    render: ({ notice, refusal }) =>
      renderBoardPage(model, { served: true, notice, refusal }),
  });
  const calls = [
    {
      path: '/api/tasks',
      form: { title: 'Write the plan' },
      json: { title: 'Write the plan' },
      status: 201,
      notice: 'Added as a draft: Write the plan',
    },
    {
      path: '/api/tasks/tsk_abc/notes',
      form: { text: 'The bank called back.' },
      json: { text: 'The bank called back.' },
      status: 200,
      notice: 'Note added.',
    },
    {
      path: '/api/tasks/tsk_abc/complete',
      form: { outcome: 'approve' },
      json: { outcome: 'approve' },
      status: 200,
      notice: 'Marked done.',
    },
    {
      path: '/api/tasks/tsk_abc/start',
      form: {},
      json: {},
      status: 200,
      notice: 'Started.',
    },
  ];

  try {
    for (const call of calls) {
      const formBody = new URLSearchParams(call.form).toString();
      const form = await fetch(stub.origin + call.path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody,
        redirect: 'manual',
      });
      assert.equal(form.status, 303, `${call.path} form answers See Other`);
      const formTarget = new URL(form.headers.get('location'), stub.origin);
      assert.equal(formTarget.pathname, '/', `${call.path} form returns to the page`);
      assert.equal(
        formTarget.searchParams.get('notice'),
        call.notice,
        `${call.path} form carries the server's sentence`,
      );

      const xhr = await fetch(stub.origin + call.path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(call.json),
      });
      assert.equal(xhr.status, call.status, `${call.path} XHR status`);
      const answer = await xhr.json();
      // v1.2: every success carries the same sentence on both paths.
      assert.equal(answer.notice, call.notice, `${call.path} XHR notice`);
      if (call.path === '/api/tasks') {
        assert.equal(answer.task_id, STUB_TASK_ID);
      }

      const [sentForm, sentJson] = stub.requests.filter(
        (request) => request.method === 'POST',
      ).slice(-2);
      // Exact path, content type and body.
      assert.equal(sentForm.path, call.path);
      assert.equal(sentJson.path, call.path);
      assert.match(sentForm.contentType, /^application\/x-www-form-urlencoded/);
      assert.match(sentJson.contentType, /^application\/json/);
      assert.equal(sentForm.raw, formBody);
      assert.equal(sentJson.raw, JSON.stringify(call.json));
      // And the engine receives the same fields either way.
      assert.deepEqual(sentForm.fields, call.json);
      assert.deepEqual(sentJson.fields, call.json);
      assert.deepEqual(sentForm.fields, sentJson.fields);
    }
  } finally {
    await stub.close();
  }
});

test('the scriptless form round trip puts the notice in the page', async () => {
  const model = authoringModel();
  const stub = await startBoardStub({
    render: ({ notice, refusal }) =>
      renderBoardPage(model, { served: true, notice, refusal }),
  });
  try {
    const post = await fetch(stub.origin + '/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ title: 'Chase the bank' }).toString(),
      redirect: 'manual',
    });
    assert.equal(post.status, 303);
    const location = post.headers.get('location');
    const target = new URL(location, stub.origin);
    assert.equal(target.pathname, '/');
    assert.equal(
      target.searchParams.get('notice'),
      'Added as a draft: Chase the bank',
    );

    const page = await fetch(target);
    const html = await page.text();
    assert.ok(
      html.includes('Added as a draft: Chase the bank'),
      'the server-rendered page carries the line with scripting off',
    );
    assert.match(html, /id="page-line"[^>]*>/, 'the line is the same element');
  } finally {
    await stub.close();
  }
});

test('a 4xx refusal keeps the engine name and sentence', async () => {
  const model = authoringModel();
  const stub = await startBoardStub({
    render: ({ notice, refusal }) =>
      renderBoardPage(model, { served: true, notice, refusal }),
  });
  try {
    const json = await fetch(stub.origin + '/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Refuse this' }),
    });
    assert.equal(json.status, 409);
    assert.deepEqual(await json.json(), {
      refusal: 'duplicate-title',
      message: 'You already have a task with this name.',
    });

    const form = await fetch(stub.origin + '/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ title: 'Refuse this' }).toString(),
      redirect: 'manual',
    });
    assert.equal(form.status, 303);
    const page = await fetch(
      new URL(form.headers.get('location'), stub.origin),
    );
    const html = await page.text();
    assert.ok(html.includes('You already have a task with this name.'));
    assert.match(html, /class="page-line is-refusal"/);
    // The machine name stays in the JSON; the page shows only the sentence.
    assert.equal(html.includes('duplicate-title'), false);

    const missing = await fetch(stub.origin + '/api/tasks/tsk_missing/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).refusal, 'unknown-task');
  } finally {
    await stub.close();
  }
});

test('a settle refusal keeps the engine name and shows the serve sentence', async () => {
  const model = authoringModel();
  const stub = await startBoardStub({
    render: ({ notice, refusal }) =>
      renderBoardPage(model, { served: true, notice, refusal }),
  });
  try {
    const json = await fetch(stub.origin + '/api/tasks/tsk_unowned/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(json.status, 403);
    assert.deepEqual(await json.json(), {
      refusal: 'settle-no-owner',
      message:
        'This task has no one named to approve it, so it cannot be marked done here.',
    });

    const other = await fetch(
      stub.origin + '/api/tasks/tsk_someone_else/complete',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      },
    );
    assert.equal(other.status, 403);
    const otherAnswer = await other.json();
    assert.equal(otherAnswer.refusal, 'settle-not-owner');
    assert.equal(otherAnswer.message, 'This task is waiting for person:alice.');

    // A declared-outcome refusal is also the serve layer's sentence.
    const noOutcome = await fetch(
      stub.origin + '/api/tasks/tsk_no_outcome/complete',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      },
    );
    assert.equal(noOutcome.status, 400);
    assert.deepEqual(await noOutcome.json(), {
      refusal: 'settle-outcome-undeclared',
      message: 'This task does not accept that answer.',
    });

    const form = await fetch(stub.origin + '/api/tasks/tsk_unowned/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: '',
      redirect: 'manual',
    });
    assert.equal(form.status, 303);
    const page = await fetch(
      new URL(form.headers.get('location'), stub.origin),
    );
    const html = await page.text();
    assert.ok(
      html.includes(
        'This task has no one named to approve it, so it cannot be marked done here.',
      ),
    );
    assert.equal(html.includes('settle-no-owner'), false, 'the code is not copy');
  } finally {
    await stub.close();
  }
});

test('boardData passes the server\'s actions through, and only when served', () => {
  const model = authoringModel();
  const artefact = boardData(model);
  assert.equal(artefact.served, undefined);
  assert.equal(
    Object.values(artefact.rows).every((row) => row.actions === undefined),
    true,
  );
  const served = boardData(model, { served: true });
  assert.equal(served.served, true);
  assert.deepEqual(served.rows.plan.actions, [
    {
      verb: 'complete',
      label: 'Mark done',
      path: '/api/tasks/plan/complete',
      fields: { outcome: 'approve' },
    },
  ]);

  // The page does not gate by state or lane: a done row whose server sends an
  // action still carries it, and a malformed entry is dropped rather than
  // drawn as half a button.
  const odd = buildTree(
    snapshotOf({
      nodes: [
        node('root', '$root', 'ready', null),
        node('closed', 'closed', 'done', 'root', {
          title: 'Draft the plan',
          actions: [
            {
              verb: 'complete',
              label: 'Approve',
              path: '/api/tasks/closed/complete',
              fields: { outcome: 'approve' },
            },
            { verb: 'complete', label: 'No path' },
            { verb: 'complete', label: '', path: '/api/tasks/closed/complete', fields: {} },
          ],
        }),
      ],
      statuses: [statusOf('closed', 'done', { title: 'Draft the plan' })],
    }),
  );
  assert.deepEqual(boardData(odd, { served: true }).rows.closed.actions, [
    {
      verb: 'complete',
      label: 'Approve',
      path: '/api/tasks/closed/complete',
      fields: { outcome: 'approve' },
    },
  ]);
});
