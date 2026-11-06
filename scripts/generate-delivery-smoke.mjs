import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOARD_PASSWORD } from '../web/tests/helpers.mjs';

let pkg;
try {
  pkg = await import('/workspace/personal/lucas/charme-social/node_modules/playwright/index.js');
} catch {
  pkg = await import('playwright');
}
const { chromium } = pkg.default || pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DELIVERY_DIR = process.env.DELIVERY_DIR || path.resolve(ROOT_DIR, '.agents/run/chamberos-board-v2/verifications/A-delivery');
const SCREENSHOTS_DIR = path.resolve(DELIVERY_DIR, 'screenshots');
const PREVIEW_PORT = 4041;
const PREVIEW_URL = process.env.PREVIEW_URL || `http://127.0.0.1:${PREVIEW_PORT}`;
const CHROME_PATH = process.env.H2_CHROME || '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log(`Checking preview health on ${PREVIEW_URL}/health...`);
  const healthRes = await fetch(`${PREVIEW_URL}/health`);
  if (!healthRes.ok) throw new Error(`Preview health returned ${healthRes.status}`);
  const healthPayload = await healthRes.json();
  console.log('Preview health:', healthPayload);

  console.log(`Launching real Chromium from ${CHROME_PATH}...`);
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    serviceWorkers: 'block',
  });

  const exceptions = [];
  const consoleErrors = [];
  const cspViolations = [];

  await context.addInitScript(() => {
    window.__cspViolations = [];
    window.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push(e.blockedURI || e.violatedDirective || 'csp-violation');
    });
  });

  const page = await context.newPage();

  page.on('pageerror', (err) => {
    exceptions.push(err.message || String(err));
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');

  cdp.on('Runtime.exceptionThrown', (params) => {
    const text = params.exceptionDetails?.text || 'exception';
    if (!exceptions.includes(text)) exceptions.push(text);
  });

  cdp.on('Runtime.consoleAPICalled', (params) => {
    if (params.type === 'error') {
      const msg = params.args?.map((a) => a.value || a.description).join(' ') || 'error';
      if (!consoleErrors.includes(msg)) consoleErrors.push(msg);
    }
  });

  cdp.on('Log.entryAdded', (params) => {
    if (/content security|violat/i.test(params.entry?.text)) {
      cspViolations.push(params.entry.text);
    }
  });

  const evaluate = async (fn, arg) => page.evaluate(fn, arg);

  const waitFor = async (fnExpr, label, timeout = 10000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const val = await page.evaluate(`Boolean(${fnExpr})`);
        if (val) return true;
      } catch (_) {}
      await sleep(100);
    }
    throw new Error(`Timeout waiting for ${label}`);
  };

  const setViewport = async (w, h) => {
    await page.setViewportSize({ width: w, height: h });
    await sleep(150);
  };

  const setTheme = async (theme) => {
    await page.evaluate((t) => {
      if (window.__taskBoard && window.__taskBoard.setThemeMode) {
        window.__taskBoard.setThemeMode(t);
      } else {
        localStorage.setItem('tb_theme_mode', t);
        document.documentElement.setAttribute('data-theme', t);
      }
    }, theme);
    await sleep(150);
  };

  const setLang = async (lang) => {
    await page.evaluate((targetLang) => {
      const current = localStorage.getItem('tb_lang') || 'en';
      if (current !== targetLang) {
        const btn = document.getElementById('lang-switch-btn');
        if (btn) btn.click();
      }
    }, lang);
    await sleep(200);
  };

  const setClientMode = async (enable) => {
    await page.evaluate((en) => {
      const toggleBtn = document.getElementById('client-toggle-btn');
      const desc = document.getElementById('client-filter-status-desc');
      const isActive = desc && (desc.textContent.includes('Active') || desc.textContent.includes('Actif'));
      if (en && !isActive && toggleBtn) {
        toggleBtn.click();
      } else if (!en && isActive && toggleBtn) {
        toggleBtn.click();
      }
    }, enable);
    await sleep(250);
  };

  const switchView = async (view) => {
    await page.evaluate((targetView) => {
      const btn = document.getElementById(`nav-${targetView}`);
      if (btn) btn.click();
    }, view);
    await sleep(350);
  };

  const captureShot = async (filename) => {
    const outPath = path.join(SCREENSHOTS_DIR, filename);
    await page.screenshot({ path: outPath });
    const stat = fs.statSync(outPath);
    console.log(`Captured ${filename} (${stat.size} bytes)`);
    return outPath;
  };

  // Sign in
  console.log('Navigating to preview...');
  await page.goto(PREVIEW_URL);
  await waitFor('document.getElementById("login-form")', 'login form');
  await page.evaluate((pwd) => {
    const input = document.getElementById('password');
    input.value = pwd;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('login-form').requestSubmit();
  }, BOARD_PASSWORD);
  await waitFor('!document.getElementById("board-view")?.hidden', 'board view');
  await waitFor('Boolean(window.__taskBoard?.state?.board?.issues?.length >= 8)', 'board loaded');

  // Verify all projects selected
  await page.evaluate(() => {
    if (window.__taskBoard && window.__taskBoard.state.selected !== 'all') {
      window.__taskBoard.state.selected = 'all';
      window.__taskBoard.reload();
    }
  });
  await sleep(400);

  // 1. Sign-in & List view (1280 light EN)
  console.log('1. Capturing 01-list-1280-light-en.png...');
  await setViewport(1280, 900);
  await setTheme('light');
  await setLang('en');
  await setClientMode(false);
  await switchView('list');
  await waitFor('document.querySelectorAll(".task-row").length >= 8', 'list rows');
  const rowCount = await page.evaluate(() => document.querySelectorAll('.task-row').length);
  await captureShot('01-list-1280-light-en.png');

  // 2. Canvas view with markdown note and dependency wires (light/dark)
  console.log('2. Capturing 02-canvas-notes-wires-1280-light-en.png...');
  await switchView('canvas');
  await waitFor('document.querySelectorAll(".canvas-card").length >= 8', 'canvas cards');
  await waitFor('document.querySelectorAll(".canvas-wire-group").length === 4', 'canvas wire groups');
  await page.evaluate(() => window.__taskBoard.fitAllCanvasNodes());
  await sleep(250);
  const cardCount = await page.evaluate(() => document.querySelectorAll('.canvas-card').length);
  const noteCount = await page.evaluate(() => document.querySelectorAll('.canvas-sticky-note').length);
  const wireCount = await page.evaluate(() => document.querySelectorAll('.canvas-wire-group').length);
  await captureShot('02-canvas-notes-wires-1280-light-en.png');

  console.log('3. Capturing 03-canvas-notes-wires-1280-dark-en.png...');
  await setTheme('dark');
  await sleep(150);
  await captureShot('03-canvas-notes-wires-1280-dark-en.png');

  // Measure Canvas controls across viewports and languages
  console.log('Measuring Canvas controls containment and non-overlap across matrix...');
  const canvasMatrix = [
    { width: 1280, height: 900, theme: 'light', lang: 'en' },
    { width: 1280, height: 900, theme: 'dark', lang: 'en' },
    { width: 1280, height: 900, theme: 'light', lang: 'fr' },
    { width: 768, height: 900, theme: 'light', lang: 'en' },
    { width: 768, height: 900, theme: 'dark', lang: 'fr' },
    { width: 360, height: 800, theme: 'light', lang: 'en' },
    { width: 360, height: 800, theme: 'dark', lang: 'en' },
    { width: 360, height: 800, theme: 'light', lang: 'fr' },
    { width: 360, height: 800, theme: 'dark', lang: 'fr' },
  ];

  const canvasMeasurements = [];
  let canvasMeasurementsPass = true;

  for (const mCase of canvasMatrix) {
    await setViewport(mCase.width, mCase.height);
    await setTheme(mCase.theme);
    await setLang(mCase.lang);
    if (mCase.width <= 768) {
      await page.evaluate(() => {
        const b = document.getElementById('sidebar-backdrop');
        if (b && !b.hidden) b.click();
      });
    }
    await sleep(200);

    const metrics = await page.evaluate(() => {
      const hud = document.querySelector('#canvas-controls');
      const viewport = document.querySelector('#canvas-viewport');
      const hudRect = hud.getBoundingClientRect();
      const vpRect = viewport.getBoundingClientRect();

      const buttons = Array.from(hud.querySelectorAll('.canvas-control-btn')).filter((b) => !b.hidden).map((b) => {
        const r = b.getBoundingClientRect();
        const s = window.getComputedStyle(b);
        return {
          id: b.id,
          text: b.textContent.trim(),
          left: Math.round(r.left * 10) / 10,
          right: Math.round(r.right * 10) / 10,
          top: Math.round(r.top * 10) / 10,
          bottom: Math.round(r.bottom * 10) / 10,
          width: Math.round(r.width * 10) / 10,
          height: Math.round(r.height * 10) / 10,
          whiteSpace: s.whiteSpace,
          flexShrink: s.flexShrink,
          multilineWrap: r.height > 32,
        };
      });

      const overflowsViewportRight = hudRect.right > vpRect.right + 0.5;
      const overflowsViewportLeft = hudRect.left < vpRect.left - 0.5;
      const documentOverflow = document.documentElement.scrollWidth > window.innerWidth;
      const bg = window.getComputedStyle(viewport).backgroundImage;

      return {
        hudRect: {
          left: Math.round(hudRect.left),
          right: Math.round(hudRect.right),
          width: Math.round(hudRect.width),
          height: Math.round(hudRect.height),
        },
        vpRect: {
          left: Math.round(vpRect.left),
          right: Math.round(vpRect.right),
          width: Math.round(vpRect.width),
        },
        overflowsViewportRight,
        overflowsViewportLeft,
        documentOverflow,
        buttons,
        backgroundImage: bg,
      };
    });

    const hasButtonOverflow = metrics.buttons.some((b) => b.width > 0 && (b.left < 0 || b.right > mCase.width));
    const overlaps = [];
    for (let i = 0; i < metrics.buttons.length; i++) {
      for (let j = i + 1; j < metrics.buttons.length; j++) {
        const b1 = metrics.buttons[i];
        const b2 = metrics.buttons[j];
        if (b1.width > 0 && b2.width > 0) {
          const isOverlap = (b1.left < b2.right - 0.5) && (b1.right > b2.left + 0.5) &&
                            (b1.top < b2.bottom - 0.5) && (b1.bottom > b2.top + 0.5);
          if (isOverlap) {
            overlaps.push(`${b1.id} & ${b2.id}`);
          }
        }
      }
    }
    const hasButtonOverlap = overlaps.length > 0;
    const casePass = !metrics.overflowsViewportLeft && !metrics.overflowsViewportRight && !hasButtonOverflow && !hasButtonOverlap && !metrics.documentOverflow;
    if (!casePass) {
      canvasMeasurementsPass = false;
      console.warn(`Canvas control containment violation at ${mCase.width}x${mCase.height} ${mCase.lang}:`, {
        overflowsLeft: metrics.overflowsViewportLeft,
        overflowsRight: metrics.overflowsViewportRight,
        buttonOverflow: hasButtonOverflow,
        buttonOverlap: overlaps,
        documentOverflow: metrics.documentOverflow,
      });
    }

    canvasMeasurements.push({
      testCase: mCase,
      hudMetrics: metrics,
      buttonOverlaps: overlaps,
      pass: casePass,
    });
  }

  // Restore baseline desktop EN
  await setViewport(1280, 900);
  await setTheme('dark');
  await setLang('en');
  await sleep(150);

  const measurementsArtifactPath = path.join(DELIVERY_DIR, 'canvas-measurements.json');
  fs.writeFileSync(measurementsArtifactPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    previewUrl: PREVIEW_URL,
    wireCount,
    cardCount,
    noteCount,
    canvasMeasurementsPass,
    measurements: canvasMeasurements,
  }, null, 2) + '\n');
  console.log(`Saved canvas measurements to ${measurementsArtifactPath}`);

  // 4. Decisions section (EN/FR, 1280/768)
  console.log('4. Capturing 04-decisions-1280-dark-en.png...');
  await switchView('decisions');
  await waitFor('!document.getElementById("decisions-view")?.hidden', 'decisions view');
  await waitFor('document.querySelectorAll("#decisions-view .section-card").length >= 1', 'decisions cards');
  const decisionsCards = await page.evaluate(() => document.querySelectorAll('#decisions-view .section-card').length);
  const decisionsVisible = await page.evaluate(() => !document.getElementById('decisions-view')?.hidden);
  await captureShot('04-decisions-1280-dark-en.png');

  console.log('5. Capturing 05-decisions-768-light-fr.png...');
  await setViewport(768, 900);
  await setTheme('light');
  await setLang('fr');
  await page.evaluate(() => {
    const b = document.getElementById('sidebar-backdrop');
    if (b && !b.hidden) b.click();
  });
  await sleep(200);
  await captureShot('05-decisions-768-light-fr.png');

  // 6. Blocked section with human tasks and cross-repo dependencies (1280/360)
  console.log('6. Capturing 06-blocked-1280-dark-en.png...');
  await setViewport(1280, 900);
  await setTheme('dark');
  await setLang('en');
  await switchView('blocked');
  await waitFor('!document.getElementById("blocked-view")?.hidden', 'blocked view');
  await waitFor('document.querySelectorAll("#blocked-view .section-card").length >= 1', 'blocked cards');
  const blockedCards = await page.evaluate(() => document.querySelectorAll('#blocked-view .section-card').length);
  const blockedVisible = await page.evaluate(() => !document.getElementById('blocked-view')?.hidden);
  await captureShot('06-blocked-1280-dark-en.png');

  console.log('7. Capturing 07-blocked-360-dark-en.png...');
  await setViewport(360, 800);
  await page.evaluate(() => {
    const b = document.getElementById('sidebar-backdrop');
    if (b && !b.hidden) b.click();
  });
  await sleep(200);
  await captureShot('07-blocked-360-dark-en.png');

  // 8. Operations overview real metrics (EN/FR)
  console.log('8. Capturing 08-operations-1280-dark-en.png...');
  await setViewport(1280, 900);
  await switchView('operations');
  await waitFor('!document.getElementById("operations-grid")?.hidden', 'operations view');
  await waitFor('document.querySelectorAll("#operations-grid .stat-card").length >= 4', 'operations stat cards');
  const operationsStatCards = await page.evaluate(() => document.querySelectorAll('#operations-grid .stat-card').length);
  const operationsVisible = await page.evaluate(() => !document.getElementById('operations-grid')?.hidden);
  await captureShot('08-operations-1280-dark-en.png');

  console.log('9. Capturing 09-operations-1280-light-fr.png...');
  await setTheme('light');
  await setLang('fr');
  await sleep(200);
  await captureShot('09-operations-1280-light-fr.png');

  // 10. Archive & Backburner section
  console.log('10. Capturing 10-archive-1280-dark-en.png...');
  await setViewport(1280, 900);
  await setTheme('dark');
  await setLang('en');
  await switchView('archive');
  await waitFor('!document.getElementById("archive-view")?.hidden', 'archive view');
  await waitFor('document.querySelectorAll("#archive-view .section-card").length >= 1', 'archive cards');
  const archiveCards = await page.evaluate(() => document.querySelectorAll('#archive-view .section-card').length);
  const archiveVisible = await page.evaluate(() => !document.getElementById('archive-view')?.hidden);
  await captureShot('10-archive-1280-dark-en.png');

  // 11. Client Presentation Mode (1280/360)
  console.log('11. Capturing 11-client-1280-dark-en.png...');
  await switchView('list');
  await setClientMode(true);
  await waitFor('document.querySelectorAll(".task-row").length > 0', 'client mode list');
  const clientRows = await page.evaluate(() => document.querySelectorAll('.task-row').length);
  const clientActive = await page.evaluate(() => {
    const desc = document.getElementById('client-filter-status-desc');
    return Boolean(desc && (desc.textContent.includes('Active') || desc.textContent.includes('Actif')));
  });
  await captureShot('11-client-1280-dark-en.png');

  console.log('12. Capturing 12-client-360-dark-en.png...');
  await setViewport(360, 800);
  await page.evaluate(() => {
    const b = document.getElementById('sidebar-backdrop');
    if (b && !b.hidden) b.click();
  });
  await sleep(200);
  await captureShot('12-client-360-dark-en.png');

  // Clean up client mode
  await setClientMode(false);

  // Check page-side CSP listener
  const pageCsp = await page.evaluate(() => window.__cspViolations || []).catch(() => []);
  for (const c of pageCsp) {
    if (!cspViolations.includes(c)) cspViolations.push(c);
  }

  // Close browser
  await browser.close();

  const smokeData = [
    {
      name: 'health',
      verdict: (healthRes.status === 200 && healthPayload?.status === 'ok') ? 'PASS' : 'FAIL',
      status: healthRes.status,
      payload: healthPayload,
    },
    {
      name: 'sign-in & List view (1280 light EN)',
      verdict: rowCount >= 8 ? 'PASS' : 'FAIL',
      rows: rowCount,
      screenshot: '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/01-list-1280-light-en.png',
    },
    {
      name: 'Canvas view with markdown note and dependency wires (light/dark)',
      verdict: (wireCount === 4 && cardCount >= 8 && noteCount >= 1) ? 'PASS' : 'FAIL',
      cards: cardCount,
      notes: noteCount,
      wires: wireCount,
      screenshots: [
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/02-canvas-notes-wires-1280-light-en.png',
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/03-canvas-notes-wires-1280-dark-en.png',
      ],
    },
    {
      name: 'Canvas controls mobile containment (360/768/1280, EN/FR, light/dark)',
      verdict: canvasMeasurementsPass ? 'PASS' : 'FAIL',
      casesTested: canvasMeasurements.length,
      artifact: '.agents/run/chamberos-board-v2/verifications/A-delivery/canvas-measurements.json',
    },
    {
      name: 'Decisions section (EN/FR, 1280/768)',
      verdict: (decisionsVisible && decisionsCards >= 1) ? 'PASS' : 'FAIL',
      cards: decisionsCards,
      screenshots: [
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/04-decisions-1280-dark-en.png',
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/05-decisions-768-light-fr.png',
      ],
    },
    {
      name: 'Blocked section with human tasks and cross-repo dependencies (1280/360)',
      verdict: (blockedVisible && blockedCards >= 1) ? 'PASS' : 'FAIL',
      cards: blockedCards,
      screenshots: [
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/06-blocked-1280-dark-en.png',
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/07-blocked-360-dark-en.png',
      ],
    },
    {
      name: 'Operations overview real metrics (EN/FR)',
      verdict: (operationsVisible && operationsStatCards >= 4) ? 'PASS' : 'FAIL',
      statCards: operationsStatCards,
      screenshots: [
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/08-operations-1280-dark-en.png',
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/09-operations-1280-light-fr.png',
      ],
    },
    {
      name: 'Archive & Backburner section',
      verdict: (archiveVisible && archiveCards >= 1) ? 'PASS' : 'FAIL',
      cards: archiveCards,
      screenshot: '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/10-archive-1280-dark-en.png',
    },
    {
      name: 'Client Presentation Mode (1280/360)',
      verdict: (clientRows >= 1 && clientActive) ? 'PASS' : 'FAIL',
      rows: clientRows,
      active: clientActive,
      screenshots: [
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/11-client-1280-dark-en.png',
        '.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/12-client-360-dark-en.png',
      ],
    },
    {
      name: 'browser diagnostics',
      verdict: (exceptions.length === 0 && consoleErrors.length === 0 && cspViolations.length === 0) ? 'PASS' : 'FAIL',
      exceptions,
      consoleErrors,
      cspViolations,
    },
  ];

  const smokePath = path.join(DELIVERY_DIR, 'smoke.json');
  fs.writeFileSync(smokePath, JSON.stringify(smokeData, null, 2) + '\n');
  console.log(`Saved ${smokePath}`);

  const failures = smokeData.filter((entry) => entry.verdict !== 'PASS');
  if (failures.length > 0) {
    throw new Error(`Smoke check failed with ${failures.length} failing check(s): ${failures.map((f) => f.name).join(', ')}`);
  }
}

await run();
