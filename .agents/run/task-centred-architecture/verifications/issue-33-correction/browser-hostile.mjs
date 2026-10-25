// ==========================================
// Hostile real-browser verification for Issue #33 correction.
// ==========================================

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const ARTIFACT_ROOT = path.join(
  ROOT,
  '.agents/run/task-centred-architecture/verifications/issue-33-correction',
);
const SHOTS = path.join(ARTIFACT_ROOT, 'screenshots');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const CDP_PORT = Number(process.env.OBS_CDP_PORT ?? 9366);
const SYNTHETIC_TOKEN = 'ghp_synthetic_browser_token_00000000';

const { startFakeGitHub, makeIssue } = await import(path.resolve(ROOT, 'web/tests/fake-github.mjs'));
const { startBoard, BOARD_PASSWORD } = await import(path.resolve(ROOT, 'web/tests/helpers.mjs'));

const results = {
  kind: 'issue-33-correction hostile browser verification',
  startedAt: new Date().toISOString(),
  engine: 'Obscura (CDP)',
  checks: [],
  screenshots: [],
  notes: [],
  hostileObservations: [],
};

function check(name, condition, detail = '') {
  results.checks.push({ name, pass: Boolean(condition), detail });
  if (!condition) throw new Error(`check failed: ${name}${detail ? ` (${detail})` : ''}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDP {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
  }

  async open() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!message.id) {
        this.events.push(message);
        return;
      }
      if (!this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message || 'CDP error'));
      else resolve(message.result);
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      this.ws.send(JSON.stringify(payload));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 20_000);
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {
      // already closed
    }
  }
}

async function ensureObscura() {
  const endpoint = `http://127.0.0.1:${CDP_PORT}/json/version`;
  try {
    const response = await fetch(endpoint);
    if (response.ok) return { started: false };
  } catch {
    // not running
  }
  const child = spawn('obscura', ['serve', '--port', String(CDP_PORT), '--allow-private-network'], {
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return { started: true, child };
    } catch {
      // wait
    }
    await sleep(250);
  }
  throw new Error('obscura serve failed to start');
}

function fixtures() {
  const body1 = [
    '## Overview',
    'We need a standalone board web surface.',
    '',
    '## Human Tasks',
    '- [ ] Approve the synthetic rollout',
    '',
    '## Open Questions',
    '- [ ] Should the board show closed tasks?',
    '',
    '## Test Plan (Issue)',
    '- [ ] Verify login flow in browser',
  ].join('\n');

  return [
    makeIssue({
      number: 1,
      title: 'Ship the standalone board',
      body: body1,
      labels: ['status:in-progress', 'phase:execution', 'attention:needs-decision', 'bug'],
    }),
    makeIssue({
      number: 2,
      title: 'Tighten rate limiting',
      body: '## Overview\nRate limit the login route.\n',
      labels: ['status:todo', 'phase:planning'],
    }),
    makeIssue({
      number: 3,
      title: 'Pull request candidate',
      pull_request: true,
      labels: ['status:in-review'],
    }),
    makeIssue({
      number: 4,
      title: 'Finished foundation',
      body: '## Overview\nDone work.\n',
      state: 'closed',
      labels: ['status:done'],
    }),
  ];
}

await mkdir(SHOTS, { recursive: true });

const browser = await ensureObscura();
const cdp = new CDP(`ws://127.0.0.1:${CDP_PORT}/devtools/browser`);
await cdp.open();

const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await cdp.send('Target.attachToTarget', {
  targetId: target.targetId,
  flatten: true,
});

const send = (method, params = {}) => cdp.send(method, params, sessionId);
await send('Page.enable');
await send('Runtime.enable');
await send('DOM.enable');

const fake = await startFakeGitHub({
  token: SYNTHETIC_TOKEN,
  issues: fixtures(),
});
const board = await startBoard(fake);

async function evaluate(expression) {
  const evalResult = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (evalResult.exceptionDetails) {
    const errorText =
      evalResult.exceptionDetails.exception?.description ||
      evalResult.exceptionDetails.text ||
      'Runtime.evaluate threw';
    throw new Error(errorText);
  }
  return evalResult.result.value;
}

async function waitFor(expression, label, timeoutMs = 15_000) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await evaluate(expression);
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(50);
  }
  const diagnostics = await evaluate(`(() => ({
    url: location.href,
    hash: location.hash,
    bodyLength: document.body ? document.body.innerHTML.length : 0,
    visibleText: document.body ? document.body.innerText.slice(0, 300) : '',
    activeElement: document.activeElement ? document.activeElement.tagName + '#' + document.activeElement.id : null,
  }))()`).catch(() => null);
  const pageErrors = cdp.events
    .filter((event) => event.method === 'Runtime.exceptionThrown' || event.method === 'Runtime.consoleAPICalled')
    .slice(-5)
    .map((event) => JSON.stringify(event.params).slice(0, 500));
  throw new Error(
    `timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}\n` +
      `diagnostics=${JSON.stringify(diagnostics)}\npageErrors=${pageErrors.join(' | ')}`,
  );
}

