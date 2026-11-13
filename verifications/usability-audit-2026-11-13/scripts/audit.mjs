// Usability audit of the question and progress surfaces (2026-11-13).
//
// Purpose: make the owner's verdict "le board est effrayant, même pour moi"
// concrete. For every surface that shows a question or shows progress, this
// probe captures what a person sees at 390x844 and 1280x900, light and dark,
// English and French, and records measured facts: first visible text, visible
// action count, smallest rendered font size, contrast of secondary text,
// whether the primary action is above the fold, words visible in the viewport.
//
// Two capture families, never mixed:
//   live-...      the production site, signed out. Nothing is typed into it.
//   synthetic-... a local board with a fake GitHub API (web/tests/fake-github.mjs).
// No real GitHub call, no token, no network, no production write.
//
// Usage (from verifications/usability-audit-2026-11-13):
//   source ../../.agents/run/chamberos-board-v2/verifications/V4-2/scripts/browser-env.sh
//   node scripts/audit.mjs

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub, makeIssue } from '../../../web/tests/fake-github.mjs';
import { startBoard, BOARD_PASSWORD, HttpSession } from '../../../web/tests/helpers.mjs';

let pkg;
try { pkg = await import('/workspace/personal/lucas/charme-social/node_modules/playwright/index.js'); } catch { pkg = await import('playwright'); }
const { chromium } = pkg.default || pkg;

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(OUT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const LIVE_URL = 'https://board.workflows.ac/';
const VIEWPORTS = [{ width: 390, height: 844 }, { width: 1280, height: 900 }];
const THEMES = ['light', 'dark'];
const LANGS = ['en', 'fr'];

// ---- Fixture --------------------------------------------------------------
const IMAGE_URL = 'https://example.com/screenshots/login-empty.png';
const VIDEO_URL = 'https://example.com/clips/flow.mp4';
const LINK_URL = 'https://example.com/preview/login';

const imageBody = [
  '## Overview', '', 'Review the empty state of the sign-in screen.', '',
  '### Acceptance Criteria:', '- [x] Empty state matches the approved mockup',
  '- [ ] Copy reviewed by the owner', '',
  '### Human Review:', '- Artifact: image', `- URL: ${IMAGE_URL}`,
  '- Instruction: Compare the empty state with the approved mockup.',
].join('\n');

const videoBody = [
  '## Overview', '', 'Review the sign-in flow recording.', '',
  '### Human Review:', '- Artifact: video', `- URL: ${VIDEO_URL}`,
  '- Instruction: Watch the first ten seconds of the sign-in flow.',
].join('\n');

const linkBody = [
  '## Overview', '', 'Review the preview build.', '',
  '### Human Review:', '- Artifact: link', `- URL: ${LINK_URL}`,
  '- Instruction: Open the preview and confirm the button label.',
].join('\n');

const questionBody = [
  '## Overview', '', 'Pick a row density for the task list.', '',
  '### Open Questions:', '- [ ] Which spacing should the list use?',
  '  - Compact :: Dense rows :: Best for scanning long queues.',
  '  - Comfortable :: Roomier rows :: Easier on a phone.', '',
  '### Human Review:', '- Artifact: question',
].join('\n');

const legacyBody = '## Overview\n\nWaiting on a decision nobody can click.\n';
const malformedBody = '### Human Review:\n- Artifact: image\n- URL: javascript:alert(1)\n- Instruction: Open it.\n';
const inReviewBody = '## Overview\n\nThe agent is reviewing this task.\n';

const questionsOnlyBody = [
  '## Overview', '', 'Two questions are open on this task.', '',
  '### Open Questions:',
  '- [ ] Which authentication provider should ship first?',
  '  - GitHub :: Only GitHub for now :: Smallest surface.',
  '  - GitHub and Google :: Two providers :: More setup, wider audience.',
  '- [ ] Should the empty state show a sample project?',
  '  - Yes :: Show a sample :: Friendlier first run.',
  '  - No :: Blank state :: Less to explain.', '',
  '### Acceptance Criteria:', '- [ ] Both questions answered',
].join('\n');

const blockedBody = [
  '## Overview', '', 'Ship the settings page once the API client is stable.', '',
  '### Acceptance Criteria:', '- [ ] Settings page loads', '- [ ] Save persists', '',
  '### Human Tasks:', '- [ ] Confirm the settings copy',
].join('\n');

const blockerBody = '## Overview\n\nStabilise the API client.\n\n### Acceptance Criteria:\n- [ ] Client retries once\n';

const plannedBody = [
  '## Overview', '', 'Add keyboard shortcuts to the list view.', '',
  '### Acceptance Criteria:', '- [ ] j/k moves the selection', '- [ ] Enter opens the task',
  '- [ ] Escape closes the drawer', '',
  '### Actionable subtasks:', '- [ ] Wire the key handler', '- [ ] Document the shortcuts',
].join('\n');

const recordedDecisionBody = [
  '## Overview', '', 'Row density was settled in October.', '',
  '### Open Questions:',
  '- [x] Which spacing should the list use? *(Answer: Compact)*', '',
  '### Acceptance Criteria:', '- [x] Density chosen',
].join('\n');

const draftBody = '## Overview\n\nAn idea captured on the phone.\n';
const doneBody = '## Overview\n\nShipped last week.\n';
const markdownDecisionBody = '## Overview\n\nThe project has a recorded owner decision.\n\n### Decisions:\n- 2026-10-20: Use **Compact** row density. Owner: board-owner.\n\n### Acceptance Criteria:\n- [x] Owner decision recorded\n';

const REPO = 'Workflows-Accelerator/openchamber-github-task-board';
const WAITING = ['status:needs-human'];

const fake = await startFakeGitHub({
  repo: REPO,
  honorIfNoneMatch: true,
  comments: {
    112: [{ body: '<!-- board-note: 1 -->\nNote for the agent\n\nKeep Escape consistent with closing the drawer.' }],
  },
  issues: [
    makeIssue({ number: 101, title: 'Screenshot: empty state', body: imageBody, labels: WAITING, repo: REPO }),
    makeIssue({ number: 102, title: 'Video: sign-in flow', body: videoBody, labels: WAITING, repo: REPO }),
    makeIssue({ number: 103, title: 'Link: preview build', body: linkBody, labels: WAITING, repo: REPO }),
    makeIssue({ number: 104, title: 'Question: row density', body: questionBody, labels: WAITING, repo: REPO }),
    makeIssue({ number: 105, title: 'Legacy waiting task', body: legacyBody, labels: WAITING, repo: REPO }),
    makeIssue({ number: 106, title: 'Broken artifact task', body: malformedBody, labels: WAITING, repo: REPO }),
    makeIssue({ number: 107, title: 'Task under agent review', body: inReviewBody, labels: ['status:in-review'], repo: REPO }),
    makeIssue({ number: 108, title: 'Auth provider and empty state', body: questionsOnlyBody, labels: ['status:todo', 'priority:important'], repo: REPO }),
    makeIssue({ number: 109, title: 'Settings page', body: blockedBody, labels: ['status:todo', 'priority:important'], repo: REPO }),
    makeIssue({ number: 110, title: 'Stabilise the API client', body: blockerBody, labels: ['status:in-progress', 'priority:important'], repo: REPO }),
    makeIssue({ number: 111, title: 'Phone capture idea', body: draftBody, labels: ['status:draft'], repo: REPO }),
    makeIssue({ number: 112, title: 'Keyboard shortcuts', body: plannedBody, labels: ['status:planned', 'priority:high'], repo: REPO }),
    makeIssue({ number: 113, title: 'Landing page copy', body: doneBody, labels: ['status:done'], state: 'closed', repo: REPO }),
    makeIssue({ number: 114, title: 'Row density (settled)', body: recordedDecisionBody, labels: ['status:planned'], repo: REPO }),
    makeIssue({ number: 115, title: 'Decision in Markdown', body: markdownDecisionBody, labels: ['status:planned', 'priority:medium'], repo: REPO }),
  ],
});
const pristineIssues = structuredClone(fake.issues);
const board = await startBoard(fake, { boardCacheTtlMs: 0, preserveSessionFile: true, sessionFilePath: '/tmp/opencode/usability-audit-2026-11-13/sessions.json' });
function resetFixture() { fake.issues.splice(0, fake.issues.length, ...structuredClone(pristineIssues)); }

// The dependency is created through the board's own API against the fake
// GitHub, so the fixture exercises the real read path. Synthetic only.
{
  const session = new HttpSession(board.url);
  await session.login();
  const res = await session.request('/api/issues/109/dependencies/blocked_by', {
    method: 'POST',
    body: { issue_number: 110 },
  });
  if (res.status !== 201) throw new Error('dependency fixture failed: ' + res.status + ' ' + JSON.stringify(res.json));
}

// Synthetic 320x200 PNG for the image artifact, served by a route. The URL in
// the issue body is not rewritten.
function makePng(width, height) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y += 1) {
    raw[o] = 0; o += 1;
    for (let x = 0; x < width; x += 1) {
      raw[o] = 32 + Math.round((180 * y) / height); o += 1;
      raw[o] = 90; o += 1;
      raw[o] = 200 - Math.round((120 * x) / width); o += 1;
    }
  }
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
const PNG = makePng(320, 200);

