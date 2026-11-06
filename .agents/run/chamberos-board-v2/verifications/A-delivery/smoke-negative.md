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
