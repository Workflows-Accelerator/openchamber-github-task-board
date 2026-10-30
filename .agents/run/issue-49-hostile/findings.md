# Hostile Review Findings: Issue #49 Login Label Correction

**Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-issue-49-login-label`  
**Branch:** `fix/issue-49-login-label`  
**Base Commit:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  
**Review Type:** Independent Adversarial Hostile Review (Doubt-Driven Development)  
**Provider / Model:** `9router / engineer`  

---

## Ranked Findings

### Finding 1 (Severity: HIGH — Blocker for Merge / L5 Approval)
- **Title:** Test suite portability breakage via undeclared Playwright dependency in default unit test glob
- **File & Line:** `web/tests/login-label.test.mjs:8-12, 29-33, 116-120, 167-171`
- **Impact:**  
  The new test was placed under `web/tests/*.test.mjs`, which is the repository's standard unit test glob (`node --test web/tests/*.test.mjs`). The test imports `playwright-core` with a hardcoded fallback to an ephemeral npx cache path (`/workspace/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs`) and launches a headless browser from an ms-playwright cache (`/workspace/.cache/ms-playwright/chromium_headless_shell-1248/...`). Neither `playwright-core` nor `@playwright/test` is declared in `package.json`. On a fresh repository clone, in CI runners, or when the user's npx cache is purged, running the documented unit test command `node --test web/tests/*.test.mjs` fails catastrophically with `ERR_MODULE_NOT_FOUND` before running any tests.
- **Empirical Evidence:**  
  Running `node -e 'import("playwright-core")'` fails with `ERR_MODULE_NOT_FOUND`. Running an import from a clean path without the ephemeral npx cache reproduces `ERR_MODULE_NOT_FOUND`. Existing browser test harnesses in the repository (such as `web/tests/browser-verify.mjs` using Obscura CDP over built-in WebSocket, and `web/tests/issue-48-browser-verify.mjs` named `*.mjs` rather than `*.test.mjs`) do not pollute the `*.test.mjs` unit test glob.
- **Minimum Correction:**  
  Either:
  1. Rename `web/tests/login-label.test.mjs` to a standalone harness (e.g. `web/tests/login-label-browser-verify.mjs`) excluded from `*.test.mjs`, matching the convention of `issue-48-browser-verify.mjs`; or
  2. Implement browser checks using the repository's zero-dependency Obscura CDP harness pattern (`browser-verify.mjs`); or
  3. Formally declare `playwright-core` in `package.json` with fallback skipping when the browser binary or dependency is unavailable.

---

### Finding 2 (Severity: MEDIUM — Accuracy & Autofill Heuristics)
- **Title:** Tautological regression test and engine-specific defect misattributed to Chrome
- **File & Line:** `web/tests/login-label.test.mjs:83-100` and `web/public/theme.css:541,546-551`
- **Impact:**  
  1. **Engine Specificity:** The before screenshots in Chromium (`before-login-1280.png` and `before-login-360.png`) prove that base Chromium was already completely clean before the fix (no bleed). The bleed defect was entirely engine-specific to the Obscura headless renderer, which failed to clip native input text with `clip: rect(0, 0, 0, 0)`. Mischaracterizing this as a general desktop Chrome defect obscures the actual root cause.
  2. **Tautological Test:** The regression check in `login-label.test.mjs` asserts `bounds.u.right <= 0`. This tests the specific implementation (`left: -9999px`) rather than testing for visual text bleed. The test synthetically fabricated an unclipped rectangle using `bounds.u.left + bounds.u.scrollWidth` to force an overlap failure on base Chromium where no visible bleed existed.
  3. **Causal Ablation:** Empirical testing of isolated CSS variants in Obscura proved that `clip-path: inset(50%)` does NOT prevent the bleed in Obscura. Only offscreen positioning (`left: -9999px`) or `opacity: 0` prevented the bleed. Combining `opacity: 0` with offscreen positioning is redundant and risks triggering browser password manager autofill heuristics that distrust transparent inputs.
- **Empirical Evidence:**  
  Captured ablation screenshots in `.agents/run/issue-49-hostile/verifications/screenshots/`:
  - `ablation-baseline.png`: bleed reproduces in Obscura.
  - `ablation-clippath_only.png`: bleed STILL reproduces in Obscura (`clip-path` alone is ineffective on Obscura's native input primitives).
  - `ablation-left_only.png`: bleed is completely gone in Obscura without `opacity: 0`.
  - `ablation-opacity_only.png`: bleed is visually invisible in Obscura.
- **Minimum Correction:**  
  Disclose clearly in release notes and pull requests that baseline desktop Chromium had no bleed and the defect was specific to Obscura. Remove redundant `opacity: 0` if not strictly required to avoid autofill heuristics downweighting transparent fields.

---

### Finding 3 (Severity: LOW — Verification Limitation / Blind Spot)
- **Title:** Screen reader and native password manager autofill remain unverified in headless environment
- **File & Line:** `web/tests/login-label.test.mjs:183-207`
- **Impact:**  
  The accessibility test in `login-label.test.mjs` only checks DOM presence and class names. While hostile CDP AXTree inspection confirmed that `#username` and `#password` exist in the accessibility tree with `role: "textbox"` and accessible names `"Username"` and `"Password"`, live screen reader announcements (NVDA, JAWS, VoiceOver) cannot be validated headlessly. Similarly, native password manager autofill overlays (e.g. Chrome's native autofill popup, Apple Keychain, Bitwarden, 1Password) cannot be triggered in headless tests.
- **Empirical Evidence:**  
  CDP `Accessibility.getFullAXTree` shows both fields present and unignored in the AXTree, but real auditory/overlay interaction requires physical user verification.
- **Minimum Correction:**  
  Document native password manager prompts and screen reader voice output as explicit residual blind spots for L5 human review.