// ---- Measurement ----------------------------------------------------------
// Injected once per page. Everything here is a measurement of the rendered DOM.
const MEASURE_LIB = () => {
  window.__audit = {
    parse(color) {
      const m = String(color).match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(/[,/]/).map((v) => parseFloat(v.trim()));
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    },
    lum(c) {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    },
    ratio(fg, bg) {
      const a = window.__audit.lum(fg), b = window.__audit.lum(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    },
    blend(top, bottom) {
      const a = top.a;
      return {
        r: top.r * a + bottom.r * (1 - a),
        g: top.g * a + bottom.g * (1 - a),
        b: top.b * a + bottom.b * (1 - a),
        a: 1,
      };
    },
    backgroundOf(el) {
      let node = el;
      let acc = null;
      while (node && node.nodeType === 1) {
        const cs = getComputedStyle(node);
        const bg = window.__audit.parse(cs.backgroundColor);
        if (bg && bg.a > 0) {
          acc = acc ? window.__audit.blend(acc, bg) : bg;
          if (acc.a >= 1) return acc;
        }
        node = node.parentElement;
      }
      return acc || { r: 255, g: 255, b: 255, a: 1 };
    },
    isVisible(el) {
      if (!el || !el.isConnected) return false;
      for (let n = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
        if (cs.clip && cs.clip !== 'auto' && cs.position === 'absolute') return false;
      }
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    },
    inViewport(el) {
      const r = el.getBoundingClientRect();
      let left = Math.max(0, r.left), right = Math.min(innerWidth, r.right);
      let top = Math.max(0, r.top), bottom = Math.min(innerHeight, r.bottom);
      for (let n = el.parentElement; n; n = n.parentElement) {
        const cs = getComputedStyle(n), b = n.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) { left = Math.max(left, b.left); right = Math.min(right, b.right); }
        if (/(auto|scroll|hidden|clip)/.test(cs.overflowY)) { top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom); }
      }
      if (right - left <= 1 || bottom - top <= 1) return false;
      const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
      return Boolean(hit && (el.contains(hit) || hit.contains(el)));
    },
    textOf(el) {
      return Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    },
  };
};

