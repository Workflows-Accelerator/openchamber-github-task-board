// Verification script for Criteria 3 & 4: Canvas controls, Dot Grid, and Wires Inspection
// Runs against the persistent isolated preview server on http://127.0.0.1:4041

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const { BOARD_PASSWORD } = await import(pathToFileURL(path.resolve(rootDir, 'web/tests/helpers.mjs')).href);

const PREVIEW_URL = 'http://127.0.0.1:4041';
const CDP_URL = 'ws://127.0.0.1:9222/devtools/browser';
const SCREENSHOT_DIR = path.resolve(process.cwd(), '.agents/run/chamberos-board-v2/verifications/A-delivery/hostile/screenshots');

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDP {
  pending = new Map();
  next = 0;
  events = [];

  async open() {
    this.ws = new WebSocket(CDP_URL);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });
    this.ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (!data.id) {
        this.events.push(data);
        return;
      }
      const pending = this.pending.get(data.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(data.id);
      if (data.error) pending.reject(new Error(data.error.message));
      else pending.resolve(data.result);
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('CDP timeout ' + method));
      }, 20000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

async function run() {
  console.log('--- Starting Canvas Controls and Wires Hostile Inspection ---');

  const cdp = new CDP();
  await cdp.open();

  let target;
  try {
    target = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    const send = (method, params) => cdp.send(method, params, sessionId);

    const exceptions = [];
    const consoleErrors = [];

    cdp.events = [];
    // Listen for runtime errors
    const ws = cdp.ws;
    ws.addEventListener('message', (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.method === 'Runtime.exceptionThrown') {
          exceptions.push(d.params?.exceptionDetails?.text || 'exception');
        }
        if (d.method === 'Log.entryAdded' && d.params?.entry?.level === 'error') {
          consoleErrors.push(d.params.entry.text);
        }
      } catch {}
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable');

    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      }
      return result.result.value;
    };

    const wait = async (expression, name) => {
      const start = Date.now();
      while (Date.now() - start < 15000) {
        try {
          if (await evaluate(expression)) return;
        } catch {}
        await pause(100);
      }
      throw new Error('Wait failed: ' + name);
    };

    const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);

    const setViewport = async (w, h) => {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: h,
        deviceScaleFactor: 1,
        mobile: w <= 768,
      });
      await pause(150);
    };

    const captureShot = async (filename) => {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(shot.data, 'base64');
      const outPath = path.resolve(SCREENSHOT_DIR, filename);
      fs.writeFileSync(outPath, buf);
      console.log(`Saved screenshot: ${outPath} (${buf.length} bytes)`);
      return outPath;
    };

    const setTheme = async (mode) => {
      await evaluate(`(() => {
        if (window.__taskBoard && window.__taskBoard.setThemeMode) {
          window.__taskBoard.setThemeMode(${JSON.stringify(mode)});
        } else {
          localStorage.setItem('tb_theme_mode', ${JSON.stringify(mode)});
          document.documentElement.setAttribute('data-theme', ${JSON.stringify(mode)});
        }
      })()`);
      await pause(100);
    };

    const setLang = async (lang) => {
      await evaluate(`(() => {
        const btn = document.getElementById('lang-switch-btn');
        const cur = localStorage.getItem('tb_lang') || 'en';
        if (btn && cur !== ${JSON.stringify(lang)}) {
          btn.click();
        }
      })()`);
      await pause(200);
    };

    // 1. Initial Load & Login
    await setViewport(1280, 900);
    await send('Page.navigate', { url: PREVIEW_URL });
    await wait('!!document.querySelector("#login-form")', 'login form');
    await evaluate(`(() => {
      const pwd = document.getElementById("password");
      pwd.value = ${JSON.stringify(BOARD_PASSWORD)};
      pwd.dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("login-form").requestSubmit();
    })()`);
    await wait('!document.getElementById("board-view")?.hidden', 'board view');
    await wait('Boolean(window.__taskBoard?.state?.board?.issues?.length >= 8)', 'board loaded');
    await pause(300);

    // Switch to Canvas View
    console.log('\n--- Switching to Canvas View ---');
    await click('#nav-canvas');
    await wait('!document.querySelector("#canvas-viewport")?.hidden', 'canvas viewport visible');
    await wait('document.querySelectorAll(".canvas-card").length >= 8', 'canvas cards rendered');
    await pause(500);

    // 2. Wire Rendering Inspection (Criterion 4)
    console.log('\n--- Inspecting Wire Count and Visibility (Criterion 4) ---');
    const wireDetails = await evaluate(`(() => {
      const wiresLayer = document.querySelector('#canvas-wires');
      const groups = Array.from(document.querySelectorAll('.canvas-wire-group'));
      const cards = Array.from(document.querySelectorAll('.canvas-card')).map(c => ({
        num: c.getAttribute('data-issue-number'),
        key: c.getAttribute('data-issue-key'),
        rect: c.getBoundingClientRect(),
      }));

      const wires = groups.map(g => {
        const path = g.querySelector('path.canvas-wire');
        const hit = g.querySelector('path.canvas-wire-hit');
        const delBtn = g.querySelector('.canvas-wire-del-btn');
        const style = path ? window.getComputedStyle(path) : null;
        const rect = path ? path.getBoundingClientRect() : null;
        return {
          target: g.getAttribute('data-target'),
          blocker: g.getAttribute('data-blocker'),
          className: g.getAttribute('class'),
          hasVisualPath: Boolean(path),
          hasHitPath: Boolean(hit),
          hasDelBtn: Boolean(delBtn),
          d: path ? path.getAttribute('d') : null,
          stroke: style ? style.stroke : null,
          strokeWidth: style ? style.strokeWidth : null,
          display: style ? style.display : null,
          visibility: style ? style.visibility : null,
          boundingRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
        };
      });

      const layerRect = wiresLayer.getBoundingClientRect();
      const layerViewBox = wiresLayer.getAttribute('viewBox');

      return {
        wiresLayerExists: Boolean(wiresLayer),
        layerRect: { x: layerRect.x, y: layerRect.y, width: layerRect.width, height: layerRect.height },
        layerViewBox,
        groupCount: groups.length,
        wires,
        cardsCount: cards.length,
      };
    })()`);

    console.log('Wire inspection result:', JSON.stringify(wireDetails, null, 2));

    if (wireDetails.groupCount !== 4) {
      throw new Error(`Expected exactly 4 wire groups, found ${wireDetails.groupCount}`);
    }

    wireDetails.wires.forEach((w, idx) => {
      if (!w.hasVisualPath) throw new Error(`Wire #${idx} missing visual path`);
      if (!w.d || !w.d.startsWith('M')) throw new Error(`Wire #${idx} has invalid d curve: ${w.d}`);
      if (w.display === 'none') throw new Error(`Wire #${idx} has display:none`);
      if (w.visibility === 'hidden') throw new Error(`Wire #${idx} has visibility:hidden`);
      console.log(`Wire #${idx} (Blocker #${w.blocker} -> Target #${w.target}): VALID, stroke=${w.stroke}, d=${w.d.slice(0, 30)}...`);
    });

    // 3. Canvas HUD & Control Buttons Inspection across Viewports, Languages, and Themes (Criterion 3)
    console.log('\n--- Inspecting Canvas Controls at 360, 768, 1280 (Criterion 3) ---');

    const matrix = [
      { width: 1280, height: 900, theme: 'light', lang: 'en', shot: 'hostile-canvas-1280-light-en.png' },
      { width: 1280, height: 900, theme: 'dark', lang: 'en', shot: 'hostile-canvas-1280-dark-en.png' },
      { width: 1280, height: 900, theme: 'light', lang: 'fr', shot: 'hostile-canvas-1280-light-fr.png' },
      { width: 768, height: 900, theme: 'light', lang: 'en', shot: 'hostile-canvas-768-light-en.png' },
      { width: 768, height: 900, theme: 'dark', lang: 'fr', shot: 'hostile-canvas-768-dark-fr.png' },
      { width: 360, height: 800, theme: 'light', lang: 'en', shot: 'hostile-canvas-360-light-en.png' },
      { width: 360, height: 800, theme: 'dark', lang: 'en', shot: 'hostile-canvas-360-dark-en.png' },
      { width: 360, height: 800, theme: 'light', lang: 'fr', shot: 'hostile-canvas-360-light-fr.png' },
      { width: 360, height: 800, theme: 'dark', lang: 'fr', shot: 'hostile-canvas-360-dark-fr.png' },
    ];

    const measurements = [];

    for (const testCase of matrix) {
      console.log(`\nTesting ${testCase.width}x${testCase.height} - Theme:${testCase.theme} - Lang:${testCase.lang}`);
      await setViewport(testCase.width, testCase.height);
      await setTheme(testCase.theme);
      await setLang(testCase.lang);
      await pause(200);

      const hudMetrics = await evaluate(`(() => {
        const hud = document.querySelector('#canvas-controls');
        const viewport = document.querySelector('#canvas-viewport');
        const hudRect = hud.getBoundingClientRect();
        const vpRect = viewport.getBoundingClientRect();

        const buttons = Array.from(hud.querySelectorAll('.canvas-control-btn')).map(b => {
          const r = b.getBoundingClientRect();
          const s = window.getComputedStyle(b);
          // Check if button text wraps by creating a range or checking whiteSpace
          return {
            id: b.id,
            text: b.textContent.trim(),
            width: Math.round(r.width * 10) / 10,
            height: Math.round(r.height * 10) / 10,
            whiteSpace: s.whiteSpace,
            flexShrink: s.flexShrink,
            // Check if height exceeds single line height (~24-28px)
            multilineWrap: r.height > 32,
          };
        });

        // Overflow detection
        const overflowsViewportRight = hudRect.right > vpRect.right;
        const overflowsViewportLeft = hudRect.left < vpRect.left;
        const documentOverflow = document.documentElement.scrollWidth > window.innerWidth;

        // Dot grid background style
        const bg = window.getComputedStyle(viewport).backgroundImage;

        return {
          hudRect: { left: Math.round(hudRect.left), right: Math.round(hudRect.right), width: Math.round(hudRect.width), height: Math.round(hudRect.height) },
          vpRect: { left: Math.round(vpRect.left), right: Math.round(vpRect.right), width: Math.round(vpRect.width) },
          overflowsViewportRight,
          overflowsViewportLeft,
          documentOverflow,
          buttons,
          backgroundImage: bg,
        };
      })()`);

      measurements.push({ testCase, hudMetrics });
      console.log(`HUD width: ${hudMetrics.hudRect.width}px, Viewport width: ${hudMetrics.vpRect.width}px`);
      console.log(`Overflows right: ${hudMetrics.overflowsViewportRight}, Overflows left: ${hudMetrics.overflowsViewportLeft}, Document horizontal overflow: ${hudMetrics.documentOverflow}`);
      console.log('Buttons:', hudMetrics.buttons.map(b => `${b.id}("${b.text}"): ${b.width}x${b.height}px, wrap:${b.multilineWrap}, ws:${b.whiteSpace}`));

      // Check button wrapping
      const wrapped = hudMetrics.buttons.filter(b => b.multilineWrap);
      if (wrapped.length > 0) {
        console.warn(`WARNING: Wrapped buttons detected in ${testCase.width}x${testCase.height} ${testCase.lang}:`, wrapped);
      }

      await captureShot(testCase.shot);
    }

    // 4. Dot Grid Style Examination
    console.log('\n--- Inspecting Dot Grid Background Style ---');
    const dotGridInfo = await evaluate(`(() => {
      const vp = document.querySelector('#canvas-viewport');
      return {
        inlineStyle: vp.style.backgroundImage,
        computedStyle: window.getComputedStyle(vp).backgroundImage,
        backgroundSize: vp.style.backgroundSize,
        backgroundPosition: vp.style.backgroundPosition,
      };
    })()`);
    console.log('Dot grid style details:', JSON.stringify(dotGridInfo, null, 2));

    // Save full metrics report to hostile verifications
    const hostileReportData = {
      timestamp: new Date().toISOString(),
      previewUrl: PREVIEW_URL,
      wireDetails,
      measurements,
      dotGridInfo,
      exceptions,
      consoleErrors,
    };

    fs.writeFileSync(
      path.resolve(process.cwd(), '.agents/run/chamberos-board-v2/verifications/A-delivery/hostile/canvas-measurements.json'),
      JSON.stringify(hostileReportData, null, 2)
    );
    console.log('Saved canvas measurements to .agents/run/chamberos-board-v2/verifications/A-delivery/hostile/canvas-measurements.json');

  } finally {
    if (target) {
      try { await cdp.send('Target.closeTarget', { targetId: target.targetId }); } catch {}
    }
    cdp.close();
  }
}

run().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
