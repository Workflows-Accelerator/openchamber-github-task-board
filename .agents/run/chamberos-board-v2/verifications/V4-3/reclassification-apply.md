# V4-3 reclassification apply

Date: 2026-11-13. Branch `feat/board-v3`. Base commit `7fdf07c`; the reverse mapping was
opened at `226417c` before any GitHub write.

Owner authorisation (D40, verbatim scope): label operations only via `gh issue edit`; exactly
one comment per changed issue carrying the policy and the previous status; a reverse mapping;
nothing closed; no body rewritten; no comment deleted; no repository settings touched.

Source of the work list: `reclassification-dry-run.md` section 4 (67 rows), section 8 (five
resolved issues). Counts re-confirmed before starting: 67 changes, 45
`status:needs-human -> status:todo`, 22 `status:in-review -> status:todo`, distributed
22 / 17 / 14 / 10 / 2 / 2 across the six repositories. The file agreed; no stop condition.

## 1. Commands used

Every issue was handled with these reads and at most one write of each kind:

```
# rule 1: gate read, immediately before the edit
gh issue view <n> --repo <owner>/<repo> --json state,labels,updatedAt
# marker check, so no second audit comment is ever posted
gh issue view <n> --repo <owner>/<repo> --json comments
# rule 2: exactly one label-swap command, no --body, no --title, no --add-assignee
gh issue edit <n> --repo <owner>/<repo> --add-label status:todo --remove-label <old>
# rule 3: the audit comment, only after the label change returned success
gh issue comment <n> --repo <owner>/<repo> --body '<marker + policy + previous status>'
# post-apply verification, read-only
gh issue view <n> --repo <owner>/<repo> --json state,labels,comments,updatedAt
# label inventory and open-issue counts, read-only
gh label list --repo <owner>/<repo> --limit 200 --json name
gh issue list --repo <owner>/<repo> --state open --limit 400 --json number
```

The 67 label swaps actually executed, grouped by repository and ascending issue number:

