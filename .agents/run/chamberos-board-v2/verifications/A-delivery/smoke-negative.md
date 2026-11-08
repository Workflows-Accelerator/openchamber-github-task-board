# Negative Smoke Check Verifications (Hostile 2 Remediation)

Date: 2026-11-06
Environment: Real Chromium (`chrome-headless-shell 156.0.8078.4`) via `.agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh`
Target Preview: `http://127.0.0.1:4041`

Each check below was proven by injecting a deliberate fault into an isolated copy of `scripts/generate-delivery-smoke.mjs` against an isolated output directory (`/tmp/opencode/test-smoke-mut`), confirming a non-zero exit status and the expected failure diagnosis, and verifying the production baseline remains clean.

---

## 1. Injected Console Error

### Fault Injection
Before diagnostics collection, executed:
```js
await page.evaluate(() => console.error("INJECTED_TEST_CONSOLE_ERROR"));
```

### Execution Result
- **Exit Status:** `1` (Non-zero)
- **Captured Error in `smoke.json`:**
  ```json
  {
    "name": "browser diagnostics",
    "verdict": "FAIL",
    "exceptions": [],
    "consoleErrors": [
      "INJECTED_TEST_CONSOLE_ERROR"
    ],
    "cspViolations": []
  }
  ```
- **Process Failure Output:**
  ```text
  Error: Smoke check failed with 1 failing check(s): browser diagnostics
      at run (file:///workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/scripts/generate-delivery-smoke.mjs:538:11)
  ```

---

## 2. Injected Uncaught Exception

### Fault Injection
Before diagnostics collection, executed an asynchronous unhandled exception:
```js
await page.evaluate(() => {
  setTimeout(() => {
    throw new Error("INJECTED_TEST_UNCAUGHT_EXCEPTION");
  }, 10);
});
await sleep(50);
```

### Execution Result
- **Exit Status:** `1` (Non-zero)
- **Captured Error in `smoke.json`:**
  ```json
  {
    "name": "browser diagnostics",
    "verdict": "FAIL",
    "exceptions": [
      "Error: INJECTED_TEST_UNCAUGHT_EXCEPTION"
    ],
    "consoleErrors": [],
    "cspViolations": []
  }
  ```
- **Process Failure Output:**
  ```text
  Error: Smoke check failed with 1 failing check(s): browser diagnostics
      at run (file:///workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/scripts/generate-delivery-smoke.mjs:538:11)
  ```

---

## 3. Injected Button Overlap in Canvas Controls HUD

### Fault Injection
During HUD matrix measurement across 9 viewports, forced `#canvas-arrange` to shift left by 100px:
```js
await page.evaluate(() => {
  const btn = document.getElementById("canvas-arrange");
  if (btn) btn.style.marginLeft = "-100px";
});
```

### Execution Result
- **Exit Status:** `1` (Non-zero)
- **Captured Error in `smoke.json`:**
  ```json
  {
    "name": "Canvas controls mobile containment (360/768/1280, EN/FR, light/dark)",
    "verdict": "FAIL",
    "casesTested": 9,
    "artifact": "/tmp/opencode/test-smoke-mut/canvas-measurements.json"
  }
  ```
- **Diagnostic Detection Output:**
  ```text
  Canvas control containment violation at 1280x900 en: {
    overflowsLeft: false,
    overflowsRight: false,
    buttonOverflow: true,
    buttonOverlap: [ 'canvas-reset-view & canvas-arrange' ],
    documentOverflow: false
  }
  ...
  Error: Smoke check failed with 1 failing check(s): Canvas controls mobile containment (360/768/1280, EN/FR, light/dark)
      at run (file:///workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/scripts/generate-delivery-smoke.mjs:538:11)
  ```

---

## Conclusion
All three fault injection mechanisms (console errors, uncaught exceptions, and control overlaps) immediately cause `scripts/generate-delivery-smoke.mjs` to fail with exit code 1 and record unambiguous diagnostics in `smoke.json`. None of the checks rely on static `verdict: 'PASS'` strings.

---

## Fix4 (hostile review 3, H3-1): two-axis viewport containment

