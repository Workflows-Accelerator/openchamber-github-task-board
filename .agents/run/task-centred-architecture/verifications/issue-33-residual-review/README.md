# Residual review proof index

Independent recheck of candidate `d41ff34` against `f6ee7da`. Synthetic localhost only.
Verdict and findings: `.agents/run/task-centred-architecture/outputs/issue-33-residual-hostile.md`.

| Path | Purpose |
| --- | --- |
| `probes.mjs`, `probes.json`, `probes.log` | Adapted independent N1–N5 and boundary probes; 28/28 pass on candidate. |
| `residual-http.mjs`, `candidate-residual-http.json`, `old-residual-http.json` | F2 422 classification and F3 indentation projection/refusal, candidate vs old. |
| `browser-matrix.mjs`, `candidate-browser-matrix.json`, `old-browser-matrix.json` | F1 84-case real browser/real HTTP gateway save-response matrix for section, question, status. |
| `browser-gateway.mjs`, `browser-gateway.json` | Original 19-case gateway harness, unmodified payload set, on candidate. |
| `browser-baseline.mjs`, `browser-verification.json` | 32-check baseline browser harness on candidate. |
| `summary.json`, `verdict.json` | Machine-readable counts and verdict. |
| `scope.log` | Product scope and untouched-path checks. |
| `screenshots/` | Desktop and 360px screenshots from all browser runs. |

`PRODUCT_ROOT=/tmp/opencode/issue33-residual-review/old RESULT_PREFIX=old` reruns a matrix against old runtime sources extracted by `git archive f6ee7da web panel`. Both matrices exit nonzero when a requirement fails.
