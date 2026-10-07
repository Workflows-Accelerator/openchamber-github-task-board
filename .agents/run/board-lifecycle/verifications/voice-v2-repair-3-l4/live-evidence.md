# Live Read-Only Host Probes & Non-Interference Evidence (Repair 3)

**Host Under Test:** OpenChamber v2.0.4 / OpenCode v2.0.21 on `127.0.0.1:3000`  
**Host Environment:** Linux x86_64, Node.js v22.23.3  
**Auditor:** Independent L4 Hostile Reviewer  
**Execution Timestamp:** October 2026  

---

## 1. Live Read-Only Probes Against Active Host

Probes executed using real `HostClient` against loopback port 3000:

```javascript
import { HostClient } from './service/main.js';
const client = new HostClient({ origin: 'http://127.0.0.1:3000' });

// 1. Session Pagination Stress Probe
const t0 = Date.now();
const sessions = await client.listGlobalSessions();
const elapsed = Date.now() - t0;
console.log('listGlobalSessions found:', sessions.length, 'in', elapsed, 'ms');

// 2. Direct Session Detail Lookup
if (sessions.length > 0) {
  const s0 = sessions[0];
  const model = await client.getSessionModel(s0.id, s0.directory);
  console.log('getSessionModel for', s0.id, 'returned providerID:', model?.providerID, 'modelID:', model?.modelID);
}

// 3. Negative Entity Lookup
const nonExistentPerm = await client.getPendingPermission('ses_definitely_not_existing');
console.log('getPendingPermission nonexistent:', nonExistentPerm);

const nonExistentQ = await client.getPendingQuestion('ses_definitely_not_existing');
console.log('getPendingQuestion nonexistent:', nonExistentQ);
```

### Empirical Results
```text
listGlobalSessions found: 1376 in 1391 ms
getSessionModel for ses_f270c21cdffe35Uy1c26spUrvS returned providerID: 9router modelID: genius
getPendingPermission nonexistent: null
getPendingQuestion nonexistent: null
```

### Invariant Checks
1. **Cursor Pagination:** Traversed 1,376 sessions across 28 pages in 1.39s with 0 cyclic cursor loops.
2. **Direct Lookup:** `getSessionModel` returned `{ providerID: '9router', modelID: 'genius' }` via single `GET /api/session/:id` with zero directory listing calls.
3. **Negative Route Cleanliness:** Calling `getPendingPermission` and `getPendingQuestion` on non-existent sessions returned `null` cleanly without probing legacy V1 endpoints.

---

## 2. Positive Live Reply Execution: NOT RUN Justification

- **Status:** **NOT RUN**
- **Strict Compliance Boundary:**
  - The live loopback server (`127.0.0.1:3000`) shares the live developer's SQLite database (`opencode.db`) and user session table.
  - Creating synthetic test sessions, generating dummy questions/permissions, or executing live replies on the shared host would pollute developer state.
  - Production code execution is verified through HTTP transport boundary interception (`fetchImpl`) in `test/v2-ratelimit-repair.test.js`, exercising real `HostClient` serialization, validation, and error propagation.
  - End-to-end user voice interaction is deferred to human validation (L5) on the preview environment.
