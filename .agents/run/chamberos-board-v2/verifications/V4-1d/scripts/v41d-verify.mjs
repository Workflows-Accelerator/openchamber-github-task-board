// V4-1d verification: the D38 desktop rail toggle, phone drawer isolation,
// phone focus at the readable floor, the 16px title under Arrange + Undo, and
// the filter return view across filter changes and reloads.
//
// Real Chromium against a synthetic GitHub board. Every number is read from
// the live DOM or the client's own state after real clicks where a user would
// click.
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
const LONG_TITLE = 'Reconcile the regional ingress verification checklist with the published release checksum manifest before enabling client traffic';

async function preview() {
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
          makeIssue({ number: 6, repo: 'chamberos/platform', title: LONG_TITLE, body: '<!-- board-canvas: {"x":840,"y":300} -->\n## Overview\nLong title.', labels: ['status:todo', 'priority:low'], updated_at: '2026-11-06T09:00:00Z' }),
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
  return { url: board.url, async close() { await board.app.close(); await fake.close(); } };
}

async function login(page, url) {
  await page.goto(url);
  await page.waitForSelector('#login-form', { timeout: 15000 });
  await page.evaluate((pwd) => {
    const input = document.getElementById('password');
    input.value = pwd;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('login-form').requestSubmit();
  }, BOARD_PASSWORD);
  await waitBoard(page);
}

async function waitBoard(page) {
  await page.waitForFunction(() => window.__taskBoard?.state?.board?.issues?.length >= 5 && !window.__taskBoard.state.boardLoad, null, { timeout: 20000 });
  await page.waitForSelector('#app-sidebar:not([hidden])', { timeout: 10000 });
  await sleep(400);
}

async function reload(page) {
  await page.reload();
  await waitBoard(page);
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
  await sleep(300);
}

async function openCanvas(page) {
  const width = page.viewportSize().width;
  if (width > 768) await page.click('#nav-canvas');
  else await page.click('#dock-canvas');
  await page.waitForFunction(() => !document.getElementById('canvas-viewport').hidden && document.querySelectorAll('.canvas-card').length >= 1, null, { timeout: 10000 });
  await sleep(350);
}

// Is the element on screen, unobscured at its centre, and inside the window?
const VISIBLE = (selector) => {
  const node = document.querySelector(selector);
  if (!node) return { exists: false };
  const r = node.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const hit = r.width > 0 && r.height > 0 ? document.elementFromPoint(cx, cy) : null;
  return {
    exists: true,
    rect: { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom },
    inWindow: r.width > 0 && r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5,
    unobscured: Boolean(hit && (hit === node || node.contains(hit))),
    hidden: node.hidden,
    display: getComputedStyle(node).display,
    ariaLabel: node.getAttribute('aria-label'),
    ariaExpanded: node.getAttribute('aria-expanded'),
    title: node.getAttribute('title'),
  };
};

const SIDEBAR = () => {
  const sb = document.getElementById('app-sidebar').getBoundingClientRect();
  return {
    collapsedClass: document.body.classList.contains('sidebar-collapsed'),
    openClass: document.body.classList.contains('sidebar-open'),
    stored: localStorage.getItem('tb_sidebar_collapsed'),
    sidebar: { left: sb.left, width: sb.width, right: sb.right },
    backdropHidden: document.getElementById('sidebar-backdrop').hidden,
    labelsShown: Array.from(document.querySelectorAll('#app-sidebar .sidebar-label')).filter((n) => n.getClientRects().length > 0).length,
  };
};

async function sidebarState(page) {
  return page.evaluate(([sidebarFn, visibleFn]) => {
    const visible = new Function('return (' + visibleFn + ')')();
    const sidebar = new Function('return (' + sidebarFn + ')')();
    return { ...sidebar(), toggle: visible('#sidebar-toggle-btn'), compact: visible('#sidebar-toggle-btn-compact') };
  }, [SIDEBAR.toString(), VISIBLE.toString()]);
}