const measure = (page) => page.evaluate(() => {
  const A = window.__audit;
  const vw = innerWidth, vh = innerHeight;
  const root = document.body;
  const modal = document.querySelector('dialog[open]');
  const drawer = document.querySelector('#detail-view:not([hidden])');
  const contentRoot = modal || drawer || root;
  const textEls = [];
  const actionEls = [];
  const mutedEls = [];
  const words = { count: 0 };
  const all = contentRoot.querySelectorAll('*');
  for (const el of all) {
    if (!A.isVisible(el)) continue;
    const text = A.textOf(el);
    if (text) {
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      const rect = el.getBoundingClientRect();
      if (A.inViewport(el)) {
        const plane = el.closest('#canvas-plane');
        const scale = plane ? window.__taskBoard.state.canvasScale : 1;
        textEls.push({ text: text.slice(0, 120), size, effectiveSize: Math.round(size * scale * 100) / 100, top: Math.round(rect.top), left: Math.round(rect.left), cls: String(el.className || '').slice(0, 60) });
        words.count += text.split(/\s+/).filter(Boolean).length;
      }
      if (el.closest('.muted, .task-subtitle, .small, .human-review-reason, .human-review-help, .human-review-instruction, .freshness, .canvas-card-repo-name, .canvas-card-badge, .view-subtitle, .question-option-gist, .question-option-details, .section-card-meta')) {
        const fg = A.parse(cs.color);
        if (fg) {
          const bg = A.backgroundOf(el);
          mutedEls.push({
            cls: String(el.className || '').slice(0, 60),
            size,
            color: cs.color,
            ratio: Math.round(A.ratio(fg, bg) * 100) / 100,
            text: text.slice(0, 60),
            inViewport: A.inViewport(el),
          });
        }
      }
    }
    if (el.matches('a[href], button, select, input:not([type="hidden"]), summary, [role="button"]')) {
      if (!A.inViewport(el)) continue;
      const r = el.getBoundingClientRect();
      const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.value || '').replace(/\s+/g, ' ').trim();
      actionEls.push({
        tag: el.tagName,
        label: label.slice(0, 60),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        height: Math.round(r.height),
        width: Math.round(r.width),
        primary: el.classList.contains('primary'),
        disabled: el.disabled === true,
      });
    }
  }
  textEls.sort((a, b) => a.top - b.top || a.left - b.left);
  const sizes = textEls.map((t) => t.size).filter((n) => n > 0);
  const smallest = sizes.length ? Math.min(...sizes) : null;
  const below12 = textEls.filter((t) => t.size < 12);
  const mutedInView = mutedEls.filter((m) => m.inViewport);
  const ratios = mutedInView.map((m) => m.ratio).filter((n) => Number.isFinite(n));
  const lowContrast = mutedInView.filter((m) => m.ratio < 4.5);
  const primary = actionEls.filter((a) => a.primary);
  const firstPrimary = primary[0] || null;
  return {
    url: location.href,
    lang: document.documentElement.lang,
    theme: document.documentElement.getAttribute('data-theme'),
    viewport: { width: vw, height: vh },
    pageScrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > vw + 1,
    documentHeight: document.documentElement.scrollHeight,
    firstVisibleText: textEls.slice(0, 6).map((t) => ({ text: t.text, top: t.top, size: t.size })),
    wordsInFirstViewport: words.count,
    visibleTextBlocks: textEls.length,
    smallestFontPx: smallest,
    smallestEffectiveFontPx: textEls.length ? Math.min(...textEls.map((t) => t.effectiveSize)) : null,
    fontBelow12Count: below12.length,
    fontBelow12Samples: below12.slice(0, 8),
    actionsInViewport: actionEls.length,
    actions: actionEls,
    primaryAction: firstPrimary ? { label: firstPrimary.label, top: firstPrimary.top, bottom: firstPrimary.bottom, aboveFold: firstPrimary.top >= 0 && firstPrimary.bottom <= vh } : null,
    primaryActionsInViewport: primary.length,
    mutedSamples: mutedInView.slice(0, 12),
    mutedMinContrast: ratios.length ? Math.min(...ratios) : null,
    mutedMedianContrast: ratios.length ? ratios.slice().sort((a, b) => a - b)[Math.floor(ratios.length / 2)] : null,
    mutedBelow45Count: lowContrast.length,
    mutedBelow45Samples: lowContrast.slice(0, 8),
  };
});

