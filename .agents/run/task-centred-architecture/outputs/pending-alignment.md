# Alignment forks to resolve before their implementation

Recorded so they are not lost. Not raised yet: each becomes a batched question only when its slice is next
on the frontier, so the owner is not interrupted twice.

## 1. #31 "authorized work resumes" versus the standalone board
The board has no agent control by decision and design: it cannot start, resume or stop an agent. #31 asks that
answering a question lets authorized work resume. On the standalone board the honest capability is: the answer
is saved to the exact observed question on the issue, the issue leaves the human-attention state, and an agent
that polls the issue can continue. That is not the same as the board resuming an agent.

Fork for the owner when #31 is picked up:
- A. Board notifies and records answers only; an agent watching the issue resumes on its own (documents the gap).
- B. Board gains an explicit command for a running agent coordinator, which breaks the no-agent-control boundary
   and needs its own security review.
Recommendation: A for this mission. B belongs with #29/#26 architecture work.

## 2. "Expiration" for attention
Mentioned in the original vision but never defined. Excluded from design and code. If the owner wants it, the
question is what expires: an unanswered question, a stale notification, or a stuck task. Each has different
consequences and none is implemented.

## 3. Proxied sign-in throttling — owner decision needed before public exposure
Source inspection shows sign-in throttling keys on the direct TCP peer address, with no forwarded-header trust. Behind a single reverse proxy every visitor shares one bucket, so five failed attempts from anyone can lock out all users for up to 60 seconds. This needs a decision, not a silent fix:
- A. Accept the shared bucket and document the lockout limit; no header trust is added. Cheapest, keeps the prior anti-spoofing ruling.
- B. Add a strict single trusted-proxy peer setting: use a forwarded client address only when the direct peer exactly matches the configured proxy, with spoofing and deployment regression tests. More code and a new configuration failure mode, but restores per-client limiting.
- C. Remove or greatly loosen sign-in throttling. Not recommended: weakens brute-force resistance.
Recommendation: B, implemented and independently tested before public deployment, because a trivial global lockout is a real denial of the only access path. This does not reopen general XFF trust. No code change dispatched pending the choice.

## 4. Deployment go — RESOLVED; prerequisites still blocked
Decision18 records the owner's go for the aligned same-container deployment and brief interruption. Do not ask for that same permission again. Dedicated token and separate board password/hash are absent from inspected deployment stores and must be securely provisioned, never in chat. A fresh board session secret can be generated; the required bot username is a non-secret identity pin. Persistent startup/crash recovery, exact accepted artifact, private network path and operator recovery must pass independent plan review before production change. No master-merge approval, credential-reuse permission, human acceptance or issue closure is implied. See outputs/deployment-plan-review-dispatch.md.
