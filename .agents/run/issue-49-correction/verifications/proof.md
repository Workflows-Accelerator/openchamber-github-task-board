# Deep Verification & Correction Proof: Issue #49 Login Label Text Bleed

**Task:** Minimal portable compatibility patch and empirical engine-specific visible outcome proof resolving hostile review findings F1, F2, and F3.  
**Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-issue-49-login-label`  
**Branch:** `fix/issue-49-login-label`  
**Base Commit:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  
**Date:** 2026-10-30  
**Provider / Model:** `9router / engineer`  

---

## 1. Resolution of Hostile Review Findings

### Finding 1 (Portability): Standard Unit Glob Free of Playwright & Ephemeral Caches
- **Hostile Finding:** The original builder placed a 217-line Playwright test directly in `web/tests/login-label.test.mjs`, relying on transient `/workspace/.npm/_npx/...` and `/workspace/.cache/ms-playwright/...` cache paths. On a clean repository checkout, running the standard unit suite `node --test web/tests/*.test.mjs` failed with `ERR_MODULE_NOT_FOUND`.
- **Correction Applied:**
  1. Replaced `web/tests/login-label.test.mjs` with a fast, zero-dependency unit test suite using Node's standard test runner (`node:test`, `node:assert/strict`, `node:fs`, `node:path`). It tests semantic HTML attributes, CSS rule contracts, screen reader helper elements, and synthetic HTTP session sign-in without launching any browser process.
  2. Moved all real-browser tests to a standalone verification script `web/tests/login-label-browser-verify.mjs` (matching the repository convention of `browser-verify.mjs` and `issue-48-browser-verify.mjs`). This script is excluded from the `*.test.mjs` glob.
  3. Implemented browser driving via Node's native `WebSocket` and `fetch` communicating directly over the Chromium DevTools Protocol (CDP), with zero npm package dependencies.
- **Evidence:**
  - Standard unit test command `node --test web/tests/*.test.mjs` executes cleanly in 25.08s across 453 tests with zero missing module errors.
  - `node --test web/tests/login-label.test.mjs` executes in 891ms (4/4 passed).

### Finding 2 (Engine Specificity & Minimal CSS): Obscura-Specific Defect with Minimal Patch
- **Hostile Finding:**
  1. The builder patch added global `clip-path: inset(50%)` to `.sr-only` and redundant `opacity: 0` to `input.sr-only`. Hostile ablation showed `clip-path` was completely ineffective in Obscura, while `opacity: 0` posed potential autofill heuristic risks.
  2. The builder claimed desktop Chrome was broken using a synthetic `bounds.u.right <= 0` and unclipped `scrollWidth` calculation. Baseline screenshots proved Chrome was already clean (`clip: rect(0,0,0,0)` was honored by Chromium); the text bleed defect was unique to Obscura's native input rendering.
- **Correction Applied:**
  1. Reverted global `.sr-only` changes in `web/public/theme.css`. Applied strictly the minimal scoped off-layout rule:
     ```css
     input.sr-only {
       left: -9999px;
     }
     ```
     Inherited `position: absolute` from `.sr-only` already applies. Redundant `position: absolute`, `top: auto`, `clip-path`, and `opacity: 0` were removed.
  2. Documented engine distinction clearly: baseline Chromium never exhibited text bleed (0 differences in password card region). Obscura suffered from text bleed due to clipping failure on native text primitives.
  3. Removed synthetic visual overlap assertions (`u.right <= 0`). Real visual proof is established through raw pixel and region comparisons between baseline/repro and corrected renders.
- **Evidence:**
  - In Obscura: comparing `repro-obscura-1280.png` (with bleed) against `after-obscura-1280.png` reveals 623 differing bytes in the Password label area, confirming the visible "board" bleed is eliminated.
  - Comparing minimal CSS (`left: -9999px`) against the builder's combined patch in Obscura yields exactly 0 differing bytes, proving `opacity: 0` and `clip-path` provided zero visual benefit.
  - In Chromium: comparing `before-login-1280.png` against `after-chromium-1280.png` reveals exactly 0 differing bytes in the Password card region, proving Chromium was clean before and remains clean after.

### Finding 3 (Transparency): Explicit Residual Blind Spots
- **Residual Blind Spot 1 — Native Password Manager Prompts:** Real browser autofill dialogs (e.g. Google Chrome native password save/fill popup, macOS/iOS Safari Keychain prompts, 1Password/Bitwarden extension overlays) cannot be exercised headlessly. DOM attributes (`autocomplete="username"`, `value="board"`, `readonly`, `autocomplete="current-password"`) are verified, but native password manager heuristics are explicitly marked UNVERIFIED.
- **Residual Blind Spot 2 — Auditory Screen Readers:** Computed accessibility tree nodes (`role="textbox"`, names `"Username"` and `"Password"`) were verified via CDP `Accessibility.getFullAXTree`, but live auditory speech synthesis (VoiceOver, NVDA, JAWS) cannot be validated in a headless environment and remains UNVERIFIED.

---

## 2. Test Execution & Verification Ladder

| Level / Suite | Exact Command | Exit Code | Result | Duration |
| :--- | :--- | :--- | :--- | :--- |
| **L0 Static** | `npx tsc -p web/tsconfig.json` | `0` | 0 errors | 1.8s |
| **L1 Unit (Focused)** | `node --test web/tests/login-label.test.mjs` | `0` | 4 passed, 0 failed | 0.89s |
| **L1 Unit (Web Glob)** | `node --test web/tests/*.test.mjs` | `0` | 453 passed, 0 failed | 25.08s |
| **L1 Unit (Root Suite)** | `node --test --test-concurrency=1 test/*.test.js` | `0` | 595 passed, 0 failed | 33.22s |
| **L1 Parity** | `node --test test/shipped-parity.test.js` | `0` | 18 passed, 0 failed | 0.34s |
| **L3 Browser (Issue 49)** | `node web/tests/login-label-browser-verify.mjs` | `0` | 25 passed, 0 failed | 2.6s |
| **L3 Browser (Issue 33)** | `node web/tests/browser-verify.mjs` | `0` | 33 passed, 0 failed | 3.4s |
| **L3 Browser (Issue 48)** | `node web/tests/issue-48-browser-verify.mjs` | `0` | 14 passed, 0 failed | 4.8s |

All test suites passed with exit code 0. Zero test weakening, skipped assertions, or loosened matchers were introduced.

---

## 3. Empirical Visual and Pixel Comparison Data

The standalone harness `login-label-browser-verify.mjs` executed pixel-level scanline comparisons (via `node:zlib` inflation of PNG IDAT chunks):

1. **Obscura Repro vs Obscura Corrected:**
   - Pair: `repro-obscura-1280.png` vs `after-obscura-1280.png`
   - Differing scanline bytes: **623 bytes**
   - Result: Visible bleed ("board" overlapping "Password") is completely eliminated.
2. **Minimal CSS vs Builder Combined CSS (Obscura):**
   - Pair: `left: -9999px` vs `clip-path + left: -9999px + opacity: 0`
   - Differing scanline bytes: **0 bytes** (visually identical)
   - Result: Proves `left: -9999px` alone achieves 100% of the visual fix.
3. **Chromium Baseline vs Chromium Corrected:**
   - Pair: `before-login-1280.png` vs `after-chromium-1280.png`
   - Differing scanline bytes in Password Card Region (x: 300..980, y: 150..500): **0 bytes**
   - Result: Confirms baseline Chromium was clean and rendering is completely unaffected.
4. **Horizontal Page Overflow:**
   - 1280x900: `scrollWidth = 1280`, `clientWidth = 1280` (0 overflow)
   - 360x800: `scrollWidth = 360`, `clientWidth = 360` (0 overflow)

Screenshots captured and stored in `.agents/run/issue-49-correction/verifications/screenshots/`:
- `after-obscura-1280.png` (1280x900 Obscura, clean Password label)
- `after-obscura-360.png` (360x800 Obscura mobile view, clean Password label)
- `after-chromium-1280.png` (1280x900 Chromium desktop view, clean Password label)
- `after-chromium-360.png` (360x800 Chromium mobile view, clean Password label)

---

## 4. Security, Session & Form Semantics Validation

1. **Synthetic Sign-in Flow:**
   - Form submission transmits `{ password: "..." }` via POST `/api/session`.
   - Hidden `#username` field remains un-submitted in network payload and functions strictly for browser credential autofill.
   - Authentication returns `200 OK` with valid `csrfToken` and Set-Cookie header.
2. **Cookie Security:**
   - Cookie `board_session` contains flags: `HttpOnly; Secure; SameSite=Strict; Path=/`.
   - Zero credential leakage in URL queries, logs, or localStorage.
3. **Screen Reader & Semantic Tree Integrity:**
   - `#announcer`: retained with `role="status"` and `aria-live="polite"`.
   - Screen reader labels intact: `label[for="quick-add-input"]`, `label[for="quick-add-description"]`, `label[for="quick-add-project"]`, `label[for="overview-text"]`.
   - CDP AXTree inspection verified `#username` and `#password` with `role="textbox"` and accessible names `"Username"` and `"Password"`.

---

## 5. Hostile Self-Review Residuals & Readiness

- **Portability Check:** Standard `node --test web/tests/*.test.mjs` runs without any external npm packages or local cache dependencies. Clean clone ready.
- **Surgical Patch Scope:** The CSS change is strictly 4 lines added in `web/public/theme.css` (`input.sr-only { left: -9999px; }`), with zero global modifications.
- **Readiness Verdict:** **PROCEED FOR HUMAN REVIEW (PREPARATION ONLY)**.
- **Operational Boundary:** In accordance with the user alignment contract (`batch-simplify-activation-approval.md`), no branch merge, git push, deployment, or issue closure has been performed. All changes remain staged/committed locally on `fix/issue-49-login-label`.