// ---- Browser --------------------------------------------------------------
const browser = await chromium.launch({
  executablePath: process.env.H2_CHROME || '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  headless: true,
  args: ['--no-sandbox'],
});

const report = {
  generatedAt: new Date().toISOString(),
  engine: 'chromium ' + browser.version(),
  live: { url: LIVE_URL, reachable: null, httpStatus: null, note: '' },
  synthetic: { boardUrl: board.url, fixture: 'web/tests/fake-github.mjs + web/tests/helpers.mjs startBoard' },
  rows: [],
  taps: {},
  errors: [],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function newPage(viewport) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push({ where: 'pageerror', message: error.message }));
  await page.addInitScript(MEASURE_LIB);
  await page.route('https://example.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  return { context, page };
}

async function login(page) {
  await page.goto(board.url);
  await page.locator('#password').fill(BOARD_PASSWORD);
  await page.locator('#login-btn').click();
  await page.waitForFunction(() => window.__taskBoard?.state.board?.issues.length === 15, null, { timeout: 20000 });
  await page.waitForFunction(() => !document.getElementById('login-view') || document.getElementById('login-view').hidden, null, { timeout: 20000 });
}

async function setTheme(page, theme) {
  await page.evaluate((value) => window.__taskBoard.setThemeMode(value), theme);
  await page.waitForFunction((value) => document.documentElement.getAttribute('data-theme') === value, theme, { timeout: 10000 });
}
async function setLanguage(page, lang) {
  if (await page.evaluate(() => document.documentElement.lang) === lang) return;
  await page.evaluate(() => document.getElementById('lang-switch-btn').click());
  await page.waitForFunction((value) => document.documentElement.lang === value, lang, { timeout: 10000 });
}
async function openIssue(page, number) {
  await page.evaluate((n) => window.__taskBoard.openIssue(n), number);
  await page.waitForFunction((n) => window.__taskBoard.state.detail?.number === n && !document.getElementById('detail-view').hidden, number, { timeout: 15000 });
  await page.evaluate(() => { document.getElementById('detail-view').scrollTop = 0; });
  await sleep(80);
}
async function closeDrawer(page) {
  await page.evaluate(() => window.__taskBoard.closeDrawer());
  await sleep(60);
}
async function showList(page) {
  await page.evaluate(() => { window.__taskBoard.showView('board'); window.__taskBoard.switchView('simple'); });
  await sleep(120);
}
async function showCanvas(page) {
  await page.evaluate(() => window.__taskBoard.switchView('canvas'));
  await page.waitForFunction(() => !document.getElementById('canvas-viewport').hidden, null, { timeout: 10000 });
  await page.evaluate(() => window.__taskBoard.fitAllCanvasNodes());
  await sleep(250);
}
async function showSection(page, name) {
  const id = page.viewportSize().width <= 768 && ['decisions', 'blocked'].includes(name) ? '#dock-' + name : '#nav-' + name;
  await page.evaluate((selector) => document.querySelector(selector).click(), id);
  await page.waitForFunction((n) => window.__taskBoard.state.activeSectionView === n && document.getElementById(n + '-loading')?.hidden !== false, name);
  await sleep(150);
}
async function showFilter(page) {
  await page.locator('#applied-filter-btn').click();
  await page.waitForFunction(() => document.getElementById('board-sheet').open);
}
async function scrollDrawerTo(page, selector) {
  await page.evaluate((sel) => {
    const view = document.getElementById('detail-view');
    const target = document.querySelector(sel);
    const floor = document.querySelector('.drawer-identity').getBoundingClientRect().bottom + 8;
    view.scrollTop += target.getBoundingClientRect().top - floor;
  }, selector);
  await sleep(120);
}

