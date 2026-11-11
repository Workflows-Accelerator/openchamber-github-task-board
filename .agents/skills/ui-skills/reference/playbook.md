# UI Craft Playbook (47 Rules)

Rules and craft standards from ibelick/ui-skills for minimalist React/Tailwind craft.

### 1. Prevent layout shifts with aspect ratio

Set `aspect-ratio` so nearby content does not jump while an image loads.

### 2. Balance heading text for easier reading

Use `text-balance` for headings and `text-pretty` for body copy.

### 3. Align numbers with tabular-nums

Use `tabular-nums` to align numbers in tables and data-heavy UI.

### 4. Use 44px touch targets for accessibility

Give buttons and controls a touch target of at least 44 by 44px.

### 5. Match border radius on nested elements

Set the nested element's radius to the parent's radius minus its padding.

Formula: `inner radius = outer radius - padding`

### 6. Add scale feedback to pressed buttons

Add subtle press feedback with `:active` and a scale near 0.96.

### 7. Animate popovers from their trigger

Animate each popover from the control that opened it.

### 8. Group content with spacing, not dividers

Use spacing to group related content before adding divider lines.

### 9. Preview the next item in scroll lists

Show 16 to 32px of the next item to make horizontal scrolling clear.

### 10. Use neutral borders around images

Use a thin neutral outline instead of a tinted ring.

### 11. Truncate long titles in small spaces

Use `line-clamp` or `truncate` when space is tight.

### 12. Improve contrast for muted text

Give muted text enough color contrast to stay easy to read.

### 13. Avoid scale-zero entrance animations

Start entrance animations near 95% size instead of scaling up from zero.

### 14. Match loading skeletons to real content

Match loading skeletons to the content they replace, and skip spinners when possible.

### 15. Limit each view to one accent color

Use one accent per view. Keep secondary actions neutral.

### 16. Keep body text lines easy to read

Keep text lines between 60 and 75 characters for easier reading.

### 17. Use shadows to show visual depth

Use shadows to show depth. Use borders to show structure.

### 18. Add visible keyboard focus rings

Use `:focus-visible` to keep keyboard focus clear and visible.

### 19. Show form errors next to each field

Put each validation error directly below its field.

### 20. Add visible labels to every form field

Use a visible label. Do not use placeholder text as the only label.

### 21. Give empty states one clear action

Give an empty state one clear action, not just an explanation.

### 22. Use sentence case for UI labels

Write labels in sentence case, not all caps.

### 23. Never use color alone for status

Add text or an icon so status is never shown by color alone.

### 24. Use ease-out for entrance animations

Use `ease-out` for entrances. `ease-in` feels slow when something opens.

### 25. Align icons by eye for better balance

Nudge icons when geometric centering does not look visually balanced.

### 26. Match icon stroke weight to text

Use a 2px stroke beside semibold text and a 1.5px stroke beside regular text.

### 27. Use outline icons for default states

Use outline icons by default. Use a fill for the active state.

### 28. Avoid glow effects on primary buttons

Avoid glow effects on primary buttons; use contrast and spacing instead.

### 29. Animate icon state changes smoothly

Cross-fade changing icons with opacity, scale, and blur for smoother feedback.

### 30. Add space between nearby controls

Leave about 12px between nearby bordered controls.

### 31. Keep full-width buttons inside page margins

Keep full-width buttons inside the page margins, not edge to edge.

### 32. Use tighter line height for headings

Use a line height near 1.1 for short headings.

### 33. Adjust letter spacing for large text

Large display text often needs slightly tighter letter spacing.

### 34. Confirm destructive actions before they run

Ask for confirmation before deleting data or taking an irreversible action.

### 35. Fade the edges of scrollable lists

Use a `mask-image` fade to show where a scrollable list continues.

### 36. Stagger hero animations on first load

Stagger hero animations by about 100ms on first load, not during routine interactions.

### 37. Keep exit animations short and subtle

Keep exit animations short with a small `translateY` movement.

### 38. Show nearby tooltips faster

Show nearby tooltips faster after the first tooltip opens.

### 39. Use interruptible CSS transitions

Use CSS transitions for interactive open and close states.

### 40. Avoid repeated animations in routine UI

Animate first-load entrances, but keep repeated actions like tab switches instant.

### 41. Use ease-out instead of springs for feedback

Use `ease-out` for toggles and toasts because springs can wobble.

### 42. Fade menus out when they close

Close menus with a short fade. Do not move them far off screen.

### 43. Reserve brand colors for links and actions

Keep headings neutral. Use the brand color for links and actions.

### 44. Use solid modal backdrops instead of blur

Use a solid modal backdrop instead of blur to avoid expensive full-screen rendering.

### 45. Fade overflowing text instead of clipping it

Fade long labels instead of cutting them off with a hard ellipsis.

### 46. Use matching enter and exit animations

Use matching enter and exit animations so a surface feels connected.

### 47. Soften label changes with a short blur

Add a short blur when labels change to avoid a distracting visual flash.


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
