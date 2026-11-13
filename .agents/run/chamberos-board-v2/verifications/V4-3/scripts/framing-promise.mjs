// V4-2 regression settlement: does the phone framing promise come from an
// approved decision (D37/D39) or is it a genuine regression?
//
// The old probe (scripts/generate-v4-1b-verification.mjs, written before the
// readable floor existed) demands that automatic dependency framing contain the
// whole neighbourhood at every width. D37 says the opposite: automatic framing
// never goes below 0.55, and "Show all (N)" is the explicit action that gives
// the full fit. This probe measures what the product actually promises at the
// widths where the old probe fails, and keeps the old expectation in its
// `staleExpectation` field so nobody has to trust the summary.
//
// Real Chromium, real clicks, measurements from the live DOM.
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

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(OUT, 'regression', 'screenshots');
const CHROME_PATH = process.env.H2_CHROME || '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
fs.mkdirSync(SHOTS, { recursive: true });

const FOCUSED = 'chamberos/platform#2';
const READABLE_FLOOR = 0.55;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function createPreview() {
  const fake = await startFakeGitHub({
    repositories: [
      {
        repo: 'chamberos/platform',
        id: 101,
        hasIssues: true,
        issues: [
          makeIssue({ number: 1, repo: 'chamberos/platform', title: 'Deploy regional ingress verification', body: '<!-- board-canvas: {"x":80,"y":90} -->\n## Overview\nCoordinate edge session verification.', labels: ['status:needs-human', 'priority:urgent'], updated_at: '2026-11-10T14:20:00Z' }),
          makeIssue({ number: 2, repo: 'chamberos/platform', title: 'Wire conditional ETag revalidation across board routes', body: '<!-- board-canvas: {"x":460,"y":90} -->\n## Overview\nReduce poll overhead with If-None-Match.', labels: ['status:in-progress', 'priority:high'], updated_at: '2026-11-10T12:00:00Z' }),
          makeIssue({ number: 3, repo: 'chamberos/platform', title: 'Audit strict CSP headers on workspace shell', body: '<!-- board-canvas: {"x":840,"y":90} -->\n## Overview\nEnsure style-src self remains enforced.', labels: ['status:in-review', 'priority:high'], updated_at: '2026-11-09T16:30:00Z' }),
          makeIssue({ number: 4, repo: 'chamberos/platform', title: 'Publish release checksum manifest', body: '<!-- board-canvas: {"x":460,"y":300} -->\n## Overview\nGenerate deterministic SHA-256 bundle manifest.', labels: ['status:todo', 'priority:medium'], updated_at: '2026-11-08T11:00:00Z' }),
          makeIssue({ number: 5, repo: 'chamberos/platform', title: 'Internal telemetry spike scratchpad', body: '<!-- board-canvas: {"x":1240,"y":520} -->\n## Overview\nUnpublished exploration notes.', labels: ['status:draft', 'priority:high'], updated_at: '2026-11-07T09:00:00Z' }),
        ],
      },
      {
        repo: 'acme/vanilla-sdk',
        id: 102,
        hasIssues: true,
        issues: [
          makeIssue({ number: 11, repo: 'acme/vanilla-sdk', title: 'Document TypeScript pagination iterator types', body: '<!-- board-canvas: {"x":460,"y":560} -->\nAdd clean pagination examples.', labels: ['priority:low'], updated_at: '2026-11-10T09:45:00Z' }),
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

function measure() {
  const round = (n) => Math.round(n * 10) / 10;
  const vp = document.getElementById('canvas-viewport').getBoundingClientRect();
  const st = window.__taskBoard.state;
  const inside = (r) => r.left >= vp.left - 0.5 && r.right <= vp.right + 0.5 && r.top >= vp.top - 0.5 && r.bottom <= vp.bottom + 0.5;
  const cards = Array.from(document.querySelectorAll('.canvas-card')).map((card) => {
    const r = card.getBoundingClientRect();
    return {
      key: card.getAttribute('data-issue-key'),
      role: ['selected', 'blocker', 'dependent', 'unrelated'].find((name) => card.classList.contains('dependency-' + name)) || null,
      rect: { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height) },
      insideViewport: inside(r),
    };
  });
  const labels = Array.from(document.querySelectorAll('.dependency-wire-label')).map((label) => {
    const r = label.getBoundingClientRect();
    return { text: label.textContent, insideViewport: inside(r) };
  });
  const hudNode = document.getElementById('canvas-controls');
  const hud = hudNode && hudNode.getClientRects().length ? (() => {
    const r = hudNode.getBoundingClientRect();
    return { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height) };
  })() : null;
  const showAll = document.getElementById('canvas-show-all');
  const legend = document.getElementById('dependency-legend');
  const filterWarning = document.getElementById('canvas-fit-limit');
  return {
    viewport: { w: round(vp.width), h: round(vp.height) },
    zoom: Math.round(st.canvasScale * 1000) / 1000,
    cards,
    neighbourhood: cards.filter((c) => c.role && c.role !== 'unrelated').map((c) => c.key),
    labels,
    hud,
    showAll: showAll ? { hidden: showAll.hidden, text: (showAll.textContent || '').trim(), kind: showAll.getAttribute('data-show-all') } : null,
    legendText: legend && !legend.hidden ? (legend.textContent || '').replace(/\s+/g, ' ').trim() : null,
    filterWarningText: filterWarning && !filterWarning.hidden ? (filterWarning.textContent || '').replace(/\s+/g, ' ').trim() : null,
  };
}

// Overlap in the page, not in canvas coordinates: what the eye sees.
function overlapsHud(target, hud) {
  if (!hud) return false;
  return target.x < hud.x + hud.w && target.x + target.w > hud.x && target.y < hud.y + hud.h && target.y + target.h > hud.y;
}

async function run() {
  const preview = await createPreview();
  let browser;
  const cases = [];
  const consoleProblems = [];
  let csp = [];
  try {
    browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await context.addInitScript(() => {
      window.__csp = [];
      window.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective || 'csp'));
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => consoleProblems.push({ kind: 'pageerror', text: error.message }));
    page.on('console', (msg) => { if (msg.type() === 'error') consoleProblems.push({ kind: 'console', text: msg.text() }); });

    const waitFor = async (expr, label, timeout = 20000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        try { if (await page.evaluate(`Boolean(${expr})`)) return true; } catch (_) {}
        await sleep(100);
      }
      throw new Error(`Timeout waiting for ${label}`);
    };
    const shot = async (name) => {
      await page.screenshot({ path: path.join(SHOTS, name + '.png') });
      return path.relative(OUT, path.join(SHOTS, name + '.png'));
    };
    const selectFocused = () => page.evaluate((key) => {
      const app = window.__taskBoard;
      const issue = app.state.board.issues.find((i) => String((i.repository ? (i.repository.full || i.repository) : '') + '#' + i.number).toLowerCase() === key);
      if (!issue) throw new Error('focused issue missing');
      app.selectDependencyCard(issue);
    }, FOCUSED);

    await page.goto(preview.url);
    await waitFor('document.getElementById("login-form")', 'login form');
    await page.evaluate((pwd) => {
      document.getElementById('password').value = pwd;
      document.getElementById('password').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('login-form').requestSubmit();
    }, BOARD_PASSWORD);
    await waitFor('Boolean(window.__taskBoard?.state?.board?.issues?.length >= 6)', 'board loaded');
    await page.evaluate(() => {
      const options = Array.from(document.querySelectorAll('#repo-options-list .repo-option'));
      if (options[0]) options[0].click();
    });
    await waitFor('window.__taskBoard?.state?.selected === "all" && !window.__taskBoard?.state?.boardLoad', 'scope all');

    for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
      for (const theme of ['light', 'dark']) {
        for (const lang of ['en', 'fr']) {
          const tag = `${size.width}-${theme}-${lang}`;
          await page.setViewportSize(size);
          await page.evaluate(({ theme, lang }) => {
            window.__taskBoard.setThemeMode(theme);
            if ((localStorage.getItem('tb_lang') || 'en') !== lang) document.getElementById('lang-switch-btn').click();
            document.getElementById('nav-canvas').click();
          }, { theme, lang });
          await waitFor('document.querySelectorAll(".canvas-card").length >= 6', `cards ${tag}`);
          await sleep(300);

          // Automatic dependency framing, exactly as a finger starts it.
          await page.evaluate(() => window.__taskBoard.resetCanvasView());
          await sleep(150);
          await selectFocused();
          await sleep(600);
          const framed = await page.evaluate(measure);
          const framedShot = await shot(`framed-${tag}`);

          const framedNeighbourhood = framed.cards.filter((c) => framed.neighbourhood.includes(c.key));
          const framedOutside = framedNeighbourhood.filter((c) => !c.insideViewport).map((c) => c.key);
          const framedScaleIsFloor = Math.abs(framed.zoom - READABLE_FLOOR) < 0.0006;
          const limitText = [framed.legendText, framed.filterWarningText].filter(Boolean).join(' ');
          const limitMessageTruthful = /outside this view|hors de cette vue/i.test(limitText);
          const showAllVisible = Boolean(framed.showAll && !framed.showAll.hidden);

          // The explicit action the user has, pressed with a real click.
          let showAllState = null;
          let showAllShot = null;
          let allInsideAfterShowAll = null;
          let underHudAfterShowAll = null;
          let labelsInsideAfterShowAll = null;
          if (showAllVisible) {
            await page.click('#canvas-show-all');
            await sleep(700);
            showAllState = await page.evaluate(measure);
            showAllShot = await shot(`show-all-${tag}`);
            const after = showAllState.cards.filter((c) => showAllState.neighbourhood.includes(c.key));
            allInsideAfterShowAll = after.length === 4 && after.every((c) => c.insideViewport);
            underHudAfterShowAll = after.filter((c) => overlapsHud(c.rect, showAllState.hud)).map((c) => c.key);
            labelsInsideAfterShowAll = showAllState.labels.every((l) => l.insideViewport);
          }

          // Leave focus so the filter measurement starts from a clean canvas.
          await page.evaluate(() => window.__taskBoard.clearDependencyFocus());
          await sleep(400);
          await page.evaluate(() => window.__taskBoard.resetCanvasView());
          await page.click('#applied-filter-btn');
          await page.click('[data-filter="priority:high"]');
          await page.click('#sheet-apply');
          await sleep(700);
          const filtered = await page.evaluate(measure);
          const filteredShot = await shot(`filtered-${tag}`);
          const matches = filtered.cards.filter((c) => !c.role || c.role === 'unrelated');
          const filteredScaleIsFloor = Math.abs(filtered.zoom - READABLE_FLOOR) < 0.0006;
          const filterLimitText = filtered.filterWarningText || '';
          // A filter frame that had to stop at the floor offers the explicit
          // full fit; the limit sentence itself belongs to the *completed* full
          // fit and is checked only when it exists.
          const filterWarningTruthful = !filterLimitText || /zoom limit reached|limite de zoom atteinte/i.test(filterLimitText);
          const filterShowAllVisible = Boolean(filtered.showAll && !filtered.showAll.hidden);
          let filterAllInside = null;
          let filterUnderHud = null;
          if (filterShowAllVisible) {
            await page.click('#canvas-show-all');
            await sleep(700);
            const after = await page.evaluate(measure);
            filterAllInside = after.cards.every((c) => c.insideViewport);
            filterUnderHud = after.cards.filter((c) => overlapsHud(c.rect, after.hud)).map((c) => c.key);
            await shot(`filtered-show-all-${tag}`);
          }
          await page.evaluate(() => {
            const chip = document.querySelector('#filter-chips .filter-chip');
            if (chip) chip.click();
          });
          await sleep(400);

          // Reading the product's promise: at phone widths automatic framing
          // stops at the floor, explains itself, and offers the full fit.
          const phone = size.width <= 390;
          const pass = phone
            ? framedScaleIsFloor
              && framedOutside.length > 0
              && limitMessageTruthful
              && showAllVisible
              && allInsideAfterShowAll === true
              && underHudAfterShowAll.length === 0
              && labelsInsideAfterShowAll === true
              && showAllState.zoom < READABLE_FLOOR - 0.0006
              && filteredScaleIsFloor
              && filterWarningTruthful
              && filterShowAllVisible
              && filterAllInside === true
              && filterUnderHud.length === 0
            : framedNeighbourhood.every((c) => c.insideViewport) && framed.zoom >= READABLE_FLOOR - 0.0006 && framedOutside.length === 0;

          cases.push({
            case: { width: size.width, height: size.height, theme, lang },
            automaticFraming: {
              zoom: framed.zoom,
              scaleIsReadableFloor: framedScaleIsFloor,
              neighbourhood: framed.neighbourhood,
              outsideViewport: framedOutside,
              limitMessage: limitText,
              limitMessageTruthful,
              showAll: framed.showAll,
              cardsUnderHud: framedNeighbourhood.filter((c) => overlapsHud(c.rect, framed.hud)).map((c) => c.key),
            },
            explicitShowAll: showAllState ? {
              zoom: showAllState.zoom,
              crossesReadableFloor: showAllState.zoom < READABLE_FLOOR - 0.0006,
              allNeighbourhoodInside: allInsideAfterShowAll,
              cardsUnderHud: underHudAfterShowAll,
              labelsInside: labelsInsideAfterShowAll,
              limitMessage: [showAllState.legendText, showAllState.filterWarningText].filter(Boolean).join(' '),
            } : null,
            filteredFraming: {
              zoom: filtered.zoom,
              scaleIsReadableFloor: filteredScaleIsFloor,
              matches: matches.map((c) => c.key),
              limitMessage: filterLimitText,
              limitMessageTruthful: filterWarningTruthful,
              showAllVisible: filterShowAllVisible,
              allMatchesInsideAfterShowAll: filterAllInside,
              underHudAfterShowAll: filterUnderHud,
            },
            screenshots: { framed: framedShot, showAll: showAllShot, filtered: filteredShot },
            pass,
          });
          console.log(`${tag} ${pass ? 'PASS' : 'FAIL'} zoom=${framed.zoom} outside=${framedOutside.length} showAll=${showAllVisible} showAllZoom=${showAllState ? showAllState.zoom : 'n/a'} filterZoom=${filtered.zoom}`);
        }
      }
    }

    csp = await page.evaluate(() => window.__csp || []);
    const summary = {
      generatedAt: new Date().toISOString(),
      chrome: CHROME_PATH,
      premise: 'D37: automatic framing never goes below 0.55; "Show all (N)" gives the real full fit. D39: an incomplete full fit keeps a truthful zoom-limit message and never claims a fit that did not happen.',
      staleExpectation: 'scripts/generate-v4-1b-verification.mjs requires neighbourhoodInside && filteredAllInside && cardsUnderHud.length === 0 at 360/390 under automatic framing, i.e. a fit below the readable floor with no limit message. That expectation predates D37/D39 and is preserved unresolved in regression/v4-1b-summary.json and logs/regression.log.',
      cases: cases.length,
      casesPassed: cases.filter((c) => c.pass).length,
      cspViolations: csp,
      consoleProblems,
    };
    fs.writeFileSync(path.join(OUT, 'regression', 'framing-promise.json'), JSON.stringify({ summary, cases }, null, 2) + '\n');
    console.log(JSON.stringify({ cases: summary.cases, passed: summary.casesPassed, csp: csp.length, console: consoleProblems.length }));
    if (summary.casesPassed !== summary.cases) throw new Error(`${summary.cases - summary.casesPassed} framing-promise case(s) failed`);
    if (csp.length) throw new Error(`CSP violations: ${JSON.stringify(csp)}`);
    if (consoleProblems.length) throw new Error(`Console problems: ${JSON.stringify(consoleProblems)}`);
  } finally {
    if (browser) await browser.close();
    await preview.close();
  }
}

run().then(() => console.log('framing-promise complete')).catch((error) => { console.error(error); process.exit(1); });
