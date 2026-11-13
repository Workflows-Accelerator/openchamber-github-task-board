// V4-3-L4-delta browser probe. Written by the delta reviewer, not by the
// authors. It asks what the reader actually sees after the F1-F4 corrections:
//
//  F1  answering a waiting question leaves the waiting column; the card reads
//      the settled state in EN and FR; a done task's gate never renders a wait.
//  F3  a preset-less question gate reads malformed in EN and FR, and is still
//      answerable through the Open Questions list (typed answer).
//  F4  the invalid-URL reason states the real limits in EN and FR.
//
// Synthetic only: fake GitHub, local board, Playwright route for the image.
//   source ../V4-2/scripts/browser-env.sh && node scripts/browser-delta.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub, makeIssue } from '../../../../../../web/tests/fake-github.mjs';
import { startBoard, BOARD_PASSWORD } from '../../../../../../web/tests/helpers.mjs';

let pkg;
try { pkg = await import('/workspace/personal/lucas/charme-social/node_modules/playwright/index.js'); } catch { pkg = await import('playwright'); }
const { chromium } = pkg.default || pkg;

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true });

const QUESTION_BODY = [
  '## Overview', '', 'Pick a row density.', '',
  '### Open Questions:', '- [ ] Which spacing should the list use?',
  '  - Compact :: Dense rows :: Best for scanning long queues.',
  '  - Comfortable :: Roomier rows :: Easier on a phone.', '',
  '### Human Review:', '- Artifact: question',
].join('\n');
const NO_PRESETS_BODY = '## Overview\n\nPick one.\n\n### Open Questions:\n- [ ] Is the wording right?\n\n### Human Review:\n- Artifact: question\n';
const longUrl = 'https://example.com/' + 'a'.repeat(2049 - 'https://example.com/'.length);
const LONG_URL_BODY = ['### Human Review:', '- Artifact: link', `- URL: ${longUrl}`, '- Instruction: Open it.'].join('\n');
const SPACE_URL_BODY = ['### Human Review:', '- Artifact: link', '- URL: https://example.com/a b', '- Instruction: Open it.'].join('\n');

const fake = await startFakeGitHub({
  honorIfNoneMatch: true,
  issues: [
    makeIssue({ number: 1, title: 'Question: row density', body: QUESTION_BODY, labels: ['status:needs-human'] }),
    makeIssue({ number: 2, title: 'Question without presets', body: NO_PRESETS_BODY, labels: ['status:needs-human'] }),
    makeIssue({ number: 3, title: 'Link: too long', body: LONG_URL_BODY, labels: ['status:needs-human'] }),
    makeIssue({ number: 4, title: 'Link: with a space', body: SPACE_URL_BODY, labels: ['status:needs-human'] }),
    makeIssue({ number: 5, title: 'Done task with a question gate', body: QUESTION_BODY, labels: ['status:done'] }),
    makeIssue({ number: 6, title: 'In-review task with a question gate', body: QUESTION_BODY, labels: ['status:in-review'] }),
    makeIssue({ number: 7, title: 'Answered question, still waiting', body: QUESTION_BODY.replace('- [ ]', '- [x]'), labels: ['status:needs-human'] }),
  ],
});
const board = await startBoard(fake);

const report = { generatedAt: new Date().toISOString(), rows: [], interactions: {}, failures: [], pageErrors: [], consoleErrors: [], csp: [], pass: false };
const record = (row, name, ok, expected, actual) => {
  row.assertions[name] = { ok: Boolean(ok), expected, actual };
  if (!ok) report.failures.push({ state: row.state, key: row.key, assertion: name, expected, actual });
};

