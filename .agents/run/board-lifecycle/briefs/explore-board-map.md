<goal>Produce a grounded architecture map of the github-task-board extension that lets a manager design (a) a machine-extractable "human to-do" list for issues in the needs-human step, (b) a simplified friendly-title-only list/intake view, and (c) a lifecycle skill that matches the code's real conventions — with exact file:line anchors for every claim.</goal>
<context_files>
/workspace/extensions/github-task-board/panel/core.ts
/workspace/extensions/github-task-board/panel/types.ts
/workspace/extensions/github-task-board/panel/labels.ts
/workspace/extensions/github-task-board/panel/main.ts
/workspace/extensions/github-task-board/panel/index.html
/workspace/extensions/github-task-board/panel/markdown.ts
/workspace/extensions/github-task-board/panel/utils.ts
/workspace/extensions/github-task-board/panel/git.ts
/workspace/extensions/github-task-board/panel/dropdown.ts
/workspace/extensions/github-task-board/test/
/workspace/extensions/github-task-board/package.json
/workspace/extensions/github-task-board/CONTRIBUTING.md
</context_files>
<skills>
/workspace/config/opencode/.agents/skills/plan/context/source-driven-development/SKILL.md
/workspace/config/opencode/.agents/skills/build/refactoring/code-simplification/SKILL.md
</skills>
<scope>You are READ-ONLY on application code. Your only writes are (1) the map document at .agents/run/board-lifecycle/explore/board-map.md inside this worktree and (2) a commit of that map file. Never edit panel/** or test/**.</scope>
<criteria>Every claim in the map carries a file:line anchor; the test suite is actually executed and its command + result recorded; the issue-body markdown contract is specified precisely enough that another agent can implement a parser or a prompt template from it alone; plug-in points for the two new views and the human-task extraction name real functions and real DOM ids.</criteria>
<steps>
<step>Run the test suite (node --test) and record the exact command, pass/fail counts, and any pre-existing failures. This is the baseline.</step>
<step>Map the build pipeline: how panel/main.js is produced from panel/main.ts (scripts in package.json, any bundler), how tests assert on main.ts vs main.js (see shipped-parity.test.js), and what a contributor must run before shipping.</step>
<step>Specify the ISSUE BODY CONTRACT as it is parsed today, section by section: Friendly Title (parseFriendlyTitle, core.ts:85), Overview/Description blocks, Open Questions (parseOpenQuestions, core.ts:136), subtasks (parseSubtasks, core.ts:175), test plans, related issues, and any other markdown conventions the code reads or writes (appendSubtaskToMarkdown, serializeDraftQuestions, answerOpenQuestionInMarkdown etc.). Include the exact regexes and the exact heading spellings the parsers accept.</step>
<step>Map the STATUS/LABEL MACHINE: the eight columns (types.ts:37), the status:* labels (labels.ts), resolveIssueColumn and every fallback that lands an issue in needs-human (labels.ts:347-480), how status is written back to GitHub, and what "in-review" vs "needs-human" mean operationally.</step>
<step>Map the AI ISSUE PROMPT TEMPLATES (DEFAULT_AI_ISSUE_PROMPT and siblings in main.ts/main.js) verbatim, since a lifecycle skill must stay consistent with what agents are told to write into issue bodies.</step>
<step>Map the VIEW/RENDER ARCHITECTURE: renderViews, renderListView, renderKanbanView, renderGraphView, renderArchiveView, renderIssueCard, renderDrawer and its sections (checklist, questions, test plans, dependencies, labels), the tab/status filter UI in index.html, view mode switching, filtering and search, and the all-projects aggregation. Note the DOM id conventions and how state flows from fetch to render.</step>
<step>Identify the exact plug-in points and 2-3 implementation options each, ranked: (A) extracting "tasks the human must do" from an issue (consider a new parsed section such as "### Human Tasks:", vs deriving from Open Questions + blocked reason, and where the data would live in core.ts), (B) a simplified list/intake view showing only friendly titles with normal filtering (new view mode vs a mode of renderListView), and (C) what shared parsing helpers both would reuse.</step>
<step>Note reliability/speed hazards you observe in the touched areas (rate limiting, cache, stale render, race conditions) with anchors — do not fix them.</step>
<step>Write the map to .agents/run/board-lifecycle/explore/board-map.md and commit it on this branch with a docs() commit.</step>
</steps>
<output>Return a structured block: status; results (the five most important facts a manager must know, each with file:line); evidence (test command + counts); learnings (top 3 risks or surprises). Keep the full detail in the map file, not in your reply.</output>
