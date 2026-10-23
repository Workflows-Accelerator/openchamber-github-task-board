# Task 207 Output: Lease Engine & CAS Pre-Flight
## Status: completed
## Evidence:
- Typecheck output:
```
> openchamber-github-task-board@1.2.1 typecheck
> tsc --noEmit
```
(Exit 0, 0 errors)

- Test run output for test/stage2b-pilot-coordinator.test.js:
```
TAP version 13
# Subtest: Part 1: Manifest declares openchamber.contributes.service host service
ok 1 - Part 1: Manifest declares openchamber.contributes.service host service
# Subtest: Part 1: loadCoordinatorConfig respects defaults and overrides
ok 2 - Part 1: loadCoordinatorConfig respects defaults and overrides
# Subtest: Part 2: computeIssueSha computes deterministic SHA-256 digests
ok 3 - Part 2: computeIssueSha computes deterministic SHA-256 digests
# Subtest: Part 2: computeIssueSha handles empty, null, and undefined values deterministically
ok 4 - Part 2: computeIssueSha handles empty, null, and undefined values deterministically
# Subtest: Part 2: verifyIssueCas verifies baseline hash match and detects divergence
ok 5 - Part 2: verifyIssueCas verifies baseline hash match and detects divergence
# Subtest: Part 2: CasManager utility class matches functional exports
ok 6 - Part 2: CasManager utility class matches functional exports
# Subtest: Part 3: acquireLease claims available task and records metadata
ok 7 - Part 3: acquireLease claims available task and records metadata
# Subtest: Part 3: Mutual Exclusion: second worker fails to acquire leased task
ok 8 - Part 3: Mutual Exclusion: second worker fails to acquire leased task
# Subtest: Part 3: Same owner can re-acquire and update active lease
ok 9 - Part 3: Same owner can re-acquire and update active lease
# Subtest: Part 4: renewHeartbeat extends lease expiration for owner
ok 10 - Part 4: renewHeartbeat extends lease expiration for owner
# Subtest: Part 4: TTL expiration allows reclamation by a new worker
ok 11 - Part 4: TTL expiration allows reclamation by a new worker
# Subtest: Part 5: releaseLease allows immediate takeover by another worker
ok 12 - Part 5: releaseLease allows immediate takeover by another worker
# Subtest: Part 5: pruneExpired removes only expired leases and leaves active ones
ok 13 - Part 5: pruneExpired removes only expired leases and leaves active ones
# Subtest: Part 6: Leases are atomically serialized to disk with version: 1 schema
ok 14 - Part 6: Leases are atomically serialized to disk with version: 1 schema
# Subtest: Part 6: Independent LeaseStore instances synchronize through disk file
ok 15 - Part 6: Independent LeaseStore instances synchronize through disk file
# Subtest: Part 6: Store recovers gracefully from corrupted disk file
ok 16 - Part 6: Store recovers gracefully from corrupted disk file
# Subtest: Part 6: Rapid concurrent writes do not race or corrupt lease file
ok 17 - Part 6: Rapid concurrent writes do not race or corrupt lease file
1..17
# tests 17
# suites 0
# pass 17
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

## Changes:
- `service/cas.ts`:
  - Implemented `computeIssueSha(body?: string | null): string` using Node.js `crypto.createHash('sha256')`. Handles null, undefined, and empty string deterministically.
  - Implemented `verifyIssueCas(currentBody: string | null | undefined, expectedSha: string): CasValidationResult` providing baseline matching, whitespace/case normalization, and divergence detection.
  - Implemented `CasManager` class providing static interface equivalents (`compute`, `verify`).
- `service/lease-store.ts`:
  - Implemented `LeaseStore` class managing operational single-writer task claims.
  - `init()`: creates or loads persistent JSON storage with `{ version: 1, leases: {} }`.
  - `acquireLease(repo, issueNumber, ownerId, bodySha, phase, ttlMs)`: enforces single-writer mutual exclusion, rejects second worker when active unexpired lease exists with conflict reason, permits same-owner re-acquisition and TTL extensions, and reclaims expired leases.
  - `renewHeartbeat(repo, issueNumber, ownerId, ttlExtensionMs)`: refreshes `heartbeatAt` and extends `expiresAt`, rejecting expired leases, wrong owners, or absent tasks.
  - `releaseLease(repo, issueNumber, ownerId)`: deletes lease when released by active owner and saves atomically.
  - `getLease(repo, issueNumber)`: retrieves unexpired lease or returns null.
  - `listActiveLeases()`: returns all unexpired active leases.
  - `pruneExpired()`: purges expired leases from memory and disk, returning count of pruned items.
  - `saveToDisk()`: atomic write via temporary file (`.${baseName}.tmp.${pid}.${timestamp}.${rand}`) and atomic POSIX rename (`fs.promises.rename`).
  - Serialized mutating operation queue (`runExclusive`) preventing in-process race conditions during concurrent claims or renewals.
  - `resolveLeaseStorageDir()` and `getDefaultLeasesFilePath()`: resolves `.openchamber-data/task-coordinator/leases.json` relative to `/workspace` or cwd.
- `test/stage2b-pilot-coordinator.test.js`:
  - 17 comprehensive unit and integration tests covering manifest service declaration, CAS SHA-256 calculation and verification, single-writer mutual exclusion, same-owner re-acquisition, heartbeat renewals, TTL expiration and reclamation, owner release, expired lease pruning, atomic disk persistence with `version: 1` schema, multi-instance synchronization through shared file, corrupted disk recovery, and rapid concurrent write serialization.

## Verification:
- `npm run typecheck && node --test test/stage2b-pilot-coordinator.test.js`: PASS (0 type errors, 17/17 tests passing).
