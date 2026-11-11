# Workflows Board interaction pass

Retain accepted architectural shell, geometric mark and system typography. This is a task workspace, not a new visual identity.

Palette: ink #0B0D11, slate #161A22, paper #FFFFFF, text #F1F5F9 / #0F172A, upstream amber #FBBF24 / #92400E, downstream blue #60A5FA / #1D4ED8. Existing theme tokens remain authoritative.

Type: system sans for controls and prose; existing monospace only for source content. Sentence case, tabular counts, 16px sheet body, compact 20px titles.

Layout: one native modal surface, bottom anchored on phones and bounded right panel on desktop. Header and action footer stay in place; only body scrolls. Left-aligned groups use whitespace rather than nested decorative cards.

```
Handle
Title                         Close
-----------------------------------
Stage        [Todo 8] [In progress 3]
Priority     [High 4] [Medium 7]
Project      [Platform 6] [SDK 3]
Attention    [Blocked 2] [Questions 1]
Review       [Artifact link 2]
-----------------------------------
Clear all                  Show 12 tasks
```

Applied filters occupy their own rail before Canvas/List, with a permanent counted Filters button. Canvas keeps existing layout mathematics. Explicit focus control on each card reveals blockers in amber, dependents in blue; an unscaled viewport legend explains direction and provides opening/clearing actions. Existing click-to-open and dragging stay intact.

Review against brief: rejected generic identical settings cards in favour of quiet sections; retained accepted palette rather than inventing a competing brand. Relationship focus is the single strong accent. All changes must survive 360px, Light/Dark, EN/FR, keyboard, reduced motion and strict CSP. Native modal lifecycle is shared by filters, settings, sort, project picker, composer, Arrange and relationship confirmation. Drawer remains the existing detail workspace, not a bottom sheet.
