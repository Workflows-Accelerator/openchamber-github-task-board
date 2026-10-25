// ==========================================
// Real-browser verification for the standalone board.
//
// Synthetic fixtures only: a fake GitHub server, a throwaway board password and
// no real repository or credential. Drives Obscura over CDP (Chromium protocol)
// with Node's built-in WebSocket, then writes screenshots and a report.
//
// Run: node web/tests/browser-verify.mjs
// ==========================================

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { startFakeGitHub, makeIssue } from '/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/web/tests/fake-github.mjs';
import { startBoard, browserConfig, HttpSession, BOARD_PASSWORD } from '/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/web/tests/helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = '/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board';
const ARTIFACT_ROOT = path.join(
  ROOT,
  '.agents/run/task-centred-architecture/verifications/issue-33-final',
);
const SHOTS = path.join(ARTIFACT_ROOT, 'screenshots');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const CDP_PORT = Number(process.env.OBS_CDP_PORT ?? 9333);
const SYNTHETIC_TOKEN = 'ghp_synthetic_browser_token_00000000';

const results = {
  kind: 'synthetic-fixture browser verification',
  startedAt: new Date().toISOString(),
  engine: 'Obscura (CDP), no Chromium download',
  fixtures: 'fake GitHub server with synthetic issues',
  checks: [],
  screenshots: [],
  notes: [],
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
    await sleep(250);
    try {
      const response = await fetch(endpoint);
      if (response.ok) return { started: true, child };
    } catch {
      // keep waiting
    }
  }
  throw new Error('Obscura did not start listening on the CDP port');
}

function fixtures() {
  return [
    makeIssue({
      number: 1,
      title: 'Ship the standalone board',
      updated_at: '2026-10-22T09:00:00Z',
      labels: ['status:todo', 'phase:execution', 'attention:needs-decision', 'bug'],
      body: [
        '## Overview',
        '',
        'Synthetic fixture: the standalone board reads and edits GitHub issues without an agent.',
        '',
        '## Acceptance Criteria',
        '- [ ] Board lists every open issue',
        '- [x] Sign-in is required',
        '',
        '## Open Questions',
        '- [ ] Should the board show closed tasks?',
        '- [ ] Who approves the rollout?',
        '',
        '## Human Tasks',
        '- [ ] Approve the synthetic rollout',
        '',
        '## Test Plan (Issue)',
        '- [ ] node --test web/tests/*.test.mjs',
        '',
      ].join('\n'),
    }),
    makeIssue({
      number: 4,
      title:
        'Investigate https://example.test/a/very/long/path/that/should/wrap/without/horizontal/scroll/on/narrow/screens',
      updated_at: '2026-10-21T15:30:00Z',
      labels: ['status:backlog', 'phase:planning'],
      body: '## Overview\n\nA long unbroken link is the worst case for a 360px screen.\n',
    }),
    makeIssue({
      number: 2,
      title: 'Closed example task',
      state: 'closed',
      updated_at: '2026-10-19T08:00:00Z',
      labels: ['status:done', 'phase:done'],
      body: '## Overview\n\nClosed synthetic fixture.\n',
    }),
    makeIssue({
      number: 3,
      title: 'Synthetic pull request',
      pull_request: true,
      labels: ['status:in-review'],
    }),
  ];
}

