// Hostile2 criterion 3: false-positive probe for the post-discovery total-outage guard
// (web/server/app.ts:1332 archiveData, :1421 operationsData) plus the UI error state in real Chromium.
// In-process boards on ephemeral ports with synthetic GitHub only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub, makeIssue } from '../../../../../../../web/tests/fake-github.mjs';
import { startBoard, HttpSession, BOARD_PASSWORD } from '../../../../../../../web/tests/helpers.mjs';
import pkg from '/workspace/personal/lucas/charme-social/node_modules/playwright/index.js';

const { chromium } = pkg.default || pkg;
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '..');
const results = [];
const record = (name, expected, ops, arch, extra = {}) => {
  const entry = { name, expected, operations: { status: ops.status, error: ops.json?.error, message: ops.json?.message, partial: ops.json?.partial, failures: ops.json?.failures?.map((f) => f.message) },
    archive: { status: arch.status, error: arch.json?.error, partial: arch.json?.partial }, ...extra };
  results.push(entry);
  console.log(`${name}: ops=${ops.status}${ops.json?.error ? ' ' + ops.json.error : ''} archive=${arch.status} expected=${expected}`);
};
const repo = (full, id, issues = [makeIssue({ number: id, repo: full, labels: ['status:todo'] })], extra = {}) => ({ repo: full, id, issues, ...extra });

async function both(session) {
  return [await session.request('/api/combined/operations'), await session.request('/api/combined/archive')];
}

// A. Empty account: discovery succeeds, zero repositories.
{
  const fake = await startFakeGitHub({ repositories: [repo('owner/only', 1, [], { accessible: false })] });
  const board = await startBoard(fake, { repositoryTtlMs: 60_000, env: { BOARD_REPO: '' } });
  try {
    const s = new HttpSession(board.url); await s.login();
    const [o, a] = await both(s);
    record('A empty account (0 discovered repos)', '200 legitimate empty', o, a, { combinedBoard: (await s.request('/api/combined/board')).status });
  } finally { await board.app.close(); await fake.close(); }
}

// B. Previously known repository lost access after discovery refresh (available:false), no cache.
{
  let clock = Date.parse('2026-11-06T00:00:00Z');
  const fake = await startFakeGitHub({ repositories: [repo('owner/a', 1)] });
  const board = await startBoard(fake, { now: () => clock, repositoryTtlMs: 60_000, boardCacheTtlMs: 0 });
  try {
    const s = new HttpSession(board.url); await s.login();
    const [o0] = await both(s);
    fake.setRepoAccessible('owner/a', false);
    clock += 61_000;
    const [o, a] = await both(s);
    const cb = await s.request('/api/combined/board');
    record('B only repo removed from token (known, available:false)', 'legitimately empty; 502 would be a false positive', o, a,
      { primeStatus: o0.status, combinedBoardStatus: cb.status, combinedBoardFailures: cb.json?.failures?.map((f) => f.message) });
  } finally { await board.app.close(); await fake.close(); }
}

// C. Repositories with issues disabled (has_issues:false) only.
{
  const fake = await startFakeGitHub({ repositories: [repo('owner/noissues', 1, [], { hasIssues: false })] });
  const board = await startBoard(fake, { repositoryTtlMs: 60_000 });
  try {
    const s = new HttpSession(board.url); await s.login();
    const [o, a] = await both(s);
    record('C only repo has issues disabled', '200 empty', o, a);
  } finally { await board.app.close(); await fake.close(); }
}

// D. Archived repository (still listed, issues readable).
{
  const fake = await startFakeGitHub({ repositories: [repo('owner/arch', 1, undefined, { archived: true })] });
  const board = await startBoard(fake, { repositoryTtlMs: 60_000 });
  try {
    const s = new HttpSession(board.url); await s.login();
    const [o, a] = await both(s);
    record('D only repo archived', '200', o, a);
  } finally { await board.app.close(); await fake.close(); }
}

// E. Issue-cap / page-bound truncation: perPage 1 with many issues.
{
  const issues = Array.from({ length: 12 }, (_, i) => makeIssue({ number: i + 1, repo: 'owner/big', labels: ['status:todo'] }));
  const fake = await startFakeGitHub({ repositories: [repo('owner/big', 1, issues)], perPage: 1 });
  const board = await startBoard(fake, { repositoryTtlMs: 60_000 });
  try {
    const s = new HttpSession(board.url); await s.login();
    const [o, a] = await both(s);
    record('E page-bound truncation (perPage=1, 12 issues)', '200 partial/truncated', o, a, { truncated: o.json?.truncated ?? a.json?.truncated });
  } finally { await board.app.close(); await fake.close(); }
}

