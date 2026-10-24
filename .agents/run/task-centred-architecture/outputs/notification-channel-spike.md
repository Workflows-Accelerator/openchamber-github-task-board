# Capability Spike: Notification Channel Selection for Task Attention

**Date:** 2026-10-24  
**Author:** Subagent (Doubt-Driven Development / Capability Spike)  
**Status:** COMPLETE (Spike Findings & Architectural Recommendation)  
**Target Delivery:** How "an agent needs you" reaches the owner (questions, human tasks, attention).

---

## 1. Executive Summary & Verdict

We evaluated two potential delivery mechanisms and their combination for notifying the owner when an agent needs human input (new open questions or human tasks):
1. **Option A: Web Push from the Standalone Board (PWA)**
2. **Option B: OpenChamber's Notification Route (`POST /api/notifications/emit`)**
3. **Option C: Hybrid (Both)**

```
+------------------------------------+--------------------------+------------------------------+
| Dimension                          | Board PWA Web Push       | OpenChamber /emit Route      |
+------------------------------------+--------------------------+------------------------------+
| Reaches user when app/tab closed?  | YES (Background push)    | NO (Live active window only) |
| Reaches phone (iOS / Android)?     | YES (iOS PWA / Android)  | NO (Zero push/APNs fanout)   |
| Zero changes to OpenChamber?       | YES (Fully standalone)   | NO (Auth/proxy alterations)  |
| Respects auth isolation?           | YES (Board password/VAPID| NO (Requires OpenChamber auth|
| Implementation Effort (Estimate)   | ~2.5 - 3.5 days          | Incompatible with goals      |
| Current Deployment Blocker         | board.workflows.ac TLS   | Fundamental design mismatch  |
+------------------------------------+--------------------------+------------------------------+
```

### Architectural Verdict
- **Option A (Board PWA): PROCEED-WITH-CONDITIONS.** It is the **only** channel that satisfies the owner's goal ("real notifications, not only in-board", reaching mobile and desktop when closed) while strictly honoring the constraint that the board remains standalone. Condition: TLS on `board.workflows.ac` must be resolved before Service Workers can activate.
- **Option B (OpenChamber Route): HALT.** Definitively unviable for this purpose. Source code analysis proves it has **zero mobile reach**, **zero delivery when OpenChamber is closed**, and cannot be invoked by an external standalone service without violating OpenChamber authentication boundaries.
- **Option C (Both): HALT.** Pointless duplicate overhead; OpenChamber's route cannot reach when closed and lacks deduplication primitives with GitHub issue state.

---

## 2. Channel 1: Web Push from the Standalone Board (PWA)

### 2.1 Core Requirements
1. **Secure Origin (HTTPS with valid TLS certificate):**
   - Service Workers and the Push API are strictly constrained to Secure Contexts (W3C Push API §4). Browsers immediately reject `navigator.serviceWorker.register()` on insecure origins.
   - *Current Status / Blocker:* As verified in `.agents/run/task-centred-architecture/outputs/deployment-readiness.md`, `https://board.workflows.ac` currently fails client certificate chain validation (`TLS failure: client could not verify the first certificate`). PWA registration and web push will not function in production until this certificate chain is corrected. (Works on `http://localhost` only during local development).
2. **Web App Manifest (`manifest.webmanifest`):**
   - Required for PWA installation (`name`, `short_name`, `icons` [192x192, 512x512], `start_url: "/"`, `display: "standalone"`, `theme_color`).
   - Critical for iOS support (see §2.3).
3. **Service Worker (`sw.js`):**
   - Served from public root (`/sw.js`).
   - Handles `self.addEventListener('push', ...)` to decode payload and trigger `self.registration.showNotification(title, options)`.
   - Handles `self.addEventListener('notificationclick', ...)` to open/focus the board window directly to the relevant issue.
4. **VAPID Keypair (RFC 8292):**
   - Voluntary Application Server Identification for Web Push.
   - P-256 ECDSA keypair generated server-side. Public key served to browser via `GET /api/push/key`; private key stored securely in server environment/disk.
   - Server signs outbound push payloads with VAPID JWT header.
5. **Subscription Storage:**
   - Server endpoint `POST /api/push/subscribe` receiving standard `PushSubscription` JSON (`{ endpoint, keys: { p256dh, auth } }`).
   - Stored in a restricted server file (e.g. `data/push-subscriptions.json`, `mode 0600`) or database, scoped per client or deployment.

