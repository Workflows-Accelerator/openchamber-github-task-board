# Deep Verification Result: Issue #49 Hostile Review

**Task:** Independent adversarial hostile review of Issue #49 login label correction  
**Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-issue-49-login-label`  
**Branch:** `fix/issue-49-login-label`  
**Base Commit:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  
**Timestamp:** 2026-10-30T14:45:00Z  
**Provider / Model:** `9router / engineer`  

---

## 1. Independent Verdicts

- **Spec Verdict:** **PASS**  
  The sign-in view in both Obscura and Chromium shows a clean Password label with no visible username text. Synthetic sign-in, sessions, HttpOnly cookies, CSRF protection, and autocomplete attributes (`username` and `current-password`) are fully intact.
- **Quality Verdict:** **NEEDS-FIXES**  
  The builder added `login-label.test.mjs` directly into the repository's standard unit test glob (`node --test web/tests/*.test.mjs`), introducing an undeclared Playwright dependency that relies on transient local npx and ms-playwright caches. On a clean checkout or CI environment, the unit test suite fails with `ERR_MODULE_NOT_FOUND`. Furthermore, the regression assertion `bounds.u.right <= 0` checks implementation detail rather than visual defects, obscuring the fact that baseline Chromium was already clean.
- **L5 Human Validation Readiness:** **NOT READY** (Blocked on resolving Finding 1 test portability).

---

## 2. Browser Defect Distinction & Causal Ablation

### Engine Specificity
- **Chromium (Headless Shell / Desktop):** Baseline master (`ab7516c`) before the fix had **ZERO** bleed. The 1px box with `clip: rect(0,0,0,0)` was completely clipped by Chromium's rendering engine. Both `before-login-1280.png` and `before-login-360.png` show a clean layout.
- **Obscura (Headless Browser):** Baseline master reproduced visible text bleed ("board" overlapping "Password") because Obscura failed to clip native input text primitives with `clip: rect(0,0,0,0)`.

### Empirical Causal Ablation
Five isolated CSS variants were evaluated against Obscura:
1. `baseline` (`.sr-only` with `clip: rect(0,0,0,0)`): Bleed reproduced. (`ablation-baseline.png`)
2. `clippath_only` (`.sr-only` + `clip-path: inset(50%)`): **Bleed STILL reproduced.** `clip-path` alone does not fix the defect in Obscura. (`ablation-clippath_only.png`)
3. `left_only` (`input.sr-only { position: absolute; left: -9999px; }`): **Bleed completely eliminated.** Clean Password label. (`ablation-left_only.png`)
4. `opacity_only` (`input.sr-only { opacity: 0; }`): Bleed visually hidden. (`ablation-opacity_only.png`)
5. `builder_full` (combined `clip-path`, `left: -9999px`, and `opacity: 0`): Clean Password label. (`ablation-builder_full.png`)

All ablation artifacts are preserved in `.agents/run/issue-49-hostile/verifications/screenshots/`.

---

## 3. Test Ladder Execution & Empirical Results

| Level / Suite | Command | Exit Code | Result Details |
| :--- | :--- | :--- | :--- |
| **L0 Static** | `npx tsc -p web/tsconfig.json` | `0` | 0 TypeScript errors |
| **L1 Unit (New)** | `node --test web/tests/login-label.test.mjs` | `0` | 3 passed, 0 failed (4.49s) |
| **L1 Unit (Web)** | `node --test web/tests/*.test.mjs` | `0` | 452 passed, 0 failed (26.97s) |
| **L1 Unit (Root)** | `node --test --test-concurrency=1 test/*.test.js` | `0` | 595 passed, 0 failed (33.77s) |
| **L1 Parity** | `node --test test/shipped-parity.test.js` | `0` | 18 passed, 0 failed (0.35s) |
| **L3 Browser** | `node web/tests/browser-verify.mjs` | `0` | 33 passed, 0 failed (10 screenshots) |
| **L3 Issue 48** | `node web/tests/issue-48-browser-verify.mjs` | `0` | 14 passed, 0 failed (16 screenshots) |

---

## 4. Empirical Security, Accessibility & Semantics Audit

1. **Form Controls & Semantics:**
   - `#username`: `autocomplete="username"`, `readonly=true`, `tabindex="-1"`, `value="board"`, `class="sr-only"`.
   - `#password`: `autocomplete="current-password"`, `required=true`, `type="password"`.
2. **Keyboard Focus & Scroll Side Effects:**
   - Tab key skips `#username` directly from page top to `#login-btn` / `#password`.
   - Direct programmatic focus on `#username` leaves `scrollLeft=0`, `scrollWidth=360`, `clientWidth=360` (zero layout shift or horizontal overflow).
3. **Network & Session Protection:**
   - Sign-in POST `/api/session` transmits `{ password: "..." }`; `#username` is omitted from payload and retained solely for DOM autofill.
   - Session sets cookie `board_session` with `httpOnly: true`, `sameSite: "Strict"`, and `secure: true`.
   - Zero credential leaks in URL query parameters, server logs, or browser console.
4. **CDP Accessibility Tree:**
   - Both `#username` and `#password` appear in the accessibility tree as `role="textbox"` with valid names `"Username"` and `"Password"`.
   - Other `.sr-only` elements (`label[for=quick-add-input]`, `label[for=overview-text]`, `#announcer`) remain intact in the AXTree.

---

## 5. Hostile Findings Summary (L4)

| Finding | Severity | File:Line | Description |
| :--- | :--- | :--- | :--- |
| **Finding 1** | **HIGH** | `web/tests/login-label.test.mjs:8-12` | Undeclared Playwright dependency in default `web/tests/*.test.mjs` glob breaks portability on clean installs. |
| **Finding 2** | **MEDIUM** | `web/tests/login-label.test.mjs:83-100` | Tautological `u.right <= 0` regression test; misattributes engine-specific Obscura defect to Chrome; redundant `opacity: 0` risks autofill heuristics. |
| **Finding 3** | **LOW** | `web/tests/login-label.test.mjs:183-207` | Screen reader announcements and native browser password manager autofill prompts remain unverified in headless environments. |

Detailed descriptions and minimum corrections are documented in `.agents/run/issue-49-hostile/findings.md`.

---

## 6. Residual Blind Spots

1. **Native Password Manager Prompts:** Real browser password manager autofill dialogs (e.g. Google Chrome password popup, macOS / iOS Safari Keychain prompts, Bitwarden/1Password extension overlays) cannot be triggered headlessly.
2. **Auditory Screen Readers:** Computed accessibility tree nodes were verified, but actual auditory rendering across screen readers (VoiceOver, NVDA, JAWS) was not exercised.