const ok = (checks) => Object.values(checks).every((v) => v === true);

// ---- D38: the desktop rail toggle, collapse/reload/reopen/reload ----
async function d38Desktop(browser, url, theme, lang, out) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', (e) => out.errors.push(String(e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') out.console.push(m.text()); });
  await login(page, url);
  await page.evaluate(([t, l]) => { window.__taskBoard.setThemeMode(t); window.__taskBoard.setLanguage(l); localStorage.setItem('tb_sidebar_collapsed', '0'); }, [theme, lang]);
  await reload(page);
  const tag = `1280-${theme}-${lang}`;
  const expanded0 = await sidebarState(page);
  await page.click('#sidebar-toggle-btn');
  await sleep(300);
  const collapsed = await sidebarState(page);
  await page.screenshot({ path: path.join(SHOTS, `d38-rail-collapsed-${tag}.png`) });
  await reload(page);
  const collapsedReload = await sidebarState(page);
  await page.screenshot({ path: path.join(SHOTS, `d38-rail-collapsed-reload-${tag}.png`) });
  await page.click('#sidebar-toggle-btn');
  await sleep(300);
  const reopened = await sidebarState(page);
  await reload(page);
  const reopenedReload = await sidebarState(page);
  await page.screenshot({ path: path.join(SHOTS, `d38-rail-reopened-reload-${tag}.png`) });
  const expandLabel = lang === 'fr' ? 'Développer la navigation' : 'Expand sidebar';
  const collapseLabel = lang === 'fr' ? 'Réduire la navigation' : 'Collapse sidebar';
  const railToggle = (s) => s.collapsedClass && s.sidebar.width === 56 && s.toggle.inWindow && s.toggle.unobscured &&
    s.toggle.rect.width >= 44 && s.toggle.rect.height >= 44 && s.toggle.rect.top <= 16 && s.toggle.ariaLabel === expandLabel && s.toggle.ariaExpanded === 'false' && s.labelsShown === 0;
  const openSidebar = (s) => !s.collapsedClass && s.sidebar.width === 230 && s.toggle.inWindow && s.toggle.unobscured && s.toggle.ariaLabel === collapseLabel && s.toggle.ariaExpanded === 'true' && s.labelsShown > 0;
  const entry = {
    theme, lang, expanded0, collapsed, collapsedReload, reopened, reopenedReload,
    checks: {
      startsOpen: openSidebar(expanded0),
      clickCollapses: railToggle(collapsed) && collapsed.stored === '1',
      reloadKeepsToggleVisible: railToggle(collapsedReload),
      compactHiddenOnDesktop: collapsedReload.compact.display === 'none' || collapsedReload.compact.rect.width === 0,
      clickReopens: openSidebar(reopened) && reopened.stored === '0',
      reloadStaysOpen: openSidebar(reopenedReload),
    },
  };
  entry.pass = ok(entry.checks);
  out.d38Desktop.push(entry);
  await context.close();
}