### 2.2 What Triggers a Push? (Detection Loop)
Currently, the board is strictly read-through on human request:
> *"Issues are read live from GitHub on each board/detail request. There is no background poller and no stored copy of issue content."* (`web/README.md:11-12`)

To trigger push notifications when "an agent needs you", something must detect new open questions or human tasks:

| Trigger Option | Mechanism | Push while no user signed in? | Latency | Pros & Cons |
|---|---|---|---|---|
| **A. Board Background Poller (Recommended)** | Timer in board server (e.g. every 60s) polls `GET /repos/{owner}/{repo}/issues` using `BOARD_GITHUB_TOKEN`. Compares question count/fingerprint against prior snapshot. | **YES.** Server holds token 24/7; registered subscriptions are persisted on disk. | Up to poll interval (e.g. 60s) | **Pros:** Self-contained, works behind NAT/firewall, zero inbound webhook setup. Uses GitHub `If-None-Match` (ETag) so unchanged polls return 304 and do not count against rate limits.<br>**Cons:** Up to 60s delay. |
| **B. GitHub Webhooks** | GitHub sends `POST /api/webhooks/github` on issue events (`issues.edited`, `issues.labeled`). | **YES.** Triggered immediately on remote edit. | Immediate (< 1s) | **Pros:** Real-time push.<br>**Cons:** Requires exposing a public webhook receiver, validating HMAC secret, and configuring repo webhook settings (requires repo admin rights). |
| **C. In-tab Polling Only** | Client browser polls while open and triggers push. | **NO.** Defeats purpose of push. | N/A | **Rejected:** Does not wake a user whose device is idle or tab is closed. |

### 2.3 Platform Support & Mobile Reality
- **Desktop Chrome / Edge / Firefox (macOS, Windows, Linux):** Full background push support. Wakes Service Worker when browser is running even if board tab is closed.
- **Desktop Safari (macOS 13+ Ventura):** Full Web Push support in standard browser tabs.
- **Android (Chrome, Firefox, Edge, Samsung Internet):** Full Web Push support out of the box, both in-browser and as an installed PWA.
- **iOS (iPhone / iPad - iOS 16.4+):**
  - **CRITICAL CONSTRAINT:** Web Push on iOS is supported **ONLY when installed to the Home Screen as a PWA** (`Add to Home Screen` in Safari).
  - Standard Safari browser tabs on iOS *cannot* subscribe to Push (`Notification.requestPermission` is unavailable or throws).
  - Once added to Home Screen and launched, the PWA can request notification permission and receives push notifications through Apple Push Notification service (APNs) even when the app is terminated.
  - Requires user gesture (tap button) to request permission.

### 2.4 Privacy & Payload Shape
Push messages traverse vendor relay servers (Apple APNs, Google FCM, Mozilla Autopush).
- **Rule:** Push notifications must be **content-free or minimal**.
- **Recommended Payload:**
  ```json
  {
    "title": "GitHub Task Board",
    "body": "An agent needs your decision",
    "tag": "task-board-attention",
    "url": "/#attention"
  }
  ```
- **Rationale:** Excludes repo names, issue titles, and question text. Protects private development context from lockscreen shoulder-surfing and third-party push relay logging. Matches OpenChamber's own enterprise mode precedent (`runtime.js:145-150`).

### 2.5 Implementation Effort (Estimate)
*Labelled as Engineering Estimate:*
1. **Manifest & Service Worker shell:** `manifest.webmanifest`, icons, `/sw.js` push & click handlers (0.5 day).
2. **VAPID & Subscription Storage:** Server key generation, `GET /api/push/key`, `POST /api/push/subscribe`, atomic JSON file write `0600` (0.5 day).
3. **Detection Loop (Background Poller):** 60-second GitHub poller with ETag caching, tracking unresolved `issue.openQuestions` / `humanTasks` (1.0 day).
4. **Delivery & UI Toggle:** Web-push delivery integration (`web-push` npm or native crypto), client subscribe/unsubscribe toggle in header (0.5 - 1.0 day).
- **Total Estimate:** **~2.5 to 3.5 developer days.**

---

## 3. Channel 2: OpenChamber `POST /api/notifications/emit`

We conducted an exhaustive source-code review of OpenChamber's notification subsystems in `/usr/local/lib/node_modules/@openchamber/web/`.

