# User-facing scenarios that the architecture draft must resolve

These are proposed acceptance scenarios derived from user intent, not implemented behaviors. Keep unknown ownership/API details explicit.

## 1. Add an idea without choosing a repository
Input: 'Let clients download their invoices.' User adds one quick task from anywhere. Preserve original words. The task is durably visible while routing/exploration happens. Confident routing may propose/select an allowed project according to an agreed policy. If multiple client projects plausibly fit, show a concise choice as human attention on the draft; do not leak the idea into a public or wrong-client repository. Other unrelated drafts continue. An existing matching issue should be surfaced rather than silently duplicated.

## 2. Start a project before it has a repository
Input: 'Create a website for a new client.' Capture works before repo/project provisioning. Explore examples/templates if relevant, gather constraints, ask material questions after useful preparation. Creation of a repo/domain/server/secrets is a separate privilege-gated action, not implied by capturing a todo. Decide intake home and stable links before choosing a transfer or parent strategy. Creating a repository cannot be a prerequisite for creating the task that requests it.

## 3. Optional uncertainty versus actual blocking
During exploration, a worker asks for the preferred accent color but can still investigate deployment constraints. Human attention may exist while useful authorized research continues. Once no meaningful authorized continuation remains at that task's scope, mark it blocked by the human. Keep phase 'exploration' (illustrative name), preserve pending question context/options, and do not label the entire portfolio blocked. In a separate case an execution task awaits a secret; retain execution phase, cease affected side effects, continue other permitted tasks.

## 4. Resume from task state rather than chat history
The human resolves routing/answers or grants a scoped approval. The next authorized step becomes eligible. A worker may finish, restart, be replaced or be on another device; the issue still explains desired output, decided constraints, files/references, evidence, pending items and next permitted action. Automatic 'advance to the next step' never hardcodes review nor treats any checkbox as unlimited permission to merge, deploy or close. Edit/revoke/partial approval and superseded questions need explicit treatment.

## 5. Concurrent delivery and review
A large parent task is divided into independently useful child outputs, with hierarchy separate from blockers. A child which edits the same files as another may not run concurrently just because it lives in a worktree. Independent codebase/reference/tool research can run in parallel if worthwhile. Child failure or human block does not halt unrelated siblings; parent readiness accurately reflects required child outcomes and separate review gates. Agent completion alone does not prove acceptance or imply human closure.

## 6. Scheduled work is visible and editable
Example: weekly infrastructure health report. A reusable definition identifies allowed actions, cadence/timezone or event trigger and expected output. Runs preserve timestamps, outcome/evidence and human blockers without resetting or overwriting overlapping run history. A missed trigger, duplicate webhook, paused task, edit during run and cost/permission limit have deterministic policies to choose. A schedule is not permission to deploy changes. A daily tiny report should not necessarily spam the board with a whole research swarm or issue hierarchy.

## 7. Close board, reboot server, reopen elsewhere
Eligible authorized tasks do not depend on the panel remaining open. A restart must not launch a duplicate worker, lose the link to an already-running attempt, or assume an idle session is human-blocked. Durable receipts identify attempts/outcomes; events reconcile safely with user edits and GitHub outages/rate limits. The design must name what remains locally operational even if issues are durable work truth.

## 8. Discover the right specialist without a giant initial catalog
Start with a small domain/router catalog. A DevOps router teaches local approach and points to a specialized client setup procedure. Evidence must establish whether the native skill tool can load the hidden specialist or whether a different explicitly supported loader is needed. Hiding an unauthorized skill is not a security control; least-privilege permissions remain enforced separately. Public issue bodies contain references/version IDs, never secrets or private machine config dumps.

## 9. Learn without making simple tasks expensive
A typo-sized fix should not cause mandatory web search, model-selection subagent, ten issues, or ceremony in every phase. A large ambiguous workflow should use code/past-work search, references/templates and hypothesis tests before human alignment. The draft must distinguish non-skippable approval/proof boundaries from optional phase depth. Research claims must link actual sources, not be presented as invented empirical evidence.

## 10. Existing tasks still work during migration
The current board has an eight-status issue contract, friendly-title parsing, Markdown tasks, needs-human labels, session attribution, body updates and five recent enhancements. Migration must handle reading old tasks without rewriting all live issues, define new vs legacy authoritative fields, avoid running both old and new controllers for the same task, and provide rollback/pause. Agent/skill instructions must not tell current workers to follow a future unavailable task tool.
