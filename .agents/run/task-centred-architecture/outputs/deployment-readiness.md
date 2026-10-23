# Deployment readiness — observed 2026-10-23

Public, unauthenticated probes only (no credentials, no private paths):

| URL | Result |
|---|---|
| https://workflows.ac | 200 text/html, `server: nginx/1.29.4` |
| https://live.workflows.ac | 404 `text/plain` (root path has no page) |
| https://board.workflows.ac | TLS failure: client could not verify the first certificate (chain/hostname problem, not a 404) |

What this means for #33:
- A host with nginx exists for workflows.ac, so serving the board there is plausible, but the board subdomain's certificate currently does not verify from a normal client. That must be fixed before any browser sign-in over HTTPS can be trusted, and `Secure` cookies depend on it.
- We do not know from outside whether board.workflows.ac points at that same host, who controls the DNS record, or who owns the certificate. Those remain user facts.
- No deployment, DNS, proxy or TLS change was made. Nothing was installed.

What the user must supply before deployment:
1. Where the board process should run (same host as workflows.ac, or another), and whether we may add a systemd unit or container there.
2. Who controls the board.workflows.ac DNS record and its certificate (and why the chain currently fails).
3. The GitHub fine-grained token (one repository, issues read/write) and the account login it belongs to, plus how the board password should be set (they choose it; we never print it).
