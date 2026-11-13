// V4-3 human review gate: real Chromium evidence.
//
// Seven fixture issues, one per waiting state the product must distinguish:
//   image / video / link / question / legacy / malformed / in-review
// For each, in the real DOM at 360x800, 390x844 and 1280x900, light and dark,
// English and French, this probe records what a reader can see and click:
// the artifact or the precise reason, the exact number of primary actions and
// their label, the one-line instruction, the inline image and its alt text, and
// the preset question with its details disclosure and free-text fallback.
//
// Synthetic only: a fake GitHub API and a local board. No real GitHub call, no
// token, no network. The image artifact is served by a Playwright route at the
// same https URL the parser requires, so the inline render is measurable while
// offline; the URL in the body is never rewritten.
//
// Usage (from verifications/V4-3):
//   source ../V4-2/scripts/browser-env.sh && node scripts/browser.mjs

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub, makeIssue } from '../../../../../../web/tests/fake-github.mjs';
import { startBoard, BOARD_PASSWORD } from '../../../../../../web/tests/helpers.mjs';

let pkg;
try { pkg = await import('/workspace/personal/lucas/charme-social/node_modules/playwright/index.js'); } catch { pkg = await import('playwright'); }
const { chromium } = pkg.default || pkg;

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true });

// ---- Fixtures -------------------------------------------------------------
// Every waiting card carries the section the parser accepts, except the two
// states that must prove a defect is reported instead of accepted.
const IMAGE_URL = 'https://example.com/screenshots/login-empty.png';
const IMAGE_INSTRUCTION = 'Compare the empty state with the approved mockup.';
const VIDEO_URL = 'https://example.com/clips/flow.mp4';
const VIDEO_INSTRUCTION = 'Watch the first ten seconds of the sign-in flow.';
const LINK_URL = 'https://example.com/preview/login';
const LINK_INSTRUCTION = 'Open the preview and confirm the button label.';
const QUESTION_TEXT = 'Which spacing should the list use?';

const IMAGE_BODY = [
  '## Overview', '', 'Review the empty state.', '',
  '### Human Review:', '- Artifact: image', `- URL: ${IMAGE_URL}`, `- Instruction: ${IMAGE_INSTRUCTION}`,
].join('\n');

const VIDEO_BODY = [
  '## Overview', '', 'Review the sign-in flow.', '',
  '### Human Review:', '- Artifact: video', `- URL: ${VIDEO_URL}`, `- Instruction: ${VIDEO_INSTRUCTION}`,
].join('\n');

const LINK_BODY = [
  '## Overview', '', 'Review the preview.', '',
  '### Human Review:', '- Artifact: link', `- URL: ${LINK_URL}`, `- Instruction: ${LINK_INSTRUCTION}`,
].join('\n');

const QUESTION_BODY = [
  '## Overview', '', 'Pick a row density.', '',
  '### Open Questions:', `- [ ] ${QUESTION_TEXT}`,
  '  - Compact :: Dense rows :: Best for scanning long queues.',
  '  - Comfortable :: Roomier rows :: Easier on a phone.', '',
  '### Human Review:', '- Artifact: question',
].join('\n');

// Legacy: the label is waiting, the body carries no section at all.
const LEGACY_BODY = '## Overview\n\nWaiting on a decision nobody can click.\n';
// Malformed: a section exists but its URL is not http(s), so it is refused.
const MALFORMED_BODY = [
  '### Human Review:', '- Artifact: image', '- URL: javascript:alert(1)', '- Instruction: Open it.',
].join('\n');
// In review: the agent's own gate, no artifact, nothing asked of the reader.
const IN_REVIEW_BODY = '## Overview\n\nThe agent is reviewing this task.\n';

