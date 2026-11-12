# V4 final L4 — revue indépendante hostile

Date : 2026-11-12. Branche : `feat/board-v3`.
Base publiée : `28af19b`. Application revue : `cd64af10bbc2e888990377143a2fcd1ce812bb7c`.
Portée : incrément complet, attention renforcée à `6535937..cd64af1`.
Commit de preuve : commit contenant ce rapport, exclusivement sous `V4-final-L4/`.

## Verdict

**SPEC : FAIL. QUALITY : CHANGES REQUESTED. Publication bloquée.**

- Sheets : PASS pour géométrie, groupes, états sélectionnés, clavier, fermeture et verrouillage testés.
- Dépendances : PASS pour cadrage automatique conforme à D37 ; FAIL pour promesse et état après « Tout afficher » sur canevas dispersé à 360/390.
- Renommage : PASS, `Workflows Board` dans titre, navigation et manifeste.
- Espacement : PASS dans surfaces mesurées, titres 16px et Arrange ; aucune régression de chevauchement constatée dans ces fixtures.
- D38 : PASS, rail réouvrable après rechargement, sans réduire le drawer téléphone ; frontière 768/769 vérifiée.
- Filtres : FAIL pour retour de viewport lors de l'entrelacement filtre/dépendances, puis cycle suivant.

Deux défauts ouverts, aucun P0. Aucun changement d'application, de test ou de générateur appliqué par cette revue. Les PASS des suites ne ferment pas les deux cas adversariaux ci-dessous.

## Défauts ouverts

### R1 — P1 : « Tout afficher (4) » omet trois voisins et retire l'explication

**Source : `web/public/app.js:3039-3045`, `:3176-3185`, `:3228-3247` ; clamp `:2839-2850`.**

Reproduction répétable : `node .agents/run/chamberos-board-v2/verifications/V4-final-L4/scripts/independent-browser.mjs`, première partie `framing`, fixture `spreadPreview` de `fixture-helpers.mjs`.

1. Ouvrir la fixture dispersée à 360×800 ou 390×800, tout projet, EN/FR et clair/sombre.
2. Cliquer Dépendances sur #2. Vue automatique à `0.55`, carte choisie entièrement visible, titres effectifs `8.8px`, voisins annoncés hors champ et action 44px visible : comportement approuvé D37.
3. Cliquer réellement « Tout afficher (4) » / « Show all (4) ».
4. Zoom atteint `0.2`, mais #1, #3 et #4 restent **entièrement hors champ**. Texte d'avertissement et action disparaissent. Trois labels de relations sont affichés et rabattus dans la vue alors qu'un de leurs endpoints est totalement absent.

Résultat identique dans **8/8 cas téléphone**. Ce n'est pas un rejet du compromis de lecture D37 : le cadrage automatique est correct. Défaut : l'action promet quatre cartes puis retire la seule information expliquant que trois manquent. Impossible de considérer le bouton comme un full-fit réussi.

Cause : `frameDependencyFocus({showAll:true})` efface les flags avant de vérifier si le fit clampé contient réellement les cartes. `positionDependencyWireLabels` n'applique sa suppression d'endpoints invisibles que si le flag `dependencyFocusFloored` reste vrai.

Preuves : `independent-browser.json` (`framing`, `failures`), `measurements-summary.json`, `logs/independent-browser.log`.
Captures : `screenshots/focus-spread-360-dark-fr.png`, `screenshots/show-all-spread-360-light-fr.png`, `screenshots/show-all-spread-390-dark-fr.png`.

Borne existante `0.2` respectée : ne pas l'élargir silencieusement. Correction minimale recommandée au responsable : conserver une explication honnête de la limite atteinte et ne pas présenter les endpoints absents comme visibles. Si une nouvelle navigation est nécessaire, demander le choix utilisateur entre navigation vers voisins et autre présentation explicite ; pas de décision produit prise ici.

