# Task 209 Output: Stage 2B Proof & Bundle Build

## Status: completed

## Evidence:

### 1. Typecheck Output
```
> openchamber-github-task-board@1.2.1 typecheck
> tsc --noEmit
```
Result: Exit code 0, 0 compiler errors across both `panel/**/*.ts` and `service/**/*.ts`.

### 2. Bundle Builds Output (`panel/main.js` & `service/main.js`)
```
> openchamber-github-task-board@1.2.1 build
> npm run build:panel && npm run build:service

> openchamber-github-task-board@1.2.1 build:panel
> esbuild panel/main.ts --bundle --format=iife --target=chrome100 --tree-shaking=false --outfile=panel/main.js

  panel/main.js  610.6kb
⚡ Done in 135ms

> openchamber-github-task-board@1.2.1 build:service
> esbuild service/main.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=service/main.js

  service/main.js  30.5kb
⚡ Done in 21ms
```

#### Bundle Verification:
- **`panel/main.js`**:
  - Size: 610.6 KB
  - Format: IIFE (`chrome100`)
  - Parity: 100% parity verified against `panel/core.ts` via `node --test test/shipped-parity.test.js` (18/18 tests pass).
- **`service/main.js`**:
  - Size: 30.5 KB
  - Format: ESM Node.js (`node20`, external packages)
  - Runtime Evaluation: Evaluated cleanly in Node.js runtime, exporting all 20 coordinator symbols:
    - `CasManager`, `CoordinatorReconciler`, `CoordinatorService`, `DEFAULT_DRY_RUN`, `DEFAULT_HOST_ORIGIN`, `DEFAULT_LEASE_TTL_MS`, `DEFAULT_POLL_INTERVAL_MS`, `DEFAULT_STORAGE_DIR`, `LeaseStore`, `SessionWatcher`, `TaskClaimEngine`, `claimPilotTask`, `computeIssueSha`, `getDefaultLeasesFilePath`, `inspectSessionLiveness`, `isTaskEligibleForPilot`, `loadCoordinatorConfig`, `reconcileTaskState`, `resolveLeaseStorageDir`, `resolveStorageDir`, `verifyIssueCas`.

### 3. Full Regression Test Run Summary
- Command: `node --test`
- Total Tests: 449
- Passed: 449 (414 base + 35 new Stage 2B tests)
- Failed: 0
- Skipped: 0
- Cancelled: 0
- Pass Rate: 100%

### 4. Commit SHA on `feat/stage2b-pilot-coordinator`
- Commit SHA: `4286d402d635d58a3e68e688a86f5eafd866ac41` (`4286d40`)
- Commit Message: `feat(service): implement Stage 2B single-writer pilot coordinator background host service`
