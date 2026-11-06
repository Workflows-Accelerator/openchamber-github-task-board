// Independent browser-observed faults, disposable copies only. No verdict variables changed.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = process.cwd();
const out = path.join(root, '.agents/run/chamberos-board-v2/verifications/A-delivery/hostile3');
const temp = fs.mkdtempSync('/tmp/opencode/hostile3-smoke-');
const source = fs.readFileSync('scripts/generate-delivery-smoke.mjs', 'utf8').replace("'../web/tests/helpers.mjs'", JSON.stringify(path.join(root, 'web/tests/helpers.mjs')));
const beforeDiagnostics = '  // Check page-side CSP listener';
const beforeMetrics = '    const metrics = await page.evaluate(() => {';
const faults = {
  baseline: [beforeDiagnostics, ''],
  console: [beforeDiagnostics, 'await page.evaluate(() => console.error("H3_CONSOLE_ERROR"));'],
  exception: [beforeDiagnostics, 'await page.evaluate(() => setTimeout(() => { throw new Error("H3_UNCAUGHT_EXCEPTION"); }, 10)); await sleep(100);'],
  overlap: [beforeMetrics, 'await page.evaluate(() => { document.getElementById("canvas-arrange").style.marginLeft = "-100px"; });'],
  csp: [beforeDiagnostics, 'await page.evaluate(() => { const s = document.createElement("script"); s.textContent = "window.H3_SHOULD_NOT_RUN = true"; document.head.append(s); }); await sleep(100); console.log("CSP blocked inline script:", await page.evaluate(() => !window.H3_SHOULD_NOT_RUN));'],
  offscreenX: [beforeMetrics, 'await page.evaluate(() => { document.getElementById("canvas-arrange").style.transform = "translateX(2000px)"; });'],
  offscreenY: [beforeMetrics, 'await page.evaluate(() => { document.getElementById("canvas-arrange").style.transform = "translateY(-2000px)"; });'],
  missingWire: ['  const cardCount = await page.evaluate', 'await page.evaluate(() => document.querySelector(".canvas-wire-group").remove());'],
  beforeNavigation: ['  // Verify all projects selected', 'await page.evaluate(() => console.error("H3_BEFORE_NAVIGATION")); await page.reload(); await waitFor("Boolean(window.__taskBoard?.state?.board?.issues?.length >= 8)", "board after reload");'],
};
const results = [];
for (const [name, [anchor, injection]] of Object.entries(faults)) {
  if (!source.includes(anchor)) throw new Error('Missing anchor: ' + anchor);
  const file = path.join(temp, `${name}.mjs`);
  fs.writeFileSync(file, source.replace(anchor, injection + '\n' + anchor));
  const destination = path.join(temp, name);
  const run = spawnSync(process.execPath, [file], { env: { ...process.env, DELIVERY_DIR: destination }, timeout: 120000, encoding: 'utf8' });
  fs.writeFileSync(path.join(out, 'raw', `smoke-${name}.log`), run.stdout + run.stderr);
  const evidence = fs.existsSync(path.join(destination, 'smoke.json')) ? JSON.parse(fs.readFileSync(path.join(destination, 'smoke.json'))) : null;
  const result = { name, status: run.status, error: run.error?.message, source: file, destination, checks: evidence };
  results.push(result);
  console.log(name, run.status, evidence?.filter(x => x.verdict !== 'PASS'));
}
fs.writeFileSync(path.join(out, 'smoke-challenges.json'), JSON.stringify({ temp, results }, null, 2) + '\n');
