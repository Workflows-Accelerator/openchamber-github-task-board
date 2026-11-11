# User feedback — 2026-11-11, first phone review of the live V3 board

Source: user message after opening `https://board.workflows.ac` on their phone (V3 live, `6826bc8` / app `5bf1c62`).
Verdict: "C'est beaucoup mieux" — global design direction accepted. Below are the concrete defects and requests, verbatim-intent preserved.

## F1 — P0 functional: canvas drag does not persist and reports an unknown error
The user drags an issue card on the Canvas, the card does not stay where dropped, and an error message appears ("unknown error"). Nothing else was said about it.
Working hypothesis (NOT proven): the client throws `write_outcome_unknown` (`web/public/app.js:349,385,415,426,1526,1571,6039,6095`) on the canvas PATCH (`/api/issues/:n/canvas`, `web/server/app.ts:903-915`, op kind `canvas` at `app.ts:2081-2106,2592`), i.e. the write fails or returns an unreadable/empty body, and the client's message is the generic 5xx/network wording. Possible V3-3-relevant interactions: the new cache invalidation (`invalidateRepositoryCaches()` in `finally`), conditional `304` handling, or the singleflight map. Must be reproduced against a real GitHub-backed repo, not only fixtures.

## F2 — P1 UX: every bottom sheet is ugly, filters are unclear (especially in Canvas)
All sheets (filters, settings, others) need a real redesign: clear grouping, obvious state, readable at 360–430px. Filters: the user cannot tell what is applied or what each filter does while on the Canvas.

## F3 — P1 UX: Canvas dependency readability
The Canvas does not make dependencies obvious: how cards organise themselves, which arrow means what, and what is upstream/downstream of a selected issue is not legible.

## F4 — P2 polish: spacing details
"Peut-être des petits éléments qu'on peut revoir, parfois sur l'espacement."

## F5 — P1 feature: quick note on an open issue
The user wants to add a note on the issue currently open in front of them (not the existing canvas sticky note, which is a different object). The note must be "prise en compte par le modèle" — i.e. visible to the agent that works the issue. May or may not be linked to a canvas position.

## F6 — P1 policy: human validation is over-used
Many current issues sit in `in review` or awaiting human validation. Not every task deserves a human gate; many human validations are useless when an AI could do them. Human validation must be reduced to click-through actions: validate a screenshot, open a link, watch a short video, give feedback. Anything requiring code, running a command, or starting a dev server will not be done by a human and must not be a gate.

## F7 — P2 branding: "Atelier" means nothing
The main logo/wordmark must change ("Atelier" is meaningless). Appears at `web/public/index.html:8` (`<title>`) and `:42` (`.sidebar-brand-title`).

## F8 — P1 UX: Decisions questions are Markdown but rendered as raw text
In the Decisions view, question bodies are plain text; Markdown is not interpreted, so it looks bad. Markdown rendering there is described as "impératif".

## F9 — P1 feature: preset answer options with expandable details
Users should not answer questions with free, cold text. Provide preset options, each with collapsible details.

## F10 — research draft (optional): transcribe OpenChamber questions into the board
OpenChamber recently renders model questions as an interactive UI. Research whether that question payload can be transcribed directly into the issue being handled on the board. Explicitly optional: "on peut faire un peu de recherche et alimenter, pourquoi pas, une issue brouillon... ce n'est pas forcément quelque chose qu'on est obligé de développer."

## F11 — accepted as-is
Global design, phone shell, bottom dock, List grouping, bilingual parity and the Any-Repo behaviour were received positively. No rollback requested.
