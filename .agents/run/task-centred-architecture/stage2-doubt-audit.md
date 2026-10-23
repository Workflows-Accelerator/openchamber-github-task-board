# Doubt-Driven Development Audit: Stage 2 (Coordinator Pilot & UI Surfaces)

Date: 2026-10-23
Methodology: Doubt-Driven Development (`$doubt-driven-development`)
Status: EVALUATED

---

## 1. Objective of Doubt
Subject proposed Stage 2 plans, assumptions, and architectural components to adversarial scrutiny before authoring task briefs or committing application code. Operate strictly read-only and assume proposals are broken until empirically proven.

---

## 2. Skeptical Audit of Stage 2 Premises

### Premise 1: "Implement Single-Writer Host Extension Daemon"
- **Doubt:** Does OpenChamber's extension system actually provide a manifest declaration or runtime hook for running an unattended background daemon process outside the panel iframe lifecycle?
- **Finding:**
  Inspection of `package.json` (`openchamber.contributes`) confirms:
  ```json
  "contributes": {
    "panel": { "id": "github-task-board", "entry": "panel/index.html" }
  }
  ```
  OpenChamber manifest has NO `"daemon"`, `"service"`, or `"background"` entrypoint for extensions.
  An extension is loaded as an iframe when the user opens the panel. When the panel is closed or another tab is selected, the iframe lifecycle is suspended or destroyed by the host.
- **Critical Failure Mode:**
  Attempting to write a "host extension daemon" inside `panel/` will result in code that dies whenever the user closes the panel, failing the primary goal of unattended execution.
- **Remedy / Architectural Stance:**
  Do NOT build speculative daemon infrastructure inside the panel. Decouple Stage 2 into:
  - **Stage 2A (UI Surface Integration):** Hook verified Stage 1 primitives into `panel/main.ts` and `panel/index.html` to give the user immediate interactive Attention Queues and 4-axis card badges.
  - **Stage 2B (Host Coordinator Probe & Pilot):** Conduct an empirical probe of existing host execution vectors:
    1. *Route A (OpenChamber Scheduled Task):* Uses host tool `openchamber schedule.create` to run an unattended background reconciliation pass on a cron schedule.
    2. *Route B (OpenCode Plugin Daemon):* Runs as an engine-level plugin in `/workspace/config/opencode/plugins/`.
    3. *Route C (Active Panel Loop):* Unattended while panel is focused; pauses when closed (documented fallback).

---

### Premise 2: "Render 4-Axis Badges on Every Issue Card"
- **Doubt:** Adding 4 independent axis badges (`phase`, `attention`, `liveness`, `dependency`) will cause severe visual bloat and card vertical inflation, especially in the narrow 360px sidebar mode.
- **Finding:**
  Cards already contain: Title, Subtitle, Priority badge, Complexity badge, Subtask progress bar, Question count badge, Blocker chips, and Session status indicators.
  Adding 4 permanent badges will double card height and push tasks off-screen.
- **Remedy / Invariant:**
  - **Zero-Badge for Neutral States:**
    - `attention: none` -> Render NO badge.
    - `liveness: idle` / `completed` -> Render NO badge.
    - `dependency: ready` -> Render NO badge (blockers are already shown via blocker chips).
  - **Alert-Only Attention Badges:**
    - `attention: needs-decision` -> Amber badge (`needs-decision`)
    - `attention: needs-permission` -> Purple badge (`needs-permission`)
    - `attention: needs-review` -> Blue badge (`needs-review`)
  - **Minimal Phase Indicator:**
    - Single compact phase label (e.g. `exploration`, `planning`, `execution`) styled quietly alongside the existing category/priority tags.

---

### Premise 3: "Attention Queue as another Column Filter Tab"
- **Doubt:** If Human Attention is orthogonal to workflow phase, adding it as another horizontal column tab (alongside `Draft`, `Todo`, `In-Progress`, etc.) recreates the exact state tangling Stage 1 was designed to eliminate!
- **Finding:**
  In legacy v1, `status:needs-human` was a sequential column, which meant tasks lost their engineering phase when waiting for a decision.
  Placing `Attention` as a column tab invites users and agents to treat it as a phase.
- **Remedy / Invariant:**
  Incorporate Attention into the **View Mode** layer (alongside `Human Tasks`, `All Tasks`, `Questions`), or enhance the existing `Human Tasks` view into a unified **Attention Action Queue** with filters for:
  - `[All Attention | Needs Decision | Needs Permission | Needs Review]`
  This reinforces that Attention is an action queue across all phases.

---

### Premise 4: "Coordinator Writes Directly to GitHub Issue Bodies"
- **Doubt:** GitHub Issue REST API does not support Compare-And-Swap (CAS) or If-Match headers on issue PATCH. Concurrent writes between an unattended agent and a human editing the issue body via GitHub web UI will silently overwrite user text.
- **Finding:**
  Ruling B3 strictly mandates: "No supported issue mutation CAS means fresh-read/text matching and revision comments are risk reduction, not atomic protection against human edits. Prefer narrow append/patch operations, conflict detection/readback and explicit recovery; state residual race honestly."
- **Remedy / Invariant:**
  The pilot coordinator must:
  1. Use SHA-256 pre-flight check of the issue body before applying regex checklist mutations.
  2. If the SHA has changed since the task was claimed, abort write and emit a `needs-decision` conflict alert.
  3. Prefer durable comment ledgers for attempt logs rather than continuously rewriting the issue body.

---

## 3. Risk Matrix & Verdict

| Risk ID | Severity | Description | Mitigation |
| :--- | :--- | :--- | :--- |
| **CR-01** | **Catastrophic** | Premature host daemon implementation on non-existent extension manifest schema. | Decouple Stage 2 into 2A (UI Surface) and 2B (Host Runtime Probe & Pilot). |
| **CR-02** | **Catastrophic** | Blind issue body overwrite during concurrent agent/human editing. | Enforce SHA pre-flight check, narrow checklist mutations, and conflict escalation. |
| **MR-01** | **Moderate** | Visual card bloat from rendering 4 permanent axis badges in sidebar mode. | Adopt alert-only badge policy (render only when attention != none or liveness == running). |
| **MR-02** | **Moderate** | Column tab tangling where Attention is misrendered as a sequential phase. | Place Attention in dedicated View Mode action queue, preserving phase column independence. |
| **MR-03** | **Moderate** | Excessive GitHub API polling by background loops exhausting token quota. | Mandate `since=` watermark incremental syncing and 304 ETag caching. |
| **LR-01** | **Low** | Minor CSS overflow in mobile responsive drawer when viewing Acceptance Criteria. | Add overflow scroll box and max-height constraints. |

---

## 4. Hostile Review Verdict

**VERDICT: PROCEED-WITH-CONDITIONS**

### Conditions for Proceeding:
1. **Scope Slicing:** Author and execute **Stage 2A: UI Surface Integration** first. Wire up `groupIssuesByAttention`, alert-only attention badges, and acceptance criteria drawer/card views in `panel/main.ts` and `panel/index.html`.
2. **Strict Badge Minimalism:** Do not render badges for `none`, `idle`, or `ready` states. Keep cards dense, readable, and vertically restrained.
3. **Stage 2B Host Discovery Gate:** Defer background coordinator daemon coding until an empirical host probe confirms the exact execution route (OpenChamber scheduled task adapter vs OpenCode plugin daemon).