// ---- D38: the phone drawer with and without a persisted collapsed rail ----
async function d38Phone(browser, url, width, height, theme, preference, out) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', hasTouch: false });
  const page = await context.newPage();
  page.on('pageerror', (e) => out.errors.push(String(e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') out.console.push(m.text()); });
  await login(page, url);
  await page.evaluate(([t, p]) => { window.__taskBoard.setThemeMode(t); window.__taskBoard.setLanguage('en'); localStorage.setItem('tb_sidebar_collapsed', p); }, [theme, preference]);
  await reload(page);
  const tag = `${width}-${theme}-${preference === '1' ? 'collapsed-pref' : 'open-pref'}`;
  const closed0 = await sidebarState(page);
  await page.click('#sidebar-toggle-btn-compact');
  await sleep(400);
  const opened = await sidebarState(page);
  await page.screenshot({ path: path.join(SHOTS, `d38-phone-drawer-open-${tag}.png`) });
  await page.mouse.click(width - 20, Math.round(height / 2));
  await sleep(400);
  const closed = await sidebarState(page);
  // Second cycle: the drawer must open again after it was closed.
  await page.click('#sidebar-toggle-btn-compact');
  await sleep(400);
  const reopened = await sidebarState(page);
  await page.mouse.click(width - 20, Math.round(height / 2));
  await sleep(400);
  const reclosed = await sidebarState(page);
  const entry = {
    width, height, theme, preference, closed0, opened, closed, reopened, reclosed,
    checks: {
      preferenceApplied: closed0.collapsedClass === (preference === '1'),
      compactVisible: closed0.compact.inWindow && closed0.compact.unobscured && closed0.compact.rect.width >= 44 && closed0.compact.rect.height >= 44,
      drawerHiddenAtStart: closed0.sidebar.right <= 0.5 && !closed0.openClass,
      opensFullWidthDrawer: opened.openClass && !opened.backdropHidden && opened.sidebar.left >= -0.5 && opened.sidebar.width === 280 && opened.labelsShown > 0,
      drawerToggleNeverSaysExpand: opened.toggle.ariaLabel === 'Collapse sidebar' && opened.toggle.ariaExpanded === 'true',
      closesFromBackdrop: !closed.openClass && closed.backdropHidden && closed.sidebar.right <= 0.5,
      reopens: reopened.openClass && reopened.sidebar.left >= -0.5 && reopened.sidebar.width === 280,
      recloses: !reclosed.openClass && reclosed.backdropHidden,
      preferenceUntouched: reclosed.stored === preference,
    },
  };
  entry.pass = ok(entry.checks);
  out.d38Phone.push(entry);
  await context.close();
}

// ---- Attack 1: phone focus at the floor; the action and its explanation ----
async function phoneFocus(page, width, height, theme, lang, out) {
  await page.setViewportSize({ width, height });
  await page.evaluate(([t, l]) => { window.__taskBoard.setThemeMode(t); window.__taskBoard.setLanguage(l); }, [theme, lang]);
  await openCanvas(page);
  await page.evaluate(() => {
    const app = window.__taskBoard;
    if (app.state.dependencyFocus) app.clearDependencyFocus();
    app.resetCanvasView();
  });
  await sleep(300);
  // Real click on the card's own dependency action, scrolled into view first.
  const button = page.locator('.canvas-card[data-issue-key="chamberos/platform#2"] .card-dependency-focus');
  await page.evaluate(() => {
    const app = window.__taskBoard;
    const card = document.querySelector('.canvas-card[data-issue-key="chamberos/platform#2"]');
    app.state.canvasPanX = 20 - card.offsetLeft;
    app.state.canvasPanY = 60 - card.offsetTop;
    app.state.canvasScale = 1;
    app.updateCanvasTransform();
  });
  await sleep(150);
  await button.click();
  await sleep(800);
  const tag = `${width}-${theme}-${lang}`;
  await page.screenshot({ path: path.join(SHOTS, `a1-phone-focus-${tag}.png`) });
  const m = await page.evaluate((visibleFn) => {
    const visible = new Function('return (' + visibleFn + ')')();
    const st = window.__taskBoard.state;
    const vp = document.getElementById('canvas-viewport').getBoundingClientRect();
    const legend = document.getElementById('dependency-legend').getBoundingClientRect();
    const zoom = document.getElementById('canvas-controls').getBoundingClientRect();
    const showAll = document.querySelector('#dependency-legend .legend-show-all');
    const showRect = showAll ? showAll.getBoundingClientRect() : null;
    const overlap = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const cards = Array.from(document.querySelectorAll('.canvas-card')).map((card) => {
      const r = card.getBoundingClientRect();
      const role = ['selected', 'blocker', 'dependent'].find((n) => card.classList.contains('dependency-' + n)) || null;
      return { key: card.getAttribute('data-issue-key'), role,
        fullyInside: r.left >= vp.left - 0.6 && r.right <= vp.right + 0.6 && r.top >= vp.top - 0.6 && r.bottom <= vp.bottom + 0.6,
        underLegend: overlap(r, legend), underZoom: overlap(r, zoom) };
    });
    const note = document.querySelector('#dependency-legend .legend-offscreen');
    return {
      scale: st.canvasScale, floored: st.dependencyFocusFloored, count: st.dependencyFocusCount,
      noteText: note ? note.textContent : null,
      legendShowAll: visible('#dependency-legend .legend-show-all'),
      legendShowAllText: showAll ? showAll.textContent : null,
      barShowAll: visible('#canvas-show-all'),
      showAllOverlapsZoom: overlap(showRect, zoom),
      legendOverlapsZoom: overlap(legend, zoom),
      legendRole: document.getElementById('dependency-legend').getAttribute('role'),
      neighbours: cards.filter((c) => c.role),
    };
  }, VISIBLE.toString());
  const expectedNote = lang === 'fr' ? 'Des tâches liées sont hors de cette vue.' : 'Connected tasks are outside this view.';
  const expectedAction = `${lang === 'fr' ? 'Tout afficher' : 'Show all'} (${m.count})`;
  const selected = m.neighbours.find((c) => c.role === 'selected');
  const others = m.neighbours.filter((c) => c.role !== 'selected');
  const entry = {
    width, theme, lang, measured: m,
    checks: {
      flooredAt055: m.floored === true && Math.abs(m.scale - 0.55) < 0.0005,
      noteTextExact: m.noteText === expectedNote,
      noteTruthful: others.some((c) => !c.fullyInside),
      actionTextExact: m.legendShowAllText === expectedAction,
      actionInWindow: m.legendShowAll.inWindow === true,
      actionUnobscured: m.legendShowAll.unobscured === true,
      actionTouchTarget: m.legendShowAll.rect.height >= 44 && m.legendShowAll.rect.width >= 120,
      actionClearOfZoomBar: m.showAllOverlapsZoom === false && m.legendOverlapsZoom === false,
      selectedVisibleAndClear: Boolean(selected && selected.fullyInside && !selected.underLegend && !selected.underZoom),
      announced: m.legendRole === 'status',
    },
  };
  // Pressing the action is a real click on the legend button.
  await page.click('#dependency-legend .legend-show-all');
  await sleep(800);
  const after = await page.evaluate(() => {
    const st = window.__taskBoard.state;
    const vp = document.getElementById('canvas-viewport').getBoundingClientRect();
    return {
      scale: st.canvasScale,
      note: Boolean(document.querySelector('#dependency-legend .legend-offscreen')),
      inside: Array.from(document.querySelectorAll('.canvas-card.dependency-selected, .canvas-card.dependency-blocker, .canvas-card.dependency-dependent')).every((card) => {
        const r = card.getBoundingClientRect();
        return r.left >= vp.left - 0.6 && r.right <= vp.right + 0.6 && r.top >= vp.top - 0.6 && r.bottom <= vp.bottom + 0.6;
      }),
    };
  });
  await page.screenshot({ path: path.join(SHOTS, `a1-phone-focus-show-all-${tag}.png`) });
  entry.after = after;
  entry.checks.showAllFitsNeighbourhood = after.inside && after.scale < 0.55 && after.note === false;
  entry.pass = ok(entry.checks);
  out.phoneFocus.push(entry);
  await page.click('#dependency-legend .legend-head .button');
  await sleep(500);
}

// ---- Attack 2: 16px titles, Arrange + Undo with real clicks ----
const CARDS = () => Array.from(document.querySelectorAll('.canvas-card')).map((card) => {
  const title = card.querySelector('.canvas-card-title');
  return {
    key: card.getAttribute('data-issue-key'),
    x: parseFloat(card.style.left), y: parseFloat(card.style.top),
    w: card.offsetWidth, h: card.offsetHeight,
    titleFont: parseFloat(getComputedStyle(title).fontSize),
    titleLines: Math.round(title.clientHeight / parseFloat(getComputedStyle(title).lineHeight)),
    titleClamped: title.scrollHeight > title.clientHeight + 1,
    titleHorizontalOverflow: title.scrollWidth > title.clientWidth + 1,
    // The connection ports sit 7px outside the card on purpose; every in-flow
    // block (top row, title, subtitle, footer, actions) must stay inside it.
    cardContentOverflow: (() => {
      const box = card.getBoundingClientRect();
      return Array.from(card.children).filter((child) => !child.classList.contains('canvas-card-port')).some((child) => {
        const r = child.getBoundingClientRect();
        return r.width > 0 && (r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5);
      });
    })(),
    titleText: title.textContent,
    titleTooltip: card.getAttribute('title') || title.getAttribute('title') || null,
  };
});

async function arrangeUndo(page, out) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => { window.__taskBoard.setThemeMode('light'); window.__taskBoard.setLanguage('en'); });
  await openCanvas(page);
  await page.evaluate(() => window.__taskBoard.fitAllCanvasNodes());
  await sleep(300);
  const before = await page.evaluate(CARDS);
  await page.screenshot({ path: path.join(SHOTS, 'a2-titles-before-arrange-1280-light-en.png') });
  await page.click('#canvas-arrange');
  await page.waitForFunction(() => document.getElementById('canvas-arrange-dialog').open);
  await page.click('label[for="arrange-scope-all"], #arrange-scope-all');
  await page.click('#arrange-confirm-btn');
  await page.waitForFunction(() => !document.getElementById('canvas-arrange-undo').hidden && !document.getElementById('arrange-confirm-btn').disabled, null, { timeout: 15000 });
  await page.waitForFunction(() => !document.getElementById('canvas-arrange-dialog').open, null, { timeout: 5000 });
  await page.evaluate(() => window.__taskBoard.fitAllCanvasNodes());
  await sleep(300);
  const arranged = await page.evaluate(CARDS);
  await page.screenshot({ path: path.join(SHOTS, 'a2-arranged-1280-light-en.png') });
  // Arrange measured offsetHeight; every arranged card must clear the one
  // above it in its column by at least the layout's minimum gutter (45px).
  const overlaps = [];
  const tightGaps = [];
  for (let i = 0; i < arranged.length; i++) {
    for (let j = i + 1; j < arranged.length; j++) {
      const a = arranged[i], b = arranged[j];
      if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) overlaps.push([a.key, b.key]);
      if (a.x === b.x) {
        const [top, bottom] = a.y < b.y ? [a, b] : [b, a];
        const gap = bottom.y - (top.y + top.h);
        if (gap < 45) tightGaps.push({ top: top.key, bottom: bottom.key, gap });
      }
    }
  }
  await page.click('#canvas-arrange-undo');
  await page.waitForFunction(() => document.getElementById('canvas-arrange-undo').hidden, null, { timeout: 15000 });
  await sleep(400);
  const undone = await page.evaluate(CARDS);
  await reload(page);
  await openCanvas(page);
  const reloaded = await page.evaluate(CARDS);
  await page.screenshot({ path: path.join(SHOTS, 'a2-undo-reloaded-1280-light-en.png') });
  const pos = (list) => Object.fromEntries(list.map((c) => [c.key, [c.x, c.y]]));
  const same = (a, b) => JSON.stringify(Object.entries(pos(a)).sort()) === JSON.stringify(Object.entries(pos(b)).sort());
  const titleChecks = (list) => list.every((c) => c.titleFont === 16 && !c.titleHorizontalOverflow && !c.cardContentOverflow && c.titleLines <= 2);
  const entry = {
    before, arranged, undone, reloaded, overlaps, tightGaps,
    longTitle: before.find((c) => c.titleText === LONG_TITLE) || null,
    checks: {
      titles16pxNoOverflow: titleChecks(before) && titleChecks(arranged),
      longTitleClampedToTwoLines: Boolean(before.find((c) => c.titleText === LONG_TITLE && c.titleClamped && c.titleLines === 2)),
      arrangeMoved: !same(before, arranged),
      noOverlapAfterArrange: overlaps.length === 0,
      columnGutterAtLeast45: tightGaps.length === 0,
      undoRestoresExact: same(before, undone),
      undoPersistsAcrossReload: same(before, reloaded),
    },
  };
  entry.pass = ok(entry.checks);
  out.arrange = entry;
}