// Each surface: a setup function run before measuring and capturing.
const SURFACES = [
  {
    key: 'list',
    async setup(page) { await showList(page); },
  },
  {
    key: 'list-flat',
    async setup(page) {
      await showList(page);
      await page.evaluate(() => {
        const toggle = document.getElementById('list-group-toggle');
        if (!window.__taskBoard.state.flatList) toggle.click();
      });
      await sleep(120);
    },
  },
  {
    key: 'canvas',
    async setup(page) { await showCanvas(page); },
  },
  {
    key: 'canvas-focus',
    async setup(page) {
      await showCanvas(page);
      const card = page.locator('.canvas-card[data-issue-number="109"]');
      await card.locator('.card-dependency-focus').click();
      await sleep(350);
    },
  },
  {
    key: 'filters',
    async setup(page) {
      await showList(page);
      await showFilter(page);
      await sleep(150);
    },
  },
  {
    key: 'filters-applied',
    async setup(page) {
      await showList(page);
      await showFilter(page);
      await page.locator('.filter-option[data-filter="stage:needs-human"]').click();
      await sleep(120);
      await page.evaluate(() => window.__taskBoard.closeSheet());
      await sleep(150);
    },
  },
  {
    key: 'decisions',
    async setup(page) { await showSection(page, 'decisions'); },
  },
  {
    key: 'blocked',
    async setup(page) { await showSection(page, 'blocked'); },
  },
  {
    key: 'drawer-question',
    async setup(page) { await openIssue(page, 104); },
  },
  {
    key: 'drawer-question-gate',
    async setup(page) {
      await openIssue(page, 104);
      await page.evaluate(() => {
        const view = document.getElementById('detail-view');
        const panel = document.getElementById('human-review');
        const identity = document.querySelector('.drawer-identity');
        const floor = identity ? identity.getBoundingClientRect().bottom + 8 : 8;
        const rect = panel.getBoundingClientRect();
        if (rect.top < floor) view.scrollTop += rect.top - floor;
      });
      await sleep(120);
    },
  },
  {
    key: 'drawer-image',
    async setup(page) { await openIssue(page, 101); },
  },
  { key: 'drawer-video', async setup(page) { await openIssue(page, 102); } },
  { key: 'drawer-link', async setup(page) { await openIssue(page, 103); } },
  { key: 'drawer-malformed', async setup(page) { await openIssue(page, 106); } },
  { key: 'drawer-question-details', async setup(page) {
    await openIssue(page, 104);
    await page.locator('#human-review-body .question-option-disclosure').first().click();
    await page.locator('#human-review-body .question-other-answer summary').click();
  } },
  { key: 'open-questions', async setup(page) {
    await openIssue(page, 108); await scrollDrawerTo(page, '#questions-title');
  } },
  { key: 'open-questions-details', async setup(page) {
    await openIssue(page, 108); await scrollDrawerTo(page, '#questions-title');
    await page.locator('#question-list .question-option-disclosure').first().click();
  } },
  { key: 'agent-notes', async setup(page) { await openIssue(page, 112); await scrollDrawerTo(page, '#agent-notes'); } },
  { key: 'agent-note-composer', async setup(page) {
    await openIssue(page, 112); await page.locator('#agent-note-add-btn').click(); await scrollDrawerTo(page, '#agent-notes');
  } },
  { key: 'progress-checklists', async setup(page) { await openIssue(page, 112); await scrollDrawerTo(page, '#ac-title'); } },
  { key: 'arrange', async setup(page) { await showCanvas(page); await page.locator('#canvas-arrange').click(); } },
  { key: 'arrange-undo', async setup(page) {
    await showCanvas(page); await page.locator('#canvas-arrange').click();
    await page.locator('#arrange-scope-all').check(); await page.locator('#arrange-confirm-btn').click();
    await page.waitForFunction(() => !document.getElementById('canvas-arrange-dialog').open, null, { timeout: 30000 });
    await page.waitForFunction(() => !document.getElementById('canvas-arrange-undo').hidden);
    await sleep(150);
  } },
  { key: 'zoom-minimum', async setup(page) { await showCanvas(page); await page.evaluate(() => window.__taskBoard.setCanvasZoom(0.01)); } },
  { key: 'zoom-maximum', async setup(page) { await showCanvas(page); await page.evaluate(() => window.__taskBoard.setCanvasZoom(9)); } },
  { key: 'focus-limit', async setup(page) {
    await showCanvas(page);
    // An explicit spread fixture: same issues, deliberately distant saved
    // coordinates. This is a framing-limit stress case, not production layout.
    await page.evaluate(() => {
      const app = window.__taskBoard;
      for (const [number, x] of [[109, 0], [110, 20000]]) {
        const issue = app.state.board.issues.find((i) => i.number === number);
        issue.canvas = { ...(issue.canvas || {}), x, y: 0 };
      }
      app.renderBoard();
      app.selectDependencyCard(app.state.board.issues.find((i) => i.number === 109));
    });
    await sleep(180);
  } },
  { key: 'focus-limit-show-all', async setup(page) {
    await SURFACES.find((s) => s.key === 'focus-limit').setup(page);
    await page.locator('#dependency-legend .legend-show-all').click(); await sleep(180);
  } },
  { key: 'columns', async setup(page) {
    await showList(page);
    // Legacy view selector is hidden in current chrome; retained renderer.
    await page.evaluate(() => { window.__taskBoard.state.viewState.view = 'kanban'; window.__taskBoard.rememberView(); });
  } },
  { key: 'phone-navigation', async setup(page) {
    await showList(page);
    if (page.viewportSize().width <= 768) await page.locator('#sidebar-toggle-btn-compact').click();
  } },
  {
    key: 'drawer-legacy',
    async setup(page) { await openIssue(page, 105); },
  },
  {
    key: 'drawer-in-review',
    async setup(page) { await openIssue(page, 107); },
  },
  {
    key: 'drawer-normal',
    async setup(page) { await openIssue(page, 112); },
  },
  {
    key: 'drawer-blocked',
    async setup(page) {
      await openIssue(page, 109);
      await page.evaluate(() => {
        const view = document.getElementById('detail-view');
        const section = document.getElementById('dependencies-title').closest('section');
        view.scrollTop = section.offsetTop - 8;
      });
      await sleep(120);
    },
  },
  {
    key: 'drawer-recorded-decision',
    async setup(page) { await openIssue(page, 114); await scrollDrawerTo(page, '#questions-title'); },
  },
  { key: 'markdown-decision', async setup(page) { await openIssue(page, 115); await scrollDrawerTo(page, '#overview-title'); } },
  { key: 'filter-reviewable-link', async setup(page) {
    await showList(page); await showFilter(page);
    await page.locator('.filter-option[data-filter="artifact"]').click(); await sleep(120);
  } },
  { key: 'filter-blocked', async setup(page) {
    await showList(page); await showFilter(page);
    await page.locator('.filter-option[data-filter="blocked"]').click(); await page.locator('#sheet-apply').click();
  } },
  { key: 'canvas-filtered', async setup(page) {
    await showCanvas(page); await showFilter(page);
    await page.locator('.filter-option[data-filter="stage:needs-human"]').click(); await page.locator('#sheet-apply').click();
  } },
  { key: 'drawer-settled-gate', async setup(page) {
    await openIssue(page, 104);
    await page.locator('#human-review-body input[type=radio]').first().check();
    await page.locator('#human-review-body button.primary').click();
    await page.waitForFunction(() => document.getElementById('human-review').getAttribute('data-review-state') === 'settled');
  } },
];

