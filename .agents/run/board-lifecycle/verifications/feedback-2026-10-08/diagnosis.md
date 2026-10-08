# Zero-Edit Diagnosis: Human-Review Failures & Refresh Behavior

**Date:** 2026-10-08  
**Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-review-feedback-views`  
**Branch:** `fix/review-feedback-views`  
**Scope:** `panel/**`, `test/**`, and `.agents/run/board-lifecycle/verifications/feedback-2026-10-08/**`

---

## 1. Failure 1: Identical List and All Tasks Icons

### Anchors
- `panel/index.html:2768-2779`:
  - Line 2768: `#btnViewAllTasks` uses:
    ```html
    <svg class="icon" viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
    ```
    This path represents a bulleted list (`format_list_bulleted`: 3 square bullets with 3 horizontal lines).
  - Line 2776: `#btnViewList` uses:
    ```html
    <svg class="icon" viewBox="0 0 24 24"><path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"/></svg>
    ```
    This path represents 3 horizontal lines (`view_list` / menu lines).
  - In small rendered sizes (14-16px) in the toolbar, 3 bulleted lines vs 3 plain lines appear visually indistinguishable to humans — both are perceived as "list".
- `panel/main.ts:3636`:
  - In `updateViewModeButtons`, the sidebar toggle icon `#btnLayoutToggle` for `'all-tasks'` mode sets `innerHTML` to the identical bulleted list SVG:
    `'<svg class="icon" viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>'`

### Root Cause
`#btnViewAllTasks` was given a bulleted list icon instead of a checklist icon.

### Minimal Remedy
Replace the SVG path in `panel/index.html:2769` and `panel/main.ts:3636` with a true checklist icon displaying distinct checkmarks alongside task lines (e.g. `M22 7h-9v2h9V7zm0 8h-9v2h9v-2zM5.54 11L2 7.46l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41L5.54 11zm0 8L2 15.46l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41L5.54 19z`).
Preserve accessible attributes (`title="All Tasks View"`, `aria-label="All Tasks View"`, `role="radio"`).

---

## 2. Failure 2: Technical Titles in Simplified Views

### Anchors
- `panel/core.ts:85-143` (`parseFriendlyTitle`):
  - Signature: `parseFriendlyTitle(body: string | null | undefined, defaultTitle?: string)`.
  - When markdown body contains `### Friendly Title: Foo`, returns `{ title: 'Foo', subtitle: defaultTitle || null }`.
  - When markdown body has NO friendly title, falls back to `{ title: defaultTitle || '', subtitle: null }`.
- `panel/main.ts:3067-3070` (`buildHumanCard` in Human Tasks view):
  ```ts
  const titles = parseFriendlyTitle(issue.body, issue.title);
  const displayTitle = titles.title.trim() || issue.title?.trim() || `Issue #${issue.number}`;
  const displaySubtitle = titles.subtitle && titles.subtitle.trim() !== displayTitle ? titles.subtitle.trim() : null;
  ```
- `panel/main.ts:3305-3308` (`renderAllTasksView` in All Tasks view):
  ```ts
  const titles = parseFriendlyTitle(issue.body, issue.title);
  const displayTitle = titles.title.trim() || issue.title?.trim() || `Issue #${issue.number}`;
  const displaySubtitle = titles.subtitle && titles.subtitle.trim() !== displayTitle ? titles.subtitle.trim() : null;
  ```
- `panel/main.ts:3405-3408` (`renderQuestionsView` in Questions view):
  ```ts
  const titles = parseFriendlyTitle(issue.body, issue.title);
  const displayTitle = titles.title.trim() || issue.title?.trim() || `Issue #${issue.number}`;
  const displaySubtitle = titles.subtitle && titles.subtitle.trim() !== displayTitle ? titles.subtitle.trim() : null;
  ```

### Root Cause
- **Data Cause:** Remote issues #22 and #23 had no or malformed Friendly Title sections in their remote bodies.
- **Renderer Cause:** The simplified views (`human`, `all-tasks`, `questions`) passed `issue.title` as `defaultTitle`. When no friendly title was parsed from markdown, `parseFriendlyTitle` returned `{ title: issue.title, subtitle: null }`. The simplified views then rendered `issue.title` (a technical conventional-commit slug like `feat(board): ...`) as the primary title `displayTitle`, and rendered NO subtitle because `titles.subtitle` was null.

### Minimal Remedy
When an issue body has no friendly title (`titles.subtitle === null` when `defaultTitle` is passed, or when `parseFriendlyTitle(issue.body)` has empty title):
1. Use a quiet explicit placeholder for `displayTitle`: `(No friendly title)`.
2. Move the technical title (`issue.title` or `Issue #${issue.number}`) into `displaySubtitle` so the user still has technical context without confusing it for a friendly title.
3. When a friendly title IS present, render `displayTitle = titles.title` and `displaySubtitle = titles.subtitle`.

---

## 3. Failure 3: Empty Human Tasks and Questions Queues

### Anchors
- `panel/main.ts:3036` (`renderHumanTasksView`):
  ```ts
  const humanIssues = filteredIssues.filter((i) => resolveIssueColumn(i) === 'needs-human');
  ```
- `panel/labels.ts:335-474` (`resolveIssueColumn`):
  - Resolves column based strictly on labels (`status:needs-human`, `status:in-review`, etc.) and session activity (`waiting-permission`, `waiting-question`, `idle`).
  - An issue without explicit status labels defaults to `'todo'` (line 473).
- `panel/core.ts:287-348` (`collectHumanTodos`):
  - Extracts items from `### Human Tasks:`. If empty, falls back to `### Open Questions:`. If empty, falls back to session waiting reason.
- `panel/main.ts:3370-3376` (`renderQuestionsView`):
  ```ts
  for (const issue of filteredIssues) {
    const questions = parseOpenQuestions(issue.body || '');
    const unanswered = questions.filter((q) => !q.completed);
    if (unanswered.length > 0) {
      issuesWithQuestions.push({ issue, questions: unanswered });
    }
  }
  ```

### Root Cause
- **Data Cause:** Live issues #22 and #23 had no `### Human Tasks:` checklists, no `### Open Questions:` checklists, and no `status:needs-human` labels. Thus both views rendered empty states ("Nothing is waiting on you" and "No open questions").
- **Renderer Cause:** `renderHumanTasksView` strictly filtered `resolveIssueColumn(i) === 'needs-human'`. If an issue had an explicit `### Human Tasks:` section with uncompleted checklist items in its body but had not yet received a `status:needs-human` label from the agent/user, it was excluded from the Human Tasks view.

### Minimal Remedy
1. In `renderHumanTasksView`, include issues that resolve to `needs-human` OR have uncompleted human todos via `collectHumanTodos(issue, session).length > 0` (excluding closed/done issues).
2. Build positive test fixtures containing realistic `### Human Tasks:` and `### Open Questions:` to prove queue population end-to-end.

---

## 4. Failure 4: Unreliable Current-Session Repository Discovery and Switching (Issue 24)

### Anchors
- `panel/main.ts:7133-7142` (`host.onSession`):
  ```ts
  host.onSession(async (sess) => {
    if (sess) {
      addLog(`Active session: "${sess.title}" (${sess.id})`);
      const matched = sessions.find((s) => s.id === sess.id);
      if (matched && matched.directory && matched.directory !== currentDirectory) {
        currentDirectory = matched.directory;
        await autoResolveRepoForActiveContext();
      }
    }
  });
  ```
  - Only looks up `sess.id` in `sessions` array. If `sess` belongs to a different project/worktree, `matched` is undefined because `sessions` is scoped to the watched project.
  - Does NOT check directory on `sess` itself (`sess.directory` or `sess.location?.directory` per OpenCode V2 protocol).
  - Does NOT inspect session items (`sess.items`) or worktree on `sess`.
- `panel/main.ts:760-775` (`autoResolveRepoForActiveContext`):
  ```ts
  if (sess.items) {
    for (const it of sess.items) {
      if (it.url && it.url.includes('github.com/')) {
        const m = it.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (m) {
          setRepository(`${m[1]}/${m[2]}`, `session-item: ${sess.title}`);
          return;
        }
      }
    }
  }
  ```
  - In OpenChamber V2, the host strips top-level `url` on guest session items (`v2-compat-audit.md` Section B.1). `it.url` is undefined in V2 guest runtime.
  - Does NOT check `getSessionIssueRepo(it)` or `it.data?.repo`.
- `panel/main.ts:881-884` (Repo popover item click):
  - Overwrites `currentProject.linkedRepo` with the newly chosen repo, corrupting the prior project's repository linkage.
- `panel/main.ts:814` (`setRepository`):
  - Does not distinguish manual user override from automated session-context discovery.
- `panel/main.ts:2319` (`renderEmptyState`):
  - Emits generic text `<div class="empty-box">${escapeHtml(message)}</div>` without distinguishing empty repositories (0 issues), inaccessible repositories (404/403/auth), and failed repositories (network/500).

### Root Cause
1. Session directory resolution ignores V2 `location.directory` and fails when switching to sessions across projects.
2. Session-item repo discovery only checked `it.url`, which V2 strips.
3. Manual repo selection in the popover mutates current project storage.
4. Error rendering does not visually differentiate empty, inaccessible, and failed repositories.

### Minimal Remedy
1. In `host.onSession`, inspect `sess.directory || sess.location?.directory`, check `sess.items` using `getSessionIssueRepo(it) || it.data?.repo`, and trigger `autoResolveRepoForActiveContext()` when session changes.
2. In `autoResolveRepoForActiveContext`, use `getSessionIssueRepo(it)` and `it.data?.repo` alongside `it.url`.
3. In `renderEmptyState`, support visually distinct states (`empty`, `inaccessible`, `failed`) with dedicated CSS classes, icons, and corrective actions.
4. Keep explicit repository switching easy, preserve cache isolation per repo, and default to the current session's repository when no manual override is active.
5. Report manual-override lifetime policy as an unresolved open question.

---

## 5. Refresh Trigger Ground Truth

### Anchors
- `panel/main.ts:542-550`:
  ```ts
  const becameIdle = sessions.some((s) => {
    const prev = prevSessions.find((p) => p.id === s.id);
    return s.activity === 'idle' && (!prev || prev.activity !== 'idle');
  });
  if (becameIdle) {
    void handleIdleRefresh(sessions, prevSessions);
  }
  ```
  The idle refresh trigger is purely event-driven via OpenChamber's `host.onSessions` snapshot callback when a session transitions to `idle`.
- `panel/main.ts:1705-1742` (`handleIdleRefresh`):
  Executes incremental synchronization (`since=` timestamp watermark) for repos in scope.
- `panel/main.ts:6392-6406` (`btnRefresh` click):
  Manual user click triggers full cache invalidation and refetch.
- **Verification:**
  There is NO timer polling, interval loop, or minute-based background auto-refresh in the codebase. Decision D11 is confirmed: no periodic polling exists and none will be added.
