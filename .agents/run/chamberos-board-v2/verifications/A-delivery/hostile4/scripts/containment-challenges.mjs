// hostile4: independent vertical-containment injections against scripts/generate-delivery-smoke.mjs.
// Disposable copies under /tmp/opencode only. Injections change browser style only, never verdict variables.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const out = path.join(root, '.agents/run/chamberos-board-v2/verifications/A-delivery/hostile4');
fs.mkdirSync(path.join(out, 'raw'), { recursive: true });
const temp = fs.mkdtempSync('/tmp/opencode/hostile4-smoke-');
const source = fs.readFileSync('scripts/generate-delivery-smoke.mjs', 'utf8')
  .replace("'../web/tests/helpers.mjs'", JSON.stringify(path.join(root, 'web/tests/helpers.mjs')));
const anchor = '    const metrics = await page.evaluate(() => {';
if (!source.includes(anchor)) throw new Error('Missing anchor');

// Each injection runs before every matrix measurement. `style(id, css)` helper is defined in-page.
const inPage = (body) => `await page.evaluate(() => { const a = document.getElementById("canvas-arrange"); const vp = document.getElementById("canvas-viewport").getBoundingClientRect(); a.style.cssText = ""; const r0 = a.getBoundingClientRect(); ${body} });`;
const faults = {
  baseline: '',
  // Mechanism other than transform: relative `top` offset.
  relTopAbove: inPage('a.style.position = "relative"; a.style.top = "-2000px";'),
  relTopBelow: inPage('a.style.position = "relative"; a.style.top = "2000px";'),
  // Partial: bottom edge ~10px below the canvas viewport bottom (control still mostly visible-height straddling the edge).
  partialBelowVp: inPage('a.style.position = "relative"; a.style.top = (vp.bottom - r0.bottom + 10) + "px";'),
  // Partial above the canvas viewport but INSIDE the window (isolates the viewport-rect check from the window check).
  partialAboveVpInWindow: inPage('a.style.position = "relative"; a.style.top = (vp.top - r0.top - 10) + "px";'),
  // Margin mechanism.
  marginTopAbove: inPage('a.style.marginTop = "-3000px";'),
  // Fixed positioning, placed below the window.
  fixedBelow: inPage('a.style.position = "fixed"; a.style.left = r0.left + "px"; a.style.top = (window.innerHeight + 50) + "px";'),
  // Whole HUD container moved, not a single control.
  hudContainerAbove: 'await page.evaluate(() => { document.getElementById("canvas-controls").style.transform = "translateY(-2000px)"; });',
  // Visible-filter gaming: offscreen but not display:none.
  opacityZeroBelow: inPage('a.style.opacity = "0"; a.style.position = "relative"; a.style.top = "2000px";'),
  visibilityHiddenBelow: inPage('a.style.visibility = "hidden"; a.style.position = "relative"; a.style.top = "2000px";'),
  tinyScaleBelow: inPage('a.style.transform = "translateY(2000px) scale(0.05)";'),
  // Reference only: display:none removes the control from layout; expected to be skipped (not offscreen, absent).
  displayNoneReference: inPage('a.style.display = "none";'),
  // Vacuity probes: does containment still pass when NO control is measured?
  hudDisplayNone: 'await page.evaluate(() => { document.getElementById("canvas-controls").style.display = "none"; });',
  canvasViewNotShown: 'await page.evaluate(() => document.getElementById("nav-list").click()); await sleep(300);',
};
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const outJson = process.env.OUT_JSON || 'containment-challenges.json';

const results = [];
for (const [name, injection] of Object.entries(faults).filter(([n]) => !only || only.includes(n))) {
  const file = path.join(temp, `${name}.mjs`);
  fs.writeFileSync(file, source.replace(anchor, injection + '\n' + anchor));
  const destination = path.join(temp, name);
  const run = spawnSync(process.execPath, [file], { env: { ...process.env, DELIVERY_DIR: destination }, timeout: 180000, encoding: 'utf8' });
  fs.writeFileSync(path.join(out, 'raw', `smoke-${name}.log`), (run.stdout || '') + (run.stderr || ''));
  const smokeFile = path.join(destination, 'smoke.json');
  const smoke = fs.existsSync(smokeFile) ? JSON.parse(fs.readFileSync(smokeFile)) : null;
  const measFile = path.join(destination, 'canvas-measurements.json');
  const meas = fs.existsSync(measFile) ? JSON.parse(fs.readFileSync(measFile)) : null;
  const cases = meas ? meas.measurements.map((m) => ({
    testCase: `${m.testCase.width}x${m.testCase.height} ${m.testCase.theme} ${m.testCase.lang}`,
    pass: m.pass,
    viewport: m.hudMetrics.vpRect,
    arrange: m.hudMetrics.buttons.find((b) => b.id === 'canvas-arrange') || null,
    visibleIds: m.hudMetrics.buttons.filter((b) => b.width > 0 && b.height > 0).map((b) => b.id),
    buttonsOutsideViewport: m.buttonsOutsideViewport,
    buttonOverlaps: m.buttonOverlaps,
  })) : null;
  const verdicts = smoke ? smoke.map((c) => ({ name: c.name, verdict: c.verdict })) : null;
  const passCount = smoke ? smoke.filter((c) => c.verdict === 'PASS').length : 0;
  results.push({ name, injection, exit: run.status, signal: run.signal, error: run.error?.message, passCount, total: smoke?.length ?? 0, verdicts, cases, source: file, destination });
  console.log(name, 'exit=' + run.status, `${passCount}/${smoke?.length ?? 0} PASS`, JSON.stringify(smoke?.filter((c) => c.verdict !== 'PASS').map((c) => c.name)));
}
fs.writeFileSync(path.join(out, outJson), JSON.stringify({ temp, results }, null, 2) + '\n');
