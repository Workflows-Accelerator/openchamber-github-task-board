# Task 204b Output: Hostile Findings Remediation
## Status: completed
## Evidence:
- Typecheck: PASS
- Bundle build: PASS
- Full test suite: 414 / 414 passed
- Commit SHA on feat/stage2a-attention-views: f28f575cfef6b46bf84c97cc30046e9b8908aa0a

### Summary of Remediations
1. **ADV-01 (Line Drift Race in Drawer AC):** In `panel/main.ts:renderDrawerAcceptanceCriteria`, `onToggle` now re-locates the target item within fresh `parseAcceptanceCriteria(issue.body)` by text matching (`it.text.trim() === item.text.trim()`) after `await reloadIssueBeforeMutation(issue)`, falling back safely to `item.lineIndex`.
2. **ADV-02 (Stale v2Metadata Cache):** In `updateIssueBody`, `reloadIssueBeforeMutation`, and `updateIssueStatus`, `issue.v2Metadata` is explicitly invalidated (`delete (issue as any).v2Metadata`) and refreshed via `resolveV2Metadata(issue, session)`, ensuring card badges immediately reflect answered questions and phase/status changes.
3. **ADV-03 (Null/Undefined Guard):** `renderDrawerAcceptanceCriteria` now starts with an entry guard that safely hides `#drawerAcceptanceCriteriaSection` and returns early when `issue` is null or undefined without throwing TypeError.
4. **ADV-05 (Accessibility Labels):** Each checkbox input rendered in `renderDrawerAcceptanceCriteria` receives an explicit `aria-label` set to `item.text`.
5. **ADV-06 (Repo Badge Ellipsis Truncation):** `.attention-repo-badge` in `panel/index.html` has `max-width: 90px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;` and a `title` attribute set to `repoName` to prevent layout squeeze in 360px viewport / sidebar mode.
