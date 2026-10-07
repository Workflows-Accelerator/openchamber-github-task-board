# Reproduction Audit: Red Baseline & Green Resolution for Voice Repair 3

**Target Base Commit:** `a5ddb77` (`docs(voice-v2): add reproduction, repair log, and test evidence for repair 2`)  
**Repaired Head Commit:** `a7e3ac9` (`fix(v2): skip non-input external form fields in replyQuestion and question normalization (Finding 1)`)  
**Branch:** `fix/v2-ratelimit-repair`  
**Auditor:** Independent L4 Hostile Reviewer  
**Methodology:** Direct scratch archive extraction of base commit `a5ddb77` into `/tmp/antigravity/scratch_a5ddb77`, symlinking dependencies, running the newly authored regression test against unpatched production code, then verifying green resolution at `HEAD`.

---

## 1. Scratch Execution Setup

```bash
mkdir -p /tmp/antigravity/scratch_a5ddb77
git archive a5ddb77 | tar -x -C /tmp/antigravity/scratch_a5ddb77
ln -s /workspace/extensions/chambervoice/.worktrees/team-dev-v2-ratelimit-review-repair/node_modules /tmp/antigravity/scratch_a5ddb77/node_modules
```

---

## 2. Red Baseline Reproduction Against Base `a5ddb77`

The newly authored regression test `Finding 1 (Repair 3): Form field of type external is skipped in replyQuestion and normalizeQuestionRequest` was evaluated against the base commit `a5ddb77`.

### A. Failure Mode 1: Question Normalization Pollution
In unpatched `service/host-client.ts`, `normalizeQuestionRequest` mapped all elements in `raw.fields` unconditionally without filtering non-input display types:
```text
# Subtest: Finding 1 (Repair 3): Form field of type external is skipped in replyQuestion and normalizeQuestionRequest
not ok 4 - Finding 1 (Repair 3): Form field of type external is skipped in replyQuestion and normalizeQuestionRequest
  ---
  duration_ms: 2.821655
  type: 'test'
  location: '/tmp/antigravity/scratch_a5ddb77/test/v2-ratelimit-repair.test.js:218:3'
  failureType: 'testCodeFailure'
  error: |-
    External field must be excluded from pending questions
    
    3 !== 2
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 2
  actual: 3
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///tmp/antigravity/scratch_a5ddb77/test/v2-ratelimit-repair.test.js:288:12)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Suite.processPendingSubtests (node:internal/test_runner/test:744:7)
```
- **Observed:** `pending.questions.length` evaluated to 3 instead of 2. The external link (`docs_link`) was exposed as an answerable question slot.

### B. Failure Mode 2: Rejection in `replyQuestion`
When the length assertion was bypassed to inspect `replyQuestion`:
```text
# Subtest: Finding 1 (Repair 3): Form field of type external is skipped in replyQuestion and normalizeQuestionRequest
not ok 4 - Finding 1 (Repair 3): Form field of type external is skipped in replyQuestion and normalizeQuestionRequest
  ---
  duration_ms: 2.632338
  type: 'test'
  location: '/tmp/antigravity/scratch_a5ddb77/test/v2-ratelimit-repair.test.js:218:3'
  failureType: 'testCodeFailure'
  error: 'Unsupported form field type "external" for field "docs_link".'
  code: 'UNSUPPORTED_FORM_FIELD'
  name: 'HostClientError'
  stack: |-
    HostClient.replyQuestion (file:///tmp/antigravity/scratch_a5ddb77/service/main.js:3560:19)
    async TestContext.<anonymous> (file:///tmp/antigravity/scratch_a5ddb77/test/v2-ratelimit-repair.test.js:294:22)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Suite.processPendingSubtests (node:internal/test_runner/test:744:7)
```
- **Observed:** `replyQuestion` iterated over `formFields` without filtering, encountered `f.type === 'external'`, failed the field type whitelist check at line 1078, and threw `HostClientError: Unsupported form field type "external" for field "docs_link"`. Any form presenting an informational external link was completely unanswerable over voice.

---

## 3. Green Resolution Verification at HEAD `a7e3ac9`

Executed in the working tree at commit `a7e3ac9`:

```bash
node --test test/v2-ratelimit-repair.test.js
```

### Empirical Result
```text
# Subtest: V2 Protocol & Cache Defect Repairs (L4 Hostile Findings)
    ok 1 - Finding 1: getPendingPermission normalizes V2 action and resources into permission and patterns
    ok 2 - Finding 2: normalizeQuestionRequest detects multiselect and replyQuestion formats array
    ok 3 - Finding A (Repair 2): Form field of type integer accepts valid integer and validates correctly
    ok 4 - Finding 1 (Repair 3): Form field of type external is skipped in replyQuestion and normalizeQuestionRequest
    ...
    ok 23 - Finding C (Repair 2): getTasks in All Projects mode does not cache partial list on repo failure and retries failed repo while reusing cached repo
1..23
ok 54 - V2 Protocol & Cache Defect Repairs (L4 Hostile Findings)
```

- **Finding 1 (Repair 3) Test Duration:** 3.7 ms
- **Exit Code:** 0
- **Total Suite Duration:** 72.0 ms
- **Outcome:** PASS. Red baseline cleanly resolved.
