# Verification Proof: Issue #49 Login Label Bleed Correction

**Date:** 2026-10-30  
**Branch:** `fix/issue-49-login-label`  
**Base:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb` (`master`)  
**Provider / Model:** `9router / engineer`  
**Status:** COMPLETE (Prepared for review; no master push or deploy)

---

## 1. Defect Reproduction & Analysis

- **Defect (F-01 from live audit):** On the standalone board sign-in view (`web/public/index.html`), a hidden username field `<input id="username" class="sr-only" name="username" value="board" autocomplete="username" readonly tabindex="-1">` was added in D49 to satisfy desktop browser password managers.
- **Reproduction:** In the Obscura headless browser engine (used by repo verification harnesses and audit agents), the `<input>` control text content `"board"` rendered outside its 1px box despite `.sr-only`'s `clip: rect(0, 0, 0, 0)` and `overflow: hidden`, bleeding directly over the "Password" label text at both 1280px desktop and 360px mobile viewports.
- **Evidence:** Captured reproduction screenshots:
  - `.agents/run/issue-49-login-label/verifications/screenshots/repro-obscura-1280.png` (`e1f97d3209f1...`)
  - `.agents/run/issue-49-login-label/verifications/screenshots/repro-obscura-360.png` (`ef1b5416088b...`)

---

## 2. Surgical Fix

- **Modified File:** `web/public/theme.css:541,546-551`
- **Diff:**
  ```diff
  --- a/web/public/theme.css
  +++ b/web/public/theme.css
  @@ -538,10 +538,18 @@ label {
     margin: -1px;
     overflow: hidden;
     clip: rect(0, 0, 0, 0);
  +  clip-path: inset(50%);
     white-space: nowrap;
     border: 0;
   }
   
  +input.sr-only {
  +  position: absolute;
  +  left: -9999px;
  +  top: auto;
  +  opacity: 0;
  +}
  ```
- **Rationale:**
  1. Adding modern standard `clip-path: inset(50%)` brings `.sr-only` to W3C accessible hiding standards alongside legacy `clip: rect(...)`.
  2. For `<input>` elements (which browsers render using replaced/native text edit controls where `overflow: hidden` or `clip: rect(...)` may fail to clip text primitives in certain engines), `input.sr-only` positions the element off-layout (`left: -9999px`) with `opacity: 0`.
  3. The element remains fully in the DOM, preserves `display: block` (or native input display), and `visibility: visible`. Password managers (Chrome, Safari, 1Password, Bitwarden) continue to recognize the username field.
  4. Screen-reader accessibility of other `.sr-only` elements (`<label>` and `#announcer`) is completely unaffected.

---

## 3. Regression Test Suite

- **Test File:** `web/tests/login-label.test.mjs`
- **Checks:**
  1. `issue #49: username input is positioned off-layout and does not overlap password label`:
     - Checks across 1280x800 and 360x800 viewports.
     - Confirms `autocomplete="username"`, `autocomplete="current-password"`, `tabindex="-1"`, `readonly=true`, and `value="board"` attributes intact.
     - Regression assertion: asserts `#username` bounding box has `right <= 0` and text bounding box does not overlap `label[for="password"]`.
     - **Before fix:** FAILED (`AssertionError: viewport 1280x800: #username must be positioned off-layout (u.right=226 must be <= 0)`).
     - **After fix:** PASSED.
  2. `issue #49: synthetic sign-in through browser submits credentials and sets session cookie`:
     - Submits synthetic password through browser `#login-form`.
     - Confirms `#board-view` appears and HttpOnly `board_session` cookie is set.
     - PASSED.
  3. `issue #49: other .sr-only elements remain intact and accessible`:
     - Verifies `.sr-only` labels (`label[for=quick-add-input]`, `label[for=quick-add-description]`, `label[for=quick-add-project]`, `label[for=overview-text]`) and live region (`#announcer` with `role="status"` and `aria-live="polite"`) exist and retain accessible attributes.
     - PASSED.

---

## 4. Full Test Ladder Results

