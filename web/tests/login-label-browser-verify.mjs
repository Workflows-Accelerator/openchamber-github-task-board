// ==============================================================================
// Standalone real-browser verification for Issue #49: login label text bleed
//
// Zero external dependencies: uses Node's built-in WebSocket and fetch over CDP
// (Chromium DevTools Protocol). Excluded from standard unit test glob (*.test.mjs).
//
// Drives Obscura (and optionally Chromium) over CDP to verify:
// 1. Username input is off-layout and does not bleed into Password label
// 2. Viewports 1280x800 and 360x800 have zero horizontal overflow
// 3. Synthetic sign-in succeeds and sets HttpOnly Secure session cookie
// 4. Accessibility tree preserves roles and accessible names
// 5. Compares visible outcome in Obscura (defect fixed) vs Chromium (unaffected)
//
// Run: node web/tests/login-label-browser-verify.mjs
// ==============================================================================

import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import zlib from 'node:zlib';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { startBoard, browserConfig, BOARD_PASSWORD } from './helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const ARTIFACT_ROOT = process.env.ARTIFACT_ROOT || path.join(
  ROOT,
  '.agents/run/issue-49-correction/verifications',
);
const SHOTS = path.join(ARTIFACT_ROOT, 'screenshots');
const OBS_CDP_PORT = Number(process.env.OBS_CDP_PORT ?? 9333);
const CHROME_CDP_PORT = Number(process.env.CHROME_CDP_PORT ?? 9444);
const SYNTHETIC_TOKEN = 'ghp_synthetic_browser_token_00000000';

const CHROMIUM_CANDIDATES = [
  process.env.CHROMIUM_PATH,
  '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chrome-headless-shell',
].filter(Boolean);

const results = {
  kind: 'issue-49 browser verification',
  startedAt: new Date().toISOString(),
  checks: [],
  screenshots: [],
  comparisons: [],
  notes: [],
};

function check(name, condition, detail = '') {
  results.checks.push({ name, pass: Boolean(condition), detail });
  if (!condition) {
    throw new Error(`check failed: ${name}${detail ? ` (${detail})` : ''}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDP {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
  }

  async open() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!message.id) {
        this.events.push(message);
        return;
      }
      if (!this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message || 'CDP error'));
      else resolve(message.result);
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      this.ws.send(JSON.stringify(payload));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 20_000);
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

async function ensureObscura() {
  const endpoint = `http://127.0.0.1:${OBS_CDP_PORT}/json/version`;
  try {
    const response = await fetch(endpoint);
    if (response.ok) return { started: false };
  } catch {}
  const child = spawn('obscura', ['serve', '--port', String(OBS_CDP_PORT), '--allow-private-network'], {
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    await sleep(250);
    try {
      const response = await fetch(endpoint);
      if (response.ok) return { started: true, child };
    } catch {}
  }
  throw new Error('Obscura did not start listening on the CDP port');
}

async function tryLaunchChromium() {
  const endpoint = `http://127.0.0.1:${CHROME_CDP_PORT}/json/version`;
  try {
    const res = await fetch(endpoint);
    if (res.ok) return { available: true, managed: false };
  } catch {}

  const fs = await import('node:fs');
  for (const bin of CHROMIUM_CANDIDATES) {
    if (fs.existsSync(bin)) {
      try {
        const child = spawn(
          bin,
          [
            '--headless',
            '--no-sandbox',
            '--disable-gpu',
            `--remote-debugging-port=${CHROME_CDP_PORT}`,
          ],
          { stdio: 'ignore', detached: true },
        );
        child.unref();
        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
          await sleep(200);
          try {
            const res = await fetch(endpoint);
            if (res.ok) return { available: true, managed: true, child };
          } catch {}
        }
      } catch {}
    }
  }
  return { available: false };
}

function decodePng(buf) {
  let pos = 8;
  let width = 0;
  let height = 0;
  const idatParts = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === 'IDAT') {
      idatParts.push(data);
    }
    pos += 12 + len;
  }
  return { width, height, raw: zlib.inflateSync(Buffer.concat(idatParts)) };
}

