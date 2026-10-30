# Preserved Batch Simplify Review & Release Evidence Index

This directory archives the durable verification evidence, review logs, test harnesses, screenshots, and receipts generated during the implementation, hostile review, recheck, staging, and audit of Issue #47 and Issue #48 before worktree retirement.

**Total Artifacts:** 300 files  
**Checksum Manifest:** `checksums.sha256` (100% SHA256 verified)  
**Sanitization:** 100% checked. Contains only synthetic test fixtures and sanitized logs; no live credentials, private keys, or production secrets.

---

## 1. Issue #47 Fresh App Sign-in

- **Source Worktree:** `.worktrees/team-dev-issue-47-fresh-app-signin`
- **Branch:** `fix/issue-47-fresh-app-stay-signed-in` (retained at HEAD `268bd28738443863d6a58b5e4500ad20b6aaa05f`)
- **Master Ancestry:** Verified ancestor of `ab7516c4a3634c3d69f7b82936ddb7655d327ebb` (local & remote `master`)
- **Total Files Archived:** 6 files
- **Subdirectories:**
  - `issue-47-fresh-app-signin/issue-47-isolation-review/` (1 file)
    - `verifications/proof.md`: Independent adversarial isolation review proof.
  - `issue-47-fresh-app-signin/issue-47-session-hardening/` (5 files)
    - `harnesses/test_http_restart.mjs`: HTTP restart and cookie lifecycle test harness.
    - `harnesses/test_restart_behavior.mjs`: Server process restart persistence harness.
    - `verifications/proof.md`: Session hardening verification proof.
    - `verifications/test_http_restart.log`: Execution log of HTTP restart test.
    - `verifications/test_restart_behavior.log`: Execution log of process restart test.

---

## 2. Issue #48 Panel Simplified Views

- **Source Worktree:** `.worktrees/team-dev-issue-48-panel-simple-views`
- **Branch:** `feat/issue-48-panel-simple-views` (retained at HEAD `c9fb61b8f4d7fa2178481abaff588b2e23b8380e`)
- **Master Ancestry:** Verified ancestor of `ab7516c4a3634c3d69f7b82936ddb7655d327ebb` (local & remote `master`)
- **Total Files Archived:** 90 files
- **Subdirectories:**
  - `issue-48-panel-simple-views/issue-48-panel-correction/` (30 files)
    - Browser verification harness (`browser.mjs`), test logs, scratch bundle, DOM screenshots (cards, drafts, graph, kanban, pending, simple across 360px and 980px viewports), and verification proof.
  - `issue-48-panel-simple-views/issue-48-panel-hostile/` (32 files)
    - Hostile review harness (`browser.mjs`), test and diff logs, scratch bundle, defect discovery screenshots, and adversarial proof.
  - `issue-48-panel-simple-views/issue-48-panel-recheck/` (28 files)
    - Recheck verification harness (`browser.mjs`), test logs, scratch bundle, re-validation screenshots, and final recheck proof.

---

## 3. Issue #48 Web Simplified Views

- **Source Worktree:** `.worktrees/team-dev-issue-48-web-simple-views`
- **Branch:** `feat/issue-48-web-simple-views` (retained at HEAD `d5a205da26827d0555824339fcb14c9a39d7af7f`)
- **Master Ancestry:** Verified ancestor of `ab7516c4a3634c3d69f7b82936ddb7655d327ebb` (local & remote `master`)
- **Total Files Archived:** 182 files
- **Subdirectories:**
  - `issue-48-web-simple-views/issue-48-web-correction/` (81 files)
    - Standalone board verification harness, server bundle, test reports, responsive screenshots across 360/390/1280 viewports, and correction proof.
  - `issue-48-web-simple-views/issue-48-web-hostile/` (51 files)
    - Adversarial isolated browser harnesses, runtime results, diff logs, defect discovery screenshots (view sheet, add row, multiline description, reorder), and hostile proof.
  - `issue-48-web-simple-views/issue-48-web-recheck/` (50 files)
    - Standin fixtures, browser verification logs, responsive validation screenshots, and recheck proof.

---

## 4. Staging & Release Verification

- **Source Worktree:** `.worktrees/team-dev-batch-simplify-staging`
- **Branch:** `feat/batch-simplify-staging` (retained at checkpoint commit `76fd5e1` following release commit `01f8d94` and staging merge `ab7516c`)
- **Total Files Archived:** 22 files
- **Subdirectories:**
  - `staging/batch-simplify-staging/` (15 files)
    - Staging preview server configuration, logs, PID record, preserved candidate proofs, responsive screenshots, and integration proof.
  - `staging/batch-simplify-release/` (3 files)
    - Release verification proof (`verifications/proof.md`) and live login screenshots (`public-login-360.png`, `public-login-desktop.png`).
  - `staging/batch-simplify-release-audit/` (3 files)
    - Independent audit verification proof (`verifications/proof.md`) and audit login screenshots (`public-login-360.png`, `public-login-desktop.png`).
  - `staging/outputs/` (1 file)
    - `batch-simplify-release-receipt.original.md`: Original release receipt produced prior to manager audit annotation.
