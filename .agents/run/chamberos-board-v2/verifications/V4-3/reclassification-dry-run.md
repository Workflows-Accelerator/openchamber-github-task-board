# V4-3 reclassification dry run — inventory only

Date: 2026-11-13. Branch: feat/board-v3 at 007f342 (V4-3 live as b85676f-20261113).
**Nothing was written to GitHub.** Every GitHub call in this step was a read: `gh repo list`,
`gh repo view`, `gh issue list`, `gh issue view`, `gh label list`. No label was created, no body
edited, no comment posted, no issue closed or reopened.

## 1. Repository set and its source

The board has no repository list file. `web/server/config.ts` keeps `BOARD_REPO` as an optional
single entry and `web/server/repositories.ts` builds the allowlist from token-visible discovery
(`GET /user/repos`, affiliation `owner,collaborator,organization_member`); the owner ruling of
2026-10-24 (`.agents/run/task-centred-architecture/outputs/board-all-repositories-ruling.md`) states
"the board is meant to be for all repos" and that `BOARD_REPO` is "one entry/fallback, not the
universe". So the configured set is every repository the board token can see.

Sources used (no secret file read):
- `web/server/repositories.ts` and `web/server/github.ts` — the discovery rule (affiliation and endpoint).
- `gh repo list Workflows-Accelerator --limit 200` — the organisation's repositories.
- `gh repo list --limit 200` — the token account's own repositories.
- `.agents/run/task-centred-architecture/tasks/board-deployment-preflight-current.md` — records the
  reviewed base `BOARD_REPO` as `Workflows-Accelerator/openchamber-github-task-board`.

Result: **27 repositories**, all reachable, all with issues enabled (`gh repo view` per repo):

- Workflows-Accelerator/Client-Portal-Webapp — open issues: 0
- Workflows-Accelerator/Coding-Skills — open issues: 0
- Workflows-Accelerator/Document-Generator — open issues: 0
- Workflows-Accelerator/PARRIS-meet-and-confer-discovery — open issues: 11
- Workflows-Accelerator/acquisition — open issues: 0
- Workflows-Accelerator/ai-call — open issues: 0
- Workflows-Accelerator/case-management-platform — open issues: 62
- Workflows-Accelerator/chambervoice — open issues: 9
- Workflows-Accelerator/code-test — open issues: 0
- Workflows-Accelerator/devops-cockpit — open issues: 26
- Workflows-Accelerator/e2e-discussions-20260723 — open issues: 0
- Workflows-Accelerator/e2e-test — open issues: 0
- Workflows-Accelerator/integracion-github — open issues: 0
- Workflows-Accelerator/ironcore-frontline — open issues: 35
- Workflows-Accelerator/local-dev-preview — open issues: 0
- Workflows-Accelerator/mvp-branch-e2e-20260721 — open issues: 0
- Workflows-Accelerator/n8n-cli — open issues: 2
- Workflows-Accelerator/n8n-rocket-chat-antigravity — open issues: 0
- Workflows-Accelerator/openchamber-config — open issues: 35
- Workflows-Accelerator/openchamber-github-task-board — open issues: 48
- Workflows-Accelerator/openchamber-triggers — open issues: 1
- Workflows-Accelerator/prompt-and-furious-podcast — open issues: 0
- Workflows-Accelerator/testing — open issues: 3
- Workflows-Accelerator/website — open issues: 0
- Workflows-Accelerator/workflows-systems — open issues: 0
- workflows-accelerator-agent/ironcore — open issues: 0
- workflows-accelerator-agent/n8n-templates — open issues: 0

## 2. Method

Artifact verdicts are the shipped parser, not a re-implementation: `parseHumanReview` from
`web/server/board.ts` at 007f342, bundled with the repository's own esbuild and run over every
open issue body captured with `gh issue list --json body,labels,comments`. `state: ready` is the
only state that counts as a clickable human artifact (image, video, link, or a question with
preset answers and no answer yet).

Rule operationalised (stated so it is auditable):
- `status:needs-human` and no ready artifact -> `status:todo`.
- `status:in-review` and no ready artifact -> `status:todo` only where the thread shows the review
  finished or abandoned: a terminal agent comment (verdict, pause, release receipt), or no comment
  at all and no activity for 30 days or more.
- `status:in-review`, no artifact, and an agent comment within 7 days that says a review or
  verification is running -> left alone, bucket "agent review in flight".
- `status:in-review`, no artifact, and neither terminal nor in flight -> "needs your call".
- No status label, or a status the rule does not name -> "stays" (no change proposed). The board
  resolves an unlabelled issue to the todo stage already, so no label is missing there.

## 3. Counts

| Bucket | Count |
|---|---|
| will change | 67 |
| stays (no change proposed) | 160 |
| agent review in flight | 5 |
| needs your call | 0 |
| **total open issues** | **232** |

Change detail: 45 x `status:needs-human -> status:todo`,
22 x `status:in-review -> status:todo`. The five task-board issues that were
"needs your call" moved to "will change" after the check in section 8. Every proposed
change targets `status:todo`, which exists in all five affected repositories. No issue carries two
status labels; every body parsed (no unparseable body); no issue has a ready artifact anywhere.

## 4. Full table

### Workflows-Accelerator/PARRIS-meet-and-confer-discovery (11 open)

