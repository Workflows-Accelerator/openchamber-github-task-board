# ChamberOS Board V2: Comprehensive Technical Discovery & Architecture Report

- **Date:** 2026-11-03
- **Author:** System Subagent (`engineer`)
- **Mission:** `chamberos-board-v2`
- **Base Commit:** `a8ccc7a`
- **Worktree:** `/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2`
- **Scope:** Technical comparison of V1 prototype (`tmp/chamberos_ai_native_github_openchamber_operating_system.html`), V2 prototype (`tmp/webapp-v2.html`), the live Task Board backend (`web/server/`), and OpenChamber System 1 (D1) model orchestration.

---

## 1. Executive Summary & Architecture Overview

The ChamberOS Task Board is evolving from a standalone GitHub issue viewer into an AI-native operational steering system. This transition bridges two prototypes:
1. **Prototype V1 (`tmp/chamberos_ai_native_github_openchamber_operating_system.html`, 3,916 lines):** A calm, spacious, typography-driven UI emphasizing warm ivory/paper tones, generous node spacing (370px horizontal, 195px vertical), clean typography, and a grounded right drawer. All data is hardcoded in memory with zero backend calls.
2. **Prototype V2 (`tmp/webapp-v2.html`, 2,603 lines):** An expanded feature prototype introducing YAML frontmatter editing, interactive questions, human attention gates, sticky notes, minimap, dynamic wire flows, and rich media previews. However, V2 introduced severe regressions: visual overcrowding, broken canvas dot scaling, artificial coordinate bounding, non-functional DAG auto-layout, undeletable dependency links, unstyled sticky note DOM stacking, and complete reliance on browser `localStorage`.
3. **Live Production Board Backend (`web/server/`, `service/`, `/workspace/releases/board/current`):** A robust Node.js server managed under a standalone shell supervisor (`supervisor.sh`). It exposes authenticated endpoints (`/api/board`, `/api/combined/board`, `/api/issues`, `/api/repos`, `/api/session`), safe section parsers (`web/server/sections.ts`), atomic CAS leases (`service/cas.ts`), and an 8-stage lifecycle model (`status:draft` through `status:done`).

The mission of Board V2 is to combine the aesthetic restraint and calm spatial UX of V1 with the operational depth of V2 (frontmatter, interactive decision gates, media embeds, sticky notes), directly wired to the real GitHub backend and OpenChamber System 1 ("D1") fast structuring engine.

---

## 2. Canvas De-Zoom Dots Scaling Bug

### 2.1 Symptom & Visual Artifact
When users zoom out on the spatial canvas (scaling down from `1.0` to `0.45` or `0.40`), the background dot grid becomes dense, dark, and overwhelming. Rather than receding into the background as an unobtrusive texture, the dots appear to grow larger relative to the grid cells, suffocating cards and wires.

### 2.2 Root Cause Analysis

#### In V1 (`tmp/chamberos_ai_native_github_openchamber_operating_system.html`)
In V1, the dot grid CSS is declared on `#canvas-viewport`:
```css
.canvas-dot-grid {
  background-image: radial-gradient(#C8C0B3 1.3px, transparent 1.3px);
  background-size: 24px 24px;
}
```
The pan/zoom physics function (`updateCanvasTransform()`, line 2527) only modifies the child element `#ideation-canvas-plane`:
```javascript
plane.style.transform = `translate3d(${Math.round(canvasPanX)}px, ${Math.round(canvasPanY)}px, 0px) scale(${canvasScale.toFixed(2)})`;
```
The viewport background never updates. As the user pans, the dots remain stationary. As the user zooms, the cards shrink, but the dots stay fixed at 24px spacing in screen space, breaking spatial immersion.

