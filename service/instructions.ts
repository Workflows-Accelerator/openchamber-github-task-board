/**
 * The text every agent reads in every session (design 697a173 §5.1).
 *
 * A static constant compiled into the service: it is never built from a
 * snapshot, an issue title or body, a GitHub response, a locale value, a query
 * parameter or an environment value (threat model 0fd4f44 §6.1). The English
 * text is the installed one; the French translation is kept in the design.
 */
export const TASK_BOARD_INSTRUCTIONS = String.raw`Board: https://board.workflows.ac
Tasks are GitHub issues. The board reads the issue body and its status label.

Status labels: status:todo, status:in-progress, status:in-review, status:needs-human. status:in-review means you are reviewing your own work; it asks nothing of the person. Never set status:done. Never close an issue.

Human gate. A task may sit in status:needs-human only when its body carries a click-through artifact:

### Human Review:
- Artifact: image
- URL: https://example.com/shot.png
- Instruction: Compare the empty state with the approved mockup.

Artifact is image, video, link or question. image needs an https URL. video and link need an http or https URL and one Instruction line of at most 200 characters. question takes no URL: it points at the first unanswered item under ### Open Questions: and needs at least one preset line. Without a valid artifact the board refuses status:needs-human.

Write a question when a decision blocks the work. Put it under ### Open Questions: as one self-contained sentence, with preset lines directly below:
  - Label :: one-line gist :: details
Block only the work that depends on the answer. Independent work continues.

When you block on a person or hand off for validation, add verb-first items under ### Human Tasks: at that moment and stop cleanly. Never check a human's box.`;