| Repo | # | Title | Status | Artifact | Evidence | Bucket | Action |
|---|---|---|---|---|---|---|---|
| PARRIS-meet-and-confer-discovery | 13 | Document Ingestion (Upload & N8N Hook) | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| PARRIS-meet-and-confer-discovery | 12 | Case Workspace (Grouped List & Steppers) | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| PARRIS-meet-and-confer-discovery | 9 | PRD: Case-as-Container Architecture | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| PARRIS-meet-and-confer-discovery | 8 | [HITL] N8N Sync & Cutover | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| PARRIS-meet-and-confer-discovery | 7 | [AFK] Migration Bridge: Move Existing Responses | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| PARRIS-meet-and-confer-discovery | 6 | [AFK] Discovery Actions: The Document Level | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| PARRIS-meet-and-confer-discovery | 5 | [AFK] Case Container: Meta-only Legal Cases | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| PARRIS-meet-and-confer-discovery | 4 | [AFK] N8N-as-Code Framework (TS) | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| PARRIS-meet-and-confer-discovery | 3 | [AFK] Foundation: Organizations, Lawyers & RLS | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| PARRIS-meet-and-confer-discovery | 2 | [AFK] Initialize Drizzle & discovery_mc Schema | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| PARRIS-meet-and-confer-discovery | 1 | PRD: Case Container & Organization Refactor | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |

### Workflows-Accelerator/case-management-platform (62 open)

| Repo | # | Title | Status | Artifact | Evidence | Bucket | Action |
|---|---|---|---|---|---|---|---|
| case-management-platform | 301 | feat(ai-connect-ui): Connect AI Profile Hub, Device Approval Page, .mcpb Bundle, and Installer | status:in-review | missing | agent comment 2026-11-11: Wave 2 engineer worker dispatched | inflight | leave as is |
| case-management-platform | 300 | feat(ai-workflows): Discovery Workflows, Deadlines, Client Tasks, and Time Billing Domain | status:in-review | missing | agent comment 2026-11-12: "Still being fixed in this round" | inflight | leave as is |
| case-management-platform | 299 | feat(ai-docs): Documents, Templates, Redline Edits, and Signed File Export Domain | status:in-review | missing | agent comment 2026-11-11: Wave 2 engineer worker dispatched | inflight | leave as is |
| case-management-platform | 298 | feat(ai-cases): Cases, Plaintiffs, Roster Addresses, and AI Search Domain | status:in-review | missing | agent comment 2026-11-11: "Independent hostile review is now active" | inflight | leave as is |
| case-management-platform | 297 | feat(ai-core): Core CommandKernel, Scoped Credentials, single-tool MCP, and 6-Laws Suite | status:in-review | missing | agent comment 2026-11-11: combined verification branch running; "independent review is not complete" | inflight | leave as is |
| case-management-platform | 296 | feat(ai-interface): Unified AI Interface (cmpx CLI, single-tool MCP, and Connect AI Hub) | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 163 | bug: Address 404 dark mode styling, PFS wizard form bugs, client accessibility controls, call language updates, and test coverage. | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 162 | enhancement: Enhance Hans AI chat with document context, case advisor workflow rules, and Motion to Compel AI file selector. | status:backlog | missing | rule does not apply to this status | stays | none |
| case-management-platform | 161 | enhancement: Improve user authorization, shell account handling, metadata persistence upon deletion, and login usability. | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 160 | enhancement: Improve client portal time tracking reliability using localStorage heartbeat persistence. | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 159 | enhancement: Extend tasks, calendaring, and messaging tools to mobile viewports, and enable PWA push notifications. | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 158 | enhancement: Enhance Plaintiff Full Page with Other Parties tab, fix jitteriness, support close-range maps, and resolve portal status mismatch. | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 157 | enhancement: Diagnose and optimize application caching, memory leaks, cache cleaning rules, and skeleton loading screens. | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 156 | enhancement: Improve deadlines, timeline views, calendar integration, date formats, and title formatting. | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 155 | enhancement: Redesign Case Overview and Executive Briefing layout, incorporating card configurations, phase progress indicators, and UI optimizations. | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 154 | enhancement: Improve Process wizard guidance, onboarding walkthroughs, and cohort selection/filtering capabilities. | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 153 | enhancement: Overhaul Case Files (Documents) tab to support review workflow, AI document generation, custom templates, and flexible mass tort options. | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 152 | enhancement: Unify dropdowns, tabs, notifications, and navigation styling across the portal for design consistency. | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 103 | enhancement: Trial by Fire Objections Training UI | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 102 | enhancement: Breathing Dojo Waveform and Audio Guides | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 101 | enhancement: Trial Mode Dashboard | status:in-review | missing | only comment is a human epic note (2026-07-01); no agent review comment; no activity for 135 days | change | status:in-review -> status:todo |
| case-management-platform | 100 | enhancement: Broadcast Messaging Tests and Internal Thread Mentions | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 96 | enhancement: Client Portal Smart AI Flow & Done Animation | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 95 | enhancement: Time Tracking Upgrades: Idle Detection, Popup, and Session Widget | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 94 | enhancement: Meet & Confer Multi-Document Selection & Graph View | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 91 | enhancement: Advanced Dojo Training with Simulated Experts and Judges | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 90 | enhancement: Attorney Billing Rates in Admin Panel | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 88 | enhancement: Case Assignments and Access Restrictions | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 87 | enhancement: Role-Based Access Control (RBAC) & RLS Rewrite | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 86 | enhancement: SCIM Webhook Handler for Provisioning | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 82 | Client Portal Notification Preferences and DB Settings Integration | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 79 | enhancement: AI Co-work document generation session (NotebookLM style) | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 78 | enhancement: Motion workflows: document selection, Notice of Motion, and Motion to Compel proposed orders | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 77 | enhancement: Discovery response deadlines & Motion to Compel warning engine | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 76 | enhancement: Propounding workflows: SRG, FRG, DFP, and RFA Meet & Confer generation | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 74 | enhancement: Client email and phone change request workflow with lawyer verification | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 72 | enhancement: AI Reporting System for custom SQL/UI reports and PDF/Excel export | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 71 | enhancement: Case View Pinning and chrome-like workspace tabs navigation | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 70 | enhancement: Hybrid search engine for events and case reference materials | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 69 | enhancement: Expert Witness Management schema and tracking UI | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 68 | enhancement: Case Deadlines & Calendaring Engine with county rule sets, manual overrides, and recurring reminders | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 66 | enhancement: Live Document Generator with case-data interpolation and MS Word export | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 65 | enhancement: Document Template Management and storage system | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 64 | enhancement: Docketing System Epic - Routing, Notifications, Westlaw, and DocketView Dashboard | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 63 | enhancement: AI Workbench backend API and frontend UI overhaul | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 62 | enhancement: Events page detail and tracking UI consistency overhaul | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 61 | enhancement: Plaintiffs management page design and responsiveness overhaul | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 60 | enhancement: Documents page premium design and layout overhaul | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 59 | enhancement: Mailroom (Secure Inbox) design and filter consistency overhaul | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 40 | n8n: Implement client attention alerts and SMS notifications | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 37 | enhancement: Compliance Audit Trails and Supabase Logging System | status:todo | missing | rule does not apply to this status | stays | none |
| case-management-platform | 36 | enhancement: Task-to-Time Logging Mode for Staff | status:in-review | missing | only comment is a human epic note (2026-07-01); no agent review comment; no activity for 134 days | change | status:in-review -> status:todo |
| case-management-platform | 33 | enhancement: Developer UX & Settings UI Refinement | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 31 | enhancement: Gamified Client Reminders & n8n Notifications | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 20 | bug: Folder Page unit test router.replace type error | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 19 | bug: Calendar Page unit test timeout waiting for Chevron Motion Objection | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 17 | enhancement: In-app brief drafting workspace | status:draft | missing | rule does not apply to this status | stays | none |
| case-management-platform | 16 | enhancement: Westlaw API Case Law Citation Checker & side-by-side viewer | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 14 | enhancement: Case handoff wizard and prompt injection helper | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 12 | enhancement: Make AI team member a selectable and lockable option | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 8 | enhancement: Separate Discovery folder set filters into Type and Set Number dropdowns | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| case-management-platform | 7 | enhancement: Cross-team matter sharing drawer and Case Messages chat integration | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |

