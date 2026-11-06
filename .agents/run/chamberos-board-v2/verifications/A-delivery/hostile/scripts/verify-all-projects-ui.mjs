// Verification script for Criterion 1: All Projects aggregation through UI
// Reproduce All Projects aggregation for Operations AND Archive with BOARD_REPO configured and two nonempty repositories.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const { makeIssue, startFakeGitHub } = await import(pathToFileURL(path.resolve(rootDir, 'web/tests/fake-github.mjs')).href);
const { startBoard, BOARD_PASSWORD } = await import(pathToFileURL(path.resolve(rootDir, 'web/tests/helpers.mjs')).href);

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDP {
  pending = new Map();
  next = 0;
  events = [];

  async open() {
    this.ws = new WebSocket('ws://127.0.0.1:9222/devtools/browser');
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });
    this.ws.addEventListener('message', (event) => {
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

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

async function run() {
  console.log('--- Starting Criterion 1 Reproduction Test ---');

  // Setup synthetic GitHub with BOARD_REPO configured and two non-empty repositories
  const fake = await startFakeGitHub({
    repositories: [
      {
        repo: 'acme/core-engine',
        id: 1,
        issues: [
          makeIssue({ number: 1, repo: 'acme/core-engine', title: 'Core Auth Spike', body: '## Human Tasks\n- [ ] Sign certs', labels: ['status:needs-human', 'priority:high'] }),
          makeIssue({ number: 2, repo: 'acme/core-engine', title: 'Core Pipeline', body: 'Blocked by #1', labels: ['status:in-progress'] }),
          makeIssue({ number: 3, repo: 'acme/core-engine', title: 'Core Backlog Note', body: 'Old item', labels: ['status:backlog', 'backburner'] }),
          makeIssue({ number: 4, repo: 'acme/core-engine', title: 'Core Done Item', state: 'closed', labels: ['status:done'] }),
        ],
      },
      {
        repo: 'acme/edge-service',
        id: 2,
        issues: [
          makeIssue({ number: 10, repo: 'acme/edge-service', title: 'Edge Routing Ingest', body: 'Edge ingest work', labels: ['status:in-progress'] }),
          makeIssue({ number: 11, repo: 'acme/edge-service', title: 'Edge Documentation', body: 'Blocked by #10', labels: ['status:todo'] }),
          makeIssue({ number: 12, repo: 'acme/edge-service', title: 'Edge Deprecated Gateway', body: 'Backburner', labels: ['status:todo', 'backburner'] }),
          makeIssue({ number: 13, repo: 'acme/edge-service', title: 'Edge Retired Cluster', state: 'closed', labels: ['status:done'] }),
        ],
      },
    ],
  });

  // Dependencies:
  // acme/core-engine#2 blocked by acme/core-engine#1
  fake.addDependency(2, 1, 'acme/core-engine', 'acme/core-engine');
  // acme/edge-service#11 blocked by acme/edge-service#10
  fake.addDependency(11, 10, 'acme/edge-service', 'acme/edge-service');

  // Start board server with explicit BOARD_REPO = acme/core-engine
  const board = await startBoard(fake, {
    env: {
      BOARD_REPO: 'acme/core-engine',
    },
  });

  console.log(`Board server running at ${board.url} with BOARD_REPO=acme/core-engine`);

  const cdp = new CDP();
  await cdp.open();

  let target;
  try {
    target = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    const send = (method, params) => cdp.send(method, params, sessionId);

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');

    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      }
      return result.result.value;
    };

    const wait = async (expression, name) => {
      const start = Date.now();
      while (Date.now() - start < 15000) {
        try {
          if (await evaluate(expression)) return;
        } catch {}
        await pause(100);
      }
      throw new Error('Wait failed: ' + name);
    };

    const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);

    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: board.url });
    await wait('!!document.querySelector("#login-form")', 'login form');

    // Login
    await evaluate(`
      document.querySelector('#password').value = ${JSON.stringify(BOARD_PASSWORD)};
      document.querySelector('#login-form').requestSubmit();
    `);
    await wait('document.querySelectorAll(".task-row").length > 0', 'initial board rows');
    await pause(500);

    // Initial state: verify All Projects is selected
    const initialSelected = await evaluate(`window.__taskBoard.state.selected`);
    console.log('Initial selected project:', initialSelected);
    if (initialSelected !== 'all') {
      throw new Error(`Expected initial selection 'all', got ${initialSelected}`);
    }

    // --- TEST OPERATIONS VIEW ---
    console.log('\n--- 1. Testing Operations View ---');
    await click('#nav-operations');
    await wait('!document.querySelector("#operations-grid")?.hidden', 'operations view');
    await pause(400);

    const opsAllData = await evaluate(`window.__taskBoard.state.operations`);
    console.log('Operations data (All Projects):', JSON.stringify({
      scope: opsAllData?.scope,
      blocked: opsAllData?.blocked,
      needsHuman: opsAllData?.needsHuman,
      openClosed: opsAllData?.openClosed,
      statusPerProjectKeys: opsAllData?.statusPerProject ? Object.keys(opsAllData.statusPerProject) : [],
    }, null, 2));

    const opsRows = await evaluate(`
      Array.from(document.querySelectorAll('#operations-project-rows tr')).map(tr => ({
        repo: tr.querySelector('.repo-name')?.textContent,
        values: Array.from(tr.querySelectorAll('.num')).map(td => Number(td.textContent)),
      }))
    `);
    console.log('Operations UI Table rows:', JSON.stringify(opsRows, null, 2));

    // Assertions for Operations (All Projects)
    if (!opsAllData?.statusPerProject?.['acme/core-engine']) throw new Error('Missing acme/core-engine in statusPerProject');
    if (!opsAllData?.statusPerProject?.['acme/edge-service']) throw new Error('Missing acme/edge-service in statusPerProject');
    // Blocked count:
    // core#1: needs-human (blocked)
    // core#2: blocked by core#1 (blocked)
    // edge#11: blocked by edge#10 (blocked)
    // Total blocked: 3
    if (opsAllData.blocked !== 3) throw new Error(`Expected blocked=3 in All Projects Operations, got ${opsAllData.blocked}`);

    // Verify UI rows render both repos
    const renderedRepos = opsRows.map(r => r.repo);
    if (!renderedRepos.includes('acme/core-engine') || !renderedRepos.includes('acme/edge-service')) {
      throw new Error(`UI table did not render both repos: ${JSON.stringify(renderedRepos)}`);
    }

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

    // --- TEST PROJECT SWITCHING WHILE ON OPERATIONS ---
    console.log('\n--- 2. Switching project to acme/core-engine while on Operations ---');
    await selectRepoInUi('acme/core-engine');
    await pause(600);

    const onOpsAfterSwitch1 = await evaluate(`
      window.__taskBoard.state.activeSectionView === 'operations' && !document.querySelector('#operations-view').hidden
    `);
    console.log('Stayed on Operations after switching to core-engine:', onOpsAfterSwitch1);
    if (!onOpsAfterSwitch1) throw new Error('Section was not retained when switching to core-engine');

    const opsCoreData = await evaluate(`window.__taskBoard.state.operations`);
    console.log('Operations data (core-engine):', JSON.stringify({
      scope: opsCoreData?.scope,
      repository: opsCoreData?.repository,
      blocked: opsCoreData?.blocked,
      statusPerProjectKeys: opsCoreData?.statusPerProject ? Object.keys(opsCoreData.statusPerProject) : [],
    }, null, 2));

    if (opsCoreData.repository !== 'acme/core-engine') throw new Error('Operations repo mismatch');
    if (opsCoreData.blocked !== 2) throw new Error(`Expected blocked=2 for core-engine, got ${opsCoreData.blocked}`);

    // --- SWITCH BACK TO ALL PROJECTS WHILE ON OPERATIONS ---
    console.log('\n--- 3. Switching back to All Projects while on Operations ---');
    await selectRepoInUi('all');
    await pause(600);

    const onOpsAfterSwitch2 = await evaluate(`
      window.__taskBoard.state.activeSectionView === 'operations' && !document.querySelector('#operations-view').hidden
    `);
    console.log('Stayed on Operations after switching back to All Projects:', onOpsAfterSwitch2);
    if (!onOpsAfterSwitch2) throw new Error('Section was not retained when switching back to All Projects');

    const opsAllData2 = await evaluate(`window.__taskBoard.state.operations`);
    console.log('Operations data (All Projects restored):', JSON.stringify({
      scope: opsAllData2?.scope,
      blocked: opsAllData2?.blocked,
      statusPerProjectKeys: opsAllData2?.statusPerProject ? Object.keys(opsAllData2.statusPerProject) : [],
    }, null, 2));
    if (opsAllData2.blocked !== 3) throw new Error(`Expected restored blocked=3, got ${opsAllData2.blocked}`);
    if (Object.keys(opsAllData2.statusPerProject).length < 2) throw new Error('Did not restore all projects in statusPerProject');

    // --- TEST ARCHIVE VIEW ---
    console.log('\n--- 4. Testing Archive View ---');
    await click('#nav-archive');
    await wait('!document.querySelector("#archive-view")?.hidden', 'archive view');
    await pause(500);

    const archiveAllData = await evaluate(`window.__taskBoard.state.archive`);
    console.log('Archive data (All Projects):', JSON.stringify({
      totalBackburner: archiveAllData?.backburner?.length,
      totalClosed: archiveAllData?.closed?.length,
      backburnerKeys: archiveAllData?.backburner?.map(i => i.key || (i.repository?.full + '#' + i.number)),
      closedKeys: archiveAllData?.closed?.map(i => i.key || (i.repository?.full + '#' + i.number)),
    }, null, 2));

    // Both repositories must have items in Archive
    const allBackburnerRepos = archiveAllData.backburner.map(i => i.repository?.full || i.repository);
    const allClosedRepos = archiveAllData.closed.map(i => i.repository?.full || i.repository);
    if (!allBackburnerRepos.includes('acme/core-engine') || !allBackburnerRepos.includes('acme/edge-service')) {
      throw new Error(`Archive backburner did not aggregate both repos: ${JSON.stringify(allBackburnerRepos)}`);
    }
    if (!allClosedRepos.includes('acme/core-engine') || !allClosedRepos.includes('acme/edge-service')) {
      throw new Error(`Archive closed did not aggregate both repos: ${JSON.stringify(allClosedRepos)}`);
    }

    // --- TEST PROJECT SWITCHING WHILE ON ARCHIVE ---
    console.log('\n--- 5. Switching project to acme/edge-service while on Archive ---');
    await selectRepoInUi('acme/edge-service');
    await pause(600);

    const onArchiveAfterSwitch1 = await evaluate(`
      window.__taskBoard.state.activeSectionView === 'archive' && !document.querySelector('#archive-view').hidden
    `);
    console.log('Stayed on Archive after switching to edge-service:', onArchiveAfterSwitch1);
    if (!onArchiveAfterSwitch1) throw new Error('Section was not retained when switching to edge-service');

    const archiveEdgeData = await evaluate(`window.__taskBoard.state.archive`);
    console.log('Archive data (edge-service):', JSON.stringify({
      totalBackburner: archiveEdgeData?.backburner?.length,
      totalClosed: archiveEdgeData?.closed?.length,
      backburnerKeys: archiveEdgeData?.backburner?.map(i => i.key || (i.repository?.full + '#' + i.number)),
      closedKeys: archiveEdgeData?.closed?.map(i => i.key || (i.repository?.full + '#' + i.number)),
    }, null, 2));

    const edgeBackburnerRepos = archiveEdgeData.backburner.map(i => i.repository?.full || i.repository);
    if (edgeBackburnerRepos.some(r => r !== 'acme/edge-service')) {
      throw new Error('Archive contains items outside edge-service when filtered');
    }

    // --- SWITCH BACK TO ALL PROJECTS WHILE ON ARCHIVE ---
    console.log('\n--- 6. Switching back to All Projects while on Archive ---');
    await selectRepoInUi('all');
    await pause(600);

    const onArchiveAfterSwitch2 = await evaluate(`
      window.__taskBoard.state.activeSectionView === 'archive' && !document.querySelector('#archive-view').hidden
    `);
    console.log('Stayed on Archive after switching back to All Projects:', onArchiveAfterSwitch2);
    if (!onArchiveAfterSwitch2) throw new Error('Section was not retained when switching back to All Projects');

    const archiveAllData2 = await evaluate(`window.__taskBoard.state.archive`);
    console.log('Archive data (All Projects restored):', JSON.stringify({
      totalBackburner: archiveAllData2?.backburner?.length,
      totalClosed: archiveAllData2?.closed?.length,
      backburnerRepos: archiveAllData2?.backburner?.map(i => i.repository?.full || i.repository),
    }, null, 2));

    if (archiveAllData2.backburner.length !== 2 || archiveAllData2.closed.length !== 2) {
      throw new Error('Archive All Projects did not restore both repositories');
    }

    console.log('\n Criterion 1 FULLY VERIFIED AND REPRODUCED: All Projects aggregates Operations and Archive with BOARD_REPO configured, retains section across project switching, and aligns blocked metrics.');

  } finally {
    if (target) {
      try { await cdp.send('Target.closeTarget', { targetId: target.targetId }); } catch {}
    }
    cdp.close();
    await board.app.close();
    await fake.close();
  }
}

run().catch((err) => {
  console.error('Criterion 1 test failed:', err);
  process.exit(1);
});