```
gh issue edit 14 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:needs-human
gh issue edit 21 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:needs-human
gh issue edit 22 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:needs-human
gh issue edit 23 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:needs-human
gh issue edit 24 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:needs-human
gh issue edit 28 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:needs-human
gh issue edit 30 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:needs-human
gh issue edit 31 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:needs-human
gh issue edit 33 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:needs-human
gh issue edit 34 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:needs-human
gh issue edit 35 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:needs-human
gh issue edit 36 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:needs-human
gh issue edit 37 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:in-review
gh issue edit 38 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:needs-human
gh issue edit 44 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:needs-human
gh issue edit 53 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:needs-human
gh issue edit 54 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:needs-human
gh issue edit 56 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:in-review
gh issue edit 57 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:in-review
gh issue edit 58 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:in-review
gh issue edit 59 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:in-review
gh issue edit 60 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:in-review
gh issue edit 29 --repo Workflows-Accelerator/openchamber-config --add-label status:todo --remove-label status:in-review
gh issue edit 30 --repo Workflows-Accelerator/openchamber-config --add-label status:todo --remove-label status:in-review
gh issue edit 38 --repo Workflows-Accelerator/openchamber-config --add-label status:todo --remove-label status:in-review
gh issue edit 39 --repo Workflows-Accelerator/openchamber-config --add-label status:todo --remove-label status:needs-human
gh issue edit 41 --repo Workflows-Accelerator/openchamber-config --add-label status:todo --remove-label status:in-review
gh issue edit 42 --repo Workflows-Accelerator/openchamber-config --add-label status:todo --remove-label status:needs-human
gh issue edit 46 --repo Workflows-Accelerator/openchamber-config --add-label status:todo --remove-label status:needs-human
gh issue edit 47 --repo Workflows-Accelerator/openchamber-config --add-label status:todo --remove-label status:needs-human
gh issue edit 48 --repo Workflows-Accelerator/openchamber-config --add-label status:todo --remove-label status:needs-human
gh issue edit 49 --repo Workflows-Accelerator/openchamber-config --add-label status:todo --remove-label status:needs-human
gh issue edit 50 --repo Workflows-Accelerator/openchamber-config --add-label status:todo --remove-label status:needs-human
gh issue edit 58 --repo Workflows-Accelerator/openchamber-config --add-label status:todo --remove-label status:needs-human
gh issue edit 60 --repo Workflows-Accelerator/openchamber-config --add-label status:todo --remove-label status:needs-human
gh issue edit 61 --repo Workflows-Accelerator/openchamber-config --add-label status:todo --remove-label status:needs-human
gh issue edit 62 --repo Workflows-Accelerator/openchamber-config --add-label status:todo --remove-label status:needs-human
gh issue edit 63 --repo Workflows-Accelerator/openchamber-config --add-label status:todo --remove-label status:needs-human
gh issue edit 72 --repo Workflows-Accelerator/openchamber-config --add-label status:todo --remove-label status:needs-human
gh issue edit 1 --repo Workflows-Accelerator/devops-cockpit --add-label status:todo --remove-label status:needs-human
gh issue edit 2 --repo Workflows-Accelerator/devops-cockpit --add-label status:todo --remove-label status:in-review
gh issue edit 3 --repo Workflows-Accelerator/devops-cockpit --add-label status:todo --remove-label status:in-review
gh issue edit 4 --repo Workflows-Accelerator/devops-cockpit --add-label status:todo --remove-label status:needs-human
gh issue edit 6 --repo Workflows-Accelerator/devops-cockpit --add-label status:todo --remove-label status:in-review
gh issue edit 7 --repo Workflows-Accelerator/devops-cockpit --add-label status:todo --remove-label status:in-review
gh issue edit 8 --repo Workflows-Accelerator/devops-cockpit --add-label status:todo --remove-label status:in-review
gh issue edit 9 --repo Workflows-Accelerator/devops-cockpit --add-label status:todo --remove-label status:in-review
gh issue edit 10 --repo Workflows-Accelerator/devops-cockpit --add-label status:todo --remove-label status:in-review
gh issue edit 11 --repo Workflows-Accelerator/devops-cockpit --add-label status:todo --remove-label status:in-review
gh issue edit 12 --repo Workflows-Accelerator/devops-cockpit --add-label status:todo --remove-label status:in-review
gh issue edit 21 --repo Workflows-Accelerator/devops-cockpit --add-label status:todo --remove-label status:in-review
gh issue edit 23 --repo Workflows-Accelerator/devops-cockpit --add-label status:todo --remove-label status:needs-human
gh issue edit 24 --repo Workflows-Accelerator/devops-cockpit --add-label status:todo --remove-label status:needs-human
gh issue edit 1 --repo Workflows-Accelerator/ironcore-frontline --add-label status:todo --remove-label status:needs-human
gh issue edit 8 --repo Workflows-Accelerator/ironcore-frontline --add-label status:todo --remove-label status:needs-human
gh issue edit 9 --repo Workflows-Accelerator/ironcore-frontline --add-label status:todo --remove-label status:needs-human
gh issue edit 14 --repo Workflows-Accelerator/ironcore-frontline --add-label status:todo --remove-label status:needs-human
gh issue edit 22 --repo Workflows-Accelerator/ironcore-frontline --add-label status:todo --remove-label status:needs-human
gh issue edit 23 --repo Workflows-Accelerator/ironcore-frontline --add-label status:todo --remove-label status:needs-human
gh issue edit 25 --repo Workflows-Accelerator/ironcore-frontline --add-label status:todo --remove-label status:needs-human
gh issue edit 28 --repo Workflows-Accelerator/ironcore-frontline --add-label status:todo --remove-label status:needs-human
gh issue edit 30 --repo Workflows-Accelerator/ironcore-frontline --add-label status:todo --remove-label status:needs-human
gh issue edit 31 --repo Workflows-Accelerator/ironcore-frontline --add-label status:todo --remove-label status:needs-human
gh issue edit 5 --repo Workflows-Accelerator/chambervoice --add-label status:todo --remove-label status:needs-human
gh issue edit 6 --repo Workflows-Accelerator/chambervoice --add-label status:todo --remove-label status:needs-human
gh issue edit 36 --repo Workflows-Accelerator/case-management-platform --add-label status:todo --remove-label status:in-review
gh issue edit 101 --repo Workflows-Accelerator/case-management-platform --add-label status:todo --remove-label status:in-review
```

The comment body, identical for every issue except the previous label:

