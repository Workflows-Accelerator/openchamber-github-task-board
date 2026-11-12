# V4 — correction bornée R1/R2, preuves fraîches D39

Date : 2026-11-12. Branche `feat/board-v3`. Base `0cef002f5401d54483c2c037fea998702fc5da08` (application `cd64af1`).

## Verdict et frontière

Correction locale R1/R2 ; **aucune approbation indépendante ni autorisation de publication**. D39 accepte une limite géométrique honnêtement annoncée ; ne transforme pas cette limite en containment réussi. Revue indépendante ciblée encore obligatoire ; si elle échoue, arrêt et retour utilisateur.

Deux commits séparés : source/tests puis ce dossier de preuves. SHA source et hashes réellement testés dans `tested-source.json` ; SHA de preuve effectif = commit contenant ce README, récupérable avec `git log -1 --format=%H -- .agents/run/chamberos-board-v2/verifications/V4-bounded-fix/README.md` et fourni dans le reçu final. Pas de SHA auto-référent inventé dans un fichier du commit.

## Reproduction avant toute correction produit

Copies neuves des probes indépendants, fixtures synthétiques localhost, Chromium **156.0.8078.4**. Sources antérieures et dossier non suivi protégés par `preserved-inputs.json`.

- `before/independent-browser.json` : 32 cadrages. R1 reproduit dans **8/8** cas dispersés 360/390 × EN/FR × clair/sombre : automatique `0.55`, explicite `0.2`, trois voisins #1/#3/#4 absents, avertissement retiré et trois labels trompeurs. 24 assertions R1 échouées, plus restauration filtre/focus. Attente de statut du harnais interrompue ensuite, conservée sans cacher l'erreur.
- `before/completion-browser-corrected.json` : **deux assertions R2 échouées**, aucune interruption. Départ `{123.125,-47.875,0.873}`, retour incorrect au filtre `{-451.94345718901457,-22.074313408723754,0.9563812600969306}` ; mémoire et stockage conservés avec pending déjà faux. Second départ `{-201.625,93.375,1.237}`, retour incorrect au premier départ.
- Captures avant : `before/screenshots/show-all-spread-360-light-fr.png`, `before/screenshots/focus-spread-360-dark-fr.png`, `before/screenshots/focus-filter-interleave-clean-1280-light-en.png`.

Les probes avant et après ne revendiquent aucune indépendance nouvelle : copies exécutées par le correcteur. Les auteurs de la revue suivante devront vérifier eux-mêmes.

## Changements produit limités

Seuls `web/public/app.js` et `web/tests/v3-ux-client.test.mjs` changent. Générateur smoke laissé intégralement inchangé.

### R1 : résultat réel et feedback honnête

- `app.js:2998–3024` : containment de chaque carte après transform clampé, dans la boîte réservant légende/HUD, tolérance géométrique 0.5px ; `incomplete` distinct de `floored`.
- `:3060–3077` : quitter le plancher ne prétend plus réussir. Mesurer aussi après retrait du bouton de rail et après insertion du message de limite. Compte intégral conservé, pas de suppression de voisins des données.
- `:3102–3166` : même résultat honnête pour filtres ; message dans rail existant, hauteur réelle réservée. Action « Tout afficher » retirée après tentative impossible ; garde contre répétition au même état limite. Pan/zoom toujours disponibles.
- `:3236+` : message EN/FR dans légende existante : limite atteinte, tâches liées toujours hors vue, déplacer canevas pour les voir. Aucun navigateur de tâches ajouté.
- `:3280–3337` : labels masqués dès qu'un endpoint est entièrement absent, à toute échelle ; règle indépendante de l'ancien flag de plancher. Labels réapparaissent quand les deux endpoints intersectent la vue.

### R2 : propriété de la vue et retour consommé

- `:1793` : premier filtre ajouté pendant focus capture le retour pré-focus, pas la vue temporaire.
- `:3169–3195` : fermer focus laisse la requête filtre différée reprendre la vue ; sélection d'une autre dépendance ne remplace plus le premier retour par un viewport de focus temporaire.
- `:5864–5887` : pending n'est plus consommé tant que focus possède la vue. Dernier filtre retiré : retour exact, mémoire/stockage supprimés ; filtres restants : cadrage courant repris puis retour original à leur retrait.
- Liste/reload et recherche conservent leur cycle de retour existant. Aucun changement de persistance des positions.

## Mesures après et disposition des anciennes attentes

