# Foundation validation draft — NOT SENT / DO NOT TREAT AS APPROVAL

Gate: only send after independent hostile3 Spec PASS + Quality APPROVED. No request sent yet. Current bundle 59e5d05, preview :4041. No live switch/merge/push/closure/deletion authorised.

## Answer-first opening (French)
La fondation Canvas/List est prête pour votre essai [ONLY IF hostile3 passes]. Elle n'est pas encore publiée ; votre validation de chaque partie et votre autorisation de publication restent nécessaires.

## Access before verdict
Preview: http://127.0.0.1:4041 INSIDE CONTAINER, not necessarily user's local machine. Synthetic fixture password: correct-horse-battery-staple (not a real secret; synthetic helper constant). Port forwarding must terminate in the container, not blindly assume SSH host loopback reaches it. Existing worker instructions `ssh -L 4041:127.0.0.1:4041 <host>` apply ONLY when <host> loopback reaches the same network namespace. No actual SSH destination or external preview ingress has been verified. If unable to open, user chooses access assistance / approved temporary authenticated ingress; no forced acceptance and no infrastructure change without scope approval.

All eight example issues and two projects are synthetic, not live GitHub. Mutations in preview exercise only the synthetic service. Production remains board.workflows.ac on old release. No fake data shipped.

## Numbered click checklist (five per-issue verdicts)
1. **Navigation, apparence et projets (#56).** Basculer Canvas/List, clair/sombre, EN/FR ; choisir un projet puis Tous les projets. Le menu reste utilisable, les textes changent et la section active reste ouverte. At 360/768/1280.
2. **Canvas et positions (#57).** Déplacer une carte, zoomer/dézoomer, déplacer le fond et recharger. La carte garde sa position ; les points restent fins et tous les boutons sont accessibles.
3. **Dépendances (#58).** Relier deux cartes via leurs connecteurs ; ouvrir un lien et confirmer sa suppression. Le trait apparaît/disparaît réellement ; cliquer la dépendance vers l'autre projet ouvre la bonne tâche.
4. **Notes et rangement (#59).** Modifier la note Markdown attachée à #1, déplacer/redimensionner ; lancer Arrange puis Undo. La note reste lisible et liée à la carte, pas de collision ; Undo retrouve les positions.
5. **Sections latérales (#60).** Répondre à une question dans Decisions ; cocher Human Tasks dans Blocked ; comparer Opérations pour Tous les projets et un projet ; ouvrir Archives ; activer le mode présentation. Les compteurs et listes se mettent à jour ; le mode présentation cache brouillons, notes et contenu interne. Reopen tested ONLY on synthetic #6 after user policy choice.

## Structured directions for waiting UI, only if ready
Five per-issue verdict choices (each: Non testé / Validé / À corriger) with a notes field for the failed issue. Default no validation or release action assumed.

Separate policy choice: Réouvrir depuis Archives remet en Backlog (current) / demander autre destination / ne pas valider cette fonction. Current Reopen is user click only; agents never autonomously reopen real tasks.

Separate release choice: Autoriser fusion et push master ET bascule board.workflows.ac après les cinq validations / garder en aperçu / besoin d'accès. Do not interpret issue acceptance alone as publishing authority. Any selected À corriger or Non testé keeps whole current batch release blocked; partial passes recorded by issue.

#53/#54 supersession closure optional and separate, not a prerequisite for foundation release. No closure unless explicit approval; no implicit batch Done. Avoid cluttering essential click checklist with issue housekeeping; use collapsed detail or defer.

Known blind spots: real GitHub writes not exercised, external preview access not verified, touch input / Firefox / WebKit not tested, tactile fluidity and readability require user's hands, live cutover/rollback not run. Grid artifact resolved in real Chromium, not an unresolved app defect. Advanced B-D features deferred (labels/front matter editor, rich drawer/YouTube, Discussions/template, D1 capture, screenshots, Run, worktree management). A placeholder is never claimed implemented.

## If hostile3 FAIL
Do not issue L5 ask. Record precise blocker and stop automatic repeat cycles for user direction if another broad or policy fork appears. Prior remediation has taken multiple cycles; no new product scope and no downgrading empirical requirements for speed.

## After approval
Inspect current feature diff vs origin/master; verify no remote change; fresh release worker in same worktree. Brief must carry user's actual per-issue verdicts and release permission by disk pointer. Merge (never rebase/reset/force); if remote moved fetch then merge in a worker. Release package must match human-reviewed code; preserve old release 98261a8-20261103. Repoint current + restart supervisor via start.sh (cd happens at supervisor startup). Verify local/public health plus authenticated real read-only data; real writes require explicit allowed action, no autonomous reopen/Done. Rollback on regression to old release and restart. Keep issue closures/deletions separate unless explicitly directed. Worktree cleanup only with authorisation and all dirty/untracked/unique commits and run artifacts preserved.