### Workflows-Accelerator/chambervoice (9 open)

| Repo | # | Title | Status | Artifact | Evidence | Bucket | Action |
|---|---|---|---|---|---|---|---|
| chambervoice | 12 | chore(voice): event-driven alerts, cleanup, cancellation | status:todo | missing | rule does not apply to this status | stays | none |
| chambervoice | 11 | feat(voice): stop a running session by voice | status:todo | missing | rule does not apply to this status | stays | none |
| chambervoice | 10 | feat(voice): verification walkthrough before closing issues | status:todo | missing | rule does not apply to this status | stays | none |
| chambervoice | 9 | feat(voice): dangerous-command permission safeguards | status:todo | missing | rule does not apply to this status | stays | none |
| chambervoice | 8 | fix(voice): surface and attribute subagent questions reliably | status:todo | missing | rule does not apply to this status | stays | none |
| chambervoice | 7 | feat(voice): route task board issues to the active project repo | status:todo | missing | rule does not apply to this status | stays | none |
| chambervoice | 6 | feat(voice): team roster visibility and deltas (Phase 1) | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| chambervoice | 5 | feat(voice): compress the call tool surface (Phase 1) | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| chambervoice | 4 | fix(voice): restore session idle notifications suppressed by duplicate-prevention safety measures | status:in-progress | missing | rule does not apply to this status | stays | none |

### Workflows-Accelerator/devops-cockpit (26 open)

