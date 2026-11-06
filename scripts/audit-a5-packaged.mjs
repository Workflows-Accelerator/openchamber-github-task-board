// Independent browser audit against the packaged foundation release artifact (web/dist/server.mjs + web/public/).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startFakeGitHub, makeIssue } from '../web/tests/fake-github.mjs';
import { BOARD_PASSWORD, SESSION_SECRET } from '../web/tests/helpers.mjs';

const releaseDir = process.env.PACKAGED_RELEASE_DIR;
if (!releaseDir || !fs.existsSync(path.join(releaseDir, 'web/dist/server.mjs'))) {
  console.error('PACKAGED_RELEASE_DIR must point to a valid packaged release containing web/dist/server.mjs');
  process.exit(1);
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(err => err ? reject(err) : resolve(port));
    });
    srv.on('error', reject);
  });
}

async function ensureObscura() {
  try {
    const res = await fetch('http://127.0.0.1:9222/json/version');
    if (res.ok) return;
  } catch {}
  const child = spawn('obscura', ['serve', '--port', '9222', '--allow-private-network'], { stdio: 'ignore', detached: true });
  child.unref();
  for (let i = 0; i < 60; i++) {
    await pause(250);
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) return;
    } catch {}
  }
  throw new Error('Obscura did not start on 9222');
}

class CDP {
  pending = new Map();
  next = 0;
  events = [];
  async open() {
    await ensureObscura();
    this.ws = new WebSocket('ws://127.0.0.1:9222/devtools/browser');
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });
    this.ws.addEventListener('message', event => {
      const data = JSON.parse(event.data);
      if (!data.id) {
        this.events.push(data);
        return;
      }
      const pending = this.pending.get(data.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(data.id);
      if (data.error) pending.reject(new Error(data.error.message));
      else pending.resolve(data.result);
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('CDP timeout ' + method));
      }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
}

const report = [];
const record = (name, verdict, data = {}) => {
  const entry = { name, verdict, ...data };
  report.push(entry);
  console.log(JSON.stringify(entry));
};

const noteMarker = '<!-- board-canvas: {"x":140,"y":120,"notes":[{"id":"note-1","x":160,"y":280,"w":220,"h":130,"text":"INTERNAL_NOTE body","color":"yellow"}]} -->';
const body1 = [
  '---',
  'agent: internal-agent',
  'model: internal-model',
  'worktree: /workspace/internal-worktree',
  '---',
  '## Overview',
  'Public **overview**.',
  '<!-- internal comment -->',
  '## Open Questions',
  '- [ ] INTERNAL_QUESTION choose a date',
  '## Human Tasks',
  '- [ ] INTERNAL_TASK approve release',
  '- [ ] INTERNAL_TASK confirm records',
  '',
  noteMarker,
].join('\n');

const fake = await startFakeGitHub({
  repositories: [
    {
      repo: 'owner/repo',
      id: 1,
      issues: [
        makeIssue({ number: 1, repo: 'owner/repo', title: 'Primary task with questions, human tasks, and note', body: body1, labels: ['status:needs-human', 'priority:high', 'ready-to-run'] }),
        makeIssue({ number: 2, repo: 'owner/repo', title: 'Unprioritized todo task', body: '## Overview\nVisible todo task without priority label.', labels: ['status:todo'] }),
        makeIssue({ number: 3, repo: 'owner/repo', title: 'Internal draft task', body: '## Overview\nINTERNAL_DRAFT body', labels: ['status:draft'] }),
        makeIssue({ number: 4, repo: 'owner/repo', title: 'Backburner task', body: '## Overview\nParked for later.', labels: ['status:backlog', 'backburner'] }),
        makeIssue({ number: 5, repo: 'owner/repo', title: 'Cross-repo dependent task', body: '## Overview\nWaiting on upstream repo.', labels: ['status:todo', 'priority:medium'] }),
        makeIssue({ number: 6, repo: 'owner/repo', state: 'closed', closed_at: '2026-11-05T12:00:00Z', title: 'Closed task in repo 1', body: '## Overview\nCompleted work.', labels: ['status:done'] }),
      ],
    },
    {
      repo: 'owner/other-repo',
      id: 2,
      issues: [
        makeIssue({ number: 10, repo: 'owner/other-repo', title: 'Cross-repo upstream platform API', body: '## Overview\nUpstream API in second repository.', labels: ['status:in-progress', 'priority:high'] }),
        makeIssue({ number: 11, repo: 'owner/other-repo', title: 'Consumer SDK migration guide', body: '## Overview\nBlocked by #10.', labels: ['status:todo'] }),
      ],
    },
    {
      repo: 'owner/empty-repo',
      id: 3,
      issues: [],
    },
  ],
});

