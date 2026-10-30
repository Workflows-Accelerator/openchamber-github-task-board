# Batch Alignment Decisions — Mobile Parity, Offline Drafting & Visual Polish (Batch 1)

**Date:** Wed Oct 28 2026  
**Scope:** Batch 1 of 2-stage mobile overhaul  
**Aligned with User:** Confirmed via interactive alignment gate  

---

## Aligned Decisions

### Decision 42: Align Drafts Placement
- **Standalone Web Board (`web/`):** Remove the "Align Drafts" button completely from the web board header and Draft column.
- **OpenChamber Extension (`panel/`):** Keep the "Align Drafts" button strictly inside the OpenChamber desktop panel where full AI agent sessions reside. Provide sleek, unobtrusive UI feedback: progress spinner, active draft count, disabled state during alignment, and explicit toast with count of aligned issues.

### Decision 43: Web & Mobile Task Detail Parity
- **Friendly Titles:** Parse friendly titles from Markdown headings (`### Friendly Title: ...`), showing the clear, positive output title as the primary card text and the raw title as a muted subtitle.
- **Task Detail Drawer:** Clicking/tapping any task card on web/mobile opens a slide-out drawer matching OpenChamber panel parity.
- **Interactive Checklists:** One-tap toggling of Actionable Subtasks and Acceptance Criteria checkboxes with precise line-index markdown updates and optimistic state.
- **Inline Question Answering:** Open questions display directly in the drawer with options, freeform response inputs, and immediate answer saving to GitHub.
- **Status & Done Management:** Allow transitioning task status and marking tasks done directly from the drawer.

### Decision 44: Offline Drafting
- When network is offline or `POST /api/repos/:owner/:repo/issues` fails due to connectivity:
  - Persist draft item to `localStorage` key `openchamber_offline_drafts`.
  - Display item in the Draft column immediately with a quiet `(offline)` badge.
  - Automatically flush/drain queued drafts to GitHub when `navigator.onLine` fires or upon next board load, removing them from `localStorage` once confirmed.

### Decision 45: Polished PWA App Icons
- Deliver crisp, modern, high-contrast PWA icons:
  - `icon.svg`: Scalable vector icon
  - `icon-192.png`: 192x192 for Android / mobile home screens
  - `icon-512.png`: 512x512 for splash screens and PWA install dialogs
  - `apple-touch-icon.png`: 180x180 for iOS Safari home screen bookmarks
- Register all icons in `web/public/manifest.json` and `<link rel="apple-touch-icon">` in `web/public/index.html`.

### Decision 46: 2-Stage Rollout Sequence
- **Stage 1 (Current):** Full Parity + Offline Drafting + Polished Icons.
- **Stage 2 (Following):** Web Push Notifications for lock-screen questions and alerts (completing Issue #31).
