# decision-in-task S1 + S2 — implementation report

Status: in progress (this file is written before coding, per work_method step 1).

HEAD_BEFORE: 1bca92a5b342ac35165caa8ac011cf21a9cab238
Branch: feat/wave1-status-section (worktree `workflows-accelerator-agent-dev-wave1-status-section`)
Spec: `.agents/run/chamberos-board-v2/specs/decision-in-task.md` (S1 §10, S2 §10)
Manager decisions applied: `media-src data: blob:` (S3, recorded), no persistence (in-memory store,
restart shows a named recheck state), `permission-asked` out of scope.

## Plan

1. `service/session-event.ts` — keep top-level `content` exactly as the SDK reader does (§0.3.4);
   parity test gains content fixtures. This lands first because the manifest change is a silent
   no-op without it.
2. `service/decision-form.ts` — pure form model: clamp, `when` visibility, server-side answer
   validation. Shared by the service and the panel so the two validations cannot drift.
3. `service/decision-store.ts` — in-memory decision store, `question-asked` creation, close on
   `turn-finished`/`turn-failed`/`session-archived`/`session-deleted`, `sessions.status`
   observation, ordering/tie-break, `GET /decisions` projection with the 64 KB cap, and the
   `POST /decision/answer` state machine (`answering` before the host call, at-most-once, error
   mapping).
4. `service/main.ts` + `host-client.ts` — routes, `answerForm`/`send` host calls, marks poll
   notifies the store of `sessions.status`.
5. `panel/decisions.ts` — copy table (EN/FR), sanitisation, form renderer (read-only in S1,
   interactive in S2), page title state, provenance, badges, inbox grouping.
6. `panel/main.ts` + `index.html` — drawer block slot, card badge, Pending items inbox; delete the
   synthesised `session-waiting` human todo and its prose path.
7. Manifest: `sessionEvents.content: true`, `sessionControl.answers: true`, version 1.3.0.
8. Tests first per behaviour, then mutation checks on the guards that matter (double answer,
   foreign session, stale form, refused capability, label-vs-value, innerHTML).
