// Fresh regression spot checks for the targeted D39 review. Independent of the
// builder's scripts; local synthetic fixtures only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalPreview, login, selectAll, setCase, chromium, CHROME, sleep } from './fixture-helpers.mjs';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(OUT, 'screenshots');
const out = { checks: {}, sheets: [], d38: [], drag: null, refusal: null, arrange: null, reducedMotion: null, keyboard: null, errors: [], console: [], failures: [] };
const fail = (label, details) => { out.failures.push({ label, details }); };
const check = (value, label, details) => { if (!value) fail(label, details); };
const write = () => fs.writeFileSync(path.join(OUT, 'regression-review.json'), JSON.stringify(out, null, 2) + '\n');
const settle = async (page) => {
  await page.waitForFunction(() => !window.__taskBoard.state.canvasAnimating, null, { timeout: 8000 }).catch(() => {});
  await page.evaluate(async () => { await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))); });
  await sleep(80);
};
const rect = (n) => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };

async function fresh(browser, url, width, height, theme = 'light', lang = 'en') {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
  await context.addInitScript(() => {
    window.__csp = []; window.__unhandled = [];
    addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective));
    addEventListener('unhandledrejection', (e) => window.__unhandled.push(String(e.reason)));
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => out.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') out.console.push(m.text()); });
  await login(page, url, 5);
  await selectAll(page);
  await setCase(page, width, height, theme, lang);
  return { context, page };
}

async function d38(browser, server) {
  {
    const { context, page } = await fresh(browser, server.url, 1280, 900);
    try {
      await page.evaluate(() => localStorage.removeItem('tb_sidebar_collapsed'));
      await page.reload();
      await page.waitForFunction(() => window.__taskBoard?.state?.board?.issues?.length, null, { timeout: 20000 });
      await sleep(300);
      const measure = () => page.evaluate(() => {
        const s = document.getElementById('app-sidebar').getBoundingClientRect();
        const b = document.getElementById('sidebar-toggle-btn');
        const q = b.getBoundingClientRect();
        const h = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2);
        return {
          sidebar: { x: s.x, width: s.width, right: s.right },
          toggle: { x: q.x, y: q.y, width: q.width, height: q.height, hit: h === b || b.contains(h), label: b.getAttribute('aria-label'), expanded: b.getAttribute('aria-expanded') },
          stored: localStorage.getItem('tb_sidebar_collapsed'),
        };
      });
      const expanded = await measure();
      await page.click('#sidebar-toggle-btn');
      await sleep(250);
      const collapsed = await measure();
      await page.reload();
      await page.waitForFunction(() => window.__taskBoard?.state?.board?.issues?.length, null, { timeout: 20000 });
      await sleep(300);
      const afterReload = await measure();
      await page.click('#sidebar-toggle-btn');
      await sleep(250);
      const reopened = await measure();
      await page.reload();
      await page.waitForFunction(() => window.__taskBoard?.state?.board?.issues?.length, null, { timeout: 20000 });
      await sleep(300);
      const reopenedReload = await measure();
      out.d38.push({ viewport: 1280, expanded, collapsed, afterReload, reopened, reopenedReload });
      check(Math.abs(expanded.sidebar.width - 230) < 2 && expanded.toggle.hit && expanded.toggle.label === 'Collapse sidebar' && expanded.toggle.expanded === 'true',
        'D38 expanded desktop rail toggle visible and labelled', expanded);
      check(Math.abs(collapsed.sidebar.width - 56) < 1 && collapsed.toggle.hit && collapsed.toggle.label === 'Expand sidebar' && collapsed.stored === '1',
        'D38 desktop collapse leaves a reachable expand toggle', collapsed);
      check(Math.abs(afterReload.sidebar.width - 56) < 1 && afterReload.toggle.hit && afterReload.toggle.label === 'Expand sidebar' && afterReload.stored === '1',
        'D38 collapsed rail survives reload', afterReload);
      check(Math.abs(reopened.sidebar.width - 230) < 2 && reopened.toggle.hit && reopened.toggle.label === 'Collapse sidebar' && reopened.stored === '0',
        'D38 desktop reopen restores the rail', reopened);
      check(Math.abs(reopenedReload.sidebar.width - 230) < 2 && reopenedReload.toggle.hit && reopenedReload.stored === '0',
        'D38 reopened rail survives reload', reopenedReload);
      await page.screenshot({ path: path.join(SHOTS, 'd38-reopened-1280-light-en.png') });
    } finally { await context.close(); }
  }
  for (const preference of ['1', '0']) {
    const { context, page } = await fresh(browser, server.url, 360, 800);
    try {
      await page.evaluate((p) => localStorage.setItem('tb_sidebar_collapsed', p), preference);
      await page.reload();
      await page.waitForFunction(() => window.__taskBoard?.state?.board?.issues?.length, null, { timeout: 20000 });
      await sleep(300);
      const before = await page.evaluate(() => {
        const b = document.getElementById('sidebar-toggle-btn-compact');
        const q = b.getBoundingClientRect();
        const h = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2);
        return { width: q.width, height: q.height, hit: h === b || b.contains(h), display: getComputedStyle(b).display, stored: localStorage.getItem('tb_sidebar_collapsed') };
      });
      await page.click('#sidebar-toggle-btn-compact');
      await sleep(200);
      const opened = await page.evaluate(() => {
        const s = document.getElementById('app-sidebar').getBoundingClientRect();
        const nav = document.getElementById('nav-canvas').getBoundingClientRect();
        return { x: s.x, width: s.width, right: s.right, navVisible: nav.width > 0 && nav.height > 0, open: document.body.classList.contains('sidebar-open') };
      });
      await page.screenshot({ path: path.join(SHOTS, `d38-drawer-360-pref-${preference}.png`) });
      await page.mouse.click(340, 420);
      await sleep(200);
      const closed = await page.evaluate(() => document.body.classList.contains('sidebar-open'));
      out.d38.push({ viewport: 360, preference, before, opened, closed });
      check(before.hit && before.width >= 44 && before.height >= 44 && before.display !== 'none' && before.stored === preference,
        `D38 phone compact toggle visible with persisted preference ${preference}`, { preference, before });
      check(Math.abs(opened.width - 280) < 1 && opened.x === 0 && opened.navVisible && opened.open,
        `D38 phone drawer opens full width with persisted preference ${preference}`, { preference, opened });
      check(closed === false, `D38 phone backdrop closes the drawer with preference ${preference}`, { preference, closed });
    } finally { await context.close(); }
  }
}

