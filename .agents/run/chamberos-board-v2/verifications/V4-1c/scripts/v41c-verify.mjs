// V4-1c verification: the readable framing floor and its explicit "Show all"
// escape, the restored pre-filter viewport, the sort sheet and Settings.
//
// Real Chromium against a synthetic GitHub board. Every number below is read
// from the live DOM or from the client's own state; none is copied from source.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOARD_PASSWORD, startBoard } from '../../../../../../web/tests/helpers.mjs';
import { startFakeGitHub, makeIssue } from '../../../../../../web/tests/fake-github.mjs';

let pkg;
try {
  pkg = await import('/workspace/personal/lucas/charme-social/node_modules/playwright/index.js');
} catch {
  pkg = await import('playwright');
}
const { chromium } = pkg.default || pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..');
const SHOTS = path.join(OUT, 'screenshots');
const CHROME = process.env.H2_CHROME || '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
fs.mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The same 6-card board the L4 review measured: a compact neighbourhood plus
// one unrelated card far to the right.
async function normalPreview() {
  const fake = await startFakeGitHub({
    repositories: [
      {
        repo: 'chamberos/platform', id: 101, hasIssues: true,
        issues: [
          makeIssue({ number: 1, repo: 'chamberos/platform', title: 'Deploy regional ingress verification', body: '<!-- board-canvas: {"x":80,"y":90,"notes":[{"id":"n1","x":90,"y":330,"w":240,"h":120,"text":"Sticky note under the card"}]} -->\n## Overview\nCoordinate edge verification.', labels: ['status:needs-human', 'priority:urgent'], updated_at: '2026-11-10T14:20:00Z' }),
          makeIssue({ number: 2, repo: 'chamberos/platform', title: 'Wire conditional ETag revalidation across board routes', body: '<!-- board-canvas: {"x":460,"y":90} -->\n## Overview\nReduce poll overhead.', labels: ['status:in-progress', 'priority:high'], updated_at: '2026-11-10T12:00:00Z' }),
          makeIssue({ number: 3, repo: 'chamberos/platform', title: 'Audit strict CSP headers on workspace shell', body: '<!-- board-canvas: {"x":840,"y":90} -->\n## Overview\nEnsure style-src self.', labels: ['status:in-review', 'priority:high'], updated_at: '2026-11-09T16:30:00Z' }),
          makeIssue({ number: 4, repo: 'chamberos/platform', title: 'Publish release checksum manifest', body: '<!-- board-canvas: {"x":460,"y":300} -->\n## Overview\nGenerate manifest.', labels: ['status:todo', 'priority:medium'], updated_at: '2026-11-08T11:00:00Z' }),
          makeIssue({ number: 5, repo: 'chamberos/platform', title: 'Internal telemetry spike scratchpad', body: '<!-- board-canvas: {"x":1240,"y":520} -->\n## Overview\nExploration.', labels: ['status:draft', 'priority:high'], updated_at: '2026-11-07T09:00:00Z' }),
        ],
      },
      {
        repo: 'acme/vanilla-sdk', id: 102, hasIssues: true,
        issues: [
          makeIssue({ number: 11, repo: 'acme/vanilla-sdk', title: 'Document TypeScript pagination iterator types', body: '<!-- board-canvas: {"x":460,"y":560} -->\nAdd examples.', labels: ['priority:low'], updated_at: '2026-11-10T09:45:00Z' }),
        ],
      },
    ],
  });
  fake.addDependency(2, 1, 'chamberos/platform', 'chamberos/platform');
  fake.addDependency(3, 2, 'chamberos/platform', 'chamberos/platform');
  fake.addDependency(4, 1, 'chamberos/platform', 'chamberos/platform');
  fake.addDependency(11, 2, 'acme/vanilla-sdk', 'chamberos/platform');
  const board = await startBoard(fake, { BOARD_REPO: 'chamberos/platform' });
  return { url: board.url, fake, async close() { await board.app.close(); await fake.close(); } };
}

// A hand-placed board whose dependency neighbourhood is deliberately spread:
// #2 has a blocker far left and two dependents far right and far below.
const POS = { 1: [80, 120], 2: [1450, 900], 3: [2800, 120], 4: [120, 1900], 5: [2600, 2100], 6: [40, 2600], 7: [3000, 2800] };