```
<!-- board-reclassification:2026-11-13 -->
**Reclassified by the board policy.** This task was marked `<old>` without a clickable human artifact (a screenshot, a video, a link, or a question with preset answers). It is now `status:todo`, so it no longer claims to wait for you.
Previous status: `<old>`. Reverse: re-add `<old>` — the board will then show that the artifact is missing. Nothing else was changed.
```

## 2. Per-repository result

| Repository | In list | Applied | Already applied | Skipped | Refused | Verified |
|---|---|---|---|---|---|---|
| Workflows-Accelerator/openchamber-github-task-board | 22 | 22 | 0 | 0 | 0 | 22/22 |
| Workflows-Accelerator/openchamber-config | 17 | 17 | 0 | 0 | 0 | 17/17 |
| Workflows-Accelerator/devops-cockpit | 14 | 14 | 0 | 0 | 0 | 14/14 |
| Workflows-Accelerator/ironcore-frontline | 10 | 10 | 0 | 0 | 0 | 10/10 |
| Workflows-Accelerator/chambervoice | 2 | 2 | 0 | 0 | 0 | 2/2 |
| Workflows-Accelerator/case-management-platform | 2 | 2 | 0 | 0 | 0 | 2/2 |
| **total** | **67** | **67** | **0** | **0** | **0** | **67/67** |

## 3. Every non-success, quoted verbatim

Two events occurred. Both were resolved; neither left an issue in a wrong state.

### 3.1 Issue 28, openchamber-github-task-board: label changed, comment failed, retried

The label swap succeeded and the comment POST failed on transport, not on policy. Verbatim:

```
Post "https://api.github.com/graphql": net/http: TLS handshake timeout
```

Recorded at the time as `comment-failed-after-label-change`. The issue was left with
`status:todo` and no audit comment. It was re-read, confirmed `OPEN` with only
`status:todo`, no marker, then the one missing comment was posted:

```
gh issue comment 28 --repo Workflows-Accelerator/openchamber-github-task-board --body '<policy body>'
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/28#issuecomment-6855963402
```

Result: one marker comment, comment id 6855963402. No second comment was posted anywhere.

### 3.2 Issues 23 and 44, openchamber-github-task-board: labels reverted by a concurrent writer