async function main() {
  await mkdir(SHOTS, { recursive: true });
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN, issues: fixtures() });
  const board = await startBoard(fake, {
    config: browserConfig(fake, { BOARD_GITHUB_TOKEN: SYNTHETIC_TOKEN }),
  });
  const obscura = await ensureObscura();
  const cdp = new CDP(`ws://127.0.0.1:${CDP_PORT}/devtools/browser`);
  await cdp.open();

  const created = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const attached = await cdp.send('Target.attachToTarget', { targetId: created.targetId, flatten: true });
  const session = attached.sessionId;

  const send = (method, params) => cdp.send(method, params, session);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable').catch(() => {});

  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text ||
          'page script error',
      );
    }
    return result.result.value;
  }

  async function pageDiagnostics() {
    try {
      return await evaluate(`(() => ({
        hash: location.hash,
        title: document.title,
        notice: (document.getElementById('notice') || {}).textContent || '',
        boardHidden: (document.getElementById('board-view') || {}).hidden,
        detailHidden: (document.getElementById('detail-view') || {}).hidden,
        body: document.body.innerText.slice(0, 600),
      }))()`);
    } catch {
      return null;
    }
  }

  async function waitFor(expression, label, timeout = 12_000) {
    const deadline = Date.now() + timeout;
    let lastError = null;
    while (Date.now() < deadline) {
      try {
        const value = await evaluate(`Boolean(${expression})`);
        if (value) return true;
      } catch (error) {
        lastError = error;
      }
      await sleep(120);
    }
    const diagnostics = await pageDiagnostics();
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
    await waitFor('document.querySelectorAll("#question-list .question-item").length === 1', 'question answered');
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
    // Obscura's CDP input layer does not deliver Tab key presses as real
    // navigation, so focus order is verified structurally and the focus ring by
    // focusing a real control; actual Tab traversal is recorded as NOT RUN.
    const controls = await evaluate(`(() => Array.from(
      document.querySelectorAll('a[href], button, input, select, textarea')
    ).map((node) => ({
      tag: node.tagName,
      id: node.id || '',
      tabIndex: node.tabIndex,
      disabled: Boolean(node.disabled),
    })))()`);
    check(
      'every control is a native element in the tab order',
      controls.length > 0 && controls.every((control) => !control.disabled && control.tabIndex >= 0),
      JSON.stringify(controls),
    );
    const focusStyle = await evaluate(`(() => {
      const row = document.querySelector('.task-row');
      row.focus();
      const styles = getComputedStyle(row);
      return {
        active: document.activeElement === row,
        outlineStyle: styles.outlineStyle,
        outlineWidth: styles.outlineWidth,
        matchesFocusVisible: row.matches(':focus-visible'),
      };
    })()`);
    check(
      'focus can be moved to a real control',
      focusStyle.active,
      JSON.stringify(focusStyle),
    );
    const stylesheet = await evaluate("fetch('/theme.css').then((response) => response.text())");
    check(
      'the stylesheet defines a visible :focus-visible ring',
      stylesheet.includes(':focus-visible') && stylesheet.includes('outline: 2px solid var(--prim)'),
    );
    results.notes.push('NOT RUN: real Tab-key traversal and computed :focus-visible ring; Obscura does not deliver synthetic key presses and script focus does not engage the focus-visible heuristic. The :focus-visible rule is present in the served stylesheet and every control is in the tab order.');

    // Sign out returns to the login view.
    await evaluate('document.getElementById("signout-btn").click()');
    await waitFor('!document.getElementById("login-view").hidden', 'login view after sign out');
    check(
      'signing out clears the board from the page',
      (await evaluate('document.querySelectorAll(".task-row").length')) === 0,
    );
    await setViewport(360, 800, true);
    await screenshot('signed-out-360');
    await noOverflow('360px sign-in');
  } finally {
    try {
      await send('Target.closeTarget', { targetId: created.targetId });
    } catch {
      // best effort
    }
    cdp.close();
    await board.app.close();
    await fake.close();
    if (obscura.started && obscura.child) {
      try {
        process.kill(-obscura.child.pid);
      } catch {
        try {
          obscura.child.kill();
        } catch {
          // already gone
        }
      }
    }
  }

  results.runtimeEvents = cdp.events.filter(e => e.method === 'Runtime.exceptionThrown' || e.method === 'Runtime.consoleAPICalled');
  results.serverLogs = board.logs;
  const passed = results.checks.filter((entry) => entry.pass).length;
  results.finishedAt = new Date().toISOString();
  results.summary = { checks: results.checks.length, passed, failed: results.checks.length - passed, screenshots: results.screenshots.length };
  await writeFile(path.join(ARTIFACT_ROOT, 'browser-verification.json'), `${JSON.stringify(results, null, 2)}\n`);

  const lines = [
    '# Browser verification — standalone board (synthetic fixtures)',
    '',
    `- Engine: ${results.engine}`,
    `- Fixtures: ${results.fixtures}`,
    `- Started: ${results.startedAt}`,
    `- Finished: ${results.finishedAt}`,
    '',
    '| Check | Result | Detail |',
    '| --- | --- | --- |',
    ...results.checks.map(
      (entry) => `| ${entry.name.replace(/\|/g, '\\|')} | ${entry.pass ? 'PASS' : 'FAIL'} | ${String(entry.detail).replace(/\|/g, '\\|')} |`,
    ),
    '',
    '## Screenshots',
    '',
    ...results.screenshots.map((file) => `- \`${file}\``),
    '',
  ];
  await writeFile(path.join(ARTIFACT_ROOT, 'browser-verification-report.md'), lines.join('\n'));
  console.log(JSON.stringify({ checks: results.checks.length, passed, screenshots: results.screenshots.length }));
  for (const shot of results.screenshots) console.log(shot);
}

main().catch(async (error) => {
  console.error('browser verification failed:', error.message);
  try {
    await writeFile(
      path.join(ARTIFACT_ROOT, 'browser-verification-failure.json'),
      `${JSON.stringify({ ...results, error: error.message }, null, 2)}\n`,
    );
  } catch {
    // nothing else to do
  }
  process.exitCode = 1;
});