async function spreadPreview() {
  const fake = await startFakeGitHub({ repositories: [
    { repo: 'chamberos/platform', id: 101, hasIssues: true, issues: [
      makeIssue({ number: 1, repo: 'chamberos/platform', title: 'Upstream schema migration for the board cache', body: `<!-- board-canvas: {"x":${POS[1][0]},"y":${POS[1][1]}} -->\n## Overview\nUpstream work.`, labels: ['priority:urgent', 'status:in-progress'] }),
      makeIssue({ number: 2, repo: 'chamberos/platform', title: 'Selected task that ties the neighbourhood together', body: `<!-- board-canvas: {"x":${POS[2][0]},"y":${POS[2][1]}} -->\n## Overview\nMiddle.`, labels: ['priority:high', 'status:in-progress'] }),
      makeIssue({ number: 3, repo: 'chamberos/platform', title: 'Downstream consumer of the cache revalidation', body: `<!-- board-canvas: {"x":${POS[3][0]},"y":${POS[3][1]}} -->\n## Overview\nRight.`, labels: ['priority:high', 'status:todo'] }),
      makeIssue({ number: 4, repo: 'chamberos/platform', title: 'Second dependent placed far below the fold', body: `<!-- board-canvas: {"x":${POS[4][0]},"y":${POS[4][1]}} -->\n## Overview\nBelow.`, labels: ['priority:medium', 'status:todo'] }),
      makeIssue({ number: 5, repo: 'chamberos/platform', title: 'Unrelated telemetry exporter', body: `<!-- board-canvas: {"x":${POS[5][0]},"y":${POS[5][1]}} -->\n## Overview\nNoise.`, labels: ['priority:low', 'status:draft'] }),
      makeIssue({ number: 6, repo: 'chamberos/platform', title: 'Unrelated documentation pass', body: `<!-- board-canvas: {"x":${POS[6][0]},"y":${POS[6][1]}} -->\n## Overview\nNoise.`, labels: ['priority:low', 'status:todo'] }),
      makeIssue({ number: 7, repo: 'chamberos/platform', title: 'Unrelated release checklist', body: `<!-- board-canvas: {"x":${POS[7][0]},"y":${POS[7][1]}} -->\n## Overview\nNoise.`, labels: ['priority:low', 'status:todo'] }),
    ] },
  ] });
  fake.addDependency(2, 1, 'chamberos/platform', 'chamberos/platform');
  fake.addDependency(3, 2, 'chamberos/platform', 'chamberos/platform');
  fake.addDependency(4, 2, 'chamberos/platform', 'chamberos/platform');
  const board = await startBoard(fake, { BOARD_REPO: 'chamberos/platform' });
  return { url: board.url, async close() { await board.app.close(); await fake.close(); } };
}

// One read of everything the checks need, all measured from the rendered page.
const READ = () => {
  const app = window.__taskBoard;
  const st = app.state;
  const vp = document.getElementById('canvas-viewport').getBoundingClientRect();
  const round = (n) => Math.round(n * 10) / 10;
  const inside = (r) => r.left >= vp.left - 0.6 && r.right <= vp.right + 0.6 && r.top >= vp.top - 0.6 && r.bottom <= vp.bottom + 0.6;
  const cards = Array.from(document.querySelectorAll('.canvas-card')).map((card) => {
    const r = card.getBoundingClientRect();
    const title = card.querySelector('.canvas-card-title');
    return {
      key: card.getAttribute('data-issue-key'),
      role: ['selected', 'blocker', 'dependent', 'unrelated'].find((n) => card.classList.contains('dependency-' + n)) || null,
      rect: { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height), left: r.left, right: r.right, top: r.top, bottom: r.bottom },
      inside: inside(r),
      titleComputedPx: title ? parseFloat(getComputedStyle(title).fontSize) : null,
      effectiveTitlePx: title ? round(parseFloat(getComputedStyle(title).fontSize) * st.canvasScale) : null,
    };
  });
  const labels = Array.from(document.querySelectorAll('.dependency-wire-label')).map((label) => {
    const r = label.getBoundingClientRect();
    const blockerKey = label.getAttribute('data-blocker-key');
    const targetKey = label.getAttribute('data-target-key');
    const endInside = (key) => {
      const card = cards.find((c) => c.key === key);
      if (!card) return false;
      return card.rect.left < vp.right && card.rect.right > vp.left && card.rect.top < vp.bottom && card.rect.bottom > vp.top;
    };
    const endOutside = (key) => {
      const card = cards.find((c) => c.key === key);
      if (!card) return true;
      return card.rect.right <= vp.left || card.rect.left >= vp.right || card.rect.bottom <= vp.top || card.rect.top >= vp.bottom;
    };
    return {
      text: label.textContent,
      hidden: getComputedStyle(label).visibility === 'hidden',
      rect: { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height) },
      inside: inside(r),
      blockerKey,
      targetKey,
      bothEndpointsInside: endInside(blockerKey) && endInside(targetKey),
      anyEndpointFullyOutside: endOutside(blockerKey) || endOutside(targetKey),
    };
  });
  const legend = document.getElementById('dependency-legend');
  const legendRect = legend.getBoundingClientRect();
  const showAll = document.getElementById('canvas-show-all');
  const showAllRect = showAll.getBoundingClientRect();
  return {
    exactView: { panX: st.canvasPanX, panY: st.canvasPanY, scale: st.canvasScale },
    viewport: { x: round(vp.x), y: round(vp.y), w: round(vp.width), h: round(vp.height) },
    scale: Math.round(st.canvasScale * 1000) / 1000,
    pan: { x: Math.round(st.canvasPanX * 100) / 100, y: Math.round(st.canvasPanY * 100) / 100 },
    focus: st.dependencyFocus,
    canvasFitFloored: st.canvasFitFloored,
    canvasFitCount: st.canvasFitCount,
    dependencyFocusFloored: st.dependencyFocusFloored,
    dependencyFocusCount: st.dependencyFocusCount,
    cards,
    labels,
    legend: {
      hidden: legend.hidden,
      text: legend.textContent,
      hasOffscreenNote: Boolean(legend.querySelector('.legend-offscreen')),
      hasShowAll: Boolean(legend.querySelector('.legend-show-all')),
      showAllText: legend.querySelector('.legend-show-all') ? legend.querySelector('.legend-show-all').textContent : null,
      inside: legendRect.width > 0 && legendRect.left >= -0.5 && legendRect.top >= -0.5 && legendRect.right <= innerWidth + 0.5 && legendRect.bottom <= innerHeight + 0.5,
      height: round(legendRect.height),
    },
    showAll: {
      visible: !showAll.hidden && showAllRect.width > 0 && showAllRect.height > 0,
      text: showAll.textContent,
      height: round(showAllRect.height),
      width: round(showAllRect.width),
    },
    applied: (st.viewState.filters || []).slice(),
    chips: document.querySelectorAll('#filter-chips .filter-chip').length,
    canvasIssueCount: (st.currentCanvasIssues || []).length,
    boardIssueCount: ((st.board && st.board.issues) || []).length,
  };
};