| Repo | # | Title | Status | Artifact | Evidence | Bucket | Action |
|---|---|---|---|---|---|---|---|
| devops-cockpit | 28 | feat(cli): support global PATH invocation, decouple hardcoded client constants, and wire devops feedback | status:draft | missing | rule does not apply to this status | stays | none |
| devops-cockpit | 25 | [Blocked] n8ncli environment-setup primitive | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| devops-cockpit | 24 | [Safety] Per-client read-only mode | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| devops-cockpit | 23 | [Roadmap] CI scaffold | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| devops-cockpit | 22 | [Roadmap] Live Hetzner DNS driver test (needs delegated zone and DNS token) | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| devops-cockpit | 21 | [Roadmap] Rotate leaked credentials post-purge | status:in-review | missing | no comments; no activity since 2026-09-28 (46 days) | change | status:in-review -> status:todo |
| devops-cockpit | 20 | [M6] Multi-server management, Beszel broadcast, and backup parity (card 20) | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| devops-cockpit | 19 | [M5] Admin and user account automation with Resend invites (card 19) | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| devops-cockpit | 18 | [M5] Email listener engine with IMAP and Resend fallback (card 18) | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| devops-cockpit | 17 | [M5] Bitwarden cipher module and parent vault linkage (card 17) | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| devops-cockpit | 16 | [M5] Client versioning and CLI release hygiene (card 16) | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| devops-cockpit | 15 | [M5] Global CLI configuration file (card 15) | status:draft | missing | rule does not apply to this status | stays | none |
| devops-cockpit | 14 | [M4] Per-client credential vault with SOPS and Age (card 14) | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| devops-cockpit | 13 | [M4] Age key ceremony, backup, and recovery (card 13) | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| devops-cockpit | 12 | [M3] Live slice proof on acme-test twice (card 12) | status:in-review | missing | last agent comment 2026-09-28: hostile review NOT READY, defects queued for the offline repair card; nothing since (46 days) | change | status:in-review -> status:todo |
| devops-cockpit | 11 | [M3] Cost accounting and overnight sweeper (card 11) | status:in-review | missing | no comments; no activity since 2026-09-28 (46 days) | change | status:in-review -> status:todo |
| devops-cockpit | 10 | [M2] Failed-run recovery and partial-state reconciliation (card 10) | status:in-review | missing | no comments; no activity since 2026-09-28 (46 days) | change | status:in-review -> status:todo |
| devops-cockpit | 9 | [M2] State receipts and receipt-bounded teardown engine (card 09) | status:in-review | missing | no comments; no activity since 2026-09-28 (46 days) | change | status:in-review -> status:todo |
| devops-cockpit | 8 | [M1] Validator JSON contract and manager hardening (card 08) | status:in-review | missing | no comments; no activity since 2026-09-28 (46 days) | change | status:in-review -> status:todo |
| devops-cockpit | 7 | [M1] Compose stacks repair and network architecture (card 07) | status:in-review | missing | no comments; no activity since 2026-09-28 (46 days) | change | status:in-review -> status:todo |
| devops-cockpit | 6 | [M0] Cloud provider and DNS driver seam abstraction (card 06) | status:in-review | missing | no comments; no activity since 2026-09-28 (46 days) | change | status:in-review -> status:todo |
| devops-cockpit | 5 | [M0] Linux portability and defect closure sweep (card 05) | status:draft | missing | rule does not apply to this status | stays | none |
| devops-cockpit | 4 | [M0] Target resolution and engine metadata fixes (card 04) | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| devops-cockpit | 3 | [M0] Credential purge, leak inventory, and history scan (card 03) | status:in-review | missing | no comments; no activity since 2026-09-25 (49 days) | change | status:in-review -> status:todo |
| devops-cockpit | 2 | [M0] Unified mutation guard and destructive path audit (card 02) | status:in-review | missing | no comments; no activity since 2026-09-25 (49 days) | change | status:in-review -> status:todo |
| devops-cockpit | 1 | [M0] Baseline commit and tree hygiene (card 01) | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |

### Workflows-Accelerator/ironcore-frontline (35 open)

| Repo | # | Title | Status | Artifact | Evidence | Bucket | Action |
|---|---|---|---|---|---|---|---|
| ironcore-frontline | 67 | [MODE-01] Hybrid Mode Architecture: Unified Menu for Co-op PvE Campaign & Standalone PvP Arena | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 66 | [NET-01] Co-op PvE Multiplayer Networking: P2P Host/Client State Sync for Squad Missions | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 33 | [DATA-01] Faithful re-port of Iron Core tactical data: 15 enemy archetypes, weapon pairings & AI parameters | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 32 | [ECONOMY-02] 3D Hangar Armory: Weapon Rack, 4-Zone Chassis Upgrades & Module Shop | status:todo | missing | rule does not apply to this status | stays | none |
| ironcore-frontline | 31 | [ECONOMY-01] Mission Wave Progression, Scrap Salvage Bounty & Insurance Payouts | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| ironcore-frontline | 30 | [CAMPAIGN-03] 4 Sector Boss Encounters: Warden Prime, Pyre, Obelisk, Kraken V | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| ironcore-frontline | 29 | [CAMPAIGN-02] AI Enemy Archetypes: Scouts, Swarms, Brawlers, Assassins, Snipers, Heavies | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 28 | [CAMPAIGN-01] 6 Hazard Biomes: Scrapyard, Volcanic Rift, Frozen Waste, Toxic Basin, Orbital Deck, Ruined City | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| ironcore-frontline | 27 | [AUX-03] 7 Active Powers (EMP Blast, Nano Swarm, Phase Shift, Overload, Barrier) | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 26 | [AUX-02] Mounted Utility: Kinetic Repulsor Blast, Magnetic Harpoon & Attack Drone | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 25 | [AUX-01] Mounted Defensives: Ablative Energy Shield & Nanite Repair Bay | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| ironcore-frontline | 24 | [DAMAGE-04] Pilot Rodeo Mechanics: Boarding Enemy Mechs & Battery Core Disruption | status:todo | missing | rule does not apply to this status | stays | none |
| ironcore-frontline | 23 | [DAMAGE-03] Cockpit HUD Glitch Shaders & Tactile Malfunction Feedback | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| ironcore-frontline | 22 | [DAMAGE-02] Subsystem Paralysis States: Optics Blind, Arm Jam, Core Stall, Leg Rupture | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| ironcore-frontline | 21 | [DAMAGE-01] 4-Zone Hit Detection Engine (Head Sensors, Arm Mounts, Core, Leg Struts) | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 20 | [WEAPON-07] 4 Boss Signature Weapons: Pyre Melter, Obelisk Piercer, Kraken Tempest | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 19 | [WEAPON-06] Hydraulic Melee: Piston Blade Dash Strike & Warden Guillotine Cleaver | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 18 | [WEAPON-05] Elemental Weapons: Arc Tesla Chain Stun, Napalm Jet & Glacial Cryo Beam | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 17 | [WEAPON-04] Guided Ordnance: Hellfire Pod Lock-On Missiles & Cluster Barrage Rain | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 16 | [WEAPON-03] Directed Energy: Continuous Ion Beam, Plasma Lance & Warp Disruptor | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 15 | [WEAPON-02] Energy Slugs: High-Velocity Railgun Breach & Gauss Flak Physics | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 14 | [WEAPON-01] Ballistic Archetypes: Vulcan Autocannon & Scattergun Spread 3D FX | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| ironcore-frontline | 13 | [MECH-04] Seamless Pilot Embark, Disembark, Auto-Titan Guard Mode & Ejection | status:todo | missing | rule does not apply to this status | stays | none |
| ironcore-frontline | 12 | [MECH-03] Titanfall Atmospheric Orbital Drop Sequence & Kinetic Dome Shield | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 11 | [MECH-02] First-Person Cockpit 3D Interior, Multi-Function Displays & Heat Gauges | status:todo | missing | rule does not apply to this status | stays | none |
| ironcore-frontline | 10 | [MECH-01] Modular Biped Walker Geometry with Dual Left/Right Arm Hardpoints | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 9 | [PILOT-04] Pilot Anti-Mech Arsenal (Charge Rifle, Mag Launcher & Thermite Ordnance) | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| ironcore-frontline | 8 | [PILOT-03] Pilot Tactical: Grappling Hook Wire & Momentum Swing Physics | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| ironcore-frontline | 7 | [PILOT-02] Pilot Parkour: Wall-Running Physics & Camera Tilt | status:todo | missing | rule does not apply to this status | stays | none |
| ironcore-frontline | 6 | [PILOT-01] Pilot Parkour: Jump-Jet Double Jump & Power Slide Locomotion | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 5 | [MOBILE-03] Mobile Cockpit Touch Mode & Dual Hardpoint Weapon Triggers | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 4 | [MOBILE-02] Dynamic Contextual Action Triggers for Mobile (Embark / Titanfall / Eject) | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 3 | [MOBILE-01] Responsive Dual-Thumb Mobile Touch Overlay (Joystick + Aim Swipe + Dynamic Triggers) | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 2 | [CORE-02] Three.js Procedural Shader & Asset Pipeline Optimization for Mobile Web | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| ironcore-frontline | 1 | [CORE-01] Deploy Live Game Preview on Hetzner via Coolify and DevOps CLI | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |

