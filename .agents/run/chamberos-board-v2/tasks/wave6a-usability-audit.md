<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
HEAD: 4e1374c (V4-3 live as b85676f-20261113). Tracked tree clean; untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ is OFF LIMITS.
Root checkout on ops/task-board-activation: never edit, commit or switch there.
Chromium: source .agents/run/chamberos-board-v2/verifications/V4-2/scripts/browser-env.sh.
LIVE SITE: https://board.workflows.ac serves b85676f-20261113. You may load it SIGNED OUT only. Never sign in against production, never type the board password, never read board.env, jwt-secret or cookies.
Forbidden: any source edit under web/**, panel/**, docs/**, service/**; any GitHub write (no label, comment, issue, PR); push; deploy; /workspace/releases/**; /workspace/code/openchamber-config/**; /workspace/.openchamber-data/**; credential output; `git remote -v`; deletion; delegation.
</env_preflight>

<goal>
Produce the evidence for the owner's verdict "le board est effrayant, même pour moi": an inventory of every place the board shows a question or shows progress, what it looks like at phone and desktop width, and why a person can lose their bearings there. You are not fixing anything and you are not proposing a redesign; you are making the problem concrete enough to decide on.
</goal>

<context>
The owner said, verbatim: "we have to talk a lot about how questions look, and how we track progress etc. Cause rn, the board is scary, even for me... So we're far from done."
Shipped surfaces to examine: the human review gate (image, video, link, question with presets, legacy missing artifact, malformed, in-review), Open Questions with `::` options and details disclosure, Decisions in Markdown, agent notes as GitHub comments, status labels and columns, filters, focus mode, dependency arrows, the desktop rail, the phone drawer, Arrange and Undo, zoom and framing limits.
Prior art you may read but must not modify: verifications/V4-3/screenshots/ (84 rows), verifications/b85676f-20261113/screenshots/, verifications/V4-2/screenshots/.
</context>

<method>
1. Live, signed out, at 390x844 and 1280x900, light and dark, EN and FR: capture list, canvas, drawer (open a task if signed-out allows), filters, focus, and the Decisions view. Name every capture `live-{surface}-{width}-{theme}-{lang}.png`.
2. If a signed-out session cannot open a task drawer, render the same components with the synthetic fixture used by verifications/V4-3/scripts/browser.mjs and label those captures `synthetic-…` — never present a synthetic capture as the live site.
3. For each surface, record what a person sees first, what competes for attention, how many actions are visible at once, the smallest text size in CSS pixels, the contrast of secondary text, and whether the primary action is above the fold at 390. Measure, do not estimate.
4. Then answer these questions with evidence, not opinion:
   - When a task asks something of the person, can they tell in under three seconds what is asked and what to do?
   - When nothing is asked, does the surface look calm, or does it still look like work is expected?
   - Can the person tell where a task stands without reading its body?
   - Do status, column, filter and dependency views ever contradict each other about the same task?
   - At 390, how many taps does it take to answer a gated question, and how many to find out why a task is waiting?
   - Which words are ambiguous or duplicated (for example "review" meaning both agent review and human review, "waiting" for two different states)?
5. Write verifications/usability-audit-2026-11-13/README.md: a ranked table of findings — severity, surface, what the person sees, why it costs them, the measurement, the capture file. Then a short list of the three places where a single decision by the owner would unblock the most, phrased as questions, not as solutions.
6. Commit captures and README as `test(usability): inventory the question and progress surfaces`.
</method>

<output>
At most 16 lines: STATUS, CAPTURES (count, live vs synthetic), FINDINGS (ranked, one line each with severity), THREE_DECISIONS (the three questions), CONTRADICTIONS found, TAPS at 390, COMMIT, NOT_VERIFIED. No proposal to implement, no claim of approval.
</output>