| Test Suite | Command | Result |
| :--- | :--- | :--- |
| TypeScript Typecheck | `npx tsc -p web/tsconfig.json` | **PASS** (0 errors) |
| Web Test Suite | `node --test web/tests/*.test.mjs` | **PASS** (452/452 passed) |
| Root Test Suite | `node --test --test-concurrency=1 test/*.test.js` | **PASS** (595/595 passed) |
| Shipped Parity Suite | `node --test test/shipped-parity.test.js` | **PASS** (18/18 passed) |
| Browser Verify Harness | `node web/tests/browser-verify.mjs` | **PASS** (33/33 checks passed) |
| Issue 48 Browser Verify | `node web/tests/issue-48-browser-verify.mjs` | **PASS** (14/14 checks passed) |

---

## 5. Visual Evidence Artifacts

| Screenshot Artifact | Engine | Viewport | Defect Visible? | Description |
| :--- | :--- | :--- | :--- | :--- |
| `repro-obscura-1280.png` | Obscura | 1280x900 | **YES** | "board" text bleeds over "Password" label |
| `repro-obscura-360.png` | Obscura | 360x800 | **YES** | "board" text bleeds over "Password" label |
| `before-login-1280.png` | Chromium | 1280x800 | NO | Chromium clips 1px box; no bleed |
| `before-login-360.png` | Chromium | 360x800 | NO | Chromium clips 1px box; no bleed |
| `after-obscura-1280.png` | Obscura | 1280x900 | **NO (CLEAN)** | Clean "Password" label; no text bleed |
| `after-obscura-360.png` | Obscura | 360x800 | **NO (CLEAN)** | Clean "Password" label; no text bleed |
| `after-chromium-1280.png` | Chromium | 1280x800 | **NO (CLEAN)** | Clean "Password" label; layout intact |
| `after-chromium-360.png` | Chromium | 360x800 | **NO (CLEAN)** | Clean "Password" label; layout intact |

All screenshots reside in `.agents/run/issue-49-login-label/verifications/screenshots/`.

---

## 6. Hostile Self-Review

1. **Password Manager Compatibility:**
   - *Question:* Does any password manager now ignore the hidden username?
   - *Analysis:* Many password managers explicitly skip fields styled with `display: none` or `visibility: hidden`. Our fix deliberately avoids both rules: `#username` remains `display: block` and `visibility: visible`. Offscreen positioning (`left: -9999px`) is the universally accepted accessible technique for maintaining form controls within DOM autofill trees without visual presence.
2. **Impact on other `.sr-only` Elements:**
   - *Question:* Did any other `.sr-only` users change or break?
   - *Analysis:* Every other `.sr-only` element in the application is a `<label>` or `<div>` (`#announcer`). None are `<input>` elements, so the `input.sr-only` rule does not apply to them. The addition of `clip-path: inset(50%)` to `.sr-only` aligns with modern CSS accessibility standards and does not change their positioning or screen reader announcements. Verified via DOM inspection in `login-label.test.mjs`.
3. **Cross-Engine Support (iOS Safari / WebKit & Firefox):**
   - *Question:* Does the fix hold on iOS Safari / WebKit and Firefox in principle?
   - *Analysis:* `position: absolute; left: -9999px;` has been universally supported across all CSS engines since CSS 2.1. `clip-path: inset(50%)` is supported in WebKit (Safari 10.1+) and Gecko (Firefox 54+). The offscreen positioning guarantees zero bleed regardless of engine-specific input text clipping quirks.
4. **Service Worker Cache Updates Post-Deploy:**
   - *Question:* Does the Service Worker serve the new CSS after deploy?
   - *Analysis:* In `web/server/app.ts`, `getVersionStamp()` computes a SHA-256 digest over `['index.html', 'app.js', 'theme.css', 'manifest.json']`. Modifying `theme.css` naturally changes the version stamp from `1.2.1-e5b029b1b2` to `1.2.1-db7062e6a9`. The SW dynamic cache name `workflows-board-v<stamp>` activates automatically, claims clients, and drops stale caches on the next network load.

---

## 7. Residual Blind Spots

- Real physical mobile device password manager prompts (e.g. iOS iCloud Keychain quick-type bar, 1Password / Bitwarden native Android autofill overlays) cannot be exercised inside headless Linux test environments; verification is based on DOM attribute compliance (`autocomplete="username"`, `readonly`, DOM presence, synthetic CDP browser form submission).

---

## 8. Commit Log on `fix/issue-49-login-label`

- `e9ee37d`: `test(web): add regression test and browser reproduction for login label bleed (#49)`
- `76edb66`: `fix(web): hide sr-only input off-layout and add clip-path to prevent text bleed (#49)`
- Current: `chore(run): record verification proof and screenshots for issue #49`