### Workflows-Accelerator/n8n-cli (2 open)

| Repo | # | Title | Status | Artifact | Evidence | Bucket | Action |
|---|---|---|---|---|---|---|---|
| n8n-cli | 2 | feat(feedback): wire n8ncli feedback subcommand to shared oc-feedback reporter | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| n8n-cli | 1 | feat(inspect): add TypeScript-first workflow inspect command (topology, --node snippet, --json with tsCode) | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |

### Workflows-Accelerator/openchamber-config (35 open)

| Repo | # | Title | Status | Artifact | Evidence | Bucket | Action |
|---|---|---|---|---|---|---|---|
| openchamber-config | 76 | fix(delegate): a stopped child keeps sending stalled notices | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| openchamber-config | 75 | fix(delegate): interrupt for follow-ups and explain how to resume idle children | status:in-progress | missing | rule does not apply to this status | stays | none |
| openchamber-config | 74 | docs(repomap): --help omits unscanned_files and truncated; proof overstates one finding | status:todo | missing | rule does not apply to this status | stays | none |
| openchamber-config | 73 | fix(audit): build-skill check prints 12/12 while 13 exist on disk | status:todo | missing | rule does not apply to this status | stays | none |
| openchamber-config | 72 | feat(worktree): retire finished worktrees safely and autonomously | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-config | 71 | feat(engine): durable, verifiable delivery for synthetic messages | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| openchamber-config | 67 | feat(skills): project-specific skill router plus global-vs-project skill conventions | status:todo | missing | rule does not apply to this status | stays | none |
| openchamber-config | 63 | fix(worktree): refuse cleanup while live sessions still reference the worktree | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-config | 62 | fix(idle-nontext-detector): clear the compaction latch when compaction ends | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-config | 61 | fix(idle-nontext-detector): enforce agent exclusions and directory checks for restart-orphan resumes | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-config | 60 | fix(delegate): read child transcripts chronologically so a stale interruption is not terminal | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-config | 59 | fix(delegate): make completion wake delivery durable across restarts | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| openchamber-config | 58 | feat(skills): one authoritative meta skill for the skill map, layout rules, and adding a skill | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-config | 53 | feat(modularity): split openchamber-core from declarative client-pack.json overlay and add nightly oc-sterilize check | status:planned | missing | rule does not apply to this status | stays | none |
| openchamber-config | 52 | feat(orchestration): retire .agents/run state for GitHub Issues, grant team read-only repo access, and enforce asymmetric worker/intern routing | status:planned | missing | rule does not apply to this status | stays | none |
| openchamber-config | 51 | feat(skills): author agent-cli-design skill and concise AGENTS.md surgical tray cards | status:planned | missing | rule does not apply to this status | stays | none |
| openchamber-config | 50 | feat(cli): ship zero-dep oc-repomap (50ms symbol map) and deterministic oc-worktree CLI | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-config | 49 | feat(skills): audit, prune, and modernize redundant skills and onboard new skill packs (design, video) | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-config | 48 | feat(skills): expose only directory router skills via autoinvoke:false and unlock skill access | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-config | 47 | fix(9router): prevent ag cloak from corrupting opencode paths, tool names, and skill IDs | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-config | 46 | feat(runtime): bake global domain CLIs and boot-time oc-doctor into Dockerfile and entrypoint | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-config | 45 | feat(feedback): provide agent feedback tool with session and tool-call context for automated issue filing | status:planned | missing | rule does not apply to this status | stays | none |
| openchamber-config | 42 | v2-native subagents in worktrees — team toolset, permissions, skills | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-config | 41 | Bug: finish batch-drain never delivers to parent (subscription notifications lost) | status:in-review | missing | agent comment 2026-09-24: paused, builder session stopped "and will not be resumed" | change | status:in-review -> status:todo |
| openchamber-config | 40 | Bridge spawn envelope gaps: late prompt rejections escape; agent name mismatch | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| openchamber-config | 39 | Bug: session.messages returns empty for v2 sessions (scoping) | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-config | 38 | fix(plugins): v2 rejects every v1 plugin — port openchamber-bridge, then drop-continue | status:in-review | missing | agent comment 2026-09-24 is a final verification-record correction; no review running since (50 days) | change | status:in-review -> status:todo |
| openchamber-config | 37 | feat(bridge): see and answer questions and permission requests (chambervoice parity) | status:todo | missing | rule does not apply to this status | stays | none |
| openchamber-config | 32 | fix(worktree): build artifacts accumulate in worktrees and are never reclaimed | status:todo | missing | rule does not apply to this status | stays | none |
| openchamber-config | 30 | feat(context): structured timeline compaction for indefinitely running sessions | status:in-review | missing | agent comment 2026-09-24 re-scope note; no review activity since (50 days) | change | status:in-review -> status:todo |
| openchamber-config | 29 | feat(context): protect question and decision tool output from compaction pruning | status:in-review | missing | agent comment 2026-09-24 re-scope note; no review activity since (50 days) | change | status:in-review -> status:todo |
| openchamber-config | 26 | feat(agent): supervised review gate and safe merge workflow in session launch prompts | status:todo | missing | rule does not apply to this status | stays | none |
| openchamber-config | 25 | feat(worktree): server git service bootstrap audit (symlink node_modules, copy env, clean branches) | status:todo | missing | rule does not apply to this status | stays | none |
| openchamber-config | 24 | feat(planning): file conflict detection and parallel workstream planning skill | status:todo | missing | rule does not apply to this status | stays | none |
| openchamber-config | 19 | feat(lifecycle): codify 7-stage engineering cycle and align AI task prompts | status:todo | missing | rule does not apply to this status | stays | none |