### R2 — P2 : effacer le dernier filtre pendant le focus consomme la restauration sans l'appliquer

**Source : `web/public/app.js:5803-5823`, en particulier `:5804` et `:5807`, avec `:3115-3124` et `:1790-1792`.**

Reproduction propre : `node .agents/run/chamberos-board-v2/verifications/V4-final-L4/scripts/completion-browser-corrected.mjs`, section `focusFilter`. Aucun état de stockage malformé dans ce contexte.

1. Viewport initial exact `{panX:123.125, panY:-47.875, scale:0.873}`.
2. Appliquer priorité haute ; viewport différent `{panX:-451.94345718901457, panY:-22.074313408723754, scale:0.9563812600969306}`.
3. Cliquer Dépendances de #2, retirer le dernier filtre par sa puce, puis fermer Dépendances.
4. Retour au viewport **filtré**, pas au viewport initial. `filterView` et `tb_canvas_filter_view` contiennent encore le premier viewport, alors que `canvasFitPending=false`, sans filtre ni focus.
5. Déplacer la vue à `{panX:-201.625, panY:93.375, scale:1.237}`, appliquer puis retirer un filtre : retour au **premier** viewport (`123.125/-47.875/0.873`), pas à celui de ce second cycle.

Cause : le rendu efface `canvasFitPending` avant le garde `!state.dependencyFocus`. La sortie de focus ne consomme que `dependencyFocusReturn`; elle ne reprend pas la restauration différée du filtre. L'ancien `filterView` empêche ensuite `rememberView` de capturer le nouveau départ.

Impact : perte de contexte spatial et saut inattendu au cycle suivant ; positions des cartes non perdues. Rechargement peut consommer l'ancien retour, mais ce n'est pas le parcours attendu.

Preuves : `completion-browser-corrected.json` (`focusFilter`, deux assertions échouées sans interruption), `logs/completion-browser-corrected.log`, `screenshots/focus-filter-interleave-clean-1280-light-en.png`.
La première exécution avait déjà révélé le stockage non consommé ; la reproduction propre confirme aussi l'écart numérique et la contamination du second cycle.

## Disposition D1–D7

- **D1 : ROUVERT partiellement (R1).** Plancher automatique `0.55` correct dans 32 cas indépendants normal/dispersé, quatre largeurs, deux thèmes/deux langues. Titres sélectionnés `>=8.8px`. Filtres : 16 cas frais du probe V4-1c, action réellement reliée, full-fit compact valide. Full-fit dispersé téléphone non valide.
- **D2 : ROUVERT partiellement (R1).** Avant action explicite, voisins hors champ annoncés et labels sans endpoints supprimés, 32/32 cas. Après action dispersée téléphone, avertissement supprimé et labels trompeurs réapparaissent.
- **D3 : ROUVERT pour entrelacement (R2).** Retrait simple, changement high/urgent, rechargement filtre actif, effacement en Liste puis rechargement/Canevas et recherche seule : preuves fraîches conformes. Deux cycles simples restaurent exactement leurs départs distincts. Sept stockages testés : JSON invalide, pan non fini, échelles `9`, `0.1`, chaîne `"0.8"` rejetés et supprimés ; bornes numériques `0.2` et `2.5` acceptées. Mais cycle focus/filtre et cycle suivant échouent.
- **D4 : FERMÉ.** Source `web/public/theme.css:3536-3545`. Quatre options Sort à 1280 mesurent `44px`, bordure `1px`, rayon `8px`, police héritée et exactement une option pressée. Vérification complémentaire à 360 FR clair/sombre ; mêmes mécanismes View dans les 112 surfaces de chaque smoke.
- **D5 : FERMÉ pour smoke demandé.** Source `scripts/generate-delivery-smoke.mjs:288-295` et mesures `:857+/:920+`. Deux runs complets consécutifs, zéro retry, sorties 0/0, 14/14 sections chacun. Attente d'animations et tolérance autour de l'opacité `0.22` examinées : pas d'assertion retirée pour verdir. Les probes indépendants montrent que ce smoke ne couvre pas R1/R2.
- **D6 : FERMÉ.** Source `web/public/theme.css:3555`. Deux boutons « Enregistrer le nom » à 360 sombre FR : `44px` de haut, `311px` de large ; sheet `680px` dans viewport `800px`. Contrôles visuellement inspectés après scroll.
- **D7 : FERMÉ.** Source `web/public/app.js:3440-3445`. Vrai pointer drag, 403 injecté : une requête refusée, message visible, rollback exact, zéro rejet non géré et zéro pageerror. Reproduit frais depuis `{460,90}` puis depuis `{523,137}`. Seul diagnostic console permis : exact `Failed to load resource: the server responded with a status of 403 (Forbidden)` de la réponse volontairement injectée.

