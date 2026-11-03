import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { startFakeGitHub, makeIssue } from '../../../../web/tests/fake-github.mjs';
import { startBoard, BOARD_PASSWORD } from '../../../../web/tests/helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(HERE, '../../../..');
const RUN_DIR = path.resolve(HERE, '..');
const SCREENSHOTS_DIR = path.join(RUN_DIR, 'screenshots');
const VERIFICATIONS_DIR = path.join(RUN_DIR, 'verifications');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
fs.mkdirSync(VERIFICATIONS_DIR, { recursive: true });

const CDP_PORT = Number(process.env.OBS_CDP_PORT || 9360);

function findPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_PATH,
    '/workspace/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs',
    '/workspace/.npm/_npx/af752b90495482d7/node_modules/playwright-core/index.mjs',
    '/workspace/.npm/_npx/a1722018f28f9df2/node_modules/playwright-core/index.mjs',
    '/workspace/.npm/_npx/e78b33305587cb7c/node_modules/playwright-core/index.mjs',
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  const npxDir = '/workspace/.npm/_npx';
  if (fs.existsSync(npxDir)) {
    for (const d of fs.readdirSync(npxDir)) {
      const p = path.join(npxDir, d, 'node_modules/playwright-core/index.mjs');
      if (fs.existsSync(p)) return p;
    }
  }
  throw new Error('playwright-core not found');
}

async function ensureObscura() {
  const versionUrl = `http://127.0.0.1:${CDP_PORT}/json/version`;
  try {
    const res = await fetch(versionUrl);
    if (res.ok) {
      console.log('Obscura is running on port', CDP_PORT);
      return { child: null };
    }
  } catch {}

  console.log('Starting Obscura CDP server on port', CDP_PORT);
  const child = spawn('obscura', ['serve', '--port', String(CDP_PORT), '--allow-file-access', '--allow-private-network'], {
    stdio: 'ignore',
    detached: true,
  });
  child.unref();

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const res = await fetch(versionUrl);
      if (res.ok) {
        console.log('Obscura started successfully.');
        return { child };
      }
    } catch {}
  }
  throw new Error('Obscura failed to start on port ' + CDP_PORT);
}

const mockIssues = [
  makeIssue({
    number: 53,
    title: 'Align online board visual styling with OpenChamber panel',
    body: '## Overview\nOnline web board matches OpenChamber panel layout and styling.\n\n### Actionable Subtasks Checklist:\n- [x] Full-width edge-to-edge layout\n- [x] Compact unified toolbar\n- [ ] Linear-style rows\n',
    state: 'open',
    labels: [
      { name: 'status:in-progress', color: '3b82f6' },
      { name: 'priority:high', color: 'ef4444' },
      { name: 'theme:web', color: '8b5cf6' },
    ],
    user: 'board-owner',
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
  }),
  makeIssue({
    number: 54,
    title: 'Never flash sign-in on reload when already signed in',
    body: '## Overview\nInstant 0ms cached board display on reload.\n',
    state: 'open',
    labels: [
      { name: 'status:done', color: '10b981' },
      { name: 'priority:medium', color: 'f59e0b' },
    ],
    user: 'board-owner',
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
  }),
  makeIssue({
    number: 55,
    title: 'Beta feedback survey on performance',
    body: '## Overview\nBeta survey responses and feedback collection.\n',
    state: 'open',
    labels: [
      { name: 'status:todo', color: '3b82f6' },
      { name: 'priority:low', color: '8b949e' },
    ],
    user: 'board-owner',
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
  }),
];

