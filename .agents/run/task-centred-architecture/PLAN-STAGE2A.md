# Stage 2A Implementation Plan: UI Surface & Attention Queue Integration

Date: 2026-10-23
Methodology: Doubt-Driven Development (`$doubt-driven-development`)
Base Branch: `feat/v2-binding-and-ratelimit`
Worktree: `.worktrees/team-dev-stage2a-attention-views`
Feature Branch: `feat/stage2a-attention-views`

---

## 1. Context & Objectives
Stage 1 landed the 4-axis orthogonal state model (`phase`, `attention`, `liveness`, `dependencyState`), section-scoped checklist parsing (`parseAcceptanceCriteria`, `parseSubtasks`), and in-memory attention grouping primitives (`groupIssuesByAttention`, `filterIssuesByAttention`) in `panel/core.ts` with 386/386 passing tests.

Per the Doubt-Driven Development audit (`stage2-doubt-audit.md`), building a speculative host daemon inside the panel iframe was halted because OpenChamber extension manifests do not declare background services. Stage 2 is decoupled:
- **Stage 2A (This Plan):** Connect verified Stage 1 primitives to the panel UI: interactive Attention View, alert-only card badges, and drawer Acceptance Criteria checklist with write-back.
- **Stage 2B (Subsequent Phase):** Zero-edit host runtime probing of execution hooks (scheduled task adapter vs engine plugin) and pilot coordinator daemon.

---

## 2. Invariants & Guardrails
1. **Alert-Only Badge Policy:** Never render neutral state badges (`attention: none`, `liveness: idle`/`completed`, `dependency: ready`). Badges appear ONLY when attention is required or worker is actively running, preventing visual clutter in 360px sidebar mode.
2. **Attention as View Mode, NOT Column:** Attention is an orthogonal action queue across all phases, not a sequential column tab.
3. **Acceptance Criteria Isolation:** AC checklist in drawer updates `issue.acceptanceCriteria` via existing markdown mutators with line-index precision; subtasks checklist remains strictly isolated.
4. **Zero Regressions:** All 386 existing tests must remain green; bundle rebuild must maintain shipped parity (`test/shipped-parity.test.js`).
5. **No Blind Overwrites:** Checkbox mutations in the drawer use existing optimistic locking and fresh-read paths.

---

## 3. Decomposed Task Breakdown

### Task 201: Attention View & Action Sub-Queues
- **Target Files:** `panel/index.html`, `panel/main.ts`
- **Scope:**
  - Add Attention View button to toolbar (`#btnViewAttention`, `data-mode="attention"`).
  - Add layout menu items (`#viewOptAttention` in `#viewSelectMenu`, `#menuItemViewAttention` in sidebar overflow).
  - Update `activeLayout` type union to include `'attention'`.
  - Add container `<main class="attention-view" id="attentionViewContainer" style="display: none;"></main>`.
  - Implement `renderAttentionView(issues: Issue[])` using `groupIssuesByAttention(issues)`.
  - Render 3 distinct actionable queue sections:
    1. **Needs Decision:** Issues with open questions or pending design decisions.
    2. **Needs Permission:** Issues blocked on agent tool/permission approval.
    3. **Needs Review:** Issues with completed work awaiting human validation.
  - Implement sub-filter pills: `[All Attention (N) | Needs Decision (A) | Needs Permission (B) | Needs Review (C)]`.
  - Clean empty state banner when no tasks need attention.

### Task 202: Alert-Only Card Badge Chips & Drawer Acceptance Criteria
- **Target Files:** `panel/main.ts`, `panel/index.html`
- **Scope:**
  - In `panel/main.ts` card rendering (`renderCard` / `renderIssueCard`):
    - Compute alert badges from `issue.v2Metadata`:
      - `attention === 'needs-decision'` -> Amber badge chip `needs-decision`
      - `attention === 'needs-permission'` -> Purple badge chip `needs-permission`
      - `attention === 'needs-review'` -> Blue badge chip `needs-review`
      - `liveness === 'running'` -> Pulsing badge chip `running`
      - Neutral states produce zero badge HTML.
  - In `panel/index.html`:
    - Add `#drawerAcceptanceCriteriaSection` with `#drawerAcceptanceCriteriaContainer` and `#drawerAcceptanceCriteriaCountBadge` inside the drawer right next to subtasks.
  - In `panel/main.ts`:
    - Implement `renderDrawerAcceptanceCriteria(issue: Issue)` populating the container from `issue.acceptanceCriteria`.
    - Wire interactive checkbox toggling using `updateSubtaskInMarkdown` (acceptance criteria items are `Subtask` objects with accurate `lineIndex`).
    - Optimistic update, count badge recalculation, and background PATCH dispatch.

### Task 203: Automated Test Suite & Shipped Bundle Parity
- **Target Files:** `test/stage2a-attention-ui.test.js`, `panel/main.js`, `test/shipped-parity.test.js`
- **Scope:**
  - Author comprehensive test suite `test/stage2a-attention-ui.test.js` covering:
    - DOM layout elements present in `panel/index.html`.
    - Attention View rendering, grouping, count calculations, and sub-filter toggling.
    - Alert-only card badge logic (asserting zero badges on neutral states, correct chips on alert states).
    - Drawer Acceptance Criteria rendering, count badge format, and checkbox toggle event wiring.
  - Rebuild `panel/main.js` via `npm run build`.
  - Verify `test/shipped-parity.test.js` and all existing 386 tests pass (target: >= 400 total passing tests).

### Task 204: Hostile Adversarial Review (L4)
- **Scope:**
  - Worker conducts hostile review of all Stage 2A changes with the mandatory prompt.
  - Verify edge cases: missing `v2Metadata`, 360px sidebar wrapping, XSS escaping in badges/AC, drawer race conditions, keyboard accessibility.
  - Report findings and confirm PROCEED verdict before integration.

### Task 205: Integration Merge of Stage 2A
- **Scope:**
  - Merge `feat/stage2a-attention-views` into `feat/v2-binding-and-ratelimit`.
  - Rebuild bundle, run full test suite, remove feature worktree (preserve branch).
  - Present results to user and transition to Stage 2B.