## Matrices et régressions fraîches

### Cadrage, action et labels

`independent-browser.json` contient 32 cas réellement cliqués : normal/dispersé × 360/390/768/1280 × EN/FR × clair/sombre. Mesures arrondies ci-dessous ; JSON conserve aussi coordonnées exactes.

- Normal 360/390 : automatique `0.55`, sélection entière ; action explicite `0.315` / `0.344`, quatre cartes contenues.
- Normal 768/1280 : automatique `0.708` / `0.785`, groupe contenu sans action nécessaire.
- Dispersé : automatique `0.55` aux quatre largeurs ; sélection entière, titres 16px calculés, 8.8px effectifs, explication vraie, labels absents si endpoint totalement hors champ.
- Dispersé 768/1280 : explicite `0.245` / `0.263`, quatre cartes contenues.
- Dispersé 360/390 : explicite `0.2`, seulement sélection visible ; R1 ouvert, pas de PASS cachant cette limite.

Les actions mesurées sont dans la fenêtre, hit-testables et de hauteur `44px`. Le probe D38 complémentaire vérifie aussi qu'elles ne recouvrent ni carte choisie ni zoom. Lire simultanément tous les voisins sur téléphone n'est pas exigé.

### D38 et frontière responsive

`v41d-measurements.json`, `v41d-summary.json`, `replication-summary.json` :

- 1280×900 : **4/4** clair/sombre × EN/FR. Vrais clics collapse, reload, réouverture, reload. Rail `56px`, toggle `{left:5.5,top:8,width:44,height:44}`, dans la fenêtre et non couvert. Libellés/title/`aria-expanded` suivent l'état. Réouverture `230px`, préférence `1` puis `0`, reload conserve l'ouverture.
- 360/390 : **8/8** largeur × thème × préférence `1`/`0`. Hamburger 44×44 visible avant ouverture, drawer entier `280px`, backdrop ferme et réouvre, préférence inchangée.
- `completion-browser-corrected.json.breakpoint` : transitions 768,769,768,769. À 768 : hamburger 44×44 hit-testable avant ouverture, drawer à `x=0`, largeur `280`. À 769 : rail `56px`, toggle 44×44 hit-testable « Expand sidebar ». Aucun rétrécissement du drawer par règle de rail.

### Sheets, filtres et clavier

Chaque smoke couvre **112 surfaces** : filter/settings/sort/view/project/creation/Arrange × 16 combinaisons. Aussi 12 cas sidebar, 16 filtres, 16 dépendances, 16 géométries List/drawer/picker/client et 32 cas canvas-controls (dont Undo).

Probe indépendant : **9 cas** filter/settings/sort à 360 FR clair, 360 FR sombre, 1280 EN clair. Tab/Shift+Tab bouclent correctement, Escape ferme, focus revient à l'ouvreur, body verrouillé pendant ouverture ; scroll de page reste `0/0`. Vrais clics backdrop et bouton fermer passent. Le drawer reste volontairement ouvert quand sa sheet Settings ferme ; le probe le ferme avant d'exercer un autre ouvreur. Aucun diagnostic CSP sur ces parcours.