### Workflows-Accelerator/openchamber-github-task-board (48 open)

| Repo | # | Title | Status | Artifact | Evidence | Bucket | Action |
|---|---|---|---|---|---|---|---|
| openchamber-github-task-board | 71 | D3: Merge into master and clean up merged worktrees, each behind a confirmation click | status:planned | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 70 | D2: Commit, push the feature branch and open a pull request from the board | status:planned | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 69 | D1: Create and prepare worktrees from the board, including the next ready task | status:planned | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 68 | C4: Publish the new board at board.workflows.ac with documented environment variables | status:planned | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 67 | C3: Run button starts a real OpenChamber session from the issue front matter | status:planned | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 66 | C2: Screenshots committed to a board-assets branch in each repository | status:planned | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 65 | C1: Quick capture structured by the D1 model with created, edit and undo notice | status:planned | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 64 | B4: Template issue that shows every board capability | status:planned | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 63 | B3: GitHub Discussions view with read, reply, start and turn into issue | status:planned | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 62 | B2: Rich issue drawer with markdown, link viewer, YouTube, questions and human tasks | status:planned | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 61 | B1: Priority, size, ready-to-run and backburner labels plus full front matter editor | status:planned | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 60 | A5: Sidebar sections Decisions, Blocked, Operations, Archive and Client view on real data | status:in-review | missing | agent comment 2026-11-05 says "An adversarial review is running"; no completion comment 8 days later | call | none |
| openchamber-github-task-board | 59 | A4: Markdown notes under cards and a dependency-aware Arrange button | status:in-review | missing | agent comment 2026-11-04 says "An independent hostile review is active"; no completion comment 9 days later | call | none |
| openchamber-github-task-board | 58 | A3: Canvas links backed by GitHub blocked-by dependencies, addable and deletable | status:in-review | missing | no comments at all; status:in-review set 2026-11-04 (9 days ago); no evidence the review started or ended | call | none |
| openchamber-github-task-board | 57 | A2: Infinite canvas with fine dot grid and saved card positions | status:in-review | missing | no comments at all; status:in-review set 2026-11-04 (9 days ago); no evidence the review started or ended | call | none |
| openchamber-github-task-board | 56 | A1: V1 board shell on real data with sidebar, List view, themes and language switch | status:in-review | missing | no comments at all; status:in-review set 2026-11-04 (9 days ago); no evidence the review started or ended | call | none |
| openchamber-github-task-board | 55 | Board V2: rebuild the web board from the V1 design with real data | status:planned | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 54 | The online board opens straight to my tasks when I'm already signed in | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-github-task-board | 53 | The online board looks and feels like the OpenChamber task board | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-github-task-board | 52 | Worktree sessions report "has no Git remote" | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| openchamber-github-task-board | 44 | Import new specialized skills and directory skill structure | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-github-task-board | 43 | Launch video and marketing website for CMP project | status:draft | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 39 | Front desk agent for tasks | status:draft | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 38 | Incomplete tasks stay in draft | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-github-task-board | 37 | Every repository on one board | status:in-review | missing | agent comment 2026-10-27: release receipt, multi-repository board integrated and released to master | change | status:in-review -> status:todo |
| openchamber-github-task-board | 36 | Only a person closes a task | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-github-task-board | 35 | Other board writes keep their edits through a refresh | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-github-task-board | 34 | Answering a question saves the answer you see | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-github-task-board | 33 | A board in your browser for the tasks you own | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-github-task-board | 32 | Prove a worker can resume from its issue alone | status:draft | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 31 | Questions and alerts reach the right person | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-github-task-board | 30 | Features and bugs follow the right path | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-github-task-board | 29 | Agents work directly from sub-issues | status:draft | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 28 | Opening the board shows current tasks | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-github-task-board | 27 | Keep the task board open in its own web page | status:in-progress | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 26 | All work runs from the task board | status:draft | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 24 | fix(board): load the current session repository and make switching reliable | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-github-task-board | 23 | feat(board): Human Tasks, All Tasks, and Questions views | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-github-task-board | 22 | feat(board): Human Tasks contract, human to-do extraction, and status semantics v1 | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-github-task-board | 21 | docs(skill): issue-lifecycle skill for team agents | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-github-task-board | 20 | fix(board): idle agent sessions auto-move issues to in-review | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| openchamber-github-task-board | 19 | fix(board): background page streaming drops input focus by re-rendering all views | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| openchamber-github-task-board | 18 | fix(board): rate-limit backoff missing on single-repo fetch and mutation paths | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| openchamber-github-task-board | 17 | fix(voice): voice taskboard queries 404 in All Projects mode | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| openchamber-github-task-board | 15 | fix(scratchpad): prevent cross-repository overwrite and data loss on repo switch and background events | status:todo | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 14 | feat(board): notify the agent when every human task on an issue is completed (Draft) | status:needs-human | missing | body has no "### Human Review:" section | change | status:needs-human -> status:todo |
| openchamber-github-task-board | 12 | feat(board): batch-level human review gate before any issue reaches Done | status:todo | missing | rule does not apply to this status | stays | none |
| openchamber-github-task-board | 10 | feat(board): subscribe to sessions across all projects in All Projects mode | status:todo | missing | rule does not apply to this status | stays | none |