Date: 2026-11-08. `scripts/generate-delivery-smoke.mjs` now checks every visible HUD control (`#canvas-controls .canvas-control-btn`, not hidden, non-zero size) against the `#canvas-viewport` rect on both axes: `left >= vp.left`, `right <= vp.right`, `top >= vp.top`, `bottom <= vp.bottom` (0.5px tolerance). The window-bounds check now also covers `top < 0` and `bottom > window height`. Any control outside the viewport is listed with its rect in `buttonsOutsideViewport`, printed in the console warning together with the viewport rect, and copied into the containment record's `violations` in `smoke.json`. The existing horizontal HUD checks and the pairwise-overlap check are unchanged. Every verdict is still computed; no literal `PASS` was added.

Harness: `.agents/run/chamberos-board-v2/verifications/A-delivery/fix4/scripts/smoke-challenges.mjs`. This is a copy of the hostile3 harness, which was not edited. The copy adds the `offscreenYBelow` variant and records each run's `canvas-arrange` rect. Each variant runs as a disposable copy under `/tmp/opencode/fix4-smoke-EKeKmZ/`, writing output to its own `DELIVERY_DIR`. Injections never write verdict variables.

```bash
source .agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh
node .agents/run/chamberos-board-v2/verifications/A-delivery/fix4/scripts/smoke-challenges.mjs
```

Results are in `fix4/smoke-challenges.json`, with per-variant logs in `fix4/raw/smoke-<variant>.log` and the harness summary in `fix4/raw/smoke-challenges-harness.log`. The harness itself exits 0 and records each child's exit code explicitly. The `#canvas-arrange` rect is taken at 1280×900 light EN, where the viewport is `left 230, right 1280, top 74.5, bottom 900`.

| Variant | Injection | Exit | Failing record | Injected / observed rect |
|---|---|---|---|---|
| baseline | none | 0 | none (10/10 computed PASS) | Arrange `1195..1259 × 93.5..117.5` |
| offscreenY (above) | `#canvas-arrange` `transform: translateY(-2000px)` | **1** | Canvas controls containment FAIL, 9/9 cases; `buttonsOutsideViewport: [{id: "canvas-arrange", left 1195, right 1259, top -1906.5, bottom -1882.5}]` | top -1906.5, bottom -1882.5 |
| offscreenYBelow (below) | `#canvas-arrange` `transform: translateY(2000px)` | **1** | Canvas controls containment FAIL, 9/9 cases; `buttonsOutsideViewport: [{id: "canvas-arrange", left 1195, right 1259, top 2093.5, bottom 2117.5}]` | top 2093.5, bottom 2117.5 |
| console | `console.error("H3_CONSOLE_ERROR")` | **1** | browser diagnostics FAIL; `consoleErrors: ["H3_CONSOLE_ERROR"]` | n/a |
| exception | async `throw new Error("H3_UNCAUGHT_EXCEPTION")` | **1** | browser diagnostics FAIL; `exceptions: ["H3_UNCAUGHT_EXCEPTION", "Uncaught"]` | n/a |
| overlap | `#canvas-arrange` `margin-left: -100px` | **1** | Canvas controls containment FAIL, 9/9 cases; overlap `canvas-reset-view & canvas-arrange`; `canvas-reset-view` right 1283 > viewport right 1280 | Arrange `1195..1259 × 119.5..143.5` |
| csp | inline `<script>` appended | **1** | browser diagnostics FAIL; CSP `script-src 'self'` violation and `inline` | n/a |
| offscreenX | `#canvas-arrange` `transform: translateX(2000px)` | **1** | Canvas controls containment FAIL, 9/9 cases; `buttonsOutsideViewport: [{id: "canvas-arrange", left 3195, right 3259, ...}]` | left 3195, right 3259 |
| missingWire | first `.canvas-wire-group` removed after readiness wait | **1** | Canvas view FAIL; `wires: 3` | n/a |
| beforeNavigation | `console.error("H3_BEFORE_NAVIGATION")`, then reload | **1** | browser diagnostics FAIL; `consoleErrors: ["H3_BEFORE_NAVIGATION"]` | n/a |

The above-viewport and below-viewport injections each exit 1 with a failure that names `canvas-arrange`. All seven earlier hostile3 injections still exit 1. A direct, uninjected run of the real script (`DELIVERY_DIR=/tmp/opencode/fix4-baseline-rLN3 node scripts/generate-delivery-smoke.mjs`) exits 0 with 10/10 computed PASS. All 9 matrix cases have zero controls outside the viewport and zero overlaps (`fix4/raw/smoke-baseline-direct.log`, `fix4/smoke-baseline.json`, `fix4/baseline-canvas-measurements.json`).