async function login(page, url, minCards) {
  await page.goto(url);
  await page.waitForSelector('#login-form', { timeout: 15000 });
  await page.evaluate((pwd) => {
    const input = document.getElementById('password');
    input.value = pwd;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('login-form').requestSubmit();
  }, BOARD_PASSWORD);
  await page.waitForFunction((n) => window.__taskBoard?.state?.board?.issues?.length >= n, minCards, { timeout: 20000 });
  await page.evaluate(() => document.getElementById('nav-canvas').click());
  await page.waitForFunction((n) => document.querySelectorAll('.canvas-card').length >= n, minCards, { timeout: 15000 });
  await sleep(400);
}

async function selectAll(page) {
  const width = page.viewportSize().width;
  if (width > 768) await page.click('#repo-select-btn');
  else await page.click('#compact-project');
  await page.waitForSelector('#repo-options-list .repo-option', { timeout: 10000 });
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('#repo-options-list .repo-option')).find((n) => /All Projects|Tous les projets/.test(n.textContent));
    if (!all) throw new Error('All Projects option missing');
    all.click();
  });
  await page.waitForFunction(() => window.__taskBoard.state.selected === 'all' && !window.__taskBoard.state.boardLoad, null, { timeout: 20000 });
  await page.waitForSelector('#board-view:not([hidden])');
}

async function setCase(page, width, height, theme, lang) {
  await page.setViewportSize({ width, height });
  await page.evaluate(([t, l]) => { window.__taskBoard.setThemeMode(t); window.__taskBoard.setLanguage(l); }, [theme, lang]);
  await page.evaluate(() => document.getElementById('nav-canvas').click());
  await page.waitForFunction(() => !document.getElementById('canvas-viewport').hidden, null, { timeout: 10000 });
  await page.evaluate(() => {
    const app = window.__taskBoard;
    if (app.state.dependencyFocus) app.clearDependencyFocus();
    app.state.viewState.filters = [];
    app.state.searchQuery = '';
    app.state.filterView = null;
    app.state.canvasFitFloored = false;
    app.state.canvasFitCount = 0;
    app.state.canvasFitPending = false;
    app.rememberView();
    app.resetCanvasView();
    app.updateCanvasShowAll();
  });
  await sleep(350);
}

async function pressShowAll(page) {
  const clicked = await page.evaluate(() => {
    const legendButton = document.querySelector('#dependency-legend .legend-show-all');
    if (legendButton) { legendButton.click(); return 'legend'; }
    const barButton = document.getElementById('canvas-show-all');
    if (barButton && !barButton.hidden) { barButton.click(); return 'bar'; }
    return null;
  });
  await sleep(700);
  return clicked;
}