// Extra per-row facts that only some surfaces have.
const extraFacts = (page, key) => page.evaluate((surface) => {
  const A = window.__audit;
  const facts = {};
  const drawer = document.getElementById('detail-view');
  if (drawer && !drawer.hidden) {
    const panel = document.getElementById('human-review');
    facts.humanReview = {
      visible: !panel.hidden,
      state: panel.getAttribute('data-review-state'),
      title: document.getElementById('human-review-title').textContent.trim(),
      text: document.getElementById('human-review-body').innerText.replace(/\s+/g, ' ').trim().slice(0, 400),
      actions: Array.from(document.querySelectorAll('#human-review-body a.human-review-action, #human-review-body button.primary')).map((el) => {
        const r = el.getBoundingClientRect();
        return { label: el.textContent.trim(), top: Math.round(r.top), bottom: Math.round(r.bottom), aboveFold: r.top >= 0 && r.bottom <= innerHeight };
      }),
      presetCards: document.querySelectorAll('#human-review-body .question-option-card').length,
      disclosures: Array.from(document.querySelectorAll('#human-review-body .question-option-disclosure')).map((n) => ({ label: n.textContent.trim(), expanded: n.getAttribute('aria-expanded') })),
    };
    // Distance from the top of the drawer viewport to the gate and to its action.
    const viewRect = drawer.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    facts.humanReview.offsetFromDrawerTop = Math.round(panelRect.top - viewRect.top);
    facts.humanReview.gateScrollTop = Math.round(drawer.scrollTop);
    facts.humanReview.drawerScrollHeight = drawer.scrollHeight;
    facts.humanReview.drawerClientHeight = drawer.clientHeight;
    facts.panels = Array.from(drawer.querySelectorAll('section.panel, .panel')).map((s) => {
      const h = s.querySelector('h2');
      return { heading: h ? h.textContent.trim() : '', empty: Boolean(s.querySelector('.muted:not(.small)')) };
    });
    facts.drawerActions = Array.from(drawer.querySelectorAll('button, a[href], select, textarea, input')).filter((el) => A.isVisible(el)).map((el) => (el.getAttribute('aria-label') || el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 40));
    facts.emptyStatements = Array.from(drawer.querySelectorAll('p.muted, p.muted.small')).filter((el) => A.isVisible(el)).map((el) => el.textContent.trim()).filter((t) => /^(No |Not |None)/.test(t));
  }
  if (surface === 'list' || surface === 'list-flat') {
    const rows = Array.from(document.querySelectorAll('#task-list .task-row'));
    facts.rows = rows.map((row) => ({
      title: row.querySelector('.task-title')?.textContent.trim() || '',
      badges: Array.from(row.querySelectorAll('.badge')).map((b) => b.textContent.trim()),
      ariaLabel: row.getAttribute('aria-label'),
    }));
    facts.stageGroups = Array.from(document.querySelectorAll('#task-list .stage-group')).map((g) => ({
      stage: g.getAttribute('data-stage'),
      heading: g.querySelector('.stage-title')?.textContent.trim() || '',
      count: g.querySelectorAll('.task-row').length,
      collapsed: Boolean(g.querySelector('[aria-expanded="false"]')),
    }));
  }
  if (surface === 'decisions' || surface === 'blocked') {
    facts.cards = Array.from(document.querySelectorAll('#decisions-list .section-card, #blocked-list .section-card, #blocked-list > *')).map((c) => c.innerText.replace(/\s+/g, ' ').trim().slice(0, 200));
    facts.badge = (document.querySelector('#decisions-count-badge, #blocked-count-badge') || {}).textContent;
  }
  if (/canvas|focus|zoom|arrange/.test(surface)) {
    facts.cards = document.querySelectorAll('.canvas-card').length;
    facts.wires = document.querySelectorAll('#canvas-wires path, #canvas-wires line').length;
    facts.legend = document.getElementById('dependency-legend').hidden ? null : document.getElementById('dependency-legend').innerText.replace(/\s+/g, ' ').trim();
    facts.zoom = document.getElementById('canvas-zoom-readout').textContent.trim();
    facts.canvasActions = Array.from(document.querySelectorAll('#canvas-controls button')).filter((el) => A.isVisible(el)).map((el) => el.getAttribute('aria-label') || el.textContent.trim());
    facts.showAll = { hidden: document.getElementById('canvas-show-all').hidden, text: document.getElementById('canvas-show-all').textContent.trim() };
    facts.cardsVisible = Array.from(document.querySelectorAll('.canvas-card')).filter((el) => A.isVisible(el) && A.inViewport(el)).length;
    facts.cardStatus = Array.from(document.querySelectorAll('.canvas-card')).map((el) => ({ number: el.getAttribute('data-issue-number'), status: el.querySelector('.canvas-card-status-chip')?.textContent.trim(), badges: el.querySelector('.canvas-card-meta')?.textContent.trim() || '' }));
    facts.undo = { hidden: document.getElementById('canvas-arrange-undo').hidden, disabled: document.getElementById('canvas-arrange-undo').disabled };
    facts.arrangeProgress = document.getElementById('arrange-progress-text').textContent.trim();
    facts.arrangeSummary = document.getElementById('arrange-summary').textContent.trim();
  }
  if (/filter/.test(surface)) {
    facts.filterOptions = document.querySelectorAll('.filter-option').length;
    facts.groups = Array.from(document.querySelectorAll('.sheet-group legend')).map((l) => l.textContent.trim());
    facts.appliedChips = Array.from(document.querySelectorAll('#filter-chips .filter-chip, #filter-chips > *')).map((c) => c.textContent.replace(/\s+/g, ' ').trim());
    facts.applyLabel = (document.getElementById('sheet-apply') || {}).textContent;
    facts.optionCounts = Array.from(document.querySelectorAll('.filter-option')).map((el) => ({ token: el.getAttribute('data-filter'), text: el.textContent.trim() }));
  }
  return facts;
}, key);