const browser = await chromium.launch({
  executablePath: process.env.H2_CHROME || '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
await context.addInitScript(() => {
  window.__csp = [];
  window.addEventListener('securitypolicyviolation', (event) => window.__csp.push(event.violatedDirective));
});
const page = await context.newPage();
page.on('pageerror', (error) => report.pageErrors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error' && !/404|Failed to load resource/i.test(message.text())) report.consoleErrors.push(message.text()); });

const wait = (callback, arg) => page.waitForFunction(callback, arg, { timeout: 20000 });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const setTheme = async (theme) => { await page.evaluate((value) => window.__taskBoard.setThemeMode(value), theme); await wait((v) => document.documentElement.getAttribute('data-theme') === v, theme); };
const setLanguage = async (lang) => { if (await page.evaluate(() => document.documentElement.lang) === lang) return; await page.evaluate(() => document.getElementById('lang-switch-btn').click()); await wait((v) => document.documentElement.lang === v, lang); };
const openIssue = async (number) => {
  await page.evaluate((n) => window.__taskBoard.openIssue(n), number);
  await wait((n) => window.__taskBoard.state.detail?.number === n && !document.getElementById('detail-view').hidden, number);
  await sleep(150);
};
const measure = () => page.evaluate(() => {
  const panel = document.getElementById('human-review');
  const body = document.getElementById('human-review-body');
  const questions = document.getElementById('question-list');
  const row = (n) => {
    const issue = (window.__taskBoard.state.board?.issues || []).find((entry) => entry.number === n);
    return issue ? { column: issue.column, statusLabel: issue.statusLabel, humanReview: issue.humanReview?.state ?? null } : null;
  };
  return {
    hidden: panel.hidden,
    reviewState: panel.getAttribute('data-review-state'),
    title: document.getElementById('human-review-title').textContent.trim(),
    text: body.innerText.replace(/\s+/g, ' ').trim(),
    panelActions: body.querySelectorAll('a, button').length,
    cards: body.querySelectorAll('.question-option-card').length,
    answerInput: body.querySelector('#answer-0') ? { present: true } : null,
    listForms: questions.querySelectorAll('form').length,
    listItems: questions.querySelectorAll('li').length,
    listRadios: questions.querySelectorAll('input[type=radio]').length,
    listTextInputs: Array.from(questions.querySelectorAll('input[type=text]')).map((input) => input.id),
    questionsHidden: questions.parentElement ? questions.parentElement.hidden : null,
    statusControl: (() => { const select = document.getElementById('status-select'); return select ? { present: true, options: Array.from(select.options).map((o) => o.value) } : null; })(),
    lang: document.documentElement.lang,
    theme: document.documentElement.getAttribute('data-theme'),
    detail: { statusLabel: window.__taskBoard.state.detail?.statusLabel, humanReview: window.__taskBoard.state.detail?.humanReview?.state ?? null },
    row1: row(1),
  };
});

try {
  await page.goto(board.url);
  await page.locator('#password').fill(BOARD_PASSWORD);
  await page.locator('#login-btn').click();
  await wait(() => window.__taskBoard?.state.board?.issues.length === 7);

  // ---- F3/F4 presentation ------------------------------------------------
  const STATES = [
    { key: 'no-presets', issue: 2 },
    { key: 'long-url', issue: 3 },
    { key: 'space-url', issue: 4 },
  ];
  for (const state of STATES) {
    for (const viewport of [{ width: 360, height: 800 }, { width: 1280, height: 900 }]) {
      for (const theme of ['light', 'dark']) {
        for (const lang of ['en', 'fr']) {
          await page.setViewportSize(viewport);
          await setTheme(theme);
          await setLanguage(lang);
          await openIssue(state.issue);
          const m = await measure();
          const row = { state: state.key, issue: state.issue, width: viewport.width, theme, lang, key: `${state.key}-${viewport.width}-${theme}-${lang}`, assertions: {}, measure: m };
          await page.screenshot({ path: path.join(OUT, 'screenshots', 'delta-' + row.key + '.png') });
          record(row, 'langApplied', m.lang === lang, lang, m.lang);
          record(row, 'themeApplied', m.theme === theme, theme, m.theme);
          record(row, 'panelShownAsMalformed', m.hidden === false && m.reviewState === 'malformed', 'panel visible, data-review-state=malformed', { hidden: m.hidden, reviewState: m.reviewState });
          record(row, 'waitingTitle', lang === 'en' ? m.title === 'Waiting for an artifact' : m.title === 'En attente d’un élément à valider', 'waiting-for-artifact title', m.title);
          record(row, 'noFakeAction', m.panelActions === 0, 0, m.panelActions);
          if (state.key === 'no-presets') {
            record(row, 'reasonNamesPresets', lang === 'en' ? /preset answer/i.test(m.text) : /réponse proposée/i.test(m.text), 'names the missing preset', m.text);
            record(row, 'questionAnswerableInList', m.listForms >= 1 && m.listTextInputs.length >= 1, 'Open Questions list carries an answer form', { forms: m.listForms, items: m.listItems, textInputs: m.listTextInputs });
            record(row, 'noRadioToClick', m.listRadios === 0, 0, m.listRadios);
            record(row, 'statusControlAvailable', (m.statusControl?.options || []).includes('status:in-progress'), 'status control offers in-progress', m.statusControl);
          }
          if (state.key === 'long-url') {
            record(row, 'reasonNamesLength', /2048/.test(m.text), '2048', m.text);
          }
          if (state.key === 'space-url') {
            record(row, 'reasonNamesNoSpaces', lang === 'en' ? /no spaces/i.test(m.text) : /sans espaces/i.test(m.text), 'no-space rule', m.text);
          }
          report.rows.push(row);
        }
      }
    }
  }

  // ---- F1: answer the waiting question in the browser --------------------
  await page.setViewportSize({ width: 360, height: 800 });
  await setTheme('light');
  await setLanguage('en');
  {
    await openIssue(1);
    const before = await measure();
    await page.locator('#human-review-body .question-option-card input[type=radio]').first().check();
    await page.locator('#human-review-body form button[type=submit]').click();
    await wait(() => window.__taskBoard.state.detail?.humanReview?.state === 'settled').catch(() => {});
    await sleep(400);
    const after = await page.evaluate(() => {
      const issue = (window.__taskBoard.state.board?.issues || []).find((entry) => entry.number === 1);
      return {
        statusLabel: window.__taskBoard.state.detail?.statusLabel,
        humanReview: window.__taskBoard.state.detail?.humanReview?.state,
        panelHidden: document.getElementById('human-review').hidden,
        column: issue?.column,
        listTitle: document.getElementById('human-review-title').textContent.trim(),
      };
    });
    report.interactions.answerWaiting = { before: { column: before.row1?.column, statusLabel: before.detail.statusLabel }, after };
    if (!(after.statusLabel === 'status:in-progress' && after.column === 'in-progress' && after.humanReview === 'settled' && after.panelHidden === true)) {
      report.failures.push({ state: 'interaction', key: 'answer-waiting', assertion: 'leaves waiting column', expected: 'in-progress + settled + panel hidden', actual: after });
    }
  }
  // A waiting task whose question is already answered reads the settled state
  // in EN and FR. (After the answer above the task is in-progress, so the gate
  // panel is hidden by design; issue 7 is the settled-and-still-waiting card.)
  for (const lang of ['en', 'fr']) {
    await setLanguage(lang);
    await openIssue(7);
    await sleep(150);
    const m = await measure();
    const okTitle = lang === 'en' ? m.title === 'Answer received' : m.title === 'Réponse reçue';
    const okBody = lang === 'en' ? /pick this task up again/i.test(m.text) : /reprendre cette tâche/i.test(m.text);
    const row = { state: 'settled-after-answer', issue: 7, width: 360, theme: 'light', lang, key: `settled-${lang}`, assertions: {}, measure: m };
    await page.screenshot({ path: path.join(OUT, 'screenshots', 'delta-settled-' + lang + '.png') });
    record(row, 'settledTitle', okTitle, lang === 'en' ? 'Answer received' : 'Réponse reçue', m.title);
    record(row, 'settledSaysAgentResumes', okBody, 'agent must pick it up again', m.text);
    record(row, 'settledNoAction', m.panelActions === 0, 0, m.panelActions);
    report.rows.push(row);
  }

  // ---- F3: the typed answer survives on a preset-less question ----------
  {
    await setLanguage('en');
    await openIssue(2);
    const before = await page.evaluate(() => ({ statusLabel: window.__taskBoard.state.detail.statusLabel, state: window.__taskBoard.state.detail.humanReview?.state }));
    await page.locator('#question-list input[type=text]').first().fill('Yes, keep it');
    await page.locator('#question-list form button[type=submit]').first().click();
    await wait(() => window.__taskBoard.state.detail?.humanReview?.state === 'settled').catch(() => {});
    await sleep(400);
    const after = await page.evaluate(() => ({
      statusLabel: window.__taskBoard.state.detail.statusLabel,
      state: window.__taskBoard.state.detail.humanReview?.state,
      title: document.getElementById('human-review-title').textContent.trim(),
      text: document.getElementById('human-review-body').innerText.replace(/\s+/g, ' ').trim(),
    }));
    report.interactions.typedAnswerOnPresetLessGate = { before, after };
    const row = { state: 'typed-answer', issue: 2, width: 360, theme: 'light', lang: 'en', key: 'typed-answer', assertions: {}, measure: after };
    record(row, 'typedAnswerAccepted', after.state === 'settled', 'settled', after);
    record(row, 'taskStaysWaitingForTheReader', after.statusLabel === 'status:needs-human', 'status:needs-human until the reader moves it', after.statusLabel);
    record(row, 'cardSaysAnswerReceived', after.title === 'Answer received', 'Answer received', after.title);
    report.rows.push(row);
    // And the reader can move it out in one control.
    await page.selectOption('#status-select', 'status:in-progress');
    await page.locator('#apply-status').click();
    await wait(() => window.__taskBoard.state.detail?.statusLabel === 'status:in-progress').catch(() => {});
    await sleep(300);
    const escaped = await page.evaluate(() => window.__taskBoard.state.detail.statusLabel);
    record(row, 'readerCanMoveItOut', escaped === 'status:in-progress', 'status:in-progress', escaped);
  }

  // ---- F1: a done task with a ready gate must never render a wait --------
  {
    await setLanguage('en');
    await openIssue(5);
    const m = await measure();
    report.interactions.doneTaskGate = { panelHidden: m.hidden, title: m.title, listForms: m.listForms, listItems: m.listItems, reviewState: m.reviewState };
    const row = { state: 'done-with-gate', issue: 5, width: 360, theme: 'light', lang: 'en', key: 'done-gate', assertions: {}, measure: m };
    record(row, 'noWaitingClaim', m.hidden === true, 'no human-review panel on a done task', { hidden: m.hidden, title: m.title });
    record(row, 'gatedQuestionNotDuplicatedInList', m.listForms === 0, 'the gated question is not offered twice', { listForms: m.listForms });
    report.rows.push(row);
  }

  // ---- In-review task with a ready gate: the panel asks nothing ----------
  {
    await openIssue(6);
    const m = await measure();
    report.interactions.inReviewGate = { panelHidden: m.hidden, title: m.title, text: m.text, panelActions: m.panelActions, listForms: m.listForms, listItems: m.listItems };
    const row = { state: 'in-review-with-gate', issue: 6, width: 360, theme: 'light', lang: 'en', key: 'in-review-gate', assertions: {}, measure: m };
    record(row, 'panelAsksNothing', m.panelActions === 0, 0, m.panelActions);
    record(row, 'notAWaitingTitle', m.title !== 'Waiting for an artifact', 'not the waiting title', m.title);
    report.rows.push(row);
  }

  report.csp = await page.evaluate(() => window.__csp);
} finally {
  await browser.close();
  await board.app.close();
  await fake.close();
}

report.pass = report.failures.length === 0 && report.pageErrors.length === 0 && report.csp.length === 0;
report.counts = {
  rows: report.rows.length,
  assertions: report.rows.reduce((total, row) => total + Object.keys(row.assertions).length, 0),
  failedAssertions: report.failures.length,
};
fs.writeFileSync(path.join(OUT, 'delta-browser.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass: report.pass, counts: report.counts, failures: report.failures.slice(0, 20), interactions: report.interactions, csp: report.csp, pageErrors: report.pageErrors, consoleErrors: report.consoleErrors }, null, 2));
if (!report.pass) process.exitCode = 1;
