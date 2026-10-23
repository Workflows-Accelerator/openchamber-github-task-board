<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage2b-pilot-coordinator
Branch: feat/stage2b-pilot-coordinator
Base commit: 9d4f8da
Files: package.json, tsconfig.json, service/types.ts, service/config.ts, service/main.ts
Test command: npm run typecheck && npm run build:service
Do not touch: config/**, master branch (do NOT push to master or origin)
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Establish the host background service architecture for openchamber-github-task-board: declare openchamber.contributes.service in package.json, configure esbuild and TypeScript for node20 ESM service output, and implement service/types.ts, service/config.ts, and service/main.ts entrypoint.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/PLAN-STAGE2B.md]
[@/workspace/extensions/chambervoice/package.json]
[@/workspace/extensions/github-task-board/package.json]
</context_files>
<skills>
[@.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@.agents/skills/build/discipline/incremental-implementation/SKILL.md]
[@.agents/skills/build/discipline/surgical-patch/SKILL.md]
</skills>
<owned_paths>
package.json
tsconfig.json
service/types.ts
service/config.ts
service/main.ts
.agents/run/task-centred-architecture/outputs/task-206-service-architecture.md
</owned_paths>
<depends_on>
none
</depends_on>
<steps>
1. Symlink node_modules in the worktree if not present: `[ -d node_modules ] || ln -s /workspace/extensions/github-task-board/node_modules node_modules`.
2. In `package.json`:
   - Under `"scripts"`:
     - Add `"build:panel": "esbuild panel/main.ts --bundle --format=iife --target=chrome100 --tree-shaking=false --outfile=panel/main.js"`
     - Add `"build:service": "esbuild service/main.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=service/main.js"`
     - Update `"build"`: `"npm run build:panel && npm run build:service"`
   - Under `"openchamber.contributes"`:
     - Add `"service": { "entry": "service/main.js", "runtime": "host" }`
     - Keep existing `"capabilities"` exactly `["sessions", "prompt", "files"]` so existing test `test/repo-detector.test.js` continues passing.
3. In `tsconfig.json`:
   - Ensure include paths cover `service/**/*.ts` alongside `panel/**/*.ts`.
4. Create `service/types.ts`:
   - Define interfaces:
     - `TaskLease`: `issueNumber: number`, `repo: string`, `ownerId: string`, `claimedAt: number`, `expiresAt: number`, `heartbeatAt: number`, `claimedSha: string`, `phase: string`
     - `LeaseStoreState`: `version: number`, `leases: Record<string, TaskLease>`
     - `ClaimResult`: `acquired: boolean`, `lease?: TaskLease`, `conflictReason?: string`
     - `ReconciliationAction`: `action: 'advance' | 'escalate' | 'poll' | 'release'`, `targetPhase?: string`, `targetAttention?: string`, `reason: string`
     - `CoordinatorConfig`: `hostOrigin: string`, `pollIntervalMs: number`, `leaseTtlMs: number`, `storageDir: string`, `dryRun: boolean`
5. Create `service/config.ts`:
   - Implement `loadCoordinatorConfig(): CoordinatorConfig`:
     - Reads environment variables `OPENCHAMBER_HOST_ORIGIN` (default `'http://127.0.0.1:3000'`), `COORDINATOR_POLL_INTERVAL_MS` (default `15000`), `COORDINATOR_LEASE_TTL_MS` (default `60000`), `COORDINATOR_STORAGE_DIR` (default `.openchamber-data/task-coordinator`), `COORDINATOR_DRY_RUN` (`'true'` -> true, default false).
     - Resolves storage directory relative to repository root or `/workspace`.
6. Create `service/main.ts`:
   - Export service lifecycle controller `CoordinatorService`:
     - `start()`: logs startup banner, ensures storage directory exists, starts background reconciliation loop.
     - `stop()`: handles graceful shutdown, clears timers, releases held leases.
   - If running directly (`process.argv[1] === fileURLToPath(import.meta.url)`), instantiate and start service with SIGINT/SIGTERM handlers.
7. Verify build:
   - Run `npm run typecheck` (verify exit 0).
   - Run `npm run build:service` (verify `service/main.js` is generated cleanly).
8. Emit structured output to `.agents/run/task-centred-architecture/outputs/task-206-service-architecture.md`.
</steps>
<criteria>
- package.json declares openchamber.contributes.service cleanly.
- build:service script bundles service/main.ts into service/main.js via esbuild.
- service/types.ts and service/config.ts define clean typed contracts.
- typecheck and build pass cleanly with 0 errors.
</criteria>
<verification>
npm run typecheck && npm run build:service
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-206-service-architecture.md:
# Task 206 Output: Host Service Architecture
## Status: completed | failed
## Evidence:
- Typecheck output
- Build service output (bundle size, file generated)
## Changes:
- Modified files and key configurations added
## Verification:
- Exact commands executed
</output>