async function main() {
  console.log('Starting Fake GitHub server...');
  const fakeGitHub = await startFakeGitHub({
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
    issues: mockIssues,
  });

  console.log('Starting local Task Board server...');
  const webBoard = await startBoard(fakeGitHub, {
    env: {
      BOARD_GITHUB_LOGIN: 'board-owner',
      BOARD_REPO: 'Workflows-Accelerator/openchamber-github-task-board',
    },
  });
  console.log('Task Board URL:', webBoard.url);

  await ensureObscura();
  const playwrightPath = findPlaywright();
  const { chromium } = await import(playwrightPath);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);

  const verificationResults = {
    startedAt: new Date().toISOString(),
    checks: [],
    screenshots: [],
  };

  function recordCheck(name, pass, detail = '') {
    verificationResults.checks.push({ name, pass: Boolean(pass), detail });
    console.log(`[CHECK] ${pass ? 'PASS' : 'FAIL'}: ${name} ${detail ? `(${detail})` : ''}`);
    if (!pass) throw new Error(`Check failed: ${name} ${detail}`);
  }

  try {
    // --------------------------------------------------------------------------
    // 1. Desktop 1280px Viewport: Full-Width Layout & Compact Toolbar (D63.1, D63.2)
    // --------------------------------------------------------------------------
    console.log('\n--- 1. Testing desktop 1280px full-width layout & unified toolbar ---');
    const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
    const desktopPage = await desktopContext.newPage();

    await desktopPage.goto(webBoard.url, { waitUntil: 'load' });
    await desktopPage.evaluate(() => {
      localStorage.setItem('tb_theme_mode', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await desktopPage.locator('#login-view:not([hidden])').waitFor({ state: 'visible', timeout: 5000 });

    // Sign in
    await desktopPage.locator('#password').fill(BOARD_PASSWORD);
    await desktopPage.locator('#login-btn').click();

    await desktopPage.locator('#board-view:not([hidden])').waitFor({ state: 'visible', timeout: 5000 });
    await desktopPage.locator('.task-row').first().waitFor({ state: 'visible', timeout: 5000 });

    // Check dark theme background color on initial dark board
    const initialBodyBg = await desktopPage.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    recordCheck('Desktop dark mode: body background is #0f1012 (rgb(15, 16, 18))', initialBodyBg === 'rgb(15, 16, 18)', `bg=${initialBodyBg}`);

    // Check full-width layout
    const mainBox = await desktopPage.locator('main').boundingBox();
    recordCheck('Desktop layout: main width >= 1200px at 1280px viewport', mainBox.width >= 1200, `width=${mainBox.width}px`);

    const boardViewBox = await desktopPage.locator('#board-view').boundingBox();
    recordCheck('Desktop layout: #board-view width >= 1200px', boardViewBox.width >= 1200, `width=${boardViewBox.width}px`);

    // Check all SVG icons have bounding box <= 24x24px
    const svgBoxes = await desktopPage.evaluate(() => {
      return Array.from(document.querySelectorAll('svg')).map((svg) => {
        const r = svg.getBoundingClientRect();
        return { width: r.width, height: r.height };
      });
    });
    const allSvgsCompact = svgBoxes.length >= 3 && svgBoxes.every((b) => b.width > 0 && b.width <= 24 && b.height > 0 && b.height <= 24);
    recordCheck('SVG icons: all inline SVGs have bounding box <= 24x24px', allSvgsCompact, JSON.stringify(svgBoxes));

    // Check #repo-label is visibly rendered and not collapsed
    const repoLabelInfo = await desktopPage.evaluate(() => {
      const el = document.getElementById('repo-label');
      const r = el.getBoundingClientRect();
      return { text: el.textContent, width: r.width, height: r.height, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
    });
    recordCheck('Unified toolbar: #repo-label is visible, width >= 40px, and not truncated (scrollWidth <= clientWidth + 1)',
      repoLabelInfo.width >= 40 && repoLabelInfo.text.length > 0 && repoLabelInfo.scrollWidth <= repoLabelInfo.clientWidth + 1,
      JSON.stringify(repoLabelInfo));

    // Check every child of #repo-select-btn stays inside the button border box
    const repoBtnContainment = await desktopPage.evaluate(() => {
      const btn = document.getElementById('repo-select-btn');
      const b = btn.getBoundingClientRect();
      const kids = Array.from(btn.children).filter((c) => !c.classList.contains('sr-only')).map((c) => {
        const r = c.getBoundingClientRect();
        return { cls: c.getAttribute('class'), left: r.left, right: r.right };
      });
      return { btnLeft: b.left, btnRight: b.right, kids, contained: kids.every((k) => k.left >= b.left + 4 && k.right <= b.right - 4) };
    });
    recordCheck('Unified toolbar: icon, #repo-label, and chevron sit inside #repo-select-btn with >= 4px inner padding', repoBtnContainment.contained, JSON.stringify(repoBtnContainment));

    // Check hidden popovers and closed dialogs have display === 'none' and offsetHeight === 0
    const hiddenElementsCheck = await desktopPage.evaluate(() => {
      const sheet = document.getElementById('board-sheet');
      const popover = document.getElementById('repo-popover');
      const backdrop = document.getElementById('drawer-backdrop');
      const sheetStyle = window.getComputedStyle(sheet);
      const popoverStyle = window.getComputedStyle(popover);
      const backdropStyle = window.getComputedStyle(backdrop);
      return {
        sheetHidden: !sheet.open && sheetStyle.display === 'none' && sheet.offsetHeight === 0,
        popoverHidden: popover.hidden && popoverStyle.display === 'none' && popover.offsetHeight === 0,
        backdropHidden: backdrop.hidden && backdropStyle.display === 'none' && backdrop.offsetHeight === 0,
      };
    });
    recordCheck('Hidden elements: closed #board-sheet, #repo-popover, #drawer-backdrop have display:none and offsetHeight===0',
      hiddenElementsCheck.sheetHidden && hiddenElementsCheck.popoverHidden && hiddenElementsCheck.backdropHidden,
      JSON.stringify(hiddenElementsCheck));

    // Check diagnostic nodes hidden
    const discoveryStatusHidden = await desktopPage.evaluate(() => {
      const el = document.getElementById('discovery-status');
      return !el || el.hidden || window.getComputedStyle(el).display === 'none';
    });
    const refreshPolicyHidden = await desktopPage.evaluate(() => {
      const el = document.getElementById('refresh-policy');
      return !el || el.hidden || window.getComputedStyle(el).display === 'none';
    });
    recordCheck('Desktop layout: #discovery-status is hidden', discoveryStatusHidden);
    recordCheck('Desktop layout: #refresh-policy is hidden', refreshPolicyHidden);

    // Check compact unified toolbar height <= 56px
    const toolbarBox = await desktopPage.locator('#board-toolbar').boundingBox();
    recordCheck('Unified toolbar: height <= 56px at 1280px desktop', toolbarBox.height <= 56, `height=${toolbarBox.height}px`);

    // Check toolbar elements
    const hasRepoBtn = await desktopPage.locator('#repo-select-btn').isVisible();
    const hasSearch = await desktopPage.locator('#board-search').isVisible();
    const hasViewBtn = await desktopPage.locator('#view-btn').isVisible();
    const hasFilterBtn = await desktopPage.locator('#filter-btn').isVisible();
    const hasSortBtn = await desktopPage.locator('#sort-btn').isVisible();
    const hasRefreshBtn = await desktopPage.locator('#refresh-btn').isVisible();
    const hasSettingsBtn = await desktopPage.locator('#settings-btn').isVisible();
    const hasSignoutBtn = await desktopPage.locator('#signout-btn').isVisible();
    recordCheck('Unified toolbar: contains #repo-select-btn', hasRepoBtn);
    recordCheck('Unified toolbar: contains #board-search', hasSearch);
    recordCheck('Unified toolbar: contains controls (#view-btn, #filter-btn, #sort-btn, #refresh-btn, #settings-btn, #signout-btn)',
      hasViewBtn && hasFilterBtn && hasSortBtn && hasRefreshBtn && hasSettingsBtn && hasSignoutBtn);

    // Check sub-header status strip
    const hasStatusStrip = await desktopPage.locator('#status-strip').isVisible();
    const statusStripText = await desktopPage.locator('#status-strip').innerText();
    recordCheck('Status strip: visible with scope, count, freshness', hasStatusStrip && statusStripText.includes('Task Board'));

    // Check inline quick-add draft bar is visible in Simple list view
    const quickAddVisible = await desktopPage.locator('#quick-add-form').isVisible();
    recordCheck('Quick-add bar: #quick-add-form is visible in Simple list view', quickAddVisible);

    // Capture 01-desktop-dark-board.png
    const shot1 = path.join(SCREENSHOTS_DIR, '01-desktop-dark-board.png');
    await desktopPage.screenshot({ path: shot1 });
    verificationResults.screenshots.push('screenshots/01-desktop-dark-board.png');

    // --------------------------------------------------------------------------
    // 2. Search dynamic filter
    // --------------------------------------------------------------------------
    console.log('\n--- 2. Testing search dynamic filtering ---');
    const initialRowsCount = await desktopPage.locator('.task-row').count();
    recordCheck('Search: initial task rows count >= 3', initialRowsCount >= 3, `count=${initialRowsCount}`);

    await desktopPage.locator('#board-search').fill('Beta');
    await desktopPage.waitForTimeout(100);
    const filteredRowsCount = await desktopPage.locator('.task-row').count();
    recordCheck('Search: searching "Beta" filters to 1 row', filteredRowsCount === 1, `count=${filteredRowsCount}`);

    // Capture 02-desktop-search-filter.png
    const shot2 = path.join(SCREENSHOTS_DIR, '02-desktop-search-filter.png');
    await desktopPage.screenshot({ path: shot2 });
    verificationResults.screenshots.push('screenshots/02-desktop-search-filter.png');

    // Clear search
    await desktopPage.locator('#board-search').fill('');
    await desktopPage.waitForTimeout(100);
    const restoredRowsCount = await desktopPage.locator('.task-row').count();
    recordCheck('Search: clearing search restores all rows', restoredRowsCount === initialRowsCount, `count=${restoredRowsCount}`);

    // --------------------------------------------------------------------------
    // 3. Linear-Style Compact Rows (D63.3)
    // --------------------------------------------------------------------------
    console.log('\n--- 3. Testing Linear-style compact Simple list rows ---');
    const rowGeometry = await desktopPage.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.task-row.simple-row'));
      return rows.map((row) => {
        const rowRect = row.getBoundingClientRect();
        const dot = row.querySelector('.simple-dot');
        const title = row.querySelector('.simple-row-title');
        const desc = row.querySelector('.simple-row-desc');
        const meta = row.querySelector('.simple-row-meta');
        const dotRect = dot ? dot.getBoundingClientRect() : null;
        const titleRect = title ? title.getBoundingClientRect() : null;
        const metaRect = meta ? meta.getBoundingClientRect() : null;
        return {
          rowHeight: rowRect.height,
          dotLeft: dotRect ? dotRect.left : 999,
          titleWidth: titleRect ? titleRect.width : 0,
          titleLeft: titleRect ? titleRect.left : 0,
          titleRight: titleRect ? titleRect.right : 9999,
          metaLeft: metaRect ? metaRect.left : 0,
          descText: desc ? desc.textContent : '',
        };
      });
    });
    recordCheck('Linear rows: all rows have height <= 56px', rowGeometry.every((r) => r.rowHeight > 24 && r.rowHeight <= 56), JSON.stringify(rowGeometry));
    recordCheck('Linear rows: .simple-dot is left-aligned (rect.left < 40)', rowGeometry.every((r) => r.dotLeft > 0 && r.dotLeft < 40), JSON.stringify(rowGeometry));
    recordCheck('Linear rows: .simple-row-title is visible (width > 100px, within viewport)',
      rowGeometry.every((r) => r.titleWidth > 100 && r.titleLeft >= 20 && r.titleRight <= 1280), JSON.stringify(rowGeometry));
    recordCheck('Linear rows: .simple-row-desc has clean plain text without markdown headings',
      rowGeometry.every((r) => !r.descText.includes('##')), JSON.stringify(rowGeometry));

    // --------------------------------------------------------------------------
    // 4. Slide-Over Detail Drawer (D63.4)
    // --------------------------------------------------------------------------
    console.log('\n--- 4. Testing slide-over detail drawer ---');
    await desktopPage.locator('.task-row').first().click();
    await desktopPage.locator('#detail-view:not([hidden])').waitFor({ state: 'visible', timeout: 5000 });

    const isBoardViewVisibleDuringDrawer = await desktopPage.evaluate(() => !document.getElementById('board-view').hidden);
    const isBackdropVisible = await desktopPage.evaluate(() => !document.getElementById('drawer-backdrop').hidden);
    const hasDrawerOpenClass = await desktopPage.evaluate(() => document.body.classList.contains('drawer-open'));
    const drawerBox = await desktopPage.locator('#detail-view').boundingBox();
    const drawerHitTest = await desktopPage.evaluate(() => {
      const dv = document.getElementById('detail-view');
      const bv = document.getElementById('board-view');
      const e1 = document.elementFromPoint(1200, 20);
      const e2 = document.elementFromPoint(1200, 150);
      return {
        inDv1: Boolean(e1 && dv.contains(e1)),
        inDv2: Boolean(e2 && dv.contains(e2)),
        boardWidth: bv.getBoundingClientRect().width,
      };
    });

    recordCheck('Slide-over drawer: #board-view remains visible underneath', isBoardViewVisibleDuringDrawer);
    recordCheck('Slide-over drawer: #drawer-backdrop is visible', isBackdropVisible);
    recordCheck('Slide-over drawer: document.body has .drawer-open', hasDrawerOpenClass);
    recordCheck('Slide-over drawer: width is 480px on desktop (±4px)', Math.abs(drawerBox.width - 480) <= 4, `width=${drawerBox.width}px`);
    recordCheck('Slide-over drawer: elementFromPoint(1200,20) and (1200,150) are inside #detail-view and #board-view width <= 800px',
      drawerHitTest.inDv1 && drawerHitTest.inDv2 && drawerHitTest.boardWidth <= 800, JSON.stringify(drawerHitTest));

    // Capture 03-desktop-detail-drawer.png
    const shot3 = path.join(SCREENSHOTS_DIR, '03-desktop-detail-drawer.png');
    await desktopPage.screenshot({ path: shot3 });
    verificationResults.screenshots.push('screenshots/03-desktop-detail-drawer.png');

    // Close drawer via backdrop click
    await desktopPage.locator('#drawer-backdrop').click({ position: { x: 50, y: 50 } });
    await desktopPage.waitForTimeout(200);

    const isDetailHidden = await desktopPage.evaluate(() => document.getElementById('detail-view').hidden);
    const isBackdropHidden = await desktopPage.evaluate(() => document.getElementById('drawer-backdrop').hidden);
    const bodyClassRemoved = await desktopPage.evaluate(() => !document.body.classList.contains('drawer-open'));
    recordCheck('Slide-over drawer: backdrop click closes drawer', isDetailHidden);
    recordCheck('Slide-over drawer: backdrop is hidden after close', isBackdropHidden);
    recordCheck('Slide-over drawer: body .drawer-open removed after close', bodyClassRemoved);

    // --------------------------------------------------------------------------
    // 5. OpenChamber Color Tokens & Theme Mode Auto / Dark / Light (D64)
    // --------------------------------------------------------------------------
    console.log('\n--- 5. Testing OpenChamber tokens and Theme mode toggle ---');
    // Open settings sheet
    await desktopPage.locator('#settings-btn').click();
    await desktopPage.locator('#board-sheet[open]').waitFor({ state: 'visible', timeout: 5000 });

    const hasThemeOptions = await desktopPage.locator('.sheet-option.theme-option').count();
    recordCheck('Theme toggle: settings sheet contains 3 theme mode options', hasThemeOptions === 3, `count=${hasThemeOptions}`);

    // Capture 05-desktop-settings-theme.png
    const shot5 = path.join(SCREENSHOTS_DIR, '05-desktop-settings-theme.png');
    await desktopPage.screenshot({ path: shot5 });
    verificationResults.screenshots.push('screenshots/05-desktop-settings-theme.png');

    // Select Light theme
    await desktopPage.locator('.sheet-option.theme-option', { hasText: 'Light' }).click();
    await desktopPage.waitForTimeout(150);

    const dataThemeLight = await desktopPage.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const storedThemeLight = await desktopPage.evaluate(() => localStorage.getItem('tb_theme_mode'));
    const bodyBgLight = await desktopPage.evaluate(() => window.getComputedStyle(document.body).backgroundColor);

    recordCheck('Theme toggle: Light mode sets data-theme="light"', dataThemeLight === 'light');
    recordCheck('Theme toggle: Light mode persists tb_theme_mode="light"', storedThemeLight === 'light');
    recordCheck('Theme toggle: Light mode body background is #f4f5f7 (rgb(244, 245, 247))', bodyBgLight === 'rgb(244, 245, 247)', `bg=${bodyBgLight}`);

    // Capture 04-desktop-light-board.png
    const shot4 = path.join(SCREENSHOTS_DIR, '04-desktop-light-board.png');
    await desktopPage.screenshot({ path: shot4 });
    verificationResults.screenshots.push('screenshots/04-desktop-light-board.png');

    // Switch back to Dark mode
    await desktopPage.locator('#settings-btn').click();
    await desktopPage.locator('#board-sheet[open]').waitFor({ state: 'visible', timeout: 5000 });
    await desktopPage.locator('.sheet-option.theme-option', { hasText: 'Dark' }).click();
    await desktopPage.waitForTimeout(150);

    const dataThemeDark = await desktopPage.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const storedThemeDark = await desktopPage.evaluate(() => localStorage.getItem('tb_theme_mode'));
    const bodyBgDark = await desktopPage.evaluate(() => window.getComputedStyle(document.body).backgroundColor);

    recordCheck('Theme toggle: Dark mode sets data-theme="dark"', dataThemeDark === 'dark');
    recordCheck('Theme toggle: Dark mode persists tb_theme_mode="dark"', storedThemeDark === 'dark');
    recordCheck('Theme toggle: Dark mode body background is #0f1012 (rgb(15, 16, 18))', bodyBgDark === 'rgb(15, 16, 18)', `bg=${bodyBgDark}`);

    // Switch to Auto mode
    await desktopPage.locator('#settings-btn').click();
    await desktopPage.locator('#board-sheet[open]').waitFor({ state: 'visible', timeout: 5000 });
    await desktopPage.locator('.sheet-option.theme-option', { hasText: 'Auto' }).click();
    await desktopPage.waitForTimeout(150);

    const dataThemeAuto = await desktopPage.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const storedThemeAuto = await desktopPage.evaluate(() => localStorage.getItem('tb_theme_mode'));
    recordCheck('Theme toggle: Auto mode clears data-theme attribute', dataThemeAuto === null);
    recordCheck('Theme toggle: Auto mode persists tb_theme_mode="auto"', storedThemeAuto === 'auto');

    // --------------------------------------------------------------------------
    // 6. Mobile Responsiveness (360px viewport)
    // --------------------------------------------------------------------------
    console.log('\n--- 6. Testing mobile 360px responsiveness & touch targets ---');
    const mobileContext = await browser.newContext({ viewport: { width: 360, height: 640 }, colorScheme: 'dark' });
    const mobilePage = await mobileContext.newPage();

    await mobilePage.goto(webBoard.url, { waitUntil: 'load' });
    await mobilePage.evaluate(() => {
      localStorage.setItem('tb_theme_mode', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await mobilePage.locator('#login-view:not([hidden])').waitFor({ state: 'visible', timeout: 5000 });

    await mobilePage.locator('#password').fill(BOARD_PASSWORD);
    await mobilePage.locator('#login-btn').click();

    await mobilePage.locator('#board-view:not([hidden])').waitFor({ state: 'visible', timeout: 5000 });
    await mobilePage.locator('.task-row').first().waitFor({ state: 'visible', timeout: 5000 });

    // Check touch target heights on mobile (>= 44px)
    const mobileSearchBox = await mobilePage.locator('#board-search').boundingBox();
    const mobileRepoBtnBox = await mobilePage.locator('#repo-select-btn').boundingBox();
    const mobileViewBtnBox = await mobilePage.locator('#view-btn').boundingBox();
    const mobileRowBox = await mobilePage.locator('.task-row').first().boundingBox();

    recordCheck('Mobile 360px: #board-search min-height >= 44px', mobileSearchBox.height >= 44, `height=${mobileSearchBox.height}px`);
    recordCheck('Mobile 360px: #repo-select-btn min-height >= 44px', mobileRepoBtnBox.height >= 44, `height=${mobileRepoBtnBox.height}px`);
    recordCheck('Mobile 360px: #view-btn min-height >= 44px', mobileViewBtnBox.height >= 44, `height=${mobileViewBtnBox.height}px`);
    recordCheck('Mobile 360px: task row min-height >= 44px', mobileRowBox.height >= 44, `height=${mobileRowBox.height}px`);

    const mobileBodyBg = await mobilePage.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    recordCheck('Mobile dark mode: body background is #0f1012 (rgb(15, 16, 18))', mobileBodyBg === 'rgb(15, 16, 18)', `bg=${mobileBodyBg}`);

    const mobileQuickAdd = await mobilePage.evaluate(() => {
      const form = document.getElementById('quick-add-form');
      const visible = Boolean(form) && !form.hidden && window.getComputedStyle(form).display !== 'none';
      const controls = form ? Array.from(form.querySelectorAll('input, select, button')).filter((n) => n.getBoundingClientRect().height > 0) : [];
      return { visible, heights: controls.map((n) => n.getBoundingClientRect().height) };
    });
    recordCheck('Mobile 360px: #quick-add-form visible in Simple list with controls >= 44px',
      mobileQuickAdd.visible && mobileQuickAdd.heights.length > 0 && mobileQuickAdd.heights.every((h) => h >= 44), JSON.stringify(mobileQuickAdd));

    const mobileOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    recordCheck('Mobile 360px: no horizontal page overflow', mobileOverflow);

    // Capture 06-mobile-board.png
    const shot6 = path.join(SCREENSHOTS_DIR, '06-mobile-board.png');
    await mobilePage.screenshot({ path: shot6 });
    verificationResults.screenshots.push('screenshots/06-mobile-board.png');

    // Open detail drawer on mobile
    await mobilePage.locator('.task-row').first().click();
    await mobilePage.locator('#detail-view:not([hidden])').waitFor({ state: 'visible', timeout: 5000 });

    const mobileDrawerBox = await mobilePage.locator('#detail-view').boundingBox();
    recordCheck('Mobile 360px: drawer spans full 360px width', Math.abs(mobileDrawerBox.width - 360) <= 4, `width=${mobileDrawerBox.width}px`);

    const mobileDrawerHit = await mobilePage.evaluate(() => {
      const dv = document.getElementById('detail-view');
      const bv = document.getElementById('board-view');
      const points = [[20, 20], [180, 120], [340, 300], [180, 600]];
      return {
        allInDrawer: points.every(([x, y]) => {
          const e = document.elementFromPoint(x, y);
          return Boolean(e && dv.contains(e));
        }),
        boardVisibility: window.getComputedStyle(bv).visibility,
        boardHiddenAttr: bv.hidden,
      };
    });
    recordCheck('Mobile 360px: elementFromPoint hits only #detail-view and #board-view is visibility:hidden (not [hidden])',
      mobileDrawerHit.allInDrawer && mobileDrawerHit.boardVisibility === 'hidden' && mobileDrawerHit.boardHiddenAttr === false,
      JSON.stringify(mobileDrawerHit));

    // Capture 07-mobile-detail-drawer.png
    const shot7 = path.join(SCREENSHOTS_DIR, '07-mobile-detail-drawer.png');
    await mobilePage.screenshot({ path: shot7 });
    verificationResults.screenshots.push('screenshots/07-mobile-detail-drawer.png');

    console.log('\nAll browser verification checks passed successfully!');
    verificationResults.finishedAt = new Date().toISOString();
    verificationResults.allPassed = true;

    fs.writeFileSync(
      path.join(VERIFICATIONS_DIR, 'browser-results.json'),
      JSON.stringify(verificationResults, null, 2)
    );
  } finally {
    await browser.close();
    await webBoard.app.close().catch(() => {});
    await fakeGitHub.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
