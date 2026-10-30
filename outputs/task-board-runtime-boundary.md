# Task Board Runtime Boundary & Activation Audit Report

**Date:** Fri Oct 30 2026  
**Auditor Model:** `9router/engineer`  
**Branch:** `ops/task-board-activation` (Base Master: `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`)  

---

## 1. Capability & Boundary Status Matrix

| Layer | Status | Key Anchor & Evidence |
| --- | --- | --- |
| **Served Bundle Parity** | **VERIFIED** | Hash `9d9c2d0` matches disk and `master` byte-for-byte. |
| **Iframe SDK Bridge** | **VERIFIED** | Real parent-iframe postMessage handshake verified. `No host frame` warning was an artifact of top-level tab loading (`target.parent === target`). |
| **Parent UI Inspection** | **BLOCKED (AUTH)** | Host port 3000 requires `#openchamber-ui-password`. Stopped at auth boundary per secrets wall. |
| **Task / Repo Loading** | **NOT VERIFIED (SAFETY)** | `StatusReconciler` (`panel/labels.ts:674`) triggers automated `updateIssueStatus` (`PATCH`) without dry-run; halted to prevent remote GitHub label writes. |
| **Background Coordinator** | **FAILED (BROKEN)** | Service (`service/main.ts`) lacks HTTP server, port binding, and `/health` listener required by host (`service.js:461-536`). Would fail host readiness timeout (`SERVICE_FAILED`). |

---

## 2. Key Findings & Prior Verdict Refutation

1. **Prior Activation Verdict Overturned:** The prior claim of "ACTIVATION VERIFIED" is rejected. The absence of a background daemon is not an intended idle state, but a hard contract failure: `service/main.ts` cannot satisfy `waitForServiceReady` polling on `OPENCHAMBER_SERVICE_PORT`. Unattended lease coordination is an unimplemented boundary.
2. **"No host frame" Disproven:** The SDK bridge operates properly inside an iframe (`window.self !== window.top`). The warning observed in earlier audits occurred because the guest HTML was loaded directly as a standalone top-level page.
3. **Toolbar Defect Classification:**
   - `#selectSort`: Real panel defect (`panel/index.html:3490`). Unstyled `<select>` renders white-on-white text in Obscura and unstyled gray in Chromium 156.
   - `#txtRepoLabel`: Real panel defect (`panel/index.html:115`). Centered text in `.repo-btn` causes left-side truncation (`ecting repo...`) at 360px viewport.
   - `#btnViewSelect`: Real panel defect (`panel/index.html:3425`). Button lacks `min-width` and shrinks under flex layout, crowding border text in Obscura.
4. **User Alignment Fork:**
   - Choice A: Implement host-compliant HTTP server with `/health` listener on `OPENCHAMBER_SERVICE_PORT` to enable background coordination.
   - Choice B: Formally remove `contributes.service` from `package.json` if background coordination is out of scope.
