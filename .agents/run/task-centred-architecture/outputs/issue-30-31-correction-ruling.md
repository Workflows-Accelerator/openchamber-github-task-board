# #30/#31 corrected-design gate — 2026-10-24

Target eb9d86c; independent hostile review 37242dd (9router/engineer), correction-hostile.md in design worktree. Verdict PARTIAL / NEEDS-FIXES. No implementation release authorized by this design.

## Accepted findings
1. BLOCKER: a counter inside an editable issue body cannot prove that it was lowered/deleted to a fresh client with no prior history. Reject claim of rollback/tamper detection. A cache or a fabricated example is not a durable history source. Full source question equality plus issue revision may validate the question actually seen; it does not create event history or atomic writes.
2. BLOCKER: rollback on transport error contradicts UNKNOWN handling. On connection loss after send/readback failure, remote outcome stays UNKNOWN, no success and no automatic repeat. An optimistic display must be marked unconfirmed or reloaded before further dependent writes. Do not pretend either old or new local body is authoritative.
3. MODERATE: D1-D3 are settled decisions, not open choices. Standalone PWA push with 60s conditional polling is approved; OpenChamber /emit is rejected. Remove stale spike/framing, no owner re-answer needed.
4. LOW: risk table still suggests Markdown link stripping for identity. Reject; matching includes original link destination, case and punctuation.

## Reviewer recommendation qualification
The review says all HTTP 4xx/5xx responses definitively reject a write. Do NOT adopt that broad claim. An upstream/proxy 5xx can follow a committed change. Classify UNKNOWN conservatively for any potentially post-send failure, unless API semantics prove rejection. No new write is authorized to discover an unknown outcome. Read-only reconciliation only.

## Route back
Question identity/notification history has become a real scope fork. The approved 60s snapshot poller cannot see a question deleted and re-created with identical text wholly between observations; keeping a body counter does not fix this. Durable external history would add storage/recovery complexity and still cannot reconstruct events the chosen poller never saw. Recommend smallest truthful slice: bind an answer to full source text + exact observed issue revision, refuse stale/ambiguous targets, invalidate caches on observed revisions; alert on attention transitions actually observed. Explicitly disclose identical delete/re-ask between polls may be missed. No generation guarantee.

Do not dispatch another blind prose repair. Ask the owner to accept this narrower, truthful first version or pause for a separately aligned history design. Already-approved labels/channel/poll interval are not re-opened. #34 red/green bugfix and #33 security review continue independently. No new implementation/storage mechanism before that answer.