#### In V2 (`tmp/webapp-v2.html`)
V2 attempted to make the dot grid pan and zoom dynamically. In `applyCanvasTransform()` (lines 1426-1430):
```javascript
if (viewport) {
  const gridStep = 24 * scale;
  viewport.style.backgroundSize = `${gridStep}px ${gridStep}px`;
  viewport.style.backgroundPosition = `${panX}px ${panY}px`;
}
```
However, the CSS background image on `.canvas-dot-grid` remains static:
```css
.canvas-dot-grid {
  background-color: #F4EFEA;
  background-image: radial-gradient(#C2B9AA 1.35px, transparent 1.35px);
  background-size: 24px 24px;
}
```
The mathematical flaw is immediate:
- At `scale = 1.0`, `gridStep = 24px`. Each dot has a radius of `1.35px` (diameter `2.7px`). The dot accounts for `2.7 / 24 = 11.25%` of the cell width.
- At `scale = 0.40`, `gridStep = 24 * 0.40 = 9.6px`. The radial gradient radius is **still hardcoded to 1.35px**. Each dot still has a diameter of `2.7px`. The dot now consumes `2.7 / 9.6 = 28.1%` of the cell width.
The dots occupy 2.5 times more visual surface per cell. Optical density triples, turning a subtle dot grid into heavy polka dots.

### 2.3 Required Architecture Fix
To eliminate this artifact, choose one of two verified approaches:
1. **Dynamic Gradient Radius Scaling (CSS property update):**
   When updating `viewport.style.backgroundSize`, update `viewport.style.backgroundImage` synchronously:
   ```javascript
   const dotRadius = Math.max(0.6, 1.35 * scale);
   viewport.style.backgroundImage = `radial-gradient(rgba(194, 185, 170, ${Math.min(1, scale * 0.9)}) ${dotRadius.toFixed(2)}px, transparent ${dotRadius.toFixed(2)}px)`;
   viewport.style.backgroundSize = `${gridStep.toFixed(2)}px ${gridStep.toFixed(2)}px`;
   viewport.style.backgroundPosition = `${panX}px ${panY}px`;
   ```
   Fading dot opacity linearly below `0.7` scale ensures distant dots naturally recede without visual noise.
2. **SVG Pattern on `#canvas-plane`:**
   Alternatively, place an `<svg>` dot pattern inside `#canvas-plane`. Because the entire plane undergoes CSS `transform: scale()`, the dots naturally scale down with the nodes without requiring JavaScript recalculations on every wheel frame.

---

## 3. Layout Differences: V1 vs V2

### 3.1 Why V1 UX & Layout is Superior
- **Calm & Grounded Atmosphere:** V1 respects generous negative space. Node bodies are constrained to 250px width, separated by at least 370px horizontally and 195px vertically.
- **Natural Sentence Case:** Labels avoid uppercase aggression. Buttons and titles read like natural prose (`Operations`, `Ideation`, `Decisions`, `Blocked`, `Discussions`).
- **Grounded Controls:** Dropdowns and menus open as soft popovers with subtle borders (`rgba(24, 22, 19, 0.08)`), rather than high-contrast floating modals.
- **Restrained Hover Actions:** Node actions appear only on deliberate node hover as an elegant floating mini-toolbar 8px above the top-right corner.

### 3.2 What V2 Added
1. **YAML Frontmatter Inspection & Custom Fields:** An interactive card in the issue drawer displaying raw frontmatter, client visibility, assigned agent, model tier, worktree target, and custom metadata keys.
2. **Rich Link & Asset Cards:** Structured previews for URLs, including YouTube player embeds and Bates-stamped document links.
3. **Interactive Decisions & Open Questions:** Clickable question items with inline option badges (`[Recommended]`), pros/cons breakdown, and decision recording.
4. **Human Verification Tasks:** Dedicated human checklist items with attention gating (`needs-decision`, `needs-permission`, `needs-review`).
5. **Threaded Discussions:** Comments interface supporting inline replies, author avatar badges, and a "Turn into Issue Node" workflow.
6. **Canvas Sticky Notes:** Sand-colored freeform sticky notes on the canvas with color pickers and drag-resize handles.
7. **Canvas Minimap:** A bottom-right radar showing viewport position and all cluster nodes.
8. **Auto-DAG Layout:** A layout button intended to position nodes based on dependencies.
9. **Animated SVG Dependency Wires:** Flowing dash animations (`wire-animated`) illustrating execution state along dependency edges.
10. **Issue Creation Modal:** A modal allowing users to define repository, title, overview, acceptance criteria, priority, and auto-run settings.

