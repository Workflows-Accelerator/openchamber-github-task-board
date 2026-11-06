// Hostile2 criterion 2: Canvas HUD containment, clickability (elementFromPoint), single-line labels,
// overlap with sidebar toggles, in real Chromium. Also tests the hidden "Undo arrange" button revealed
// (DOM attribute only, no arrange is executed, no data mutation).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '/workspace/personal/lucas/charme-social/node_modules/playwright/index.js';

const { chromium } = pkg.default || pkg;
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '..');
const SHOTS = path.join(OUT, 'screenshots');
const PREVIEW = 'http://127.0.0.1:4041';

const browser = await chromium.launch({ executablePath: process.env.H2_CHROME, headless: true, args: ['--no-sandbox'] });
const results = [];
const errors = [];

async function measure(page) {
  return page.evaluate(() => {
    const hud = document.getElementById('canvas-controls');
    const W = window.innerWidth;
    const hr = hud.getBoundingClientRect();
    const toggles = ['sidebar-toggle-btn-compact', 'sidebar-toggle-btn'].map((id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
      return { id, visible, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }).filter(Boolean);
    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const buttons = [...hud.querySelectorAll('.canvas-control-btn')].filter((b) => !b.hidden).map((b) => {
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      const lineHeight = parseFloat(getComputedStyle(b).lineHeight) || 16;
      const range = document.createRange(); range.selectNodeContents(b);
      const lines = new Set([...range.getClientRects()].map((q) => Math.round(q.top))).size;
      return {
        id: b.id, text: b.textContent.trim(),
        rect: { left: +r.left.toFixed(1), right: +r.right.toFixed(1), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) },
        insideViewport: r.left >= 0 && r.right <= W && r.width > 0,
        clickable: hit === b || b.contains(hit),
        textLines: lines,
        overlapsToggle: toggles.filter((t) => t.visible && overlaps(r, t)).map((t) => t.id),
        scrollOverflow: b.scrollWidth > b.clientWidth + 1,
      };
    });
    return { W, hud: { left: hr.left, right: hr.right, top: hr.top, bottom: hr.bottom, width: hr.width, height: hr.height }, toggles, buttons,
      docOverflow: document.documentElement.scrollWidth > W };
  });
}

const matrix = [];
for (const w of [360, 768, 1280]) for (const lang of ['en', 'fr']) for (const theme of ['light', 'dark']) matrix.push({ w, lang, theme });

for (const c of matrix) {
  const ctx = await browser.newContext({ viewport: { width: c.w, height: c.w === 360 ? 800 : 900 }, serviceWorkers: 'block', isMobile: c.w <= 768, hasTouch: c.w <= 768 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${c.w}-${c.lang}-${c.theme}: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${c.w}-${c.lang}-${c.theme}: ${m.text()}`); });
  await page.addInitScript(([lang, theme]) => { localStorage.setItem('tb_lang', lang); localStorage.setItem('tb_theme_mode', theme); }, [c.lang, c.theme]);
  await page.goto(PREVIEW);
  await page.locator('#password').fill('correct horse battery staple');
  await page.locator('#password').press('Enter');
  await page.locator('#board-view').waitFor({ state: 'visible' });
  await page.waitForFunction(() => (window.__taskBoard?.state?.board?.issues?.length || 0) >= 8);
  // Navigate to canvas; on narrow widths the sidebar is an overlay, so use showView via the nav button through JS click.
  await page.evaluate(() => document.getElementById('nav-canvas').click());
  await page.waitForFunction(() => document.querySelectorAll('.canvas-card').length >= 8);
  await page.evaluate(() => { const b = document.getElementById('sidebar-backdrop'); if (b && !b.hidden) b.click(); });
  await page.evaluate(() => window.__taskBoard.fitAllCanvasNodes());
  await page.waitForTimeout(250);
  const lang = await page.evaluate(() => document.getElementById('canvas-fit-all').textContent.trim());
  const base = await measure(page);
  const shot = `chromium-hud-${c.w}-${c.lang}-${c.theme}.png`;
  await page.screenshot({ path: path.join(SHOTS, shot) });
  // Reveal Undo arrange (as after an Arrange) without running arrange.
  await page.evaluate(() => { document.getElementById('canvas-arrange-undo').hidden = false; });
  await page.waitForTimeout(100);
  const withUndo = await measure(page);
  const shotUndo = `chromium-hud-${c.w}-${c.lang}-${c.theme}-undo-visible.png`;
  if (c.w === 360 || c.theme === 'light') await page.screenshot({ path: path.join(SHOTS, shotUndo) });
  const ok = (m) => m.buttons.every((b) => b.insideViewport && b.clickable && b.textLines === 1 && b.overlapsToggle.length === 0) && !m.docOverflow;
  results.push({ ...c, fitAllLabel: lang, base, basePass: ok(base), withUndo, withUndoPass: ok(withUndo), screenshot: shot });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'hud-matrix-chromium.json'), JSON.stringify({ browser: 'chrome-headless-shell 156.0.8078.4', errors, results }, null, 2) + '\n');
for (const r of results) {
  const fail = (m) => m.buttons.filter((b) => !(b.insideViewport && b.clickable && b.textLines === 1 && b.overlapsToggle.length === 0)).map((b) => `${b.id}[in=${b.insideViewport},click=${b.clickable},lines=${b.textLines},tog=${b.overlapsToggle}]`);
  console.log(`${r.w} ${r.lang} ${r.theme} label="${r.fitAllLabel}" hud=${Math.round(r.base.hud.left)}..${Math.round(r.base.hud.right)}x${Math.round(r.base.hud.height)} base=${r.basePass ? 'PASS' : 'FAIL ' + fail(r.base)} undo=${r.withUndoPass ? 'PASS' : 'FAIL ' + fail(r.withUndo)} undoHud=${Math.round(r.withUndo.hud.left)}..${Math.round(r.withUndo.hud.right)}x${Math.round(r.withUndo.hud.height)}`);
}
console.log('errors', errors.length, errors.slice(0, 5));