const WAITING = ['status:needs-human'];
const fake = await startFakeGitHub({
  honorIfNoneMatch: true,
  issues: [
    makeIssue({ number: 1, title: 'Screenshot: empty state', body: IMAGE_BODY, labels: WAITING }),
    makeIssue({ number: 2, title: 'Video: sign-in flow', body: VIDEO_BODY, labels: WAITING }),
    makeIssue({ number: 3, title: 'Link: preview build', body: LINK_BODY, labels: WAITING }),
    makeIssue({ number: 4, title: 'Question: row density', body: QUESTION_BODY, labels: WAITING }),
    makeIssue({ number: 5, title: 'Legacy waiting task', body: LEGACY_BODY, labels: WAITING }),
    makeIssue({ number: 6, title: 'Broken artifact task', body: MALFORMED_BODY, labels: WAITING }),
    makeIssue({ number: 7, title: 'Task under agent review', body: IN_REVIEW_BODY, labels: ['status:in-review'] }),
  ],
});
const board = await startBoard(fake);

// A synthetic 320x200 PNG, generated here so the probe needs no asset file and
// no network. The image artifact URL stays the https URL from the issue body.
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

// ---- Expectations copied from the shipped client (web/public/app.js) ------
const EXPECT = {
  image: {
    title: { en: 'Waiting for you', fr: 'En attente de vous' },
    action: { en: 'Open screenshot', fr: 'Ouvrir la capture' },
    alt: { en: 'Review artifact for this task', fr: 'Élément à valider pour cette tâche' },
    instruction: IMAGE_INSTRUCTION,
    href: IMAGE_URL,
  },
  video: {
    title: { en: 'Waiting for you', fr: 'En attente de vous' },
    action: { en: 'Watch the video', fr: 'Regarder la vidéo' },
    instruction: VIDEO_INSTRUCTION,
    href: VIDEO_URL,
  },
  link: {
    title: { en: 'Waiting for you', fr: 'En attente de vous' },
    action: { en: 'Open the link', fr: 'Ouvrir le lien' },
    instruction: LINK_INSTRUCTION,
    href: LINK_URL,
  },
  question: {
    title: { en: 'Waiting for you', fr: 'En attente de vous' },
    action: { en: 'Answer', fr: 'Répondre' },
    details: { en: 'Details', fr: 'Détails' },
    other: { en: 'Write another answer', fr: 'Écrire une autre réponse' },
  },
  legacy: {
    title: { en: 'Waiting for an artifact', fr: 'En attente d’un élément à valider' },
    reason: {
      en: 'The body has no "### Human Review:" section.',
      fr: 'Le corps n’a pas de section « ### Human Review: ».',
    },
    notAnArtifact: { en: 'nothing you can click', fr: 'rien à cliquer' },
  },
  malformed: {
    title: { en: 'Waiting for an artifact', fr: 'En attente d’un élément à valider' },
    reason: {
      en: 'The "- URL:" value must start with http:// or https://.',
      fr: 'La valeur de « - URL: » doit commencer par http:// ou https://.',
    },
  },
  'in-review': {
    title: { en: 'Agent reviewing', fr: 'Agent en revue' },
    body: {
      en: 'The agent is reviewing this task. Nothing is asked of you.',
      fr: 'L’agent révise cette tâche. Rien ne vous est demandé.',
    },
    notAnArtifact: { en: 'nothing you can click', fr: 'rien à cliquer' },
  },
};

const STATES = [
  { key: 'image', issue: 1 },
  { key: 'video', issue: 2 },
  { key: 'link', issue: 3 },
  { key: 'question', issue: 4 },
  { key: 'legacy', issue: 5 },
  { key: 'malformed', issue: 6 },
  { key: 'in-review', issue: 7 },
];
const VIEWPORTS = [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 1280, height: 900 }];
const THEMES = ['light', 'dark'];
const LANGS = ['en', 'fr'];

// ---- Run ------------------------------------------------------------------
const browser = await chromium.launch({
  executablePath: process.env.H2_CHROME || '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  headless: true,
  args: ['--no-sandbox'],
});

