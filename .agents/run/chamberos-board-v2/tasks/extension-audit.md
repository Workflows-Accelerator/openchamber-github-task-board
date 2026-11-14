<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board
Branch: ops/task-board-activation
Mode: READ-ONLY on all source. Write ONLY under `.agents/run/chamberos-board-v2/verifications/extension-audit/`.
Forbidden:
- NEVER edit `panel/**`, `service/**`, `web/**`, `package.json`, or `/workspace/code/openchamber-config/**`.
- NEVER read or print `board.env`, `jwt-secret`, tokens or secrets.
- NEVER push, deploy, restart the board, or spawn subagents.
</env_preflight>

<goal>
Produce a precise inventory of the current OpenChamber extension (manifest `openchamber` block in `package.json`, `panel/**`, `service/**`) and a gap table against every contribution point in the `openchamber-extensions` skill, so an implementation worker can add surfaces without guessing. Ground every claim in a file and line.
</goal>

<checklist>
1. **Manifest inventory.** Quote the full `openchamber` block of `package.json` (id, name, icon, apiVersion, engines, capabilities, origins, contributes.panel, contributes.service, integration if present). State exactly which contribution points are declared and which are absent: `statusSection`, `marks`, `actions`, `commands`, `mentions`, `blocks`, `instructions`, `skills`, `opencodePlugin`, `providerLogos`, `sessionControl`, `sessionEvents`, `service.schedule`, `service.provides`, `fileEditors`, `page`, `integration`.
2. **Panel inventory.** `panel/main.ts` (and its imports) — list the features the panel offers today, grouped: data loading, views, task actions, question answering, repo selection, settings, error handling. For each, name the function and line range. Note the panel's size (lines) and its main structural weaknesses (god-file, duplicated fetch logic, ad-hoc dropdowns, hand-rolled markdown, no empty states, etc.). Be specific and cite lines.
3. **Service inventory.** `service/main.ts` — list every HTTP route it answers, what each returns, and which of them the panel actually calls. Note whether it already holds the data a `statusSection` would need (needs-me count, running sessions, blocked count, top item) and whether it can produce 16 rows cheaply.
4. **Data available for new surfaces.** Answer concretely: can the service compute, from what it already has, (a) a "needs me" count, (b) the running-agent sessions, (c) the blocked count, (d) the single most urgent item with its issue number and repo, (e) an issue's title/body by `owner/repo#n` for a `mentions` row? Cite the functions that would provide each. If a surface would need new fetching, say what and how expensive (API calls per poll).
5. **Gap table vs the skill.** One row per contribution point: declared today?, would add real value for this board?, data ready?, estimated cost in files touched and new routes, main failure mode. Rank the points by value-per-cost and say which 3 to do first and why. Do not propose a redesign of the panel; propose where the board should appear so the panel is opened less.
6. **Constraints to respect.** List the product invariants an implementation must not break (zero `n8n`/`mobile`/emojis, strict CSP, no fake data, EN/FR parity, `openchamber` engines `>=1.22.0` and `apiVersion: 1`, existing tests under `test/`).
7. Write `.agents/run/chamberos-board-v2/verifications/extension-audit/README.md` and commit only that directory.
</checklist>

<output>
At most 14 lines: DECLARED (points), ABSENT (points), PANEL_FEATURES (count + 3 biggest weaknesses with lines), SERVICE_ROUTES (count), DATA_READY (a-e yes/no + source), RANKED_TOP3 (point + why + cost), INVARIANTS (short list), COMMIT, NOT_VERIFIED.
</output>