### 3.3 What V2 Broke or Degraded
1. **Visual Overcrowding:** V2 added badges, buttons, borders, and pills to almost every surface. The header bar became packed to capacity.
2. **Canvas Dot Explosion:** As analyzed in Section 2, de-zooming makes the background unreadable.
3. **Rigid Canvas Bounds:** V2 locked the canvas plane into a fixed `4000px × 2600px` container (see Section 5).
4. **Broken Auto-DAG Algorithm:** Node positioning based on `depends_on.length` placed dependent nodes backwards and stacked unrelated nodes on identical coordinates (see Section 7).
5. **Undeletable Dependency Wires:** Wires and status badges were placed in a container with `pointer-events: none` without any click, hover, or drawer actions to remove links (see Section 11).
6. **Sticky Note Stacking & Markdown Failure:** Sticky notes render after task nodes in the DOM, covering active tasks, and lack markdown parsing (see Section 6).
7. **Button Double Plus Bug:** Buttons feature both a Lucide plus icon and a literal `+` character in text (see Section 8).
8. **View Naming Regression:** Renamed the clean list view to `Mobile / List View`, conflating device responsiveness with layout mode (see Section 9).
9. **State Isolation:** V2 abandoned the backend entirely, storing mocked data in `localStorage`.

---

## 4. Metadata Architecture: Front Matter, HTML Comments, and GitHub Labels

A critical architectural issue is determining where task state lives: GitHub Labels, YAML Frontmatter, or Invisible HTML Comments.

### 4.1 First-Class GitHub Labels
GitHub labels are first-class search indices queryable via GitHub REST and GraphQL APIs (`label:status:in-progress`, `label:priority:urgent`). The Task Board must never conceal primary state in body text where GitHub search is blind.

The following attributes belong strictly in **GitHub Labels**:
- **8-Stage Workflow Status:** `status:draft`, `status:backlog`, `status:todo`, `status:planned`, `status:in-progress`, `status:needs-human`, `status:in-review`, `status:done`.
- **Priority Tier:** `priority:urgent`, `priority:high`, `priority:normal`, `priority:low`.
- **Complexity / Size:** `complexity:XS`, `complexity:S`, `complexity:M`, `complexity:L`, `complexity:XL`.
- **Domain Theme:** `theme:<theme-slug>` (e.g. `theme:task-execution`, `theme:frontend-ui`).
- **Human Attention State:** `needs-decision`, `needs-permission`, `needs-review`.
- **Execution Flags:** `ready-to-run`, `auto-run`.

### 4.2 Invisible HTML Comment Metadata (`<!-- ... -->`)
Invisible HTML comments render as zero-height text in standard GitHub web UI, mobile apps, and markdown previewers, preventing visual clutter for repository collaborators while remaining machine-parseable.

The following attributes belong in **Invisible HTML Comments**:
- **Manual Board Sort Order:**
  `<!-- board-order: 14500.5 -->`
  (Already implemented and tested in `web/server/board.ts` via `parseOrderMarker` and `setOrderMarker`).
- **Canvas Spatial Coordinates:**
  `<!-- chamberos:canvas {"x": 420, "y": 280} -->`
- **Machine Dependency Graph Edges:**
  `<!-- chamberos:deps ["#89", "workflows-ac/n8n-cli#94"] -->`
- **Execution Run Leases & Checksums:**
  `<!-- chamberos:lease {"owner": "worker-1", "expires": 1793738000} -->`

### 4.3 YAML Frontmatter (`--- ... ---`)
YAML frontmatter at the top of an issue body is reserved for **Agent Execution Configuration**:
```yaml
---
model: 9router/engineer
worktree: team-dev-chamberos-board-v2
skills:
  - frontend-ui-engineering
  - doubt-driven-development
agent: dynamic-agent
auto_run: false
---
```
YAML frontmatter must NOT duplicate status, priority, or theme labels to avoid synchronization drift.

### 4.4 Markdown Heading Body Sections
The issue description body retains human-readable, section-isolated Markdown headings parsed by `web/server/sections.ts`:
- `### Overview`
- `### Acceptance Criteria` (with `- [ ]` checkboxes)
- `### Open Questions` (with `- [ ] Question?` and recorded `> **Decision:** Answer`)
- `### Human Tasks` (interactive human verification items)
- `### Test Plan` (`- [ ] [batch] test-description`)
- `### Dependencies` (human-readable cross-references: `Depends on #89`)

---

## 5. Canvas "n8n" References and Boundedness