const git = (args) => {
  try { return execFileSync('git', args, { cwd: path.resolve(OUT, '../../../../..'), encoding: 'utf8' }).trim(); } catch { return null; }
};
const report = {
  syntheticOnly: true,
  generatedAt: new Date().toISOString(),
  engine: 'chromium ' + browser.version(),
  // commit = last commit touching the implementation under test; probeHead = HEAD when this probe ran.
  commit: git(['log', '-1', '--format=%H', '--', 'web/server/board.ts']),
  probeHead: git(['rev-parse', 'HEAD']),
  fixture: {
    issues: STATES.map((state) => ({ state: state.key, number: state.issue, status: state.key === 'in-review' ? 'status:in-review' : 'status:needs-human' })),
    adjustments: [
      'Every waiting fixture issue is born with status:needs-human in the fake GitHub state, so this probe issues no status write. The V4-2 probe flipped issue 1 to needs-human through the UI, which V4-3 now refuses without an artifact; that refusal is covered by web/tests/v4-3-human-review.test.mjs and is not re-exercised here.',
      `The image artifact URL (${IMAGE_URL}) is fulfilled by a Playwright route with a synthetic 320x200 PNG, so the inline render and its natural width are measured without network access. The URL in the issue body is not rewritten and the parser still sees the https URL.`,
      'The legacy and malformed states deliberately carry a body the V4-3 parser refuses, because the point of those states is the precise reason shown to the reader.',
    ],
  },
  expectations: EXPECT,
  matrix: [],
  stateAssertions: {},
  failures: [],
  pageErrors: [],
  consoleErrors: [],
  expectedHttpErrors: [],
  csp: [],
  pass: false,
};

const failures = report.failures;
function record(row, name, ok, expected, actual) {
  row.assertions[name] = { ok: Boolean(ok), expected, actual };
  if (!ok) failures.push({ state: row.state, key: row.key, assertion: name, expected, actual });
}

const context = await browser.newContext({ viewport: VIEWPORTS[0], serviceWorkers: 'block', reducedMotion: 'reduce' });
await context.addInitScript(() => {
  window.__csp = [];
  window.addEventListener('securitypolicyviolation', (event) => window.__csp.push(event.violatedDirective));
});
const page = await context.newPage();
page.on('pageerror', (error) => report.pageErrors.push(error.message));
// No HTTP failure is injected by this probe, so every console error is unexpected.
page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });

// The image artifact is the only external request. Fulfil it locally.
await page.route('https://example.com/**', async (route) => {
  await route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
});

const wait = (callback, arg) => page.waitForFunction(callback, arg, { timeout: 15000 });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function setTheme(theme) {
  await page.evaluate((value) => window.__taskBoard.setThemeMode(value), theme);
  await wait((value) => document.documentElement.getAttribute('data-theme') === value, theme);
}
// The language is switched through the real control, never by rewriting text.
async function setLanguage(lang) {
  if (await page.evaluate(() => document.documentElement.lang) === lang) return;
  await page.evaluate(() => document.getElementById('lang-switch-btn').click());
  await wait((value) => document.documentElement.lang === value, lang);
}
async function openIssue(number) {
  await page.evaluate((n) => window.__taskBoard.openIssue(n), number);
  await wait((n) => window.__taskBoard.state.detail?.number === n && !document.getElementById('detail-view').hidden, number);
  await page.evaluate(() => { document.getElementById('detail-view').scrollTop = 0; });
}

