<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
HEAD: at least a58bcb1 plus whatever the browser-evidence task committed (check `git log --oneline -n 6` once). Tracked tree must be clean when you start; if it is not, stop and report instead of committing someone else's files.
Untracked and OFF LIMITS: .agents/run/chamberos-board-v2/verifications/V4-1-L4/ — never stage, never modify.
Root checkout on ops/task-board-activation: never edit, commit or switch there.
Chromium: source .agents/run/chamberos-board-v2/verifications/V4-2/scripts/browser-env.sh before any browser run. The delivery smoke needs the same environment.
TIMEOUT: scripts/generate-delivery-smoke.mjs takes 5–6 minutes. Run it in the FOREGROUND with a 900000 ms tool timeout. Never end your turn while a job you started is still running.
Forbidden: any source edit under web/**, panel/**, docs/**, service/**; push; deploy; /workspace/releases/**; /workspace/code/openchamber-config/**; /workspace/.openchamber-data/**; any GitHub write; credential output; `git remote -v`; file deletion; delegation.
</env_preflight>

<goal>
Close the two long-running proofs for V4-3: the framing promise probe (the 0.55 readability floor, the honest limit message, Show all) and the 14-section delivery smoke, both run against the V4-3 tree, with the real numbers recorded.
</goal>

<context>
V4-3 (cd97f8e) adds a server guard: a task may enter status:needs-human only when its body carries a clickable human-review artifact. Existing probe and smoke fixtures that set needs-human directly on the synthetic GitHub, or through the status control, may now be refused or may render as a legacy defect card. That is the intended policy, not a regression — but it may change what an existing probe asserts.
Prior evidence is immutable: never edit anything under verifications/V4-2/, V4-2-L4/ or V4-2-L4-delta/. Copy what you need into verifications/V4-3/scripts/ at the same directory depth so relative imports still resolve.
Framing baseline from the V4-2 delta review, which must reproduce: automatic framing stops at 0.55 with the honest limit legend, Show all reaches 0.315 at 360 and 0.344 at 390 with every card inside and none under the HUD, and 1280 auto-frames at 0.785. 12/12 cases, 0 CSP, 0 console.
Smoke baseline from the V4-2 delta review: 14/14 sections, 191 captures, about 341 s, exit 0.
</context>

<steps>
1. Copy .agents/run/chamberos-board-v2/verifications/V4-2/scripts/framing-promise.mjs to verifications/V4-3/scripts/ and run it with the Chromium environment sourced. Record the raw log with its exit code, the JSON, and the exact framing numbers per width. If a case fails, do not edit the expectation to match: report the measured number against the promised one and say which is wrong.
2. Run the delivery smoke against this tree with the long timeout:
   `DELIVERY_DIR=.agents/run/chamberos-board-v2/verifications/V4-3 node scripts/generate-delivery-smoke.mjs`
   Save the log with an EXIT_CODE line and the elapsed time. If a section fails because the new guard refuses a needs-human transition that the fixture still performs, that is a real interaction worth reporting precisely: quote the failing assertion, the response status and the body, and say whether the fixture or the guard is at fault. Do not weaken or skip a section to get green, and do not modify scripts/generate-delivery-smoke.mjs unless a fixture body plainly needs a valid artifact to exercise the surface it already claims to exercise — if you do modify it, that is its own commit and you say so.
3. Append a "Framing and delivery smoke" section to verifications/V4-3/README.md with: the framing table (width, automatic scale, whether the limit legend appeared, Show-all scale, cards inside, cards under HUD), the smoke section count, captures, duration and exit code, and any failure quoted verbatim.
4. Commit the evidence: `test(v4-3): record framing and delivery smoke evidence`. If you changed the smoke fixture, commit that separately first.
</steps>

<output>
At most 12 lines: STATUS, FRAMING (per width: auto scale, legend, show-all scale, inside, under HUD), SMOKE (sections, captures, duration, exit code), FAILURES (verbatim or none), COMMITS, README updated yes/no, NOT_VERIFIED. No claim of completion, review, publication or human acceptance.
</output>
