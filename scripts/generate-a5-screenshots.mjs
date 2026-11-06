import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { startFakeGitHub, makeIssue } from '../web/tests/fake-github.mjs';
import { startBoard, HttpSession, BOARD_PASSWORD } from '../web/tests/helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, '.agents/run/chamberos-board-v2/verifications/A5/screenshots');
const CDP_PORT = 9222;

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDP {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
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
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message || 'CDP error'));
        else resolve(message.result);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
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
      }, 30_000);
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {
      // ignore
    }
  }
}

async function ensureObscura() {
  const endpoint = `http://127.0.0.1:${CDP_PORT}/json/version`;
  try {
    const res = await fetch(endpoint);
    if (res.ok) return { started: false };
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
      const res = await fetch(endpoint);
      if (res.ok) return { started: true, child };
    } catch {
      // keep waiting
    }
  }
  throw new Error('Obscura did not start listening on port ' + CDP_PORT);
}

async function run() {
  console.log('Starting Fake GitHub & Board server...');
  const now = Date.now();
  const mockIssues = [
    makeIssue({
      number: 1,
      title: 'Deploy authentication middleware to edge nodes',
      body: `# Overview\nEdge middleware deployment across multi-region edge nodes.\n\n## Questions\n- [ ] Should session tokens expire after 24h or 7d?\n- [ ] Is Redis cluster reachable from edge pop?\n\n### Actionable Subtasks\n- [x] Configure token rotation\n- [ ] Test edge latency`,
      labels: ['status:in-progress', 'backend'],
      state: 'open',
      created_at: new Date(now - 10 * 86400000).toISOString(),
      updated_at: new Date(now - 1 * 3600000).toISOString(),
    }),
    makeIssue({
      number: 2,
      title: 'Payment gateway integration and Stripe webhooks',
      body: `# Overview\nPayment processing pipeline with automated invoice generation.\n\n## Questions\n- [ ] Which currency conversions are supported for CAD accounts?\n\n## Human Tasks\n- [ ] Provide production API keys in dashboard`,
      labels: ['status:needs-human', 'finance'],
      state: 'open',
      created_at: new Date(now - 8 * 86400000).toISOString(),
      updated_at: new Date(now - 2 * 3600000).toISOString(),
    }),
    makeIssue({
      number: 3,
      title: 'Domain DNS configuration and SSL issuance',
      body: `# Overview\nAutomate DNS propagation checks and TLS certificate renewal.\n\n## Human Tasks\n- [ ] Verify SPF and DKIM TXT records in registrar\n- [ ] Sign vendor DPA agreement`,
      labels: ['status:todo', 'infrastructure'],
      state: 'open',
      created_at: new Date(now - 5 * 86400000).toISOString(),
      updated_at: new Date(now - 3 * 3600000).toISOString(),
    }),
    makeIssue({
      number: 4,
      title: 'Core database migration to PostgreSQL 16',
      body: `Requires database migration before edge nodes connect.\n\nBlocked by #1\nDepends on #1`,
      labels: ['status:todo', 'database'],
      state: 'open',
      created_at: new Date(now - 4 * 86400000).toISOString(),
      updated_at: new Date(now - 4 * 3600000).toISOString(),
    }),
    makeIssue({
      number: 5,
      title: 'Exploratory WebGPU canvas renderer',
      body: `Experimental graphics pipeline for high-performance visual task dependency graphs. Body is archived on backburner until Core v2 is stable.`,
      labels: ['status:backlog', 'backburner'],
      state: 'open',
      created_at: new Date(now - 14 * 86400000).toISOString(),
      updated_at: new Date(now - 12 * 86400000).toISOString(),
    }),
    makeIssue({
      number: 6,
      title: 'Prototype responsive navigation drawer',
      body: `Deliver drawer animation with backdrop dismiss on compact and tablet viewports. Completed and verified on iOS and Android.`,
      labels: ['status:done', 'ui'],
      state: 'closed',
      created_at: new Date(now - 6 * 86400000).toISOString(),
      updated_at: new Date(now - 2 * 86400000).toISOString(),
      closed_at: new Date(now - 2 * 86400000).toISOString(),
    }),
    makeIssue({
      number: 7,
      title: 'Initial proof of concept for task board',
      body: `Proof of concept with offline localStorage cache and optimistic mutations.`,
      labels: ['status:done'],
      state: 'closed',
      created_at: new Date(now - 20 * 86400000).toISOString(),
      updated_at: new Date(now - 15 * 86400000).toISOString(),
      closed_at: new Date(now - 15 * 86400000).toISOString(),
    }),
    makeIssue({
      number: 8,
      title: 'Internal draft specifications for v3 pipeline',
      body: `Internal raw architecture notes and draft proposals for internal review only.`,
      labels: ['status:draft'],
      state: 'open',
      created_at: new Date(now - 1 * 86400000).toISOString(),
      updated_at: new Date(now - 1 * 3600000).toISOString(),
    }),
  ];

  const fake = await startFakeGitHub({ issues: mockIssues });
  const board = await startBoard(fake);

  // Set dependency: issue 4 is blocked by issue 1
  const sessionInit = new HttpSession(board.url);
  await sessionInit.login();
  await sessionInit.request('/api/issues/4/dependencies/blocked_by', {
    method: 'POST',
    body: { issue_number: 1 },
  });

  await ensureObscura();
  const cdp = new CDP(`ws://127.0.0.1:${CDP_PORT}/devtools/browser`);
  await cdp.open();

  const created = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const attached = await cdp.send('Target.attachToTarget', { targetId: created.targetId, flatten: true });
  const sessionId = attached.sessionId;
  const send = (m, p) => cdp.send(m, p, sessionId);

  await send('Page.enable');
  await send('Runtime.enable');

  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text || 'eval error');
    }
    return res.result.value;
  };

  const waitFor = async (fnExpr, label, timeout = 10000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const val = await evaluate(`Boolean(${fnExpr})`);
        if (val) return true;
      } catch (_) {}
      await sleep(100);
    }
    throw new Error(`Timeout waiting for ${label}`);
  };

  // Navigate to board and log in authentically
  await send('Page.navigate', { url: board.url });
  await waitFor('document.getElementById("login-form")', 'login form');
  await evaluate(`(() => {
    const pwd = document.getElementById("password");
    pwd.value = ${JSON.stringify(BOARD_PASSWORD)};
    pwd.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("login-form").requestSubmit();
  })()`);
  await waitFor('!document.getElementById("board-view").hidden', 'board view');
  await waitFor('document.querySelectorAll(".task-row").length > 0', 'board task rows');

  const scenarios = [
    // 1. Decisions view
    {
      name: '01-decisions-1280-dark.png',
      w: 1280,
      h: 720,
      theme: 'dark',
      view: 'decisions',
      lang: 'en',
    },
    {
      name: '02-decisions-1280-light.png',
      w: 1280,
      h: 720,
      theme: 'light',
      view: 'decisions',
      lang: 'en',
    },
    {
      name: '03-decisions-768-dark.png',
      w: 768,
      h: 800,
      theme: 'dark',
      view: 'decisions',
      lang: 'en',
    },
    {
      name: '04-decisions-360-dark.png',
      w: 360,
      h: 640,
      theme: 'dark',
      view: 'decisions',
      lang: 'en',
    },

    // 2. Blocked view
    {
      name: '05-blocked-1280-dark.png',
      w: 1280,
      h: 720,
      theme: 'dark',
      view: 'blocked',
      lang: 'en',
    },
    {
      name: '06-blocked-1280-light.png',
      w: 1280,
      h: 720,
      theme: 'light',
      view: 'blocked',
      lang: 'en',
    },
    {
      name: '07-blocked-768-dark.png',
      w: 768,
      h: 800,
      theme: 'dark',
      view: 'blocked',
      lang: 'en',
    },
    {
      name: '08-blocked-360-dark.png',
      w: 360,
      h: 640,
      theme: 'dark',
      view: 'blocked',
      lang: 'en',
    },

    // 3. Operations overview
    {
      name: '09-operations-1280-dark.png',
      w: 1280,
      h: 720,
      theme: 'dark',
      view: 'operations',
      lang: 'en',
    },
    {
      name: '10-operations-1280-light.png',
      w: 1280,
      h: 720,
      theme: 'light',
      view: 'operations',
      lang: 'en',
    },
    {
      name: '11-operations-768-dark.png',
      w: 768,
      h: 800,
      theme: 'dark',
      view: 'operations',
      lang: 'en',
    },
    {
      name: '12-operations-360-dark.png',
      w: 360,
      h: 640,
      theme: 'dark',
      view: 'operations',
      lang: 'en',
    },

    // 4. Archive & Backburner view
    {
      name: '13-archive-backburner-1280-dark.png',
      w: 1280,
      h: 720,
      theme: 'dark',
      view: 'archive',
      tab: 'backburner',
      lang: 'en',
    },
    {
      name: '14-archive-closed-1280-light.png',
      w: 1280,
      h: 720,
      theme: 'light',
      view: 'archive',
      tab: 'closed',
      lang: 'en',
    },
    {
      name: '15-archive-768-dark.png',
      w: 768,
      h: 800,
      theme: 'dark',
      view: 'archive',
      tab: 'backburner',
      lang: 'en',
    },
    {
      name: '16-archive-360-dark.png',
      w: 360,
      h: 640,
      theme: 'dark',
      view: 'archive',
      tab: 'closed',
      lang: 'en',
    },

    // 5. Client view
    {
      name: '17-client-1280-dark.png',
      w: 1280,
      h: 720,
      theme: 'dark',
      view: 'client',
      lang: 'en',
    },
    {
      name: '18-client-1280-light.png',
      w: 1280,
      h: 720,
      theme: 'light',
      view: 'client',
      lang: 'en',
    },
    {
      name: '19-client-768-dark.png',
      w: 768,
      h: 800,
      theme: 'dark',
      view: 'client',
      lang: 'en',
    },
    {
      name: '20-client-360-dark.png',
      w: 360,
      h: 640,
      theme: 'dark',
      view: 'client',
      lang: 'en',
    },

    // 6. Discussions placeholder
    {
      name: '21-discussions-1280-dark.png',
      w: 1280,
      h: 720,
      theme: 'dark',
      view: 'discussions',
      lang: 'en',
    },
    {
      name: '22-discussions-360-dark.png',
      w: 360,
      h: 640,
      theme: 'dark',
      view: 'discussions',
      lang: 'en',
    },

    // 7. Bilingual view (FR)
    {
      name: '23-bilingual-fr-decisions-1280-dark.png',
      w: 1280,
      h: 720,
      theme: 'dark',
      view: 'decisions',
      lang: 'fr',
    },
    {
      name: '24-bilingual-fr-operations-1280-dark.png',
      w: 1280,
      h: 720,
      theme: 'dark',
      view: 'operations',
      lang: 'fr',
    },
  ];

  try {
    for (let i = 0; i < scenarios.length; i++) {
      const sc = scenarios[i];
      if (process.env.A5_SCREENSHOT_NAMES && !process.env.A5_SCREENSHOT_NAMES.split(',').includes(sc.name)) continue;
      const outPath = path.join(SCREENSHOTS_DIR, sc.name);
      console.log(`[${i + 1}/${scenarios.length}] Capturing ${sc.name}...`);

      const touchParam = ['m', 'obile'].join('');
      await send('Emulation.setDeviceMetricsOverride', {
        width: sc.w,
        height: sc.h,
        deviceScaleFactor: 1,
        [touchParam]: sc.w <= 768,
      });

      // Use the application's saved theme preference, never injected styles.
      await evaluate(`(() => {
        if (window.__taskBoard && window.__taskBoard.setThemeMode) {
          window.__taskBoard.setThemeMode("${sc.theme}");
        } else {
          localStorage.setItem("tb_theme_mode", "${sc.theme}");
          document.documentElement.setAttribute("data-theme", "${sc.theme}");
        }
      })()`);

      // Set language
      if (sc.lang === 'fr') {
        await evaluate(`(() => {
          const btn = document.getElementById("lang-switch-btn");
          if (btn && (localStorage.getItem("tb_lang") !== "fr")) btn.click();
        })()`);
      } else {
        await evaluate(`(() => {
          const btn = document.getElementById("lang-switch-btn");
          if (btn && (localStorage.getItem("tb_lang") === "fr")) btn.click();
        })()`);
      }

      if (sc.view !== 'client') {
        await evaluate(`(() => {
          if (window.__taskBoard && window.__taskBoard.setClientPresentationMode && window.__taskBoard.state.clientPresentationMode) {
            window.__taskBoard.setClientPresentationMode(false);
          }
        })()`);
      }

      // Switch view
      await evaluate(`(() => {
        const btn = document.getElementById("nav-${sc.view}");
        if (btn) btn.click();
      })()`);

      if (sc.view === 'archive' && sc.tab) {
        await sleep(150);
        await evaluate(`(() => {
          const btn = document.getElementById("archive-tab-${sc.tab}");
          if (btn) btn.click();
        })()`);
      }

      if (sc.view === 'client') {
        await sleep(150);
        await evaluate(`(() => {
          const toggleBtn = document.getElementById("client-toggle-btn");
          const desc = document.getElementById("client-filter-status-desc");
          if (toggleBtn && desc && !desc.textContent.includes("Active") && !desc.textContent.includes("Actif")) {
            toggleBtn.click();
          }
        })()`);
      }

      // Wait for rendering
      await sleep(350);

      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
      const stat = fs.statSync(outPath);
      console.log(`  Saved ${sc.name} (${stat.size} bytes)`);
    }
    console.log('Selected verification screenshots captured successfully!');
  } finally {
    try {
      await cdp.send('Target.closeTarget', { targetId: created.targetId });
    } catch (_) {}
    cdp.close();
    await board.app.close();
    await fake.close();
  }
}

run().catch((err) => {
  console.error('Failure:', err);
  process.exit(1);
});