// ---- Attack 3: the return view after a filter change and after a reload ----
const VIEW = () => {
  const st = window.__taskBoard.state;
  return { panX: st.canvasPanX, panY: st.canvasPanY, scale: st.canvasScale, filters: st.viewState.filters.slice(), filterView: st.filterView, stored: localStorage.getItem('tb_canvas_filter_view'), showAllHidden: document.getElementById('canvas-show-all').hidden };
};

async function setStartView(page) {
  await page.evaluate(() => {
    const app = window.__taskBoard;
    if (app.state.dependencyFocus) app.clearDependencyFocus();
    app.state.canvasPanX = 123.125;
    app.state.canvasPanY = -47.875;
    app.state.canvasScale = 0.873;
    app.updateCanvasTransform();
  });
  await sleep(100);
}

const exact = (a, b) => a.panX === b.panX && a.panY === b.panY && a.scale === b.scale;

async function openFilterSheet(page) {
  await page.click('#applied-filter-btn');
  await page.waitForFunction(() => document.getElementById('board-sheet').open);
}
async function closeFilterSheet(page) {
  await page.click('#sheet-apply');
  await page.waitForFunction(() => !document.getElementById('board-sheet').open);
  await sleep(700);
}

async function returnView(page, width, out) {
  const height = width <= 390 ? 800 : 900;
  await page.setViewportSize({ width, height });
  await page.evaluate(() => { window.__taskBoard.setThemeMode('light'); window.__taskBoard.setLanguage('en'); });
  await openCanvas(page);
  const results = {};

  // A: change the filter (add a second, then swap the first) before clearing.
  await setStartView(page);
  const start = await page.evaluate(VIEW);
  await openFilterSheet(page);
  await page.click('[data-filter="priority:high"]');
  await closeFilterSheet(page);
  const firstFilter = await page.evaluate(VIEW);
  await openFilterSheet(page);
  await page.click('[data-filter="priority:urgent"]');
  await page.click('[data-filter="priority:high"]');
  await closeFilterSheet(page);
  const changed = await page.evaluate(VIEW);
  await page.screenshot({ path: path.join(SHOTS, `a3-filter-changed-${width}-light-en.png`) });
  await page.click('#filter-chips .filter-chip');
  await sleep(600);
  const cleared = await page.evaluate(VIEW);
  results.change = {
    start, firstFilter, changed, cleared,
    checks: {
      filterFramed: !exact(firstFilter, start),
      changeKeepsFirstReturnView: changed.filters.join() === 'priority:urgent' && changed.filterView && exact(changed.filterView, start),
      changeReframed: !exact(changed, firstFilter),
      clearRestoresExact: exact(cleared, start) && cleared.filterView === null && cleared.stored === null && cleared.showAllHidden,
    },
  };

  // B: reload with a filter active, then clear.
  await setStartView(page);
  const startB = await page.evaluate(VIEW);
  await openFilterSheet(page);
  await page.click('[data-filter="priority:high"]');
  await closeFilterSheet(page);
  const filteredB = await page.evaluate(VIEW);
  await reload(page);
  await openCanvas(page);
  const afterReload = await page.evaluate(VIEW);
  await page.screenshot({ path: path.join(SHOTS, `a3-filter-reloaded-${width}-light-en.png`) });
  await page.click('#filter-chips .filter-chip');
  await sleep(600);
  const clearedB = await page.evaluate(VIEW);
  await page.screenshot({ path: path.join(SHOTS, `a3-filter-reload-cleared-${width}-light-en.png`) });
  results.reload = {
    startB, filteredB, afterReload, clearedB,
    checks: {
      filtersPersist: afterReload.filters.join() === 'priority:high',
      returnViewPersists: Boolean(afterReload.filterView) && exact(afterReload.filterView, startB),
      filteredViewNotLost: Math.abs(afterReload.panX - filteredB.panX) <= 1 && Math.abs(afterReload.panY - filteredB.panY) <= 1 && Math.abs(afterReload.scale - filteredB.scale) <= 0.001,
      clearAfterReloadRestoresExact: exact(clearedB, startB) && clearedB.stored === null,
    },
  };

  // C: clear from the list view, reload, then return to the canvas.
  await setStartView(page);
  const startC = await page.evaluate(VIEW);
  await openFilterSheet(page);
  await page.click('[data-filter="priority:high"]');
  await closeFilterSheet(page);
  if (width > 768) await page.click('#nav-list'); else await page.click('#dock-list');
  await page.waitForFunction(() => document.getElementById('canvas-viewport').hidden);
  await page.click('#filter-chips .filter-chip');
  await sleep(400);
  await reload(page);
  const listReload = await page.evaluate(VIEW);
  await openCanvas(page);
  await sleep(300);
  const backOnCanvas = await page.evaluate(VIEW);
  results.listClear = {
    startC, listReload, backOnCanvas,
    checks: {
      filtersCleared: listReload.filters.length === 0,
      returnViewKeptUntilCanvas: Boolean(listReload.filterView) && exact(listReload.filterView, startC),
      canvasRestoresExact: exact(backOnCanvas, startC) && backOnCanvas.filterView === null && backOnCanvas.stored === null,
    },
  };

  // D: search plus filter; clearing the filter frames the search, emptying
  // the search returns to the pre-filter view; sort never captures a view.
  await setStartView(page);
  const startD = await page.evaluate(VIEW);
  if (width <= 768) await page.click('#compact-search');
  await page.fill('#board-search', 'e');
  await sleep(400);
  const searchOnly = await page.evaluate(VIEW);
  await openFilterSheet(page);
  await page.click('[data-filter="priority:high"]');
  await closeFilterSheet(page);
  await page.click('#filter-chips .filter-chip');
  await sleep(600);
  const searchRemains = await page.evaluate(VIEW);
  await page.fill('#board-search', '');
  await sleep(600);
  const searchCleared = await page.evaluate(VIEW);
  if (width <= 768) await page.click('#compact-search');
  results.search = {
    startD, searchOnly, searchRemains, searchCleared,
    checks: {
      searchAloneCapturesNothing: searchOnly.filterView === null && exact(searchOnly, startD),
      filterClearedSearchKeepsReturnView: Boolean(searchRemains.filterView) && exact(searchRemains.filterView, startD),
      emptySearchRestoresExact: exact(searchCleared, startD) && searchCleared.filterView === null,
    },
  };
  const entry = { width, ...results };
  entry.pass = Object.values(results).every((r) => ok(r.checks));
  out.returnView.push(entry);
}