### 5.1 Removal of "n8n" References
In V1 and V2, the term "n8n" was used as a shorthand for node-graph UI concepts:
- **V2 line 252:** Tab named `<span>n8n Canvas</span>`.
- **V2 line 106:** CSS comment `/* Synced Infinite n8n Dot Grid */`.
- **V2 line 114:** CSS comment `/* Selection-only n8n toolbar */`.
- **V2 line 1269:** HTML comment `<!-- Clean n8n Action Bar -->`.
- **V1 line 158:** CSS comment `/* n8n-Style Floating Hover Mini-Toolbar */`.
- **V1 line 601:** HTML comment `<!-- WORKSPACE 2: IDEATION (Full-Screen n8n Spatial Canvas) -->`.
- **V1 line 696:** HTML comment `<!-- Generously Spaced Compact n8n-Style Nodes Layer -->`.
- **V1 line 2271:** HTML comment `<!-- Compact 250px n8n-Style Node Body -->`.

**Required Action:** Purge all branding references. The canvas is the **ChamberOS Spatial Canvas** or simply **Canvas**. UI tabs must be labeled `Canvas` and `List`.

### 5.2 Canvas Boundedness vs Infinite Pan/Zoom
Both prototypes artificially constrained the canvas to fixed pixel dimensions:
- **V1 line 688:** `<div id="ideation-canvas-plane" class="... w-[3800px] h-[2400px]">`
- **V2 line 307:** `<div id="canvas-plane" class="... w-[4000px] h-[2600px]">`
- **V2 line 1471:** Minimap calculation hardcodes `1300 * scale` and `750 * scale`.

If a user drags a node beyond 4000px horizontally or 2600px vertically, the node clips or breaks out of the plane boundary. The canvas must be genuinely unbounded:
1. `#canvas-plane` should have no fixed width or height (`position: absolute; top: 0; left: 0; width: 0; height: 0; pointer-events: none`).
2. Child elements (cards, sticky notes, wires) positioned via `left: Xpx; top: Ypx; pointer-events: auto`.
3. The minimap dynamically computes the bounding box encompassing all existing nodes `[minX - padding, minY - padding, maxX + padding, maxY + padding]`, mapping the active viewport polygon over the true bounding box.

---

## 6. Sticky Notes Architecture: Markdown & Stacking

### 6.1 Missing Markdown Rendering in V2
In V2, sticky notes display the text `Markdown Note (No ports)` (line 1351), but the editor is an unparsed `contenteditable` container:
```html
<div contenteditable="true"
     oninput="updateStickyText('${st.id}', this.innerText)"
     class="... whitespace-pre-wrap select-text cursor-text">${st.text}</div>
```
No markdown parser (such as `marked` or an inline parser) is executed. Text like `**bold**`, `[link](url)`, or `- item` renders as raw punctuation.
**Fix:** Provide a dual-mode sticky note: inline editable on focus/double-click, and markdown-rendered on blur.

### 6.2 DOM Stacking Order Bug (Covering Tasks)
In V2 (line 1357):
```javascript
nodesLayer.innerHTML = issueNodesHtml + stickyHtml;
```
Because `stickyHtml` is concatenated *after* `issueNodesHtml` inside the same `#canvas-nodes-layer`, the browser paints sticky notes on top of task cards. A user placing a sticky note near or under a cluster of tasks ends up with the sticky note obscuring task cards, ports, and action bars.

**Fix:** Separate the canvas into distinct visual layers with explicit z-indices:
```html
<div id="canvas-plane">
  <svg id="canvas-wires-layer" class="z-10"></svg>
  <div id="canvas-notes-layer" class="z-20"></div> <!-- Sticky notes live under task cards -->
  <div id="canvas-cards-layer" class="z-30"></div> <!-- Task cards live above sticky notes -->
  <div id="canvas-overlay-layer" class="z-40"></div> <!-- Port drag wire & toolbars -->
</div>
```

---

## 7. Auto-Positioning Algorithm Failure Analysis

### 7.1 V1: Naive Grid
In V1 (line 2558):
```javascript
function autoLayoutCanvasNodes() {
  const visible = getFilteredIssues();
  visible.forEach((item, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    item.x = 60 + col * 380;
    item.y = 60 + row * 205;
  });
}
```
V1 implements a rigid 3-column table. It ignores dependencies, hierarchy, themes, and execution readiness.

