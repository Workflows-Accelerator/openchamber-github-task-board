# A1–A5 Foundation Human Review Guide

## 1. Preview Access & Isolation

- **Preview URL:** `http://127.0.0.1:4041`
- **Health Check:** `http://127.0.0.1:4041/health`
- **Synthetic Preview Password:** `correct-horse-battery-staple` (test fixture password from `web/tests/helpers.mjs`, used only for this isolated synthetic preview)
- **Data Source:** Isolated in-process synthetic GitHub server (`http://127.0.0.1:44149`) with zero live GitHub API calls and zero access to `/workspace/.openchamber-data/board/`.
- **Network / Ingress Limit:** The preview server binds to `127.0.0.1:4041` inside the workspace container so it never touches the live production board on `127.0.0.1:8787` (`https://board.workflows.ac`). To view `http://127.0.0.1:4041` from an external workstation browser, forward port `4041` (for example `ssh -L 4041:127.0.0.1:4041 <host>`) or attach a temporary preview ingress route.

---

## 2. Synthetic Dataset Loaded in the Preview

The preview server seeds two projects (`owner/repo` and `owner/other-repo`) to exercise multi-project and cross-repository flows:

1. **`owner/repo#1` — Deploy edge authentication middleware (`status:needs-human`, `priority:high`, `ready-to-run`):**
   - Includes YAML front matter (`agent`, `model`, `worktree`), an open question under `## Open Questions`, two checkboxes under `## Human Tasks`, and an attached yellow Markdown sticky note on the canvas.
2. **`owner/repo#2` — Audit canvas layout and dependency wires (`status:in-progress`, `priority:high`):**
   - Placed at `(540, 120)` and blocked by `owner/repo#1`.
3. **`owner/repo#3` — Draft internal telemetry spike (`status:draft`):**
   - Visible in normal mode; automatically hidden when Client Presentation Mode is active.
4. **`owner/repo#4` — Legacy webhook cleanup (`status:backlog`, `backburner`):**
   - Appears in the `Backburner` tab of `Archive & Backburner`.
5. **`owner/repo#5` — Cut over edge routing table (`status:todo`, `priority:medium`):**
   - Blocked by both `owner/repo#1` (same repo) and `owner/other-repo#10` (cross-repo dependency).
6. **`owner/repo#6` — Bootstrap V1 warm-paper theme tokens (`closed`, `status:done`):**
   - Appears in `Archive & Backburner` -> `Archived (closed)` with a `Reopen` action and in `Operations` 7-day closed metrics.
7. **`owner/other-repo#10` — Publish upstream identity schema v2 (`status:in-progress`, `priority:high`):**
   - Cross-repository blocker for `owner/repo#5` and same-repo blocker for `owner/other-repo#11`.
8. **`owner/other-repo#11` — Consumer SDK migration guide (`status:todo`):**
   - Blocked by `owner/other-repo#10`.

---

## 3. Guided Walkthrough Checklist (A1–A5)

1. **A1 — Shell, Theme, Bilingual Toggle, and Project Picker:**
   - Toggle light (V1 Warm Paper) and dark themes via the sidebar theme button.
   - Toggle `EN` / `FR` via `#lang-switch-btn` and verify all sidebar items, section headers, and status labels switch language immediately.
   - Switch between `All Projects`, `Repo`, and `Other` using the top-left project picker (`#repo-select-btn`) and confirm the active section stays open.
2. **A2 & A3 — Infinite Canvas & Dependency Wires:**
   - Open `Canvas` (`#nav-canvas`). Pan, zoom (`-`, `100%`, `+`), drag cards, and inspect cubic Bezier dependency wires.
   - Hover or focus a wire to inspect its endpoints; click a wire to trigger the confirmation popover before deletion, or drag from a card's right connector dot to another card to add a dependency.
   - Open `owner/repo#5` in the detail drawer and click the cross-repo dependency chip (`Other #10`) to jump directly to `owner/other-repo#10`.
3. **A4 — Sticky Notes, Safe Markdown, and Topological Arrange:**
   - On `Canvas`, double-click or click `Edit` (`Modifier`) on the yellow sticky note attached to `#1` to edit Markdown, change note color swatches, drag, or resize from the bottom-right handle.
   - Click `Arrange` (`#canvas-arrange`), select `Only unplaced cards` or `All cards`, run auto-arrange, and test `Undo` (`#canvas-arrange-undo`).
4. **A5 — Decisions, Blocked, Operations, Archive, and Client Presentation Mode:**
   - **Decisions (`#nav-decisions`):** Answer the open question on `owner/repo#1`.
   - **Blocked (`#nav-blocked`):** Toggle the two `Human Tasks` checkboxes on `owner/repo#1` and inspect the dependency blockers on `#2`, `#5`, and `#11`.
   - **Operations (`#nav-operations`):** Review active tasks, blocked count, open questions, 7-day closed count, oldest open in-progress tasks, and the 8-column per-project status breakdown.
   - **Archive & Backburner (`#nav-archive`):** Switch between `Backburner` (`#4`, with `Remove backburner`) and `Archived (closed)` (`#6`, with `Reopen`).
   - **Client Presentation Mode (`#nav-client`):** Enable Presentation Mode (`#client-toggle-btn`). Verify the top disclaimer banner appears, `status:draft` (`#3`), canvas sticky notes, YAML front matter, open questions, human tasks, and internal labels (`ready-to-run`) are hidden across all views while `status:todo` and `status:planned` tasks remain visible.

---

## 4. Open Human Policy Item to Confirm Before Live Cutover

- **Manual `Reopen` Destination Status (`web/server/app.ts:2191`):**
  - When a user clicks `Reopen` on a closed issue in `Archive & Backburner`, the server reopens the GitHub issue (`state: 'open'`), removes `status:done`, and currently assigns `status:backlog`.
  - **Decision requested:** Confirm whether manual `Reopen` from Archive should continue assigning `status:backlog` (current behavior) or assign a different status label (such as `status:todo`).
