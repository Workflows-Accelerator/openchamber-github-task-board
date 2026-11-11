---
name: fixing-motion-performance
description: Audit and fix animation performance issues including layout thrashing, compositor properties, scroll-linked motion, and blur effects. Use when animations stutter, transitions jank, or reviewing CSS/JS animation performance.
---

# fixing-motion-performance

Fix animation performance issues.

## how to use

- `/fixing-motion-performance`
  Apply these constraints to any UI animation work in this conversation.

- `/fixing-motion-performance <file>`
  Review the file against all rules below and report:
  - violations (quote the exact line or snippet)
  - why it matters (one short sentence)
  - a concrete fix (code-level suggestion)

Do not migrate animation libraries unless explicitly requested. Apply rules within the existing stack.

## when to apply

Reference these guidelines when:
- adding or changing UI animations (CSS, WAAPI, Motion, rAF, GSAP)
- refactoring janky interactions or transitions
- implementing scroll-linked motion or reveal-on-scroll
- animating layout, filters, masks, gradients, or CSS variables
- reviewing components that use will-change, transforms, or measurement

## rendering steps glossary

- composite: transform, opacity
- paint: color, borders, gradients, masks, images, filters
- layout: size, position, flow, grid, flex

## rule categories by priority

| priority | category | impact |
|----------|----------|--------|
| 1 | never patterns | critical |
| 2 | choose the mechanism | critical |
| 3 | measurement | high |
| 4 | scroll | high |
| 5 | paint | medium-high |
| 6 | layers | medium |
| 7 | blur and filters | medium |
| 8 | view transitions | low |
| 9 | tool boundaries | critical |

## quick reference

### 1. never patterns (critical)

- do not interleave layout reads and writes in the same frame
- do not animate layout continuously on large or meaningful surfaces
- do not drive animation from scrollTop, scrollY, or scroll events
- no requestAnimationFrame loops without a stop condition
- do not mix multiple animation systems that each measure or mutate layout

### 2. choose the mechanism (critical)

- default to transform and opacity for motion
- use JS-driven animation only when interaction requires it
- paint or layout animation is acceptable only on small, isolated surfaces
- one-shot effects are acceptable more often than continuous motion
- prefer downgrading technique over removing motion entirely

### 3. measurement (high)

- measure once, then animate via transform or opacity
- batch all DOM reads before writes
- do not read layout repeatedly during an animation
- prefer FLIP-style transitions for layout-like effects
- prefer approaches that batch measurement and writes

### 4. scroll (high)

- prefer Scroll or View Timelines for scroll-linked motion when available
- use IntersectionObserver for visibility and pausing
- do not poll scroll position for animation
- pause or stop animations when off-screen
- scroll-linked motion must not trigger continuous layout or paint on large surfaces

### 5. paint (medium-high)

- paint-triggering animation is allowed only on small, isolated elements
- do not animate paint-heavy properties on large containers
- do not animate CSS variables for transform, opacity, or position
- do not animate inherited CSS variables
- scope animated CSS variables locally and avoid inheritance

### 6. layers (medium)

- compositor motion requires layer promotion, never assume it
- use will-change temporarily and surgically
- avoid many or large promoted layers
- validate layer behavior with tooling when performance matters

### 7. blur and filters (medium)

- keep blur animation small (<=8px)
- use blur only for short, one-time effects
- never animate blur continuously
- never animate blur on large surfaces
- prefer opacity and translate before blur

### 8. view transitions (low)

- use view transitions only for navigation-level changes
- avoid view transitions for interaction-heavy UI
- avoid view transitions when interruption or cancellation is required
- treat size changes as potentially layout-triggering

### 9. tool boundaries (critical)

- do not migrate or rewrite animation libraries unless explicitly requested
- apply these rules within the existing animation system
- never partially migrate APIs or mix styles within the same component

## common fixes

```css
/* layout thrashing: animate transform instead of width */
/* before */ .panel { transition: width 0.3s; }
/* after */  .panel { transition: transform 0.3s; }

/* scroll-linked: use scroll-timeline instead of JS */
/* before */ window.addEventListener('scroll', () => el.style.opacity = scrollY / 500)
/* after */  .reveal { animation: fade-in linear; animation-timeline: view(); }
```

```js
// measurement: batch reads before writes (FLIP)
// before — layout thrash
el.style.left = el.getBoundingClientRect().left + 10 + 'px';
// after — measure once, animate via transform
const first = el.getBoundingClientRect();
el.classList.add('moved');
const last = el.getBoundingClientRect();
el.style.transform = `translateX(${first.left - last.left}px)`;
requestAnimationFrame(() => { el.style.transition = 'transform 0.3s'; el.style.transform = ''; });
```

## review guidance

- enforce critical rules first (never patterns, tool boundaries)
- choose the least expensive rendering work that matches the intent
- for any non-default choice, state the constraint that justifies it (surface size, duration, or interaction requirement)
- when reviewing, prefer actionable notes and concrete alternatives over theory

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
