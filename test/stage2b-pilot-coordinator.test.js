import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { computeIssueSha, verifyIssueCas, CasManager } from '../service/cas.ts';
import { LeaseStore, getDefaultLeasesFilePath } from '../service/lease-store.ts';
import { loadCoordinatorConfig, resolveStorageDir } from '../service/config.ts';
import { isTaskEligibleForPilot, claimPilotTask, TaskClaimEngine } from '../service/task-claim.ts';
import { inspectSessionLiveness, SessionWatcher } from '../service/session-watcher.ts';
import { reconcileTaskState, CoordinatorReconciler } from '../service/reconciler.ts';
import { CoordinatorService } from '../service/main.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(here, '..');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');

function createTempDir(prefix = 'coordinator-test-') {
  const baseDir = fs.existsSync('/tmp/antigravity') ? '/tmp/antigravity' : os.tmpdir();
  return fs.mkdtempSync(path.join(baseDir, prefix));
}

// ============================================================================
// Part 1: Service Manifest & Config Contracts
// ============================================================================

test('Part 1: Manifest declares openchamber.contributes.service host service', () => {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  assert.ok(pkg.openchamber, 'package.json must contain openchamber configuration');
  assert.ok(pkg.openchamber.contributes, 'openchamber must define contributes');
  assert.ok(pkg.openchamber.contributes.service, 'contributes must define service');
  assert.equal(pkg.openchamber.contributes.service.entry, 'service/main.js');
  assert.equal(pkg.openchamber.contributes.service.runtime, 'host');
});

test('Part 1: loadCoordinatorConfig respects defaults and overrides', () => {
  const config = loadCoordinatorConfig({
    hostOrigin: 'http://localhost:4000',
    pollIntervalMs: 5000,
    leaseTtlMs: 30000,
    dryRun: true,
  });

  assert.equal(config.hostOrigin, 'http://localhost:4000');
  assert.equal(config.pollIntervalMs, 5000);
  assert.equal(config.leaseTtlMs, 30000);
  assert.equal(config.dryRun, true);
  assert.ok(config.storageDir.includes('task-coordinator'));
});

// ============================================================================
// Part 2: SHA-256 Compare-And-Swap (CAS) Validator
// ============================================================================

test('Part 2: computeIssueSha computes deterministic SHA-256 digests', () => {
  const bodyA = '## Acceptance Criteria\n- [ ] Task item 1\n- [ ] Task item 2';
  const bodyB = '## Acceptance Criteria\n- [ ] Task item 1\n- [ ] Task item 2';
  const bodyModified = '## Acceptance Criteria\n- [x] Task item 1\n- [ ] Task item 2';

  const shaA = computeIssueSha(bodyA);
  const shaB = computeIssueSha(bodyB);
  const shaModified = computeIssueSha(bodyModified);

  assert.equal(typeof shaA, 'string');
  assert.equal(shaA.length, 64, 'SHA-256 hex digest should be 64 characters');
  assert.equal(shaA, shaB, 'Identical contents must produce identical hashes');
  assert.notEqual(shaA, shaModified, 'Modified content must produce divergent hash');

  // Whitespace sensitivity
  const shaWhitespace = computeIssueSha(bodyA + ' ');
  assert.notEqual(shaA, shaWhitespace, 'Appended whitespace must change SHA-256 hash');
});

test('Part 2: computeIssueSha handles empty, null, and undefined values deterministically', () => {
  const shaEmpty = computeIssueSha('');
  const shaNull = computeIssueSha(null);
  const shaUndefined = computeIssueSha(undefined);

  // SHA-256 of empty string is e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
  const expectedEmptySha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  assert.equal(shaEmpty, expectedEmptySha);
  assert.equal(shaNull, expectedEmptySha);
  assert.equal(shaUndefined, expectedEmptySha);
});

test('Part 2: computeIssueSha normalizes CRLF and LF newlines to identical digests (ADV-2B-02)', () => {
  const lfBody = 'Line 1\nLine 2\nLine 3';
  const crlfBody = 'Line 1\r\nLine 2\r\nLine 3';

  assert.equal(computeIssueSha(crlfBody), computeIssueSha(lfBody));

  const shaLf = computeIssueSha(lfBody);
  const verifyResult = verifyIssueCas(crlfBody, shaLf);
  assert.equal(verifyResult.match, true);
  assert.equal(verifyResult.currentSha, shaLf);
});

test('Part 2: computeIssueSha normalizes bare CR and mixed line endings to LF digests (ADV-2C-04)', () => {
  const lfBody = 'Line 1\nLine 2\nLine 3';
  const bareCrBody = 'Line 1\rLine 2\rLine 3';
  const mixedLfBody = 'Line 1\nLine 2\nLine 3\nLine 4';
  const mixedBody = 'Line 1\r\nLine 2\rLine 3\nLine 4';

  assert.equal(computeIssueSha(bareCrBody), computeIssueSha(lfBody), 'bare CR bodies must digest equal to LF bodies');
  assert.equal(computeIssueSha(mixedBody), computeIssueSha(mixedLfBody), 'mixed line endings must digest equal to LF bodies');

  const shaLf = computeIssueSha(lfBody);
  assert.equal(verifyIssueCas(bareCrBody, shaLf).match, true);
  assert.equal(verifyIssueCas(mixedBody, computeIssueSha(mixedLfBody)).match, true);

  // Deliberate: trailing whitespace is NOT normalized. A false match there could
  // clobber a real edit; a false CAS conflict aborts safely instead.
  assert.notEqual(computeIssueSha('Line 2   \n'), computeIssueSha('Line 2\n'));
});

