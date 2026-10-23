# Task 206 Output: Host Service Architecture
## Status: completed
## Evidence:
- Typecheck output:
```
> openchamber-github-task-board@1.2.1 typecheck
> tsc --noEmit
```
(Exit 0, 0 errors)

- Build service output (bundle size, file generated):
```
> openchamber-github-task-board@1.2.1 build:service
> esbuild service/main.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=service/main.js

  service/main.js  6.1kb
⚡ Done in 13ms
```
Generated file: `service/main.js` (6.1 KB)

## Changes:
- `package.json`:
  - Added scripts `"build:panel"`, `"build:service"`, and updated `"build"` to chain both.
  - Declared background host service entrypoint in `"openchamber.contributes.service"` (`{"entry": "service/main.js", "runtime": "host"}`).
  - Retained exact declared capabilities `["sessions", "prompt", "files"]`.
- `tsconfig.json`:
  - Added `"service/**/*.ts"` to `"include"` array alongside `"panel/**/*.ts"`.
  - Configured `"types": ["node"]` and `"typeRoots"` for Node ESM types compatibility.
- `service/types.ts`:
  - Defined core coordinator types: `TaskLease`, `LeaseStoreState`, `ClaimResult`, `ReconciliationAction`, `CoordinatorConfig`, `CoordinatorStatus`, `SessionLivenessState`, `SessionLivenessInfo`.
- `service/config.ts`:
  - Implemented `loadCoordinatorConfig()` and `resolveStorageDir()` resolving host origin, poll intervals, lease TTL, and isolated storage directory (`.openchamber-data/task-coordinator`).
- `service/main.ts`:
  - Implemented and exported `CoordinatorService` lifecycle class (`start`, `stop`, `reconcileOnce`, graceful shutdown handlers for SIGINT/SIGTERM).

## Verification:
- `npm run typecheck` (PASS, exit 0)
- `npm run build:service` (PASS, exit 0, outputs `service/main.js` 6.1kb)
- `npm run build` (PASS, exit 0, bundles both panel and service)
- `npm test` (PASS, 413/413 tests green)
- Direct ESM runtime invocation test of `CoordinatorService` (PASS, cleanly transitioned stopped -> running -> stopped)
