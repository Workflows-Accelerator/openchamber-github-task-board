# Hostile Recheck Findings: Issue #49 Login Label Text Bleed Correction

**Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-issue-49-login-label`  
**Branch:** `fix/issue-49-login-label`  
**Base Commit:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  
**Current Head:** `e6995e9` (commits `4ee7bc9`, `27cd1fa`, `bc97e58`, `e6995e9`)  
**Review Type:** Independent Adversarial Recheck (Doubt-Driven Development)  
**Provider / Model:** `9router / engineer`  
**Date:** 2026-10-30  

---

## 1. Executive Summary & Verdicts

- **Specification Compliance:** `SpecPASS`  
- **Code & Test Quality:** `QualityAPPROVED`  
- **Overall Recommendation:** `PROCEED` (No outstanding blockers or required findings)  
- **Human Approval (L5):** `AWAITINGHUMAN` (Ready for batched staging review)  

---

## 2. Recheck Audit of Prior Hostile Findings

### Finding 1 (Severity: HIGH — Test Suite Portability & Clean Setup)
- **Original Defect:** The initial builder patch imported `playwright-core` from an ephemeral npx cache path (`/workspace/.npm/_npx/...`) inside `web/tests/login-label.test.mjs`, causing standard repository unit test runs (`node --test web/tests/*.test.mjs`) to fail with `ERR_MODULE_NOT_FOUND` on clean checkouts.
- **Recheck Audit:**
  - Audited `web/tests/login-label.test.mjs`. All imports are strictly Node built-ins (`node:test`, `node:assert/strict`, `node:fs`, `node:path`, `node:url`) and local synthetic helpers (`fake-github.mjs`, `helpers.mjs`). Zero external packages, zero Playwright imports, and zero cache path references exist.
  - Real browser automation is strictly isolated in `web/tests/login-label-browser-verify.mjs` (matching repo convention `*.mjs` outside `*.test.mjs`). It uses Node's native `WebSocket` and `fetch` over CDP with zero npm dependencies.
  - Executed `node --test web/tests/*.test.mjs`: 453 passed (449 baseline + 4 issue #49), 0 failed, 0 skipped in 24.41s (exit code 0).
  - Executed `node --test web/tests/login-label.test.mjs`: 4 passed, 0 failed in 0.74s (exit code 0).
- **Status:** **CLOSED / RESOLVED** (Defect resolved empirically without adding dependencies or weakening assertions).

---

### Finding 2 (Severity: MEDIUM — Engine Specificity & Minimal CSS Scope)
- **Original Defect:** The builder added global `clip-path: inset(50%)` to `.sr-only` and redundant `opacity: 0` to `input.sr-only`. Ablation showed `clip-path` was ineffective in Obscura while `opacity: 0` posed autofill heuristic risks. Furthermore, baseline Chromium was already clean, and the reported failure was fabricated via synthetic `scrollWidth` calculations.
- **Recheck Audit:**
  - Audited `web/public/theme.css`: Diff against base `ab7516c` is strictly 4 lines:
    ```css
    input.sr-only {
      left: -9999px;
    }
    ```
    Global `.sr-only` remains untouched. Redundant `clip-path`, `position: absolute`, and `opacity: 0` were completely removed.
  - Independent pixel comparison via PNG IDAT scanline analysis:
    - **Obscura Repro vs Obscura Corrected:** 623 differing bytes in the Password card region. Visible bleed ("board" text overlapping "Password") is 100% eliminated.
    - **Obscura Minimal CSS vs Builder Full CSS:** Exactly 0 differing bytes. Minimal CSS `input.sr-only { left: -9999px; }` achieves identical visual rendering without `opacity: 0` or `clip-path`.
    - **Chromium Baseline vs Chromium Corrected:** Exactly 0 differing bytes in the Password card region (x: 300..980, y: 150..500). Confirms baseline Chromium was clean before and rendering is completely unaffected.
  - Horizontal viewport overflow: 0px overflow across 1280x900 and 360x800.
- **Status:** **CLOSED / RESOLVED** (Minimal CSS verified; engine distinction empirically proven).

---

### Finding 3 (Severity: LOW — Headless Environment Blind Spots)
- **Original Defect:** Headless browser environments cannot prove auditory screen reader announcements or native password manager autofill popups.
- **Recheck Audit:**
  - Audited accessibility tree via CDP `Accessibility.getFullAXTree`: `#username` and `#password` exist with `role="textbox"` and accessible names `"Username"` and `"Password"`.
  - Audited DOM contracts: `autocomplete="username"`, `readonly`, `tabindex="-1"`, `value="board"`, and `autocomplete="current-password"` remain intact in `web/public/index.html`.
  - Recheck strictly preserves the classification of real screen reader voice output and native password manager autofill prompts as **NOTVERIFIED** for L5 human validation.
- **Status:** **ACKNOWLEDGED & BOUNDED** (Explicitly documented as residual blind spots for human review).

---

## 3. New Findings During Recheck

**None.** No regressions, syntax errors, security vulnerabilities, or unintended side-effects were detected across static analysis, unit suites, parity checks, or browser runs.

---

## 4. Human Review Brief (L5 Preparation)

- **Target Preview:** http://127.0.0.1:3000/ (Sign-in View)
- **Action 1:** Load the login page on desktop (1280px) and mobile viewport (360px). Observe the Password card.
  - **Expected Outcome:** Only the label "Password" and its input field are visible. No ghosted or overlapping "board" text appears behind or beside the label.
- **Action 2:** Press Tab when focused on the address bar or first interactive element.
  - **Expected Outcome:** Focus lands directly on the Password input field. The hidden `#username` field is skipped due to `tabindex="-1"`.
- **Action 3:** Check browser password manager or extension (e.g. Chrome autofill, Keychain, 1Password).
  - **Expected Outcome:** Password manager offers to save/fill credentials associated with username "board".
- **Known Blind Spots for L5 Review:** Live auditory announcements in screen readers (VoiceOver, NVDA, JAWS) and native OS/browser autofill popups.