test('Part 2: verifyIssueCas verifies baseline hash match and detects divergence', () => {
  const originalBody = 'Task definition v1\nLine 2';
  const originalSha = computeIssueSha(originalBody);

  // Case 1: Matching baseline
  const matchResult = verifyIssueCas(originalBody, originalSha);
  assert.equal(matchResult.match, true);
  assert.equal(matchResult.currentSha, originalSha);

  // Case 2: Matching with uppercase expected hash or outer whitespace
  const normalizedMatchResult = verifyIssueCas(originalBody, `  ${originalSha.toUpperCase()}  `);
  assert.equal(normalizedMatchResult.match, true);

  // Case 3: Remote body drifted
  const modifiedBody = 'Task definition v1\nLine 2 - edited concurrently by another agent';
  const conflictResult = verifyIssueCas(modifiedBody, originalSha);
  assert.equal(conflictResult.match, false);
  assert.notEqual(conflictResult.currentSha, originalSha);
  assert.equal(conflictResult.currentSha, computeIssueSha(modifiedBody));
});

test('Part 2: CasManager utility class matches functional exports', () => {
  const body = 'Testing CasManager wrapper';
  const sha = CasManager.compute(body);
  assert.equal(sha, computeIssueSha(body));

  const verify = CasManager.verify(body, sha);
  assert.equal(verify.match, true);
  assert.equal(verify.currentSha, sha);
});

// ============================================================================
// Part 3: Single-Writer Lease Acquisition & Mutual Exclusion
// ============================================================================