Les contrôles `aria-pressed`, compte appliqué, puces, reset et sens des groupes sont couverts par le smoke. Source du cycle de vie commun `web/public/app.js:1918-1988` examinée. Pas de preuve lecteur d'écran ni certification exhaustive de toutes les combinaisons de sheets imbriquées.

### Drag, statut, Arrange, notes et mouvement

- `completion-browser-corrected.json.drag` : vrai pointer drag `{460,90}` vers `{523,137}`, réponse **PUT 200**, mêmes coordonnées après reload. Fixture serveur synthétique, pas preuve GitHub en production.
- Refus de save : **PUT 403**, rollback de `{583,177}` à `{523,137}`, message exploitable, zéro unhandled/pageerror. Voir section D7.
- Activation clavier de carte par Enter ouvre le drawer ; sélection puis vrai clic Apply envoie le changement de statut. `status:todo` / `effectiveStage:todo` après reload.
- `v41d-measurements.json.arrange` : sept cartes dont titre très long. Font `16px`, clamp deux lignes intentionnel, zéro overflow horizontal des titres/contenu en flux. Arrange/all/confirm par clics déplace les cartes, zéro overlap, tous gaps de même colonne `>=45px`. Undo restaure les positions numériques de chaque carte, y compris après reload. Ports hors carte de 7px exclus correctement de la mesure de contenu en flux, pas suppression d'un défaut.
- Markdown note : `h3=Review note`, `strong=Bold`, couche notes `z-index:20`, cartes `30`. Renderer et moteur Arrange inchangés depuis base.
- Reduced motion : focus sans différence numérique entre état immédiat et état 500ms plus tard ; réplication complémentaire à 360 EN/FR identique au plancher.

## Revue visuelle et craft

### A — design

Direction acceptée conservée : palette neutre nette, accents fonctionnels, hiérarchie par taille/poids et rythme plutôt que décoration. À 360 FR, intro filtres, sections et footer d'action restent lisibles ; état pressé séparé du repos, défilement contenu dans sheet. Settings après scroll garde le titre et « Terminé » accessibles, les noms de projet ont un vrai bloc formulaire. À 1280, sheet droite contenue et boutons Sort cohérents. Rail fermé visuellement réouvrable. Arrange sépare projets/colonnes sans collisions dans la fixture.

Pas de refonte esthétique demandée : R1 est un problème de sincérité du feedback et R2 de liberté/retour, pas un désaccord avec la direction visuelle. Le screenshot R1 montre précisément le danger : un grand canevas presque vide et trois labels lisibles donnent l'impression d'un fit achevé autour d'une carte minuscule.

### B — déterministe

Mesures géométriques ci-dessus, focus/clavier, 44px de sheets et contrôle D38, HTML `lang`, zéro surplomb dans les matrices. `contrast-tokens.json` : contraste tokens texte principal clair `17.85:1`, sombre `15.91:1` ; texte secondaire clair `7.58:1`, sombre `6.8:1`, texte bouton bleu `5.17:1`. Calcul sRGB sur tokens réellement lus, pas audit de tous pixels/composites. Ces valeurs ne satisfont pas le niveau interne très strict de persona `21:1` ; pas de fausse affirmation AAA globale. Animation de cadrage à `320ms` (`app.js:2507`) dépasse le guide craft de feedback `<=200ms` : observation non bloquante, reduced motion fonctionnel.

### Heuristiques Nielsen, évaluation sur parcours observés (0–4)

