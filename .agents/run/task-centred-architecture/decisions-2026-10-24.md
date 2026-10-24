# Owner decisions — 2026-10-24

Asked once, answered in chat by the owner. These override the written #33 acceptance criteria where they conflict.

1. **Board sign-in: separate board password.** Keep the built password flow and the server-held GitHub token. The owner accepts that anyone with the board password gets access and that GitHub identity is not checked. #33 criterion "limited to the configured GitHub account / second account refused" is superseded by: access limited to holders of the board password; token stays server-side; one configured repository only.
2. **Concurrent edits: best-effort editing.** Keep editing. Refuse changes detected before saving (fingerprint mismatch -> 409). Show a clear warning that a simultaneous GitHub or agent edit can still be overwritten. #33 "concurrent edits fail closed" is relaxed to: detected conflicts refuse; undetectable window disclosed in the page and README; no claim of atomic or fail-closed writes; an ambiguous write outcome is reported as unknown and never silently repeated.
3. **Deployment: investigate how live.workflows.ac is deployed with OpenChamber using the DevOps CLI**, then propose the same shape for board.workflows.ac. Investigation is read-only; any deployment change still needs the owner's explicit go.

Not decided yet: #30/#31 D1–D3 (pending a final correction pass of the design). Master and deployment remain human-gated.
