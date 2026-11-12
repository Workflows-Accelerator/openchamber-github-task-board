// V4-1b verification: dependency framing, edge-label clamping, filter framing,
// the single phone filter entry point and the focus exit wording.
//
// Real Chromium against a synthetic preview. Everything is measured from the
// live DOM; no measurement is taken from the source text.
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
const DELIVERY_DIR = process.env.DELIVERY_DIR || path.resolve(ROOT_DIR, '.agents/run/chamberos-board-v2/verifications/V4-1b');
const SCREENSHOTS_DIR = path.resolve(DELIVERY_DIR, 'screenshots');
const CHROME_PATH = process.env.H2_CHROME || '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const FOCUSED = 'chamberos/platform#2';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createPreview() {
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
            body: '<!-- board-canvas: {"x":80,"y":90} -->\n## Overview\nCoordinate edge session verification.',
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
            labels: ['status:in-review', 'priority:high'],
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
            labels: ['status:draft', 'priority:high'],
            updated_at: '2026-11-07T09:00:00Z',
          }),
        ],
      },
      {
        repo: 'acme/vanilla-sdk',
        id: 102,
        hasIssues: true,
        issues: [
          makeIssue({
            number: 11,
            repo: 'acme/vanilla-sdk',
            title: 'Document TypeScript pagination iterator types',
            body: '<!-- board-canvas: {"x":460,"y":560} -->\nAdd clean examples for `for await (const page of client.paginate())` in README.',
            labels: ['priority:low'],
            updated_at: '2026-11-10T09:45:00Z',
          }),
        ],
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

// Read straight from the rendered DOM: card and label rectangles in browser
// coordinates, compared with the canvas viewport rectangle.
function readCanvasInPage() {
  const round = (n) => Math.round(n * 10) / 10;
  const vpEl = document.getElementById('canvas-viewport');
  const vp = vpEl.getBoundingClientRect();
  const app = window.__taskBoard;
  const st = app.state;
  const roles = ['selected', 'blocker', 'dependent', 'unrelated'];
  const inside = (r) => r.left >= vp.left - 0.5 && r.right <= vp.right + 0.5 && r.top >= vp.top - 0.5 && r.bottom <= vp.bottom + 0.5;
  const cards = Array.from(document.querySelectorAll('.canvas-card')).map((card) => {
    const r = card.getBoundingClientRect();
    return {
      key: card.getAttribute('data-issue-key'),
      role: roles.find((name) => card.classList.contains('dependency-' + name)) || null,
      rect: { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height) },
      insideViewport: inside(r),
    };
  });
  const labels = Array.from(document.querySelectorAll('.dependency-wire-label')).map((label) => {
    const r = label.getBoundingClientRect();
    return {
      text: label.textContent,
      rect: { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height) },
      insideViewport: inside(r),
      renderedHeightPx: round(r.height),
      cssFontPx: parseFloat(getComputedStyle(label).fontSize),
    };
  });
  const legend = document.getElementById('dependency-legend');
  const hudNode = document.getElementById('canvas-controls');
  const hud = hudNode && hudNode.getClientRects().length ? (() => {
    const r = hudNode.getBoundingClientRect();
    return { rect: { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height) }, visible: r.width > 0 && r.height > 0 };
  })() : null;
  const entry = (id) => {
    const node = document.getElementById(id);
    if (!node) return { id, present: false, visible: false };
    const r = node.getBoundingClientRect();
    const s = getComputedStyle(node);
    return { id, present: true, visible: r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden', text: (node.textContent || '').replace(/\s+/g, ' ').trim() };
  };
  return {
    viewport: { x: round(vp.x), y: round(vp.y), w: round(vp.width), h: round(vp.height) },
    zoom: Math.round(st.canvasScale * 1000) / 1000,
    pan: { x: round(st.canvasPanX), y: round(st.canvasPanY) },
    cards,
    labels,
    neighbourhood: cards.filter((c) => c.role && c.role !== 'unrelated').map((c) => c.key),
    canvasIssueCount: (st.currentCanvasIssues || []).length,
    boardIssueCount: ((st.board && st.board.issues) || []).length,
    appliedFilters: (st.viewState.filters || []).slice(),
    dependencyFocus: st.dependencyFocus,
    legend: legend ? { hidden: legend.hidden, text: (legend.textContent || '').replace(/\s+/g, ' ').trim() } : null,
    hud,
    filterEntries: [entry('compact-filter'), entry('filter-btn'), entry('applied-filter-btn')],
  };
}

