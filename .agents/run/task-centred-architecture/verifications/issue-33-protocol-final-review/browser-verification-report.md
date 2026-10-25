# Browser verification — standalone board (synthetic fixtures)

- Engine: Obscura (CDP), no Chromium download
- Fixtures: fake GitHub server with synthetic issues
- Started: 2026-10-25T20:59:37.665Z
- Finished: 2026-10-25T20:59:41.011Z

| Check | Result | Detail |
| --- | --- | --- |
| login page hides data | PASS |  |
| pull requests are excluded from the board | PASS |  |
| board names the configured repository | PASS |  |
| session cookie is not readable from JavaScript | PASS |  |
| nothing is kept in local or session storage | PASS |  |
| page source carries no token | PASS |  |
| page source carries no password | PASS |  |
| desktop board: no horizontal overflow | PASS | scrollWidth=1280 clientWidth=1280 |
| detail shows phase metadata | PASS |  |
| detail shows attention metadata | PASS |  |
| detail shows an open question input | PASS |  |
| detail has no agent or session controls | PASS |  |
| detail shows warning that simultaneous edit can be overwritten | PASS |  |
| desktop task detail: no horizontal overflow | PASS | scrollWidth=1280 clientWidth=1280 |
| overview edit reached GitHub | PASS |  |
| other sections survived the edit | PASS |  |
| conflict is explained and offers a reload | PASS |  |
| conflict did not overwrite the remote change | PASS |  |
| inline answer was written to the issue | PASS |  |
| status label changed | PASS |  |
| non-status labels were preserved | PASS |  |
| browser transport failure on write classifies outcome as unknown and offers refresh (R1) | PASS |  |
| browser transport failure makes zero write retries (R1) | PASS |  |
| a failed refresh keeps the last board and says it is stale | PASS |  |
| the empty repository state is plainly explained | PASS |  |
| 360px board: no horizontal overflow | PASS | scrollWidth=360 clientWidth=360 |
| 360px task detail: no horizontal overflow | PASS | scrollWidth=360 clientWidth=360 |
| every control is a native element in the tab order | PASS | [{"tag":"A","id":"","tabIndex":0,"disabled":false},{"tag":"BUTTON","id":"refresh-btn","tabIndex":0,"disabled":false},{"tag":"BUTTON","id":"signout-btn","tabIndex":0,"disabled":false},{"tag":"INPUT","id":"password","tabIndex":0,"disabled":false},{"tag":"BUTTON","id":"login-btn","tabIndex":0,"disabled":false},{"tag":"BUTTON","id":"","tabIndex":0,"disabled":false},{"tag":"BUTTON","id":"","tabIndex":0,"disabled":false},{"tag":"BUTTON","id":"","tabIndex":0,"disabled":false},{"tag":"BUTTON","id":"back-btn","tabIndex":0,"disabled":false},{"tag":"BUTTON","id":"conflict-reload","tabIndex":0,"disabled":false},{"tag":"TEXTAREA","id":"overview-text","tabIndex":0,"disabled":false},{"tag":"BUTTON","id":"save-overview","tabIndex":0,"disabled":false},{"tag":"INPUT","id":"answer-0","tabIndex":0,"disabled":false},{"tag":"BUTTON","id":"","tabIndex":0,"disabled":false},{"tag":"SELECT","id":"status-select","tabIndex":0,"disabled":false},{"tag":"BUTTON","id":"apply-status","tabIndex":0,"disabled":false}] |
| focus can be moved to a real control | PASS | {"active":true,"outlineStyle":"none","outlineWidth":"0px","matchesFocusVisible":false} |
| the stylesheet defines a visible :focus-visible ring | PASS |  |
| signing out clears the board from the page | PASS |  |
| 360px sign-in: no horizontal overflow | PASS | scrollWidth=360 clientWidth=360 |

## Screenshots

- `verifications/issue-33-protocol-final-review/screenshots/login-desktop-2026-10-25T20-59-37-665Z.png`
- `verifications/issue-33-protocol-final-review/screenshots/board-desktop-2026-10-25T20-59-37-665Z.png`
- `verifications/issue-33-protocol-final-review/screenshots/task-detail-desktop-2026-10-25T20-59-37-665Z.png`
- `verifications/issue-33-protocol-final-review/screenshots/conflict-desktop-2026-10-25T20-59-37-665Z.png`
- `verifications/issue-33-protocol-final-review/screenshots/task-detail-after-edits-desktop-2026-10-25T20-59-37-665Z.png`
- `verifications/issue-33-protocol-final-review/screenshots/stale-board-desktop-2026-10-25T20-59-37-665Z.png`
- `verifications/issue-33-protocol-final-review/screenshots/empty-board-desktop-2026-10-25T20-59-37-665Z.png`
- `verifications/issue-33-protocol-final-review/screenshots/board-360-2026-10-25T20-59-37-665Z.png`
- `verifications/issue-33-protocol-final-review/screenshots/task-detail-360-2026-10-25T20-59-37-665Z.png`
- `verifications/issue-33-protocol-final-review/screenshots/signed-out-360-2026-10-25T20-59-37-665Z.png`
