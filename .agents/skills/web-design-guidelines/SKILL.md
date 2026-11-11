---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance across accessibility, focus states, forms, animation, typography, and responsive performance.
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines. Self-contained offline edition.

## How It Works

1. Read the offline guidelines from `reference/guidelines.md` (fully inlined for zero-network execution).
2. Read the specified files (or prompt user for files/pattern).
3. Check against all rules in the guidelines:
   - **Accessibility**: semantic HTML, icon-only button labels, keyboard accessibility, media descriptions.
   - **Focus States**: visible `:focus-visible` rings, never bare `outline-none`.
   - **Forms**: labeled inputs, correct input types, no paste blocking.
   - **Animation**: compositor-only (`transform`/`opacity`), `prefers-reduced-motion`, no `transition: all`.
   - **Typography**: tabular numbers for data, text balancing, proper quotes and non-breaking spaces.
   - **Layout & Touch**: `100dvh`, safe areas, touch manipulation, 44px minimum touch targets.
4. Output findings in the terse `file:line` format.

## Reference Guidelines

All detailed compliance rules are inlined in:
`reference/guidelines.md`


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