### 3.1 Who May Call It? (Auth Model from Source)
Defined in `server/lib/notifications/emit-route.js:88-118`:
```javascript
export const registerNotificationEmitRoutes = (app, dependencies) => {
  const { express, isAgentToolRequestAuthorized, emitter } = dependencies;
  const jsonBody = express.json({ limit: '16kb' });
  const respond = ...;
  return {
    registerPluginRoute: () => {
      app.post(NOTIFICATION_EMIT_PATH, jsonBody, (req, res, next) => (
        isAgentToolRequestAuthorized(req) ? respond(req, res, next) : next()
      ));
    },
    registerApiRoute: () => {
      app.post(NOTIFICATION_EMIT_PATH, jsonBody, respond);
    },
  };
};
```
Exactly two callers are authorized:
1. **Managed OpenCode Plugin (`registerPluginRoute`):**
   - Verified before API auth via `isAgentToolRequestAuthorized(req)`.
   - In `server/lib/agent-tool/runtime.js:570-577`, this requires:
     - `Authorization: Bearer <OPENCHAMBER_AGENT_TOOL_TOKEN>`
     - `isSameMachineAddress(req.socket?.remoteAddress)` (strictly loopback / same IP).
     - The token is an ephemeral 32-byte secret generated in memory per child process (`crypto.randomBytes(32).toString('base64url')`), never written to disk or configuration.
2. **Authenticated OpenChamber API Caller (`registerApiRoute`):**
   - Registered after `registerAuthAndAccessRoutes`.
   - Requires passing `requireApiAuth` (`server/lib/opencode/core-routes.js:673-684`).
   - Must present a valid OpenChamber UI session cookie/token (from password/passkey login to OpenChamber), a paired client token, or a tunnel session.

### 3.2 Can a Standalone Board Server Call It?
**NO.**
- The standalone board runs as a separate process with its own password and session secret (`BOARD_PASSWORD_HASH`, `BOARD_SESSION_SECRET`).
- It has no access to OpenChamber's memory-held agent tool token.
- Even if run on the same server, reading OpenChamber's internal process tokens violates security boundaries. If run on a separate origin (`board.workflows.ac` vs `live.workflows.ac`), `isSameMachineAddress` causes immediate rejection.
- Calling it via regular API auth requires holding an OpenChamber UI login session, violating the mandate: *"the board is standalone (no agent control, no OpenChamber change, own password sign-in)"*.
- Note: Voice-page authentication exists in `/api/voice/*` (`server/lib/tts/voice-keys.js`), but per project constraints, it was not read or reused.

### 3.3 Delivery When OpenChamber Is Closed
**ZERO DELIVERY.**
In `server/lib/notifications/emit-route.js:79-80`:
```javascript
const desktopNotificationDelivered = emitDesktopNotification(payload) === true;
broadcastUiNotification(payload, { desktopNotificationDelivered });
return { status: 200, body: { delivered: true } };
```
Tracing into `server/lib/notifications/emitter-runtime.js:30-117`:
- `emitDesktopNotification(payload)`: If running inside an Electron wrapper, invokes native desktop callback; otherwise writes a JSON line to `process.stdout`. On a headless Linux server, writing to `stdout` merely logs to the terminal/journald. No desktop alert appears.
- `broadcastUiNotification(payload)`: Emits an SSE/WebSocket event to currently connected browser clients. If the OpenChamber tab is closed, there are **0 clients connected**.
- **No Push Fanout:** Documented explicitly in `server/lib/notifications/DOCUMENTATION.md:96`:
  > *"Live delivery only: no web push or APNs fanout."*

### 3.4 Phone Reach
**ZERO PHONE REACH.**
- `POST /api/notifications/emit` has **no connection** to OpenChamber's push runtime (`push-runtime.js`) or APNs runtime (`apns-runtime.js`).
- OpenChamber's mobile push fanout (`fanoutPush` in `runtime.js:152-168`) is wired strictly to internal OpenCode session lifecycle events (`session.idle`, `form.created`).
- Calling `/api/notifications/emit` will **never** cause an iOS or Android device to ring or vibrate.

---

## 4. Evaluation of Options & Hybrid (Both)

### 4.1 Option Comparison