async function run() {
  const normal = await normalPreview();
  const spread = await spreadPreview();
  let browser;
  const out = { filters: [], dependency: [], spread: [], clearFilter: [], sortSheet: null, settings: null, console: [], errors: [], csp: [] };
  try {
    browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
    await context.addInitScript(() => {
      window.__cspViolations = [];
      window.addEventListener('securitypolicyviolation', (e) => window.__cspViolations.push(e.violatedDirective + ' ' + (e.blockedURI || '')));
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => out.errors.push(String(e.message || e)));
    page.on('console', (m) => { if (m.type() === 'error') out.console.push(m.text()); });
    await login(page, normal.url, 5);
    await selectAll(page);

    const matrix = [];
    for (const width of [360, 390, 768, 1280]) {
      const height = width <= 390 ? 800 : 900;
      for (const theme of ['light', 'dark']) for (const lang of ['en', 'fr']) matrix.push({ width, height, theme, lang });
    }

    // ---- D1: applied-filter framing stops at the readable floor ----
    for (const c of matrix) {
      await setCase(page, c.width, c.height, c.theme, c.lang);
      const tag = `${c.width}-${c.theme}-${c.lang}`;
      const before = await page.evaluate(READ);
      await page.click('#applied-filter-btn');
      await page.waitForFunction(() => document.getElementById('board-sheet').open, null, { timeout: 5000 });
      await page.click('[data-filter="priority:high"]');
      await page.click('#sheet-apply');
      await page.waitForFunction(() => !document.getElementById('board-sheet').open);
      await sleep(700);
      const applied = await page.evaluate(READ);
      await page.screenshot({ path: path.join(SHOTS, `d1-filter-applied-${tag}.png`) });
      const expectFloored = applied.canvasFitFloored;
      const expectedText = c.lang === 'fr'
        ? `Tout afficher (${applied.canvasFitCount})`
        : `Show all (${applied.canvasFitCount})`;
      const minTitle = applied.cards.length ? Math.min(...applied.cards.map((x) => x.effectiveTitlePx)) : null;
      let afterShowAll = null;
      let clicked = null;
      if (expectFloored) {
        clicked = await pressShowAll(page);
        afterShowAll = await page.evaluate(READ);
        await page.screenshot({ path: path.join(SHOTS, `d1-filter-show-all-${tag}.png`) });
      }
      out.filters.push({
        case: c, before, applied, afterShowAll, clicked,
        checks: {
          flooredAtPhone: c.width <= 390 ? applied.canvasFitFloored === true : true,
          scaleIsFloorOrReadable: applied.canvasFitFloored
            ? applied.scale === 0.55
            : applied.scale >= 0.55,
          showAllVisible: expectFloored ? (applied.showAll.visible || applied.legend.hasShowAll) : !applied.showAll.visible,
          showAllText: expectFloored ? applied.showAll.text === expectedText : null,
          showAllTouch: expectFloored ? applied.showAll.height >= 44 : null,
          readableTitle: minTitle === null ? null : minTitle >= 8.5,
          allFilteredInsideAfterShowAll: expectFloored
            ? (afterShowAll ? afterShowAll.cards.every((x) => x.inside) : false)
            : applied.cards.every((x) => x.inside),
          showAllScaleBelowFloor: expectFloored ? (afterShowAll ? afterShowAll.scale < 0.55 && afterShowAll.scale >= 0.2 : false) : null,
          chips: applied.chips === 1,
          count: applied.canvasIssueCount === applied.cards.length && applied.canvasIssueCount === 3,
        },
        minEffectiveTitlePx: minTitle,
      });
    }

    // ---- D2: dependency focus on the normal board ----
    for (const c of matrix) {
      await setCase(page, c.width, c.height, c.theme, c.lang);
      const tag = `${c.width}-${c.theme}-${c.lang}`;
      const start = await page.evaluate(READ);
      await page.evaluate(() => {
        const app = window.__taskBoard;
        app.selectDependencyCard(app.state.board.issues.find((i) => i.repository.full === 'chamberos/platform' && i.number === 2));
      });
      await sleep(750);
      const focused = await page.evaluate(READ);
      await page.screenshot({ path: path.join(SHOTS, `d2-focus-${tag}.png`) });
      const neighbourhood = focused.cards.filter((x) => x.role && x.role !== 'unrelated');
      const visibleLabels = focused.labels.filter((l) => !l.hidden);
      const expectedText = c.lang === 'fr'
        ? `Tout afficher (${focused.dependencyFocusCount})`
        : `Show all (${focused.dependencyFocusCount})`;
      let afterShowAll = null;
      let clicked = null;
      if (focused.dependencyFocusFloored) {
        clicked = await pressShowAll(page);
        afterShowAll = await page.evaluate(READ);
        await page.screenshot({ path: path.join(SHOTS, `d2-focus-show-all-${tag}.png`) });
        await page.evaluate(() => document.getElementById('dependency-legend').querySelector('.legend-head button').click());
        await sleep(700);
      } else {
        await page.evaluate(() => window.__taskBoard.clearDependencyFocus());
        await sleep(700);
      }
      const restored = await page.evaluate(READ);
      out.dependency.push({
        case: c, start, focused, afterShowAll, restored, clicked,
        minEffectiveTitlePx: focused.cards.filter((x) => x.role && x.role !== 'unrelated').length
          ? Math.min(...focused.cards.filter((x) => x.role && x.role !== 'unrelated').map((x) => x.effectiveTitlePx))
          : null,
        checks: {
          selected: neighbourhood.filter((x) => x.role === 'selected').length === 1,
          blockers: neighbourhood.filter((x) => x.role === 'blocker').length >= 1,
          dependents: neighbourhood.filter((x) => x.role === 'dependent').length >= 1,
          floorOnPhones: c.width <= 390 ? focused.dependencyFocusFloored === true && focused.scale === 0.55 : true,
          selectedInside: neighbourhood.filter((x) => x.role === 'selected').every((x) => x.inside),
          wholeNeighbourhoodInside: focused.dependencyFocusFloored ? null : neighbourhood.every((x) => x.inside),
          legendSaysOffscreen: focused.dependencyFocusFloored ? focused.legend.hasOffscreenNote : !focused.legend.hasOffscreenNote,
          noVisibleLabelWithoutBothCards: visibleLabels.every((l) => l.bothEndpointsInside),
          hiddenLabelMatchesOffscreenNeighbours: focused.dependencyFocusFloored
            ? focused.labels.every((l) => l.hidden === l.anyEndpointFullyOutside)
            : focused.labels.every((l) => !l.hidden),
          showAllPresent: focused.dependencyFocusFloored ? focused.legend.hasShowAll && focused.showAll.visible : !focused.legend.hasShowAll,
          showAllText: focused.dependencyFocusFloored ? (focused.legend.showAllText === expectedText && focused.showAll.text === expectedText) : null,
          showAllTouch: focused.dependencyFocusFloored ? focused.legend.inside && focused.showAll.height >= 44 : null,
          showAllFitsAll: focused.dependencyFocusFloored
            ? (afterShowAll ? afterShowAll.cards.filter((x) => x.role && x.role !== 'unrelated').every((x) => x.inside) : false)
            : true,
          showAllClearsNote: focused.dependencyFocusFloored
            ? (afterShowAll ? afterShowAll.legend.hasOffscreenNote === false : false)
            : true,
          closeRestoresView: Math.abs(restored.scale - start.scale) < 0.02 && Math.abs(restored.pan.x - start.pan.x) < 2.5 && Math.abs(restored.pan.y - start.pan.y) < 2.5,
          legendInside: focused.legend.inside,
        },
      });
    }

    // ---- D2: the spread board, same complete matrix ----
    const spreadPage = await context.newPage();
    spreadPage.on('pageerror', (e) => out.errors.push(String(e.message || e)));
    spreadPage.on('console', (m) => { if (m.type() === 'error') out.console.push(m.text()); });
    await login(spreadPage, spread.url, 7);
    await selectAll(spreadPage);
    for (const c of matrix) {
      const w = c.width;
      const tag = `${c.width}-${c.theme}-${c.lang}`;
      await setCase(spreadPage, c.width, c.height, c.theme, c.lang);
      const before = await spreadPage.evaluate(READ);
      await spreadPage.evaluate(() => {
        const app = window.__taskBoard;
        app.selectDependencyCard(app.state.board.issues.find((i) => i.number === 2));
      });
      await sleep(750);
      const focused = await spreadPage.evaluate(READ);
      await spreadPage.screenshot({ path: path.join(SHOTS, `d2-spread-focus-${tag}.png`) });
      const neighbourhood = focused.cards.filter((x) => x.role && x.role !== 'unrelated');
      const clicked = await pressShowAll(spreadPage);
      const afterShowAll = await spreadPage.evaluate(READ);
      await spreadPage.screenshot({ path: path.join(SHOTS, `d2-spread-show-all-${tag}.png`) });
      const neighbourhoodAfter = afterShowAll.cards.filter((x) => x.role && x.role !== 'unrelated');
      out.spread.push({
        case: c, width: w, before, focused, afterShowAll, clicked,
        checks: {
          floored: focused.dependencyFocusFloored === true && focused.scale === 0.55,
          selectedInside: neighbourhood.filter((x) => x.role === 'selected').every((x) => x.inside),
          selectedReadable: neighbourhood.filter((x) => x.role === 'selected').every((x) => x.effectiveTitlePx >= 8.5),
          someNeighbourOffscreen: neighbourhood.some((x) => !x.inside),
          legendSaysOffscreen: focused.legend.hasOffscreenNote === true,
          showAllPresent: focused.legend.hasShowAll === true && focused.showAll.text === `${c.lang === 'fr' ? 'Tout afficher' : 'Show all'} (${focused.dependencyFocusCount})`,
          noVisibleLabelWithoutBothCards: focused.labels.filter((l) => !l.hidden).every((l) => l.bothEndpointsInside),
          hiddenOnlyForOffscreenEndpoints: focused.labels.every((l) => l.hidden === l.anyEndpointFullyOutside),
          showAllFitsAsFarAsTheCanvasAllows: afterShowAll.scale < 0.55 && afterShowAll.scale >= 0.2,
          wholeNeighbourhoodInsideAfterShowAll: w >= 768 ? neighbourhoodAfter.every((x) => x.inside) : null,
          showAllClearsNote: afterShowAll.legend.hasOffscreenNote === false,
        },
        neighbourhood: neighbourhood.map((x) => ({ key: x.key, role: x.role, inside: x.inside, effectiveTitlePx: x.effectiveTitlePx })),
        neighbourhoodAfter: neighbourhoodAfter.map((x) => ({ key: x.key, role: x.role, inside: x.inside })),
      });
    }

    // ---- D3: clearing the last filter restores the exact previous viewport ----
    for (const width of [360, 1280]) {
      const height = width <= 390 ? 800 : 900;
      await setCase(page, width, height, 'light', 'en');
      // A non-default fractional view proves exact restoration, not a reset.
      await page.evaluate(() => {
        const app = window.__taskBoard;
        app.state.canvasPanX = 123.125;
        app.state.canvasPanY = -47.875;
        app.state.canvasScale = 0.873;
        app.updateCanvasTransform();
      });
      const before = await page.evaluate(READ);
      await page.click('#applied-filter-btn');
      await page.click('[data-filter="priority:high"]');
      await page.click('#sheet-apply');
      await page.waitForFunction(() => !document.getElementById('board-sheet').open);
      await sleep(700);
      const applied = await page.evaluate(READ);
      await page.screenshot({ path: path.join(SHOTS, `d3-filter-applied-${width}.png`) });
      // Two independent clear paths: the chip and the sheet's Clear all.
      if (width === 360) {
        await page.click('#filter-chips .filter-chip');
      } else {
        await page.click('#applied-filter-btn');
        await page.click('#sheet-reset');
        await page.click('#sheet-apply');
      }
      await page.waitForFunction(() => !document.getElementById('board-sheet').open).catch(() => {});
      await sleep(500);
      const cleared = await page.evaluate(READ);
      await page.screenshot({ path: path.join(SHOTS, `d3-filter-cleared-${width}.png`) });
      out.clearFilter.push({
        width,
        path: width === 360 ? 'chip' : 'sheet-reset',
        before, applied, cleared,
        restored: {
          panX: cleared.exactView.panX === before.exactView.panX,
          panY: cleared.exactView.panY === before.exactView.panY,
          scale: cleared.exactView.scale === before.exactView.scale,
          filteredPanDiffered: applied.pan.x !== before.pan.x || applied.scale !== before.scale,
          showAllHidden: cleared.showAll.visible === false,
        },
      });
    }

    // ---- D4: the sort sheet at 1280 ----
    await setCase(page, 1280, 900, 'dark', 'en');
    await page.evaluate(() => window.__taskBoard.openSheet('sort', document.getElementById('applied-filter-btn')));
    await page.waitForFunction(() => document.getElementById('board-sheet').open);
    await sleep(300);
    const sortOptions = await page.evaluate(() => {
      const sheet = document.getElementById('board-sheet');
      const bodyFont = getComputedStyle(document.body).fontFamily;
      const options = Array.from(sheet.querySelectorAll('.sheet-option')).map((n) => {
        const r = n.getBoundingClientRect();
        const s = getComputedStyle(n);
        return {
          text: n.textContent,
          pressed: n.getAttribute('aria-pressed'),
          height: Math.round(r.height * 10) / 10,
          width: Math.round(r.width * 10) / 10,
          borderWidth: s.borderTopWidth,
          borderStyle: s.borderTopStyle,
          radius: s.borderTopLeftRadius,
          fontFamily: s.fontFamily,
          backgroundColor: s.backgroundColor,
          textAlign: s.textAlign,
        };
      });
      return { options, bodyFont, sheetWidth: sheet.getBoundingClientRect().width, selectedCount: options.filter((o) => o.pressed === 'true').length };
    });
    await page.screenshot({ path: path.join(SHOTS, 'd4-sort-sheet-1280-dark-en.png') });
    await page.click('#sheet-close');
    await sleep(200);
    out.sortSheet = {
      ...sortOptions,
      checks: {
        options: sortOptions.options.length === 4,
        minHeight44: sortOptions.options.every((o) => o.height >= 44),
        bordered: sortOptions.options.every((o) => o.borderWidth !== '0px' && o.borderStyle !== 'none'),
        radius8: sortOptions.options.every((o) => o.radius === '8px'),
        inheritsFont: sortOptions.options.every((o) => o.fontFamily === sortOptions.bodyFont),
        pressedOnce: sortOptions.selectedCount === 1,
        fullWidth: sortOptions.options.every((o) => o.width > sortOptions.sheetWidth * 0.5),
      },
    };

    // ---- D6: Settings rename action at 360 ----
    await setCase(page, 360, 800, 'dark', 'fr');
    await page.evaluate(() => window.__taskBoard.openSheet('settings', document.getElementById('applied-filter-btn')));
    await page.waitForFunction(() => document.getElementById('board-sheet').open);
    await sleep(300);
    const settings = await page.evaluate(() => {
      const sheet = document.getElementById('board-sheet');
      const actions = Array.from(sheet.querySelectorAll('.rename-project .button')).map((n) => {
        const r = n.getBoundingClientRect();
        return { text: n.textContent, height: Math.round(r.height * 10) / 10, width: Math.round(r.width * 10) / 10 };
      });
      return { actions, sheetHeight: Math.round(sheet.getBoundingClientRect().height * 10) / 10, innerHeight };
    });
    await page.locator('#board-sheet .rename-project .button').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, 'd6-settings-360-dark-fr.png') });
    await page.click('#sheet-close');
    out.settings = {
      ...settings,
      checks: {
        actionPresent: settings.actions.length >= 1,
        label: settings.actions.every((a) => a.text === 'Enregistrer le nom'),
        minHeight44: settings.actions.every((a) => a.height >= 44),
        sheetFits: settings.sheetHeight <= settings.innerHeight * 0.85 + 1,
      },
    };

    // ---- Accepted invariants under the new framing fallback ----
    out.reducedMotion = [];
    for (const lang of ['en', 'fr']) {
      await setCase(page, 360, 800, 'light', lang);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.evaluate(() => {
        const app = window.__taskBoard;
        app.selectDependencyCard(app.state.board.issues.find((i) => i.number === 2 && i.repository.full === 'chamberos/platform'));
      });
      const early = await page.evaluate(READ);
      await sleep(450);
      const late = await page.evaluate(READ);
      out.reducedMotion.push({
        lang, early: early.exactView, late: late.exactView,
        pass: JSON.stringify(early.exactView) === JSON.stringify(late.exactView) && early.scale === 0.55 && early.cards.some((card) => card.role === 'selected' && card.inside),
      });
      await page.evaluate(() => window.__taskBoard.clearDependencyFocus());
      await page.emulateMedia({ reducedMotion: null });
    }
    out.browserInvariants = await page.evaluate(() => ({
      bannedCopy: /\b(?:Atelier|n8n|mobile)\b/i.test(document.body.textContent),
      pictographs: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(document.body.textContent),
      doubledPlus: Array.from(document.querySelectorAll('button')).filter((button) => button.textContent.includes('+') && button.querySelector('svg .icon-plus, svg[class*="plus"], svg use[href*="plus"]')).map((button) => button.id),
    }));

    // ---- D7: a real pointer drag with a definite rejected save ----
    await setCase(page, 1280, 900, 'light', 'en');
    await page.evaluate(() => {
      window.__dragUnhandled = [];
      window.addEventListener('unhandledrejection', (event) => {
        window.__dragUnhandled.push(String(event.reason && event.reason.message || event.reason));
      });
    });
    const errorsBefore = out.errors.length;
    const consoleBefore = out.console.length;
    const key = 'chamberos/platform#2';
    const card = page.locator(`.canvas-card[data-issue-key="${key}"]`);
    const beforeDrag = await card.evaluate((n) => ({ x: parseFloat(n.style.left), y: parseFloat(n.style.top) }));
    const box = await card.boundingBox();
    if (!box) throw new Error('drag card missing');
    let rejectedRequests = 0;
    await page.route('**/api/repos/chamberos/platform/issues/2/canvas', async (route) => {
      rejectedRequests++;
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'github_forbidden', message: 'Synthetic refusal' }) });
    });
    const x = box.x + 100, y = box.y + 28;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let step = 1; step <= 8; step++) await page.mouse.move(x + 60 * step / 8, y + 40 * step / 8);
    await page.mouse.up();
    await page.waitForFunction(() => {
      const n = document.getElementById('notice');
      return n && !n.hidden && /not saved|Could not save/i.test(n.textContent);
    }, null, { timeout: 10000 });
    await sleep(500);
    const dragFailure = await page.evaluate(() => {
      const card = document.querySelector('.canvas-card[data-issue-key="chamberos/platform#2"]');
      const notice = document.getElementById('notice');
      return {
        after: card ? { x: parseFloat(card.style.left), y: parseFloat(card.style.top) } : null,
        notice: { text: notice.textContent, error: notice.classList.contains('error') },
        unhandledRejections: window.__dragUnhandled.slice(),
      };
    });
    await page.screenshot({ path: path.join(SHOTS, 'd7-drag-save-refused-1280-light-en.png') });
    await page.unroute('**/api/repos/chamberos/platform/issues/2/canvas');
    out.dragFailure = {
      ...dragFailure, before: beforeDrag, rejectedRequests,
      // Chromium reports its injected 403 as a resource console message. Keep
      // that expected diagnostic separate from unexpected application errors.
      expectedResourceErrors: out.console.slice(consoleBefore),
      checks: {
        requestRejected: rejectedRequests === 1,
        noticeVisible: dragFailure.notice.error && /not saved/i.test(dragFailure.notice.text),
        rollback: dragFailure.after && dragFailure.after.x === beforeDrag.x && dragFailure.after.y === beforeDrag.y,
        noUnhandledRejection: dragFailure.unhandledRejections.length === 0,
        noNewPageError: out.errors.length === errorsBefore,
        onlyExpectedConsole: out.console.slice(consoleBefore).every((message) => /^Failed to load resource: the server responded with a status of 403 \(Forbidden\)$/.test(message)),
      },
    };
    out.console.splice(consoleBefore);

    out.csp = [
      ...await page.evaluate(() => window.__cspViolations || []),
      ...await spreadPage.evaluate(() => window.__cspViolations || []),
    ];
    fs.writeFileSync(path.join(OUT, 'v41c-measurements.json'), JSON.stringify(out, null, 2) + '\n');

    const summary = {
      filterCases: out.filters.length,
      filterAllPass: out.filters.every((f) => Object.values(f.checks).every((v) => v === null || v === true)),
      filterFlooredCases: out.filters.filter((f) => f.applied.canvasFitFloored).map((f) => f.case.width),
      filterMinEffectiveTitlePx: Math.min(...out.filters.map((f) => f.minEffectiveTitlePx ?? 99)),
      dependencyCases: out.dependency.length,
      dependencyAllPass: out.dependency.every((d) => Object.values(d.checks).every((v) => v === null || v === true)),
      dependencyFlooredCases: out.dependency.filter((d) => d.focused.dependencyFocusFloored).map((d) => d.case.width),
      dependencyMinScale: Math.min(...out.dependency.map((d) => d.focused.scale)),
      spreadCases: out.spread.length,
      spreadAllPass: out.spread.every((s) => Object.values(s.checks).every((v) => typeof v !== 'boolean' || v === true)),
      clearFilter: out.clearFilter,
      clearFilterAllPass: out.clearFilter.every((c) => Object.values(c.restored).every((v) => v === true)),
      sortSheetPass: Object.values(out.sortSheet.checks).every((v) => v === true),
      settingsPass: Object.values(out.settings.checks).every((v) => v === true),
      dragFailure: out.dragFailure,
      dragFailurePass: Object.values(out.dragFailure.checks).every((v) => v === true),
      reducedMotion: out.reducedMotion,
      reducedMotionPass: out.reducedMotion.every((entry) => entry.pass),
      browserInvariants: out.browserInvariants,
      browserInvariantsPass: !out.browserInvariants.bannedCopy && !out.browserInvariants.pictographs && out.browserInvariants.doubledPlus.length === 0,
      cspViolations: out.csp,
      pageErrors: out.errors,
      consoleErrors: out.console,
      failures: {
        filters: out.filters.filter((f) => !Object.values(f.checks).every((v) => v === null || v === true)).map((f) => ({ case: f.case, checks: f.checks })),
        dependency: out.dependency.filter((d) => !Object.values(d.checks).every((v) => v === null || v === true)).map((d) => ({ case: d.case, checks: d.checks })),
        spread: out.spread.filter((s) => !Object.values(s.checks).every((v) => typeof v !== 'boolean' || v === true)).map((s) => ({ width: s.width, checks: s.checks })),
      },
    };
    fs.writeFileSync(path.join(OUT, 'v41c-summary.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log(JSON.stringify(summary, null, 2));
    const required = ['filterAllPass', 'dependencyAllPass', 'spreadAllPass', 'clearFilterAllPass', 'sortSheetPass', 'settingsPass', 'dragFailurePass', 'reducedMotionPass', 'browserInvariantsPass'];
    if (!required.every((key) => summary[key] === true) || out.csp.length || out.errors.length || out.console.length) {
      process.exitCode = 1;
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    await normal.close();
    await spread.close();
  }
}

await run();
