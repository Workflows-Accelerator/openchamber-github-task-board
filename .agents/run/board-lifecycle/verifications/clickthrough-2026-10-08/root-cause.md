# Root Cause Analysis: Live Preview Friendly Titles & Queue Population Failures

**Date:** 2026-10-08  
**Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-clickthrough-titles-queues-picker`  
**Branch:** `fix/clickthrough-titles-queues-picker`  
**Target Repository:** `Workflows-Accelerator/openchamber-github-task-board`  
**Investigator:** dynamic-agent  

---

## 1. Executive Summary

During human click-through preview of the OpenChamber Task Board, three critical defects were observed:
1. **Placeholder Titles:** Every card across simplified views rendered `(No friendly title)` as its primary title, despite all 12 open issues in the live repository containing valid Friendly Titles.
2. **Empty Queues:** The Human Tasks and Questions views showed empty states ("Nothing is waiting on you" and "No open questions"), even though issues #23 and #24 carry explicit `### Human Tasks:` and `### Open Questions:` sections.
3. **Ambiguous Picker State:** The repository picker showed a cache/rate-limited status without indicating which repository the active session was linked to, leaving the user with no clear context.

**Root Cause Proved:**  
The failures were caused by a two-stage data-path trap:
- OpenChamber guest storage (`/workspace/.openchamber-data/guest-storage/github-task-board.json`) contained 5 stale cached issues (#1 to #5) created before friendly titles and human tasks existed.
- Upon launch, `panel/main.ts:1347-1358` rendered these 5 cached issues instantly. Subsequent live network requests failed due to unauthenticated rate-limiting / CSP restrictions, triggering the cache fallback at `panel/main.ts:1436-1439`.
- Because none of issues #1-#5 contained `### Friendly Title:` headings, `resolveSimplifiedViewTitle` at `panel/core.ts:145-161` returned the hardcoded fallback placeholder string `'(No friendly title)'` for every issue.
- Concurrently, because issues #1-#5 contained no `### Human Tasks:` checklists and were not in `status:needs-human`, both simplified queues rendered 0 items.
- On top of this cache trapping, the implementation of `resolveSimplifiedViewTitle` at `panel/core.ts:157` violated user decision **D14**, which explicitly rejected the `'(No friendly title)'` placeholder in favor of falling back directly to `issue.title`.

---

## 2. Live GitHub Issue Verification (Read-Only)

Live inspection via `gh issue view` confirmed that issues #23 and #24 on `Workflows-Accelerator/openchamber-github-task-board` contain valid, well-formed headers:

### Issue #23 (`feat(board): Human Tasks, All Tasks, and Questions views`)
- **Title:** `feat(board): Human Tasks, All Tasks, and Questions views`
- **Body Heading:**
  ```markdown
  ### Friendly Title:
  Add Simplified Task Views
  ```
- **Human Tasks Section:**
  ```markdown
  ### Human Tasks:
  - [ ] Open Human Tasks in OpenChamber, select the task linked to issue 23 "Add Simplified Task Views"...
  - [ ] After the view repair is available in the running preview, compare List with All Tasks...
  - [ ] Open Questions and confirm the unanswered list below appears under "Add Simplified Task Views"...
  ```
- **Open Questions Section:**
  ```markdown
  ### Open Questions:
  - [ ] When you manually select a repository and then switch to a session in another repository...
  ```

### Issue #24 (`fix(board): load the current session repository and make switching reliable`)
- **Title:** `fix(board): load the current session repository and make switching reliable`
- **Body Heading:**
  ```markdown
  ### Friendly Title:
  Find and Switch Repositories
  ```
- **Human Tasks Section:** 1 checkbox item.
- **Open Questions Section:** 1 checkbox item.

---

## 3. Production Code Execution Proof

When the exact live bodies of #23 and #24 are passed through compiled `panel/core.ts` methods:

```ts
// Evaluated with node --input-type=module
import { parseFriendlyTitle, resolveSimplifiedViewTitle, parseHumanTasks, parseOpenQuestions, collectHumanTodos } from './panel/core.ts';

// Issue #23
resolveSimplifiedViewTitle(issue23);
// => { displayTitle: 'Add Simplified Task Views', displaySubtitle: 'feat(board): Human Tasks, All Tasks, and Questions views', isPlaceholder: false }
parseHumanTasks(issue23.body).length; // => 3
parseOpenQuestions(issue23.body).length; // => 1
collectHumanTodos(issue23).length; // => 3

// Issue #24
resolveSimplifiedViewTitle(issue24);
// => { displayTitle: 'Find and Switch Repositories', displaySubtitle: 'fix(board): load the current session repository and make switching reliable', isPlaceholder: false }
parseHumanTasks(issue24.body).length; // => 1
parseOpenQuestions(issue24.body).length; // => 1
collectHumanTodos(issue24).length; // => 1
```

**Conclusion:** The markdown parsing logic in `panel/core.ts` correctly extracts the Friendly Title, Human Tasks, and Open Questions from live issues #23 and #24. The parser itself was not failing on well-formed live bodies.

---

## 4. Tracing the Live Data-Path Failure

### Anchor 1: Stale Storage Cache Injection (`panel/main.ts:1347-1358`)
```ts
if (!force && issues.length === 0 && host?.storage) {
  try {
    const stored = (await host.storage.get(storageKey)) as any;
    if (stored && Array.isArray(stored.issues) && stored.issues.length > 0) {
      issues = stored.issues; // Injected 5 stale issues (#5, #4, #3, #2, #1)
      ...
      renderViews();
    }
  } catch {}
}
```
Inspection of `/workspace/.openchamber-data/guest-storage/github-task-board.json` revealed:
- Key: `cached_issues_Workflows-Accelerator/openchamber-github-task-board`
- Contained issues: `[5, 4, 3, 2, 1]`
- All 5 issues lacked `### Friendly Title:`, `### Human Tasks:`, and `status:needs-human`.

### Anchor 2: Remote Fetch Error & Cache Fallback Lock (`panel/main.ts:1433-1439`)
```ts
} catch (err: any) {
  addLog(`Failed to fetch fresh issues: ${err.message}`, 'error');
  if (issues.length > 0) {
    // Never break: keep showing cached issues!
    if (host?.toast) {
      void host.toast({ kind: 'info', message: `Offline / Rate-limited. Showing ${issues.length} cached issues.` });
    }
  }
}
```
When fresh network fetching threw (due to lack of authenticated PAT or 60 req/hr unauthenticated rate limit on `host.request`), execution jumped to the `catch` block. Because `issues.length` was 5, the 5 stale issues were retained indefinitely.

### Anchor 3: Hardcoded Placeholder In Core (`panel/core.ts:145-161`)
```ts
export function resolveSimplifiedViewTitle(
  issue: { number: number; title?: string | null; body?: string | null }
): { displayTitle: string; displaySubtitle: string | null; isPlaceholder: boolean } {
  const titles = parseFriendlyTitle(issue.body, '__DEFAULT_TITLE_SENTINEL__');
  if (titles.subtitle === '__DEFAULT_TITLE_SENTINEL__' && titles.title.trim()) {
    return {
      displayTitle: titles.title.trim(),
      displaySubtitle: issue.title?.trim() || null,
      isPlaceholder: false,
    };
  }
  return {
    displayTitle: '(No friendly title)',
    displaySubtitle: issue.title?.trim() || `Issue #${issue.number}`,
    isPlaceholder: true,
  };
}
```
Because issues #1-#5 did not have friendly titles, `resolveSimplifiedViewTitle` emitted `'(No friendly title)'` as `displayTitle`.

### Anchor 4: UI Renderers Calling Placeholder (`panel/main.ts:3153, 3393, 3495`)
In `buildHumanCard`, `renderAllTasksView`, and `renderQuestionsView`:
```ts
const { displayTitle, displaySubtitle, isPlaceholder } = resolveSimplifiedViewTitle(issue);
```
Every card rendered `(No friendly title)` in italic muted text.

---

## 5. Required Remedies

1. **Implement D14 (Eliminate `(No friendly title)`):**
   - Update `resolveSimplifiedViewTitle` in `panel/core.ts`: when no Friendly Title heading exists in the issue body, return `displayTitle = issue.title?.trim() || 'Issue #' + issue.number`, `displaySubtitle = null`, and `isPlaceholder = false`. Never duplicate the title as subtitle.
   - Remove all references to `(No friendly title)` across production code and test assertions.

2. **Implement D15 (Repo Picker Inline Session Repo & Distinguish Picked Repo):**
   - Always display the current session's linked repository inline in the popover (e.g. `Session repo: Workflows-Accelerator/openchamber-github-task-board`).
   - Visibly distinguish the actively picked repository (`[active]` / `[picked]` with clear active style).
   - Display honest, actionable rate-limit and offline cache states with guidance on entering a Personal Access Token.

3. **Implement D16 (All Projects Grouping & Full URL Cross-Repo Links):**
   - In All Projects mode, group both Human Tasks and Questions by repository.
   - Render cross-repo issue references as full URLs (`https://github.com/owner/repo/issues/N`), leaving same-repo items as self-contained prose.
