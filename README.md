# OpenChamber Task Board

A high-performance, real-time Kanban board and dependency graph extension for [OpenChamber](https://github.com/openchamber), designed for GitHub Issues with autonomous agent sessions and isolated git worktrees.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)
![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen)

---

## Overview

The OpenChamber Task Board bridges the gap between high-level project planning and autonomous AI coding sessions. It displays your GitHub Issues directly alongside live agent runs, checklists, and dependency flows.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Toolbar: [Repo Dropdown] [Search] [Filter] [Refresh] [List|Board|Graph]    │
├──────────────────────────────────────┬──────────────────────────────────────┤
│                                      │ Task Detail Drawer (Slide-In)        │
│  Kanban Board / Dependency Graph     │ • Priority & Complexity labels       │
│  ┌────────────┐  ┌────────────┐      │ • Attached Agent Session / Worktree  │
│  │ Backlog    │  │ In Progress│      │ • Actionable Subtasks Checklist      │
│  │ #42 UI Fix │  │ #38 Auth   │      │ • Open Questions & Clarifications    │
│  └────────────┘  └────────────┘      │ • Blocker & Dependent links          │
│                                      │ • Direct "Start Agent Task" launch   │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### Key Capabilities

- **3 Responsive Layout Views:**
  - **List View:** Compact vertical card stack with tabbed status filtering, designed for narrow sidebar viewports.
  - **Kanban Board:** Multi-column pipeline (`Backlog` -> `To Do` -> `In Progress` -> `In Review` -> `Done`) with drag-and-drop status moves and column collapse.
  - **Waterfall Dependency Graph:** Directed Acyclic Graph (DAG) visualizing blocker relationships, frontier tasks, and cross-theme critical paths with SVG Bézier curves.
- **Side-by-Side Split Push Drawer:**
  - On wide viewports ($\ge 768\text{px}$), opening a task slides the drawer in from the right while smoothly pushing the board to the left. No dark or blurred scrim covers your board.
  - On narrow sidebar viewports ($< 768\text{px}$), the drawer slides in as a full-page view for complete focus.
- **Single-Tap View Cycling in Sidebar:**
  - When horizontal space is constrained in sidebar mode, a dedicated cycle button replaces multi-button groups to rotate between `List` $\rightarrow$ `Board` $\rightarrow$ `Graph` $\rightarrow$ `List` with dynamic icons and tooltips.
- **Ideas Scratchpad with AI Specification Alignment:**
  - Expanded scratchpad modal with theme grouping (`## [Theme: ...]`).
  - Auto-saved to workspace storage.
  - Integrated "Align & Clarify with AI" prompt contract that prompts the agent to explore open questions and ambiguities before committing to code changes.
- **Agent Session & Worktree Reconciler:**
  - Automatically identifies active, running, and idle OpenChamber sessions tied to each issue.
  - Automatically advances issues from `In Progress` to `In Review` when their associated coding session completes.
- **Interactive Markdown Checklists:**
  - Parses `- [ ]` and `- [x]` checklist items directly from issue descriptions.
  - Toggling items updates GitHub Issue markdown remotely in real time.

---

## Installation & Setup

### 1. Placement in OpenChamber Workspace

Clone or place this repository into your workspace extensions folder:

```bash
cd /workspace/extensions
git clone https://github.com/Workflows-Accelerator/openchamber-github-task-board.git github-task-board
cd github-task-board
```

### 2. Install Dependencies & Build

```bash
npm install
npm run build
```

This compiles `panel/main.ts` into a self-contained, browser-compatible IIFE bundle at `panel/main.js` using `esbuild`.

### 3. OpenChamber Manifest Verification

The extension is declared in `package.json`:

```json
{
  "openchamber": {
    "apiVersion": 1,
    "engines": {
      "openchamber": ">=1.22.0"
    },
    "capabilities": ["sessions", "prompt", "files", "filesystem"],
    "contributes": {
      "panel": {
        "id": "github-task-board",
        "name": "Task Board",
        "icon": "icon.svg",
        "entry": "panel/index.html"
      }
    }
  }
}
```

Once installed, "Task Board" appears in the OpenChamber panel tray and browser interface.

---

## Authentication & GitHub Access

The extension automatically discovers authentication credentials through the standard OpenChamber precedence chain:

1. **Workspace Git Credentials:** Extracted from `/workspace/.git-credentials` (PAT tokens formatted as `ghp_...`, `gho_...`, etc.).
2. **Git Configuration:** Extracted from `/workspace/.gitconfig`.
3. **OpenChamber Integration Token:** Provided via the OpenChamber Host API integration registry.

If working on a project without a remote git repository, the extension prompts you to link a target `owner/repo` or select from existing workspace projects.

---

## Development Workflow

### Available Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run build` | Bundles `panel/main.ts` into `panel/main.js` targeting `chrome100` |
| `npm run typecheck` | Validates TypeScript types across the codebase without emitting files |
| `npm test` | Runs all 92 unit and integration tests using Node.js native test runner |

### Project Directory Structure

```
.
├── LICENSE                      # MIT License
├── README.md                     # Technical project documentation
├── CONTRIBUTING.md               # Contribution workflow and coding standards
├── icon.svg                      # Extension icon
├── package.json                  # Manifest, metadata, and build scripts
├── tsconfig.json                 # TypeScript compiler configuration
├── panel/
│   ├── core.ts                   # Pure algorithms (parsers, graph engine, prompts)
│   ├── dropdown.ts               # Custom accessible dropdown component
│   ├── git.ts                    # Remote URL parsers and credential extractors
│   ├── index.html                # Single-page app UI, CSS tokens, and layouts
│   ├── labels.ts                 # Label sanitization, priority, and grouping
│   ├── main.js                   # Shipped esbuild client bundle
│   ├── main.ts                   # Host integration, state store, and DOM wiring
│   ├── markdown.ts               # Markdown renderer and snippet preview
│   ├── types.ts                  # Shared data types and interfaces
│   └── utils.ts                  # String escaping, color sanitizers, logger
└── test/
    ├── ai-prompt.test.js         # Prompt assembly and emoji-free validation
    ├── checklist.test.js         # Interactive checkbox markdown mutators
    ├── dependency-graph.test.js  # DAG layering, cycle checks, and SVG paths
    ├── dropdown.test.js          # Custom dropdown accessibility and state
    ├── label-manager.test.js     # Label operations and taxonomy filtering
    ├── layout-and-views.test.js  # Responsive layout and drawer push tests
    ├── markdown-renderer.test.js # Markdown parsing and XSS escaping
    ├── optimizations.test.js     # Attach payload and debouncing tests
    ├── project-resolver.test.js  # Workspace directory and git matchers
    ├── repo-detector.test.js     # Git config remote URL extraction
    ├── scratchpad.test.js        # Theme header extraction and counting
    ├── shipped-parity.test.js    # AST parity enforcement between core and main.js
    ├── template-manager.test.js  # Issue creation templates
    └── token-extractor.test.js   # Credential and token extraction
```

---

## Architectural Principles

1. **Doubt-Driven Engineering:** Every layout change, parser, and state transition is verified with empirical automated tests. Work is assumed broken until proven by real assertions.
2. **Parity Enforcement:** The pure functions in `panel/core.ts` must maintain complete behavioral parity with the shipped `panel/main.js` bundle. Drift is caught automatically by `test/shipped-parity.test.js`.
3. **Zero Dark / Blur Overlay:** In-app inspection drawers push content aside on wide screens or take over the page on small viewports without blocking or blurring the underlying workspace.
4. **Emoji-Free Prompts:** All system and AI instructions generated for OpenChamber agents strictly forbid emojis to preserve technical brevity and token density.

---

## License

Distributed under the [MIT License](LICENSE). Copyright (c) 2026 Workflows Accelerator.
