// Independent final-check browser/gateway probe for issue #33 N1.
// Real board + real HTTP gateway + Obscura CDP browser. Each mutation reaches the
// board and upstream fake GitHub (one PATCH) before the gateway replaces the reply.
// Run from the worktree root.
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const { startFakeGitHub, makeIssue } = await import(path.resolve(root, 'web/tests/fake-github.mjs'));
const { startBoard, BOARD_PASSWORD } = await import(path.resolve(root, 'web/tests/helpers.mjs'));
const proofDir = path.resolve(
  root,
  '.agents/run/task-centred-architecture/verifications/issue-33-protocol-final-review',
);
await mkdir(path.join(proofDir, 'screenshots'), { recursive: true });

const baseline = await readFile(
  path.resolve(
    root,
    '.agents/run/task-centred-architecture/verifications/issue-33-final/browser-baseline.mjs',
  ),
  'utf8',
);
const helper = baseline.slice(baseline.indexOf('class CDP {'), baseline.indexOf('function fixtures()'));
const CDP_PORT = Number(process.env.FINAL_CDP_PORT ?? 9361);
const { CDP, ensureObscura } = new Function(
  'WebSocket',
  'fetch',
  'spawn',
  'CDP_PORT',
  'sleep',
  helper + ';return {CDP,ensureObscura};',
)(WebSocket, fetch, spawn, CDP_PORT, (ms) => new Promise((r) => setTimeout(r, ms)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const initialBody = '## Overview\nInitial overview\n\n## Open Questions\n- [ ] Initial question?\n';
const fake = await startFakeGitHub({
  issues: [
    makeIssue({
      number: 1,
      title: 'Protocol gateway probe',
      body: initialBody,
      labels: ['status:todo', 'bug', 'attention:needs-decision', 'phase:execution'],
    }),
  ],
});
const board = await startBoard(fake);

// mode: {status, body} or {destroy:true}
let mode = null;
let gatewayWrites = 0;
const gateway = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const target = await fetch(board.url + req.url, {
    method: req.method,
    headers: { ...req.headers, host: new URL(board.url).host },
    body: !['GET', 'HEAD'].includes(req.method) ? Buffer.concat(chunks) : undefined,
  });
  const text = await target.text();
  const isMutation = ['PUT', 'POST'].includes(req.method) && req.url.startsWith('/api/issues/');
  if (isMutation && mode) {
    gatewayWrites += 1;
    const capture = mode;
    mode = null;
    if (capture.destroy) {
      res.writeHead(200, { 'content-type': 'application/json', 'content-length': '9999' });
      res.write('{"issue":');
      setTimeout(() => res.destroy(), 20);
      return;
    }
    res.writeHead(capture.status, {
      'content-type': capture.contentType ?? 'application/json',
    });
    res.end(capture.body);
    return;
  }
  res.writeHead(target.status, Object.fromEntries(target.headers));
  res.end(text);
});
await new Promise((r) => gateway.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${gateway.address().port}`;

const browser = await ensureObscura();
const cdp = new CDP(`ws://127.0.0.1:${CDP_PORT}/devtools/browser`);
await cdp.open();
const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
const send = (m, p) => cdp.send(m, p, sessionId);
await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable').catch(() => {});

async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function wait(expression, label, attempts = 140) {
  for (let n = 0; n < attempts; n += 1) {
    if (await ev(expression)) return;
    await sleep(50);
  }
  const debug = await ev(
    `({url: location.href, text: document.body ? document.body.innerText.slice(0, 400) : '', save: document.getElementById('save-status') ? document.getElementById('save-status').textContent : '', notice: document.getElementById('notice') ? document.getElementById('notice').textContent : '', detailHidden: document.getElementById('detail-view') ? document.getElementById('detail-view').hidden : null})`,
  ).catch((error) => ({ error: String(error) }));
  console.error('WAIT TIMEOUT', label ?? expression, JSON.stringify(debug));
  throw new Error('wait timeout ' + (label ?? expression));
}
async function setViewport(width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: Boolean(mobile),
  });
}
const results = [];
const screenshots = [];
let cacheBust = 0;
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(proofDir, 'screenshots', name + '.png');
  await writeFile(file, Buffer.from(r.data, 'base64'));
  screenshots.push(file);
}