async function dragChecks(browser, server) {
  const { context, page } = await fresh(browser, server.url, 1280, 900);
  try {
    const key = 'chamberos/platform#2';
    const card = page.locator(`.canvas-card[data-issue-key="${key}"]`);
    const pos = () => card.evaluate((n) => ({ x: parseFloat(n.style.left), y: parseFloat(n.style.top) }));
    await page.evaluate(() => { const a = window.__taskBoard; const c = document.querySelector('.canvas-card[data-issue-key="chamberos/platform#2"]'); a.state.canvasScale = 1; a.state.canvasPanX = 24 - c.offsetLeft; a.state.canvasPanY = 50 - c.offsetTop; a.updateCanvasTransform(); });
    await sleep(150);
    const before = await pos();
    const box = await card.boundingBox();
    async function drag(dx, dy) {
      await page.mouse.move(box.x + 100, box.y + 26);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + 100 + (dx * i) / 10, box.y + 26 + (dy * i) / 10);
      await page.mouse.up();
    }
    const saved = page.waitForResponse((r) => r.url().endsWith('/issues/2/canvas') && r.request().method() === 'PUT', { timeout: 15000 });
    await drag(63, 47);
    const response = await saved;
    const payload = await response.json().catch(() => null);
    await sleep(600);
    const moved = await pos();
    await page.screenshot({ path: path.join(SHOTS, 'drag-saved-1280-light-en.png') });
    await page.reload();
    await page.waitForFunction(() => window.__taskBoard?.state?.board?.issues?.length && !window.__taskBoard.state.boardLoad, null, { timeout: 20000 });
    await page.evaluate(() => document.getElementById('nav-canvas').click());
    await sleep(400);
    const reloaded = await pos();
    out.drag = { before, moved, reloaded, status: response.status(), payload };
    check(response.ok() && moved.x === before.x + 63 && moved.y === before.y + 47 && reloaded.x === moved.x && reloaded.y === moved.y,
      'real pointer drag saves and survives reload', out.drag);

    // Refused save: one injected 403, exact rollback, no unhandled rejection.
    await page.evaluate(() => { const a = window.__taskBoard; const c = document.querySelector('.canvas-card[data-issue-key="chamberos/platform#2"]'); a.state.canvasScale = 1; a.state.canvasPanX = 24 - c.offsetLeft; a.state.canvasPanY = 50 - c.offsetTop; a.updateCanvasTransform(); });
    await sleep(150);
    const refusalBefore = await pos();
    let refusals = 0;
    const consoleStart = out.console.length;
    await page.route('**/api/repos/chamberos/platform/issues/2/canvas', (route) => {
      refusals++;
      return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'github_forbidden', message: 'Synthetic review refusal' }) });
    });
    const box2 = await card.boundingBox();
    await page.mouse.move(box2.x + 100, box2.y + 26);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(box2.x + 100 + (60 * i) / 10, box2.y + 26 + (40 * i) / 10);
    await page.mouse.up();
    await page.waitForFunction(() => { const n = document.getElementById('notice'); return n && !n.hidden && n.classList.contains('error'); }, null, { timeout: 12000 });
    await sleep(500);
    const refusalAfter = await pos();
    const notice = await page.locator('#notice').textContent();
    const unhandled = await page.evaluate(() => window.__unhandled);
    const expectedConsole = out.console.slice(consoleStart);
    out.refusal = { refusalBefore, refusalAfter, refusals, notice, unhandled, expectedConsole };
    check(refusals === 1 && refusalBefore.x === refusalAfter.x && refusalBefore.y === refusalAfter.y && /not saved|Could not save/i.test(notice) && unhandled.length === 0,
      'refused save rolls back without an unhandled rejection', out.refusal);
    check(expectedConsole.every((m) => m === 'Failed to load resource: the server responded with a status of 403 (Forbidden)'),
      'only the injected 403 resource diagnostic appears', out.refusal);
    await page.screenshot({ path: path.join(SHOTS, 'drag-refused-1280-light-en.png') });
    await page.unroute('**/api/repos/chamberos/platform/issues/2/canvas');
    out.console.splice(consoleStart);
  } finally { await context.close(); }
}

