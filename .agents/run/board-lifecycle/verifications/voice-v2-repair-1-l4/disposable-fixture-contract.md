# Safe Disposable V2 Host Fixture Contract (Plan Only - NOT RUN)

**Status:** NOT RUN  
**Reason:** Executing live reply fixtures against the shared loopback server (`127.0.0.1:3000`) touches the live operator's database (`~/.local/share/opencode/opencode.db`) and session table (1,365 sessions). Creating or prompting sessions on the shared host is explicitly prohibited by mission criteria to prevent live developer disruption.  
**Auditor:** Independent L4 Hostile Reviewer  

---

## 1. Safety Isolation Prerequisites (Why Shared Host Cannot Be Used)

The running host on port 3000 is a persistent development environment:
1. `POST /api/session` inserts a persistent record into the shared SQLite database.
2. An interactive prompt requesting form or permission input requires an active agent worker loop.
3. Replying to a live prompt consumes model tokens or triggers execution side-effects.
4. Session deletion (`DELETE /api/session/:id`) is not authorized under the review brief.

---

## 2. Fully Isolated Test Fixture Architecture (Blueprint for Separate Execution)

To safely execute end-to-end positive reply verification with zero shared database or session pollution:

### Step 1: Provision Isolated OpenCode Sandbox
```bash
export XDG_DATA_HOME="/tmp/antigravity/isolated-opencode-data"
export XDG_CONFIG_HOME="/tmp/antigravity/isolated-opencode-config"
mkdir -p "$XDG_DATA_HOME" "$XDG_CONFIG_HOME"

# Start isolated ephemeral OpenCode daemon on dedicated loopback port
opencode serve --port 3888 --hostname 127.0.0.1 &
DAEMON_PID=$!
sleep 2
```

### Step 2: Create Isolated Disposable Session
```bash
curl -X POST http://127.0.0.1:3888/api/session \
  -H "Content-Type: application/json" \
  -d '{"title": "L4 Disposable Reply Fixture", "directory": "/tmp/antigravity/fixture-dir"}'
# Response yields sessionID: ses_fixture_safe
```

### Step 3: Trigger Multi-Select and Option-Value Form
Spawn a mock tool or synthetic event in the test session that registers an interactive form:
- **Field 1 (Single Select with distinct value/label):**
  - `key`: `"environment"`
  - `type`: `"string"`
  - `custom`: `false`
  - `options`: `[{"value": "staging_us", "label": "Staging US-East"}, {"value": "prod_eu", "label": "Production EU-Central"}]`
- **Field 2 (Multi-Select):**
  - `key`: `"features"`
  - `type`: `"multiselect"`
  - `options`: `[{"value": "feat_metrics", "label": "Telemetry Metrics"}, {"value": "feat_tracing", "label": "Distributed Tracing"}]`
- **Field 3 (Integer):**
  - `key`: `"replica_count"`
  - `type`: `"integer"`

### Step 4: Execute Reply Through ChamberVoice HostClient
Connect `HostClient` to `http://127.0.0.1:3888` and invoke:
```javascript
const client = new HostClient({ origin: 'http://127.0.0.1:3888' });

// 1. Reply to form with spoken labels:
await client.replyQuestion(formId, [
  ['Staging US-East'],
  ['Telemetry Metrics', 'Distributed Tracing'],
  ['3']
], '/tmp/antigravity/fixture-dir', 'ses_fixture_safe');

// 2. Reply to permission for harmless read command:
await client.replyPermission(permissionId, 'once', '/tmp/antigravity/fixture-dir', 'ses_fixture_safe');
```

### Step 5: Assertions & Teardown
1. Confirm OpenCode returns HTTP 204 `NoContent` for both replies.
2. Confirm `GET /api/sessions/status` shows 0 pending requests for `ses_fixture_safe`.
3. Kill daemon process (`kill -9 $DAEMON_PID`) and wipe `/tmp/antigravity/isolated-opencode-*`.