// ---- Synthetic matrix -----------------------------------------------------
async function runSynthetic() {
  for (const surface of SURFACES.filter((s) => !process.env.AUDIT_SURFACES || process.env.AUDIT_SURFACES.split(',').includes(s.key))) {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        for (const lang of LANGS) {
          const { context, page } = await newPage(viewport);
          try {
            resetFixture();
            await login(page);
            await setTheme(page, theme);
            await setLanguage(page, lang);
            await surface.setup(page);
            await sleep(120);
            const m = await measure(page);
            const facts = await extraFacts(page, surface.key);
            const file = `synthetic-${surface.key}-${viewport.width}-${theme}-${lang}.png`;
            await page.screenshot({ path: path.join(SHOTS, file) });
            report.rows.push({
              family: 'synthetic',
              surface: surface.key,
              width: viewport.width,
              height: viewport.height,
              theme,
              lang,
              capture: 'screenshots/' + file,
              measure: m,
              facts,
            });
          } catch (error) {
            report.errors.push({ surface: surface.key, width: viewport.width, theme, lang, message: error.message });
          } finally {
            await context.close();
          }
        }
      }
    }
    process.stderr.write(`surface ${surface.key} done (${report.rows.length} rows)\n`);
  }
}

// ---- Tap counts at 390 ----------------------------------------------------
// Real pointer clicks on the real DOM, counted at the document. Scrolling is
// counted separately because it is a gesture, not a tap.
async function runTaps() {
  resetFixture();
  const { context, page } = await newPage({ width: 390, height: 844 });
  await login(page);
  await setTheme(page, 'light');
  await setLanguage(page, 'en');
  await showList(page);
  await page.evaluate(() => {
    window.__tapCount = 0;
    window.__scrollCount = 0;
    document.addEventListener('pointerdown', () => { window.__tapCount += 1; }, true);
    window.addEventListener('scroll', () => { window.__scrollCount += 1; }, true);
  });

  // 1. Answer a gated question from the list.
  await page.evaluate(() => { window.__tapCount = 0; window.__scrollCount = 0; });
  const row = page.locator('#task-list .task-row', { hasText: 'Question: row density' }).first();
  await row.click();
  await page.waitForFunction(() => !document.getElementById('detail-view').hidden, null, { timeout: 10000 });
  await sleep(150);
  const afterOpen = await page.evaluate(() => {
    const gate = document.getElementById('human-review');
    const action = document.querySelector('#human-review-body button.primary');
    const option = document.querySelector('#human-review-body .question-option-card');
    const view = document.getElementById('detail-view');
    const r = (el) => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
    return {
      taps: window.__tapCount,
      scrolls: window.__scrollCount,
      gate: r(gate),
      action: action ? r(action) : null,
      actionInViewport: action ? (action.getBoundingClientRect().top >= 0 && action.getBoundingClientRect().bottom <= innerHeight) : null,
      option: option ? r(option) : null,
      viewport: innerHeight,
      scrollTop: Math.round(view.scrollTop),
      scrollHeight: view.scrollHeight,
    };
  });
  await page.locator('#human-review-body .question-option-card').first().locator('label').click();
  await sleep(80);
  const afterOption = await page.evaluate(() => ({ taps: window.__tapCount, scrolls: window.__scrollCount }));
  let actionClick = 'not needed in viewport';
  const actionVisible = await page.locator('#human-review-body button.primary').first().isVisible();
  if (actionVisible) {
    const box = await page.locator('#human-review-body button.primary').first().boundingBox();
    if (box && box.y >= 0 && box.y + box.height <= 844) {
      await page.locator('#human-review-body button.primary').first().click();
      await sleep(600);
      actionClick = 'clicked';
    } else {
      await page.locator('#human-review-body button.primary').first().scrollIntoViewIfNeeded();
      const afterScroll = await page.evaluate(() => ({ taps: window.__tapCount, scrolls: window.__scrollCount }));
      await page.locator('#human-review-body button.primary').first().click();
      await sleep(600);
      actionClick = 'clicked after scroll: ' + JSON.stringify(afterScroll);
    }
  }
  const answered = await page.evaluate(() => ({ taps: window.__tapCount, scrolls: window.__scrollCount, notice: document.getElementById('drawer-notice')?.textContent?.trim() || '', reviewState: document.getElementById('human-review').getAttribute('data-review-state') }));
  report.taps.answerGatedQuestion = { open: afterOpen, afterOption, actionClick, answered };
  await closeDrawer(page);

  // 2. Find out why a task is waiting (legacy: no clickable artifact).
  await page.evaluate(() => { window.__tapCount = 0; window.__scrollCount = 0; });
  await page.locator('#task-list .task-row', { hasText: 'Legacy waiting task' }).first().click();
  await page.waitForFunction(() => !document.getElementById('detail-view').hidden, null, { timeout: 10000 });
  await sleep(200);
  const why = await page.evaluate(() => {
    const gate = document.getElementById('human-review');
    const body = document.getElementById('human-review-body');
    const reason = body.querySelector('.human-review-reason');
    const b = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; };
    return {
      taps: window.__tapCount,
      scrolls: window.__scrollCount,
      gate: b(gate),
      reason: reason ? b(reason) : null,
      reasonInViewport: reason ? (reason.getBoundingClientRect().top >= 0 && reason.getBoundingClientRect().bottom <= innerHeight) : null,
      reasonText: reason ? reason.textContent.trim() : null,
      listBadges: Array.from(document.querySelectorAll('#task-list .task-row .badge')).map((x) => x.textContent.trim()).slice(0, 20),
    };
  });
  report.taps.whyWaiting = why;
  await closeDrawer(page);

  // 3. Open the drawer for a task that asks nothing.
  await page.evaluate(() => { window.__tapCount = 0; window.__scrollCount = 0; });
  await page.locator('#task-list .task-row', { hasText: 'Keyboard shortcuts' }).first().click();
  await page.waitForFunction(() => !document.getElementById('detail-view').hidden, null, { timeout: 10000 });
  await sleep(200);
  report.taps.calmDrawer = await page.evaluate(() => ({
    taps: window.__tapCount,
    scrolls: window.__scrollCount,
    humanReviewHidden: document.getElementById('human-review').hidden,
    drawerActions: Array.from(document.querySelectorAll('#detail-view button, #detail-view a[href], #detail-view select')).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    }).length,
    emptyStatements: Array.from(document.querySelectorAll('#detail-view p.muted')).map((p) => p.textContent.trim()).filter((t) => /^(No |Not |None)/.test(t)),
  }));
  await context.close();
}

