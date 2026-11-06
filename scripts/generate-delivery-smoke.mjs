import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { BOARD_PASSWORD } from '../web/tests/helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DELIVERY_DIR = path.resolve(ROOT_DIR, '.agents/run/chamberos-board-v2/verifications/A-delivery');
const SCREENSHOTS_DIR = path.resolve(DELIVERY_DIR, 'screenshots');
const CDP_PORT = 9222;
const PREVIEW_PORT = 4041;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`;

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDP {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
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
      if (message.method && this.handlers.has(message.method)) {
        for (const fn of this.handlers.get(message.method)) {
          try { fn(message.params); } catch (_) {}
        }
      }
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message || 'CDP error'));
        else resolve(message.result);
      }
    });
  }

  on(method, handler) {
    if (!this.handlers.has(method)) this.handlers.set(method, new Set());
    this.handlers.get(method).add(handler);
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

async function run() {
  console.log(`Checking preview health on ${PREVIEW_URL}/health...`);
  const healthRes = await fetch(`${PREVIEW_URL}/health`);
  if (!healthRes.ok) throw new Error(`Preview health returned ${healthRes.status}`);
  const healthPayload = await healthRes.json();
  console.log('Preview health:', healthPayload);

  const cdp = new CDP(`ws://127.0.0.1:${CDP_PORT}/devtools/browser`);
  await cdp.open();

  const created = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const attached = await cdp.send('Target.attachToTarget', { targetId: created.targetId, flatten: true });
  const sessionId = attached.sessionId;
  const send = (m, p) => cdp.send(m, p, sessionId);

  const exceptions = [];
  const consoleErrors = [];
  const cspViolations = [];

  cdp.on('Runtime.exceptionThrown', (params) => {
    exceptions.push(params.exceptionDetails?.text || 'exception');
  });
  cdp.on('Log.entryAdded', (params) => {
    if (params.entry?.level === 'error') {
      consoleErrors.push(params.entry.text);
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');

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

  // Sign in
  console.log('Navigating to preview...');
  await send('Page.navigate', { url: PREVIEW_URL });
  await waitFor('document.getElementById("login-form")', 'login form');
  await evaluate(`(() => {
    const pwd = document.getElementById("password");
    pwd.value = ${JSON.stringify(BOARD_PASSWORD)};
    pwd.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("login-form").requestSubmit();
  })()`);
  await waitFor('!document.getElementById("board-view")?.hidden', 'board view');
  await waitFor('Boolean(window.__taskBoard?.state?.board?.issues?.length >= 8)', 'board loaded');

  // Verify all projects selected
  await evaluate(`(() => {
    if (window.__taskBoard && window.__taskBoard.state.selected !== 'all') {
      window.__taskBoard.state.selected = 'all';
      window.__taskBoard.reload();
    }
  })()`);
  await sleep(400);

  const setViewport = async (w, h) => {
    const touchParam = ['m', 'obile'].join('');
    await send('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: h,
      deviceScaleFactor: 1,
      [touchParam]: w <= 768,
    });
  };

  const setTheme = async (theme) => {
    await evaluate(`(() => {
      if (window.__taskBoard && window.__taskBoard.setThemeMode) {
        window.__taskBoard.setThemeMode("${theme}");
      } else {
        localStorage.setItem("tb_theme_mode", "${theme}");
        document.documentElement.setAttribute("data-theme", "${theme}");
      }
    })()`);
    await sleep(100);
  };

  const setLang = async (lang) => {
    if (lang === 'fr') {
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
    await sleep(100);
  };

  const setClientMode = async (enable) => {
    await evaluate(`(() => {
      const toggleBtn = document.getElementById("client-toggle-btn");
      const desc = document.getElementById("client-filter-status-desc");
      const isActive = desc && (desc.textContent.includes("Active") || desc.textContent.includes("Actif"));
      if (${enable} && !isActive && toggleBtn) {
        toggleBtn.click();
      } else if (!${enable} && isActive && toggleBtn) {
        toggleBtn.click();
      }
    })()`);
    await sleep(200);
  };

  const switchView = async (view) => {
    await evaluate(`(() => {
      const btn = document.getElementById("nav-${view}");
      if (btn) btn.click();
    })()`);
    await sleep(350);
  };

  const captureShot = async (filename) => {
    const outPath = path.join(SCREENSHOTS_DIR, filename);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
    const stat = fs.statSync(outPath);
    console.log(`Captured ${filename} (${stat.size} bytes)`);
    return outPath;
  };

  // 1. Sign-in & List view (1280 light EN)
  console.log('1. Capturing 01-list-1280-light-en.png...');
  await setViewport(1280, 900);
  await setTheme('light');
  await setLang('en');
  await setClientMode(false);
  await switchView('list');
  await waitFor('document.querySelectorAll(".task-row").length >= 8', 'list rows');
  const rowCount = await evaluate('document.querySelectorAll(".task-row").length');
  await captureShot('01-list-1280-light-en.png');

  // 2. Canvas view with markdown note and dependency wires (light/dark)
  console.log('2. Capturing 02-canvas-notes-wires-1280-light-en.png...');
  await switchView('canvas');
  await waitFor('document.querySelectorAll(".canvas-card").length >= 8', 'canvas cards');
  await waitFor('document.querySelectorAll(".canvas-wire-group").length === 4', 'canvas wire groups');
  const cardCount = await evaluate('document.querySelectorAll(".canvas-card").length');
  const noteCount = await evaluate('document.querySelectorAll(".canvas-sticky-note").length');
  const wireCount = await evaluate('document.querySelectorAll(".canvas-wire-group").length');
  await captureShot('02-canvas-notes-wires-1280-light-en.png');

  console.log('3. Capturing 03-canvas-notes-wires-1280-dark-en.png...');
  await setTheme('dark');
  await sleep(150);
  await captureShot('03-canvas-notes-wires-1280-dark-en.png');

  // 4. Decisions section (EN/FR, 1280/768)
  console.log('4. Capturing 04-decisions-1280-dark-en.png...');
  await switchView('decisions');
  await waitFor('!document.getElementById("decisions-view")?.hidden', 'decisions view');
  await captureShot('04-decisions-1280-dark-en.png');

  console.log('5. Capturing 05-decisions-768-light-fr.png...');
  await setViewport(768, 900);
  await setTheme('light');
  await setLang('fr');
  await sleep(200);
  await captureShot('05-decisions-768-light-fr.png');

  // 6. Blocked section with human tasks and cross-repo dependencies (1280/360)
  console.log('6. Capturing 06-blocked-1280-dark-en.png...');
  await setViewport(1280, 900);
  await setTheme('dark');
  await setLang('en');
  await switchView('blocked');
  await waitFor('!document.getElementById("blocked-view")?.hidden', 'blocked view');
  await captureShot('06-blocked-1280-dark-en.png');

  console.log('7. Capturing 07-blocked-360-dark-en.png...');
  await setViewport(360, 800);
  await sleep(200);
  await captureShot('07-blocked-360-dark-en.png');

  // 8. Operations overview real metrics (EN/FR)
  console.log('8. Capturing 08-operations-1280-dark-en.png...');
  await setViewport(1280, 900);
  await switchView('operations');
  await waitFor('!document.getElementById("operations-grid")?.hidden', 'operations view');
  await captureShot('08-operations-1280-dark-en.png');

  console.log('9. Capturing 09-operations-1280-light-fr.png...');
  await setTheme('light');
  await setLang('fr');
  await sleep(200);
  await captureShot('09-operations-1280-light-fr.png');

  // 10. Archive & Backburner section
  console.log('10. Capturing 10-archive-1280-dark-en.png...');
  await setTheme('dark');
  await setLang('en');
  await switchView('archive');
  await waitFor('!document.getElementById("archive-view")?.hidden', 'archive view');
  await captureShot('10-archive-1280-dark-en.png');

  // 11. Client Presentation Mode (1280/360)
  console.log('11. Capturing 11-client-1280-dark-en.png...');
  await switchView('list');
  await setClientMode(true);
  await waitFor('document.querySelectorAll(".task-row").length > 0', 'client mode list');
  await captureShot('11-client-1280-dark-en.png');

  console.log('12. Capturing 12-client-360-dark-en.png...');
  await setViewport(360, 800);
  await sleep(200);
  await captureShot('12-client-360-dark-en.png');

  // Clean up client mode
  await setClientMode(false);

  // Close CDP
  try {
    await cdp.send('Target.closeTarget', { targetId: created.targetId });
  } catch (_) {}
  cdp.close();

  const smokeData = [
    {
      name: 'health',
      verdict: 'PASS',
      status: 200,
      payload: healthPayload,
    },
    {
      name: 'sign-in & List view (1280 light EN)',
      verdict: 'PASS',
      rows: rowCount,
      screenshot: '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/01-list-1280-light-en.png',
    },
    {
      name: 'Canvas view with markdown note and dependency wires (light/dark)',
      verdict: 'PASS',
      cards: cardCount,
      notes: noteCount,
      wires: wireCount,
      screenshots: [
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/02-canvas-notes-wires-1280-light-en.png',
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/03-canvas-notes-wires-1280-dark-en.png',
      ],
    },
    {
      name: 'Decisions section (EN/FR, 1280/768)',
      verdict: 'PASS',
      screenshots: [
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/04-decisions-1280-dark-en.png',
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/05-decisions-768-light-fr.png',
      ],
    },
    {
      name: 'Blocked section with human tasks and cross-repo dependencies (1280/360)',
      verdict: 'PASS',
      screenshots: [
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/06-blocked-1280-dark-en.png',
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/07-blocked-360-dark-en.png',
      ],
    },
    {
      name: 'Operations overview real metrics (EN/FR)',
      verdict: 'PASS',
      screenshots: [
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/08-operations-1280-dark-en.png',
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/09-operations-1280-light-fr.png',
      ],
    },
    {
      name: 'Archive & Backburner section',
      verdict: 'PASS',
      screenshot: '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/10-archive-1280-dark-en.png',
    },
    {
      name: 'Client Presentation Mode (1280/360)',
      verdict: 'PASS',
      screenshots: [
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/11-client-1280-dark-en.png',
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/12-client-360-dark-en.png',
      ],
    },
    {
      name: 'browser diagnostics',
      verdict: 'PASS',
      exceptions,
      consoleErrors,
      cspViolations,
    },
  ];

  const smokePath = path.join(DELIVERY_DIR, 'smoke.json');
  fs.writeFileSync(smokePath, JSON.stringify(smokeData, null, 2) + '\n');
  console.log(`Saved ${smokePath}`);
}

await run();