async function run() {
  const out = { d38Desktop: [], d38Phone: [], phoneFocus: [], arrange: null, returnView: [], console: [], errors: [], csp: [] };
  let browser;
  const servers = [];
  try {
    browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const p1 = await preview(); servers.push(p1);
    for (const theme of ['light', 'dark']) for (const lang of ['en', 'fr']) await d38Desktop(browser, p1.url, theme, lang, out);
    for (const width of [360, 390]) for (const theme of ['light', 'dark']) for (const preference of ['1', '0']) {
      await d38Phone(browser, p1.url, width, width === 360 ? 800 : 844, theme, preference, out);
    }

    const context = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
    await context.addInitScript(() => {
      window.__cspViolations = [];
      window.addEventListener('securitypolicyviolation', (e) => window.__cspViolations.push(e.violatedDirective + ' ' + (e.blockedURI || '')));
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => out.errors.push(String(e.message || e)));
    page.on('console', (m) => { if (m.type() === 'error') out.console.push(m.text()); });
    await login(page, p1.url);
    await page.evaluate(() => localStorage.setItem('tb_sidebar_collapsed', '1'));
    await selectAll(page);
    for (const width of [360, 390]) for (const theme of ['light', 'dark']) for (const lang of ['en', 'fr']) {
      await phoneFocus(page, width, width === 360 ? 800 : 844, theme, lang, out);
    }
    for (const width of [360, 1280]) await returnView(page, width, out);
    out.csp.push(...await page.evaluate(() => window.__cspViolations || []));
    await context.close();

    // Arrange writes positions, so it runs last on its own fixture.
    const p2 = await preview(); servers.push(p2);
    const arrangeContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    const arrangePage = await arrangeContext.newPage();
    arrangePage.on('pageerror', (e) => out.errors.push(String(e.message || e)));
    arrangePage.on('console', (m) => { if (m.type() === 'error') out.console.push(m.text()); });
    await login(arrangePage, p2.url);
    await selectAll(arrangePage);
    await arrangeUndo(arrangePage, out);
    await arrangeContext.close();
  } finally {
    if (browser) await browser.close().catch(() => {});
    for (const s of servers) await s.close().catch(() => {});
  }
  fs.writeFileSync(path.join(OUT, 'v41d-measurements.json'), JSON.stringify(out, null, 2) + '\n');
  const summary = {
    d38DesktopCases: out.d38Desktop.length,
    d38DesktopPass: out.d38Desktop.length === 4 && out.d38Desktop.every((e) => e.pass),
    d38PhoneCases: out.d38Phone.length,
    d38PhonePass: out.d38Phone.length === 8 && out.d38Phone.every((e) => e.pass),
    phoneFocusCases: out.phoneFocus.length,
    phoneFocusPass: out.phoneFocus.length === 8 && out.phoneFocus.every((e) => e.pass),
    arrangePass: Boolean(out.arrange && out.arrange.pass),
    returnViewCases: out.returnView.length,
    returnViewPass: out.returnView.length === 2 && out.returnView.every((e) => e.pass),
    failures: {
      d38Desktop: out.d38Desktop.filter((e) => !e.pass).map((e) => ({ theme: e.theme, lang: e.lang, checks: e.checks })),
      d38Phone: out.d38Phone.filter((e) => !e.pass).map((e) => ({ width: e.width, theme: e.theme, preference: e.preference, checks: e.checks })),
      phoneFocus: out.phoneFocus.filter((e) => !e.pass).map((e) => ({ width: e.width, theme: e.theme, lang: e.lang, checks: e.checks })),
      arrange: out.arrange && !out.arrange.pass ? { checks: out.arrange.checks, overlaps: out.arrange.overlaps, tightGaps: out.arrange.tightGaps } : null,
      returnView: out.returnView.filter((e) => !e.pass).map((e) => ({ width: e.width, change: e.change.checks, reload: e.reload.checks, listClear: e.listClear.checks, search: e.search.checks })),
    },
    cspViolations: out.csp,
    pageErrors: out.errors,
    consoleErrors: out.console,
  };
  fs.writeFileSync(path.join(OUT, 'v41d-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
  const required = ['d38DesktopPass', 'd38PhonePass', 'phoneFocusPass', 'arrangePass', 'returnViewPass'];
  if (!required.every((k) => summary[k] === true) || out.csp.length || out.errors.length || out.console.length) process.exitCode = 1;
}

await run();