### Workflows-Accelerator/openchamber-triggers (1 open)

| Repo | # | Title | Status | Artifact | Evidence | Bucket | Action |
|---|---|---|---|---|---|---|---|
| openchamber-triggers | 1 | Make triggers easy to configure | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |

### Workflows-Accelerator/testing (3 open)

| Repo | # | Title | Status | Artifact | Evidence | Bucket | Action |
|---|---|---|---|---|---|---|---|
| testing | 6 | Feature: Implement simulated flaky and long-running tests | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| testing | 5 | Feature: Support local testing configuration files (.env or config.json) | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |
| testing | 4 | Feature: Stream live server console logs using WebSockets | none | missing | no status label; board resolves unlabelled issues to todo | stays | none |

## 5. Per-repository label inventory

Target labels for this rule are `status:todo`, `status:needs-human`, `status:in-review`. No label is
proposed for creation; a missing label would make an issue "needs your call" instead.

| Repository | Open | status:* labels present | Target labels | Changes proposed |
|---|---|---|---|---|
| Workflows-Accelerator/Client-Portal-Webapp | 0 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| Workflows-Accelerator/Coding-Skills | 0 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| Workflows-Accelerator/Document-Generator | 0 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| Workflows-Accelerator/PARRIS-meet-and-confer-discovery | 11 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| Workflows-Accelerator/acquisition | 0 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| Workflows-Accelerator/ai-call | 0 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| Workflows-Accelerator/case-management-platform | 62 | status:draft, status:backlog, status:todo, status:in-review | status:todo yes, status:needs-human NO, status:in-review yes | 2 |
| Workflows-Accelerator/chambervoice | 9 | status:draft, status:backlog, status:planned, status:todo, status:in-progress, status:in-review, status:needs-human, status:done, status:needs-alignment | status:todo yes, status:needs-human yes, status:in-review yes | 2 |
| Workflows-Accelerator/code-test | 0 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| Workflows-Accelerator/devops-cockpit | 26 | status:draft, status:todo, status:in-progress, status:in-review, status:needs-human, status:done | status:todo yes, status:needs-human yes, status:in-review yes | 14 |
| Workflows-Accelerator/e2e-discussions-20260723 | 0 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| Workflows-Accelerator/e2e-test | 0 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| Workflows-Accelerator/integracion-github | 0 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| Workflows-Accelerator/ironcore-frontline | 35 | status:todo, status:needs-human | status:todo yes, status:needs-human yes, status:in-review NO | 10 |
| Workflows-Accelerator/local-dev-preview | 0 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| Workflows-Accelerator/mvp-branch-e2e-20260721 | 0 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| Workflows-Accelerator/n8n-cli | 2 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| Workflows-Accelerator/n8n-rocket-chat-antigravity | 0 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| Workflows-Accelerator/openchamber-config | 35 | status:draft, status:backlog, status:planned, status:todo, status:in-progress, status:in-review, status:needs-human, status:done, status:needs-alignment | status:todo yes, status:needs-human yes, status:in-review yes | 17 |
| Workflows-Accelerator/openchamber-github-task-board | 48 | status:draft, status:backlog, status:planned, status:todo, status:in-progress, status:in-review, status:needs-human, status:done, status:needs-alignment | status:todo yes, status:needs-human yes, status:in-review yes | 22 |
| Workflows-Accelerator/openchamber-triggers | 1 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| Workflows-Accelerator/prompt-and-furious-podcast | 0 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| Workflows-Accelerator/testing | 3 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| Workflows-Accelerator/website | 0 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| Workflows-Accelerator/workflows-systems | 0 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| workflows-accelerator-agent/ironcore | 0 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |
| workflows-accelerator-agent/n8n-templates | 0 | none | status:todo NO, status:needs-human NO, status:in-review NO | 0 |

