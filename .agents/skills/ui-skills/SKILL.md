---
name: ui-skills
description: Minimalist React and Tailwind craft standards covering optical spacing, fixed z-index scales, tabular numbers, hairline borders, concentric border radii, touch targets, and motion restraint.
metadata:
  author: ibelick
  version: "1.0.0"
---

# UI Skills: Craft & Deslop Standards

Opinionated, high-fidelity UI engineering principles for building refined React + Tailwind interfaces without AI-generated slop.

## Core Craft Principles

### 1. Typography & Data Alignment
- **Tabular Numbers**: Always use `tabular-nums` (`font-variant-numeric: tabular-nums`) for all metrics, stats, timestamps, prices, and comparative figures. Numbers must not jitter or misalign.
- **Balanced Text**: Use `text-balance` on headings and `text-pretty` on body paragraphs to prevent widows and awkward line wraps.
- **Line Measure**: Restrict body text measure to 60–75 characters (`max-w-prose` or `max-w-xl`).
- **Heading Line-Height**: Short display headings need tight line height (`leading-tight` or `leading-[1.1]`).
- **Tracking by Size**: Large display headlines require slightly tighter letter spacing (`tracking-tight` or `tracking-tighter`).

### 2. Optical Spacing & Alignment
- **Proximity over Dividers**: Use generous whitespace and tight grouping to establish relationship before adding divider lines or border containers.
- **Optical Balance for Icons**: Geometrically centered icons often appear off-center. Optically nudge icons 1–2px when paired with text or inside button containers.
- **Icon Stroke Weight**: Match icon stroke weight to adjacent text weight (1.5px stroke for regular text, 2px stroke for semibold).
- **Concentric Radii**: For nested bordered elements, calculate inner radius to maintain uniform visual curvature:
  `inner_radius = outer_radius - padding`
- **Control Gaps**: Maintain consistent 12px (`gap-3`) spacing between adjacent bordered controls.

### 3. Hairline Definition & Elevation
- **Hairline Borders**: Use crisp 1px borders with subtle alpha (`border-white/10`) to define structural boundaries cleanly.
- **Fixed Z-Index Scale**: Never use arbitrary z-index values (e.g. `z-[9999]`). Stick to an explicit semantic scale (`z-0`, `z-10` sticky, `z-20` dropdown, `z-30` modal, `z-40` toast).
- **No Glowing Buttons**: Never use drop-shadow glows or neon colored halos on buttons. Visual dominance comes from contrast, typography, and crisp spacing.
- **Solid Modal Backdrops**: Prefer deep solid or high-opacity dim backdrops (`bg-black/80`) over heavy full-screen blur filters (`backdrop-blur-xl`), which cause GPU lag and frame drops.

### 4. Layout, Viewports & Interaction
- **Always `h-dvh`**: Use dynamic viewport units (`h-dvh` or `min-h-dvh`) instead of `h-screen` to avoid mobile address bar jumps.
- **Safe Area Insets**: Always apply `env(safe-area-inset-*)` or `p-[env(safe-area-inset-top)]` on fixed headers, floating toolbars, and edge navigation.
- **Touch Targets**: All interactive controls must provide at least 44×44px hit targets on touch devices.
- **Scale on Press**: Provide tactile active feedback via subtle `active:scale-[0.97]` transitions.
- **Never Block Paste**: Never intercept or prevent paste on input and textarea elements.

### 5. Motion Restraint & Compositor Performance
- **Compositor Only**: Animate ONLY `transform` and `opacity`. Never animate layout properties (`width`, `height`, `top`, `left`, `margin`, `padding`).
- **Ease-Out Entrances**: Use exponential `ease-out` for entering elements. Never use `ease-in` for entrances.
- **Interaction Duration**: Feedback animations must complete in `≤200ms`.
- **First Load vs Routine**: Stagger hero elements on initial load, but keep routine tab switching and toggles instant and crisp.
- **Respect Reduced Motion**: Always support `@media (prefers-reduced-motion)` or `motion-reduce:`.

## Reference Modules

Detailed reference specifications are organized in:
- `reference/baseline-ui.md` — Complete Baseline UI deslop constraints
- `reference/playbook.md` — 47 UI craft playbook rules
- `reference/accessibility.md` — Critical accessible names, keyboard, and focus rules
- `reference/motion-performance.md` — 60fps compositor and animation performance guidelines


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