const measure = () => page.evaluate(() => {
  const panel = document.getElementById('human-review');
  const body = document.getElementById('human-review-body');
  const box = panel.getBoundingClientRect();
  const bad = [];
  panel.querySelectorAll('*').forEach((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    if (rect.right > box.right + 1 || rect.left < box.left - 1) {
      bad.push({ tag: node.tagName, cls: String(node.className || ''), left: Math.round(rect.left), right: Math.round(rect.right) });
    }
  });
  const actions = Array.from(body.querySelectorAll('a.human-review-action, button.primary'));
  const images = Array.from(body.querySelectorAll('img'));
  const instruction = body.querySelector('.human-review-instruction');
  return {
    hidden: panel.hidden,
    reviewState: panel.getAttribute('data-review-state'),
    title: document.getElementById('human-review-title').textContent.trim(),
    text: body.innerText.replace(/\s+/g, ' ').trim(),
    actions: actions.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        tag: node.tagName,
        label: node.textContent.trim(),
        href: node.getAttribute('href'),
        rel: node.getAttribute('rel'),
        target: node.getAttribute('target'),
        inViewport: rect.top >= 0 && rect.bottom <= window.innerHeight,
      };
    }),
    images: images.map((img) => ({
      src: img.getAttribute('src'),
      alt: img.getAttribute('alt'),
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete,
    })),
    videos: body.querySelectorAll('video').length,
    links: body.querySelectorAll('a').length,
    buttons: body.querySelectorAll('button').length,
    instruction: instruction ? { text: instruction.textContent.trim(), visible: instruction.getBoundingClientRect().height > 0 } : null,
    cards: body.querySelectorAll('.question-option-card').length,
    disclosures: Array.from(body.querySelectorAll('.question-option-disclosure')).map((node) => node.getAttribute('aria-expanded')),
    answerInput: (() => { const input = body.querySelector('#answer-0'); if (!input) return null; return { id: input.id, visible: input.getBoundingClientRect().height > 0 }; })(),
    freeText: (() => { const details = body.querySelector('.question-other-answer'); return details ? { open: details.open, summary: details.querySelector('summary')?.textContent.trim() } : null; })(),
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    panelOverflow: { scrollWidth: panel.scrollWidth, clientWidth: panel.clientWidth, bad },
    lang: document.documentElement.lang,
    theme: document.documentElement.getAttribute('data-theme'),
  };
});

