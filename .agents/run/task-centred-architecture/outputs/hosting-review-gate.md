# Hosting slice — manager review gate (2026-10-26)

Source: `feat/board-hosting` candidate `799eda2` (product `c828bf3`, tests `848c9f8`, builder report `cd0734b`).
Independent reviewer session `ses_1199b4d0ff9aa1f8fc699b2d`, actual `9router/engineer`.

Verdict: Security APPROVED / Spec PASS / Quality APPROVED / PROCEED.

Manager checks performed, not self-graded:
- Read the full recheck report on disk and the product diff `b8e517c..cd0734b` myself.
- Confirmed the original HIGH defect class with grep across the worktree: `BOARD_GITHUB_API_BASE` appears only
  in the intentional ignore-regression test and in review evidence, nowhere in product config or docs.
- Confirmed `web/server/config.ts:282` assigns the fixed `DEFAULT_GITHUB_API_BASE`; no operator override path.
- Confirmed the correction is subtractive plus honest-fallback; no new surface beyond `BOARD_HOST`, `/health`,
  `start:web`, docs.
- Reviewer reproduced hosting 11/11, web 349/349, root 517/517, both typechecks, bundle
  `c385ced6c8fee23852350aa817937ec8ddf5a871dc43bed5be8af0e587674b5d`, and red-before evidence on `b8e517c`.

Accepted for integration into `feat/v2-binding-and-ratelimit` only. Not deployed, not merged to `master`,
no secrets provisioned, no port published, no proxy/TLS/restart behaviour proven.