Données complètes : `after-final/independent-browser.json`, `after-final/completion-browser-corrected.json`, `targeted.json`, résumé lisible machine `measurements-summary.json`.

- Matrice R1 **32/32** : normal/dispersé × 360/390/768/1280 × EN/FR × clair/sombre. Automatique toujours `>=0.55`, sélection entière, titres effectifs `>=8.8px`. Nouveau probe ajoute hit-test du message et exclusion géométrique légende/HUD.
- Normal téléphone : explicite `0.315` / `0.344`, quatre cartes contenues ; normal 768/1280 : automatique `0.708` / `0.785`, aucune action nécessaire.
- Dispersé 768/1280 : explicite `0.245` / `0.263`, quatre cartes contenues.
- Dispersé 360/390 : explicite **0.2**, **trois voisins toujours absents**. `legacyAllContained=false` conservé explicitement dans huit cas, **pas un PASS géométrique**. D39 satisfait par message visible et hit-testable, sélection non recouverte, zéro label visible avec endpoint absent, aucune boucle de bouton inutile. L'ancienne attente « tout contenu » demeure fausse et est remplacée uniquement dans le verdict fonctionnel approuvé D39.
- Filtres : **32 cas supplémentaires** normal/dispersé, mêmes dimensions/langues/thèmes ; cadrage et action lorsqu'offerte réellement cliqués. Le dispersé téléphone garde aussi son feedback de limite.
- R2 : **12 parcours**, 360 et 1280 × six scénarios : effacer sous focus puis second cycle ; changer sans vider les filtres ; Liste/effacer/reload/Canevas ; recherche intercalée ; dépendances seules ; premier filtre pendant focus. Zéro échec, valeur non finie, pending périmé ou stockage résiduel au retour final. Premier cycle exact `{123.125,-47.875,0.873}`, second exact `{-201.625,93.375,1.237}`. Parcours dépendances seules/priorité appliquée pendant focus reviennent exactement à leur véritable vue pré-focus, rendue cliquable par pan explicite du probe.
- Probes indépendants copiés : même R1/R2 exercés après ; completion garde drag PUT 200/reload, PUT 403/rollback, clavier Enter/statut POST Apply/reload, Markdown, reduced motion et frontières 768/769.

## Auto-revue hostile

### A — design et sincérité

Pas de refonte. Après tentative impossible, « Tout afficher » n'est plus présenté comme disponible indéfiniment : le message prend sa place dans la légende, donne limite et geste de récupération. Capture FR 360 avant : trois labels sans cartes. Après : explication lisible, labels disparus, carte choisie séparée de légende et HUD. Capture desktop : quatre cartes réellement contenues. Direction, thèmes, surfaces et disposition existantes conservés.

### B — attaques déterministes et corrections de cette passe

- Attaque : un `scale=0.2` peut tout de même rater la boîte utile. Correction : containment de chaque rectangle au transform final, pas succès inféré du zoom.
- Attaque : message inséré ou bouton de rail retiré change la géométrie. Correction : remesurer légende puis viewport après mise à jour du rail avant cadrage final. Probes finaux intégralement relancés après cette dernière correction défensive.
- Attaque : filtre floored derrière focus limité pourrait réafficher « Tout afficher » pour le mauvais groupe. Correction : focus possède aussi la sélection de contrôle du rail, aucun fallback filtré durant focus.
- Attaque : cacher les labels seulement à 0.55 réintroduit R1 à 0.2 ou après pan. Correction : visibilité liée aux endpoints, test comportemental de disparition/réapparition hors plancher.
- Attaque : consommation prématurée du pending, premier filtre sous focus, changement de filtres non vide et deuxième cycle contaminé. Correction : handoff différé et capture du retour pré-focus ; tests et parcours distincts.

Heuristiques Nielsen qualitatives, **sur ces parcours bornés uniquement**, scores statut/monde réel/contrôle/cohérence/prévention/reconnaissance/efficacité/minimalisme/récupération/aide : **3/3/3/3/3/3/3/3/4/3 = 31/40**. Ce n'est ni score indépendant ni nouvelle note globale du produit. La réduction à 0.2 reste illisible pour lire les cartes : conséquence explicite de l'action, pas prétendue lecture simultanée réussie. Charge cognitive : une explication, une fermeture et pan/zoom existants ; pas de liste de navigation additionnelle. Alex : retour exact ; Jordan : absence expliquée ; Sam : statut existant et endpoints honnêtes, lecteur d'écran non établi ; Riley : interleavings et reload ; Casey : message sans recouvrement et contrôles préexistants. Personas d'analyse, pas utilisateurs simulés.