// ---- Live, signed out -----------------------------------------------------
async function runLive() {
  const { context, page } = await newPage({ width: 390, height: 844 });
  try {
    const response = await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    report.live.httpStatus = response ? response.status() : null;
    await sleep(1200);
    const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 300));
    report.live.bodyText = body;
    report.live.title = await page.title();
    report.live.reachable = response ? response.status() === 200 : false;
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        for (const lang of LANGS) {
          await page.setViewportSize(viewport);
          await page.emulateMedia({ colorScheme: theme });
          const file = `live-signed-out-${viewport.width}-${theme}-${lang}.png`;
          await page.screenshot({ path: path.join(SHOTS, file) });
          report.rows.push({
            family: 'live',
            surface: 'signed-out',
            width: viewport.width,
            height: viewport.height,
            theme,
            lang,
            capture: 'screenshots/' + file,
            measure: await measure(page),
            facts: { httpStatus: report.live.httpStatus, bodyText: body },
          });
        }
      }
    }
  } catch (error) {
    report.live.error = error.message;
    report.live.reachable = false;
  } finally {
    await context.close();
  }
}

// ---- Run ------------------------------------------------------------------
try {
  await runLive();
  await runSynthetic();
  await runTaps();
} catch (error) {
  report.errors.push({ where: 'run', message: error.stack });
} finally {
  const git = (args) => { try { return execFileSync('git', args, { cwd: path.resolve(OUT, '../..'), encoding: 'utf8' }).trim(); } catch { return null; } };
  report.commit = git(['rev-parse', 'HEAD']);
  report.counts = {
    rows: report.rows.length,
    synthetic: report.rows.filter((r) => r.family === 'synthetic').length,
    live: report.rows.filter((r) => r.family === 'live').length,
    errors: report.errors.length,
  };
  fs.writeFileSync(path.join(OUT, 'measurements.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  await board.app.close();
  await fake.close();
}
console.log(JSON.stringify({ counts: report.counts, live: report.live, errors: report.errors.slice(0, 5), taps: report.taps }, null, 2));
if (report.errors.length) process.exitCode = 1;
