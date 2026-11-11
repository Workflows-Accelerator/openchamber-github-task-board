---
name: impeccable-critique
description: Ruthless UI critique, design polish, layout rhythm, cognitive load assessment, Nielsen usability heuristic scoring, and persona-based review for out-of-distribution craft.
metadata:
  author: pbakaus
  version: "4.8.2"
---

# Impeccable Critique: Ruthless UI Review & Polish

A rigorous design review and polish system engineered to evaluate frontend interfaces with the unsparing standard of an award-winning design director.

## Core Pillars

### 1. The Dual-Assessment Critique Model
When auditing any UI surface, conduct two distinct examinations:
- **Assessment A (Design Review)**: Holistic assessment of design specificity, information hierarchy, emotional tone, typography, color harmony, and edge states.
- **Assessment B (Deterministic Verification)**: Concrete inspection of markup, rendered DOM, viewport scaling (375px mobile, 547px small mobile, 1216px desktop), contrast measurements, and accessibility compliance.

### 2. Nielsen's 10 Usability Heuristics Scoring (0–4 Scale)
Score each heuristic objectively (4 = genuinely excellent, 0 = broken):
1. **Visibility of System Status**: Real-time feedback for async states, loading, and active selections.
2. **Match Between System and Real World**: User-centered terminology, natural reading flow.
3. **User Control and Freedom**: Clear emergency exits, undo, cancel, escape handling.
4. **Consistency and Standards**: Predictable UI patterns, unified component styling.
5. **Error Prevention**: Guardrails against destructive mistakes and smart defaults.
6. **Recognition Rather Than Recall**: High discoverability, labeled controls, contextual cues.
7. **Flexibility and Efficiency of Use**: Keyboard navigation, accelerators, efficient workflows.
8. **Aesthetic and Minimalist Design**: High signal-to-noise ratio; every pixel earns its place.
9. **Help Users Recognize, Diagnose, and Recover from Errors**: Inline actionable errors.
10. **Help and Documentation**: Concise, task-focused assistance when needed.

Total score out of 40 (or renormalized if heuristics are marked `n/a`):
- **36–40**: Excellent (minor polish only)
- **28–35**: Good (solid foundation, address weak spots)
- **20–27**: Acceptable (significant improvements required)
- **12–19**: Poor (major UX overhaul needed)
- **0–11**: Critical (unusable in current state)

### 3. Cognitive Load Assessment (Working Memory ≤4 Rule)
- **Intrinsic Load**: Structure complex tasks into discrete steps; use progressive disclosure.
- **Extraneous Load**: Ruthlessly eliminate clutter, ambiguous icons, and unnecessary steps.
- **Working Memory Limit**: At any decision point, never present >4 visible primary choices simultaneously without grouping or hierarchy.
- **Cognitive Checklist**: Evaluate single focus, chunking (≤4 items), visual grouping, one-thing-at-a-time decision flow, and memory independence.

### 4. Persona-Based Hostile Testing
Test primary interaction paths through 5 distinct user archetypes:
- **Alex (Impatient Power User)**: Demands keyboard shortcuts, hates redundant clicks or forced modals.
- **Jordan (Confused First-Timer)**: Needs immediate clarity, hates unlabeled icons and unexplained jargon.
- **Sam (Accessibility-Dependent User)**: Relies on screen readers and keyboard navigation; requires WCAG AAA contrast (≥21:1 for primary text) and visible focus rings.
- **Riley (Deliberate Stress Tester)**: Tests edge cases, 0 items vs 1000 items, ultra-long strings, and mid-flow refresh.
- **Casey (Distracted Mobile User)**: Operates one-handed in portrait mode; requires 44px tap targets, thumb-zone controls, and state preservation.

### 5. Issue Severity Classification
- **P0 (Blocking)**: Prevents task completion or breaks critical functionality. Fix immediately.
- **P1 (Major)**: Causes significant confusion, severe visual defect, or accessibility failure. Fix before release.
- **P2 (Minor)**: Annoyance or noticeable drift with an existing workaround.
- **P3 (Polish)**: Fine-tuning and cosmetic refinement.

### 6. Five-Stage Polish Triage
When refining an interface, resolve defects in strict order:
1. Broken tasks, inaccessible paths, or state loss.
2. Missing loading, empty, error, or disabled states.
3. Flow, hierarchy, responsive, and design-system drift.
4. Visual cadence, optical alignment, and motion inconsistencies.
5. Code and asset cleanup.

### 7. Layout Rhythm & The Squint Test
- **The Squint Test**: Blur your eyes while looking at the surface. Can you still effortlessly identify the primary element, the secondary element, and the logical groupings in order?
- **Spatial Rhythm**: Create cadence through deliberate contrast between tight intervals (`gap-2` / `gap-3`) and generous separation (`mt-8` / `mt-12`). Never repeat one uniform spacing value across all containers.

## Reference Documentation

- `reference/critique.md` — Complete critique methodology, heuristics guide, and persona definitions
- `reference/polish.md` — Five-stage triage and polish refinement instructions
- `reference/layout.md` — Spatial thesis, reading order, squint test, and layout rhythm
- `reference/craft-floor.md` — Verification checklist for contrast, depth, spacing, type, and states
- `reference/adapt.md` — Responsive adaptation across device contexts and screen sizes


## Project Override (ChamberOS Task Board)

In this repository, the following ChamberOS Task Board craft standards are authoritative and govern UI implementation:

1. **Dual Theme Support (Light & Dark)**:
   - Architectural, high-craft Light and Dark palettes.
   - Strictly avoid muddy `#F4F1EA` cream + terracotta AI tells; use crisp neutral surfaces and hairlines.
   - Maintain high contrast and intentional visual hierarchy across both modes.

2. **Typography & Copy Contract**:
   - Sentence-case labels everywhere (zero ALL-CAPS tracked-out micro-labels, zero `A · B · C` middle-dot meta soup, zero slash-labels like `Category // Subtitle`).
   - `font-variant-numeric: tabular-nums` on all numbers, counts, percentages, and timestamps to eliminate jitter.
   - Full English (EN) and French (FR) parity across all UI strings, headings, tooltips, and `<html lang>`.

3. **Viewport & Touch Integrity**:
   - `100dvh` zero-overhang app shell with safe-area padding using `env(safe-area-inset-*)`.
   - Minimum `>=44x44px` interactive touch targets on coarse pointer / narrow viewports.
   - Thumb-zone navigation ergonomics on viewports `<=768px`.
   - Single-row compact `#canvas-controls` strictly contained inside `#canvas-viewport`.

4. **Hard Product Invariants**:
   - Preserve two-stop radial-gradient dot grid at `web/public/app.js:2268` untouched.
   - Markdown sticky notes rendered under task cards.
   - Topological layout ordering via `arrange.js`.
   - Views named `"Canvas"` / `"Canevas"` and `"List"` / `"Liste"` with sidebar navigation.
   - Zero occurrences of `"n8n"`.
   - Zero occurrences of the word `"mobile"` anywhere in UI, DOM, CSS, or code (responsive design without the label).
   - Zero emojis in UI chrome and system copy.
   - No button with both a `+` icon and `"+"` text prefix.
   - Nothing fake or simulated in the shipped board.
   - Strict CSP `style-src 'self'` compatibility (zero inline HTML `style="..."` attributes).