Both were applied and verified, then a concurrent writer re-added `status:needs-human` and
removed `status:todo` at 14:37:27Z (#44) and 14:37:28Z (#23), roughly five minutes after the
apply. The audit comment survived in both cases; only the label moved back.

Re-read immediately before re-editing: `state=OPEN`, labels exactly `['status:needs-human']`,
marker count 1 in each. That satisfies the rule-1 gate, so the label swap was repeated once,
with no comment, because the marker was already present:

```
gh issue edit 23 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:needs-human
gh issue edit 44 --repo Workflows-Accelerator/openchamber-github-task-board --add-label status:todo --remove-label status:needs-human
```

Both held through the final verification and a 45-second re-check. The revert's author is not
readable without `gh api`, which is outside the authorised command set, so the actor is
unknown. No third attempt was made.

No issue was closed, no issue refused the label edit, and no comment was rejected.

## 4. Final verification table

Re-read of every one of the 67 issues after all writes. `old absent` means the previous
status label is gone; `markers` is the count of `board-reclassification:2026-11-13` comments.

| Repository | Issue | Previous | State | status:todo | Old absent | Markers | Result |
|---|---|---|---|---|---|---|---|
| openchamber-github-task-board | 14 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 21 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 22 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 23 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 24 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 28 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 30 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 31 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 33 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 34 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 35 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 36 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 37 | `status:in-review` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 38 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 44 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 53 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 54 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 56 | `status:in-review` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 57 | `status:in-review` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 58 | `status:in-review` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 59 | `status:in-review` | OPEN | True | True | 1 | PASS |
| openchamber-github-task-board | 60 | `status:in-review` | OPEN | True | True | 1 | PASS |
| openchamber-config | 29 | `status:in-review` | OPEN | True | True | 1 | PASS |
| openchamber-config | 30 | `status:in-review` | OPEN | True | True | 1 | PASS |
| openchamber-config | 38 | `status:in-review` | OPEN | True | True | 1 | PASS |
| openchamber-config | 39 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-config | 41 | `status:in-review` | OPEN | True | True | 1 | PASS |
| openchamber-config | 42 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-config | 46 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-config | 47 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-config | 48 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-config | 49 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-config | 50 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-config | 58 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-config | 60 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-config | 61 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-config | 62 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-config | 63 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| openchamber-config | 72 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| devops-cockpit | 1 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| devops-cockpit | 2 | `status:in-review` | OPEN | True | True | 1 | PASS |
| devops-cockpit | 3 | `status:in-review` | OPEN | True | True | 1 | PASS |
| devops-cockpit | 4 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| devops-cockpit | 6 | `status:in-review` | OPEN | True | True | 1 | PASS |
| devops-cockpit | 7 | `status:in-review` | OPEN | True | True | 1 | PASS |
| devops-cockpit | 8 | `status:in-review` | OPEN | True | True | 1 | PASS |
| devops-cockpit | 9 | `status:in-review` | OPEN | True | True | 1 | PASS |
| devops-cockpit | 10 | `status:in-review` | OPEN | True | True | 1 | PASS |
| devops-cockpit | 11 | `status:in-review` | OPEN | True | True | 1 | PASS |
| devops-cockpit | 12 | `status:in-review` | OPEN | True | True | 1 | PASS |
| devops-cockpit | 21 | `status:in-review` | OPEN | True | True | 1 | PASS |
| devops-cockpit | 23 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| devops-cockpit | 24 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| ironcore-frontline | 1 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| ironcore-frontline | 8 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| ironcore-frontline | 9 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| ironcore-frontline | 14 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| ironcore-frontline | 22 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| ironcore-frontline | 23 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| ironcore-frontline | 25 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| ironcore-frontline | 28 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| ironcore-frontline | 30 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| ironcore-frontline | 31 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| chambervoice | 5 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| chambervoice | 6 | `status:needs-human` | OPEN | True | True | 1 | PASS |
| case-management-platform | 36 | `status:in-review` | OPEN | True | True | 1 | PASS |
| case-management-platform | 101 | `status:in-review` | OPEN | True | True | 1 | PASS |

Repository-level checks after the apply:

| Repository | Open issues (dry run -> now) | status:* label set |
|---|---|---|
| openchamber-github-task-board | 48 -> 48 | unchanged, identical to dry-run section 5 |
| openchamber-config | 35 -> 35 | unchanged, identical to dry-run section 5 |
| devops-cockpit | 26 -> 26 | unchanged, identical to dry-run section 5 |
| ironcore-frontline | 35 -> 35 | unchanged, identical to dry-run section 5 |
| chambervoice | 9 -> 9 | unchanged, identical to dry-run section 5 |
| case-management-platform | 62 -> 62 | unchanged, identical to dry-run section 5 |

Open-issue counts are unchanged in all six repositories, so nothing was closed. The `status:*`
label set in each repository matches dry-run section 5 exactly, so no label was created,
renamed or deleted. The only issues still carrying `status:needs-human` or `status:in-review`
in these repositories are the ones the dry run classified `stays` or `agent review in flight`:
case-management-platform 297, 298, 299, 300, 301 (review in flight). No issue outside the 67
was written to.

## 5. Reverse instruction

To undo any single row: `gh issue edit <n> --repo <repo> --add-label '<previous label>' --remove-label status:todo`

The per-issue reverse mapping, with the previous label and the audit comment id for every
issue, is `reclassification-reverse.md`.

## 6. What could not be verified

- **Bodies were not diffed.** `gh` offers no body diff, and the dry run did not record body
  hashes or `updatedAt` values. The claim rests on the command construction: every label
  write was `gh issue edit <n> --add-label --remove-label` with no `--body` and no `--title`,
  and the harness never invoked `gh issue edit` with those flags. A body change by a
  concurrent writer during this window would be indistinguishable.
- **Comment authorship of the revert on #23 and #44.** Label events expose no actor through
  the authorised commands; `gh api` was not used.
- **No issue was edited outside this list by this session**, but concurrent writers were
  demonstrably active (section 3.2), so a write by another actor elsewhere cannot be excluded.
- **Comment count is exact per issue**, but GitHub's total comment count for the six
  repositories is not compared against a pre-apply snapshot; only the marker count is.

Totals: 67 label swaps, 67 audit comments, 0 duplicate comments, 0 issues closed,
0 labels created, 0 bodies or titles written.