async function reloadDetail(bodyMarkerOrQuestion) {
  cacheBust += 1;
  await send('Page.navigate', { url: `${url}/?probe=${cacheBust}#/issue/1` });
  await wait('document.getElementById("detail-view") && !document.getElementById("detail-view").hidden', 'detail view');
  await wait(
    `document.getElementById("overview-text").value.includes(${JSON.stringify(bodyMarkerOrQuestion)})`,
    'overview marker ' + bodyMarkerOrQuestion,
  );
}

async function runCase(kind, name, capture, { narrow = false } = {}) {
  mode = capture;
  const before = fake.patchCalls.length;
  let expression;
  if (kind === 'section') {
    const marker = `Gateway committed ${name}`;
    expression = `document.getElementById('overview-text').value=${JSON.stringify(marker)};document.getElementById('save-overview').click()`;
    await ev(expression);
    await wait('document.getElementById("save-status").textContent !== "Saving…"', 'save status ' + name);
    await sleep(120);
    const text = await ev('document.getElementById("save-status").textContent');
    const visible = await ev(`(() => {
      const node = document.getElementById('save-status');
      return { text: node.textContent, visible: Boolean(node.offsetParent) };
    })()`);
    const result = {
      kind,
      name,
      text,
      visible,
      patches: fake.patchCalls.length - before,
      committed: fake.findIssue(1).body.includes(marker),
      gatewayWrites,
    };
    results.push(result);
    if (narrow) {
      await setViewport(360, 800, true);
      await shot(`${name}-360`);
      await setViewport(1280, 900, false);
    } else {
      await shot(name);
    }
    return result;
  }
  if (kind === 'question') {
    const marker = `answer for ${name}`;
    expression = `(() => {
      const input = document.getElementById('answer-0');
      input.value = ${JSON.stringify(marker)};
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('question-list').querySelector('.question-actions button').click();
    })()`;
    await ev(expression);
    await wait('document.getElementById("notice").textContent.length > 0', 'question notice ' + name);
    await sleep(120);
    const text = await ev('document.getElementById("notice").textContent');
    const visible = await ev('!document.getElementById("notice").hidden');
    const result = {
      kind,
      name,
      text,
      visible,
      patches: fake.patchCalls.length - before,
      committed: fake.findIssue(1).body.includes(`*(Answer: ${marker})*`),
      gatewayWrites,
    };
    results.push(result);
    if (narrow) {
      await setViewport(360, 800, true);
      await shot(`${name}-360`);
      await setViewport(1280, 900, false);
    } else {
      await shot(name);
    }
    return result;
  }
  // status
  expression = `(() => {
    const select = document.getElementById('status-select');
    select.value = 'status:in-review';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('apply-status').click();
  })()`;
  await ev(expression);
  await wait('document.getElementById("notice").textContent.length > 0', 'status notice ' + name);
  await sleep(120);
  const text = await ev('document.getElementById("notice").textContent');
  const visible = await ev('!document.getElementById("notice").hidden');
  const labels = fake.findIssue(1).labels.map((label) => label.name);
  const result = {
    kind,
    name,
    text,
    visible,
    patches: fake.patchCalls.length - before,
    committed: labels.includes('status:in-review'),
    labels,
    gatewayWrites,
  };
  results.push(result);
  if (narrow) {
    await setViewport(360, 800, true);
    await shot(`${name}-360`);
    await setViewport(1280, 900, false);
  } else {
    await shot(name);
  }
  return result;
}

