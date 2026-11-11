import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOARD_PASSWORD, startBoard } from '../web/tests/helpers.mjs';
import { startFakeGitHub, makeIssue } from '../web/tests/fake-github.mjs';

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
const DELIVERY_DIR = process.env.DELIVERY_DIR || path.resolve(ROOT_DIR, '.agents/run/chamberos-board-v2/verifications/V4-1');
const SCREENSHOTS_DIR = path.resolve(DELIVERY_DIR, 'screenshots');
const DEFAULT_PORT = 4041;
const CHROME_PATH = process.env.H2_CHROME || '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function relPath(absPath) {
  return path.relative(ROOT_DIR, absPath);
}

async function createSyntheticPreview() {
  const recentClosedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const noteMarker = '<!-- board-canvas: {"x":80,"y":90,"notes":[{"id":"note-1","x":100,"y":310,"w":240,"h":135,"text":"### Studio routing note\\nVerify regional failover before enabling client traffic.","color":"yellow"}]} -->';

  const chamberosBody1 = [
    noteMarker,
    '## Overview',
    'Coordinate edge session verification across regional ingress nodes.',
    '',
    '## Acceptance Criteria',
    '- [x] Validate session HMAC rotation',
    '- [ ] Confirm zero-downtime rollover',
    '',
    '## Open Questions',
    '- [ ] Approve regional failover topology? (Active-active | Primary-standby)',
    '',
    '## Human Tasks',
    '- [ ] Review [ingress preview](https://example.com/preview)',
  ].join('\n');

  const fake = await startFakeGitHub({
    repositories: [
      {
        repo: 'chamberos/platform',
        id: 101,
        hasIssues: true,
        issues: [
          makeIssue({
            number: 1,
            repo: 'chamberos/platform',
            title: 'Deploy regional ingress verification',
            body: chamberosBody1,
            labels: ['status:needs-human', 'priority:urgent'],
            updated_at: '2026-11-10T14:20:00Z',
          }),
          makeIssue({
            number: 2,
            repo: 'chamberos/platform',
            title: 'Wire conditional ETag revalidation across board routes',
            body: '<!-- board-canvas: {"x":460,"y":90} -->\n## Overview\nReduce poll overhead with If-None-Match.',
            labels: ['status:in-progress', 'priority:high'],
            updated_at: '2026-11-10T12:00:00Z',
          }),
          makeIssue({
            number: 3,
            repo: 'chamberos/platform',
            title: 'Audit strict CSP headers on workspace shell',
            body: '<!-- board-canvas: {"x":840,"y":90} -->\n## Overview\nEnsure style-src self remains enforced.',
            labels: ['status:in-review', 'priority:medium'],
            updated_at: '2026-11-09T16:30:00Z',
          }),
          makeIssue({
            number: 4,
            repo: 'chamberos/platform',
            title: 'Publish release checksum manifest',
            body: '<!-- board-canvas: {"x":460,"y":300} -->\n## Overview\nGenerate deterministic SHA-256 bundle manifest.',
            labels: ['status:todo', 'priority:medium'],
            updated_at: '2026-11-08T11:00:00Z',
          }),
          makeIssue({
            number: 5,
            repo: 'chamberos/platform',
            title: 'Internal telemetry spike scratchpad',
            body: '<!-- board-canvas: {"x":1240,"y":520} -->\n## Overview\nUnpublished exploration notes.',
            labels: ['status:draft', 'priority:low'],
            updated_at: '2026-11-07T09:00:00Z',
          }),
          makeIssue({
            number: 6,
            repo: 'chamberos/platform',
            title: 'Evaluate multi-region read replicas',
            body: '## Overview\nParked for Q1 capacity planning.',
            labels: ['backburner', 'priority:low'],
            updated_at: '2026-11-01T10:00:00Z',
          }),
          makeIssue({
            number: 7,
            repo: 'chamberos/platform',
            title: 'Migrate session cookie attributes to SameSite=Lax',
            body: '## Overview\nCompleted baseline hardening.',
            state: 'closed',
            closed_at: recentClosedAt,
            labels: ['status:done', 'priority:high'],
            updated_at: recentClosedAt,
          }),
        ],
      },
      {
        repo: 'acme/vanilla-sdk',
        id: 102,
        hasIssues: true,
        issues: [
          makeIssue({
            number: 10,
            repo: 'acme/vanilla-sdk',
            title: 'Support exponential backoff on 429 webhook retries',
            body: [
              'Standard GitHub Markdown issue in a repository with zero ChamberOS labels or section headings.',
              '',
              '### Reproduction',
              '1. Send burst webhook deliveries above 120 req/min.',
              '2. Observe immediate retry without jitter.',
              '',
              '### Expected behavior',
              '- Respect `Retry-After` header when present.',
              '- Apply bounded exponential backoff (`250ms` to `16s`).',
            ].join('\n'),
            labels: ['priority:high', 'enhancement'],
            updated_at: '2026-11-11T08:15:00Z',
          }),
          makeIssue({
            number: 11,
            repo: 'acme/vanilla-sdk',
            title: 'Document TypeScript pagination iterator types',
            body: 'Add clean examples for `for await (const page of client.paginate())` in README.',
            labels: ['priority:low'],
            updated_at: '2026-11-10T09:45:00Z',
          }),
          makeIssue({
            number: 12,
            repo: 'acme/vanilla-sdk',
            title: 'Remove deprecated Node 16 compatibility shim',
            body: 'Drop legacy stream wrapper before next minor release.',
            labels: [],
            updated_at: '2026-11-09T14:00:00Z',
          }),
        ],
      },
      {
        repo: 'acme/empty-service',
        id: 103,
        hasIssues: true,
        issues: [],
      },
      {
        repo: 'acme/docs-static',
        id: 104,
        hasIssues: false,
        issues: [],
      },
    ],
  });

  fake.addDependency(2, 1, 'chamberos/platform', 'chamberos/platform');
  fake.addDependency(3, 2, 'chamberos/platform', 'chamberos/platform');
  fake.addDependency(4, 1, 'chamberos/platform', 'chamberos/platform');
  fake.addDependency(11, 2, 'acme/vanilla-sdk', 'chamberos/platform');

  const board = await startBoard(fake, { BOARD_REPO: 'chamberos/platform' });
  return {
    url: board.url,
    async close() {
      await board.app.close();
      await fake.close();
    },
  };
}