function assertRow(row, state, lang) {
  const expect = EXPECT[state];
  const m = row.measure;
  record(row, 'panelVisible', m.hidden === false, false, m.hidden);
  record(row, 'title', m.title === expect.title[lang], expect.title[lang], m.title);
  record(row, 'langApplied', m.lang === lang, lang, m.lang);
  record(row, 'themeApplied', m.theme === row.theme, row.theme, m.theme);
  record(row, 'noHorizontalPageScroll', m.scrollWidth <= row.width, `<= ${row.width}`, m.scrollWidth);
  record(row, 'gateElementOverflow', m.panelOverflow.bad.length === 0 && m.panelOverflow.scrollWidth <= m.panelOverflow.clientWidth + 1,
    'no gate element wider than its container', m.panelOverflow);

  if (state === 'image' || state === 'video' || state === 'link') {
    record(row, 'onePrimaryAction', m.actions.length === 1, 1, m.actions);
    const action = m.actions[0] || {};
    record(row, 'actionIsLink', action.tag === 'A', 'A', action.tag);
    record(row, 'actionLabel', action.label === expect.action[lang], expect.action[lang], action.label);
    record(row, 'actionHref', action.href === expect.href, expect.href, action.href);
    record(row, 'actionRel', action.rel === 'noopener noreferrer', 'noopener noreferrer', action.rel);
    record(row, 'noButtons', m.buttons === 0, 0, m.buttons);
    record(row, 'instructionVisible', Boolean(m.instruction && m.instruction.visible), true, m.instruction);
    record(row, 'instructionText', m.instruction?.text === expect.instruction, expect.instruction, m.instruction?.text);
    record(row, 'noInlineVideo', m.videos === 0, 0, m.videos);
    if (state === 'image') {
      record(row, 'oneInlineImage', m.images.length === 1, 1, m.images);
      const image = m.images[0] || {};
      record(row, 'imageSrc', image.src === IMAGE_URL, IMAGE_URL, image.src);
      record(row, 'imageAlt', typeof image.alt === 'string' && image.alt.length > 0 && image.alt === expect.alt[lang], expect.alt[lang], image.alt);
      record(row, 'imageRendered', image.complete === true && image.naturalWidth > 0, 'naturalWidth > 0', image);
    } else {
      record(row, 'noInlineImage', m.images.length === 0, 0, m.images.length);
    }
  } else if (state === 'question') {
    record(row, 'onePrimaryAction', m.actions.length === 1, 1, m.actions);
    const action = m.actions[0] || {};
    record(row, 'actionIsButton', action.tag === 'BUTTON', 'BUTTON', action.tag);
    record(row, 'actionLabel', action.label === expect.action[lang], expect.action[lang], action.label);
    record(row, 'presetCards', m.cards === 2, 2, m.cards);
    record(row, 'detailsDisclosures', m.disclosures.length === 2 && m.disclosures.every((value) => value === 'false'), ['false', 'false'], m.disclosures);
    record(row, 'detailsLabel', row.detailsLabel === expect.details[lang], expect.details[lang], row.detailsLabel);
    record(row, 'detailsExpanded', row.detailsExpanded === 'true' && row.detailsVisible === true, 'aria-expanded=true and details visible', { expanded: row.detailsExpanded, visible: row.detailsVisible });
    record(row, 'freeTextPath', m.freeText?.summary === expect.other[lang], expect.other[lang], m.freeText);
    record(row, 'freeTextField', Boolean(m.answerInput) && m.answerInput.id === 'answer-0' && m.answerInput.visible === true, 'visible #answer-0', m.answerInput);
    record(row, 'noLinks', m.links === 0, 0, m.links);
  } else {
    // legacy, malformed, in-review: nothing clickable, no primary action.
    record(row, 'zeroActions', m.actions.length === 0, 0, m.actions);
    record(row, 'zeroLinks', m.links === 0, 0, m.links);
    record(row, 'zeroButtons', m.buttons === 0, 0, m.buttons);
    record(row, 'noImages', m.images.length === 0, 0, m.images.length);
    if (state === 'legacy' || state === 'malformed') {
      record(row, 'reasonShown', m.text.includes(expect.reason[lang]), expect.reason[lang], m.text);
      record(row, 'stateIsNotReady', m.reviewState === (state === 'legacy' ? 'missing' : 'malformed'), state === 'legacy' ? 'missing' : 'malformed', m.reviewState);
    }
    if (state === 'legacy') {
      // The card must say, in the reader's words, that there is nothing to
      // click; that sentence is the proof it is not shown as a ready artifact.
      record(row, 'helpSaysNothingClickable', m.text.includes(expect.notAnArtifact[lang]), expect.notAnArtifact[lang], m.text);
    }
    if (state === 'in-review') {
      record(row, 'agentReviewBody', m.text.includes(expect.body[lang]), expect.body[lang], m.text);
      record(row, 'notAWaitingPrompt',
        m.title !== EXPECT.legacy.title[lang] && m.title !== EXPECT.image.title[lang] && !m.text.includes(EXPECT.legacy.reason[lang]),
        `neither "${EXPECT.image.title[lang]}" nor "${EXPECT.legacy.title[lang]}", and no missing-section reason`,
        { title: m.title, text: m.text });
    }
  }
}