// Add same-repo and cross-repo dependencies
fake.addDependency(2, 1, 'owner/repo', 'owner/repo');
fake.addDependency(5, 1, 'owner/repo', 'owner/repo');
fake.addDependency(5, 10, 'owner/repo', 'owner/other-repo');
fake.addDependency(11, 10, 'owner/other-repo', 'owner/other-repo');

// Return real-shaped GitHub REST blocked_by payload (repository_url + html_url without repository object) for #10
fake.setDependencyHook(({ method, repo, number, dir }) => {
  if (method === 'GET' && repo === 'owner/repo' && number === 5 && dir === 'blocked_by') {
    const i1 = fake.findIssue(1, 'owner/repo');
    const i10 = fake.findIssue(10, 'owner/other-repo');
    return {
      status: 200,
      payload: [
        {
          id: i1.id,
          number: 1,
          title: i1.title,
          state: i1.state,
          html_url: 'https://github.com/owner/repo/issues/1',
          repository_url: 'https://api.github.com/repos/owner/repo',
        },
        {
          id: i10.id,
          number: 10,
          title: i10.title,
          state: i10.state,
          html_url: 'https://github.com/owner/other-repo/issues/10',
          repository_url: 'https://api.github.com/repos/owner/other-repo',
        },
      ],
    };
  }
  return null;
});

const port = await freePort();
const stateDir = fs.mkdtempSync('/tmp/opencode/board-v2-packaged-audit-');
const sessionFile = path.join(stateDir, 'sessions.json');
const preloadFile = path.join(stateDir, 'preload.mjs');
fs.writeFileSync(preloadFile, [
  `const targetBase = ${JSON.stringify(fake.url)};`,
  `const origFetch = globalThis.fetch;`,
  `globalThis.fetch = function (input, init) {`,
  `  if (typeof input === 'string' && input.startsWith('https://api.github.com')) {`,
  `    input = targetBase + input.slice('https://api.github.com'.length);`,
  `  } else if (input && typeof input === 'object' && typeof input.url === 'string' && input.url.startsWith('https://api.github.com')) {`,
  `    input = new Request(targetBase + input.url.slice('https://api.github.com'.length), input);`,
  `  }`,
  `  return origFetch.call(this, input, init);`,
  `};`,
].join('\n'));
const serverUrl = `http://127.0.0.1:${port}`;

