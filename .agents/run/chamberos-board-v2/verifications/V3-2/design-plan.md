# V3-2 — Studio de travail

## Passe 1 : proposition

Le graphe de dépendances est le geste distinctif : un atelier spatial, pas une grille de widgets. Chrome calme, tâches lisibles, état réel visible sans bandeau bavard.

- Clair : canevas #F7F8FA, cartes #FFFFFF, chrome #F1F3F6, encre #0F172A, secondaire #475569, accent #2563EB ; primaire #1E293B. Texte discret #64748B, filets rgba(15,23,42,0.08).
- Sombre : canevas #0B0D11, chrome #101318, cartes #161A22, relief #1E2430, texte #F1F5F9, secondaire #94A3B8. Texte discret #64748B, filets rgba(255,255,255,0.08).
- Typographie : famille système sans sérif pour vitesse et netteté ; monospace réservé au contenu technique. Nombres tabulaires partout. Titres sobres, casse phrase, lecture alignée à gauche.
- Rayons : panneaux 12px, contrôles 8px, éléments internes 4px ; pas de halos. Transitions transform/opacity, 160ms, désactivées avec mouvement réduit.

```text
Large : [navigation 224px] [projet + compte / recherche / filtres / nouvelle tâche]
                          [canevas infini ou groupes de tâches] [détail 520px]
Étroit: [menu][projet + compte][recherche][filtre][nouveau] 52px
        [espace de travail flexible, dock canevas intérieur]
        [Canevas][Liste][Décisions][Bloqué] + zone sûre
```

Liste : groupes de statuts non vides, repliables ; bascule à plat. Création dans un compositeur révélé à la demande, jamais quatre champs tassés. Sélecteur de projet recherchable, compte réel et santé API. Détail : identité et sortie GitHub persistantes, contrôles sous le titre, description Markdown puis sections utiles seulement.

## Passe 2 : critique avant construction

Rejet : répéter des cartes de statistiques et des micro-étiquettes suivies de métadonnées à points médians reproduirait un tableau SaaS générique. Choix révisé : réserver la force visuelle au canevas et aux liens ; contextes projet et synchronisation séparés par espacement. Navigation primaire limitée à quatre destinations en bas ; fonctions secondaires dans le panneau latéral. Le canevas initial étroit privilégie le premier groupe lisible plutôt qu’une miniature globale. Ajuster tout reste explicite.

Les dépôts ordinaires doivent avoir une liste À faire immédiatement utile et une description native, sans formulaires ChamberOS vides. Aucune donnée de démonstration dans le produit : fixtures isolées uniquement pour les preuves. Validation : captures Chromium aux quatre dimensions, deux thèmes et deux langues ; contrôle géométrique non vide du dock avec Annuler visible ; tests API et suites séquentielles. Conserver intégralement la formule du quadrillage et sa ligne 2268.
