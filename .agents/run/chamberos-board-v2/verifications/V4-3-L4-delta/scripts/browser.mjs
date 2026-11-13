// V4-3-L4 independent browser probe. Written by the reviewer, not by the
// authors. It asks the questions the brief asks, not the ones the authors'
// probe already answers:
//
//  1. Is the one primary action actually in the viewport and hit-testable (not
//     covered, not clipped) at 360 and 1280, light/dark, EN/FR?
//  2. Is the inline image's fallback precise when the URL 404s?
//  3. Can the reader move a legacy waiting card out of waiting themselves,
//     through the drawer control, at 360?
//  4. Does an in-review card ever ask the reader something in the review panel?
//  5. Does a settled question read honestly ("Answer received")?
//  6. Does answering the gated question in the browser take the card out of the
//     waiting column?
//
// Synthetic only: fake GitHub, local board, Playwright route for the image.
//   source ../V4-2/scripts/browser-env.sh && node scripts/browser.mjs

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub, makeIssue } from '../../../../../../web/tests/fake-github.mjs';
import { startBoard, BOARD_PASSWORD } from '../../../../../../web/tests/helpers.mjs';

let pkg;
try { pkg = await import('/workspace/personal/lucas/charme-social/node_modules/playwright/index.js'); } catch { pkg = await import('playwright'); }
const { chromium } = pkg.default || pkg;

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true });

const IMAGE_URL = 'https://example.com/screenshots/login-empty.png';
const IMAGE_404_URL = 'https://example.com/missing/not-an-image.png';
const INSTRUCTION = 'Compare the empty state with the approved mockup.';

const body = (lines) => lines.join('\n');
const IMAGE_BODY = body(['## Overview', '', 'Review the empty state.', '', '### Human Review:', '- Artifact: image', `- URL: ${IMAGE_URL}`, `- Instruction: ${INSTRUCTION}`]);
const IMAGE_404_BODY = body(['## Overview', '', 'Review the missing artifact.', '', '### Human Review:', '- Artifact: image', `- URL: ${IMAGE_404_URL}`, '- Instruction: Open the screenshot that does not exist.']);
const VIDEO_BODY = body(['### Human Review:', '- Artifact: video', '- URL: https://example.com/clips/flow.mp4', '- Instruction: Watch the first ten seconds.']);
const LINK_BODY = body(['### Human Review:', '- Artifact: link', '- URL: https://example.com/preview/login', '- Instruction: Open the preview and confirm the button label.']);
const QUESTION_BODY = body([
  '## Overview', '', 'Pick a row density.', '',
  '### Open Questions:', '- [ ] Which spacing should the list use?',
  '  - Compact :: Dense rows :: Best for scanning long queues.',
  '  - Comfortable :: Roomier rows :: Easier on a phone.', '',
  '### Human Review:', '- Artifact: question',
]);
const SETTLED_BODY = body([
  '## Overview', '', 'Pick a row density.', '',
  '### Open Questions:', '- [x] Which spacing should the list use?',
  '  - Compact :: Dense rows :: Best for scanning long queues.', '',
  '### Human Review:', '- Artifact: question',
]);
const LEGACY_BODY = '## Overview\n\nWaiting on a decision nobody can click.\n';
const MALFORMED_BODY = body(['### Human Review:', '- Artifact: image', '- URL: javascript:alert(1)', '- Instruction: Open it.']);
const IN_REVIEW_BODY = body([
  '## Overview', '', 'The agent is reviewing this task.', '',
  '### Open Questions:', '- [ ] Should the agent also rename the field?',
  '  - Yes :: Keep it consistent',
  '  - No :: Leave it',
]);
const WAITING = ['status:needs-human'];