async function arrangeChecks(browser, server) {
  const { context, page } = await fresh(browser, server.url, 1280, 900);
  try {
    const readPositions = () => page.evaluate(() => Array.from(document.querySelectorAll('.canvas-card')).map((c) => ({
      key: c.getAttribute('data-issue-key'), x: parseFloat(c.style.left), y: parseFloat(c.style.top),
    })).sort((a, b) => a.key.localeCompare(b.key)));
    const before = await readPositions();
    await page.click('#canvas-arrange');
    await page.waitForFunction(() => !document.getElementById('canvas-arrange-dialog').hidden, null, { timeout: 5000 });
    const dialog = await page.evaluate(() => ({
      open: !document.getElementById('canvas-arrange-dialog').hidden,
      scopeAll: Boolean(document.getElementById('arrange-scope-all')),
      confirm: Boolean(document.getElementById('arrange-confirm-btn')),
    }));
    await page.click('#arrange-scope-all');
    await page.click('#arrange-confirm-btn');
    await page.waitForFunction(() => document.getElementById('canvas-arrange-dialog').hidden, null, { timeout: 30000 });
    await sleep(400);
    const arranged = await readPositions();
    const moved = arranged.filter((a) => { const b = before.find((x) => x.key === a.key); return b && (a.x !== b.x || a.y !== b.y); });
    await page.screenshot({ path: path.join(SHOTS, 'arrange-applied-1280-light-en.png') });
    const undoVisible = await page.locator('#canvas-arrange-undo').isVisible();
    await page.click('#canvas-arrange-undo');
    await page.waitForFunction(() => document.getElementById('canvas-arrange-undo').hidden, null, { timeout: 20000 }).catch(() => {});
    await sleep(600);
    const undone = await readPositions();
    out.arrange = { dialog, before, arranged, undone, movedKeys: moved.map((m) => m.key), undoVisible };
    check(dialog.open && dialog.scopeAll && dialog.confirm, 'Arrange dialog exposes scope and confirm', out.arrange);
    check(moved.length > 0, 'Arrange moves at least one card', out.arrange);
    check(undone.length === before.length && undone.every((u, i) => u.key === before[i].key && u.x === before[i].x && u.y === before[i].y),
      'Undo restores every card position exactly', out.arrange);
  } finally { await context.close(); }
}

