# Review gate rulings — 2026-10-25

## #34 seven-finding pass
- Reviewer ses_e1043143a0899bf0665556ca; actual 9router/engineer; 72f3f76 report, a8f55c2 product. PASS/APPROVED for seven findings; 19 targeted/510 full, red-before/green-after reproduced. Installed-host E2E NOT RUN. Minor probe timing caveat is disclosed.
- Manager diff inspection found a NEW concrete hypothesis not covered by the seven-finding table: draft cache keys use issueNumber and generic issue-number fallback, unlike repo-qualified inFlightQuestions. Possible cross-repository and cross-question draft attribution. No defect conclusion yet; integration HELD for one independent focused proof, ses_2fadeaf8ebd848b2df3e96cb engineer. Brief tasks/issue-34-draft-isolation-check.md. No fix authority or full-suite repetition.
- Two view renderers additionally set userLayoutPreference/data-layout; focused reviewer may report only a real reproduced regression, no scope creep.

## #33 bounded final review
- Reviewer ses_26ee4e9daa4d87851a9a7df8; actual 9router/genius. Commit 8818b94; product f50519d unchanged. Security NEEDS-FIXES / Spec PARTIAL / Quality NEEDS-FIXES. No new High. Web 96/root 466/browser 32 + hostile 33 reproduced; defective observations separate, not requirements passing.
- N1 Medium ACCEPTED: browser gateway HTML, malformed/missing JSON success and untrusted post-send failures need UNKNOWN; malformed upstream 422 parse was discarded then classified as invalid. Must preserve trusted rejection provenance. No automatic repeat.
- N2 Low ACCEPTED: default redirect follow can replay PATCH/body/token across repo paths before validation. Reject redirects before following; real 302/307 regressions. No external exfiltration claim inferred from synthetic probe.
- N3 Low ACCEPTED: .trim readback comparator masks meaningful Markdown indentation. Compare serializer projection while only normalizing line endings/serializer blank lines; retain whitespace significance.
- N4 Low ACCEPTED: shared question parser interprets malformed fence closer as real, exposing code example and allowing answer mutation. Scope fork: web-only refusal of uncertain fenced targets avoids touching shared panel parser while #34 active; shared fix would need explicit scope. No silent authorization.
- N5 Low ACCEPTED: README queue 8/deadline5 contradict code queue4/deadline2; closure report overclaims. Sync exact numeric contract and residuals, no unbounded resilience guarantees.
- Decision: no merge, deployment, or closure. This final bounded review did not clear the gate. Ask owner before another correction pass (previous rounds already consumed). Proposed one web-only pass for all five plus one independent final review; stop again if it fails. No master authority inferred.
- Production GitHub permissions/writes, TLS/proxy/start persistence, real keyboard focus all NOT RUN. npm run build:web nonexistent; correct build is documented esbuild (see 8818b94 report).

## Restarts and outstanding alignment
- Both review wakes received; do not repeat dispatches/reviews. Root 83b065d intact; unrelated/private untracked files untouched.
- #37 pending question was aborted by restart, no answer. Current issue body contains a fabricated default "exclude archived/empty" answer; NOT approved. Ask owner once, then correct issue. Do not implement guessed filter.
- Coverage every token-readable repo and bot identity already confirmed in decision13, DO NOT re-ask. GitHub cannot enumerate invisible private repos. Disclose access boundary; report known repos that become inaccessible as unavailable. Never claim universal knowledge of hidden repositories.
