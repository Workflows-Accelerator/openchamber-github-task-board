import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { startBoard, BOARD_PASSWORD } from './helpers.mjs';

const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_CORE ||
      '/workspace/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs',
  )
);

function overlaps(r1, r2) {
  return !(
    r1.right <= r2.left ||
    r1.left >= r2.right ||
    r1.bottom <= r2.top ||
    r1.top >= r2.bottom
  );
}

test('issue #49: username input is positioned off-layout and does not overlap password label', async () => {
  const fake = await startFakeGitHub();
  let board, browser;
  try {
    board = await startBoard(fake);
    browser = await chromium.launch({
      executablePath:
        process.env.CHROMIUM_PATH ||
        '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
      headless: true,
      args: ['--no-sandbox'],
    });

    for (const [width, height] of [[1280, 800], [360, 800]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(board.url);
      await page.waitForSelector('#login-view');

      const bounds = await page.evaluate(() => {
        const u = document.getElementById('username');
        const p = document.querySelector('label[for="password"]');
        const ur = u.getBoundingClientRect();
        const pr = p.getBoundingClientRect();
        return {
          u: {
            left: ur.left,
            right: ur.right,
            top: ur.top,
            bottom: ur.bottom,
            width: ur.width,
            height: ur.height,
            scrollWidth: u.scrollWidth,
            scrollHeight: u.scrollHeight,
          },
          p: {
            left: pr.left,
            right: pr.right,
            top: pr.top,
            bottom: pr.bottom,
            width: pr.width,
            height: pr.height,
          },
          autocompleteUser: u.getAttribute('autocomplete'),
          autocompletePass: document.getElementById('password').getAttribute('autocomplete'),
          userTabindex: u.getAttribute('tabindex'),
          userReadonly: u.readOnly,
          userValue: u.value,
        };
      });

      // Verify attributes intact
      assert.equal(bounds.autocompleteUser, 'username');
      assert.equal(bounds.autocompletePass, 'current-password');
      assert.equal(bounds.userTabindex, '-1');
      assert.equal(bounds.userReadonly, true);
      assert.equal(bounds.userValue, 'board');

      // Regression check:
      // #username must be positioned off-layout (e.g. u.right <= 0) so its rendered text bounds
      // cannot bleed over or overlap the Password label in any rendering engine.
      assert.ok(
        bounds.u.right <= 0,
        `viewport ${width}x${height}: #username must be positioned off-layout (u.right=${bounds.u.right} must be <= 0)`,
      );

      const usernameTextRect = {
        left: bounds.u.left,
        right: bounds.u.left + bounds.u.scrollWidth,
        top: bounds.u.top,
        bottom: bounds.u.top + (bounds.u.scrollHeight > 1 ? bounds.u.scrollHeight : 18),
      };

      assert.equal(
        overlaps(usernameTextRect, bounds.p),
        false,
        `viewport ${width}x${height}: #username text box must not overlap Password label`,
      );

      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    if (board) await board.app.close();
    if (fake) await fake.close();
  }
});

test('issue #49: synthetic sign-in through browser submits credentials and sets session cookie', async () => {
  const fake = await startFakeGitHub();
  let board, browser;
  try {
    board = await startBoard(fake);
    browser = await chromium.launch({
      executablePath:
        process.env.CHROMIUM_PATH ||
        '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
      headless: true,
      args: ['--no-sandbox'],
    });

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(board.url);
    await page.waitForSelector('#login-view');

    // Fill password and click Sign in
    await page.fill('#password', BOARD_PASSWORD);
    await page.click('#login-btn');
    await page.waitForSelector('#board-view', { state: 'visible' });

    // Verify session cookie was set
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === 'board_session');
    assert.ok(sessionCookie, 'board_session cookie must be set after sign-in');
    assert.equal(sessionCookie.httpOnly, true, 'board_session cookie must be HttpOnly');

    await page.close();
  } finally {
    if (browser) await browser.close();
    if (board) await board.app.close();
    if (fake) await fake.close();
  }
});

test('issue #49: other .sr-only elements remain intact and accessible', async () => {
  const fake = await startFakeGitHub({
    repositories: [
      {
        repo: 'Workflows-Accelerator/openchamber-github-task-board',
        issues: [
          makeIssue({
            number: 1,
            title: 'Sample issue',
            labels: ['status:needs-human'],
            body: '## Open Questions\n- [ ] Question 1?',
          }),
        ],
      },
    ],
  });
  let board, browser;
  try {
    board = await startBoard(fake);
    browser = await chromium.launch({
      executablePath:
        process.env.CHROMIUM_PATH ||
        '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
      headless: true,
      args: ['--no-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto(board.url);
    await page.fill('#password', BOARD_PASSWORD);
    await page.click('#login-btn');
    await page.waitForSelector('#board-view', { state: 'visible' });

    // Check DOM sr-only elements
    const srOnlyLabels = await page.evaluate(() => {
      const labels = [
        'label[for=quick-add-input]',
        'label[for=quick-add-description]',
        'label[for=quick-add-project]',
        'label[for=overview-text]',
        '#announcer',
      ];
      return labels.map((sel) => {
        const el = document.querySelector(sel);
        return {
          selector: sel,
          exists: Boolean(el),
          hasSrOnlyClass: el ? el.classList.contains('sr-only') : false,
          role: el ? el.getAttribute('role') : null,
          ariaLive: el ? el.getAttribute('aria-live') : null,
        };
      });
    });

    for (const info of srOnlyLabels) {
      assert.ok(info.exists, `${info.selector} must exist`);
      assert.ok(info.hasSrOnlyClass, `${info.selector} must have .sr-only class`);
    }

    const announcer = srOnlyLabels.find((l) => l.selector === '#announcer');
    assert.equal(announcer.role, 'status');
    assert.equal(announcer.ariaLive, 'polite');

    await page.close();
  } finally {
    if (browser) await browser.close();
    if (board) await board.app.close();
    if (fake) await fake.close();
  }
});