async function run() {
  const preview = await createPreview();
  let browser;
  const cases = [];
  const reducedMotion = [];
  const consoleProblems = [];
  let cspViolations = [];

  try {
    console.log(`Synthetic preview ready at ${preview.url}`);
    browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

    await context.addInitScript(() => {
      window.__cspViolations = [];
      window.addEventListener('securitypolicyviolation', (e) => {
        window.__cspViolations.push(e.blockedURI || e.violatedDirective || 'csp-violation');
      });
    });

    const page = await context.newPage();
    page.on('pageerror', (err) => consoleProblems.push({ kind: 'pageerror', text: err.message || String(err) }));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleProblems.push({ kind: 'console', text: msg.text() });
    });

    const waitFor = async (fnExpr, label, timeout = 15000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        try {
          if (await page.evaluate(`Boolean(${fnExpr})`)) return true;
        } catch (_) {}
        await sleep(100);
      }
      throw new Error(`Timeout waiting for ${label}`);
    };

    const setViewport = async (w, h) => {
      await page.setViewportSize({ width: w, height: h });
      await sleep(180);
    };

    const setTheme = async (theme) => {
      await page.evaluate((t) => {
        if (window.__taskBoard && window.__taskBoard.setThemeMode) window.__taskBoard.setThemeMode(t);
      }, theme);
      await sleep(150);
    };

    const setLang = async (lang) => {
      await page.evaluate((target) => {
        const current = localStorage.getItem('tb_lang') || 'en';
        if (current !== target) {
          const btn = document.getElementById('lang-switch-btn');
          if (btn) btn.click();
        }
      }, lang);
      await sleep(250);
    };

    const switchView = async (view) => {
      await page.evaluate((target) => {
        const btn = document.getElementById(`nav-${target}`);
        if (btn) btn.click();
      }, view);
      await sleep(300);
    };

    const captureShot = async (filename, clip) => {
      const outPath = path.join(SCREENSHOTS_DIR, filename);
      await page.screenshot({ path: outPath, ...(clip ? { clip } : {}) });
      return { file: path.join('screenshots', filename), bytes: fs.statSync(outPath).size };
    };

    const selectFocusedIssue = async () => page.evaluate((key) => {
      const app = window.__taskBoard;
      const issue = app.state.board.issues.find((i) => {
        const full = i.repository ? (i.repository.full || i.repository) : '';
        return String(full + '#' + i.number).toLowerCase() === key;
      });
      if (!issue) throw new Error('focused issue missing');
      app.selectDependencyCard(issue);
    }, FOCUSED);

    console.log('Signing in...');
    await page.goto(preview.url);
    await waitFor('document.getElementById("login-form")', 'login form');
    await page.evaluate((pwd) => {
      const input = document.getElementById('password');
      input.value = pwd;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('login-form').requestSubmit();
    }, BOARD_PASSWORD);
    await waitFor('!document.getElementById("board-view")?.hidden', 'board view');
    await waitFor('Boolean(window.__taskBoard?.state?.board?.issues?.length >= 6)', 'board loaded');

    // All Projects, so the cross-repository dependent (#11) is on the canvas too.
    await page.evaluate(() => {
      const options = Array.from(document.querySelectorAll('#repo-options-list .repo-option'));
      if (options[0]) options[0].click();
    });
    await waitFor('window.__taskBoard?.state?.selected === "all" && !window.__taskBoard?.state?.boardLoad', 'scope all');

    const matrix = [];
    for (const width of [360, 390, 768, 1280]) {
      const height = width <= 390 ? 800 : 900;
      for (const theme of ['light', 'dark']) {
        for (const lang of ['en', 'fr']) matrix.push({ width, height, theme, lang });
      }
    }

    for (const mCase of matrix) {
      const tag = `${mCase.width}-${mCase.theme}-${mCase.lang}`;
      console.log(`Case ${tag}`);
      await setViewport(mCase.width, mCase.height);
      await setTheme(mCase.theme);
      await setLang(mCase.lang);
      await switchView('canvas');
      await waitFor('document.querySelectorAll(".canvas-card").length >= 6', `cards ${tag}`);
      await waitFor('document.querySelectorAll(".canvas-wire-group").length >= 4', `wires ${tag}`);

      // Known starting viewport: the same 100% / 60,60 origin a user lands on.
      await page.evaluate(() => window.__taskBoard.resetCanvasView());
      await sleep(150);
      const starting = await page.evaluate(readCanvasInPage);

      // M1 before: select Dependencies, then cancel the fit so the unframed
      // focus state the manager saw is what the screenshot shows.
      await selectFocusedIssue();
      await page.evaluate(() => window.__taskBoard.resetCanvasView());
      await sleep(150);
      const focusBefore = await page.evaluate(readCanvasInPage);
      const shotBefore = await captureShot(`focus-before-${tag}.png`);

      // Leave focus, then take a fresh selection so the fit runs for real.
      await page.evaluate(() => window.__taskBoard.clearDependencyFocus());
      await sleep(400);
      await page.evaluate(() => window.__taskBoard.resetCanvasView());
      await sleep(150);
      await selectFocusedIssue();
      await sleep(520);
      const focusAfter = await page.evaluate(readCanvasInPage);
      const shotAfter = await captureShot(`focus-after-fit-${tag}.png`);
      let shotLegend = null;
      const legendBox = await page.evaluate(({ width, height }) => {
        const node = document.getElementById('dependency-legend');
        if (!node || node.hidden) return null;
        const r = node.getBoundingClientRect();
        return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: Math.min(width, r.width + 8), height: Math.min(height, r.height + 8) };
      }, { width: mCase.width, height: mCase.height });
      if (legendBox) shotLegend = await captureShot(`m5-legend-${tag}.png`, legendBox);
      const m5 = await page.evaluate(() => {
        const legend = document.getElementById('dependency-legend');
        const btn = legend ? legend.querySelector('.legend-head button') : null;
        return btn ? { text: btn.textContent, ariaLabel: btn.getAttribute('aria-label') } : null;
      });

      // Exit restores the pre-focus viewport.
      await page.click('#dependency-legend .legend-head button');
      await sleep(520);
      const restored = await page.evaluate(readCanvasInPage);
      const shotRestored = await captureShot(`focus-exit-restored-${tag}.png`);

      // M3: apply a filter and measure the framing of the matches.
      await page.click('#applied-filter-btn');
      await page.click('[data-filter="priority:high"]');
      await page.click('#sheet-apply');
      await sleep(520);
      const filtered = await page.evaluate(readCanvasInPage);
      const shotFiltered = await captureShot(`filter-applied-framed-${tag}.png`);

      // M4: which filter entry points are actually on screen at this width.
      const m4 = await page.evaluate(readCanvasInPage);
      const shotEntry = await captureShot(`m4-entry-points-${tag}.png`, { x: 0, y: 0, width: mCase.width, height: Math.min(72, mCase.height) });

      // Remove the filter again so the next case starts clean.
      await page.evaluate(() => {
        const chip = document.querySelector('#filter-chips .filter-chip');
        if (chip) chip.click();
      });
      await sleep(400);

      const neighbourhoodCards = focusAfter.cards.filter((c) => c.role && c.role !== 'unrelated');
      const blockers = neighbourhoodCards.filter((c) => c.role === 'blocker');
      const dependents = neighbourhoodCards.filter((c) => c.role === 'dependent');
      const matchingCards = filtered.cards.filter((c) => c.role === null || c.role === 'unrelated');
      const visibleFilterEntries = m4.filterEntries.filter((entry) => entry.visible);
      const overlapsHud = (rect, hudInfo) => {
        if (!hudInfo || !hudInfo.visible) return false;
        const h = hudInfo.rect;
        return rect.x < h.x + h.w && rect.x + rect.w > h.x && rect.y < h.y + h.h && rect.y + rect.h > h.y;
      };
      const cardsUnderHud = focusAfter.cards.filter((c) => c.role && c.role !== 'unrelated' && overlapsHud(c.rect, focusAfter.hud));
      const filteredUnderHud = filtered.cards.filter((c) => overlapsHud(c.rect, filtered.hud));

      const pass = neighbourhoodCards.length === 4
        && blockers.length >= 1
        && dependents.length >= 2
        && neighbourhoodCards.every((c) => c.insideViewport)
        && focusAfter.labels.length >= 2
        && focusAfter.labels.every((l) => l.insideViewport)
        && Math.abs(restored.zoom - starting.zoom) < 0.02
        && Math.abs(restored.pan.x - starting.pan.x) < 2
        && Math.abs(restored.pan.y - starting.pan.y) < 2
        && filtered.canvasIssueCount === 3
        && filtered.cards.length === 3
        && filtered.cards.every((c) => c.insideViewport)
        && cardsUnderHud.length === 0
        && filteredUnderHud.length === 0
        && m4.filterEntries.find((entry) => entry.id === 'compact-filter').present === false
        && (mCase.width > 768
          ? visibleFilterEntries.length >= 1
          : visibleFilterEntries.length === 1 && visibleFilterEntries[0].id === 'applied-filter-btn');

      cases.push({
        case: mCase,
        starting,
        focusBefore,
        focusAfter,
        restored,
        filtered,
        m4,
        m5,
        screenshots: { before: shotBefore, after: shotAfter, legend: shotLegend, restored: shotRestored, filtered: shotFiltered, entry: shotEntry },
        checks: {
          neighbourhoodComplete: neighbourhoodCards.length === 4,
          blockerCount: blockers.length,
          dependentCount: dependents.length,
          neighbourhoodInside: neighbourhoodCards.every((c) => c.insideViewport),
          neighbourhoodOutsideBeforeFit: neighbourhoodCards.filter((c) => {
            const before = focusBefore.cards.find((b) => b.key === c.key);
            return before && !before.insideViewport;
          }).map((c) => c.key),
          labelsInside: focusAfter.labels.every((l) => l.insideViewport),
          labelCount: focusAfter.labels.length,
          zoomBefore: starting.zoom,
          zoomAfterFit: focusAfter.zoom,
          zoomRestored: restored.zoom,
          restoredMatchesStart: Math.abs(restored.zoom - starting.zoom) < 0.02
            && Math.abs(restored.pan.x - starting.pan.x) < 2
            && Math.abs(restored.pan.y - starting.pan.y) < 2,
          filteredMatches: filtered.canvasIssueCount,
          filteredAllInside: filtered.cards.every((c) => c.insideViewport),
          appliedFilters: filtered.appliedFilters,
          matchingCardsFramed: matchingCards.length,
          visibleFilterEntries: visibleFilterEntries.map((entry) => entry.id),
          compactFilterPresent: m4.filterEntries.find((entry) => entry.id === 'compact-filter').present,
          cardsUnderHud: cardsUnderHud.map((c) => c.key),
          filteredUnderHud: filteredUnderHud.map((c) => c.key),
          hudHeight: focusAfter.hud ? focusAfter.hud.rect.h : null,
          focusExitWording: m5,
        },
        pass,
      });
      if (!pass) console.log(`  case ${tag} FAILED: ${JSON.stringify(cases.at(-1).checks)}`);
    }

    // Reduced motion: the target is the same, reached without an animation.
    for (const lang of ['en', 'fr']) {
      console.log(`Reduced motion 360 light ${lang}`);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await setViewport(360, 800);
      await setTheme('light');
      await setLang(lang);
      await switchView('canvas');
      await waitFor('document.querySelectorAll(".canvas-card").length >= 6', 'cards reduced motion');
      await page.evaluate(() => window.__taskBoard.resetCanvasView());
      await sleep(150);
      await selectFocusedIssue();
      await sleep(60);
      const immediate = await page.evaluate(readCanvasInPage);
      await sleep(400);
      const settled = await page.evaluate(readCanvasInPage);
      const neighbourhood = settled.cards.filter((c) => c.role && c.role !== 'unrelated');
      reducedMotion.push({
        lang,
        viewport: immediate.viewport,
        zoomAfterOneFrame: immediate.zoom,
        panAfterOneFrame: immediate.pan,
        zoomSettled: settled.zoom,
        neighbourhoodInside: neighbourhood.every((c) => c.insideViewport) && neighbourhood.length === 4,
        labelsInside: settled.labels.every((l) => l.insideViewport),
        movedInstantly: Math.abs(immediate.zoom - settled.zoom) < 0.01
          && Math.abs(immediate.pan.x - settled.pan.x) < 2
          && Math.abs(immediate.pan.y - settled.pan.y) < 2,
        pass: neighbourhood.every((c) => c.insideViewport) && neighbourhood.length === 4
          && settled.labels.every((l) => l.insideViewport)
          && Math.abs(immediate.zoom - settled.zoom) < 0.01,
      });
      await page.evaluate(() => window.__taskBoard.clearDependencyFocus());
      await sleep(200);
    }
    await page.emulateMedia({ reducedMotion: null });

    cspViolations = await page.evaluate(() => window.__cspViolations || []);
    // CSSOM writes (canvas transforms and card offsets) do surface as a style
    // attribute in the live DOM; the V4-1 invariant is about inline style
    // attributes in the shipped source, which is what is checked here.
    const cssomStyledElements = await page.evaluate(() => Array.from(document.querySelectorAll('[style]'))
      .filter((n) => (n.getAttribute('style') || '').trim()).length);
    const sourceInlineStyles = ['web/public/index.html', 'web/public/app.js', 'web/public/theme.css']
      .map((file) => ({ file, count: (fs.readFileSync(path.join(ROOT_DIR, file), 'utf8').match(/\sstyle="/g) || []).length }))
      .filter((entry) => entry.count > 0);
    const bannedWords = await page.evaluate(() => {
      const text = document.body.innerText;
      return { mobile: /\bmobile\b/i.test(text), n8n: /\bn8n\b/i.test(text) };
    });

    const summary = {
      generatedAt: new Date().toISOString(),
      chrome: CHROME_PATH,
      previewUrl: preview.url,
      cases: cases.length,
      casesPassed: cases.filter((c) => c.pass).length,
      reducedMotionPassed: reducedMotion.filter((r) => r.pass).length,
      cspViolations,
      cssomStyledElements,
      sourceInlineStyles,
      bannedWords,
      consoleProblems,
    };

    fs.writeFileSync(path.join(DELIVERY_DIR, 'dependency-framing-measurements.json'), `${JSON.stringify({ summary, cases, reducedMotion }, null, 2)}\n`);
    fs.writeFileSync(path.join(DELIVERY_DIR, 'v4-1b-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    console.log(JSON.stringify(summary, null, 2));

    if (summary.casesPassed !== summary.cases) throw new Error(`Only ${summary.casesPassed}/${summary.cases} cases passed`);
    if (summary.reducedMotionPassed !== reducedMotion.length) throw new Error('Reduced-motion case failed');
    if (cspViolations.length) throw new Error(`CSP violations: ${JSON.stringify(cspViolations)}`);
    if (sourceInlineStyles.length) throw new Error(`Inline style attributes in shipped source: ${JSON.stringify(sourceInlineStyles)}`);
    if (consoleProblems.length) throw new Error(`Console problems: ${JSON.stringify(consoleProblems)}`);
  } finally {
    if (browser) await browser.close();
    await preview.close();
  }
}

run().then(() => {
  console.log('V4-1b verification complete');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
