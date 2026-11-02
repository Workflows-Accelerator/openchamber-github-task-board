# Deep Verification Result

**Task:** Independent adversarial recheck of issue #49 login label text bleed correction (F1-F3 resolution audit)  
**Status:** PASS  
**Timestamp:** 2026-10-30T20:25:00Z  

---

### Executed Levels

- **L0 Static:** PASS (`npx tsc -p web/tsconfig.json` -> exit 0, 0 errors, 1.8s)
- **L1 Unit (Focused):** PASS (`node --test web/tests/login-label.test.mjs` -> exit 0, 4 passed, 0 failed, 0.74s)
- **L1 Unit (Web Glob):** PASS (`node --test web/tests/*.test.mjs` -> exit 0, 453 passed, 0 failed, 0 skipped, 24.41s)
- **L1 Unit (Root Suite):** PASS (`node --test --test-concurrency=1 test/*.test.js` -> exit 0, 595 passed, 0 failed, 0 skipped, 32.86s)
- **L1 Parity:** PASS (`node --test test/shipped-parity.test.js` -> exit 0, 18 passed, 0 failed, 0.33s)
- **L3 The User's Way (CDP Browser Harness):** PASS (`node web/tests/login-label-browser-verify.mjs` -> exit 0, 25 passed, 0 failed, 4 screenshots, 2.6s)
- **L3 The User's Way (Web Baseline):** PASS (`node web/tests/browser-verify.mjs` -> exit 0, 33 passed, 0 failed, 3.4s)
- **L3 The User's Way (Issue 48 Harness):** PASS (`node web/tests/issue-48-browser-verify.mjs` -> exit 0, 14 passed, 0 failed, 4.8s)
- **L4 Hostile Review (AI Adversarial):** PASS (F1 closed, F2 closed, F3 honest limitation acknowledged — see Hostile Findings below)
- **L5 Human Validation:** AWAITING HUMAN (Batch simplify on staging / dev preview)

---

### Empirical Evidence ("The User's Way")

1. **Assertion 1 Verified (Standard Unit Glob Portability — F1):**
   - *Command:* `node --test web/tests/*.test.mjs`
   - *Exit Code:* `0`
   - *Duration:* `24.41s`
   - *Evidence:* Zero imports of `playwright-core`, zero references to `/workspace/.npm/_npx/...` or `/workspace/.cache/...`. Standard unit test glob executes all 453 tests cleanly with zero missing module errors.

2. **Assertion 2 Verified (Visual Bleed Elimination & Minimal Scoped CSS — F2):**
   - *Command:* `ARTIFACT_ROOT="$(pwd)/.agents/run/issue-49-recheck/verifications" node web/tests/login-label-browser-verify.mjs`
   - *Exit Code:* `0`
   - *CSS Delta in `web/public/theme.css`:* Exactly 4 lines added (`input.sr-only { left: -9999px; }`). Global `.sr-only` is completely untouched; `opacity: 0` and `clip-path` are omitted.
   - *Scanline Pixel Differencing (via `node:zlib` IDAT chunk inflation):*
     - `repro-obscura-1280.png` vs `after-obscura-1280.png`: **623 differing bytes** in the Password label area (proves bleed is eliminated in Obscura).
     - Minimal CSS (`left: -9999px`) vs Builder combined CSS (`clip-path + left: -9999px + opacity: 0`) in Obscura: **0 differing bytes** (proves `opacity: 0` and `clip-path` are completely redundant).
     - `before-login-1280.png` vs `after-chromium-1280.png`: **0 differing bytes** in the Password card bounding box (x: 300..980, y: 150..500) (proves baseline Chromium was already clean and remains clean).
   - *Horizontal Viewport Overflow:*
     - Viewport 1280x900: `clientWidth = 1280`, `scrollWidth = 1280` (0px overflow).
     - Viewport 360x800: `clientWidth = 360`, `scrollWidth = 360` (0px overflow).
   - *Screenshots Captured:*
     - `.agents/run/issue-49-recheck/verifications/screenshots/after-obscura-1280.png`
     - `.agents/run/issue-49-recheck/verifications/screenshots/after-obscura-360.png`
     - `.agents/run/issue-49-recheck/verifications/screenshots/after-chromium-1280.png`
     - `.agents/run/issue-49-recheck/verifications/screenshots/after-chromium-360.png`

