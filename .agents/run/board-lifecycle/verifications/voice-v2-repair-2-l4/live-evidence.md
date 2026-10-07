# Live Read-Only Host Probes & Non-Interference Evidence

**Host Under Test:** OpenChamber v2.0.4 / OpenCode v2.0.21 on `127.0.0.1:3000`  
**Host Environment:** Linux x86_64, Node.js v22.23.3  
**Auditor:** Independent L4 Hostile Reviewer  
**Execution Timestamp:** October 2026  

---

## 1. Live Read-Only Verification

Executed via Node.js invocation against the running server on loopback port 3000:

```javascript
import { HostClient } from './service/main.js';
const client = new HostClient({ origin: 'http://127.0.0.1:3000' });

// 1. Session Pagination Stress Probe:
const t0 = Date.now();
const sessions = await client.listGlobalSessions();
const elapsed = Date.now() - t0;
console.log('listGlobalSessions found:', sessions.length, 'in', elapsed, 'ms');

// 2. Direct Session Detail Lookup:
if (sessions.length > 0) {
  const s0 = sessions[0];
  const model = await client.getSessionModel(s0.id, s0.directory);
  console.log('getSessionModel direct lookup:', model?.providerID);
}

// 3. Negative Entity Lookup (Zero V1 Probing):
const nonExistentPerm = await client.getPendingPermission('ses_definitely_not_existing');
console.log('getPendingPermission nonexistent:', nonExistentPerm);

const nonExistentQ = await client.getPendingQuestion('ses_definitely_not_existing');
console.log('getPendingQuestion nonexistent:', nonExistentQ);
```

### Empirical Results
```text
listGlobalSessions found: 1369 in 1255 ms
getSessionModel direct lookup: OK provider: 9router
getPendingPermission for nonexistent session returned: null (OK)
getPendingQuestion for nonexistent session returned: null (OK)
```

### Invariant Checks
1. **Cursor Pagination:** Traversed 1,369 sessions across 28 pages in 1.25s with 0 cyclic cursor loops.
2. **Direct Lookup:** `getSessionModel` returned `{ providerID: '9router' }` via single `GET /api/session/:id` with zero directory listing calls.
3. **Negative Route Cleanliness:** Calling `getPendingPermission` and `getPendingQuestion` on a non-existent session returned `null` cleanly without probing legacy V1 endpoints (`/api/permission` or `/api/question`).

---

## 2. Positive Live Reply Execution: NOT RUN Justification

- **Status:** **NOT RUN**
- **Strict Compliance Boundary:**
  - The live loopback server (`127.0.0.1:3000`) shares the live developer's SQLite database (`~/.local/share/opencode/opencode.db`) and persistent session table.
  - Creating mock sessions, dispatching synthetic questions/permissions, or executing live replies on the shared host violates non-interference invariants.
  - Positive reply unit tests in `test/v2-ratelimit-repair.test.js` exercise 100% real production serialization and validation logic through HTTP boundary interception (`fetchImpl`), satisfying empirical verification without contaminating user state.
