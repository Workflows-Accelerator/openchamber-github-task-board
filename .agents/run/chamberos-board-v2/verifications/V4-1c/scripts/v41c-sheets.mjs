// V4-1c re-verification of the independent L4 sheet lifecycle matrix: 8 surfaces x 4 viewports x 2 themes x 2 languages.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOARD_PASSWORD, startBoard } from '../../../../../../web/tests/helpers.mjs';
import { startFakeGitHub, makeIssue } from '../../../../../../web/tests/fake-github.mjs';

let pkg;
try { pkg = await import('/workspace/personal/lucas/charme-social/node_modules/playwright/index.js'); }
catch { pkg = await import('playwright'); }
const { chromium } = pkg.default || pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..');
const SHOTS = path.join(OUT, 'screenshots');
const CHROME = process.env.H2_CHROME || '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
fs.mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function preview() {
  const fake = await startFakeGitHub({
    repositories: [
      { repo: 'chamberos/platform', id: 101, hasIssues: true, issues: [
        makeIssue({ number: 1, repo: 'chamberos/platform', title: 'Deploy regional ingress verification', body: '<!-- board-canvas: {"x":80,"y":90} -->\n## Overview\nCoordinate edge verification.\n\n## Open Questions\n- [ ] Approve topology? (Active-active | Primary-standby)', labels: ['status:needs-human', 'priority:urgent'], updated_at: '2026-11-10T14:20:00Z' }),
        makeIssue({ number: 2, repo: 'chamberos/platform', title: 'Wire conditional ETag revalidation across board routes', body: '<!-- board-canvas: {"x":460,"y":90} -->\n## Overview\nReduce poll overhead.', labels: ['status:in-progress', 'priority:high'], updated_at: '2026-11-10T12:00:00Z' }),
        makeIssue({ number: 3, repo: 'chamberos/platform', title: 'Audit strict CSP headers on workspace shell', body: '<!-- board-canvas: {"x":840,"y":90} -->\n## Overview\nEnsure style-src self.', labels: ['status:in-review', 'priority:high'], updated_at: '2026-11-09T16:30:00Z' }),
        makeIssue({ number: 4, repo: 'chamberos/platform', title: 'Publish release checksum manifest', body: '<!-- board-canvas: {"x":460,"y":300} -->\n## Overview\nGenerate manifest.', labels: ['status:todo', 'priority:medium'], updated_at: '2026-11-08T11:00:00Z' }),
      ] },
      { repo: 'acme/vanilla-sdk', id: 102, hasIssues: true, issues: [
        makeIssue({ number: 11, repo: 'acme/vanilla-sdk', title: 'Document TypeScript pagination iterator types', body: '<!-- board-canvas: {"x":460,"y":560} -->\nAdd examples.', labels: ['priority:low'], updated_at: '2026-11-10T09:45:00Z' }),
      ] },
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
  await page.waitForSelector('#login-form');
  await page.evaluate((pwd) => { const i = document.getElementById('password'); i.value = pwd; i.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('login-form').requestSubmit(); }, BOARD_PASSWORD);
  await page.waitForFunction(() => window.__taskBoard?.state?.board?.issues?.length >= 4, null, { timeout: 20000 });
}

async function allScope(page) {
  const w = page.viewportSize().width;
  await page.click(w > 768 ? '#repo-select-btn' : '#compact-project');
  await page.waitForSelector('#repo-options-list .repo-option');
  await page.evaluate(() => Array.from(document.querySelectorAll('#repo-options-list .repo-option')).find((n) => /All Projects|Tous les projets/.test(n.textContent)).click());
  await page.waitForFunction(() => window.__taskBoard.state.selected === 'all' && !window.__taskBoard.state.boardLoad, null, { timeout: 20000 });
}

const vision = () => {
  const app = window.__taskBoard;
  return { platform: navigator.platform, ua: navigator.userAgent, vw: innerWidth, vh: innerHeight };
};

const geometry = (id) => {
  const d = document.getElementById(id);
  const r = d.getBoundingClientRect();
  const content = d.querySelector('.sheet-content');
  const foot = d.querySelector('.sheet-footer');
  const fR = foot ? foot.getBoundingClientRect() : null;
  const controls = Array.from(d.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')).filter((n) => !n.disabled && n.getClientRects().length);
  const sizes = controls.map((n) => { const b = n.getBoundingClientRect(); return { id: n.id || n.className || n.tagName, w: Math.round(b.width), h: Math.round(b.height) }; });
  const vp = document.getElementById('canvas-viewport').getBoundingClientRect();
  return {
    open: d.open,
    rect: { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom },
    footer: fR ? { bottom: fR.bottom, height: fR.height } : null,
    bodyOverflowY: content ? getComputedStyle(content).overflowY : null,
    overscroll: content ? getComputedStyle(content).overscrollBehaviorY : null,
    bodyClass: document.body.className,
    bodyOverflow: getComputedStyle(document.body).overflow,
    scrollY,
    documentWidth: document.documentElement.scrollWidth,
    viewportRect: { x: vp.x, w: vp.width, h: vp.height },
    focusInside: d.contains(document.activeElement),
    activeId: document.activeElement ? (document.activeElement.id || document.activeElement.className || document.activeElement.tagName) : null,
    controlCount: controls.length,
    minControlHeight: sizes.length ? Math.min(...sizes.map((s) => s.h)) : null,
    tinyControls: sizes.filter((s) => s.h > 0 && s.h < 44).slice(0, 8),
    titleText: (d.querySelector('.sheet-head h2, .sheet-head .sheet-title') || {}).textContent || null,
  };
};

async function run() {
  const p = await preview();
  let browser;
  const out = { surfaces: [], nested: null, errors: [], console: [], csp: [] };
  try {
    browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
    await ctx.addInitScript(() => { window.__cspViolations = []; window.addEventListener('securitypolicyviolation', (e) => window.__cspViolations.push(e.violatedDirective + ' ' + (e.blockedURI || ''))); });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => out.errors.push(String(e.message || e)));
    page.on('console', (m) => { if (m.type() === 'error') out.console.push(m.text()); });
    await login(page, p.url);
    await allScope(page);
    out.vision = await page.evaluate(vision);

    const matrix = [];
    for (const width of [360, 390, 768, 1280]) {
      const height = width <= 390 ? 800 : 900;
      for (const theme of ['light', 'dark']) for (const lang of ['en', 'fr']) matrix.push({ width, height, theme, lang });
    }

    const surfaces = [
      { kind: 'filter', id: 'board-sheet', close: '#sheet-close', open: async (pg) => { await pg.click('#applied-filter-btn'); } },
      { kind: 'settings', id: 'board-sheet', close: '#sheet-close', open: async (pg) => { await pg.evaluate(() => window.__taskBoard.openSheet('settings', document.getElementById('applied-filter-btn'))); } },
      { kind: 'sort', id: 'board-sheet', close: '#sheet-close', open: async (pg) => { await pg.evaluate(() => window.__taskBoard.openSheet('sort', document.getElementById('applied-filter-btn'))); } },
      { kind: 'view', id: 'board-sheet', close: '#sheet-close', open: async (pg) => { await pg.evaluate(() => window.__taskBoard.openSheet('view', document.getElementById('applied-filter-btn'))); } },
      { kind: 'project', id: 'repo-popover', close: '#repo-popover .sheet-dismiss', open: async (pg) => { await pg.evaluate(() => { const b = innerWidth > 768 ? document.getElementById('repo-select-btn') : document.getElementById('compact-project'); b.focus(); b.click(); }); } },
      { kind: 'composer', id: 'composer-dialog', close: '#composer-dialog .sheet-dismiss', open: async (pg) => { await pg.evaluate(() => { const b = innerWidth > 768 ? document.getElementById('new-task-btn') : document.getElementById('compact-new'); b.focus(); b.click(); }); } },
      { kind: 'arrange', id: 'canvas-arrange-dialog', close: '#canvas-arrange-dialog .sheet-dismiss', open: async (pg) => { await pg.click('#canvas-arrange'); } },
      { kind: 'relationship', id: 'canvas-wire-confirm', close: '#canvas-wire-confirm .sheet-dismiss', open: async (pg) => { await pg.evaluate(() => { document.getElementById('canvas-arrange').focus(); document.querySelector('.canvas-wire-hit').dispatchEvent(new MouseEvent('click', { bubbles: true })); }); } },
    ];

    const activeMatrix = process.env.L4_QUICK ? [matrix[0]] : matrix;
    for (const c of activeMatrix) {
      await page.setViewportSize({ width: c.width, height: c.height });
      await page.evaluate(([t, l]) => { window.__taskBoard.setThemeMode(t); window.__taskBoard.setLanguage(l); }, [c.theme, c.lang]);
      await page.evaluate(() => document.getElementById('nav-canvas').click());
      await page.waitForFunction(() => !document.getElementById('canvas-viewport').hidden && document.querySelectorAll('.canvas-card').length >= 4);
      await sleep(250);
      for (const s of surfaces) {
        console.log('surface', c.width, c.theme, c.lang, s.kind);
        try {
        await page.evaluate(() => window.__taskBoard.state.viewState.filters = []);
        const opener = await page.evaluate(() => document.activeElement ? (document.activeElement.id || document.activeElement.className) : null);
        await s.open(page);
        await page.waitForFunction((id) => document.getElementById(id).open, s.id, { timeout: 8000 });
        await sleep(220);
        await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
        const openGeo = await page.evaluate(geometry, s.id);
        // Real keyboard focus wrap both ways.
        const wrap = await page.evaluate((id) => {
          const d = document.getElementById(id);
          const ns = Array.from(d.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')).filter((n) => !n.disabled && n.getClientRects().length);
          const first = ns[0], last = ns[ns.length - 1];
          last.focus();
          return { firstId: first ? (first.id || first.className) : null, lastId: last ? (last.id || last.className) : null };
        }, s.id);
        await page.keyboard.press('Tab');
        const forward = await page.evaluate((id) => {
          const d = document.getElementById(id);
          const ns = Array.from(d.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')).filter((n) => !n.disabled && n.getClientRects().length);
          return document.activeElement === ns[0];
        }, s.id);
        await page.evaluate((id) => {
          const d = document.getElementById(id);
          const ns = Array.from(d.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')).filter((n) => !n.disabled && n.getClientRects().length);
          ns[0].focus();
        }, s.id);
        await page.keyboard.press('Shift+Tab');
        const backward = await page.evaluate((id) => {
          const d = document.getElementById(id);
          const ns = Array.from(d.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')).filter((n) => !n.disabled && n.getClientRects().length);
          return document.activeElement === ns[ns.length - 1];
        }, s.id);
        if (s.kind === 'filter' || s.kind === 'settings' || s.kind === 'sort' || s.kind === 'view') {
          await page.screenshot({ path: path.join(SHOTS, `v41c-sheet-${s.kind}-${c.width}-${c.theme}-${c.lang}.png`) });
        }
        // Close by button.
        await page.click(s.close);
        await page.waitForFunction((id) => !document.getElementById(id).open, s.id);
        await sleep(120);
        const byButton = await page.evaluate((id) => {
          const d = document.getElementById(id);
          return { open: d.open, bodyClass: document.body.className, restored: !d._sheetOpener || document.activeElement === d._sheetOpener };
        }, s.id);
        // Escape.
        await s.open(page);
        await page.waitForFunction((id) => document.getElementById(id).open, s.id);
        await sleep(160);
        await page.keyboard.press('Escape');
        await page.waitForFunction((id) => !document.getElementById(id).open, s.id);
        await sleep(220);
        const byEscape = await page.evaluate((id) => ({ open: document.getElementById(id).open, bodyClass: document.body.className }), s.id);
        // Backdrop.
        await s.open(page);
        await page.waitForFunction((id) => document.getElementById(id).open, s.id);
        await sleep(160);
        await page.mouse.click(2, 2);
        await sleep(200);
        const byBackdrop = await page.evaluate((id) => ({ open: document.getElementById(id).open, bodyClass: document.body.className }), s.id);
        const pass = openGeo.open && openGeo.focusInside && forward && backward
          && openGeo.rect.x >= -0.5 && openGeo.rect.right <= c.width + 0.5 && openGeo.rect.bottom <= c.height + 0.5
          && openGeo.footer && openGeo.footer.height >= 44 && openGeo.footer.bottom <= openGeo.rect.bottom + 0.5
          && (c.width > 768 || openGeo.rect.h <= c.height * 0.85 + 1)
          && openGeo.documentWidth <= c.width
          && openGeo.rect.y >= -0.5
          && byButton.open === false && byEscape.open === false && byBackdrop.open === false
          && !/\bsheet-open\b/.test(byButton.bodyClass) && !/\bsheet-open\b/.test(byEscape.bodyClass) && !/\bsheet-open\b/.test(byBackdrop.bodyClass)
          && openGeo.bodyOverflowY === 'auto' && openGeo.overscroll === 'contain';
        out.surfaces.push({ case: c, kind: s.kind, openGeo, wrap, forward, backward, byButton, byEscape, byBackdrop, pass });
        } catch (error) {
          out.surfaces.push({ case: c, kind: s.kind, error: String(error && error.message || error), pass: false });
          await page.evaluate(() => { document.querySelectorAll('dialog[open]').forEach((d) => { try { d.close(); } catch (_) {} }); document.body.classList.remove('sheet-open'); });
          await page.keyboard.press('Escape').catch(() => {});
        }
      }
    }

    // Nested sheets: open the board sheet, then programmatically open the composer
    // over it. Closing the top sheet must keep the page locked; closing the last
    // must clear body.sheet-open.
    await page.setViewportSize({ width: 360, height: 800 });
    await page.evaluate(() => { window.__taskBoard.openSheet('filter', document.getElementById('applied-filter-btn')); document.getElementById('compact-new').click(); });
    await page.waitForFunction(() => document.getElementById('composer-dialog').open);
    const both = await page.evaluate(() => ({ open: document.querySelectorAll('dialog[open]').length, body: document.body.className }));
    await page.click('#composer-dialog .sheet-dismiss');
    await page.waitForFunction(() => !document.getElementById('composer-dialog').open);
    await sleep(150);
    const afterTop = await page.evaluate(() => ({ open: document.querySelectorAll('dialog[open]').length, body: document.body.className, boardOpen: document.getElementById('board-sheet').open }));
    await page.click('#sheet-close');
    await page.waitForFunction(() => !document.getElementById('board-sheet').open);
    await sleep(150);
    const afterLast = await page.evaluate(() => ({ open: document.querySelectorAll('dialog[open]').length, body: document.body.className }));
    out.nested = { both, afterTop, afterLast, pass: both.open === 2 && /\bsheet-open\b/.test(afterTop.body) && afterTop.boardOpen && afterLast.open === 0 && !/\bsheet-open\b/.test(afterLast.body) };

    out.csp = await page.evaluate(() => window.__cspViolations || []);
    out.summary = {
      cases: out.surfaces.length,
      passed: out.surfaces.filter((s) => s.pass).length,
      failed: out.surfaces.filter((s) => !s.pass).map((s) => ({ case: s.case, kind: s.kind, error: s.error || null, openGeo: s.openGeo || null, forward: s.forward, backward: s.backward, byButton: s.byButton, byEscape: s.byEscape, byBackdrop: s.byBackdrop })),
      minControlHeightAcross: Math.min(...out.surfaces.map((s) => (s.openGeo && s.openGeo.minControlHeight) ?? 99)),
      nested: out.nested,
      errors: out.errors,
      console: out.console,
      csp: out.csp,
    };
    fs.writeFileSync(path.join(OUT, 'v41c-sheets.json'), JSON.stringify(out, null, 2) + '\n');
    console.log(JSON.stringify({ cases: out.summary.cases, passed: out.summary.passed, failed: out.summary.failed.length, minControlHeightAcross: out.summary.minControlHeightAcross, nested: out.summary.nested, errors: out.errors, console: out.console, csp: out.csp }, null, 2));
    if (out.summary.failed.length || out.errors.length || out.console.length || out.csp.length || !out.nested.pass) process.exitCode = 1;
    if (out.summary.failed.length) console.log(JSON.stringify(out.summary.failed.slice(0, 3), null, 2));
  } finally {
    if (browser) await browser.close().catch(() => {});
    await p.close();
  }
}

run().catch((e) => { console.error('L4 SHEETS FAILED', e); process.exit(1); });
