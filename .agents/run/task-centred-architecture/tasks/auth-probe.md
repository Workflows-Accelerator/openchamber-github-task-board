<env_preflight>
repo: /workspace/extensions/github-task-board
location: this checkout, READ-ONLY. Do not edit, create, move, delete, commit or push any file. Do not install anything.
forbidden: printing any credential value, token, header, cookie, key, or full environment dump; network writes; issue creation; gh issue develop.
</env_preflight>

<goal>
Determine, without exposing secrets, which authenticated route exists for creating one GitHub issue in Workflows-Accelerator/openchamber-github-task-board from this machine.
</goal>

<steps>
Check each and report only PRESENT / ABSENT / UNKNOWN with a one-line reason:
1. `gh` on PATH (`command -v gh`).
2. `curl` and `node` on PATH.
3. Environment variables `GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_PAT` — check only whether each is non-empty (`[ -n "$VAR" ]`); never echo its value or length.
4. Credential files: `~/.config/gh/hosts.yml`, `~/.netrc`, `~/.git-credentials` — existence only; if a file exists, say whether it contains a `github.com` host entry (grep -l style, no contents).
5. Git credential helper configured for github.com (`git config --get-all credential.helper` only; do not invoke `git credential fill`).
6. In this repo, any existing GitHub API integration the extension itself uses: grep for `api.github.com`, `octokit`, `GITHUB_TOKEN` in `panel/`, `server/`, `package.json`, excluding node_modules and dist. Report file:line only, no values.
7. Whether the OpenChamber host exposes a GitHub auth/token route: grep the installed `@openchamber/sdk` types for `github` (file:line only).
</steps>

<criteria>
- No secret value appears anywhere in your output or in any file you write.
- Distinguish "credential exists" from "credential is valid for the target repo"; do not attempt a write.
- If a token exists, you may make ONE read-only authenticated GET to `https://api.github.com/repos/Workflows-Accelerator/openchamber-github-task-board` to test validity, printing only the HTTP status code and the `permissions` object keys (not values). If that call would print headers, do not run it.
</criteria>

<output>
<=12 lines: a table of route / status / evidence, then one line naming the best safe route for the publisher, or NONE.
</output>