// F. One good + one unavailable (lost access) + one failing.
{
  let clock = Date.parse('2026-11-06T00:00:00Z');
  const fake = await startFakeGitHub({ repositories: [repo('owner/good', 1), repo('owner/gone', 2), repo('owner/bad', 3)] });
  const board = await startBoard(fake, { now: () => clock, repositoryTtlMs: 60_000, boardCacheTtlMs: 0 });
  try {
    const s = new HttpSession(board.url); await s.login();
    await both(s);
    fake.setRepoAccessible('owner/gone', false); fake.setRepoFailing('owner/bad', true); clock += 61_000;
    const [o, a] = await both(s);
    record('F mixed good/unavailable/failing', '200 partial', o, a);
  } finally { await board.app.close(); await fake.close(); }
}

// G. Single-repo route when that repo fails (untouched path).
{
  const fake = await startFakeGitHub({ repositories: [repo('owner/a', 1), repo('owner/b', 2)] });
  const board = await startBoard(fake, { repositoryTtlMs: 60_000 });
  try {
    const s = new HttpSession(board.url); await s.login();
    fake.setRepoFailing('owner/a', true);
    const o = await s.request('/api/repos/owner/a/operations');
    const a = await s.request('/api/repos/owner/a/archive');
    record('G single-repo route, repo failing', 'unchanged pre-fix behaviour (error)', o, a);
  } finally { await board.app.close(); await fake.close(); }
}

// H. All repos failing, no cache: API + real Chromium UI for Operations and Archive (EN + FR).
{
  const fake = await startFakeGitHub({ repositories: [repo('owner/a', 1), repo('owner/b', 2)] });
  const board = await startBoard(fake, { repositoryTtlMs: 60_000, boardCacheTtlMs: 0 });
  try {
    const s = new HttpSession(board.url); await s.login();
    fake.setRepoFailing('owner/a', true); fake.setRepoFailing('owner/b', true);
    const [o, a] = await both(s);
    const cb = await s.request('/api/combined/board');
    const browser = await chromium.launch({ executablePath: process.env.H2_CHROME, headless: true, args: ['--no-sandbox'] });
    const ui = {};
    for (const lang of ['en', 'fr']) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
      const page = await ctx.newPage();
      await page.addInitScript((l) => localStorage.setItem('tb_lang', l), lang);
      await page.goto(board.url);
      await page.locator('#password').fill(BOARD_PASSWORD);
      await page.locator('#password').press('Enter');
      await page.locator('#board-view').waitFor({ state: 'visible' });
      await page.waitForTimeout(800);
      ui[lang] = {};
      for (const view of ['operations', 'archive']) {
        await page.evaluate((v) => document.getElementById('nav-' + v).click(), view);
        await page.waitForTimeout(900);
        ui[lang][view] = await page.evaluate((v) => {
          const loading = document.getElementById(v + '-loading');
          const grid = document.getElementById('operations-grid');
          return { loadingText: loading?.textContent, loadingHidden: loading?.hidden, operationsGridHidden: grid?.hidden,
            openCountText: document.getElementById('stat-open-count')?.textContent };
        }, view);
        await page.screenshot({ path: path.join(OUT, 'screenshots', `chromium-total-outage-${view}-1280-${lang}.png`) });
      }
      ui[lang].boardNotice = await page.evaluate(() => document.querySelector('#notice, .notice, [role="status"]')?.textContent?.trim() || null);
      await ctx.close();
    }
    await browser.close();
    record('H all repos failing, no cache', '502 + UI "Could not load"', o, a, { combinedBoardStatus: cb.status, combinedBoardPartial: cb.json?.partial, combinedBoardIssues: cb.json?.issues?.length, ui });
    console.log(JSON.stringify(ui, null, 1));
  } finally { await board.app.close(); await fake.close(); }
}

fs.writeFileSync(path.join(OUT, 'outage-guard-probe.json'), JSON.stringify(results, null, 2) + '\n');