const serverLogs = [];
const serverProc = spawn(process.execPath, ['--import', preloadFile, 'web/dist/server.mjs'], {
  cwd: releaseDir,
  env: {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    BOARD_GITHUB_TOKEN: fake.token,
    BOARD_GITHUB_LOGIN: fake.login,
    BOARD_REPO: 'owner/repo',
    BOARD_PASSWORD: BOARD_PASSWORD,
    BOARD_SESSION_SECRET: SESSION_SECRET,
    BOARD_SESSION_FILE: sessionFile,
    BOARD_PORT: String(port),
    BOARD_HOST: '127.0.0.1',
    BOARD_BASE_URL: serverUrl,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
serverProc.stdout.on('data', chunk => serverLogs.push(chunk.toString('utf8')));
serverProc.stderr.on('data', chunk => serverLogs.push(chunk.toString('utf8')));

for (let i = 0; i < 60; i++) {
  await pause(150);
  try {
    const res = await fetch(`${serverUrl}/health`);
    if (res.ok) break;
  } catch {}
}

const cdp = new CDP();
let target;
try {
  const healthRes = await fetch(`${serverUrl}/health`);
  const healthJson = await healthRes.json();
  record('packaged /health', healthRes.status === 200 && healthJson.status === 'ok' ? 'PASS' : 'FAIL', {
    status: healthRes.status,
    payload: healthJson,
    releaseDir,
  });

  await cdp.open();
  target = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const send = (method, params) => cdp.send(method, params, sessionId);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Log.enable');

  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  };
  const wait = async (expression, name) => {
    const start = Date.now();
    while (Date.now() - start < 12000) {
      try {
        if (await evaluate(expression)) return;
      } catch {}
      await pause(50);
    }
    throw new Error('Wait failed: ' + name);
  };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? ''`);

  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, ['m' + 'obile']: false });
  await send('Page.navigate', { url: serverUrl });
  await wait('!!document.querySelector("#login-form")', 'login form');
  await evaluate(`document.querySelector('#password').value = ${JSON.stringify(BOARD_PASSWORD)}; document.querySelector('#login-form').requestSubmit()`);
  await wait('document.querySelectorAll(".task-row").length > 0', 'initial board rows');

  const selectRepoInUi = async (targetFull) => {
    await click('#repo-select-btn');
    await wait('!document.querySelector("#repo-popover")?.hidden', 'repo popover open');
    await evaluate(`(() => {
      const target = ${JSON.stringify(targetFull)};
      const options = Array.from(document.querySelectorAll('#repo-options-list .repo-option'));
      const btn = options.find(el => {
        if (target === 'all') return el.querySelector('.repo-option-name')?.textContent === 'All Projects';
        return el.querySelector('.repo-option-full')?.textContent === target;
      });
      if (!btn) throw new Error('Repo option not found: ' + target);
      btn.click();
    })()`);
  };

  // 1. Per-project vs All-projects switching & Empty sections
  await selectRepoInUi('owner/empty-repo');
  await wait('document.querySelector("#repo-label")?.getAttribute("title") === "owner/empty-repo"', 'switch to empty-repo');
  await click('#nav-decisions');
  await pause(150);
  const emptyDecisionsText = await text('#decisions-empty');
  await click('#nav-blocked');
  await pause(150);
  const emptyBlockedText = await text('#blocked-empty');
  await click('#nav-archive');
  await wait('document.querySelector("#archive-loading")?.hidden === true', 'empty archive loaded');
  const emptyBackburnerVisible = !(await evaluate('document.querySelector("#archive-backburner-empty")?.hidden'));
  await click('#archive-tab-closed');
  await pause(100);
  const emptyClosedVisible = !(await evaluate('document.querySelector("#archive-closed-empty")?.hidden'));
  record('empty sections & project switching (owner/empty-repo)', emptyDecisionsText.length > 0 && emptyBlockedText.length > 0 && emptyBackburnerVisible && emptyClosedVisible ? 'PASS' : 'FAIL', {
    decisionsEmpty: emptyDecisionsText,
    blockedEmpty: emptyBlockedText,
    emptyBackburnerVisible,
    emptyClosedVisible,
  });

  // Switch to owner/other-repo while on Archive -> verify activeSectionView stays 'archive' and loads owner/other-repo
  await selectRepoInUi('owner/other-repo');
  await wait('document.querySelector("#repo-label")?.getAttribute("title") === "owner/other-repo"', 'switch to other-repo');
  await pause(200);
  const stayedOnArchive = await evaluate(`window.__taskBoard.state.activeSectionView === 'archive' && !document.querySelector('#archive-view').hidden`);
  await click('#nav-list');
  await wait('document.querySelectorAll(".task-row").length === 2', 'other-repo list count');
  const otherRepoIssueKeys = await evaluate(`Array.from(document.querySelectorAll('.task-row')).map(el => el.getAttribute('data-issue-key'))`);
  record('per-project switching preserves section and filters issues (owner/other-repo)', stayedOnArchive && otherRepoIssueKeys.includes('owner/other-repo#10') && otherRepoIssueKeys.includes('owner/other-repo#11') ? 'PASS' : 'FAIL', {
    stayedOnArchive,
    otherRepoIssueKeys,
  });

  // Switch back to all projects
  await selectRepoInUi('all');
  await wait('document.querySelectorAll(".task-row").length >= 5', 'all projects list count');

  // Multi-repo All Projects Operations aggregation
  await click('#nav-operations');
  await wait('!document.querySelector("#operations-grid")?.hidden', 'operations grid loaded');
  const opsData = await evaluate(`window.__taskBoard.state.operations`);
  const opsHasAllProjects = Boolean(
    opsData &&
    opsData.statusPerProject &&
    opsData.statusPerProject['owner/repo'] &&
    opsData.statusPerProject['owner/other-repo'] &&
    opsData.blocked === 4
  );
  record('multi-repo All Projects Operations aggregation', opsHasAllProjects ? 'PASS' : 'FAIL', {
    blocked: opsData?.blocked,
    statusPerProjectKeys: opsData?.statusPerProject ? Object.keys(opsData.statusPerProject) : [],
    statusPerProject: opsData?.statusPerProject,
  });

  // 2. Real-shaped cross-repo dependency links in Blocked view and issue drawer
  await click('#nav-blocked');
  await wait('document.querySelectorAll("#blocked-list .section-card").length >= 2', 'blocked cards');
  const blockedText = await text('#blocked-list');
  const hasCrossRepoBlocker = blockedText.includes('#10 Cross-repo upstream platform API');
  // Open issue #5 in drawer and click cross-repo blocker #10
  await evaluate(`window.__taskBoard.openIssue(5, 'owner/repo')`);
  await wait('!document.querySelector("#detail-view").hidden && document.querySelector("#detail-title")?.textContent.includes("Cross-repo dependent task")', 'open #5 drawer');
  const depSectionText = await text('#blocked-by-list');
  const hasOtherRepoBadge = (depSectionText.includes('Other') || depSectionText.includes('other-repo')) && depSectionText.includes('#10');
  await evaluate(`(() => {
    const links = Array.from(document.querySelectorAll('#blocked-by-list .dependency-chip-link'));
    const link10 = links.find(l => l.textContent.includes('#10'));
    if (link10) link10.click();
  })()`);
  await wait('document.querySelector("#detail-title")?.textContent.includes("Cross-repo upstream platform API")', 'navigated to cross-repo #10 in drawer');
  const openedCrossRepoIdentity = await evaluate(`window.__taskBoard.state.detail?.repository?.full + '#' + window.__taskBoard.state.detail?.number`);
  await click('#back-btn');
  record('real-shaped cross-repo dependency badge and navigation', hasCrossRepoBlocker && hasOtherRepoBadge && openedCrossRepoIdentity === 'owner/other-repo#10' ? 'PASS' : 'FAIL', {
    hasCrossRepoBlocker,
    hasOtherRepoBadge,
    openedCrossRepoIdentity,
  });

  // 3. Refresh/poll over unsaved note draft (draft.failed === false) & full reload over unsaved draft
  await click('#nav-canvas');
  await wait('!!document.querySelector(".canvas-note-btn.btn-edit")', 'canvas note edit button');
  await click('.canvas-note-btn.btn-edit');
  await evaluate(`(() => {
    const ta = document.querySelector('.canvas-note-textarea');
    ta.value = 'UNSAVED_DURING_POLL';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  const patchesBeforePoll = fake.patchCalls.length;
  await click('#refresh-btn');
  await pause(450);
  const draftAfterPoll = await evaluate(`document.querySelector('.canvas-note-textarea')?.value`);
  const patchesAfterPoll = fake.patchCalls.length - patchesBeforePoll;
  record('refresh/poll over unsaved note draft preserves draft without premature save', draftAfterPoll === 'UNSAVED_DURING_POLL' && patchesAfterPoll === 0 ? 'PASS' : 'FAIL', {
    draftAfterPoll,
    PATCH: patchesAfterPoll,
  });

  // Full page reload over unsaved in-memory note draft
  await send('Page.reload');
  await wait('!!document.querySelector(".canvas-sticky-note")', 'canvas reload');
  const noteTextAfterReload = await text('.canvas-sticky-note .canvas-note-body');
  const storageKeys = await evaluate(`Object.keys(localStorage)`);
  const storageHasDraftLeak = await evaluate(` JSON.stringify(localStorage).includes('UNSAVED_DURING_POLL') `);
  record('full reload over unsaved draft clears bounded-memory draft without localStorage leak', noteTextAfterReload.includes('INTERNAL_NOTE body') && !storageHasDraftLeak ? 'PASS' : 'FAIL', {
    noteTextAfterReload,
    storageKeys,
    storageHasDraftLeak,
  });

  // 4. 200% zoom + pointer/touch note drag and resize
  await evaluate(`window.__taskBoard.zoomToPoint(640, 450, 2)`);
  await pause(150);
  const zoomReadout = await text('#canvas-zoom-readout');
  const dragPatchesBefore = fake.patchCalls.length;
  await evaluate(`(() => {
    const header = document.querySelector('.canvas-note-header');
    header.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 200, clientY: 200, pointerType: 'touch' }));
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 280, clientY: 240, pointerType: 'touch' }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 280, clientY: 240, pointerType: 'touch' }));
  })()`);
  await pause(300);
  const afterDragPos = await evaluate(`(() => {
    const el = document.querySelector('.canvas-sticky-note');
    return { left: el.style.left, top: el.style.top };
  })()`);
  const resizePatchesBefore = fake.patchCalls.length;
  await evaluate(`(() => {
    const handle = document.querySelector('.canvas-note-resize');
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 300, clientY: 300, pointerType: 'touch' }));
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 360, clientY: 340, pointerType: 'touch' }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 360, clientY: 340, pointerType: 'touch' }));
  })()`);
  await pause(300);
  const afterResizeDim = await evaluate(`(() => {
    const el = document.querySelector('.canvas-sticky-note');
    return { width: el.style.width, minHeight: el.style.minHeight };
  })()`);
  await click('#canvas-zoom-readout');
  record('200% zoom and touch/pointer note drag and resize', zoomReadout === '200%' && (fake.patchCalls.length - dragPatchesBefore) >= 2 && afterDragPos.left === '200px' && afterDragPos.top === '300px' ? 'PASS' : 'FAIL', {
    zoomReadout,
    afterDragPos,
    afterResizeDim,
    dragPatches: resizePatchesBefore - dragPatchesBefore,
    resizePatches: fake.patchCalls.length - resizePatchesBefore,
  });

  // 5. Partial Arrange failure and Undo
  fake.setPatchHook((issue) => {
    if (issue.number === 4) {
      return { status: 500, payload: { message: 'Injected arrange failure on #4' } };
    }
    return null;
  });
  await click('#canvas-arrange');
  await wait('!document.querySelector("#canvas-arrange-dialog").hidden', 'arrange dialog');
  await evaluate(`document.querySelector('#arrange-scope-all').checked = true`);
  await click('#arrange-confirm-btn');
  await wait('!document.querySelector("#arrange-summary").hidden', 'arrange summary');
  const arrangeSummary = await text('#arrange-summary');
  const undoVisibleAfterArrange = !(await evaluate('document.querySelector("#canvas-arrange-undo").hidden'));
  fake.setPatchHook(null);
  await pause(1300); // wait for dialog auto-close
  await click('#canvas-arrange-undo');
  await wait('document.querySelector("#canvas-arrange-undo").hidden === true', 'undo arrange completed');
  const restoredCard1 = await evaluate(`(() => {
    const issue1 = window.__taskBoard.state.board.issues.find(i => i.number === 1 && i.repository.full === 'owner/repo');
    return { x: issue1?.canvas?.x, y: issue1?.canvas?.y };
  })()`);
  record('partial Arrange failure summary and Undo restoration', arrangeSummary.includes('1 failed') && undoVisibleAfterArrange && restoredCard1.x === 140 && restoredCard1.y === 120 ? 'PASS' : 'FAIL', {
    arrangeSummary,
    undoVisibleAfterArrange,
    restoredCard1,
  });

  // 6. 403 error handling on Operations and Archive
  await evaluate(`window.__taskBoard.state.selected = 'owner/repo'`);
  fake.setInjectedResponse(403, { message: 'Resource not accessible by integration' });
  await click('#nav-operations');
  await pause(250);
  const ops403Text = await text('#operations-loading');
  await click('#nav-archive');
  await pause(250);
  const archive403Text = await text('#archive-loading');
  fake.setInjectedResponse(null);
  await evaluate(`window.__taskBoard.state.selected = 'all'`);
  record('403 error handling on Operations and Archive', ops403Text.includes('Could not load') && archive403Text.includes('Could not load') ? 'PASS' : 'FAIL', {
    ops403Text,
    archive403Text,
  });

  // 7. Rapid human-task toggles, Global Client Presentation Mode (including unprioritized todo #2 visible vs draft #3 hidden), and Note 409 + Overwrite
  await click('#refresh-btn');
  await pause(300);
  await click('#nav-blocked');
  await wait('document.querySelectorAll(".human-task-checkbox").length === 2', 'human task checkboxes');
  const togglePatchesBefore = fake.patchCalls.length;
  await evaluate(`(() => {
    const boxes = document.querySelectorAll('.human-task-checkbox');
    boxes[0].click();
    boxes[1].click();
  })()`);
  await pause(500);
  const togglePatches = fake.patchCalls.length - togglePatchesBefore;
  const issue1BodyAfterToggles = fake.findIssue(1, 'owner/repo').body;
  record('packaged rapid human-task toggles', togglePatches === 2 && issue1BodyAfterToggles.includes('- [x] INTERNAL_TASK approve release') && issue1BodyAfterToggles.includes('- [x] INTERNAL_TASK confirm records') ? 'PASS' : 'FAIL', {
    PATCH: togglePatches,
  });

  await click('#nav-client');
  await click('#client-toggle-btn');
  await click('#nav-list');
  await pause(150);
  const listVisibleKeys = await evaluate(`Array.from(document.querySelectorAll('.task-row')).map(el => el.getAttribute('data-issue-key'))`);
  const listBodyText = await evaluate(`document.body.innerText`);
  const leakedTokens = [...new Set(listBodyText.match(/INTERNAL_[A-Z_]+/g) || [])];
  await click('#client-banner-exit-btn');
  record('packaged presentation mode keeps unprioritized todo #2 and hides draft #3 and internals', listVisibleKeys.includes('owner/repo#2') && !listVisibleKeys.includes('owner/repo#3') && leakedTokens.length === 0 ? 'PASS' : 'FAIL', {
    listVisibleKeys,
    leakedTokens,
  });

  const exceptions = cdp.events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => e.params.exceptionDetails.text);
  const consoleErrors = cdp.events.filter(e => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error').map(e => e.params.args.map(a => a.value || a.description));
  const cspViolations = cdp.events.filter(e => e.method === 'Log.entryAdded' && /content security|violat/i.test(e.params.entry.text)).map(e => e.params.entry.text);
  record('packaged browser diagnostics', exceptions.length === 0 && consoleErrors.length === 0 && cspViolations.length === 0 ? 'PASS' : 'FAIL', {
    exceptions,
    consoleErrors,
    cspViolations,
  });
} finally {
  const outA5 = process.env.PACKAGED_AUDIT_OUTPUT || '/tmp/opencode/packaged-browser.json';
  fs.mkdirSync(path.dirname(outA5), { recursive: true });
  fs.writeFileSync(outA5, JSON.stringify(report, null, 2) + '\n');
  if (target) await cdp.send('Target.closeTarget', { targetId: target.targetId }).catch(() => {});
  cdp.ws?.close();
  serverProc.kill('SIGTERM');
  await fake.close();
  fs.rmSync(stateDir, { recursive: true, force: true });
}

if (report.some(r => r.verdict !== 'PASS')) {
  process.exit(1);
}