### 7.2 V2: Flawed `autoLayoutDAG`
In V2 (line 1688):
```javascript
function autoLayoutDAG() {
  const visible = getFilteredIssues();
  visible.forEach((item, i) => {
    const depth = (item.depends_on || []).length;
    item.x = 70 + depth * 390;
    item.y = 80 + (i % 3) * 230;
  });
}
```
This algorithm fails completely:
1. **Depth as Array Length:** It treats `depends_on.length` as topological depth. If issue A depends on B and C (length 2), A is at `depth = 2`. If issue D depends on issue A (length 1), D is assigned `depth = 1`. Consequently, D is placed at `x = 460px` while its prerequisite A is at `x = 850px`. Dependency wires travel backwards across the screen.
2. **Y-Coordinate Collisions:** Y-positions are modulo-wrapped to `(i % 3) * 230`. Only three vertical positions exist: `80px`, `310px`, and `540px`. Two issues with the same dependency count (e.g. root tasks at depth 0) with indices `0` and `3` are assigned the exact same `(x, y)` coordinate (`70px, 80px`), completely hiding one card under another.

### 7.3 Required DAG Layout Specification
The auto-positioning engine must implement true topological sorting:
1. Construct an adjacency graph from dependencies.
2. Calculate longest path from root nodes to compute true topological rank:
   $$\text{rank}(v) = \begin{cases} 0 & \text{if } \text{deps}(v) = \emptyset \\ \max_{u \in \text{deps}(v)} (\text{rank}(u)) + 1 & \text{otherwise} \end{cases}$$
3. Group nodes into column layers by rank.
4. Within each rank column, space nodes vertically:
   $$y_k = y_0 + k \times (\text{card\_height} + \text{gap})$$
5. Apply barycenter ordering to minimize edge crossings between adjacent ranks.

---

## 8. Button Icon and Text Redundancy ("Double Plus" Bug)

In both prototypes, several buttons combine a plus icon with text that also begins with a literal `+`, resulting in visual stutter (e.g. `[ + + Issue Node ]`).

### Exact Locations in V1 and V2:
1. **V2 Line 279 (`tmp/webapp-v2.html`):**
   ```html
   <button onclick="openNewIssueModal()" class="... flex items-center gap-1.5">
     <i data-lucide="plus" class="w-3.5 h-3.5"></i>
     <span>+ Issue Node</span>
   </button>
   ```
   Renders as `+ + Issue Node`.
2. **V2 Line 283 (`tmp/webapp-v2.html`):**
   ```html
   <button onclick="createStickyNote()" class="... flex items-center gap-1.5">
     <i data-lucide="sticky-note" class="w-3.5 h-3.5 text-ochre"></i>
     <span>+ Sticky Note</span>
   </button>
   ```
   Renders as `[icon] + Sticky Note`.
3. **V1 Line 664 (`tmp/chamberos_ai_native_github_openchamber_operating_system.html`):**
   ```html
   <button onclick="openCanvasMediaPrompt('idea')" class="... flex items-center gap-1.5">
     <i data-lucide="plus" class="w-3.5 h-3.5"></i>
     <span>+ New idea node</span>
   </button>
   ```
   Renders as `+ + New idea node`.
4. **V2 Line 325:** `<button ...>+ New Issue</button>`
5. **V2 Line 394:** `<button ...>+ Thread</button>`
6. **V2 Line 1921:** `<button ...>+ Field</button>`
7. **V2 Line 1938:** `<button ...>+ Add</button>`
8. **V2 Line 1946:** `<button ...>+ Hostile Review Snippet</button>`
9. **V2 Line 1969:** `<button ...>+ Attach</button>`
10. **V2 Line 2289:** `<button ...>+ Turn into Issue Node</button>`
11. **V2 Line 2368:** `<button ...>+ Request Feature or Report Bug</button>`
12. **V1 Line 828:** `<button ...>+ New thread</button>`
13. **V1 Line 2932 & 3066:** `<button ...>+ Attach</button>`

**Rule:** When an icon is present (`<i data-lucide="plus">`), omit the literal plus symbol from the label. The text must read `New Issue`, `Add Node`, `Sticky Note`, `Attach`, and `Add Field`.

---

## 9. View Naming & Mobile Ergonomics

### 9.1 View Naming Clarification
In V2, the view switch tab at line 256 reads:
`<span>Mobile / List View</span>`
with the DOM container named `id="mobile-list-container"`.