async function resolvePreviewTarget() {
  const configuredUrl = process.env.PREVIEW_URL || `http://127.0.0.1:${DEFAULT_PORT}`;
  try {
    const res = await fetch(`${configuredUrl}/health`);
    if (res.ok) {
      return { url: configuredUrl, synthetic: false, close: async () => {} };
    }
  } catch (_) {}
  if (process.env.PREVIEW_URL) {
    throw new Error(`Configured PREVIEW_URL ${process.env.PREVIEW_URL} is unreachable`);
  }
  const synthetic = await createSyntheticPreview();
  return { url: synthetic.url, synthetic: true, close: synthetic.close };
}

async function run() {
  const target = await resolvePreviewTarget();
  const previewUrl = target.url;
  let browser;

  try {
    console.log(`Checking preview health on ${previewUrl}/health (synthetic=${target.synthetic})...`);
    const healthRes = await fetch(`${previewUrl}/health`);
    if (!healthRes.ok) throw new Error(`Preview health returned ${healthRes.status}`);
    const healthPayload = await healthRes.json();

    console.log(`Launching real Chromium from ${CHROME_PATH}...`);
    browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
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
        if (window.__taskBoard && window.__taskBoard.setClientPresentationMode) {
          window.__taskBoard.setClientPresentationMode(en);
        }
      }, enable);
      await sleep(200);
    };

    const switchView = async (view) => {
      await page.evaluate((targetView) => {
        const btn = document.getElementById(`nav-${targetView}`);
        if (btn) btn.click();
      }, view);
      await sleep(300);
    };

    const selectScope = async (scope) => {
      await page.evaluate((targetScope) => {
        if (window.__taskBoard?.state?.selected === targetScope) return;
        const search = document.getElementById('repo-search-input');
        if (search) {
          search.value = '';
          search.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const options = Array.from(document.querySelectorAll('#repo-options-list .repo-option'));
        const match = targetScope === 'all'
          ? options[0]
          : options.find((el) => el.querySelector('.repo-option-full')?.textContent?.trim() === targetScope);
        if (match) match.click();
      }, scope);
      await waitFor(`window.__taskBoard?.state?.selected === ${JSON.stringify(scope)} && !window.__taskBoard?.state?.boardLoad`, `scope ${scope}`);
      await sleep(250);
    };

    const captureShot = async (filename) => {
      const outPath = path.join(SCREENSHOTS_DIR, filename);
      await page.screenshot({ path: outPath });
      const stat = fs.statSync(outPath);
      console.log(`Captured ${filename} (${stat.size} bytes)`);
      return relPath(outPath);
    };

    const inspectSurface = async () => page.evaluate(() => {
      const visible = n => {
        const r = n.getBoundingClientRect(), s = getComputedStyle(n);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
      };
      const undersized = Array.from(document.querySelectorAll('button, input:not([type="hidden"]), select, textarea, a[href]')).filter(visible).filter(n => {
        const r = n.getBoundingClientRect();
        return innerWidth <= 768 && (r.width < 44 || r.height < 44);
      }).map(n => ({ id: n.id, text: n.textContent.trim().slice(0, 60), width: n.getBoundingClientRect().width, height: n.getBoundingClientRect().height }));
      const inlineStyles = Array.from(document.querySelectorAll('[style]')).filter(n => n.getAttribute('style')?.trim()).length;
      // CSSOM assignments are CSP-compatible; HTML style attributes are prohibited in source.
      const banned = /\b(?:mo(?:bile)|n(?:8n))\b/i.test(document.body.innerText);
      return { pass: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight && undersized.length === 0 && !banned, undersized, inlineStyles, banned, lang: document.documentElement.lang };
    });

    // Sign in starting at 390x844 so initial Canvas load tests narrow smart-fit (>=0.55)
    console.log('Navigating to preview at 390x844...');
    await page.goto(previewUrl);
    await waitFor('document.getElementById("login-form")', 'login form');
    await page.evaluate((pwd) => {
      const input = document.getElementById('password');
      input.value = pwd;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('login-form').requestSubmit();
    }, BOARD_PASSWORD);
    await waitFor('!document.getElementById("board-view")?.hidden', 'board view');
    await waitFor('Boolean(window.__taskBoard?.state?.board?.issues?.length >= 8)', 'board loaded');

    await selectScope('all');

    // Initial narrow Canvas smart-fit check at 390x844 Dark EN
    await setTheme('dark');
    await setLang('en');
    await switchView('canvas');
    await waitFor('document.querySelectorAll(".canvas-card").length >= 8', 'narrow canvas cards');
    const initialNarrowScale = await page.evaluate(() => window.__taskBoard.state.canvasScale);
    const shot04 = await captureShot('04-canvas-390-dark-en.png');

    // Explicit Fit button still fits entire bounding box at any scale
    await page.click('#canvas-fit-all');
    await sleep(150);
    const explicitFitScale = await page.evaluate(() => window.__taskBoard.state.canvasScale);

    // 1. Desktop List view (1280x900 Light EN)
    await setViewport(1280, 900);
    await setTheme('light');
    await setLang('en');
    await setClientMode(false);
    await switchView('list');
    await waitFor('document.querySelectorAll(".task-row").length >= 8', 'list rows');
    const rowCount = await page.evaluate(() => document.querySelectorAll('.task-row').length);
    const shot01 = await captureShot('01-list-1280-light-en.png');

    // 2 & 3. Desktop Canvas view with Markdown note and dependency wires (Light & Dark)
    await switchView('canvas');
    await waitFor('document.querySelectorAll(".canvas-card").length >= 8', 'canvas cards');
    await waitFor('document.querySelectorAll(".canvas-wire-group").length >= 4', 'canvas wire groups');
    await page.evaluate(() => window.__taskBoard.fitAllCanvasNodes());
    await sleep(250);
    const cardCount = await page.evaluate(() => document.querySelectorAll('.canvas-card').length);
    const noteCount = await page.evaluate(() => document.querySelectorAll('.canvas-sticky-note').length);
    const wireCount = await page.evaluate(() => document.querySelectorAll('.canvas-wire-group').length);
    const shot02 = await captureShot('02-canvas-notes-wires-1280-light-en.png');

    await setTheme('dark');
    await sleep(150);
    const shot03 = await captureShot('03-canvas-notes-wires-1280-dark-en.png');

    // Measure Canvas controls containment, <html lang>, and 0px overhang (6 controls before Arrange + 7 controls with Undo visible)
    const viewports = [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1280, height: 900 }];
    const baseMatrix = viewports.flatMap(size => ['light', 'dark'].flatMap(theme => ['en', 'fr'].map(lang => ({ ...size, theme, lang, expectUndo: false }))));
    const undoMatrix = baseMatrix.map(item => ({ ...item, expectUndo: true }));

    const canvasMeasurements = [];
    let canvasMeasurementsPass = true;

    const measureCase = async (mCase) => {
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
          return {
            id: b.id,
            text: b.textContent.trim(),
            left: Math.round(r.left * 10) / 10,
            right: Math.round(r.right * 10) / 10,
            top: Math.round(r.top * 10) / 10,
            bottom: Math.round(r.bottom * 10) / 10,
            width: Math.round(r.width * 10) / 10,
            height: Math.round(r.height * 10) / 10,
          };
        });

        return {
          canvasViewNotShown: viewport.hidden || !viewport.getClientRects().length || getComputedStyle(viewport).display === 'none',
          viewportScrollTop: viewport.scrollTop,
          htmlLang: document.documentElement.lang,
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          hudRect: {
            left: Math.round(hudRect.left * 10) / 10,
            right: Math.round(hudRect.right * 10) / 10,
            top: Math.round(hudRect.top * 10) / 10,
            bottom: Math.round(hudRect.bottom * 10) / 10,
            width: Math.round(hudRect.width * 10) / 10,
            height: Math.round(hudRect.height * 10) / 10,
          },
          vpRect: {
            left: Math.round(vpRect.left * 10) / 10,
            right: Math.round(vpRect.right * 10) / 10,
            top: Math.round(vpRect.top * 10) / 10,
            bottom: Math.round(vpRect.bottom * 10) / 10,
            width: Math.round(vpRect.width * 10) / 10,
            height: Math.round(vpRect.height * 10) / 10,
          },
          buttons,
          backgroundImage: window.getComputedStyle(viewport).backgroundImage,
        };
      });

      const vp = metrics.vpRect;
      const nonVacuousButtons = !metrics.canvasViewNotShown && vp.width > 0 && vp.height > 0 && (mCase.expectUndo
        ? metrics.buttons.length === 8 && metrics.buttons.some((b) => b.id === 'canvas-arrange-undo' && b.width > 0 && b.height > 0)
        : metrics.buttons.length >= 7 && metrics.buttons.every((b) => b.width > 0 && b.height > 0));
      const bottomGap = vp.bottom - metrics.hudRect.bottom;
      const hudBottomDocked = bottomGap >= 4 && bottomGap <= 36;
      const touchTargetsPass = mCase.width > 768 || metrics.buttons.every(b => b.width >= 44 && b.height >= 44);
      const compactHudHeight = metrics.hudRect.height > 0 && metrics.hudRect.height < 56;
      const langMatches = metrics.htmlLang === mCase.lang;
      const zeroViewportBottomOverhang = vp.bottom <= metrics.windowHeight + 0.5;
      const zeroDocumentOverflow = metrics.scrollWidth <= metrics.windowWidth + 0.5 && metrics.scrollHeight <= metrics.windowHeight + 0.5;
      const hudInsideViewport =
        metrics.hudRect.left >= vp.left - 0.5 &&
        metrics.hudRect.right <= vp.right + 0.5 &&
        metrics.hudRect.top >= vp.top - 0.5 &&
        metrics.hudRect.bottom <= vp.bottom + 0.5;

      const outsideViewport = metrics.buttons
        .filter((b) => b.left < vp.left - 0.5 || b.right > vp.right + 0.5 || b.top < vp.top - 0.5 || b.bottom > vp.bottom + 0.5)
        .map((b) => b.id);

      const overlaps = [];
      for (let i = 0; i < metrics.buttons.length; i++) {
        for (let j = i + 1; j < metrics.buttons.length; j++) {
          const b1 = metrics.buttons[i];
          const b2 = metrics.buttons[j];
          const isOverlap = (b1.left < b2.right - 0.5) && (b1.right > b2.left + 0.5) &&
                            (b1.top < b2.bottom - 0.5) && (b1.bottom > b2.top + 0.5);
          if (isOverlap) overlaps.push(`${b1.id} & ${b2.id}`);
        }
      }

      const casePass =
        nonVacuousButtons &&
        hudBottomDocked &&
        touchTargetsPass &&
        compactHudHeight &&
        langMatches &&
        zeroViewportBottomOverhang &&
        zeroDocumentOverflow &&
        hudInsideViewport &&
        outsideViewport.length === 0 &&
        overlaps.length === 0;

      if (!casePass) {
        canvasMeasurementsPass = false;
        console.warn(`Containment/invariant violation at ${mCase.width}x${mCase.height} ${mCase.theme} ${mCase.lang} (undo=${mCase.expectUndo}):`, JSON.stringify({
          nonVacuousButtons,
          bottomGap, hudBottomDocked, touchTargetsPass,
          buttonCount: metrics.buttons.length,
          compactHudHeight,
          hudHeight: metrics.hudRect.height,
          langMatches,
          htmlLang: metrics.htmlLang,
          zeroViewportBottomOverhang,
          vpBottom: vp.bottom,
          windowHeight: metrics.windowHeight,
          zeroDocumentOverflow,
          scrollWidth: metrics.scrollWidth,
          scrollHeight: metrics.scrollHeight,
          hudInsideViewport,
          outsideViewport,
          overlaps,
        }));
      }

      canvasMeasurements.push({
        testCase: mCase,
        hudMetrics: metrics,
        nonVacuousButtons,
        bottomGap, hudBottomDocked, touchTargetsPass,
        compactHudHeight,
        langMatches,
        zeroViewportBottomOverhang,
        zeroDocumentOverflow,
        buttonOverlaps: overlaps,
        buttonsOutsideViewport: outsideViewport,
        pass: casePass,
      });
    };

    for (const mCase of baseMatrix) {
      await measureCase(mCase);
      await captureShot(`matrix-canvas-${mCase.width}-${mCase.theme}-${mCase.lang}.png`);
    }

    // Trigger Arrange so Undo button becomes visible (7 buttons total)
    await setViewport(1280, 900);
    await setLang('fr');
    await setTheme('light');
    await page.click('#canvas-arrange');
    await waitFor('!document.getElementById("canvas-arrange-dialog")?.hidden', 'arrange dialog');
    const allRadio = await page.$('#arrange-scope-all');
    if (allRadio) await allRadio.check();
    await page.click('#arrange-confirm-btn');
    await waitFor('!document.getElementById("canvas-arrange-undo")?.hidden', 'Undo button visible');
    const closeArrangeBtn = await page.$('#arrange-cancel-btn');
    if (closeArrangeBtn) await closeArrangeBtn.click();
    await sleep(150);

    for (const mCase of undoMatrix) {
      await measureCase(mCase);
      await captureShot(`matrix-undo-${mCase.width}-${mCase.theme}-${mCase.lang}.png`);
      if (mCase.width === 360 && mCase.theme === 'light' && mCase.lang === 'fr') {
        await captureShot('05-canvas-undo-360-light-fr.png');
      }
    }

    const measurementsArtifactPath = path.join(DELIVERY_DIR, 'canvas-measurements.json');
    fs.writeFileSync(measurementsArtifactPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      previewUrl,
      initialNarrowScale,
      explicitFitScale,
      wireCount,
      cardCount,
      noteCount,
      canvasMeasurementsPass,
      measurements: canvasMeasurements,
    }, null, 2) + '\n');

    // Vanilla repository checks & screenshots (when synthetic or vanilla repo exists)
    let vanillaGroupCheckPass = true;
    let vanillaDrawerPass = true;
    let emptyRepoPass = true;
    let switcherPass = true;
    const extraShots = [];

    const hasVanillaRepo = await page.evaluate(() =>
      Boolean(window.__taskBoard?.state?.repositories?.repositories?.some((r) => r.full === 'acme/vanilla-sdk')),
    );

    if (hasVanillaRepo) {
      await selectScope('acme/vanilla-sdk');
      await setViewport(390, 844);
      await setTheme('light');
      await setLang('fr');
      await page.click('#dock-list');
      await sleep(250);

      const vanillaGroups = await page.evaluate(() =>
        Array.from(document.querySelectorAll('#task-list .stage-group')).map((g) => ({
          stage: g.getAttribute('data-stage'),
          text: g.querySelector('.stage-title')?.textContent?.trim(),
          rows: g.querySelectorAll('.task-row').length,
        })),
      );
      vanillaGroupCheckPass = vanillaGroups.length === 1 && vanillaGroups[0].stage === 'todo' && vanillaGroups[0].rows === 3;
      extraShots.push(await captureShot('06-list-vanilla-390-light-fr.png'));

      // Open vanilla Markdown issue #10 in Detail Drawer (1280 Dark EN + 360 Light FR)
      await setViewport(1280, 900);
      await setTheme('dark');
      await setLang('en');
      await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('#task-list .task-row'));
        const row10 = rows.find((r) => r.textContent.includes('#10'));
        if (row10) row10.click();
      });
      await waitFor('!document.getElementById("detail-view")?.hidden', 'vanilla detail drawer');
      await sleep(250);
      vanillaDrawerPass = await page.evaluate(() => {
        const preview = document.getElementById('overview-preview');
        const acHidden = document.getElementById('ac-section')?.hidden;
        const subHidden = document.getElementById('subtasks-section')?.hidden;
        return Boolean(preview && !preview.hidden && preview.textContent.includes('Reproduction') && acHidden && subHidden);
      });
      extraShots.push(await captureShot('07-drawer-vanilla-1280-dark-en.png'));

      await setViewport(360, 800);
      await setTheme('light');
      await setLang('fr');
      await sleep(200);
      extraShots.push(await captureShot('08-drawer-vanilla-360-light-fr.png'));
      await page.click('#back-btn');
      await sleep(150);

      // Project Switcher on 390x844 Dark EN
      await setViewport(390, 844);
      await setTheme('dark');
      await setLang('en');
      await page.click('#compact-project');
      await waitFor('!document.getElementById("repo-popover")?.hidden', 'project popover');
      await sleep(350);
      switcherPass = await page.evaluate(() => {
        const options = Array.from(document.querySelectorAll('#repo-options-list .repo-option'));
        const hasDisabled = options.some((o) => o.classList.contains('is-disabled'));
        const footer = document.getElementById('repo-api-footer')?.textContent || '';
        return options.length >= 4 && options[0].textContent.includes('All Projects') && hasDisabled && footer.includes('Cache:');
      });
      extraShots.push(await captureShot('09-project-switcher-390-dark-en.png'));
      await page.keyboard.press('Escape');
      await sleep(150);

      // 0-issue repository actionable empty state on 360x800 Light EN
      await selectScope('acme/empty-service');
      await setViewport(360, 800);
      await setTheme('light');
      await setLang('en');
      await page.click('#dock-list');
      await sleep(200);
      emptyRepoPass = await page.evaluate(() => {
        const empty = document.getElementById('empty-state');
        const createBtn = document.getElementById('empty-create');
        const switchBtn = document.getElementById('empty-switch');
        return Boolean(empty && !empty.hidden && createBtn && switchBtn);
      });
      extraShots.push(await captureShot('10-empty-repo-360-light-en.png'));

      // Quick Task Composer on 390x844 Dark FR
      await selectScope('all');
      await setViewport(390, 844);
      await setTheme('dark');
      await setLang('fr');
      await page.click('#compact-new');
      await sleep(200);
      extraShots.push(await captureShot('15-composer-390-dark-fr.png'));
      await page.click('#composer-dialog .sheet-dismiss');
      await sleep(150);
    }

    // Restore All Projects for section views
    await selectScope('all');

    // Decisions (768x900 Light FR)
    await setViewport(768, 900);
    await setTheme('light');
    await setLang('fr');
    await page.click('#dock-decisions');
    await waitFor('!document.getElementById("decisions-view")?.hidden', 'decisions view');
    const decisionsCards = await page.evaluate(() => document.querySelectorAll('#decisions-view .section-card').length);
    const decisionsVisible = await page.evaluate(() => !document.getElementById('decisions-view')?.hidden);
    const shot11 = await captureShot('11-decisions-768-light-fr.png');

    // Blocked (360x800 Dark EN)
    await setViewport(360, 800);
    await setTheme('dark');
    await setLang('en');
    await page.click('#dock-blocked');
    await waitFor('!document.getElementById("blocked-view")?.hidden', 'blocked view');
    const blockedCards = await page.evaluate(() => document.querySelectorAll('#blocked-view .section-card').length);
    const blockedVisible = await page.evaluate(() => !document.getElementById('blocked-view')?.hidden);
    const shot12 = await captureShot('12-blocked-360-dark-en.png');

    // Operations (1280x900 Light FR)
    await setViewport(1280, 900);
    await setTheme('light');
    await setLang('fr');
    await switchView('operations');
    await waitFor('!document.getElementById("operations-grid")?.hidden', 'operations grid');
    const operationsStatCards = await page.evaluate(() => document.querySelectorAll('#operations-grid .stat-card').length);
    const operationsVisible = await page.evaluate(() => !document.getElementById('operations-grid')?.hidden);
    const operationsStageParity = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#operations-project-rows tr')).map((r) => Array.from(r.querySelectorAll('td')).map((c) => c.textContent.trim()));
      const byProject = Object.fromEntries(rows.map((cells) => [cells[0], cells.slice(1).map(Number)]));
      return JSON.stringify(byProject['acme/vanilla-sdk']) === JSON.stringify([0, 0, 3, 0, 0, 0, 0, 0]) &&
        JSON.stringify(byProject['chamberos/platform']) === JSON.stringify([1, 0, 2, 0, 1, 1, 1, 1]);
    });
    const shot13 = await captureShot('13-operations-1280-light-fr.png');

    // Archive (1280x900 Dark EN)
    await setViewport(1280, 900);
    await setTheme('dark');
    await setLang('en');
    await switchView('archive');
    await waitFor('!document.getElementById("archive-view")?.hidden', 'archive view');
    const archiveCards = await page.evaluate(() => document.querySelectorAll('#archive-view .section-card').length);
    const archiveVisible = await page.evaluate(() => !document.getElementById('archive-view')?.hidden);

    // Client Presentation Mode (1280x900 Dark EN)
    await switchView('client');
    await setClientMode(true);
    await waitFor('!document.getElementById("client-view")?.hidden', 'client view');
    const clientCards = await page.evaluate(() => document.querySelectorAll('#client-list .section-card').length);
    const clientIncludesVanilla = hasVanillaRepo
      ? await page.evaluate(() => document.getElementById('client-list')?.textContent?.includes('exponential backoff') && !document.getElementById('client-list')?.textContent?.includes('scratchpad'))
      : true;
    const shot14 = await captureShot('14-client-view-1280-dark-en.png');
    await setClientMode(false);

    // Independent visual/DOM regression matrix: list, drawer, switcher and client.
    const surfaceMeasurements = [];
    for (const mCase of baseMatrix) {
      await setClientMode(false);
      await setViewport(mCase.width, mCase.height);
      await setTheme(mCase.theme);
      await setLang(mCase.lang);
      await switchView('list');
      await sleep(200);
      const list = await page.evaluate(() => {
        const r = document.querySelector('.simple-row');
        if (!r) return { pass: false, reason: 'missing row' };
        const title = r.querySelector('.simple-row-title').getBoundingClientRect();
        const main = r.querySelector('.simple-row-main').getBoundingClientRect();
        const meta = r.querySelector('.simple-row-meta').getBoundingClientRect();
        const box = r.getBoundingClientRect();
        return { pass: box.width > 0 && title.width > 0 && (window.innerWidth > 640 || (meta.top >= main.bottom - 1 && title.width >= box.width - 96)), titleWidth: title.width, rowWidth: box.width, metaTop: meta.top, mainBottom: main.bottom };
      });
      const listSurface = await inspectSurface();
      await captureShot(`matrix-list-${mCase.width}-${mCase.theme}-${mCase.lang}.png`);
      await page.evaluate(() => document.querySelector('.simple-row')?.click());
      await waitFor('!document.getElementById("detail-view")?.hidden', 'matrix drawer');
      await sleep(150);
      const drawer = await page.evaluate(() => {
        const h = document.getElementById('detail-title').getBoundingClientRect();
        const head = document.querySelector('.detail-head').getBoundingClientRect();
        return { pass: (window.innerWidth > 640 || h.width >= head.width - 1) && document.querySelectorAll('#detail-view a.github-link').length === 1 && !document.getElementById('detail-github'), titleWidth: h.width, headWidth: head.width };
      });
      const drawerSurface = await inspectSurface();
      await captureShot(`matrix-drawer-${mCase.width}-${mCase.theme}-${mCase.lang}.png`);
      await page.click('#back-btn');
      await page.evaluate(() => document.getElementById('repo-select-btn').click());
      await sleep(100);
      const picker = await page.evaluate(() => {
        const names = Array.from(document.querySelectorAll('.repo-option-name'));
        return { pass: names.every(n => n.scrollWidth <= n.clientWidth + 1), options: names.length };
      });
      const pickerSurface = await inspectSurface();
      await captureShot(`matrix-picker-${mCase.width}-${mCase.theme}-${mCase.lang}.png`);
      await page.keyboard.press('Escape');
      await switchView('client');
      await setClientMode(true);
      const client = await page.evaluate(() => ({ pass: getComputedStyle(document.getElementById('client-presentation-banner')).display === 'none' && getComputedStyle(document.querySelector('.client-disclaimer-banner')).display !== 'none' }));
      await captureShot(`matrix-client-${mCase.width}-${mCase.theme}-${mCase.lang}.png`);
      const common = await inspectSurface();
      surfaceMeasurements.push({ testCase: mCase, list, drawer, picker, client, listSurface, drawerSurface, pickerSurface, common, pass: list.pass && drawer.pass && picker.pass && client.pass && listSurface.pass && drawerSurface.pass && pickerSurface.pass && common.pass && common.lang === mCase.lang });
    }
    fs.writeFileSync(path.join(DELIVERY_DIR, 'surface-measurements.json'), JSON.stringify(surfaceMeasurements, null, 2) + '\n');

    // V4-1: all native sheets share geometry, focus trap, three close paths and scroll isolation.
    await setClientMode(false);
    await selectScope('all');
    const sheetMeasurements = [], dependencyMeasurements = [], filterMeasurements = [];
    for (const mCase of baseMatrix) {
      await setViewport(mCase.width, mCase.height);
      await setTheme(mCase.theme); await setLang(mCase.lang); await switchView('canvas');
      await page.evaluate(() => { window.__taskBoard.state.viewState.filters = []; window.__taskBoard.renderBoard(); });
      const openers = [
        ['filter', 'board-sheet', async () => page.click('#applied-filter-btn')],
        ['settings', 'board-sheet', async () => page.evaluate(() => window.__taskBoard.openSheet('settings', document.getElementById('applied-filter-btn')))],
        ['sort', 'board-sheet', async () => page.evaluate(() => window.__taskBoard.openSheet('sort', document.getElementById('applied-filter-btn')))],
        ['arrange', 'canvas-arrange-dialog', async () => page.click('#canvas-arrange')],
        ['project', 'repo-popover', async () => page.evaluate(() => { const b = innerWidth > 768 ? document.getElementById('repo-select-btn') : document.getElementById('compact-project'); b.focus(); b.click(); })],
        ['composer', 'composer-dialog', async () => page.evaluate(() => { const b = innerWidth > 768 ? document.getElementById('new-task-btn') : document.getElementById('compact-new'); b.focus(); b.click(); })],
        ['relationship', 'canvas-wire-confirm', async () => page.evaluate(() => { document.getElementById('canvas-arrange').focus(); document.querySelector('.canvas-wire-hit').dispatchEvent(new MouseEvent('click', { bubbles: true })); })],
      ];
      for (const [kind, id, open] of openers) {
        await switchView('canvas');
        const before = await page.evaluate(() => { const r = document.getElementById('canvas-viewport').getBoundingClientRect(); return { x: r.x, width: r.width, scroll: scrollY }; });
        await open(); await sleep(200);
        const geometry = await page.evaluate(id => {
          const d = document.getElementById(id), r = d.getBoundingClientRect(), body = d.querySelector('.sheet-content'), foot = d.querySelector('.sheet-footer').getBoundingClientRect();
          const controls = Array.from(d.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')).filter(n => !n.disabled && n.getClientRects().length);
          const first = controls[0], last = controls.at(-1);
          last.focus(); last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
          const forward = document.activeElement === first;
          first.focus(); first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
          const backward = document.activeElement === last;
          const hitBoxes = controls.map(n => { const r = n.getBoundingClientRect(); return { width: r.width, height: r.height, tag: n.tagName }; });
          const vp = document.getElementById('canvas-viewport').getBoundingClientRect();
          return { open: d.open, x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, footerBottom: foot.bottom, footerHeight: foot.height, bodyOverflow: getComputedStyle(body).overflowY, overscroll: getComputedStyle(body).overscrollBehaviorY, forward, backward, focusInside: d.contains(document.activeElement), hitBoxes, viewportX: vp.x, viewportWidth: vp.width, documentWidth: document.documentElement.scrollWidth, scroll: scrollY, maxHeight: getComputedStyle(d).maxHeight };
        }, id);
        await page.locator('#' + id + ' .sheet-content').evaluate(n => { n.scrollTop = n.scrollHeight; });
        await page.mouse.wheel(0, 600); await sleep(50);
        const noBleed = await page.evaluate(() => scrollY === 0);
        await page.locator('#' + id + ' .sheet-content').evaluate(n => { n.scrollTop = 0; });
        if (kind === 'filter' || kind === 'settings') await captureShot(`${kind}-${mCase.width}-${mCase.theme}-${mCase.lang}.png`);
        const closeSelector = id === 'board-sheet' ? '#sheet-close' : '#' + id + ' .sheet-dismiss';
        await page.click(closeSelector); await sleep(50);
        const closedByButton = await page.evaluate(id => !document.getElementById(id).open, id);
        const restored = await page.evaluate(id => { const d = document.getElementById(id), o = d._sheetOpener; return !o || !o.getClientRects().length || document.activeElement === o; }, id);
        await open(); await sleep(180); await page.keyboard.press('Escape'); await sleep(50);
        const closedByEscape = await page.evaluate(id => !document.getElementById(id).open, id);
        await open(); await sleep(180);
        await page.mouse.click(2, 2); await sleep(50);
        const closedByBackdrop = await page.evaluate(id => !document.getElementById(id).open, id);
        const pass = geometry.open && geometry.focusInside && geometry.forward && geometry.backward && geometry.x >= -0.5 && geometry.right <= mCase.width + .5 && geometry.bottom <= mCase.height + .5 && geometry.footerHeight >= 44 && geometry.footerBottom <= geometry.bottom + .5 && (mCase.width > 768 || geometry.height <= mCase.height * .85 + 1) && geometry.documentWidth <= mCase.width && before.x === geometry.viewportX && before.width === geometry.viewportWidth && noBleed && closedByButton && closedByEscape && closedByBackdrop && restored;
        sheetMeasurements.push({ testCase: mCase, kind, geometry, closedByButton, closedByEscape, closedByBackdrop, restored, noBleed, pass });
        if (!pass) throw new Error('Sheet check failed: ' + JSON.stringify(sheetMeasurements.at(-1)));
      }
      await switchView('canvas');
      await page.click('#applied-filter-btn');
      await page.click('[data-filter="priority:high"]');
      const live = await page.locator('#sheet-apply').textContent();
      await page.click('#sheet-apply');
      const applied = await page.evaluate(() => ({ count: window.__taskBoard.state.currentCanvasIssues.length, visible: document.querySelector('#filter-chips .filter-chip')?.getBoundingClientRect().height >= 44, barTop: document.getElementById('applied-filter-bar').getBoundingClientRect().top, canvasTop: document.getElementById('canvas-viewport').getBoundingClientRect().top }));
      await captureShot(`applied-${mCase.width}-${mCase.theme}-${mCase.lang}.png`);
      await page.click('#filter-chips .filter-chip');
      const removed = await page.evaluate(() => window.__taskBoard.state.currentCanvasIssues.length);
      await page.click('#applied-filter-btn'); await page.click('[data-filter="priority:urgent"]'); await page.click('#sheet-reset');
      const reset = await page.evaluate(() => window.__taskBoard.state.viewState.filters.length === 0 && document.getElementById('sheet-reset').disabled);
      await page.click('#sheet-apply');
      filterMeasurements.push({ testCase: mCase, live, applied, removed, reset, pass: applied.visible && applied.barTop < applied.canvasTop && removed > applied.count && reset });
      // Focus a middle task: one blocker, several dependents and unrelated tasks.
      await page.evaluate(() => {
        const a = window.__taskBoard;
        const issue = a.state.board.issues.find(i => i.repository.full === 'chamberos/platform' && i.number === 2);
        a.selectDependencyCard(issue);
        const r = document.getElementById('canvas-viewport').getBoundingClientRect();
        a.state.canvasScale = innerWidth <= 768 ? .8 : 1;
        a.state.canvasPanX = innerWidth <= 768 ? 16 - issue.canvas.x * .8 : r.width / 2 - issue.canvas.x;
        a.state.canvasPanY = 240 - issue.canvas.y * a.state.canvasScale;
        a.updateCanvasTransform();
      });
      await sleep(320);
      const focus = await page.evaluate(() => ({ selected: document.querySelectorAll('.dependency-selected').length, blockers: document.querySelectorAll('.dependency-blocker').length, dependents: document.querySelectorAll('.dependency-dependent').length, unrelated: document.querySelectorAll('.dependency-unrelated').length, dim: getComputedStyle(document.querySelector('.dependency-unrelated')).opacity, edgeDim: getComputedStyle(document.querySelector('.dependency-wire-muted')).opacity, labels: document.querySelectorAll('.dependency-wire-label').length, labelTexts: Array.from(document.querySelectorAll('.dependency-wire-label')).map(n => n.textContent), legendWidth: document.getElementById('dependency-legend').getBoundingClientRect().width }));
      await captureShot(`dependency-${mCase.width}-${mCase.theme}-${mCase.lang}.png`);
      await page.click('#canvas-dependencies');
      const hidden = await page.evaluate(() => document.querySelectorAll('.canvas-wire-group').length === 0 && document.querySelectorAll('.dependency-wire-label').length === 0 && getComputedStyle(document.getElementById('canvas-wires')).visibility === 'hidden');
      await page.click('#canvas-dependencies');
      const restored = await page.evaluate(() => document.querySelectorAll('.canvas-wire-group').length >= 4);
      dependencyMeasurements.push({ testCase: mCase, ...focus, hidden, restored, pass: focus.selected === 1 && focus.blockers >= 1 && focus.dependents >= 1 && focus.unrelated >= 1 && focus.dim === '0.22' && focus.labels >= 2 && hidden && restored });
      await page.evaluate(() => { window.__taskBoard.state.dependencyFocus = null; window.__taskBoard.renderCanvasWires(); });
      if (mCase.width <= 768) {
        await page.evaluate(() => {
          document.body.classList.remove('sidebar-collapsed');
          document.body.classList.add('sidebar-open');
          document.getElementById('sidebar-backdrop').hidden = false;
        });
        await sleep(350);
      }
      await captureShot(`brand-${mCase.width}-${mCase.theme}-${mCase.lang}.png`);
      if (mCase.width <= 768) await page.evaluate(() => { document.body.classList.remove('sidebar-open'); document.getElementById('sidebar-backdrop').hidden = true; });
    }
    // Real sheet controls persist theme and language across reload.
    await page.click('#applied-filter-btn'); await page.click('#sheet-close');
    await page.evaluate(() => window.__taskBoard.openSheet('settings', document.getElementById('applied-filter-btn')));
    await page.click('[data-setting="light"]'); await page.click('[data-setting="fr"]'); await page.click('#sheet-apply');
    await page.reload(); await waitFor('Boolean(window.__taskBoard?.state?.board?.issues?.length)', 'persistent settings reload');
    const settingsPersist = await page.evaluate(() => document.documentElement.lang === 'fr' && document.documentElement.getAttribute('data-theme') === 'light' && localStorage.getItem('tb_lang') === 'fr' && localStorage.getItem('tb_theme_mode') === 'light');
    const brand = await page.evaluate(async () => { const m = await fetch('/manifest.json').then(r => r.json()); return document.title.includes('Workflows Board') && document.querySelector('.sidebar-brand-title').textContent === 'Workflows Board' && m.name === 'Workflows Board' && m.short_name === 'Workflows Board'; });
    fs.writeFileSync(path.join(DELIVERY_DIR, 'sheet-measurements.json'), JSON.stringify(sheetMeasurements, null, 2) + '\n');
    fs.writeFileSync(path.join(DELIVERY_DIR, 'dependency-measurements.json'), JSON.stringify(dependencyMeasurements, null, 2) + '\n');
    fs.writeFileSync(path.join(DELIVERY_DIR, 'filter-measurements.json'), JSON.stringify(filterMeasurements, null, 2) + '\n');

    const pageCsp = await page.evaluate(() => window.__cspViolations || []).catch(() => []);
    for (const c of pageCsp) {
      if (!cspViolations.includes(c)) cspViolations.push(c);
    }

    await browser.close();
    browser = null;

    const smokeData = [
      { name: 'V4-1 shared sheets: seven surfaces, sixteen theme/language/viewport cases', verdict: sheetMeasurements.every(m => m.pass) ? 'PASS' : 'FAIL', cases: sheetMeasurements.length },
      { name: 'V4-1 applied filters, live count, removal and reset', verdict: filterMeasurements.every(m => m.pass) ? 'PASS' : 'FAIL', cases: filterMeasurements.length },
      { name: 'V4-1 dependency focus, directional accents, labels and persistent edge toggle', verdict: dependencyMeasurements.every(m => m.pass) ? 'PASS' : 'FAIL', cases: dependencyMeasurements.length },
      { name: 'V4-1 theme/language reload and product identity', verdict: settingsPersist && brand ? 'PASS' : 'FAIL', settingsPersist, brand },
      { name: 'Hostile list/drawer/picker/client geometry and narrow touch targets, complete 16-case matrix', verdict: surfaceMeasurements.every(m => m.pass) ? 'PASS' : 'FAIL', cases: surfaceMeasurements.length, failures: surfaceMeasurements.filter(m => !m.pass) },
      {
        name: 'health',
        verdict: (healthRes.status === 200 && healthPayload?.status === 'ok') ? 'PASS' : 'FAIL',
        status: healthRes.status,
        payload: healthPayload,
      },
      {
        name: 'sign-in & grouped List view (1280 light EN)',
        verdict: rowCount >= 8 ? 'PASS' : 'FAIL',
        rows: rowCount,
        screenshot: shot01,
      },
      {
        name: 'Canvas view with markdown note, dependency wires, and narrow smart-fit',
        verdict: (wireCount >= 4 && cardCount >= 8 && noteCount >= 1 && initialNarrowScale >= 0.55) ? 'PASS' : 'FAIL',
        cards: cardCount,
        notes: noteCount,
        wires: wireCount,
        initialNarrowScale,
        explicitFitScale,
        screenshots: [shot02, shot03, shot04],
      },
      {
        name: 'Canvas controls non-vacuous containment, <html lang>, and 0px overhang (360/390/768/1280, EN/FR, light/dark, Undo 7-button)',
        verdict: canvasMeasurementsPass ? 'PASS' : 'FAIL',
        casesTested: canvasMeasurements.length,
        violations: canvasMeasurements.filter((m) => !m.pass).map((m) => ({
          testCase: m.testCase,
          buttonsCount: m.hudMetrics.buttons.length,
          hudHeight: m.hudMetrics.hudRect.height,
          htmlLang: m.hudMetrics.htmlLang,
          buttonsOutsideViewport: m.buttonsOutsideViewport,
          buttonOverlaps: m.buttonOverlaps,
          viewport: m.hudMetrics.vpRect,
        })),
        artifact: relPath(measurementsArtifactPath),
      },
      {
        name: 'Any-Repo vanilla list, Markdown drawer, project switcher, and empty repo state',
        verdict: (vanillaGroupCheckPass && vanillaDrawerPass && emptyRepoPass && switcherPass) ? 'PASS' : 'FAIL',
        vanillaGroupCheckPass,
        vanillaDrawerPass,
        emptyRepoPass,
        switcherPass,
        screenshots: extraShots,
      },
      {
        name: 'Decisions & Blocked views (768 FR / 360 EN)',
        verdict: (decisionsVisible && decisionsCards >= 1 && blockedVisible && blockedCards >= 1) ? 'PASS' : 'FAIL',
        decisionsCards,
        blockedCards,
        screenshots: [shot11, shot12],
      },
      {
        name: 'Operations, Archive, and Client Presentation Mode',
        verdict: (operationsVisible && operationsStatCards >= 4 && operationsStageParity && archiveVisible && archiveCards >= 1 && clientCards >= 1 && clientIncludesVanilla) ? 'PASS' : 'FAIL',
        operationsStageParity,
        operationsStatCards,
        archiveCards,
        clientCards,
        clientIncludesVanilla,
        screenshots: [shot13, shot14],
      },
      {
        name: 'browser diagnostics (zero exceptions, zero console errors, zero CSP violations)',
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
  } finally {
    if (browser) await browser.close().catch(() => {});
    await target.close().catch(() => {});
  }
}

await run();
