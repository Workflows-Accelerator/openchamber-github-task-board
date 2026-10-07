# Latency & Request Cost Benchmarks: Taskboard All Projects Mode

**Benchmark Target:** `TaskboardManager.getTask(number)` in All Projects Mode (`__all_projects__`)  
**Comparison:** Cold Lookups (Sequential Fan-out to N repos) vs Warm Lookups (30s TTL Generation-Protected Cache)  
**Execution Environment:** Node.js v22.23.3, Linux x86_64  

---

## 1. Quantitative Benchmark Results

The benchmark simulated realistic GitHub API network round-trip latencies (50ms representing fast local/cached network; 200ms representing standard transatlantic GitHub API TLS latency) across workspaces configuring 2, 4, and 8 repositories.

| Repositories (N) | Simulated API Latency (ms) | Cold Turn Duration (ms) | Cold HTTP Requests Made | Warm Turn Duration (ms) | Warm HTTP Requests Made | Quota / Speedup |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **2** | 50 ms | 105 ms | 2 | 0 ms | 0 | ∞ (0 reqs) |
| **4** | 50 ms | 205 ms | 4 | 0 ms | 0 | ∞ (0 reqs) |
| **8** | 50 ms | 408 ms | 8 | 0 ms | 0 | ∞ (0 reqs) |
| **8** | 200 ms | 1,609 ms | 8 | 0 ms | 0 | ∞ (0 reqs) |

---

## 2. Trade-Off Analysis: D11 Known-Repo Lookup vs Issue #17 Complete Ambiguity Safety

### Background
- **D11 Intent:** Avoid fanning out to N repositories on voice turns by looking up the repository from known cached tasks.
- **Commit `cd6ab18` Defect (Finding 8):** In `cd6ab18`, `getTask` used `knownIssueRepos` populated from previous single-repo `getTasks()` runs. If issue #12 was seen in `repo-backend`, it shortcutted to querying ONLY `repo-backend`. If `repo-frontend` also possessed issue #12, that collision was silently suppressed, violating Issue #17.
- **Repair 1 (`252225a`):** On any cold lookup where `cleanRepo === '__all_projects__'`, `TaskboardManager` unconditionally checks all configured repositories sequentially.
- **Cache Invariant:** Once verified across all repositories without non-404 errors, the confirmed unique issue or collision warning is cached under `task:__all_projects__:${number}` for 30 seconds with generation protection.

### Latency Assessment & Findings
1. **Cold Penalty:**
   - In workspaces with 8 repositories, a cold lookup pays `~1.6 seconds` (at 200ms API latency).
   - While within Gemini Live's 5-second deadline, sequential execution is slower than `Promise.allSettled` (~200ms parallel).
   - However, sequential execution was deliberately mandated by D11 to prevent API burst rate limits against GitHub's 5,000 req/hr quota.
2. **Warm Benefit:**
   - Subsequent voice turns querying the same task within 30 seconds hit the in-memory cache in 0ms with zero HTTP requests.
3. **Collision Completeness:**
   - Complete cross-repository collision safety is guaranteed across open and closed issues.
   - Partial repository outages (e.g. 401/403 or network failure) prevent caching (`canCache = false`), preventing false uniqueness guarantees.
