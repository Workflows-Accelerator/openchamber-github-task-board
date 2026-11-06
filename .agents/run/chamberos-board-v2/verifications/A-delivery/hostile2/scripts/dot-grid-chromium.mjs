// Hostile2 criterion 1: dot grid in real Chromium (chrome-headless-shell 156, Playwright 1.63).
// Read-only against preview :4041 (synthetic GitHub). Never clicks Arrange or mutates issues.
// Usage: . /tmp/opencode/hostile2-chromium-env.sh && node <this file>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '/workspace/personal/lucas/charme-social/node_modules/playwright/index.js';

const { chromium } = pkg.default || pkg;
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '..');
const SHOTS = path.join(OUT, 'screenshots');
const PREVIEW = 'http://127.0.0.1:4041';
const PASSWORD = 'correct horse battery staple';
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.H2_CHROME, headless: true, args: ['--no-sandbox'] });
const results = { browser: browser.version(), app: [], standalone: [] };

// Pixel stats over an empty region of a screenshot, computed in a scratch page canvas.
async function stats(page, buf, clip) {
  const dataUrl = 'data:image/png;base64,' + buf.toString('base64');
  return page.evaluate(async ({ dataUrl, clip }) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = clip.w; c.height = clip.h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, clip.x, clip.y, clip.w, clip.h, 0, 0, clip.w, clip.h);
    const d = ctx.getImageData(0, 0, clip.w, clip.h).data;
    const lum = [];
    for (let i = 0; i < d.length; i += 4) lum.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
    const counts = new Map();
    for (const v of lum) { const k = Math.round(v); counts.set(k, (counts.get(k) || 0) + 1); }
    const mode = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const off = lum.filter((v) => Math.abs(v - mode) > 3).length;
    return {
      min: Math.round(Math.min(...lum)), max: Math.round(Math.max(...lum)),
      backgroundLum: mode,
      maxDeviation: Math.round(Math.max(...lum.map((v) => Math.abs(v - mode)))),
      nonBackgroundPixelPct: Math.round((off / lum.length) * 10000) / 100,
    };
  }, { dataUrl, clip });
}

// ---------- App canvas on preview ----------
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(PREVIEW);
await page.locator('#password').fill(PASSWORD);
await page.locator('#password').press('Enter');
await page.locator('#board-view').waitFor({ state: 'visible' });
await page.waitForFunction(() => (window.__taskBoard?.state?.board?.issues?.length || 0) >= 8);
await page.click('#nav-canvas');
await page.waitForFunction(() => document.querySelectorAll('.canvas-card').length >= 8);
await page.waitForTimeout(300);

for (const theme of ['light', 'dark']) {
  await page.evaluate((t) => window.__taskBoard.setThemeMode(t), theme);
  for (const scale of [0.25, 0.5, 0.72, 1.0, 2.0]) {
    // Pan far away from cards so the sampled region is pure grid.
    await page.evaluate((s) => {
      const tb = window.__taskBoard;
      tb.state.canvasScale = s;
      tb.state.canvasPanX = -20000;
      tb.state.canvasPanY = -20000;
      tb.updateCanvasTransform();
    }, scale);
    await page.waitForTimeout(150);
    const vp = await page.evaluate(() => {
      const v = document.getElementById('canvas-viewport');
      const r = v.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
        bg: v.style.backgroundImage, size: v.style.backgroundSize, readout: document.getElementById('canvas-zoom-readout').textContent };
    });
    const name = `chromium-app-grid-${theme}-${String(Math.round(scale * 100)).padStart(3, '0')}.png`;
    const buf = await page.screenshot({ path: path.join(SHOTS, name) });
    const s = await stats(page, buf, { x: vp.x + 40, y: vp.y + 120, w: 300, h: 300 });
    results.app.push({ theme, scale, readout: vp.readout, backgroundImage: vp.bg, backgroundSize: vp.size, screenshot: name, emptyRegionStats: s });
  }
}

// Same composition as delivery shot 02 (fit-all from the delivery script, 72%), light + dark, real Chromium.
await page.evaluate(() => { localStorage.removeItem('tb_canvas_view_state'); });
for (const theme of ['light', 'dark']) {
  await page.evaluate((t) => window.__taskBoard.setThemeMode(t), theme);
  await page.evaluate(() => window.__taskBoard.fitAllCanvasNodes());
  await page.waitForTimeout(200);
  const readout = await page.locator('#canvas-zoom-readout').textContent();
  const name = `chromium-canvas-fit-1280-${theme}-en.png`;
  await page.screenshot({ path: path.join(SHOTS, name) });
  results.app.push({ theme, fitAll: true, readout, screenshot: name });
}
results.appErrors = errors;
await ctx.close();

// ---------- Standalone page: identical gradient values, no app code ----------
const sctx = await browser.newContext({ viewport: { width: 800, height: 400 } });
const sp = await sctx.newPage();
for (const theme of [{ name: 'light', bg: '#f6f4ee', rgb: '24, 22, 19' }, { name: 'dark', bg: '#151412', rgb: '244, 241, 234' }]) {
  for (const scale of [0.25, 0.5, 0.72, 1.0, 2.0]) {
    const worldStep = scale < 0.35 ? 96 : scale < 0.65 ? 48 : 24;
    const gridStep = worldStep * scale;
    const r = Math.max(0.75, Math.min(2.0, 0.85 + 0.4 * scale));
    const alpha = Math.max(0.10, Math.min(0.18, 0.10 + 0.06 * scale)).toFixed(4);
    const grad = `radial-gradient(rgba(${theme.rgb}, ${alpha}) ${r.toFixed(2)}px, transparent ${r.toFixed(2)}px)`;
    await sp.setContent(`<!doctype html><html><body style="margin:0;background:${theme.bg}">
      <div style="width:800px;height:400px;background-color:${theme.bg};background-image:${grad};background-size:${gridStep.toFixed(2)}px ${gridStep.toFixed(2)}px"></div></body></html>`);
    const name = `chromium-standalone-${theme.name}-${String(Math.round(scale * 100)).padStart(3, '0')}.png`;
    const buf = await sp.screenshot({ path: path.join(SHOTS, name) });
    const s = await stats(sp, buf, { x: 50, y: 50, w: 300, h: 300 });
    results.standalone.push({ theme: theme.name, scale, gridStep: Number(gridStep.toFixed(2)), dotRadius: Number(r.toFixed(2)), alpha: Number(alpha), gradient: grad, screenshot: name, stats: s });
  }
}
await sctx.close();
await browser.close();

fs.writeFileSync(path.join(OUT, 'dot-grid-chromium.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ browser: results.browser, appErrors: results.appErrors,
  app: results.app.map((a) => ({ theme: a.theme, scale: a.scale ?? 'fit', readout: a.readout, s: a.emptyRegionStats })),
  standalone: results.standalone.map((a) => ({ theme: a.theme, scale: a.scale, s: a.stats })) }, null, 1));