1. Visibilité d'état : **2/4**, R1 retire l'état hors champ malgré omission.
2. Monde réel : **3/4**, flèches expliquées, mais « Tout afficher » inexact dans R1.
3. Contrôle/liberté : **2/4**, sorties/Undo bons, retour filtre R2 cassé.
4. Cohérence : **3/4**, sheets et options homogènes.
5. Prévention : **3/4**, refus/rollback clairs, pas de mutation destructrice exercée.
6. Reconnaissance : **3/4**, puces/groupes/aides réduisent mémoire nécessaire.
7. Efficacité : **3/4**, Tab/Escape/Enter testés ; pas revue exhaustive des raccourcis.
8. Minimalisme : **3/4**, hiérarchie calme, surfaces bien groupées.
9. Récupération d'erreur : **3/4**, message de refus et rollback passent.
10. Aide : **3/4**, explication locale utile sauf disparition R1.

**Total 28/40, socle bon, pas approbation de publication.** Score qualitatif traçable aux parcours ci-dessus, pas mesure automatisée ni étude utilisateurs.

Charge cognitive : familles filtres explicites, options pressées et résultat dans footer évitent de mémoriser les choix. Groupe Statut a huit options secondaires ; hiérarchie les distingue des actions primaires (fermer/reset/appliquer), pas huit actions principales concurrentes. Les deux entrées « Tout afficher » sont cohérentes mais doublent une même action et n'excusent pas son résultat trompeur.

Personas, attaques sur preuves observées : Alex réussit activation/clavier/Undo mais perd sa vue dans R2 ; Jordan comprend flèche et groupes mais est trompé par R1 ; Sam dispose de focus bouclé/retour/Escape, lecteur d'écran et 21:1 non établis ; Riley reproduit mid-flow reset/reload/stockage/second cycle et ouvre R1/R2 ; Casey conserve drawer et cibles 44px, mais son téléphone masque trois voisins après full-fit. Aucun panel de personnes réelles simulé ni prétendu.

## Commandes, décomptes et échecs préservés

Toutes commandes requises exécutées **séquentiellement**, contre application revue inchangée. `scripts/required-checks.sh` est reproductible ; logs bruts et codes/horaires dans `command-results.tsv`.

1. `npm test` : **exit 0, 618/618**, zéro échec/skip/cancel. `logs/npm-test.log`.
2. `node --test --test-timeout=30000 web/tests/*.test.mjs` : **exit 0, 628/628**, zéro échec/skip/cancel. `logs/web-tests.log`.
3. `npm run typecheck` : **exit 0**. `logs/typecheck.log`.
4. `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/v4-final-review-server.mjs` : **exit 0**, `224.6kb`. `logs/server-bundle.log`.
5. `node scripts/generate-delivery-smoke.mjs` avec `DELIVERY_DIR` propre : **exit 0 puis 0**, 14/14 sections par run, back-to-back 10:30:27–10:35:22 puis 10:35:22–10:40:15 UTC. `smoke-run-1/`, `smoke-run-2/`. Aucun échec requis masqué ou retry du smoke.

Compléments réels :

- `node .../scripts/replicate-d38.mjs` : exit 0 ; copie des assertions du builder exécutée indépendamment sur nouvelles fixtures, preuves fraîches dans ce dossier.
- `node .../scripts/replicate-v41c.mjs` : exit 0 ; idem. Son `spreadAllPass:true` **ne prouve pas** containment téléphone : l'assertion y vaut null. Verdict de cette revue ne reprend pas ce PASS comme fermeture de R1.
- `node .../scripts/independent-browser.mjs` : **exit 1** ; 32 cadrages, neuf sheets, sept stockages, deux cycles, quatre transitions. 24 assertions liées à R1, une liée au stockage R2 ; puis interruption du contrôle de drag par attente du mauvais verbe HTTP. Preuve initiale conservée entière.
- `node .../scripts/completion-browser.mjs` : **exit 1** ; positions drag/reload et refus mesurées, mais observateur attendait encore PATCH et statut non appliqué. Fausse assertion de requête et interruption de harnais, pas défaut produit. JSON/log préservés.
- `node .../scripts/completion-browser-corrected.mjs` : **exit 1 uniquement pour les deux assertions R2**, aucune interruption ; PUT save/refus, Enter, Apply/statut/reload, note, reduced motion et frontière 768/769 complétés. Pas d'assertion affaiblie sur le produit.
- `python3 .../scripts/invariants.py` : exit 0, **16/16** contre `28af19b`.
- `node --check` sur les scripts indépendants/completion : exit 0 ; contrôles syntaxiques finaux et état Git consignés dans `logs/final-integrity.log`.