## Vérification et intégrité

Exécutions et codes bruts dans `command-results.tsv`, sorties dans `logs/`. `scripts/required-checks.sh` impose les cinq commandes demandées **séquentiellement**, avec test de port local entre bundle et smoke pour garantir le fallback synthétique, sans installation ni retry du smoke. Détails finaux de suites et SHAs : voir reçu ci-dessous et `tested-source.json`.

Tests ciblés : 26/26 après extension réelle du harnais DOM (SVG, class, removeChild, lecture stockage) ; aucune assertion retirée, ignorée ou rendue vacuement vraie. Ancienne assertion « seuls les focus floored cachent les labels » remplacée par contrat D39 et test réel d'endpoints.

`scripts/invariants.py` vérifie 15 conditions : chemins autorisés, branche, anciens dossiers octet-identiques avec inventaire, `V4-1-L4` non suivi, générateur inchangé, serveur/panel/service/paquets inchangés, Markdown/Arrange/CSS/HTML inchangés, dot grid byte-identique, zoom/plancher, vocabulaire/glyphes/inline HTML et D38 inchangés. SHA256 dot grid `160742fe4f202ecb026aef42f552f8ec3e2cd29be5e84108311cebb4ac29b458`.

Patches bruts exacts `application-fix.diff`, `regression-tests.diff` et logs préservés. Les lignes de contexte obligatoires des patches peuvent faire échouer `git diff --cached --check` global ; ne pas les nettoyer pour prétendre intégrité. Contrôle ciblé exclut seulement captures brutes nommées, hashes conservés, et valide tous les autres fichiers stagés. `scripts/evidence-integrity.py` contrôle scope de staging, sources testées et identité des patches.

## Apprentissages, échecs préservés

- DIDN'T WORK : probe indépendant copié attendait encore `PATCH` pour statut après correction du drag ; `page.waitForResponse: Timeout 30000ms exceeded`. FINALLY WORKED : lecture `saveStatus` confirme **POST** `/issues/2/status`, clic Apply conservé ; completion avant avait déjà reproduit R2 sans interruption. Aucun changement produit pour cette erreur de harnais.
- DIDN'T WORK : tests initiaux supposaient containment à hauteur 600 malgré réservations de 260px ; assertion `false !== true`. FINALLY WORKED : fixture haute de 900 adaptée au cas faisable ; assertion sous légende reste stricte, cas impossibles toujours vérifiés.
- DIDN'T WORK : VM DOM ne modélisait ni SVG/classes ni `removeChild` ; label absent, `document.createElementNS is not a function`, puis `g.parentNode.removeChild is not a function`. FINALLY WORKED : harnais étendu aux opérations réelles, assertions comportementales conservées.
- DIDN'T WORK : premier lancement du probe ciblé interrompu par timeout outil 120s, exit 143/SIGTERM avant écriture finale. FINALLY WORKED : timeout 600s, 32+12 parcours complets ; puis répétition finale après remesure défensive.
- DIDN'T WORK : comparaison d'inventaire avec clés relatives versus absolues, faux `previous_evidence_exact=false`. FINALLY WORKED : normalisation des chemins seulement ; hashes identiques, contrôle 15/15.
- DIDN'T WORK : `rg` CLI absent (`command not found`) lors d'une lecture. FINALLY WORKED : grep/sed et outils dédiés. Aucun outil installé.

## Captures inspectées et limites

Inspection visuelle réelle : avant `before/screenshots/show-all-spread-360-light-fr.png` ; après `after/screenshots/show-all-spread-360-light-fr.png`, `after/screenshots/focus-spread-360-dark-fr.png`, `after/screenshots/show-all-spread-1280-light-fr.png`. Répétition finale équivalente sous `after-final/screenshots/`. Parcours R2 capturés sous `after/screenshots/r2-*.png`. Les assertions ne reposent pas seulement sur ces images : coordonnées exactes dans JSON.

Non vérifié : GitHub/authentification production de ce SHA, déploiement/rollback/live, Safari/Firefox, téléphone tactile physique, lecteur d'écran, safe areas matérielles, 1000 cartes, contraste de tous pixels. Aucune mutation GitHub, lecture de secret réel, fermeture d'issue, publication, push, changement de branche, modification root checkout/configuration/releases ou délégation. Les seuls mots de passe utilisés sont ceux des helpers synthétiques fournis. Aucun fichier antérieur supprimé ou édité.