3. **Assertion 3 Verified (Synthetic Sign-in, Cookie Security & Accessibility Semantics):**
   - *Synthetic Sign-in:* Browser sends POST `/api/session` with password, receives HTTP 200 with `csrfToken`, navigates cleanly to board view.
   - *Cookie Flags:* `board_session` set with `HttpOnly; Secure; SameSite=Strict; Path=/`.
   - *DOM Semantics:* `#username` input has `autocomplete="username"`, `readonly`, `tabindex="-1"`, and `value="board"`. Tabbing skips directly to `#password`.
   - *AXTree Verification:* CDP `Accessibility.getFullAXTree` confirms `#username` and `#password` with `role="textbox"` and accessible names `"Username"` and `"Password"`. `#announcer` preserved with `role="status"` and `aria-live="polite"`.

---

### Hostile Findings (L4)

| # | Finding | Severity | Resolution Status | Recheck Result |
|---|---|---|---|---|
| F1 | Undeclared Playwright dependency and ephemeral npx cache paths in standard unit glob (`web/tests/*.test.mjs`) | HIGH | Replaced `web/tests/login-label.test.mjs` with zero-dependency Node test; moved browser automation to standalone `login-label-browser-verify.mjs` over CDP WebSocket. | **CLOSED / RESOLVED**: `node --test web/tests/*.test.mjs` passes 453/453 with exit code 0. |
| F2 | Tautological overlap test and engine-specific defect misattributed to Chrome; redundant `opacity: 0` and global `clip-path` | MEDIUM | Reverted global `.sr-only` changes. Applied minimal scoped rule `input.sr-only { left: -9999px; }`. Removed `opacity: 0`. Replaced synthetic geometry test with raw pixel diffs confirming Obscura defect resolution and Chromium baseline purity. | **CLOSED / RESOLVED**: 623 differing bytes in Obscura repro vs fix; 0 differing bytes in Chromium baseline vs fix; 0 differing bytes between minimal CSS and builder CSS. |
| F3 | Screen reader voice output and native browser password manager autofill unverified in headless environment | LOW | Bounded as an explicit verification limitation in documentation; verified DOM and AXTree contracts while leaving auditory and native popup behaviors marked UNVERIFIED for human validation. | **ACKNOWLEDGED & BOUNDED**: Formally preserved as NOTVERIFIED for L5 human review. |

---

### Human Review Brief (L5)

**Batch:** `batch-simplify`  **Branch:** `dev`  **Preview:** `http://127.0.0.1:3000/`

| # | What to click | What should happen |
|---|---|---|
| 1 | Navigate to `http://127.0.0.1:3000/` on desktop and mobile viewports. | Sign-in view displays cleanly. The Password card displays only the "Password" label and input field. No overlapping ghost text ("board") appears behind or around the label. |
| 2 | Focus the browser address bar and press the `Tab` key. | Focus moves directly to the Password input field, skipping the hidden username input (`tabindex="-1"`). |
| 3 | Enter the board password and sign in; inspect browser credential prompt. | Password manager (e.g. Chrome autofill, macOS Keychain, 1Password) prompts to save password for user "board". Sign-in navigates to the board view. |

**Known blind spots for the human to focus on:**
- Live auditory speech synthesis in screen readers (VoiceOver, NVDA, JAWS).
- Native browser password manager popup presentation (Chrome native popup, Keychain, 1Password/Bitwarden extension overlays).

---

### Failures & Blind Spots

- **Failures:** None. All 453 web unit tests, 595 root unit tests, 18 parity tests, and 72 total browser checks passed with exit code 0.
- **Not Verified:** Physical auditory screen reader speech output and native OS password manager popup dialogs (cannot be executed headlessly).
