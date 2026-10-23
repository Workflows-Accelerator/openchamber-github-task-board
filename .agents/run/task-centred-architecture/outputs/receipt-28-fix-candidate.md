Fix candidate for #28 is at `8625b0a` on `fix/issue-28-current-board` (base `88d3970`).

- Closes the two reviewed races: an older full refresh completing after a successful body/status edit no longer restores pre-edit values, and an older paginated full snapshot no longer regresses newer incremental fields. Membership from a completed snapshot stays authoritative.
- Mechanism: bounded admission records (5 min TTL, 400 cap, `repo#number` key) settle on PATCH outcome; publications overlay only newer local fields; the publication watermark is `max(request start, existing)`.
- Builder evidence: 7 new shipped-bundle regressions failed on `88d3970` for the reviewed reason and pass now; 482/482 suite, typecheck and build green.
- Known gaps the builder reported: archive/tag add-remove/priority/complexity label writes and issue creation are not wired to the admission helper; real-browser L3 and human validation remain unrun.

An independent hostile review of `8625b0a` is running now (TTL/cap eviction, failed-PATCH release, membership retention, watermark freeze, unwired writes, red-first revert, seeded interleaving fuzz, bundle parity). No merge, closure or deployment is implied. A second competing fix exists locally and will be discarded unless it proves better.