This is a misnomer. The primary views of the Task Board are:
- **Canvas:** 2D spatial ideation graph with pan, zoom, nodes, sticky notes, and dependency wires.
- **List:** Linear, filterable backlog list with status columns and cards.

Calling the List view "Mobile" misrepresents its purpose on desktop displays.

### 9.2 Responsive Mobile Ergonomics
Both views must be fully responsive:
- **Canvas View on Mobile:** Touch pan and pinch-to-zoom gestures (already partially implemented in V2 lines 1632-1675) must support fluid 60fps pan/zoom with touch-friendly tap targets ($\ge 44\text{px}$).
- **List View on Mobile:** Full-width swipeable cards with quick status transitions.
- **Drawer on Mobile:** Full-screen modal overlay with top swipe-to-dismiss handle.

All user-facing strings and internal DOM IDs must be renamed from `mobile-list` to `list-view`.

---

## 10. Top Bar to Sidebar Transformation

### 10.1 Inventory of Current Top Bar Controls (V1/V2)
1. **Brand & Identity:** "Atelier" / "ChamberOS" logo mark and title.
2. **Project / Repository Selector:** Popover allowing filtering between multi-repo contexts.
3. **Primary Workspace Navigation Tabs:**
   - Operations / Pipeline (Kanban / active worktree streams)
   - Ideation / Canvas (Spatial canvas)
   - Decisions (Human decision gates)
   - Blocked / Human Tasks (Actionable human tasks & missing credentials)
   - Discussions (Threads and discussions)
4. **Orchestrator Liveness Indicator:** Status pill (`Orchestrator ready · Worktree lock active`).
5. **Creation & Action Triggers:**
   - "+ New Issue" / Quick Capture button.
   - "Sync GitHub" trigger.
   - Settings modal button.
   - Role switcher (Dev / Lead vs Client / Team).

### 10.2 Sidebar Mapping
A modern ChamberOS collapsible Sidebar cleans the canvas viewport while maintaining instant access:
- **Sidebar Header:**
  - Workspace logo and project switcher dropdown.
- **Navigation Section:**
  - ⚡ **Pipeline** (`/pipeline` or Operations tab) with active worktree badge.
  - 🧭 **Canvas** (`/canvas`) spatial DAG graph.
  - 📋 **List** (`/list`) linear backlog.
  - ⚖️ **Decisions** (`/decisions`) with pending decision badge count.
  - ✋ **Blocked** (`/blocked`) with human task alert count.
  - 💬 **Discussions** (`/discussions`).
- **Sidebar Filter Group:**
  - Repository filter chips.
  - Label and theme toggles.
- **Sidebar Footer:**
  - Quick Issue Creation button (`Cmd+K`).
  - Orchestrator liveness indicator.
  - GitHub Sync button.
  - Settings / Configuration trigger.
  - Sidebar collapse/expand toggle.

---

## 11. Dependency Link Deletion Bug

### 11.1 Defect Analysis
In V2, once two task nodes are wired together with a dependency link, the user cannot delete the link.
1. In `tmp/webapp-v2.html` (line 308):
   ```html
   <svg id="canvas-wires-svg" class="absolute inset-0 w-full h-full pointer-events-none z-0" ...></svg>
   <div id="canvas-wire-badges" class="absolute inset-0 w-full h-full pointer-events-none z-10"></div>
   ```
   Both the SVG paths and the wire badge pills have `pointer-events: none`. No mouse click, right-click, or hover event can reach them.
2. Searching for `depends_on` manipulation reveals only one modification site:
   - Line 1600: `targetIssue.depends_on.push(wireDrag.fromId)` (creates wire).
   - Line 1748: `deleteIssueNode(id)` filters out deleted issue IDs.
   There is zero code to delete a dependency edge without deleting the entire issue.

### 11.2 Required Interactive Solution
1. **Clickable Wire Paths:** Render SVG paths with a wide transparent hit area (`stroke="transparent" stroke-width="14" pointer-events="stroke"`).
2. **Hover Delete Badge:** Hovering over a wire reveals a centered badge with a delete button (`✕`). Clicking it calls `unlinkDependency(sourceId, targetId)`.
3. **Drawer Dependency Chips:** Inside the issue detail drawer, render each dependency as a removable chip:
   ```html
   <div class="dependency-chip">
     <span>Depends on #89</span>
     <button onclick="unlinkDependency('${depId}', '${issue.id}')">✕</button>
   </div>
   ```