test('Part 3: acquireLease claims available task and records metadata', async () => {
  const tempDir = createTempDir('lease-acquire-');
  const filePath = path.join(tempDir, 'leases.json');
  const store = new LeaseStore(filePath, 60000);
  await store.init();

  const repo = 'Workflows-Accelerator/test-repo';
  const issueNumber = 101;
  const ownerId = 'worker-alpha';
  const bodySha = computeIssueSha('Initial issue body');

  const beforeClaim = Date.now();
  const result = await store.acquireLease(repo, issueNumber, ownerId, bodySha, 'execution', 5000);
  const afterClaim = Date.now();

  assert.equal(result.acquired, true);
  assert.ok(result.lease);
  assert.equal(result.lease.issueNumber, 101);
  assert.equal(result.lease.repo, repo);
  assert.equal(result.lease.ownerId, ownerId);
  assert.equal(result.lease.claimedSha, bodySha);
  assert.equal(result.lease.phase, 'execution');
  assert.ok(result.lease.claimedAt >= beforeClaim && result.lease.claimedAt <= afterClaim);
  assert.ok(result.lease.heartbeatAt >= beforeClaim && result.lease.heartbeatAt <= afterClaim);
  assert.equal(result.lease.expiresAt, result.lease.claimedAt + 5000);

  // Verify getLease and listActiveLeases
  const fetched = store.getLease(repo, issueNumber);
  assert.ok(fetched);
  assert.equal(fetched.ownerId, ownerId);

  const active = store.listActiveLeases();
  assert.equal(active.length, 1);
  assert.equal(active[0].issueNumber, 101);

  // Non-existent task returns null
  assert.equal(store.getLease(repo, 999), null);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Part 3: Mutual Exclusion: second worker fails to acquire leased task', async () => {
  const tempDir = createTempDir('lease-mutex-');
  const filePath = path.join(tempDir, 'leases.json');
  const store = new LeaseStore(filePath, 30000);
  await store.init();

  const repo = 'Workflows-Accelerator/test-repo';
  const issueNumber = 202;
  const worker1 = 'worker-1';
  const worker2 = 'worker-2';

  // Worker 1 acquires task
  const claim1 = await store.acquireLease(repo, issueNumber, worker1, 'sha-1', 'exploration');
  assert.equal(claim1.acquired, true);

  // Worker 2 attempts to acquire the same task while lease is active
  const claim2 = await store.acquireLease(repo, issueNumber, worker2, 'sha-2', 'execution');
  assert.equal(claim2.acquired, false);
  assert.equal(claim2.conflictReason, `Task is currently leased by ${worker1}`);
  assert.equal(claim2.lease, undefined);

  // Active lease remains owned by worker 1
  const currentLease = store.getLease(repo, issueNumber);
  assert.ok(currentLease);
  assert.equal(currentLease.ownerId, worker1);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Part 3: Same owner can re-acquire and update active lease', async () => {
  const tempDir = createTempDir('lease-reacquire-');
  const filePath = path.join(tempDir, 'leases.json');
  const store = new LeaseStore(filePath, 20000);
  await store.init();

  const repo = 'test/repo';
  const issueNumber = 303;
  const owner = 'worker-same';

  const firstClaim = await store.acquireLease(repo, issueNumber, owner, 'sha-initial', 'exploration', 10000);
  assert.equal(firstClaim.acquired, true);
  const initialClaimedAt = firstClaim.lease?.claimedAt;

  // Small delay
  await new Promise((r) => setTimeout(r, 20));

  // Re-acquire by same owner with updated phase and new SHA
  const updateClaim = await store.acquireLease(repo, issueNumber, owner, 'sha-updated', 'execution', 15000);
  assert.equal(updateClaim.acquired, true);
  assert.equal(updateClaim.lease?.claimedAt, initialClaimedAt, 'Original claimedAt must be preserved for same owner');
  assert.equal(updateClaim.lease?.phase, 'execution');
  assert.equal(updateClaim.lease?.claimedSha, 'sha-updated');
  assert.ok(updateClaim.lease && updateClaim.lease.heartbeatAt > (firstClaim.lease?.heartbeatAt || 0));

  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ============================================================================
// Part 4: Heartbeat Renewal & Expiration Semantics
// ============================================================================

test('Part 4: renewHeartbeat extends lease expiration for owner', async () => {
  const tempDir = createTempDir('lease-heartbeat-');
  const filePath = path.join(tempDir, 'leases.json');
  const store = new LeaseStore(filePath, 10000);
  await store.init();

  const repo = 'test/repo';
  const issueNumber = 404;
  const owner = 'heartbeat-worker';

  const claim = await store.acquireLease(repo, issueNumber, owner, 'sha-hb', 'exploration', 5000);
  assert.equal(claim.acquired, true);
  const initialExpiresAt = claim.lease?.expiresAt || 0;
  const initialHeartbeatAt = claim.lease?.heartbeatAt || 0;

  await new Promise((r) => setTimeout(r, 25));

  // Successful renewal with custom extension
  const renewed = await store.renewHeartbeat(repo, issueNumber, owner, 12000);
  assert.equal(renewed, true);

  const updated = store.getLease(repo, issueNumber);
  assert.ok(updated);
  assert.ok(updated.heartbeatAt > initialHeartbeatAt, 'heartbeatAt should have moved forward');
  assert.ok(updated.expiresAt > initialExpiresAt, 'expiresAt should have extended');

  // Renewal fails if called by another worker
  const wrongWorkerRenew = await store.renewHeartbeat(repo, issueNumber, 'imposter-worker');
  assert.equal(wrongWorkerRenew, false);

  // Renewal fails for non-existent task
  const nonExistentRenew = await store.renewHeartbeat(repo, 9999, owner);
  assert.equal(nonExistentRenew, false);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Part 4: TTL expiration allows reclamation by a new worker', async () => {
  const tempDir = createTempDir('lease-expiry-');
  const filePath = path.join(tempDir, 'leases.json');
  const store = new LeaseStore(filePath, 100); // 100ms TTL
  await store.init();

  const repo = 'test/repo';
  const issueNumber = 505;
  const worker1 = 'worker-original';
  const worker2 = 'worker-successor';

  // Worker 1 acquires with 80ms TTL
  const claim1 = await store.acquireLease(repo, issueNumber, worker1, 'sha-1', 'exploration', 80);
  assert.equal(claim1.acquired, true);

  // Immediate attempt by worker 2 is rejected
  const prematureClaim = await store.acquireLease(repo, issueNumber, worker2, 'sha-2', 'execution');
  assert.equal(prematureClaim.acquired, false);

  // Wait for TTL expiration (110ms > 80ms)
  await new Promise((r) => setTimeout(r, 110));

  // Expired lease is no longer active
  assert.equal(store.getLease(repo, issueNumber), null);
  assert.equal(store.listActiveLeases().length, 0);

  // Worker 1 cannot renew expired lease
  const renewExpired = await store.renewHeartbeat(repo, issueNumber, worker1);
  assert.equal(renewExpired, false);

  // Worker 2 successfully reclaims the expired lease
  const claim2 = await store.acquireLease(repo, issueNumber, worker2, 'sha-2', 'execution', 5000);
  assert.equal(claim2.acquired, true);
  assert.ok(claim2.lease);
  assert.equal(claim2.lease.ownerId, worker2);
  assert.equal(claim2.lease.phase, 'execution');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ============================================================================
// Part 5: Lease Release & Pruning
// ============================================================================

test('Part 5: releaseLease allows immediate takeover by another worker', async () => {
  const tempDir = createTempDir('lease-release-');
  const filePath = path.join(tempDir, 'leases.json');
  const store = new LeaseStore(filePath, 60000);
  await store.init();

  const repo = 'test/repo';
  const issueNumber = 606;
  const workerA = 'worker-a';
  const workerB = 'worker-b';

  await store.acquireLease(repo, issueNumber, workerA, 'sha', 'exploration');

  // Unauthorized release fails
  const unauthorized = await store.releaseLease(repo, issueNumber, workerB);
  assert.equal(unauthorized, false);
  assert.ok(store.getLease(repo, issueNumber));

  // Authorized release succeeds
  const authorized = await store.releaseLease(repo, issueNumber, workerA);
  assert.equal(authorized, true);
  assert.equal(store.getLease(repo, issueNumber), null);

  // Worker B can immediately acquire now that it is released
  const claimB = await store.acquireLease(repo, issueNumber, workerB, 'sha-b', 'execution');
  assert.equal(claimB.acquired, true);
  assert.equal(claimB.lease?.ownerId, workerB);

  // Re-releasing non-existent/released task returns false
  const doubleRelease = await store.releaseLease(repo, issueNumber, workerA);
  assert.equal(doubleRelease, false);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Part 5: pruneExpired removes only expired leases and leaves active ones', async () => {
  const tempDir = createTempDir('lease-prune-');
  const filePath = path.join(tempDir, 'leases.json');
  const store = new LeaseStore(filePath, 60000);
  await store.init();

  const repo = 'test/repo';

  // Task 1: active lease (50s TTL)
  await store.acquireLease(repo, 701, 'worker-active', 'sha1', 'execution', 50000);
  // Task 2: expired lease (40ms TTL)
  await store.acquireLease(repo, 702, 'worker-expired-1', 'sha2', 'exploration', 40);
  // Task 3: expired lease (40ms TTL)
  await store.acquireLease(repo, 703, 'worker-expired-2', 'sha3', 'exploration', 40);

  await new Promise((r) => setTimeout(r, 60));

  const prunedCount = await store.pruneExpired();
  assert.equal(prunedCount, 2, 'Should have pruned exactly 2 expired leases');

  const activeLeases = store.listActiveLeases();
  assert.equal(activeLeases.length, 1);
  assert.equal(activeLeases[0].issueNumber, 701);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ============================================================================
// Part 6: Atomic Disk Persistence & Multi-Worker Coordination
// ============================================================================

test('Part 6: Leases are atomically serialized to disk with version: 1 schema', async () => {
  const tempDir = createTempDir('lease-disk-');
  const filePath = path.join(tempDir, 'leases.json');
  const store = new LeaseStore(filePath, 60000);
  await store.init();

  assert.ok(fs.existsSync(filePath), 'leases.json should exist after init');
  const initialContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(initialContent.version, 1);
  assert.deepEqual(initialContent.leases, {});

  // Acquire lease and inspect file on disk
  await store.acquireLease('org/repo', 801, 'worker-disk', 'sha-disk', 'exploration');

  const savedContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(savedContent.version, 1);
  assert.ok(savedContent.leases['org/repo#801']);
  assert.equal(savedContent.leases['org/repo#801'].ownerId, 'worker-disk');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Part 6: Independent LeaseStore instances synchronize through disk file', async () => {
  const tempDir = createTempDir('lease-multi-instance-');
  const filePath = path.join(tempDir, 'leases.json');

  const storeInstance1 = new LeaseStore(filePath, 60000);
  const storeInstance2 = new LeaseStore(filePath, 60000);
  await storeInstance1.init();

  // Instance 1 claims task 901
  const claim1 = await storeInstance1.acquireLease('org/repo', 901, 'process-1', 'sha-inst', 'execution');
  assert.equal(claim1.acquired, true);

  // Instance 2 attempts to claim without explicit prior init - it reads disk during acquire
  const claim2 = await storeInstance2.acquireLease('org/repo', 901, 'process-2', 'sha-inst', 'execution');
  assert.equal(claim2.acquired, false);
  assert.equal(claim2.conflictReason, 'Task is currently leased by process-1');

  // Instance 1 releases task 901
  await storeInstance1.releaseLease('org/repo', 901, 'process-1');

  // Instance 2 can now claim task 901
  const claim2AfterRelease = await storeInstance2.acquireLease('org/repo', 901, 'process-2', 'sha-inst', 'execution');
  assert.equal(claim2AfterRelease.acquired, true);
  assert.equal(claim2AfterRelease.lease?.ownerId, 'process-2');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Part 6: Store recovers gracefully from corrupted disk file', async () => {
  const tempDir = createTempDir('lease-corrupt-');
  const filePath = path.join(tempDir, 'leases.json');

  // Write invalid corrupted JSON
  fs.writeFileSync(filePath, '{ corrupted json: not valid ...', 'utf8');

  const store = new LeaseStore(filePath, 60000);
  // init() must not throw on corrupted file; it should safely reset
  await store.init();

  assert.equal(store.listActiveLeases().length, 0);

  // Store can still acquire and write valid JSON
  const claim = await store.acquireLease('org/repo', 1001, 'resilient-worker', 'sha', 'execution');
  assert.equal(claim.acquired, true);

  const recoveredData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(recoveredData.version, 1);
  assert.ok(recoveredData.leases['org/repo#1001']);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Part 6: Store backs up corrupted disk file to .corrupted.<timestamp>.bak on init (ADV-2B-06)', async () => {
  const tempDir = createTempDir('lease-corrupt-bak-');
  const filePath = path.join(tempDir, 'leases.json');
  const corruptedContent = '{ corrupted json syntax error';

  fs.writeFileSync(filePath, corruptedContent, 'utf8');

  const store = new LeaseStore(filePath, 60000);
  await store.init();

  const files = fs.readdirSync(tempDir);
  const bakFiles = files.filter((f) => f.startsWith('leases.json.corrupted.') && f.endsWith('.bak'));
  assert.equal(bakFiles.length, 1, 'Should create exactly one .corrupted.<timestamp>.bak backup file');

  const backupContent = fs.readFileSync(path.join(tempDir, bakFiles[0]), 'utf8');
  assert.equal(backupContent, corruptedContent, 'Backup file must preserve corrupted contents');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Part 6: Store backs up valid-JSON-but-wrong-shape files before reset (ADV-2C-03)', async () => {
  const wrongShapeVariants = ['null', '42', '{"leases":null}'];

  for (const variant of wrongShapeVariants) {
    const tempDir = createTempDir('lease-wrong-shape-');
    const filePath = path.join(tempDir, 'leases.json');
    fs.writeFileSync(filePath, variant, 'utf8');

    const store = new LeaseStore(filePath, 60000);
    await store.init();

    const files = fs.readdirSync(tempDir);
    const bakFiles = files.filter((f) => f.startsWith('leases.json.corrupted.') && f.endsWith('.bak'));
    assert.equal(bakFiles.length, 1, `wrong-shape payload ${variant} must be backed up before reset`);
    assert.equal(fs.readFileSync(path.join(tempDir, bakFiles[0]), 'utf8'), variant, 'backup must preserve the wrong-shape payload');

    const onDisk = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(onDisk.version, 1);
    assert.deepEqual(onDisk.leases, {});

    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Part 6: Store backs up prior file on read errors before resetting state (ADV-2C-03)', async () => {
  const tempDir = createTempDir('lease-read-error-');
  const filePath = path.join(tempDir, 'leases.json');
  const originalContent = JSON.stringify(
    {
      version: 1,
      leases: {
        'org/repo#1': {
          issueNumber: 1,
          repo: 'org/repo',
          ownerId: 'worker-1',
          claimedAt: 1000,
          expiresAt: Date.now() + 60000,
          heartbeatAt: 1000,
          claimedSha: 'sha',
          phase: 'execution',
        },
      },
    },
    null,
    2
  );
  fs.writeFileSync(filePath, originalContent, 'utf8');

  // Simulate a transient read error (EIO) on the lease file
  const originalReadFile = fs.promises.readFile;
  fs.promises.readFile = async () => {
    const err = new Error('simulated EIO');
    err.code = 'EIO';
    throw err;
  };

  try {
    const store = new LeaseStore(filePath, 60000);
    await store.init();
  } finally {
    fs.promises.readFile = originalReadFile;
  }

  const files = fs.readdirSync(tempDir);
  const bakFiles = files.filter((f) => f.startsWith('leases.json.corrupted.') && f.endsWith('.bak'));
  assert.equal(bakFiles.length, 1, 'read-error load must back up prior state before any reset');
  assert.equal(fs.readFileSync(path.join(tempDir, bakFiles[0]), 'utf8'), originalContent, 'backup must preserve the unread prior state');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Part 6: Store never destroys prior state when the backup itself fails (ADV-2C-07)', async () => {
  const tempDir = createTempDir('lease-backup-fail-');
  const filePath = path.join(tempDir, 'leases.json');
  const corruptedContent = '{ corrupted json and backup will fail';
  fs.writeFileSync(filePath, corruptedContent, 'utf8');

  const originalCopyFile = fs.promises.copyFile;
  const originalConsoleError = console.error;
  const logged = [];
  fs.promises.copyFile = async () => {
    const err = new Error('simulated EACCES');
    err.code = 'EACCES';
    throw err;
  };
  console.error = (...args) => {
    logged.push(args.map((a) => (typeof a === 'string' ? a : String(a))).join(' '));
  };

  try {
    const store = new LeaseStore(filePath, 60000);
    // init() must not throw or crash-loop when the backup fails
    await store.init();

    assert.equal(store.listActiveLeases().length, 0, 'operates on empty in-memory state');
    assert.equal(fs.readFileSync(filePath, 'utf8'), corruptedContent, 'prior file must remain untouched when backup fails');
    assert.equal(fs.readdirSync(tempDir).filter((f) => f.endsWith('.bak')).length, 0, 'no backup should be claimed on failed backup');
    assert.ok(
      logged.some((line) => line.includes('Failed to back up prior lease state')),
      'backup failure must be logged'
    );

    // While prior state is unreadable and unbacked, no destructive write may happen
    await assert.rejects(
      () => store.acquireLease('org/repo', 1, 'worker-1', 'sha', 'execution'),
      /Refusing to overwrite/
    );
    assert.equal(fs.readFileSync(filePath, 'utf8'), corruptedContent, 'lease file must stay untouched after refused write');
  } finally {
    fs.promises.copyFile = originalCopyFile;
    console.error = originalConsoleError;
  }

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Part 6: CoordinatorService.start() initializes lease store and preserves corrupted state forensically (ADV-2C-03)', async () => {
  const tempDir = createTempDir('service-init-');
  const filePath = path.join(tempDir, 'leases.json');
  const corruptedContent = '{ service level corruption';
  fs.writeFileSync(filePath, corruptedContent, 'utf8');

  const store = new LeaseStore(filePath, 60000);
  const service = new CoordinatorService(
    { storageDir: tempDir, pollIntervalMs: 600000, leaseTtlMs: 60000, dryRun: true },
    store
  );

  await service.start();
  await service.stop();

  const files = fs.readdirSync(tempDir);
  const bakFiles = files.filter((f) => f.startsWith('leases.json.corrupted.') && f.endsWith('.bak'));
  assert.equal(bakFiles.length, 1, 'start() must load the lease store via init() and back up corrupted state');
  assert.equal(fs.readFileSync(path.join(tempDir, bakFiles[0]), 'utf8'), corruptedContent, 'backup must preserve corrupted contents');

  const onDisk = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(onDisk.version, 1);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Part 6: Rapid concurrent writes do not race or corrupt lease file', async () => {
  const tempDir = createTempDir('lease-concurrency-');
  const filePath = path.join(tempDir, 'leases.json');
  const store = new LeaseStore(filePath, 60000);
  await store.init();

  const repo = 'org/concurrency-test';
  const issueCount = 20;

  // Fire 20 acquisitions concurrently for distinct issues
  const promises = [];
  for (let i = 1; i <= issueCount; i++) {
    promises.push(store.acquireLease(repo, i, `worker-${i}`, `sha-${i}`, 'execution'));
  }

  const results = await Promise.all(promises);
  for (const res of results) {
    assert.equal(res.acquired, true);
  }

  // Verify all 20 leases were recorded on disk
  const onDisk = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(Object.keys(onDisk.leases).length, issueCount);

  // Verify listActiveLeases has all 20
  assert.equal(store.listActiveLeases().length, issueCount);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ============================================================================
// Part 7: Opt-in Task Claiming Engine & Eligibility Filter
// ============================================================================

test('Part 7: isTaskEligibleForPilot correctly identifies eligible tasks with explicit opt-in (ADV-2B-04)', () => {
  // 1. Explicit coordinator:pilot label
  assert.equal(
    isTaskEligibleForPilot({ labels: ['coordinator:pilot'], v2Metadata: { phase: 'planning', attention: 'none' } }),
    true
  );

  // 2. Object format labels
  assert.equal(
    isTaskEligibleForPilot({ labels: [{ name: 'coordinator:pilot' }] }),
    true
  );

  // 3. Explicit pilot label 'pilot'
  assert.equal(
    isTaskEligibleForPilot({ labels: ['pilot'] }),
    true
  );

  // 4. Task in exploration phase with explicit v2 opt-in and attention: 'none'
  assert.equal(
    isTaskEligibleForPilot({ v2Metadata: { phase: 'exploration', attention: 'none', isExplicitV2: true } }),
    true
  );

  // 5. Task in execution phase with explicit v2 opt-in and attention: 'none'
  assert.equal(
    isTaskEligibleForPilot({ v2Metadata: { phase: 'execution', attention: 'none', isExplicitV2: true } }),
    true
  );
});

test('Part 7: isTaskEligibleForPilot strictly rejects legacy and un-migrated tasks (ADV-2B-04)', () => {
  // Legacy task with only status:in-progress
  const legacyTask = {
    number: 99,
    labels: ['status:in-progress'],
    phase: 'execution',
    v2Metadata: { phase: 'execution', attention: 'none', isExplicitV2: false },
  };
  assert.equal(isTaskEligibleForPilot(legacyTask), false);

  // Unlabeled task without explicit v2 flag
  assert.equal(
    isTaskEligibleForPilot({ v2Metadata: { phase: 'execution', attention: 'none' } }),
    false
  );

  // Bare phase property without v2Metadata wrapper
  assert.equal(
    isTaskEligibleForPilot({ phase: 'execution', attention: 'none' }),
    false
  );
});

test('Part 7: isTaskEligibleForPilot strictly rejects closed, terminal, non-pilot, or attention-demanding tasks', () => {
  // Closed issues
  assert.equal(isTaskEligibleForPilot({ state: 'closed' }), false);
  assert.equal(isTaskEligibleForPilot({ closed: true }), false);
  assert.equal(isTaskEligibleForPilot({ closed_at: '2026-10-23T00:00:00Z' }), false);
  assert.equal(isTaskEligibleForPilot({ labels: ['coordinator:pilot'], state: 'closed' }), false);

  // Done or archive phases
  assert.equal(isTaskEligibleForPilot({ v2Metadata: { phase: 'done', attention: 'none' } }), false);
  assert.equal(isTaskEligibleForPilot({ labels: ['coordinator:pilot'], v2Metadata: { phase: 'done' } }), false);
  assert.equal(isTaskEligibleForPilot({ v2Metadata: { phase: 'archive', attention: 'none' } }), false);

  // Active attention required (must wait for human)
  assert.equal(isTaskEligibleForPilot({ v2Metadata: { phase: 'execution', attention: 'needs-decision' } }), false);
  assert.equal(isTaskEligibleForPilot({ v2Metadata: { phase: 'exploration', attention: 'needs-permission' } }), false);
  assert.equal(isTaskEligibleForPilot({ v2Metadata: { phase: 'execution', attention: 'needs-review' } }), false);

  // Unlabeled tasks in other phases (draft, planning, verification)
  assert.equal(isTaskEligibleForPilot({ labels: ['feature'], v2Metadata: { phase: 'planning', attention: 'none' } }), false);
  assert.equal(isTaskEligibleForPilot({ labels: [], v2Metadata: { phase: 'draft', attention: 'none' } }), false);
  assert.equal(isTaskEligibleForPilot({ labels: [], v2Metadata: { phase: 'verification', attention: 'none' } }), false);

  // Malformed or empty input
  assert.equal(isTaskEligibleForPilot(null), false);
  assert.equal(isTaskEligibleForPilot(undefined), false);
  assert.equal(isTaskEligibleForPilot({}), false);
});

test('Part 7: claimPilotTask verifies eligibility, computes baseline SHA, and acquires lease', async () => {
  const tempDir = createTempDir('claim-success-');
  const filePath = path.join(tempDir, 'leases.json');
  const store = new LeaseStore(filePath, 30000);
  await store.init();

  const repo = 'test-org/test-repo';
  const issue = {
    number: 101,
    title: 'Implement pilot claiming',
    body: '## Acceptance Criteria\n- [ ] Task 1\n- [ ] Task 2',
    v2Metadata: {
      phase: 'execution',
      attention: 'none',
      isExplicitV2: true,
    },
  };

  const expectedSha = computeIssueSha(issue.body);
  const result = await claimPilotTask(issue, repo, store, 'worker-stage2b');

  assert.equal(result.acquired, true);
  assert.ok(result.lease);
  assert.equal(result.lease.issueNumber, 101);
  assert.equal(result.lease.repo, repo);
  assert.equal(result.lease.ownerId, 'worker-stage2b');
  assert.equal(result.lease.claimedSha, expectedSha);
  assert.equal(result.lease.phase, 'execution');

  // Also verify TaskClaimEngine class wrapper
  const engine = new TaskClaimEngine(store, 'worker-engine', 20000);
  assert.equal(engine.isEligible(issue), true);

  // Trying to claim with engine under different worker fails because already leased by worker-stage2b
  const conflictResult = await engine.claim(issue, repo);
  assert.equal(conflictResult.acquired, false);
  assert.ok(conflictResult.conflictReason?.includes('currently leased by worker-stage2b'));

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Part 7: claimPilotTask rejects ineligible tasks and handles invalid input', async () => {
  const tempDir = createTempDir('claim-reject-');
  const filePath = path.join(tempDir, 'leases.json');
  const store = new LeaseStore(filePath, 30000);
  await store.init();

  const repo = 'test-org/test-repo';

  // Ineligible issue (closed)
  const closedIssue = {
    number: 102,
    body: 'Closed task',
    state: 'closed',
    labels: ['coordinator:pilot'],
  };
  const closedResult = await claimPilotTask(closedIssue, repo, store, 'worker-1');
  assert.equal(closedResult.acquired, false);
  assert.ok(closedResult.conflictReason?.includes('not eligible'));

  // Invalid issue without number
  const noNumIssue = {
    body: 'No number',
    v2Metadata: { phase: 'execution', attention: 'none' },
  };
  const noNumResult = await claimPilotTask(noNumIssue, repo, store, 'worker-1');
  assert.equal(noNumResult.acquired, false);

  // Null input
  const nullResult = await claimPilotTask(null, repo, store, 'worker-1');
  assert.equal(nullResult.acquired, false);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ============================================================================
// Part 8: Session Liveness Watcher
// ============================================================================

test('Part 8: inspectSessionLiveness accurately classifies running sessions', () => {
  // Explicit status
  const res1 = inspectSessionLiveness({ status: 'running' });
  assert.equal(res1.state, 'running');

  // Activity field
  const res2 = inspectSessionLiveness({ activity: 'running' });
  assert.equal(res2.state, 'running');

  // Busy flag
  const res3 = inspectSessionLiveness({ busy: true });
  assert.equal(res3.state, 'running');

  // Direct string
  const res4 = inspectSessionLiveness('running');
  assert.equal(res4.state, 'running');
});

test('Part 8: inspectSessionLiveness accurately classifies blocked-permission sessions', () => {
  // Pending permissions array
  const res1 = inspectSessionLiveness({ pendingPermissions: ['tools.execute', 'tools.shell'] });
  assert.equal(res1.state, 'blocked-permission');
  assert.ok(res1.details?.includes('tools.execute'));

  // Activity waiting-permission
  const res2 = inspectSessionLiveness({ activity: 'waiting-permission' });
  assert.equal(res2.state, 'blocked-permission');

  // Waiting flag
  const res3 = inspectSessionLiveness({ waitingForPermission: true });
  assert.equal(res3.state, 'blocked-permission');

  // Direct string
  const res4 = inspectSessionLiveness('blocked-permission');
  assert.equal(res4.state, 'blocked-permission');
});

test('Part 8: inspectSessionLiveness accurately classifies blocked-question sessions', () => {
  // Pending questions array
  const res1 = inspectSessionLiveness({ pendingQuestions: ['Should we use PostgreSQL or SQLite?'] });
  assert.equal(res1.state, 'blocked-question');
  assert.ok(res1.details?.includes('PostgreSQL'));

  // Activity waiting-question
  const res2 = inspectSessionLiveness({ activity: 'waiting-question' });
  assert.equal(res2.state, 'blocked-question');

  // Waiting flag
  const res3 = inspectSessionLiveness({ waitingForQuestion: true });
  assert.equal(res3.state, 'blocked-question');

  // Direct string
  const res4 = inspectSessionLiveness('blocked-question');
  assert.equal(res4.state, 'blocked-question');
});

test('Part 8: inspectSessionLiveness accurately classifies completed sessions', () => {
  // Status completed
  const res1 = inspectSessionLiveness({ status: 'completed' });
  assert.equal(res1.state, 'completed');

  // Exit code 0
  const res2 = inspectSessionLiveness({ exitCode: 0 });
  assert.equal(res2.state, 'completed');

  // Completed flag
  const res3 = inspectSessionLiveness({ completed: true });
  assert.equal(res3.state, 'completed');

  // Direct string
  const res4 = inspectSessionLiveness('completed');
  assert.equal(res4.state, 'completed');
});

test('Part 8: inspectSessionLiveness accurately classifies failed sessions', () => {
  // Error property
  const res1 = inspectSessionLiveness({ error: 'Process exited abnormally: ENOMEM' });
  assert.equal(res1.state, 'failed');
  assert.ok(res1.details?.includes('ENOMEM'));

  // Non-zero exit code
  const res2 = inspectSessionLiveness({ exitCode: 1 });
  assert.equal(res2.state, 'failed');
  assert.ok(res2.details?.includes('1'));

  // Status failed
  const res3 = inspectSessionLiveness({ status: 'failed', reason: 'Timeout' });
  assert.equal(res3.state, 'failed');

  // Direct string
  const res4 = inspectSessionLiveness('failed');
  assert.equal(res4.state, 'failed');
});

test('Part 8: inspectSessionLiveness handles idle, empty, and null sessions gracefully', () => {
  assert.equal(inspectSessionLiveness(null).state, 'idle');
  assert.equal(inspectSessionLiveness(undefined).state, 'idle');
  assert.equal(inspectSessionLiveness({}).state, 'idle');
  assert.equal(inspectSessionLiveness({ status: 'idle' }).state, 'idle');

  // Verify SessionWatcher wrapper class
  const watcher = new SessionWatcher();
  const info = watcher.inspectSession({ busy: true });
  assert.equal(info.state, 'running');
});

// ============================================================================
// Part 9: Coordinator Lifecycle Reconciler
// ============================================================================

test('Part 9: reconcileTaskState escalates blocked-permission session to needs-permission', () => {
  const issue = { number: 201, v2Metadata: { phase: 'execution', attention: 'none' } };
  const session = { pendingPermissions: ['tools.execute'] };

  const result = reconcileTaskState(issue, session);

  assert.equal(result.action, 'escalate');
  assert.equal(result.targetAttention, 'needs-permission');
  assert.equal(result.reason, 'Linked session blocked on tool permissions');
});

test('Part 9: reconcileTaskState escalates blocked-question session to needs-decision', () => {
  const issue = { number: 202, v2Metadata: { phase: 'execution', attention: 'none' } };
  const session = { pendingQuestions: ['Do you want to run migration?'] };

  const result = reconcileTaskState(issue, session);

  assert.equal(result.action, 'escalate');
  assert.equal(result.targetAttention, 'needs-decision');
  assert.equal(result.reason, 'Linked session waiting for human response');
});

test('Part 9: reconcileTaskState advances completed exploration session to planning with needs-review', () => {
  const issue = { number: 203, v2Metadata: { phase: 'exploration', attention: 'none' } };
  const session = { status: 'completed' };

  const result = reconcileTaskState(issue, session);

  assert.equal(result.action, 'advance');
  assert.equal(result.targetPhase, 'planning');
  assert.equal(result.targetAttention, 'needs-review');
  assert.equal(result.reason, 'Worker completed execution cleanly');
});

test('Part 9: reconcileTaskState advances completed execution session to verification with needs-review', () => {
  const issue = { number: 204, v2Metadata: { phase: 'execution', attention: 'none' } };
  const session = { status: 'completed' };

  const result = reconcileTaskState(issue, session);

  assert.equal(result.action, 'advance');
  assert.equal(result.targetPhase, 'verification');
  assert.equal(result.targetAttention, 'needs-review');
  assert.equal(result.reason, 'Worker completed execution cleanly');
});

test('Part 9: reconcileTaskState falls back to TaskLease phase when the issue carries no phase (ADV-2C-02 fallback)', () => {
  const issue = { number: 205, v2Metadata: { attention: 'none' } };
  const session = { status: 'completed' };
  const lease = {
    issueNumber: 205,
    repo: 'test/repo',
    ownerId: 'w1',
    claimedAt: 1000,
    expiresAt: 5000,
    heartbeatAt: 1000,
    claimedSha: 'sha',
    phase: 'execution',
  };

  const result = reconcileTaskState(issue, session, lease);

  assert.equal(result.action, 'advance');
  assert.equal(result.targetPhase, 'verification');
  assert.equal(result.targetAttention, 'needs-review');
});

test('Part 9: reconcileTaskState escalates failed session to needs-decision with failure details', () => {
  const issue = { number: 206, v2Metadata: { phase: 'execution', attention: 'none' } };
  const session = { status: 'failed', error: 'Database connection refused' };

  const result = reconcileTaskState(issue, session);

  assert.equal(result.action, 'escalate');
  assert.equal(result.targetAttention, 'needs-decision');
  assert.equal(result.reason, 'Worker session failed or crashed: Database connection refused');
});

test('Part 9: reconcileTaskState polls actively running or idle sessions', () => {
  const issue = { number: 207, v2Metadata: { phase: 'execution', attention: 'none' } };

  // Running
  const runningResult = reconcileTaskState(issue, { status: 'running' });
  assert.equal(runningResult.action, 'poll');
  assert.equal(runningResult.reason, 'Worker session actively progressing');

  // Idle
  const idleResult = reconcileTaskState(issue, { status: 'idle' });
  assert.equal(idleResult.action, 'poll');
  assert.equal(idleResult.reason, 'Worker session is idle');
});

test('Part 9: reconcileTaskState is idempotent: tick 1 advances execution to verification, tick 2 polls (ADV-2B-01)', () => {
  const session = { status: 'completed' };

  // Tick 1: task in execution phase completes
  const issueTick1 = { number: 301, v2Metadata: { phase: 'execution', attention: 'none', isExplicitV2: true } };
  const tick1Result = reconcileTaskState(issueTick1, session);
  assert.equal(tick1Result.action, 'advance');
  assert.equal(tick1Result.targetPhase, 'verification');
  assert.equal(tick1Result.targetAttention, 'needs-review');

  // Tick 2: task has transitioned to verification with attention needs-review
  const issueTick2 = { number: 301, v2Metadata: { phase: 'verification', attention: 'needs-review', isExplicitV2: true } };
  const tick2Result = reconcileTaskState(issueTick2, session);
  assert.equal(tick2Result.action, 'poll');
  assert.equal(tick2Result.reason, 'Awaiting human verification');

  // Tick 3: task in done phase releases lease
  const issueDone = { number: 301, v2Metadata: { phase: 'done', attention: 'none', isExplicitV2: true } };
  const doneResult = reconcileTaskState(issueDone, session);
  assert.equal(doneResult.action, 'release');
  assert.equal(doneResult.reason, 'Task is complete');
});

test('Part 9: reconcileTaskState polls without overwriting attention for non-completed sessions on verification tasks (ADV-2C-01)', () => {
  const hostileSessions = [
    { status: 'failed', error: 'Worker crashed' },
    { pendingPermissions: ['tools.execute'] },
    { pendingQuestions: ['Ship it?'] },
  ];

  for (const session of hostileSessions) {
    const issue = { number: 401, v2Metadata: { phase: 'verification', attention: 'needs-review' } };
    const result = reconcileTaskState(issue, session);

    assert.equal(result.action, 'poll', JSON.stringify(session));
    assert.equal(result.targetAttention, undefined, 'needs-review must never be overwritten');
    assert.equal(result.targetPhase, undefined);
    assert.equal(issue.v2Metadata.attention, 'needs-review', 'issue attention must remain untouched');
  }
});

test('Part 9: reconcileTaskState releases done/archive and closed tasks for every liveness state (ADV-2C-01, ADV-2C-08)', () => {
  const sessions = [
    { status: 'failed', error: 'Worker crashed' },
    { pendingPermissions: ['tools.execute'] },
    { pendingQuestions: ['Ship it?'] },
    { status: 'completed' },
    { status: 'running' },
    { status: 'idle' },
  ];

  for (const phase of ['done', 'archive']) {
    for (const session of sessions) {
      const issue = { number: 402, v2Metadata: { phase, attention: 'none' } };
      const result = reconcileTaskState(issue, session);

      assert.equal(result.action, 'release', `${phase} + ${JSON.stringify(session)}`);
      assert.equal(result.reason, 'Task is complete');
      assert.equal(result.targetAttention, undefined, 'terminal tasks must never have attention mutated');
    }
  }

  // Closed issues are terminal regardless of liveness state
  const closedResult = reconcileTaskState(
    { number: 403, state: 'closed', v2Metadata: { phase: 'execution', attention: 'none' } },
    { status: 'failed', error: 'Worker crashed' }
  );
  assert.equal(closedResult.action, 'release');
  assert.equal(closedResult.targetAttention, undefined);
});

test('Part 9: reconcileTaskState prefers live issue phase over stale lease phase (ADV-2C-02)', () => {
  const session = { status: 'completed' };
  const staleLease = (phase) => ({
    issueNumber: 501,
    repo: 'test/repo',
    ownerId: 'w1',
    claimedAt: 1000,
    expiresAt: Date.now() + 60000,
    heartbeatAt: 1000,
    claimedSha: 'sha',
    phase,
  });

  // Issue moved to planning after the claim; stale lease snapshot still says execution
  const planningResult = reconcileTaskState(
    { number: 501, v2Metadata: { phase: 'planning', attention: 'none' } },
    session,
    staleLease('execution')
  );
  assert.equal(planningResult.action, 'poll', 'stale lease snapshot must not advance planning to verification');
  assert.equal(planningResult.targetPhase, undefined);

  // Live issue still in execution; stale lease snapshot says done — must not release a live task
  const executionResult = reconcileTaskState(
    { number: 501, v2Metadata: { phase: 'execution', attention: 'none' } },
    session,
    staleLease('done')
  );
  assert.equal(executionResult.action, 'advance');
  assert.equal(executionResult.targetPhase, 'verification');
});

test('Part 9: reconcileTaskState does not discard open human decisions (ADV-2C-05)', () => {
  const session = { status: 'completed' };

  for (const attention of ['needs-decision', 'needs-permission', 'needs-review']) {
    const result = reconcileTaskState(
      { number: 502, v2Metadata: { phase: 'execution', attention } },
      session
    );
    assert.equal(result.action, 'poll', `attention ${attention} must block advance`);
    assert.equal(result.targetAttention, undefined);
    assert.equal(result.targetPhase, undefined);
  }

  // A non-completed session may not re-escalate over an open decision either
  const failedResult = reconcileTaskState(
    { number: 502, v2Metadata: { phase: 'execution', attention: 'needs-decision' } },
    { status: 'failed', error: 'Worker crashed' }
  );
  assert.equal(failedResult.action, 'poll');
  assert.equal(failedResult.targetAttention, undefined);
});

test('Part 9: reconcileTaskState polls on missing or empty issue data instead of advancing (ADV-2C-08)', () => {
  const session = { status: 'completed' };
  const emptyIssues = [
    null,
    undefined,
    {},
    { number: 503 },
    { number: 503, v2Metadata: { attention: 'none' } },
  ];

  for (const issue of emptyIssues) {
    const result = reconcileTaskState(issue, session);
    assert.equal(result.action, 'poll', JSON.stringify(issue));
    assert.equal(result.reason, 'No issue data');
    assert.equal(result.targetPhase, undefined);
  }
});

test('Part 9: CoordinatorReconciler class wrapper delegates cleanly', () => {
  const reconciler = new CoordinatorReconciler();
  const issue = { number: 208, v2Metadata: { phase: 'exploration', attention: 'none' } };
  const session = { status: 'completed' };

  const result = reconciler.reconcile(issue, session);
  assert.equal(result.action, 'advance');
  assert.equal(result.targetPhase, 'planning');
  assert.equal(result.targetAttention, 'needs-review');
});