try {
  const response = await page.goto(board.url);
  const cspHeader = response.headers()['content-security-policy'] || '';
  assert.ok(cspHeader.includes("style-src 'self'"), 'CSP header missing style-src self');
  assert.ok(cspHeader.includes("img-src 'self' data: https:"), 'CSP image allowance changed');
  report.cspHeader = cspHeader;
  await page.locator('#password').fill(BOARD_PASSWORD);
  await page.locator('#login-btn').click();
  await wait(() => window.__taskBoard?.state.board?.issues.length === 7);

  for (const state of STATES) {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        for (const lang of LANGS) {
          await page.setViewportSize(viewport);
          await setTheme(theme);
          await setLanguage(lang);
          await openIssue(state.issue);
          if (state.key === 'image') {
            await page.waitForFunction(() => {
              const img = document.querySelector('#human-review-body img');
              return Boolean(img) && img.complete && img.naturalWidth > 0;
            }, null, { timeout: 15000 }).catch(() => {});
          }
          // Frame the gate without hiding it under the sticky drawer identity bar,
          // and without scrolling when it already sits below that bar.
          await page.evaluate(() => {
            const view = document.getElementById('detail-view');
            const panel = document.getElementById('human-review');
            const identity = document.querySelector('.drawer-identity');
            const viewRect = view.getBoundingClientRect();
            const floor = identity ? identity.getBoundingClientRect().bottom + 8 : viewRect.top + 8;
            let rect = panel.getBoundingClientRect();
            if (rect.top < floor) { view.scrollTop += rect.top - floor; rect = panel.getBoundingClientRect(); }
            if (rect.height <= viewRect.height - 80 && rect.bottom > viewRect.bottom - 8) {
              view.scrollTop += rect.bottom - (viewRect.bottom - 8);
            }
          });
          await sleep(60);

          const row = {
            state: state.key,
            issue: state.issue,
            width: viewport.width,
            height: viewport.height,
            theme,
            lang,
            key: `${state.key}-${viewport.width}-${theme}-${lang}`,
            assertions: {},
          };
          row.measure = await measure();

          if (state.key === 'question') {
            const disclosure = page.locator('#human-review-body .question-option-disclosure').first();
            row.detailsLabel = (await disclosure.innerText()).trim();
            await disclosure.click();
            row.detailsExpanded = await disclosure.getAttribute('aria-expanded');
            row.detailsVisible = await page.locator('#human-review-body .question-option-details').first().isVisible();
            const other = page.locator('#human-review-body .question-other-answer').first();
            if (await other.count()) {
              await other.locator('summary').click();
              row.measure.answerInput = await page.evaluate(() => {
                const input = document.querySelector('#human-review-body #answer-0');
                return input ? { id: input.id, visible: input.getBoundingClientRect().height > 0 } : null;
              });
              row.measure.freeText = await page.evaluate(() => {
                const details = document.querySelector('#human-review-body .question-other-answer');
                return details ? { open: details.open, summary: details.querySelector('summary')?.textContent.trim() } : null;
              });
            }
          }

          assertRow(row, state.key, lang);
          row.shot = 'screenshots/' + row.key + '.png';
          await page.screenshot({ path: path.join(OUT, 'screenshots', row.key + '.png') });
          row.shots = [row.shot];
          // The question gate is taller than a phone viewport, so its single
          // Answer action is captured in a second shot instead of being cropped.
          if (state.key === 'question') {
            await page.locator('#human-review-body button.primary').first().scrollIntoViewIfNeeded();
            const extra = 'screenshots/' + row.key + '-answer.png';
            await page.screenshot({ path: path.join(OUT, extra) });
            row.shots.push(extra);
          }
          report.matrix.push(row);
          report.csp.push(...await page.evaluate(() => window.__csp));
        }
      }
    }
  }
} catch (error) {
  report.error = error.stack;
} finally {
  for (const row of report.matrix) {
    const entry = report.stateAssertions[row.state] || (report.stateAssertions[row.state] = { rows: 0, assertions: {} });
    entry.rows += 1;
    for (const [name, result] of Object.entries(row.assertions)) {
      const tally = entry.assertions[name] || (entry.assertions[name] = { rows: 0, failed: 0 });
      tally.rows += 1;
      if (!result.ok) tally.failed += 1;
    }
  }
  report.counts = {
    rows: report.matrix.length,
    screenshots: report.matrix.length,
    extraScreenshots: report.matrix.reduce((total, row) => total + row.shots.length - 1, 0),
    failedAssertions: failures.length,
    pageErrors: report.pageErrors.length,
    consoleErrors: report.consoleErrors.length,
    expectedHttpErrors: report.expectedHttpErrors.length,
    cspViolations: report.csp.length,
  };
  report.pass = !report.error
    && failures.length === 0
    && report.pageErrors.length === 0
    && report.consoleErrors.length === 0
    && report.csp.length === 0
    && report.matrix.length === STATES.length * VIEWPORTS.length * THEMES.length * LANGS.length;
  fs.writeFileSync(path.join(OUT, 'browser.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  await board.app.close();
  await fake.close();
}
console.log(JSON.stringify({ pass: report.pass, counts: report.counts, failures: failures.slice(0, 20), pageErrors: report.pageErrors, consoleErrors: report.consoleErrors, csp: report.csp }));
if (!report.pass) process.exitCode = 1;
