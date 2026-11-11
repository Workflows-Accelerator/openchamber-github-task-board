# V4-1 manager screenshot review (011e297)

Screenshots inspected: filter-360-light-en, dependency-360-light-fr, applied-360-dark-fr.

## Accepted
- Filter sheet at 360: clean bottom sheet, handle, counted chips, sticky footer "Clear all" / "Show 10 tasks". Matches F1/F2 intent.

## Findings to fix before L4 (manager, P1 unless noted)
- M1 Dependency focus does not frame the neighbourhood. At 360 only the selected card is visible; blocker (#1) and dependents (#3, #11) are off-screen, so the phone user still cannot see the organisation (F3 not solved on phone). Selecting Dependencies must fit selected + blockers + dependents into view (animated, respecting reduced motion), restoring the previous viewport on exit.
- M2 Edge labels clip / overlap: "#1 bloque #2" is cut at the left viewport edge; "#2 bloque #3" sits on top of the card border and connector dot. Labels must stay fully inside the viewport and off card bodies (M1 framing likely fixes most of it; add collision padding).
- M3 Applied filter leaves the canvas unframed: with "Haute" (3 matches) only one card is visible, which reads as "1 result". After applying/removing filters, fit the matching cards into view (or show "3 tâches — Tout afficher" affordance).
- M4 (P2) Two filter entry points side by side on phone: top-bar funnel icon and the "Filtres" button in the applied bar. Keep one, or make the bar appear only when filters are active.
- M5 (P2) Focus-mode exit label "Quitter" reads as leaving the app; use "Fermer" / "Close" or "Terminer".
