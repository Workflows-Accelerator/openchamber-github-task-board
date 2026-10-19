<env_preflight>
Worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-github
Branch: docs/task-centred-github-research
State: Duplicate dispatch detected. Session ses_b56f866fa48707aa35b84356 is the authorized reviewer and owns github-hostile.md. This instruction applies ONLY to duplicate session ses_faa2494e941ea798902a7432.
Files: no writes authorized.
Test command: none.
Do not touch: all report/source files and git index. Do not commit, revert or discard any files.
</env_preflight>
<goal>Stop the accidental duplicate review without changing or deleting anything.</goal>
<scope>No more research, network calls, file writes, git mutations or commits. Leave authorized reviewer's state untouched.</scope>
<criteria>Return immediately, stating duplicate stopped and listing any paths you had already changed, if any. Do not clean up any preexisting work.</criteria>
<output>At most three lines, then terminate. No report file needed.</output>