4. **Backend Sync:** Calling `unlinkDependency()` removes the reference from `depends_on` (and body/comments metadata) and immediately updates the backend via `PATCH /api/issues/:number`.

---

## 12. Seamless Issue Creation & System 1 ("D1") Model Integration

### 12.1 User Intent & Vision
Users need an effortless capture experience:
1. Type a raw, unstructured thought, feature idea, bug description, or question into a textarea.
2. Paste or upload an image/screenshot or link.
3. A low-latency System 1 decision model ("D1") instantly analyzes the text and attachments in streaming real time.
4. D1 produces structured GitHub issue metadata:
   - Concise technical title + friendly title.
   - Correct target repository selection.
   - Categorization into status (`status:draft` or `status:todo`), priority, complexity, and theme.
   - Structured sections: Overview, Acceptance Criteria, Open Questions.
   - Suggested canvas placement $(x, y)$ near related themes.
5. With one click, the issue is created on GitHub.

### 12.2 OpenChamber Model Configuration & 9router Verification
Investigation of `/workspace/code/openchamber-config/opencode.json` and `9router/OPERATOR.md` reveals the system's model topology:
- **9router Base URL:** `https://ai.workflows.ac/v1` (OpenAI-compatible chat completions endpoint).
- **Authentication:** Bearer token configured via environment variable `OPENAI_API_KEY` or 9router service token.
- **Model Tiers:**
  - `intern`: Lowest cost, fastest turnaround (TTFT ~500ms). Composed of `ocg/mimo-v2.6-flash`, `imf/IFM/K2-Horizon-375B-A23B` (free 531 tok/s MoE), and `gemini/gemini-flash-lite-latest`. **Ideal for System 1 (D1) triage and real-time structuring.**
  - `worker`: Workhorse execution (`ag/claude-sonnet-5-5-low`, `cc/claude-haiku-5-5(high)`).
  - `engineer`: Deep software engineering (`ag/claude-sonnet-5-5-high`, `cx/gpt-6.1-sol(medium)`, TTFT 3.56s).
  - `genius`: Frontier architecture and review (`ag/claude-opus-5-5-high`, `ag/gemini-4-argon-high`, `cx/gpt-6.1-sol(xhigh)`).

### 12.3 D1 Structuring Prompt Specification
The D1 structuring call should send a lightweight schema-constrained prompt to `9router/intern`:
```json
{
  "model": "9router/intern",
  "temperature": 0.1,
  "messages": [
    {
      "role": "system",
      "content": "You are ChamberOS System 1 (D1). You transform raw developer notes, bug descriptions, and screenshot captions into structured GitHub issues. Emit JSON with: title, friendly_title, repo, priority, complexity, theme, overview, acceptance_criteria (array of strings), open_questions (array of strings)."
    },
    {
      "role": "user",
      "content": "Raw user idea text + uploaded screenshot OCR/description"
    }
  ]
}
```
This structuring endpoint can be hosted directly in `web/server/` as `POST /api/issues/structure-draft`, proxying to `https://ai.workflows.ac/v1` without exposing backend API credentials to the browser client.

---

## 13. Standalone Board Server & Supervisor Architecture

### 13.1 Production Process Architecture
The live task board runs under supervision:
- **Supervisor Script:** `/workspace/config/opencode/tools/board/supervisor.sh`
- **Release Directory:** `/workspace/releases/board/current -> /workspace/releases/board/98261a8-20261103`
- **Child Command:** `node web/dist/server.mjs`
- **Supervisor State Directory:** `/tmp/opencode/board-supervisor`
- **Locking & Single-Owner:** Utilizes kernel `flock` on `/tmp/opencode/board-supervisor/supervisor.lock` (file descriptor 9).
- **Restart Backoff:** Exponential backoff with jitter (initial 1s, max 30s, sustained health 30s resets counter).
- **Checksum Manifest Verification:** Enforces strict SHA-256 verification of `checksums.sha256` before child launch.