Every repository where a change is proposed has `status:todo`: openchamber-github-task-board,
openchamber-config, devops-cockpit, chambervoice, ironcore-frontline. Repositories missing a target
label (case-management-platform lacks `status:needs-human`; ironcore-frontline lacks
`status:in-review`; openchamber-triggers, n8n-cli, PARRIS-meet-and-confer-discovery and testing have
no `status:*` labels at all) contain no issue this rule would change.

## 6. Parser agreement (step 5)

Built the live board payload locally from the synthetic fixture in `web/tests/fake-github.mjs`
(eight issues: image, video, link, question, answered question, javascript: URL, http image, no
section), started the real server through `web/tests/helpers.mjs`, and compared
`/api/board` items with the offline verdicts:

- Payload `humanReview.state` matched the offline classification for 8 of 8 issues
  (ready, ready, ready, ready, settled, malformed/invalid_url, malformed/insecure_url, missing).
- The board's own status-entry gate agreed 8 of 8: entering `status:needs-human` returned 200 for
  the four ready artifacts and 400 `human_review_required` for settled, malformed and missing.

The rule and the shipped parser agree; no parser bug was found and no source change was made.

## 7. Limits of this inventory

- Open pull requests that reference an issue were not listable while sections 1–7 were
  written (`gh pr list` was not authorised then), so "in flight" rested on issue comments
  alone and five task-board issues sat in "needs your call". Section 8 performs that check
  under a later authorisation and resolves all five. `gh api` and `gh search` remain
  unauthorised, so a pull request in a different repository that mentions these issues is
  still unverified.
- Repositories where the token is only a collaborator of a third-party owner cannot be enumerated
  by `gh repo list`; `GET /user/repos` (the endpoint the board itself uses) is blocked here. The
  set above is the complete owner + organisation_member set for this token.

## 8. PR and timeline check for the five ambiguous issues

Date: 2026-11-13. **Nothing was written to GitHub.** Calls used: `gh pr list --repo
Workflows-Accelerator/openchamber-github-task-board --state all --search "<n> in:body"`,
`gh pr list --state all --limit 100`, `gh issue view <n> --json
state,labels,updatedAt,closedAt,comments` and `gh issue view <n> --comments`. No `gh api`, no
comment, no label change.

The repository holds exactly two pull requests: #45 (merged 2026-10-28, head
`feat/issue-31-mobile-pwa`) and #25 (open since 2026-10-08, head `fix/oversized-issue-pages`).
Neither touches #56–#60 and every `<n> in:body` search returned no result. The search syntax was
sanity-checked against a known reference: "40 in:body" is also empty because #45 names its issues
in the title, not the body, so the empty result is a real absence, not a broken query. No pull
request exists for head branch `feat/chamberos-board-v2`, the branch the A4 and A5 comments name.

Evidence outside the issue thread, read from the local repository (branch `feat/chamberos-board-v2`,
worktree `.worktrees/team-dev-chamberos-board-v2`):

- A1, A2 and A3 each carry a committed proof plus an independent audit dated 2026-11-04
  (`5e38193` A1, `af6f066` A2, `d0d5b72` A3).
- `A5/independent/audit-findings.md`, final repair audit 2026-11-06: "A5 Spec Verdict: PASS;
  A5 Quality Verdict: APPROVED; A4 Spec Verdict: PASS; A4 Quality Verdict: APPROVED."
- `A-delivery/hostile4/report.md`, 2026-11-08: "Spec: PASS … Quality: APPROVED … PROCEED: ready
  for human validation only."
- `A-delivery/wave1-release-receipt.md`, 2026-11-11: the A1–A5 foundation deployed live to
  `https://board.workflows.ac`, and "Zero issues closed; all issues #53–#71 remain in their
  current open state."

| Issue | PR evidence | Last activity | Verdict | Reasoning |
|---|---|---|---|---|
| #56 A1 | none: no PR references it; the only PRs in the repo are #45 (merged) and #25 (open, unrelated); no PR for `feat/chamberos-board-v2` | 2026-11-04T02:14Z (label set; zero comments ever) | change to todo | The A1 audit is committed and the A1–A5 foundation was released live on 2026-11-11, so the review finished and nothing is in flight. |
| #57 A2 | none: same as #56 | 2026-11-04T09:24Z (label set; zero comments ever) | change to todo | Same terminal evidence: the A2 audit is committed and the foundation shipped live, leaving no in-flight review. |
| #58 A3 | none: same as #56 | 2026-11-04T17:44Z (label set; zero comments ever) | change to todo | Same terminal evidence: the A3 audit is committed and the foundation shipped live, leaving no in-flight review. |
| #59 A4 | none: no PR references it; the comment names `feat/chamberos-board-v2`, which has no PR | 2026-11-04T21:38Z (agent comment "An independent hostile review is active") | change to todo | The comment is 9 days old with nothing after it, and the review it announced ended in the recorded A4 PASS/APPROVED verdict, so it is stale, not in flight. |
| #60 A5 | none: no PR references it; the comment names `feat/chamberos-board-v2`, which has no PR | 2026-11-05T22:04Z (agent comment "An adversarial review is running") | change to todo | The comment is 8 days old with nothing after it, and the review it announced ended in the recorded A5 PASS/APPROVED verdict, so it is stale, not in flight. |

All five move from "needs your call" to "will change". New totals: will change 67, stays 160,
agent review in flight 5, needs your call 0, total 232; change detail 45 x
`status:needs-human -> status:todo` and 22 x `status:in-review -> status:todo`. The
openchamber-github-task-board row in section 5 is updated from 17 to 22 to match.

Not verified: a pull request in a different repository that mentions these issues. `gh api` and
`gh search` are outside the authorised command set, so only this repository's pull requests and the
issues' own timelines were checked.
