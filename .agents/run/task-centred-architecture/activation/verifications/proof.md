# Task Board Extension Host Activation Proof

**Executed:** Fri Oct 30 2026  
**Host Runtime:** OpenChamber Web (Port 3000) & Obscura Headless Browser (Port 9333)  
**Target Extension:** `github-task-board` (v1.2.1)  
**Branch:** `ops/task-board-activation`  
**Base Master SHA:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  
**Saved Feature SHA:** `f485a0a`  

---

## 1. Source Parity & Integrity

- **Product Tree Parity:** Clean (0 differences outside `.agents/run/task-centred-architecture/`).
- **Preserved Untracked State:** `.agents/idle-nontext-state.json` intact and untouched.
- **25 Portfolio Worktrees:** Intact and untouched.
- **Master Branch:** Byte-identical and untouched.
- **Product Artifact Hashes (SHA-256):**
  - `package.json`: `e6e333e151fb5625be106476226666021fa8e0076fc072f68289842c07bfd7ee` (matches master)
  - `panel/index.html`: `3b7fc833c06d6ce798c305a9adae81f03f222eafe92c2fd6d1213e0699b09404` (matches master)
  - `panel/main.js`: `9d9c2d04c20e9f282bf6031a1e93f062349b8b27708f96d272d3919fcf203aec` (matches master)
  - `service/main.js`: `a29d18cc1a43c823f304119b9effc8231241cd6e2fd07ab4ee36bc9b2cb30f84` (matches master)

---

## 2. Test Execution & Parity Verification

| Check | Command | Exit Code | Result |
| --- | --- | --- | --- |
| Parity Gate | `node --test test/shipped-parity.test.js` | 0 | **18/18 passed** |
| TypeScript Check | `npm run typecheck` | 0 | **PASS (0 errors)** |

---

## 3. Host Extension Lifecycle & Served Assets

- **Host Authentication:** Transient session authenticated via `POST /auth/session` using in-memory password. No secrets extracted or stored.
- **Supported Lifecycle Recycle:**
  - Disabled: `PUT /api/guests/github-task-board/enabled` with `{"enabled": false}` (HTTP 200)
  - Enabled: `PUT /api/guests/github-task-board/enabled` with `{"enabled": true}` (HTTP 200)
  - Lifecycle impact: Extension service recycled cleanly; host process and unrelated services (`chambervoice`) completely unaffected.
- **Installed Guest Metadata (`GET /api/guests`):**
  - ID: `github-task-board`
  - Name: `Task Board`
  - Version: `1.2.1`
  - Enabled: `true`
  - Path: `/workspace/extensions/github-task-board`
  - Entry: `panel/index.html`
- **Frame Grant & Served Bundle Verification:**
  - Route: `POST /api/guests/github-task-board/frame-grant` (HTTP 200)
  - Served JS: `GET /api/guest-files/:grant/panel/main.js` (HTTP 200)
  - Served JS SHA-256: `9d9c2d04c20e9f282bf6031a1e93f062349b8b27708f96d272d3919fcf203aec` (Exact 1:1 match with disk artifact)

---

## 4. Real Host Iframe DOM & Control Verification

Exercised live via Playwright over Obscura CDP (`http://127.0.0.1:9333`):
- **View Select Control (`#btnViewSelect`):**
  - Initial default: `Simple list` (`#viewSelectCurrentLabel` text "Simple list", `.simple-view` mounted with `display: flex`).
  - Switched to `Cards`: Popover `#viewSelectPopover` opened, `#viewOptCards` clicked; `data-layout="cards"`, label updated to "Cards".
  - Switched back to `Simple list`: Popover reopened, `#viewOptSimple` clicked; `data-layout="simple"`, label restored to "Simple list".
- **Sort Select (`#selectSort`):**
  - Options verified: `priority`, `updated`, `created`, `manual`.
  - Exercised change to `updated` (value "updated"), then cleanly restored to `priority` (value "priority").
- **Filter Popover (`#btnFilterToggle`):**
  - Clicked toggle: Popover opened (`display: flex`, `aria-expanded="true"`, 3 filter groups: Attention, Stage, Repo/Kind).
  - Clicked toggle again: Popover closed (`display: none`, `aria-expanded="false"`).
- **Draft Quick-Capture & Align Controls:**
  - Quick-capture input `#quickAddDraftInput` verified present with placeholder `"Quick add draft... (press Enter)"`.
  - Align Drafts button `#btnAlignDrafts` verified present, labeled `"Align Drafts"`, and enabled (`disabled = false`).
- **Error Monitoring:** 0 console errors, 0 unhandled exceptions.
- **Sanitized Toolbar Screenshot:** Stored at `activation/verifications/screenshots/toolbar.png` (displays `"Detecting repo..."` with zero private/sensitive repository or credential data).

---

## 5. Standalone Board Public Health

- **Public Endpoint:** `http://127.0.0.1:8787/health`
- **Response Code:** `HTTP 200 OK`
- **Response Body:** `{"status":"ok","version":"1.2.1","uptime":18908}`