Aucun total fictif combinant tests unitaires, matrices et assertions de probes. Les commandes à points de suspension ci-dessus désignent le préfixe `.agents/run/chamberos-board-v2/verifications/V4-final-L4` ; scripts exacts présents.

## Invariants et limites de preuve

`invariants.json`, `logs/invariants.log`, `reviewed-source.sha256`, `application-review.diff`, `increment-paths.txt` :

- Bloc de calcul/affectations dot-grid **byte-identique** à `28af19b`, SHA256 `160742fe4f202ecb026aef42f552f8ec3e2cd29be5e84108311cebb4ac29b458`. L'enveloppe `updateCanvasTransform` a des hooks animation/labels nouveaux ; elle n'est pas prétendue identique à la base publiée.
- Canvas/Canevas, List/Liste et sidebar conservés ; canevas sans plane fixe ; renderer Markdown et Arrange inchangés.
- Aucun changement `web/server/**`, `web/server.ts`, `panel/**`, `service/**`, paquets/lockfiles ; CSP serveur inchangée. Zéro violation collectée en browser.
- Zéro mots produit interdits/ancien nom, pictogrammes interdits ou attribut HTML source `style=` détectés. Browser invariants copiés et réexécutés : aucun bouton icon-plus avec texte préfixé plus. Transformations CSSOM ne sont pas des attributs HTML inline ajoutés au source.
- Aucun comportement de production simulé ajouté : toutes écritures de cette revue ciblent uniquement serveurs synthétiques localhost.
- `preserved-inputs.sha256` protège le dossier préexistant `V4-1-L4/`, non modifié, non stagé ; `reviewed-source.sha256` protège les sources pendant cette revue.

Non vérifié : vrai GitHub/authentification production de cet incrément, service installé/live, déploiement/rollback, Safari/Firefox, appareil tactile physique, lecteur d'écran, safe areas matérielles, boards de 1000 cartes et contrastes de tous composants. Playwright Chromium **156.0.8078.4**, fixtures synthétiques locales ; service workers bloqués dans probes pour éviter cache obsolète. Aucun changement sous root checkout, configuration globale ou releases. Preuve téléphone live du correctif précédent fournie par utilisateur n'est pas preuve de ce SHA. Aucun droit de fermer #53–#71 déduit de cette revue.

## Captures réellement inspectées

Toutes chemins relatifs à ce dossier, images fraîches ; matrices et JSON indiquent les conditions, pas d'image ancienne renommée en preuve neuve.

- `screenshots/filter-360-light-fr.png`, `smoke-run-2/screenshots/filter-360-dark-fr.png` : groupes, rythme et footer.
- `screenshots/settings-360-dark-fr.png`, `smoke-run-2/screenshots/settings-360-dark-fr.png` : contrôles rename après scroll et vue de tête.
- `smoke-run-2/screenshots/filter-1280-light-en.png` : sheet desktop, footer et groupes.
- `screenshots/focus-spread-360-dark-fr.png`, `screenshots/show-all-spread-360-light-fr.png` : D37 automatique correct, action explicite incorrecte R1.
- `smoke-run-2/screenshots/dependency-360-light-fr.png` : sélection, légende, zoom/dock.
- `screenshots/d38-rail-collapsed-reload-1280-dark-fr.png` : toggle visible, hiérarchie rail.
- `screenshots/a2-arranged-1280-light-en.png` : bandes, colonnes, notes, absence de collisions dans fixture.