try {
  await setViewport(1280, 900, false);
  await send('Page.navigate', { url });
  await wait('document.getElementById("login-form")!==null', 'login form');
  await ev(`document.getElementById('password').value=${JSON.stringify(BOARD_PASSWORD)};document.getElementById('login-form').requestSubmit()`);
  await wait('document.querySelector(".task-row")!==null', 'task row');
  await ev('document.querySelector(".task-row").click()');
  await wait('!document.getElementById("detail-view").hidden', 'initial detail');

  // Section cases.
  await runCase(
    'section',
    'section.gateway502',
    {
      status: 502,
      contentType: 'text/html',
      body: '<h1>Bad Gateway</h1>',
    },
    { narrow: true },
  );
  await reloadDetail('Gateway committed section.gateway502');

  await runCase('section', 'section.malformed200', { status: 200, body: '{bad' });
  await reloadDetail('Gateway committed section.malformed200');

  await runCase('section', 'section.empty200', { status: 200, body: '' });
  await reloadDetail('Gateway committed section.empty200');

  await runCase('section', 'section.generic500', {
    status: 500,
    body: JSON.stringify({ error: 'server_error', message: 'The board could not complete that request.' }),
  });
  await reloadDetail('Gateway committed section.generic500');

  await runCase('section', 'section.truncated200', { destroy: true });
  await reloadDetail('Gateway committed section.truncated200');

  await runCase('section', 'section.missingIssue', { status: 200, body: '{"saved":true}' });
  await reloadDetail('Gateway committed section.missingIssue');

  await runCase(
    'section',
    'section.invalidShape',
    { status: 200, body: '{"issue":{}}' },
    { narrow: true },
  );
  await sleep(200);
  await shot('section.invalidShape-after');

  // Question cases. Reset the issue body before each case.
  const questionBodies = [
    'question.gateway502',
    'question.malformed200',
    'question.empty200',
    'question.generic500',
    'question.invalidShape',
    'question.truncated200',
  ];
  const questionModes = {
    'question.gateway502': { status: 502, contentType: 'text/html', body: '<h1>Bad Gateway</h1>' },
    'question.malformed200': { status: 200, body: '{bad' },
    'question.empty200': { status: 200, body: '' },
    'question.generic500': {
      status: 500,
      body: JSON.stringify({ error: 'server_error', message: 'The board could not complete that request.' }),
    },
    'question.invalidShape': { status: 200, body: '{"issue":{}}' },
    'question.truncated200': { destroy: true },
  };
  for (const name of questionBodies) {
    fake.mutateIssue(1, (issue) => {
      issue.body = `## Overview\nQuestion gateway overview\n\n## Open Questions\n- [ ] Question for ${name}?\n`;
      issue.labels = ['status:todo', 'bug'].map((label) => ({ name: label, color: 'ededed' }));
    });
    await reloadDetail('Question gateway overview');
    await wait('document.getElementById("answer-0") !== null', 'answer input ' + name);
    await runCase('question', name, questionModes[name], { narrow: name === 'question.gateway502' });
  }

  // Status cases.
  const statusBodies = [
    'status.gateway502',
    'status.malformed200',
    'status.empty200',
    'status.generic500',
    'status.invalidShape',
    'status.truncated200',
  ];
  const statusModes = {
    'status.gateway502': { status: 502, contentType: 'text/html', body: '<h1>Bad Gateway</h1>' },
    'status.malformed200': { status: 200, body: '{bad' },
    'status.empty200': { status: 200, body: '' },
    'status.generic500': {
      status: 500,
      body: JSON.stringify({ error: 'server_error', message: 'The board could not complete that request.' }),
    },
    'status.invalidShape': { status: 200, body: '{"issue":{}}' },
    'status.truncated200': { destroy: true },
  };
  for (const name of statusBodies) {
    fake.mutateIssue(1, (issue) => {
      issue.body = initialBody;
      issue.labels = ['status:todo', 'bug', 'attention:needs-decision', 'phase:execution'].map((label) => ({
        name: label,
        color: 'ededed',
      }));
    });
    await reloadDetail('Initial overview');
    await wait('document.getElementById("status-select") !== null', 'status select ' + name);
    await runCase('status', name, statusModes[name], { narrow: name === 'status.gateway502' });
  }

  await writeFile(
    path.join(proofDir, 'browser-gateway.json'),
    JSON.stringify(
      {
        kind: 'real HTTP gateway + Obscura CDP browser',
        results,
        screenshots,
        gatewayWrites,
        boardLogs: board.logs,
        runtimeEvents: cdp.events.filter(
          (e) => e.method === 'Runtime.exceptionThrown' || e.method === 'Runtime.consoleAPICalled',
        ),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await send('Target.closeTarget', { targetId: target.targetId }).catch(() => {});
  cdp.close();
  gateway.closeAllConnections();
  await new Promise((r) => gateway.close(r));
  await board.app.close();
  await fake.close();
  if (browser.started) process.kill(-browser.child.pid);
}
