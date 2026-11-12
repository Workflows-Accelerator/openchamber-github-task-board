# V4 targeted L4 — revue indépendante du correctif D39

Date : 2026-11-12. Branche : `feat/board-v3`.
Application revue : `a1225f023a736da70f6b06798c16a91b655cf01d`.
HEAD au début des vérifications : `b07dd941ee6f6df5e496631335473d9876b19680` (preuves du correcteur seulement après le SHA applicatif).
Parent du correctif : `0cef002f5401d54483c2c037fea998702fc5da08` (revue rejetée de l'application `cd64af1`), pas la base publiée.
Base de référence du dot grid : `28af19b`.
Commit de cette revue : commit contenant ce rapport ; retrouver son SHA avec `git log -1 --format=%H -- .agents/run/chamberos-board-v2/verifications/V4-targeted-L4/report.md`.

## Verdict

**SPEC : PASS. QUALITY : APPROVED, dans le périmètre borné D39.**

R1 et R2 sont fermés dans les reproductions indépendantes ci-dessous. Aucun changement produit supplémentaire ni nouvelle navigation. Le résultat n'est pas « tout est contenu » : 12 cadrages dépendances et huit cadrages filtrés restent incomplets à la borne 0.2. D39 accepte cette limite géométrique uniquement si l'interface l'annonce honnêtement, masque les labels aux endpoints entièrement absents et n'invite pas à une répétition inutile. Ces conditions sont satisfaites dans les cas mesurés.

## Méthode et indépendance

- Probes neufs : `scripts/targeted-review.mjs` et `scripts/regression-review.mjs`. Les assertions du probe ciblé du correcteur n'ont pas été reprises ; seuls les helpers de fixtures/lancement déjà présents dans `V4-final-L4/scripts/fixture-helpers.mjs` ont été copiés.
- Chromium `156.0.8078.4`, Playwright déjà installé, serveurs synthétiques GitHub/board sur localhost, service workers bloqués. Les identifiants sont les constantes des helpers de test, pas des secrets réels.
- Matrice R1 : normal/dispersé × 360/390/768/769/1280 × EN/FR × clair/sombre = 40 cas ; hauteur 800 à 360/390, 900 ailleurs.
- Clics réels sur Dependencies et sur Show all lorsqu'offert. Containment calculé carte par carte depuis les rectangles DOM dans le viewport visible, tolérance géométrique 0.5 px ; pas inféré du pourcentage de zoom. La source réserve en plus légende et HUD ; le probe mesure les recouvrements de légende et le smoke mesure la géométrie des contrôles.
- Pour rendre le bouton de dépendances cliquable, le probe place d'abord la carte #2 en vue. En R2, ce pan délibéré change parfois la vue d'entrée : le retour attendu est alors la vraie vue pré-focus, pas automatiquement la constante A.
- Les nombres de cas ci-dessous ne sont pas des nombres d'assertions. Les tableaux vides `geometry` et `checks` dans les sorties ne constituent pas une preuve : les mesures utiles sont dans les entrées R1, `filterLimit`, R2, sheets, D38, drag et Arrange.

## R1 — feedback honnête après un cadrage incomplet

Source revue : `web/public/app.js:2998–3077` (containment après clamp, message et réservations), `:3105–3166` (filtre, rail et garde de répétition), `:3236–3247` (messages de légende), `:3281–3337` (visibilité des labels).

### Dépendances

40 cadrages automatiques : zoom minimum mesuré 0.55 ; sélection entièrement contenue ; titres effectifs au moins 8.8 px. Les 32 cas arrêtés au plancher proposent une action explicite ; les huit cas normaux à 768/1280 cadrent déjà le groupe sans cette action.

32 clics explicites sur Show all :

- Normal 360/390/769 : 12 cas complets, aux zooms respectifs `0.315`, `0.344`, `0.488`, sans message de limite.
- Dispersé 768/1280 : huit cas complets, zooms `0.245` / `0.263`, sans message de limite.
- Dispersé 360/390 : huit cas à `0.2` ; voisins #1/#3/#4 entièrement hors du viewport. La carte choisie reste contenue. Les trois labels sont masqués.
- Dispersé 769 : quatre cas à `0.2` ; #1/#3/#4 intersectent partiellement le viewport mais ne sont pas entièrement contenus. Les trois labels restent visibles, conformément à D39 qui distingue endpoint entièrement absent et carte partiellement visible.
- Total : **20 complets, 12 incomplets**. Les 12 incomplets ont le message localisé exact, visible, hit-testable et contenu horizontalement dans la légende. Aucun recouvrement du message ou de la légende avec les cartes mesurées ; aucune action Show all restante ; état `dependencyFocusLimited=true`.
- Aucun label visible avec endpoint entièrement absent. Un second appel programmatique de Show all ne déplace pas la vue dans les 32 cas explicites ; pour les cas limités, aucune action répétitive n'est proposée à l'utilisateur.

Messages réellement comparés :

- EN : `Zoom limit reached. Some linked tasks remain outside this view. Pan the canvas to see them.`
- FR : `Limite de zoom atteinte. Des tâches liées restent hors de cette vue. Déplacez le canevas pour les voir.`

### Filtres

40 cadrages automatiques `priority:high`. Parmi eux, 28 offrent Show all et sont réellement cliqués : **les 28 deviennent complets**, zooms mesurés de `0.201` à `0.478`, sans avertissement ni action restante. Aucun de ces cas `priority:high` n'est un cas limité.

Huit cas supplémentaires, dispersé 360/390 × EN/FR × clair/sombre : filtre `stage:todo`, puis clic Show all. Zoom `0.2`, **quatre cartes filtrées entièrement hors du viewport**. Ce n'est pas un cadrage réussi. Le rail garde le message exact EN/FR indiquant la limite et le pan ; message visible/hit-testable, sans recouvrement des cartes ni du viewport ; Show all retiré, état `canvasFitLimited=true`.

Les 36 entrées `filterLimit` comprennent donc 28 résultats complets `priority-high` et huit résultats incomplets `stage-todo` ; ce nom de tableau ne signifie pas 36 limites atteintes. Le second appel programmatique n'est pas exercé par le probe pour `stage:todo` ; la non-répétition visible est mesurée et la garde de retour est lue à `app.js:3162–3166`.

### Géométrie et inspection visuelle

Matrice couvre les cinq largeurs, deux langues et deux thèmes. Quatre transitions supplémentaires 768/769/768/769 : bouton compact 44×44 hit-testable avant ouverture, drawer 280 px à 768, rail 56 px et bouton Expand sidebar atteignable à 769. Le bouton compact couvert par le drawer ouvert n'est pas faussement présenté comme cliquable.

Captures fraîches inspectées visuellement :

- `screenshots/r1-focus-explicit-spread-360-fr-dark.png` : limite lisible, sélection séparée, voisins absents et labels masqués.
- `screenshots/r1-focus-explicit-spread-769-fr-light.png` : voisins partiellement visibles, avertissement maintenu ; ce cas n'est pas déclaré complet.
- `screenshots/r1-focus-explicit-spread-768-fr-light.png` : quatre cartes contenues, aucun avertissement.
- `screenshots/filter-limit-spread-360-fr-dark.png` : rail de limite visible alors que les quatre cartes filtrées sont absentes.

**R1 fermé dans D39.** Limite géométrique maintenue et explicitement annoncée, pas dissimulée ni renommée en succès.

## R2 — retour exact et consommation différée

Source revue : `web/public/app.js:1789–1793` (capture pré-focus), `:3169–3195` (handoff), `:5864–5887` (pending protégé tant que focus possède la vue).

14 parcours : sept scénarios à 360 et 1280. Vue A = `{panX:123.125, panY:-47.875, scale:0.873}` ; vue B distincte = `{panX:-201.625, panY:93.375, scale:1.237}`.

- **clear-under-focus-second-cycle** : filtre capture A ; retirer le dernier filtre sous focus garde `pending=true`, focus actif, mémoire et stockage A présents. Fermer focus restitue A puis consomme mémoire/stockage/pending. Second cycle distinct restitue B, pas A.
- **change-filter-without-clearing** : changement sous focus garde pending ; fermeture recadre le nouveau filtre sans perdre A ; dernier retrait rend A et consomme le retour.
- **exit-with-filter-active-then-clear** : fermeture rend la vraie vue immédiatement pré-focus `{-436,-40,1}`, mémoire A conservée ; retrait final rend A.
- **list-clear-reload-canvas** : retrait en Liste garde A et pending ; reload puis Canvas restitue A et nettoie mémoire/stockage/pending.
- **search-only** : recherche seule ne capture pas de retour et ne déplace pas A ; effacement conserve A.
- **dependency-only** : après le pan volontaire de préparation, entrée/sortie rend la vraie vue pré-focus `{-436,-40,1}`, pas A ; aucun retour filtre créé.
- **filter-during-focus** : premier filtre sous focus capture la vraie vue pré-focus `{-436,-40,1}`, pas la vue temporaire ni A ; pending différé, fermeture le consomme, retrait final rend cette vue et nettoie le stockage.

Le probe navigateur compare avec tolérance numérique 0.001. Le contrôle complémentaire `scripts/evidence-integrity.py` compare strictement les nombres enregistrés : les retours A, B et pré-focus sont numériquement identiques, sans tolérance. Toutes les fins ont `filterView=null`, stockage absent et pending faux ; aucun focus actif (valeur nulle après fermeture, propriété non sérialisée lorsque jamais définie). **R2 fermé.**

## Suites imposées et régressions fraîches

Les cinq commandes imposées ont été exécutées séquentiellement, sans nouvel essai du smoke :

1. `npm test` : exit 0, **618/618**, zéro échec/skip/cancel.
2. `node --test --test-timeout=30000 web/tests/*.test.mjs` : exit 0, **631/631**, zéro échec/skip/cancel.
3. `npm run typecheck` : exit 0.
4. `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/v4-targeted-review-server.mjs` : exit 0, bundle 224.6 kb.
5. `node scripts/generate-delivery-smoke.mjs`, sortie dirigée par `DELIVERY_DIR` vers ce dossier : **une seule exécution**, exit 0, **14/14 sections PASS**, dont 112 surfaces de sheets et 32 cas de contrôles Canvas. Aucune modification du générateur.

`command-results.tsv` donne les commandes depuis la racine du worktree, les codes observés et les chemins de logs. Les invocations avec environnement y sont fournies comme commandes reproductibles ; les logs ne sont pas une capture intégrale de l'historique shell.

Probe `regression-review.mjs`, exit 0, aucun échec :

- Six sheets : filter/settings/sort à **360 FR sombre** et **1280 EN clair**. Tab/Shift+Tab bouclent, Escape ferme, body sheet-open avec scrollY=0 durant ouverture ; focus de fermeture enregistré sur l'ouvreur. Aucun contrôle visible de hauteur <44 px dans les six captures de métriques ; cela ne constitue pas une preuve de toute largeur tactile.
- D38 : séquence desktop : 230 px, repli à 56 px, reload, réouverture à 230 px, reload ; labels/états/persistance et hit-tests corrects. Bouton du rail replié **44×44** ; bouton du sidebar déplié desktop **24×24**, existant et hors du changement D39. À 360, préférences persistées `1` et `0` : bouton compact 44×44, drawer 280 px, fermeture par backdrop dans les deux cas.
- Drag réel : PUT **200**, `{460,90}` devient `{523,137}` et persiste au reload.
- Refus synthétique : un PUT **403**, rollback exact `{523,137}`, notice d'erreur, aucune rejection non gérée. Seul diagnostic attendu : `Failed to load resource: the server responded with a status of 403 (Forbidden)` ; conservé séparément dans le JSON, pas présenté comme zéro diagnostic brut.
- Arrange déplace les six cartes ; Undo restitue exactement leurs six paires de coordonnées.
- Reduced motion à 360 EN clair : transform immédiatement identique à celui mesuré 500 ms après.
- Enter sur la carte ouvre le drawer à 360 et 1280 ; fermeture par **Back**, pas par Escape. Escape a été vérifié sur les sheets uniquement.
- Aucun autre pageerror/console error dans les probes finaux ; aucune violation CSP dans la matrice ciblée et le smoke. Le probe régression installe aussi un listener CSP mais n'en agrège pas la sortie : il n'établit pas à lui seul un total CSP global.

## Invariants, source et préservation

`scripts/invariants.py` : **20/20**, exit 0. Plancher automatique 0.55 et bornes globales 0.2..2.5 inchangés. Segment dot grid byte-identique à `28af19b`, SHA256 `160742fe4f202ecb026aef42f552f8ec3e2cd29be5e84108311cebb4ac29b458`.

Le correctif source ne change que `web/public/app.js` et `web/tests/v3-ux-client.test.mjs`. Diff des tests lu : trois tests comportementaux D39, extensions du harnais DOM pour classes/SVG/removeChild/stockage ; aucune preuve indépendante fondée seulement sur ces tests du correcteur. Serveur/CSP, panel, service, Markdown, Arrange, CSS, HTML, paquets/lockfile et générateur smoke inchangés par le fix ; pas de dépendance ajoutée.

Les scans invariants couvrent les ressources texte de `web/public` pour vocabulaire/glyphes, `index.html` pour attribut style et HTML généré d'app.js pour style inline ; ne pas les extrapoler à tout fichier du dépôt. Identité Workflows Board et libellés EN/FR Canvas/List préservés.

Contrôle complémentaire d'intégrité : **22/22**, dont égalité stricte des 14 retours R2 et des **142 fichiers source** inventoriés. `integrity.json` et `reviewed-source.sha256` enregistrent les hashes réellement présents, leur correspondance au SHA applicatif et la portée de staging. Les 327 fichiers `V4-1-L4` et 647 fichiers `V4-final-L4` correspondent exactement à l'inventaire antérieur `V4-bounded-fix/preserved-inputs.json`. Les 647 fichiers committed `V4-final-L4` et 479 fichiers committed `V4-bounded-fix` correspondent aux blobs Git, sans fichier ajouté/retiré. `V4-1-L4` reste non suivi et non stagé.

Aucun changement applicatif/tests/smoke par cette revue. Staging et commit exclusivement sous `V4-targeted-L4/`, sur `feat/board-v3`. Aucun push, déploiement, mutation GitHub, changement de branche ou accès à un secret réel.

## Échecs et corrections du harnais

Les sorties initiales ne sont pas remplacées par les sorties vertes : `targeted-review-initial.json`, `regression-review-initial.json` et leurs logs restent présents. Aucun changement produit entre ces essais et les probes finaux.

- **DIDN'T WORK** : premier probe ciblé, exit 1, dix échecs : deux `breakpoint 768` mesuraient le bouton compact une fois couvert par le drawer ; huit attentes R2 comparaient à une vue antérieure au pan volontaire de préparation. **FINALLY WORKED** : hit-test du compact avant ouverture, comparaison à la vraie vue pré-focus ; contrats A/B et nettoyage du retour conservés, mesures finales sans échec.
- **DIDN'T WORK** : premier probe régression, exit 1, `D38 expanded desktop rail toggle visible and labelled` exigeait aussi 44 px sur le bouton desktop déplié alors que la mesure est 24 px. **FINALLY WORKED** : attente corrigée au contrat D38 (visible, hit-testable, libellé et état corrects), sans prétendre un agrandissement. Cibles téléphone et mesures du rail replié conservées. Cette correction d'attente ne modifie aucun test produit.
- **DIDN'T WORK** : deux assertions d'invariants du harnais comparaient SHA court/long et exigeaient une liste untracked vide. **FINALLY WORKED** : comparaison SHA complet et vérification explicite non suivi/non stagé ; contrôle distinct des 327 hashes. Les sorties erronées de ces premiers essais n'ont pas été conservées.
- Autres incidents de préparation : dossier logs initialement absent, `/usr/bin/time: No such file or directory`, `ReferenceError: width is not defined` dans la mesure de breakpoint. Dossier créé, durée mesurée par shell, largeur transmise à evaluate. Pas de captures brutes conservées pour tous ces incidents ; aucune prétention d'historique exhaustif.
- **DIDN'T WORK** : résumé ad hoc puis premier contrôle d'intégrité, exit 1, `KeyError: 'focus'`. `dependencyFocus` n'est pas initialisé dans l'état ; List/reload et search-only sérialisent donc une propriété absente, contrairement au `null` après fermeture. **FINALLY WORKED** : contrôle explicite « focus absent ou nul », sans modifier les JSON ni relâcher l'égalité numérique des retours. Trace du contrôle initial conservée dans `logs/evidence-integrity-initial.log`.

## Limites et recommandation

Aucun défaut bloquant nouveau observé dans le périmètre D39. Limite résiduelle **acceptée, non bloquante dans D39** à `web/public/app.js:3060–3077` / `:3105–3124` : à 0.2, groupes dispersés encore incomplets, huit cas filtrés même sans carte visible. Ce n'est ni lecture lisible simultanée ni garantie de containment. Pan/zoom existants et feedback honnête sont conservés ; aucun navigateur de tâches ajouté.

Non vérifiés : GitHub/authentification production, service live, déploiement/rollback, Safari/Firefox, appareil tactile physique, lecteur d'écran, safe areas matérielles, exhaustivité du contraste, boards de 1000 cartes. Preuve limitée à Chromium et fixtures synthétiques ; aucune validation de production induite.

**Recommandation : lever seulement le blocage R1/R2 de la correction D39 pour la chaîne de publication existante.** PASS/APPROVED indépendant ne vaut pas autorisation de déployer/pousser, ni approbation globale de nouvelles surfaces ou de nouvelles décisions produit.