async function goto(url) {
  await send('Page.navigate', { url });
  await waitFor('document.readyState === "complete"', `load ${url}`);
}

async function setViewport(width, height, mobile = false) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
}

async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(SHOTS, `${name}-${STAMP}.png`);
  await writeFile(file, Buffer.from(shot.data, 'base64'));
  results.screenshots.push(path.relative(ROOT, file));
  return file;
}

function noOverflow(expressionName) {
  return evaluate(`(() => {
    const doc = document.documentElement;
    return {
      inner: window.innerWidth,
      client: doc.clientWidth,
      scroll: Math.max(doc.scrollWidth, document.body ? document.body.scrollWidth : 0),
    };
  })()`).then((size) => {
    check(
      `${expressionName}: no horizontal overflow`,
      size.scroll <= size.client + 1,
      `scrollWidth=${size.scroll} clientWidth=${size.client}`,
    );
  });
}

const base = board.url;
try {
  await setViewport(1280, 900, false);
  await goto(`${base}/`);
  await waitFor('!document.getElementById("login-view").hidden', 'login view');
  await screenshot('login-desktop');
  check('login page hides data', !(await evaluate('document.body.textContent.includes("Ship the standalone board")')));

  // Sign in through the real form.
  await evaluate(`(() => {
    const input = document.getElementById('password');
    input.value = ${JSON.stringify(BOARD_PASSWORD)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('login-form').requestSubmit();
    return true;
  })()`);
  await waitFor('!document.getElementById("board-view").hidden', 'board view');
  await waitFor('document.querySelectorAll(".task-row").length === 3', 'three task rows');
  check('pull requests are excluded from the board', (await evaluate('document.querySelectorAll(".task-row").length')) === 3);
  check(
    'board names the configured repository',
    (await evaluate('document.getElementById("repo-label").textContent')) === 'owner/repo',
  );
  check(
    'session cookie is not readable from JavaScript',
    (await evaluate('document.cookie')) === '',
  );
  check(
    'nothing is kept in local or session storage',
    (await evaluate('localStorage.length + sessionStorage.length')) === 0,
  );
  const visibleText = await evaluate('document.documentElement.outerHTML');
  check('page source carries no token', !visibleText.includes(SYNTHETIC_TOKEN));
  check('page source carries no password', !visibleText.includes(BOARD_PASSWORD));
  await screenshot('board-desktop');
  await noOverflow('desktop board');

  // Open a task through its real button.
  await evaluate('document.querySelector(".task-row").click()');
  await waitFor('!document.getElementById("detail-view").hidden', 'detail view');
  await waitFor('document.getElementById("detail-title").textContent.includes("Ship the standalone board")', 'detail title');
  check('detail shows phase metadata', (await evaluate('document.getElementById("detail-meta").textContent')).toLowerCase().includes('execution'));
  check('detail shows attention metadata', (await evaluate('document.getElementById("detail-meta").textContent')).toLowerCase().includes('decision'));
  check('detail shows an open question input', (await evaluate('Boolean(document.getElementById("answer-0"))')));
  check(
    'detail has no agent or session controls',
    !(await evaluate('/start\\s+agent|open\\s+session|agent\\s+activity/i.test(document.body.textContent)')),
  );
  check(
    'detail shows warning that simultaneous edit can be overwritten',
    (await evaluate('document.getElementById("edit-warning").textContent')).includes(
      'a simultaneous edit on GitHub or by an agent can still be overwritten',
    ),
  );
  await screenshot('task-detail-desktop');
  await noOverflow('desktop task detail');

  // Save the overview.
  const editedOverview = 'Synthetic overview edited in a real browser.';
  await evaluate(`(() => {
    const area = document.getElementById('overview-text');
    area.value = ${JSON.stringify(editedOverview)};
    area.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('save-overview').click();
    return true;
  })()`);
  await waitFor('document.getElementById("save-status").textContent.startsWith("Saved")', 'overview saved');
  const afterSave = fake.findIssue(1).body;
  check('overview edit reached GitHub', afterSave.includes(editedOverview));
  check(
    'other sections survived the edit',
    afterSave.includes('## Human Tasks\n- [ ] Approve the synthetic rollout') &&
      afterSave.includes('- [ ] Should the board show closed tasks?') &&
      afterSave.includes('## Test Plan (Issue)'),
  );

  // Conflict: change the issue behind the page, then try to save.
  fake.mutateIssue(1, (issue) => {
    issue.body = issue.body.replace(editedOverview, 'Remote change while the page was open.');
  });
  await evaluate(`(() => {
    const area = document.getElementById('overview-text');
    area.value = 'Local overwrite attempt.';
    area.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('save-overview').click();
    return true;
  })()`);
  await waitFor('!document.getElementById("conflict-banner").hidden', 'conflict banner');
  check(
    'conflict is explained and offers a reload',
    (await evaluate('document.getElementById("conflict-message").textContent')).includes('Nothing was written') &&
      (await evaluate('Boolean(document.getElementById("conflict-reload"))')),
  );
  check(
    'conflict did not overwrite the remote change',
    fake.findIssue(1).body.includes('Remote change while the page was open.') &&
      !fake.findIssue(1).body.includes('Local overwrite attempt.'),
  );
  results.notes.push(`fake GitHub PATCH calls after conflict: ${fake.patchCalls.length}`);
  await screenshot('conflict-desktop');

  // Reload and answer a question inline.
  await evaluate('document.getElementById("conflict-reload").click()');
  await waitFor('document.getElementById("conflict-banner").hidden', 'conflict banner cleared');
  await waitFor('document.getElementById("overview-text").value.includes("Remote change")', 'fresh overview');
  await evaluate(`(() => {
    const input = document.getElementById('answer-0');
    input.value = 'Yes, show closed tasks in a muted section.';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.closest('.question-actions').querySelector('button').click();
    return true;
  })()`);
  await waitFor('document.querySelectorAll("#question-list .question-answered").length === 1', 'question answered');
  check(
    'inline answer was written to the issue',
    fake.findIssue(1).body.includes('*(Answer: Yes, show closed tasks in a muted section.)*'),
  );

  // Change the status label.
  await evaluate(`(() => {
    const select = document.getElementById('status-select');
    select.value = 'status:in-review';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('apply-status').click();
    return true;
  })()`);
  await waitFor('document.getElementById("detail-meta").textContent.toLowerCase().includes("in review")', 'status updated');
  const labels = fake.findIssue(1).labels.map((label) => label.name);
  check('status label changed', labels.includes('status:in-review'));
  check('non-status labels were preserved', labels.includes('bug'));
  await screenshot('task-detail-after-edits-desktop');

  // Browser write transport loss probe (R1)
  const beforeTransport = fake.patchCalls.length;
  await evaluate(`(() => {
    window._realFetch = window.fetch;
    window.fetch = async function(input, options) {
      const response = await window._realFetch(input, options);
      if (options && (options.method === 'PUT' || options.method === 'POST')) {
        await response.clone().text();
        throw new TypeError('Synthetic browser response loss');
      }
      return response;
    };
    document.getElementById('overview-text').value = 'Browser transport loss committed edit';
    document.getElementById('save-overview').click();
  })()`);
  await waitFor('document.getElementById("save-status").textContent.toLowerCase().includes("outcome unknown")', 'browser transport loss message');
  check(
    'browser transport failure on write classifies outcome as unknown and offers refresh (R1)',
    (await evaluate('document.getElementById("save-status").textContent')).toLowerCase().includes('outcome unknown') &&
      (await evaluate('document.getElementById("save-status").textContent')).toLowerCase().includes('refresh'),
  );
  check(
    'browser transport failure makes zero write retries (R1)',
    fake.patchCalls.length === beforeTransport + 1,
  );
  await evaluate('window.fetch = window._realFetch; delete window._realFetch;');

  // N1 Hostile replacements: commit completes, then browser sees protocol/gateway replacement.
  results.hostileObservations = [];
  for (const [name, code, replacement] of [
    ['malformed200', 200, '<html>broken JSON</html>'],
    ['gateway502', 502, '<html>Bad gateway</html>'],
    ['empty200', 200, ''],
    ['generic500', 500, '{"error":"server_error","message":"The board could not complete that request"}'],
  ]) {
    await goto(`${base}/#/issue/1`);
    await waitFor('!document.getElementById("detail-view").hidden && document.getElementById("overview-text").value.includes("committed")', 'fresh issue for ' + name);
    const before = fake.patchCalls.length;
    await evaluate(`(() => {
      window._originalFetch = window.fetch;
      window.fetch = async function(input, options) {
        const response = await window._originalFetch(input, options);
        if (String(input).endsWith('/section') && options.method === 'PUT') {
          await response.text();
          return new Response(${JSON.stringify(replacement)}, {status: ${code}});
        }
        return response;
      };
      document.getElementById('overview-text').value = ${JSON.stringify('committed browser ' + name)};
      document.getElementById('save-overview').click();
    })()`);
    await waitFor('document.getElementById("save-status").textContent !== "Saving…"', 'replacement settled ' + name);
    const text = await evaluate('document.getElementById("save-status").textContent');
    const committed = fake.findIssue(1).body.includes('committed browser ' + name);
    results.hostileObservations.push({
      name,
      text,
      patches: fake.patchCalls.length - before,
      committed,
      unknownGuidance: text.toLowerCase().includes('outcome unknown') && text.toLowerCase().includes('refresh'),
    });
    check(
      `hostile mutation response (${name}) reports outcome unknown with refresh guidance (N1)`,
      text.toLowerCase().includes('outcome unknown') && text.toLowerCase().includes('refresh'),
      `text="${text}"`,
    );
    await screenshot('hostile-' + name);
    await evaluate('window.fetch = window._originalFetch; delete window._originalFetch');
  }

  // Actual issue-controlled hostile text, not innerHTML injected by the test.
  fake.mutateIssue(1, (issue) => {
    issue.title = '<img src=x onerror="window.__xss=1">';
    issue.body += '\n## Open Questions\n- [ ] <svg onload="window.__xss=2">payload</svg>\n';
    issue.labels.push({ name: '<script>window.__xss=3</script>', color: 'ededed' });
  });
  await goto(`${base}/#/issue/1`);
  await waitFor('document.getElementById("detail-title").textContent.includes("<img")', 'hostile title rendered as text');
  check('independent XSS text remains inert', !(await evaluate('Boolean(window.__xss || document.querySelector("img[onerror],svg[onload],script:not([src])"))')));
  await screenshot('hostile-text-inert');
  await goto(`${base}/`);
  await waitFor('!document.getElementById("board-view").hidden && document.querySelectorAll(".task-row").length === 3', 'healthy board after extra navigation');
  await sleep(250);

  // Stale state: GitHub fails while a board is already loaded.
  await setViewport(1280, 900, false);
  fake.setFailure(true);
  await evaluate('document.getElementById("back-btn").click()');
  await waitFor('!document.getElementById("board-view").hidden', 'board view before stale refresh');
  await evaluate('document.getElementById("refresh-btn").click()');
  await waitFor('!document.getElementById("notice").hidden', 'stale notice');
  await waitFor('document.getElementById("freshness").classList.contains("stale")', 'stale freshness marker');
  check(
    'a failed refresh keeps the last board and says it is stale',
    (await evaluate('document.querySelectorAll(".task-row").length')) === 3,
  );
  await screenshot('stale-board-desktop');
  fake.setFailure(false);
  await evaluate('document.getElementById("refresh-btn").click()');
  await waitFor('document.getElementById("notice").hidden', 'notice cleared after refresh');

  // Empty state: no issues in the configured repository.
  const savedIssues = fake.state.issues;
  fake.state.issues = [];
  await evaluate('document.getElementById("refresh-btn").click()');
  await waitFor('!document.getElementById("empty-state").hidden', 'empty state');
  check('the empty repository state is plainly explained', (await evaluate('document.getElementById("empty-state").textContent')).includes('No tasks'));
  await screenshot('empty-board-desktop');
  fake.state.issues = savedIssues;
  await evaluate('document.getElementById("refresh-btn").click()');
  await waitFor('document.querySelectorAll(".task-row").length === 3', 'board restored');

  // 360px: board then detail.
  await setViewport(360, 800, true);
  await evaluate('document.getElementById("back-btn").click()');
  await waitFor('!document.getElementById("board-view").hidden', 'board view at 360px');
  await screenshot('board-360');
  await noOverflow('360px board');

  await evaluate('document.querySelector(".task-row").click()');
  await waitFor('!document.getElementById("detail-view").hidden', 'detail at 360px');
  await screenshot('task-detail-360');
  await noOverflow('360px task detail');

  // Keyboard reachability and visible focus styling.
  const controls = await evaluate(`(() => Array.from(
    document.querySelectorAll('a[href], button, input, select, textarea')
  ).map((node) => ({
    tag: node.tagName,
    id: node.id || '',
    aria: node.getAttribute('aria-label') || '',
    tabIndex: node.tabIndex,
    disabled: node.disabled || false,
    text: (node.textContent || '').trim().slice(0, 40),
  })))()`);
  check('reachable controls exist on detail', controls.length >= 6);
  check('controls have natural tab order', controls.every((c) => c.tabIndex >= 0));

  await evaluate('document.getElementById("save-overview").focus()');
  const focusedTag = await evaluate('document.activeElement.id');
  check('control can receive programmatic focus', focusedTag === 'save-overview');
  const focusRing = await evaluate(`(() => {
    const el = document.getElementById('save-overview');
    const style = window.getComputedStyle(el);
    return {
      outlineWidth: style.outlineWidth,
      outlineStyle: style.outlineStyle,
      boxShadow: style.boxShadow,
    };
  })()`);
  check(
    'save button has visible focus outline or shadow',
    focusRing.outlineStyle !== 'none' || focusRing.boxShadow !== 'none',
    JSON.stringify(focusRing),
  );

  // Sign out.
  await evaluate('document.getElementById("signout-btn").click()');
  await waitFor('!document.getElementById("login-view").hidden', 'login view after sign out');
  await screenshot('signed-out-360');
  check('signing out clears the session cookie', (await evaluate('document.cookie')) === '');

  console.log(`PASS: ${results.checks.length}/${results.checks.length} browser checks passed`);
  console.log('Hostile observations:', JSON.stringify(results.hostileObservations, null, 2));

  await writeFile(
    path.join(ARTIFACT_ROOT, 'browser-hostile.json'),
    JSON.stringify(
      {
        ...results,
        finishedAt: new Date().toISOString(),
        boardLogs: board.logs,
        runtimeEvents: cdp.events.filter(
          (event) => event.method === 'Runtime.exceptionThrown' || event.method === 'Runtime.consoleAPICalled',
        ),
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await send('Target.closeTarget', { targetId: target.targetId });
  cdp.close();
  await board.app.close();
  await fake.close();
  if (browser.started) process.kill(-browser.child.pid);
}