Autres pointeurs utiles : `screenshots/drag-refused-1280-light-en.png` du probe initial n'existe pas car interruption avant capture ; utiliser **`screenshots/d7-drag-save-refused-1280-light-en.png`** ou **`screenshots/refused-drag-completion-1280-light-en.png`**. Le nom manquant n'est pas une preuve. Drag réussi : `screenshots/successful-drag-{before,after,reloaded}-1280-light-en.png`.

## Apprentissage d'investigation

- DIDN'T WORK : import direct `playwright` depuis worktree, `ERR_MODULE_NOT_FOUND`; import absolu en destructuration nommée, `TypeError: Cannot read properties of undefined (reading 'launch')`; chemin browser par défaut manquant `chromium_headless_shell-1243`. FINALLY WORKED : package déjà installé, `pkg.default || pkg`, executable explicite installé `chromium_headless_shell-1248`, launch 156 exit 0. Aucune dépendance ajoutée ni installation système effectuée par cette revue.
- DIDN'T WORK : attente de drag `PATCH` alors que canvas utilise `PUT`, `page.waitForResponse: Timeout 30000ms exceeded`. FINALLY WORKED : relire endpoint et observer PUT dans probe complémentaire ; positions exactes + réponse 200 et refus 403 désormais prouvés, résultat initial conservé.
- DIDN'T WORK : sélectionner statut sans cliquer Apply, `page.waitForFunction: Timeout 30000ms exceeded`. FINALLY WORKED : vrai clic `#apply-status`, reload confirme `todo`; aucun changement produit/test.
- DIDN'T WORK : mesurer drawer immédiatement après clic montrait son point de départ `x=-280`; hamburger est couvert une fois drawer ouvert. FINALLY WORKED : attendre 160ms d'animation puis mesurer drawer ; hit-test hamburger avant ouverture, rail après transition. D38 confirmé, pas faux défaut responsive.
- DIDN'T WORK : tentative de lire ancien chemin de tâche V4-1 absent. FINALLY WORKED : contrat de dispatch fourni, décisions fournies et sources réelles utilisés ; aucune exigence inventée depuis un fichier manquant.
- DIDN'T WORK : `git diff --cached --check`, exit 2 : 54 espaces obligatoires de contexte dans le patch brut et une ligne vide finale émise par npm. FINALLY WORKED : préserver les captures exactes et le diagnostic initial, vérifier leurs SHA256 et l'identité du patch avec Git, puis appliquer le contrôle de whitespace par défaut à tous les autres fichiers stagés. Aucune règle Git ni assertion produit modifiée pour masquer ces exceptions de format.

## Intégrité finale des preuves

`python3 .agents/run/chamberos-board-v2/verifications/V4-final-L4/scripts/evidence-integrity.py` contrôle avant commit : branche/SHA revus, scope stagé exclusivement `V4-final-L4/**`, sources et ancien dossier `V4-1-L4/` inchangés, patch brut exact et whitespace des fichiers hors captures brutes. Reçu dans `logs/evidence-integrity.log`. `staged-paths.txt` reste le snapshot du premier staging, pas une prétendue liste finale auto-référente.

Le contrôle Git global reste diagnostiquement non nul : ses espaces signalés font partie du format de preuve, pas de changements produit. Trois captures brutes explicitement exclues du **seul contrôle whitespace ciblé**, conservées octet pour octet et vérifiées par hash : `application-review.diff` (patch unifié à neuf chemins identique au diff Git), `logs/typecheck.log` (sortie npm), `logs/staged-diff-check.log` (diagnostic initial contenant lui-même les espaces cités). Le script refuse toute autre exception. Ni nettoyage destructif des preuves, ni `.gitattributes`, ni désactivation globale de vérification.

## Gate final

Exiger correction bornée R1/R2 puis nouvelle revue indépendante ciblée avant publication de ce scope. Ne pas modifier plage globale du zoom, navigation ou compromis D37 sans approbation appropriée. Cette revue ne pousse, ne déploie, ne déplace aucune branche et n'autorise aucune fermeture d'issue.