async function reducedMotion(browser, server) {
  const { context, page } = await fresh(browser, server.url, 360, 800);
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => { const a = window.__taskBoard; const c = document.querySelector('.canvas-card[data-issue-key="chamberos/platform#2"]'); a.state.canvasScale = 1; a.state.canvasPanX = 24 - c.offsetLeft; a.state.canvasPanY = 50 - c.offsetTop; a.updateCanvasTransform(); });
    await page.click('.canvas-card[data-issue-key="chamberos/platform#2"] .card-dependency-focus');
    const early = await page.evaluate(() => { const s = window.__taskBoard.state; return { panX: s.canvasPanX, panY: s.canvasPanY, scale: s.canvasScale }; });
    await sleep(500);
    const late = await page.evaluate(() => { const s = window.__taskBoard.state; return { panX: s.canvasPanX, panY: s.canvasPanY, scale: s.canvasScale }; });
    out.reducedMotion = { early, late };
    check(JSON.stringify(early) === JSON.stringify(late), 'reduced motion applies the focus framing without delayed movement', out.reducedMotion);
  } finally { await context.close(); }
}

async function keyboardAndSheets(browser, server) {
  const results = [];
  for (const [width, theme, lang] of [[360, 'dark', 'fr'], [1280, 'light', 'en']]) {
    const height = width <= 390 ? 800 : 900;
    const { context, page } = await fresh(browser, server.url, width, height, theme, lang);
    try {
      for (const kind of ['filter', 'settings', 'sort']) {
        if (kind === 'filter') await page.click('#applied-filter-btn');
        else if (kind === 'settings') {
          if (width <= 768) await page.click('#sidebar-toggle-btn-compact');
          await page.click('#settings-btn');
        } else await page.evaluate(() => window.__taskBoard.openSheet('sort', document.getElementById('applied-filter-btn')));
        await page.waitForFunction(() => document.getElementById('board-sheet').open, null, { timeout: 5000 });
        await sleep(150);
        const controls = page.locator('#board-sheet button, #board-sheet input, #board-sheet select, #board-sheet textarea');
        const first = controls.first(), last = controls.last();
        await last.focus();
        await page.keyboard.press('Tab');
        const forward = await first.evaluate((n) => document.activeElement === n);
        await page.keyboard.press('Shift+Tab');
        const backward = await last.evaluate((n) => document.activeElement === n);
        const metrics = await controls.evaluateAll((ns) => ns.map((n) => { const r = n.getBoundingClientRect(); return { width: r.width, height: r.height, text: n.textContent.slice(0, 30) }; }));
        const locked = await page.evaluate(() => document.body.classList.contains('sheet-open') && scrollY === 0);
        await page.keyboard.press('Escape');
        await sleep(200);
        const closed = await page.evaluate(() => ({ open: document.getElementById('board-sheet').open, focus: document.activeElement.id }));
        results.push({ width, theme, lang, kind, forward, backward, locked, closed, small: metrics.filter((m) => m.height > 0 && m.height < 44) });
        check(forward && backward && locked && !closed.open, `sheet keyboard/lock ${kind} ${width} ${lang}`, results.at(-1));
        if (width <= 390) check(metrics.filter((m) => m.height > 0 && m.height < 44).length === 0, `sheet controls meet 44px ${kind} ${width} ${lang}`, results.at(-1));
        if (width <= 768 && await page.evaluate(() => document.body.classList.contains('sidebar-open'))) await page.mouse.click(width - 20, 400);
      }
      out.sheets = results;
      // Enter opens the issue drawer from a focused canvas card.
      const card = page.locator('.canvas-card[data-issue-key="chamberos/platform#2"]');
      await card.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => !document.getElementById('detail-view').hidden, null, { timeout: 5000 });
      const drawer = await page.evaluate(() => ({ open: !document.getElementById('detail-view').hidden, title: document.getElementById('detail-title')?.textContent }));
      out.keyboard = { ...(out.keyboard || {}), [`${width}`]: drawer };
      check(drawer.open, `keyboard Enter opens the issue drawer at ${width}`, drawer);
      await page.click('#back-btn');
      await sleep(250);
      check(await page.evaluate(() => document.getElementById('detail-view').hidden), `back closes the issue drawer at ${width}`, drawer);
    } finally { await context.close(); }
  }
}

let browser, server;
try {
  browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  out.browser = await browser.version();
  server = await normalPreview();
  await d38(browser, server);
  await dragChecks(browser, server);
  await arrangeChecks(browser, server);
  await reducedMotion(browser, server);
  await keyboardAndSheets(browser, server);
  check(!out.errors.length && !out.console.length, 'zero unexpected browser diagnostics', { errors: out.errors, console: out.console });
} catch (error) {
  fail('regression probe interrupted', String(error.stack || error));
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
  write();
}
console.log(JSON.stringify({ checks: out.checks, failures: out.failures.map((f) => f.label), browser: out.browser, sheets: out.sheets.length, d38: out.d38.length }, null, 2));
process.exitCode = out.failures.length ? 1 : 0;
