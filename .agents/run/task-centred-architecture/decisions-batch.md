# Plain-language decision batch (send after the draft issue is published)

Each item maps to the issue's Q1-Q5. Ask once, before any implementation. No option is preselected by the draft.

1. **Where new ideas land before they belong to a project.**
   Options: a private intake repository; draft items in the GitHub Project; or a local-only file on this machine.
   Trade-off: private repo is visible across devices and team members but is still remote; Project drafts are native but cannot hold comments or sub-tasks until converted; local is private but single-device.

2. **How much an agent may do without asking you.**
   Options: exploration only (no file edits without approval); autonomous edits and tests in isolated worktrees, with hard stops before merge, deploy, secrets, repo creation or closing a task; or per-project allowlists including auto-merge of trivial documentation fixes.
   Trade-off: speed versus unreviewed outward effects.

3. **Where the always-on coordinator lives.**
   Options: an OpenChamber host extension service; the OpenCode plugin process; the task board panel itself; or a small hosted relay.
   Trade-off: panel is simplest but dies when you close it; host service survives but is new infrastructure; plugin survives with the engine; relay survives anything but needs hosting and credentials.

4. **Whether small tasks may skip phases.**
   Options: adaptive fast path (a typo fix goes straight to execution and review, while review and your sign-off stay mandatory); full ceremony on every task; or one phase at a time advanced by you.
   Trade-off: latency versus consistency.

5. **How recurring tasks and their history are represented, and what happens when runs overlap.**
   Options for representation: a reusable definition issue with separate run records, or one issue with an appended run ledger.
   Options for overlap: skip the new run, queue it, or allow parallel runs.
   Trade-off: audit clarity versus issue volume; GitHub Projects has a hard 50,000-item cap that archiving does not relieve.

## Notes for the user
- The draft recommends: private intake repo, scoped autonomy with hard outward gates, host extension service, adaptive fast path, definition-plus-run-records with bounded retention. Recommendations only.
- Technical unknowns are deliberately NOT in this list; they are proof tasks in the issue.