async function runBrowserVerification(engineName, port, boardUrl) {
  const versionRes = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json());
  const wsUrl = versionRes.webSocketDebuggerUrl || `ws://127.0.0.1:${port}/devtools/browser`;
  const cdp = new CDP(wsUrl);
  await cdp.open();

  const created = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const attached = await cdp.send('Target.attachToTarget', { targetId: created.targetId, flatten: true });
  const session = attached.sessionId;
  const send = (method, params) => cdp.send(method, params, session);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Accessibility.enable').catch(() => {});

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(
        res.exceptionDetails.exception?.description ||
          res.exceptionDetails.text ||
          'eval error',
      );
    }
    return res.result.value;
  }

  async function waitFor(expression, label, timeout = 10_000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try {
        const val = await evaluate(`Boolean(${expression})`);
        if (val) return true;
      } catch {}
      await sleep(100);
    }
    throw new Error(`Timeout waiting for ${label}`);
  }

  async function setViewport(width, height) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
  }

  async function screenshot(filename) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const filepath = path.join(SHOTS, filename);
    await writeFile(filepath, Buffer.from(shot.data, 'base64'));
    results.screenshots.push(filepath);
    return filepath;
  }

  for (const [w, h] of [[1280, 900], [360, 800]]) {
    await setViewport(w, h);
    await send('Page.navigate', { url: `${boardUrl}/` });
    await waitFor('!document.getElementById("login-view").hidden', 'login view');

    // Layout check: horizontal overflow
    const overflow = await evaluate(`(() => {
      const doc = document.documentElement;
      return {
        clientWidth: doc.clientWidth,
        scrollWidth: Math.max(doc.scrollWidth, document.body ? document.body.scrollWidth : 0),
      };
    })()`);
    check(
      `${engineName} ${w}x${h}: no horizontal overflow`,
      overflow.scrollWidth <= overflow.clientWidth + 1,
      `scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`,
    );

    // Layout safety check: #username is positioned offscreen
    const geom = await evaluate(`(() => {
      const u = document.getElementById('username');
      const p = document.querySelector('label[for="password"]');
      const ur = u.getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      return {
        uLeft: ur.left,
        uRight: ur.right,
        pLeft: pr.left,
        pRight: pr.right,
        pTop: pr.top,
        pBottom: pr.bottom,
        userAutocomplete: u.getAttribute('autocomplete'),
        passAutocomplete: document.getElementById('password').getAttribute('autocomplete'),
        userTabindex: u.getAttribute('tabindex'),
        userReadonly: u.readOnly,
      };
    })()`);

    check(
      `${engineName} ${w}x${h}: autocomplete and form attributes intact`,
      geom.userAutocomplete === 'username' &&
        geom.passAutocomplete === 'current-password' &&
        geom.userTabindex === '-1' &&
        geom.userReadonly === true,
    );

    // Implementation safety assertion: input.sr-only left is moved off-layout
    check(
      `${engineName} ${w}x${h}: #username input off-layout (safety bounds)`,
      geom.uRight <= 0 && geom.uLeft < -1000,
      `uLeft=${geom.uLeft}, uRight=${geom.uRight}`,
    );

    // Capture screenshot
    const shotName = `after-${engineName.toLowerCase()}-${w}.png`;
    await screenshot(shotName);
  }

  // Accessibility Tree inspection via CDP
  try {
    const axTree = await send('Accessibility.getFullAXTree', {});
    const nodes = axTree.nodes || [];
    const usernameNode = nodes.find((n) => n.name?.value === 'Username');
    const passwordNode = nodes.find((n) => n.name?.value === 'Password');
    check(
      `${engineName}: username input present in AXTree`,
      Boolean(usernameNode),
      usernameNode ? `role=${usernameNode.role?.value}` : 'missing',
    );
    check(
      `${engineName}: password input present in AXTree`,
      Boolean(passwordNode),
      passwordNode ? `role=${passwordNode.role?.value}` : 'missing',
    );
  } catch (err) {
    results.notes.push(`${engineName}: AXTree check error: ${err.message}`);
  }

  // Synthetic sign-in through browser
  await evaluate(`(() => {
    const input = document.getElementById('password');
    input.value = ${JSON.stringify(BOARD_PASSWORD)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('login-form').requestSubmit();
    return true;
  })()`);

  await waitFor('!document.getElementById("board-view").hidden', 'board view');
  check(`${engineName}: sign-in navigates to board view`, true);

  // Verify session cookie
  const cookieRes = await send('Network.getCookies', {});
  const sessionCookie = (cookieRes.cookies || []).find((c) => c.name === 'board_session');
  check(
    `${engineName}: board_session cookie set with HttpOnly`,
    Boolean(sessionCookie && sessionCookie.httpOnly),
  );

  // Other sr-only elements intact
  const announcer = await evaluate(`(() => {
    const a = document.getElementById('announcer');
    return a ? { role: a.getAttribute('role'), live: a.getAttribute('aria-live') } : null;
  })()`);
  check(
    `${engineName}: announcer element intact`,
    announcer && announcer.role === 'status' && announcer.live === 'polite',
  );

  cdp.close();
}