| Criterion | Option A: Board PWA Web Push | Option B: OpenChamber `/api/notifications/emit` | Option C: Both |
|---|---|---|---|
| **Reaches user when app closed?** | **YES** (OS background push wakes device) | **NO** (Only reaches active open window) | **NO** for OpenChamber; YES for Board |
| **Reaches mobile phone?** | **YES** (iOS Home Screen PWA & Android) | **NO** (Zero push/APNs integration) | No added value over Board alone |
| **Maintains standalone boundary?** | **YES** (Board owns its VAPID & subscriptions) | **NO** (Requires OpenChamber credentials or code hacks) | **NO** |
| **Implementation effort (est.)** | ~2.5 - 3.5 days | Incompatible with architecture | > 4 days (unnecessary complexity) |
| **Failure modes** | TLS certificate expiry, iOS user forgetting to "Add to Home Screen" | Tab closed = silent drop; server stdout discarded | Duplicate alerts when OpenChamber tab open |

### 4.2 Why "Both" Adds No Value
1. **Redundancy & Confusion:** OpenChamber's emit route only reaches active open desktop windows (which already have in-panel attention queues). It adds nothing to the standalone board's ability to reach closed devices and phones.
2. **Deduplication Dilemma:** If an agent in OpenChamber asks a question, OpenChamber's internal trigger might alert for the chat session, while the board alerts for the GitHub issue. Deduplicating between two decoupled servers without shared state is brittle and error-prone.
3. **Simplicity First:** Board Web Push solves the entire problem in one clean, self-contained architecture.

---

## 5. Recommendation & Smallest First Slice

### 5.1 Recommendation
Adopt **Option A: Web Push from the Standalone Board (Installable PWA)**. Reject Option B (`/api/notifications/emit`).

### 5.2 Smallest First Slice (Step-by-Step)
1. **Prerequisite (External):** Fix TLS certificate on `board.workflows.ac` (or test locally over `http://localhost:8787`).
2. **Slice 1 — PWA & Web Push Foundation (~1 day):**
   - Add `web/public/manifest.webmanifest` and icons.
   - Add `web/public/sw.js` with `push` and `notificationclick` listeners.
   - Generate and store server VAPID keys; add `GET /api/push/vapid-public-key` and `POST /api/push/subscribe` (persisting subscriptions to `data/push-subscriptions.json`, mode `0600`).
   - Add a manual **"Enable Notifications / Send Test Push"** button in the board header.
   - *Proof:* User installs board to iPhone Home Screen and clicks "Send Test Push"; phone vibrates with test notification.
3. **Slice 2 — Autonomous Attention Detection (~1.5 days):**
   - Add a background 60s poller in `web/server/` using `BOARD_GITHUB_TOKEN` with conditional `If-None-Match` requests.
   - Detect when an issue transitions to needing attention (new open question or human task).
   - Dispatch content-free push to all saved subscriptions: `"GitHub Task Board: 1 issue needs decision"`.

---

## 6. Risk Matrix & Unverified Items (Doubt-Driven Analysis)

### Risk Matrix
- **Catastrophic (Blocker): None.** The architecture is standard W3C Push.
- **Moderate (Requires Mitigation):**
  - *TLS Invalidity on board.workflows.ac:* Web Push and Service Workers fail completely if TLS is invalid. Must be resolved in reverse proxy/DNS configuration.
  - *iOS User Experience:* iOS users must explicitly use "Add to Home Screen" in Safari; standard Safari tabs will not prompt for notifications. Board UI must provide a clear 1-line guidance banner on iOS browsers.
  - *GitHub Polling Rate Limits:* Polling every 60s makes 60 calls/hour. GitHub PAT limit is 5,000/hour. Using ETag (`If-None-Match`) ensures unchanged polls return 304 and do not count against rate limits.
- **Low:**
  - *Stale Subscriptions:* Browser endpoints expire if unused for months. Server should prune subscriptions that return HTTP 404/410 Gone from push services.

### Items Marked UNVERIFIED
- **Production TLS Configuration:** The entity/mechanism managing certificates for `board.workflows.ac` is outside workspace access (noted as failing TLS in `deployment-readiness.md`).
- **iOS APNs Delivery Latency:** Precise push delivery latency on iOS low-power/battery-saver mode for Web Push PWAs is unverified until tested on a live production domain.
- **GitHub Webhook Feasibility:** Whether the owner prefers configuring a GitHub webhook (requires repo admin rights and public ingress) over the 60s background poller remains unverified.