const fake = await startFakeGitHub({
  honorIfNoneMatch: true,
  issues: [
    makeIssue({ number: 1, title: 'Screenshot: empty state', body: IMAGE_BODY, labels: WAITING }),
    makeIssue({ number: 2, title: 'Screenshot that 404s', body: IMAGE_404_BODY, labels: WAITING }),
    makeIssue({ number: 3, title: 'Video: sign-in flow', body: VIDEO_BODY, labels: WAITING }),
    makeIssue({ number: 4, title: 'Link: preview build', body: LINK_BODY, labels: WAITING }),
    makeIssue({ number: 5, title: 'Question: row density', body: QUESTION_BODY, labels: WAITING }),
    makeIssue({ number: 6, title: 'Legacy waiting task', body: LEGACY_BODY, labels: WAITING }),
    makeIssue({ number: 7, title: 'Broken artifact task', body: MALFORMED_BODY, labels: WAITING }),
    makeIssue({ number: 8, title: 'Task under agent review', body: IN_REVIEW_BODY, labels: ['status:in-review'] }),
    makeIssue({ number: 9, title: 'Answered question, still waiting', body: SETTLED_BODY, labels: WAITING }),
  ],
});
const board = await startBoard(fake);

function makePng(width, height) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y += 1) {
    raw[o] = 0; o += 1;
    for (let x = 0; x < width; x += 1) { raw[o] = 40; o += 1; raw[o] = 120; o += 1; raw[o] = 200; o += 1; }
  }
  const table = [];
  for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  const crc = (buf) => { let c = 0xffffffff; for (const byte of buf) c = table[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const length = Buffer.alloc(4); length.writeUInt32BE(data.length); const b = Buffer.concat([Buffer.from(type, 'ascii'), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(b)); return Buffer.concat([length, b, sum]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const PNG = makePng(320, 200);

const STATES = [
  { key: 'image', issue: 1 },
  { key: 'image-404', issue: 2 },
  { key: 'video', issue: 3 },
  { key: 'link', issue: 4 },
  { key: 'question', issue: 5 },
  { key: 'legacy', issue: 6 },
  { key: 'malformed', issue: 7 },
  { key: 'in-review', issue: 8 },
  { key: 'settled', issue: 9 },
];
const VIEWPORTS = [{ width: 360, height: 800 }, { width: 1280, height: 900 }];
const THEMES = ['light', 'dark'];
const LANGS = ['en', 'fr'];

const report = { generatedAt: new Date().toISOString(), engine: null, matrix: [], interactions: {}, failures: [], pageErrors: [], consoleErrors: [], csp: [], pass: false };
const record = (row, name, ok, expected, actual) => {
  row.assertions[name] = { ok: Boolean(ok), expected, actual };
  if (!ok) report.failures.push({ state: row.state, key: row.key, assertion: name, expected, actual });
};

const browser = await chromium.launch({
  executablePath: process.env.H2_CHROME || '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  headless: true,
  args: ['--no-sandbox'],
});
report.engine = 'chromium ' + browser.version();

const context = await browser.newContext({ viewport: VIEWPORTS[0], serviceWorkers: 'block', reducedMotion: 'reduce' });
await context.addInitScript(() => {
  window.__csp = [];
  window.addEventListener('securitypolicyviolation', (event) => window.__csp.push(event.violatedDirective));
});
const page = await context.newPage();
page.on('pageerror', (error) => report.pageErrors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error' && !/404|Failed to load resource/i.test(message.text())) report.consoleErrors.push(message.text()); });
await page.route('https://example.com/**', async (route) => {
  if (route.request().url() === IMAGE_URL) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
});

const wait = (callback, arg) => page.waitForFunction(callback, arg, { timeout: 20000 });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const setTheme = async (theme) => { await page.evaluate((value) => window.__taskBoard.setThemeMode(value), theme); await wait((v) => document.documentElement.getAttribute('data-theme') === v, theme); };
const setLanguage = async (lang) => { if (await page.evaluate(() => document.documentElement.lang) === lang) return; await page.evaluate(() => document.getElementById('lang-switch-btn').click()); await wait((v) => document.documentElement.lang === v, lang); };
const openIssue = async (number) => {
  await page.evaluate((n) => window.__taskBoard.openIssue(n), number);
  await wait((n) => window.__taskBoard.state.detail?.number === n && !document.getElementById('detail-view').hidden, number);
  await page.evaluate(() => { document.getElementById('detail-view').scrollTop = 0; });
  await sleep(120);
};

const measure = () => page.evaluate(() => {
  const panel = document.getElementById('human-review');
  const body = document.getElementById('human-review-body');
  const viewport = { w: window.innerWidth, h: window.innerHeight };
  const visible = (node) => {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = getComputedStyle(node);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    return rect.bottom > 0 && rect.top < viewport.h;
  };
  const hit = (node) => {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { ok: false, reason: 'zero-size' };
    const x = Math.min(Math.max(rect.left + rect.width / 2, 0), viewport.w - 1);
    const y = Math.min(Math.max(rect.top + rect.height / 2, 0), viewport.h - 1);
    const top = document.elementFromPoint(x, y);
    const covered = !(top === node || node.contains(top) || (top && top.closest && top.closest('a,button') === node));
    return {
      ok: !covered && rect.left >= -1 && rect.right <= viewport.w + 1 && rect.top >= -1 && rect.bottom <= viewport.h + 1,
      covered,
      inViewport: rect.top >= -1 && rect.bottom <= viewport.h + 1 && rect.left >= -1 && rect.right <= viewport.w + 1,
      topTag: top ? top.tagName + '.' + String(top.className || '') : null,
      rect: { left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom) },
    };
  };
  const actions = Array.from(body.querySelectorAll('a.human-review-action, button.primary'));
  const instruction = body.querySelector('.human-review-instruction');
  const image = body.querySelector('img.human-review-image');
  const fallback = body.querySelector('.human-review-image-error');
  const statusSelect = document.getElementById('status-select');
  return {
    hidden: panel.hidden,
    reviewState: panel.getAttribute('data-review-state'),
    title: document.getElementById('human-review-title').textContent.trim(),
    text: body.innerText.replace(/\s+/g, ' ').trim(),
    actions: actions.map((node) => ({ tag: node.tagName, label: node.textContent.trim(), href: node.getAttribute('href'), hit: hit(node) })),
    panelHit: { rect: (() => { const r = panel.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top) }; })() },
    instruction: instruction ? { text: instruction.textContent.trim(), visible: visible(instruction), hit: hit(instruction) } : null,
    image: image ? { src: image.getAttribute('src'), hidden: image.hidden, naturalWidth: image.naturalWidth, alt: image.getAttribute('alt'), complete: image.complete } : null,
    fallback: fallback ? { hidden: fallback.hidden, text: fallback.textContent.trim(), visible: visible(fallback) } : null,
    links: body.querySelectorAll('a').length,
    buttons: body.querySelectorAll('button').length,
    cards: body.querySelectorAll('.question-option-card').length,
    answerInput: (() => { const input = body.querySelector('#answer-0'); return input ? { present: true, visible: visible(input) } : null; })(),
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: viewport.w,
    lang: document.documentElement.lang,
    theme: document.documentElement.getAttribute('data-theme'),
    statusControl: statusSelect ? {
      present: true,
      disabled: statusSelect.disabled,
      visible: visible(statusSelect),
      options: Array.from(statusSelect.options).map((option) => option.value),
      applyVisible: visible(document.getElementById('apply-status')),
    } : null,
    boardStatus: (() => {
      const detail = window.__taskBoard.state.detail;
      return detail ? { statusLabel: detail.statusLabel, humanReview: detail.humanReview?.state ?? null } : null;
    })(),
  };
});

try {
  const response = await page.goto(board.url);
  const cspHeader = response.headers()['content-security-policy'] || '';
  report.cspHeader = cspHeader;
  await page.locator('#password').fill(BOARD_PASSWORD);
  await page.locator('#login-btn').click();
  await wait(() => window.__taskBoard?.state.board?.issues.length === 9);

  for (const state of STATES) {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        for (const lang of LANGS) {
          await page.setViewportSize(viewport);
          await setTheme(theme);
          await setLanguage(lang);
          await openIssue(state.issue);
          if (state.key === 'image') {
            await wait(() => { const img = document.querySelector('#human-review-body img'); return img && img.complete; }).catch(() => {});
          }
          if (state.key === 'image-404') {
            await wait(() => document.querySelector('#human-review-body .human-review-image-error')?.hidden === false).catch(() => {});
          }
          // Frame the gate so "clipped or covered" is judged on the gate itself,
          // not on whether the drawer happens to be scrolled to it.
          await page.evaluate(() => { const panel = document.getElementById('human-review'); if (panel && !panel.hidden) panel.scrollIntoView({ block: 'center' }); });
          await sleep(150);
          const m = await measure();
          const row = { state: state.key, issue: state.issue, width: viewport.width, height: viewport.height, theme, lang, key: `${state.key}-${viewport.width}-${theme}-${lang}`, assertions: {}, measure: m };
          const shot = path.join(OUT, 'screenshots', 'l4-' + row.key + '.png');
          await page.screenshot({ path: shot });

          record(row, 'langApplied', m.lang === lang, lang, m.lang);
          record(row, 'themeApplied', m.theme === theme, theme, m.theme);
          record(row, 'noHorizontalPageScroll', m.scrollWidth <= m.innerWidth, `<= ${m.innerWidth}`, m.scrollWidth);
          record(row, 'panelInsideViewport', m.panelHit.rect.left >= -1 && m.panelHit.rect.right <= m.innerWidth + 1, 'panel box inside viewport width', m.panelHit.rect);
          record(row, 'panelShown', m.hidden === false, 'panel visible for this state', m.hidden);

          if (state.key === 'image' || state.key === 'video' || state.key === 'link' || state.key === 'question') {
            record(row, 'exactlyOnePrimaryAction', m.actions.length === 1, 1, m.actions.map((a) => a.label));
            const action = m.actions[0] || {};
            record(row, 'primaryActionInViewportAndHitTestable', action.hit?.ok === true && action.hit?.covered === false, 'in viewport, not covered', action.hit);
          }
          if (state.key === 'image') {
            record(row, 'imageRendered', m.image && m.image.complete === true && m.image.naturalWidth > 0, 'naturalWidth > 0', m.image);
            record(row, 'instructionVisibleAndHitTestable', Boolean(m.instruction?.visible) && m.instruction?.hit?.covered === false, 'visible and not covered', m.instruction);
          }
          if (state.key === 'image-404') {
            record(row, 'imageHiddenAfterFailure', m.image ? m.image.hidden === true : false, true, m.image);
            record(row, 'fallbackVisible', Boolean(m.fallback && m.fallback.visible), true, m.fallback);
            record(row, 'fallbackIsPrecise', /could not be loaded|n’a pas pu être chargée/i.test(m.fallback?.text || ''), 'names the failure', m.fallback?.text);
            record(row, 'actionStillAvailable', m.actions.length === 1 && m.actions[0].hit?.ok === true, 'one working action', m.actions);
          }
          if (state.key === 'question') {
            record(row, 'twoPresets', m.cards === 2, 2, m.cards);
            record(row, 'freeTextReachable', Boolean(m.answerInput?.present), '#answer-0 present', m.answerInput);
          }
          if (state.key === 'legacy' || state.key === 'malformed') {
            record(row, 'noActionAtAll', m.actions.length === 0 && m.links === 0 && m.buttons === 0, '0 actions, 0 links, 0 buttons', { actions: m.actions.length, links: m.links, buttons: m.buttons });
            record(row, 'reasonShown', /Human Review|URL|Artifact|section/i.test(m.text), 'precise reason text', m.text);
            record(row, 'statusControlAvailable', m.statusControl?.present === true && m.statusControl?.applyVisible === true && (m.statusControl?.options || []).includes('status:in-progress'), 'drawer status control offers in-progress', m.statusControl);
          }
          if (state.key === 'in-review') {
            record(row, 'panelAsksNothing', m.actions.length === 0 && m.links === 0 && m.buttons === 0, 'no action in the review panel', { actions: m.actions.length, links: m.links, buttons: m.buttons });
            record(row, 'agentReviewCopy', /agent is reviewing|agent révise/i.test(m.text), 'agent review sentence', m.text);
            record(row, 'notAWaitingTitle', m.title !== 'Waiting for an artifact' && m.title !== 'En attente d’un élément à valider', 'not the waiting title', m.title);
          }
          if (state.key === 'settled') {
            record(row, 'settledTitle', m.title === 'Answer received' || m.title === 'Réponse reçue', 'Answer received / Réponse reçue', m.title);
            record(row, 'settledNoAction', m.actions.length === 0 && m.links === 0 && m.buttons === 0, 'no action', { actions: m.actions.length, links: m.links, buttons: m.buttons });
            record(row, 'settledSaysAgentMustResume', /pick this task up again|reprendre cette tâche/i.test(m.text), 'says the agent must resume', m.text);
            record(row, 'settledStatusControlAvailable', m.statusControl?.present === true && m.statusControl?.applyVisible === true, 'drawer status control available', m.statusControl);
          }
          report.matrix.push(row);
        }
      }
    }
  }

  // ---- Interactions ------------------------------------------------------
  await page.setViewportSize({ width: 360, height: 800 });
  await setTheme('light');
  await setLanguage('en');

  // 1. Answer the gated question in the browser: the card must leave waiting.
  {
    await openIssue(5);
    const before = await page.evaluate(() => ({ statusLabel: window.__taskBoard.state.detail.statusLabel, column: window.__taskBoard.state.detail.column }));
    await page.locator('#human-review-body .question-option-card input[type=radio]').first().check();
    await page.locator('#human-review-body form button[type=submit]').click();
    await wait(() => window.__taskBoard.state.detail?.statusLabel === 'status:in-progress').catch(() => {});
    await sleep(400);
    const after = await page.evaluate(() => ({ statusLabel: window.__taskBoard.state.detail.statusLabel, humanReview: window.__taskBoard.state.detail.humanReview?.state, panelHidden: document.getElementById('human-review').hidden }));
    report.interactions.answerQuestion = { before, after };
  }

  // 2. Legacy card: can the reader move it out of waiting through the drawer?
  {
    await openIssue(6);
    const before = await page.evaluate(() => window.__taskBoard.state.detail.statusLabel);
    await page.selectOption('#status-select', 'status:in-progress');
    await page.locator('#apply-status').click();
    await wait(() => window.__taskBoard.state.detail?.statusLabel === 'status:in-progress').catch(() => {});
    await sleep(400);
    const after = await page.evaluate(() => ({ statusLabel: window.__taskBoard.state.detail.statusLabel, panelHidden: document.getElementById('human-review').hidden }));
    report.interactions.legacyEscape = { before, after };
  }

  // 3. In-review card: does the rest of the drawer still ask the reader
  //    something (open questions are a separate surface, recorded, not asserted)?
  {
    await openIssue(8);
    report.interactions.inReviewDrawer = await page.evaluate(() => ({
      reviewPanel: document.getElementById('human-review-body').innerText.replace(/\s+/g, ' ').trim(),
      reviewPanelActions: document.querySelectorAll('#human-review-body a, #human-review-body button').length,
      openQuestionForms: document.querySelectorAll('#question-list form').length,
      openQuestionItems: document.querySelectorAll('#question-list li').length,
      questionsSectionHidden: document.getElementById('question-list').parentElement.hidden,
    }));
  }

  // 4. Legacy card in the board list: what does the row say?
  {
    report.interactions.legacyRow = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#task-list button, #task-list [role=button]'));
      const row = rows.find((node) => node.textContent.includes('Legacy waiting task'));
      return row ? { text: row.innerText.replace(/\s+/g, ' ').trim(), badges: Array.from(row.querySelectorAll('.human-review-badge')).map((b) => ({ text: b.textContent, title: b.getAttribute('title') })) } : null;
    });
  }

  report.csp = await page.evaluate(() => window.__csp);
} finally {
  await browser.close();
  await board.app.close();
  await fake.close();
}

report.pass = report.failures.length === 0 && report.pageErrors.length === 0 && report.csp.length === 0;
report.counts = {
  rows: report.matrix.length,
  assertions: report.matrix.reduce((total, row) => total + Object.keys(row.assertions).length, 0),
  failedAssertions: report.failures.length,
  screenshots: fs.readdirSync(path.join(OUT, 'screenshots')).filter((name) => name.startsWith('l4-')).length,
};
fs.writeFileSync(path.join(OUT, 'l4-browser.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass: report.pass, counts: report.counts, failures: report.failures.slice(0, 20), interactions: report.interactions, csp: report.csp, pageErrors: report.pageErrors, consoleErrors: report.consoleErrors }, null, 2));
