# Issue 37 security review (builder self-check)

Scope: changed `web/**` source and tests, plus synthetic localhost proof. This is not the independent hostile review and not a deployment assessment.

Severity count: Critical 0, High 0, Medium 0, Low 3, Info 2.

## Preserved controls checked

| Control | Result |
| --- | --- |
| Separate board password session | Preserved; session still created only after scrypt password check. |
| Server-held GitHub token | Preserved; browser only receives session/CSRF values. |
| CSRF on every write | Preserved; `/section`, `/status`, `/questions/.../answer` call `requireCsrf`; synthetic missing-CSRF write returned 403 with zero PATCH. |
| Redirect refusal | Preserved; GitHub client still uses `redirect: 'manual'` and rejects 3xx. |
| Origin/referer checks | Preserved; `requireCsrf` still calls `assertOriginAllowed`. |
| Exact current allowlist | New central registry; exact case-sensitive discovered `owner/name` required. Fabricated, case-variant and unavailable names fail before issue upstream calls. Numeric ID alone is never accepted from the client. |
| No configured-default fallback | Qualified routes resolve the named repository only. Legacy routes use `BOARD_REPO` through the same allowlist when present; absent/inaccessible `BOARD_REPO` cannot grant access. |
| Repository-qualified fingerprints/locks | Fingerprint includes repository identity and issue number; write locks use `owner/name#number`. Cross-repository same-number fingerprint replay returned 409 with zero PATCH. |
| Bounded write verification | Fresh read, ETag send, ETag 412 re-read, post-write verification and UNKNOWN response preserved. |
| Consumed-detail validation | Server still derives source section/question from fresh issue; client validates response identity against expected repository and fingerprint. |
| Mixed-indent code exclusion | Unchanged `sections.ts`/`board.ts` parsing; saved HTTP matrices pass. |
| No secret/repository value in browser storage/URL/logs | Browser stores only `all` or a 64-hex SHA-256 choice digest; URL hash carries only a number. Normal qualified request logs redact `/api/repos/:owner/:name`. |
| XSS | New UI uses `textContent`/DOM construction; no `innerHTML` added. CSP unchanged. |
| SSRF | Discovery and issue URLs stay on the configured API origin; pagination Link URLs are origin/path checked. No arbitrary client URL is fetched. |
| DoS bounds | Login limiter, scrypt queue, body cap, 10 discovery pages, 10 issue pages/repository, 3 aggregate workers, aggregate coalescing, no retries. |

## Findings

### Low 1 - Large token estates can produce a large combined response

Location: `web/server/app.ts` aggregate, `web/github.ts` page bounds.

The combined refresh is finite but has no total issue cap: up to 1,000 current repositories x 1,000 issues/repository can be materialized. Concurrency is fixed at three and page loops are bounded, so this is not an unbounded loop or retry storm, but a very large token estate could consume memory/time on the single-user board. Mitigation: per-repository page bound, fixed workers, manual refresh, no retry. Remediation if this leaves the single-user threat model: add a disclosed total row/repository budget and return an explicitly partial response when exceeded.

### Low 2 - Repository-choice digest is pseudonymous, not a secret

Location: `web/public/app.js` `choiceDigest` / `rememberedChoice`.

The browser stores only a SHA-256 digest of the repository id or full name, never the name. An attacker who can read localStorage and already knows candidate repository names can test guesses. It contains no credential, session value, issue content or repository name. This is a documented preference, not an authorization input; server discovery remains authoritative.

### Low 3 - In-memory unavailable history is lost on restart

Location: `web/server/repositories.ts`.

A repository that loses access stays unavailable for the process lifetime, but a restart loses that retained identity. The first discovery after restart will not list it, so it cannot be shown as previously known unavailable. This is an availability/accuracy limit, not an authorization bypass: restart also fails closed for operations needing a fresh discovery. Remediation if durable inventory is required: persist only immutable identities and last-seen metadata, never tokens.

### Info 1 - Stale allowlist window

Discovery is cached for 60 seconds. A repository that loses access during that window may receive an upstream read/write attempt; GitHub still denies it, and writes fail as error/UNKNOWN without a privilege grant. This is the documented freshness trade-off.

### Info 2 - Synthetic credentials appear only in test fixtures

Harnesses use synthetic tokens and a throwaway password. No live token, real repository, credential, browser cookie or session value is written to proof artifacts.

## STRIDE notes

- **Spoofing:** Password session plus HMAC cookie and CSRF; token account login checked case-insensitively.
- **Tampering:** `auth.ts` was not changed; qualified fingerprint and response-shape checks resist cross-repository replay and stale reads.
- **Repudiation:** Server logs successful writes by issue number and fields; repository path is redacted. No external audit log was added.
- **Information disclosure:** Authenticated picker intentionally displays token-visible repository names. No token, password, session/CSRF or issue body is exposed by `/health`; proof harness checks entry logs for synthetic secrets.
- **Denial of service:** Bounded page/worker/body/login limits; total aggregate size remains a disclosed low risk.
- **Elevation:** Repository authorization is server-derived and exact; client-supplied repository/id cannot widen it. Legacy routes do not fall back to a default outside discovery.

## Verification supporting this assessment

- Full web suite 380/380, root suite 517/517.
- Both typechecks exit 0.
- Exact bundle build/rebuild and hash parity pass; source versus bundle normalized route parity passes 26 checkpoints.
- Identity mutant fails the draft-isolation regression; allowlist mutant fails the fabricated-name regression; restored source passes both.
- Saved #33 adapted matrices pass: baseline 32/32, browser 84/84, additional browser 117/117, residual HTTP 36/36, additional HTTP 129/129, gateway 19/19.
- Multi-repository browser acceptance 25/25 with partial, unavailable, archived, empty and discovery-failed screenshots at 1280 and 360.
