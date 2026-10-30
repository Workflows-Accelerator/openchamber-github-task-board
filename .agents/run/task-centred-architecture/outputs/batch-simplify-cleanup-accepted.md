# Cleanup accepted; extension activation awaiting alignment

Date: 2026-10-30
Independent reviewer: ses_1e3a1b28427c06a6640dfac6, actual 9router/engineer.
Verdicts: Spec PASS / Quality APPROVED.
Evidence: outputs/batch-simplify-cleanup-hostile.md (manager read93 lines), root archive preserved-batch-simplify/**; archive checkpoint590f0d2 and hostile receipt ed23878. Retained staging feature branch76fd5e1.

Accepted: 300/300 archive manifest checks;107/107 unique staging files byte-identical to retained archive;7 evidence-only commits' files beyond published master accounted for. Three source worktrees and staging removed normally, no force; local branches retained, scoped DB deregistration verified. Root+25 unrelated worktrees remain. Preview already inactive; production unaffected. No loss demonstrated in retained evidence. Original cleanup removed untracked evidence only after copying; independent parity now establishes preservation, but that brief deviation is not a precedent for destructive cleanup.

Activation evidence (host-specific source, not VSCode): OpenChamber serves panel files from disk via GET /api/guests/:id/{*filePath}; refreshing/reopening panel reloads UI. Node service lifecycle supports extension enablement toggle PUT /api/guests/:id/enabled (off then on). No main host restart required; Developer: Reload Window is NOT an OpenChamber action. Exact extension identity/access must be discovered through supported nonsecret host metadata by activation worker, never guessed. Do not access /workspace/.openchamber-data/** or credentials.

Real fork: root is on feat/v2-binding-and-ratelimit, divergent from master. Switching root to master preserves old branch/evidence but changes the live extension code and removes old-branch run-state files from the working view. No fast-forward, forced overwrite, unrelated merge, rebase or reset. Preserve manager state before switch, and ensure no root source writer is active; 25 other worktrees do not alone establish running sessions. Activation worker must stop if collision/active-root evidence or unknown supported lifecycle appears.

State: WEB independently live/published at ab7516c, EXTENSION NOT ACTIVE/NOT VERIFIED. Need one bundled human decision for root switch+extension-only reload, and optional #49 narrow visual correction (prepare/review only, not production deploy). #47/#48 human-directed closure receipts unchanged; unfinished runtime activation is explicitly disclosed on #48, not hidden by Done label. No active worker now; do not spawn or mutate root before alignment.