### 13.2 Server Endpoints (`web/server/app.ts`)
The server exposes clean, secure, RESTful endpoints:
- `GET /health`: Health probe.
- `GET /api/session`: Authenticated session check with CSRF token issuance.
- `POST /api/session`: Login authentication with rate-limiting and scrypt hashing.
- `GET /api/repos`: Discovered GitHub repositories.
- `GET /api/board`: Single repository issue board with order sorting.
- `GET /api/combined/board`: Aggregated multi-repository issue board.
- `POST /api/issues`: Create an issue with labels and markdown body.
- `GET /api/issues/:number`: Detailed issue view with parsed sections and status options.
- `PATCH /api/issues/:number`: Update issue status, state, or body.
- `PUT /api/issues/:number/section`: Update a specific Markdown section without modifying the rest of the body.
- `POST /api/issues/:number/questions/:index/answer`: Record question answers directly as `> **Decision:** ...` blockquotes.
- `PUT /api/issues/:number/order`: Persist manual drag-and-drop order using `<!-- board-order: ... -->`.

---

## 14. Inventory of Fake & Simulated Components to Replace

| Component / Feature | Prototype V1/V2 Current State | Target Real Backend Implementation |
|---|---|---|
| Issue Storage | Hardcoded in-memory array (V1); `localStorage` (V2) | `GET /api/board`, `GET /api/combined/board`, `POST /api/issues` |
| Issue Creation | Appends to local JavaScript array | `POST /api/issues` via GitHub REST API |
| Section Editing | In-memory string manipulation | `PUT /api/issues/:number/section` with strict heading parsing |
| Question Answering | In-memory array toggle | `POST /api/issues/:number/questions/:index/answer` |
| Manual Ordering | In-memory coordinates | `PUT /api/issues/:number/order` with `<!-- board-order: ... -->` |
| Canvas Coordinates | In-memory object coordinates | Invisible HTML comment `<!-- chamberos:canvas ... -->` in issue body |
| Dependency Linking | In-memory array; undeletable | GitHub issue references + `<!-- chamberos:deps ... -->` |
| Repository Discovery | Hardcoded `4` repositories | `GET /api/repos` with token discovery |
| Agent Execution | Fake console log simulation (`console.info(...)`) | OpenChamber agent dispatch API (`POST /api/session`) |
| Issue Triage / Routing | Regex string matching (`lower.includes('ocr')`) | System 1 (D1) model call to `9router/intern` |

---

## 15. Template Issue Capabilities: Full Matrix

The V2 Board will support all standard issue capabilities:
1. **Rich Media & YouTube Embeds:**
   - Detect YouTube URLs and render responsive 16:9 embedded video players.
   - Thumbnail previews for image attachments and diagrams with click-to-expand lightbox modals.
2. **Interactive Questions & Decisions:**
   - Format: `### Open Questions` with `- [ ] Question?`.
   - Option chips, recommendation highlights, and inline answer submission updating GitHub markdown with `> **Decision:** Answer`.
3. **Deep Human Tasks & Verification Gates:**
   - Format: `### Human Tasks` with `- [ ] Task`.
   - Checkbox toggles synchronized to GitHub markdown via line-index targeting.
   - Attention state reflection: `needs-decision`, `needs-permission`, `needs-review`.
4. **Threaded Discussions:**
   - Full GitHub Issue comments stream fetched via GitHub API.
   - "Turn into Issue Node" button to decompose comment discussions into linked sub-tasks.
5. **Execution Dependency Graph (DAG):**
   - Visual cubic Bezier wires on spatial canvas.
   - Color-coded liveness (green = resolved, orange = running, burgundy = blocked).
   - Clickable wire deletion and drawer dependency management chips.
6. **Frontmatter & Labels Integration:**
   - First-class GitHub labels for status, priority, complexity, and theme.
   - Frontmatter YAML block for model, agent, worktree, and skills.
   - Invisible HTML comments for canvas coordinates and order.

---

## 16. Verification & Test Plan

1. **Prototypes Committed & Tracked:**
   - Both prototype files are committed to git on `ops/task-board-activation` (`2b6de91`) and cherry-picked to `feat/chamberos-board-v2` (`62dd215`).
2. **Worktree Environment Provisioned:**
   - `node_modules` symlinked from parent repository root.
   - Registered in both `/workspace/.local/share/opencode/opencode.db` and `/workspace/.local/share/antigravity/antigravity.db`.
3. **Test Suite Verification:**
   - Executed `npm test` inside worktree: 618/618 tests passed cleanly (0 failed, 0 skipped).
4. **Discovery Report Delivery:**
   - Written to both worktree and root `.agents/run/chamberos-board-v2/explore/discovery.md`.