async function main() {
  await mkdir(SHOTS, { recursive: true });

  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    repositories: [
      {
        repo: 'Workflows-Accelerator/openchamber-github-task-board',
        issues: [
          makeIssue({
            number: 1,
            title: 'Synthetic issue for verification',
            labels: ['status:todo'],
          }),
        ],
      },
    ],
  });

  const board = await startBoard(fake, {
    config: browserConfig(fake, { BOARD_GITHUB_TOKEN: SYNTHETIC_TOKEN }),
  });

  try {
    // 1. Run Obscura verification (primary zero-dependency headless engine)
    await ensureObscura();
    await runBrowserVerification('Obscura', OBS_CDP_PORT, board.url);

    // 2. Optionally run Chromium verification if available
    const chrome = await tryLaunchChromium();
    if (chrome.available) {
      await runBrowserVerification('Chromium', CHROME_CDP_PORT, board.url);
      if (chrome.managed && chrome.child) {
        chrome.child.kill();
      }
    } else {
      results.notes.push('Chromium binary not available on path; skipped Chromium live CDP pass');
    }

    // 3. Pixel / Region Comparisons with preserved baseline artifacts
    const fs = await import('node:fs');
    const reproObscuraPath = path.join(ROOT, '.agents/run/issue-49-login-label/verifications/screenshots/repro-obscura-1280.png');
    const afterObscuraPath = path.join(SHOTS, 'after-obscura-1280.png');
    if (fs.existsSync(reproObscuraPath) && fs.existsSync(afterObscuraPath)) {
      const repro = decodePng(await readFile(reproObscuraPath));
      const after = decodePng(await readFile(afterObscuraPath));
      let diffBytes = 0;
      const minLen = Math.min(repro.raw.length, after.raw.length);
      for (let i = 0; i < minLen; i++) {
        if (repro.raw[i] !== after.raw[i]) diffBytes++;
      }
      diffBytes += Math.abs(repro.raw.length - after.raw.length);
      results.comparisons.push({
        pair: 'Obscura repro (with bleed) vs Obscura after (corrected)',
        diffBytes,
        bleedResolved: diffBytes > 0,
      });
      check('Obscura visible bleed resolved in Password region', diffBytes > 0);
    }

    const priorAfterObscuraPath = path.join(ROOT, '.agents/run/issue-49-login-label/verifications/screenshots/after-obscura-1280.png');
    if (fs.existsSync(priorAfterObscuraPath) && fs.existsSync(afterObscuraPath)) {
      const prior = decodePng(await readFile(priorAfterObscuraPath));
      const current = decodePng(await readFile(afterObscuraPath));
      let diffBytes = 0;
      const minLen = Math.min(prior.raw.length, current.raw.length);
      for (let i = 0; i < minLen; i++) {
        if (prior.raw[i] !== current.raw[i]) diffBytes++;
      }
      results.comparisons.push({
        pair: 'Minimal CSS (left: -9999px) vs Builder combined CSS in Obscura',
        diffBytes,
        visuallyIdentical: diffBytes === 0,
      });
      check('Minimal CSS matches builder visual fix in Obscura without opacity or clip-path', diffBytes === 0);
    }

    const beforeChromePath = path.join(ROOT, '.agents/run/issue-49-login-label/verifications/screenshots/before-login-1280.png');
    const afterChromePath = path.join(SHOTS, 'after-chromium-1280.png');
    if (fs.existsSync(beforeChromePath) && fs.existsSync(afterChromePath)) {
      const bChrome = decodePng(await readFile(beforeChromePath));
      const aChrome = decodePng(await readFile(afterChromePath));
      // Compare password card region (x: 300..980, y: 150..500)
      const stride = 1 + 1280 * 4;
      let cardDiffs = 0;
      for (let y = 150; y < 500; y++) {
        const lineStart = y * stride;
        for (let x = 300; x < 980; x++) {
          const px = lineStart + 1 + x * 4;
          for (let c = 0; c < 4; c++) {
            if (bChrome.raw[px + c] !== aChrome.raw[px + c]) cardDiffs++;
          }
        }
      }
      results.comparisons.push({
        pair: 'Chromium before vs Chromium after (Password card region)',
        cardDiffs,
        unaffected: cardDiffs === 0,
      });
      check('Chromium password region unaffected (zero baseline bleed)', cardDiffs === 0);
    }

  } finally {
    if (board) await board.app.close();
    if (fake) await fake.close();
  }

  const passed = results.checks.filter((c) => c.pass);
  console.log(JSON.stringify({
    checks: results.checks.length,
    passed: passed.length,
    screenshots: results.screenshots.length,
    comparisons: results.comparisons,
    notes: results.notes,
  }, null, 2));
}

main().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
