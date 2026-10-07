# Reproduction Audit: Red Baseline Verification Against 252225a

**Target Base Commit:** `252225a` (`fix(v2): repair protocol mismatches and taskboard caching race conditions`)  
**Repaired Head Commit:** `HEAD` (`a5ddb77`)  
**Auditor:** Independent L4 Hostile Reviewer  
**Methodology:** Direct scratch extraction of base commit `252225a` artifacts into `/tmp/antigravity/scratch-252225a` to execute newly authored test specifications against unpatched production code.

---

## 1. Scratch Execution Setup & Verification

```bash
mkdir -p /tmp/antigravity/scratch-252225a
git archive 252225a service/ | tar -x -C /tmp/antigravity/scratch-252225a
ln -s /workspace/extensions/chambervoice/.worktrees/team-dev-v2-ratelimit-review-repair/node_modules /tmp/antigravity/scratch-252225a/node_modules
```

---

## 2. Test 1 — Finding A: Form Field Type `"integer"` Rejection

### Empirical Scratch Execution Against Base `252225a`
```javascript
import { HostClient } from '/tmp/antigravity/scratch-252225a/service/main.js';

const mockStatus = {
  sessions: { ses_int: { status: 'waiting-question' } },
  pending: { ses_int: { permissions: [], forms: [{ id: 'frm_int_1', sessionID: 'ses_int', title: 'Server Settings', fields: [{ key: 'timeout_seconds', title: 'Timeout', type: 'integer' }] }] } }
};
const fetchImplA = async (url) => {
  const u = String(url);
  if (u.endsWith('/auth/session')) return new Response('{"ok":true}', { status: 200, headers: { 'set-cookie': 'openchamber_session=c; Path=/' } });
  if (u.endsWith('/api/sessions/status')) return new Response(JSON.stringify(mockStatus), { status: 200, headers: {'content-type':'application/json'} });
  return new Response('Not found', { status: 404 });
};
const clientA = new HostClient({ origin: 'http://127.0.0.1:3000', password: 'pw', fetchImpl: fetchImplA });
await clientA.replyQuestion('frm_int_1', [['42']], '/workspace', 'ses_int');
```
- **Observed Result on 252225a:**
  ```text
  Error: Unsupported form field type "integer" for field "timeout_seconds".
  code: 'UNSUPPORTED_FORM_FIELD'
  name: 'HostClientError'
  ```
- **Conclusion:** Genuine discrimination confirmed. Base commit `252225a` rejected integer fields at line 1073.

---

## 3. Test 2 — Finding B: Dead V1 Route Probes on 404

### Empirical Scratch Execution Against Base `252225a`
```javascript
import { HostClient } from '/tmp/antigravity/scratch-252225a/service/main.js';

const urlsB = [];
const mockStatusB = {
  sessions: { ses_test: { status: 'waiting-question' } },
  pending: { ses_test: { permissions: [], forms: [{ id: 'frm_404', title: 'Q', fields: [{ key: 'f1', type: 'string' }] }] } }
};
const fetchImplB = async (url) => {
  const u = String(url);
  urlsB.push(u);
  if (u.endsWith('/auth/session')) return new Response('{"ok":true}', { status: 200, headers: { 'set-cookie': 'openchamber_session=c; Path=/' } });
  if (u.endsWith('/api/sessions/status')) return new Response(JSON.stringify(mockStatusB), { status: 200, headers: {'content-type':'application/json'} });
  if (u.includes('/api/session/ses_test/form/frm_404/reply')) return new Response('Form not found', { status: 404 });
  if (u.includes('/api/question/frm_404/reply')) return new Response('Dead V1 404', { status: 404 });
  return new Response('Not found', { status: 404 });
};
const clientB = new HostClient({ origin: 'http://127.0.0.1:3000', password: 'pw', fetchImpl: fetchImplB });
try {
  await clientB.replyQuestion('frm_404', [['answer']], '/workspace', 'ses_test');
} catch (err) {}
const probedV1_B = urlsB.some(u => u.includes('/api/question/frm_404/reply'));
```
- **Observed Result on 252225a:**
  `probedV1_B === true`
- **Conclusion:** Genuine discrimination confirmed. Base commit `252225a` caught 404 and probed legacy `/api/question/:id/reply`. On `HEAD`, `probedV1_B === false`.

---

## 4. Test 3 — Finding C: Partial-Cache Poisoning in All Projects Mode

### Empirical Scratch Execution Against Base `252225a`
```javascript
import { TaskboardManager } from '/tmp/antigravity/scratch-252225a/service/main.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-test-c-'));
const guestDir = path.join(tmpDir, 'guest-storage');
fs.mkdirSync(guestDir, { recursive: true });
fs.writeFileSync(path.join(guestDir, 'github-task-board.json'), JSON.stringify({
  selected_repo: '__all_projects__',
  repo_a: 'test-org/repo-a',
  repo_b: 'test-org/repo-b',
}));
let fetchCountA = 0, fetchCountB = 0, repoBShouldFail = true;
const mockFetchC = async (url) => {
  const u = String(url);
  if (u.includes('repos/test-org/repo-a/issues')) {
    fetchCountA++;
    return { ok: true, status: 200, json: async () => [{ number: 101, title: 'Task A', state: 'open', labels: [] }] };
  }
  if (u.includes('repos/test-org/repo-b/issues')) {
    fetchCountB++;
    if (repoBShouldFail) return { ok: false, status: 500, json: async () => ({ message: 'Error' }) };
    return { ok: true, status: 200, json: async () => [{ number: 202, title: 'Task B', state: 'open', labels: [] }] };
  }
  return { ok: false, status: 404 };
};
const mgrC = new TaskboardManager({ enabled: true, dataDir: tmpDir, token: 'ghp_fake', fetchImpl: mockFetchC });
await mgrC.getTasks();
repoBShouldFail = false;
const res2 = await mgrC.getTasks();
```
- **Observed Result on 252225a:**
  `fetchCountB === 1`, `res2.tasks.length === 1`.
  `repo-b` was NOT retried on Turn 2 because the incomplete 1-task aggregate was cached for 30 seconds.
- **Observed Result on HEAD:**
  `fetchCountB === 2`, `fetchCountA === 1`, `res2.tasks.length === 2`.
  `repo-a` was reused from per-repo cache; `repo-b` was retried immediately.
- **Conclusion:** Genuine discrimination confirmed.
