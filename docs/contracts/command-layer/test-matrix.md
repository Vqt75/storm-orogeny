Status: Draft — condition préalable à la validation de l'implémentation
Generation: Orogeny

# Command Layer — matrice de vérification combinatoire

Tester un état isolé ne suffit pas. La Command Layer doit être vérifiée lorsque plusieurs événements concurrents arrivent ensemble — dérivés systématiquement de la table de priorité (tests paramétriques), pas écrits à la main cas par cas.

## Cas combinatoires à couvrir (liste vivante, non exhaustive)

| État initial | Événement A | Événement B | Focus | Résultat attendu |
|---|---|---|---|---|
| Navigation cachée | Autosave échoue | L'utilisateur remonte | contenu | Erreur affichée, navigation ne masque pas l'erreur |
| Publier visible | Autosave démarre | — | contenu | Publier reste prioritaire ou comportement défini explicitement |
| Navigation visible | Publication lancée | L'utilisateur scroll | bouton Publier | Géométrie gelée tant que focus actif |
| Capsule basse | Utilisateur Tab jusqu'à elle | Autosave finit | Command Layer | Aucun déplacement spatial sous le focus |
| Erreur affichée | Utilisateur corrige/retry | Retry réussi | action retry | Transition vers état sûr définie |
| Navigation compacte | `prefers-reduced-motion` actif | Changement produit | extérieur | Contenu remplacé au même emplacement |

## Cas plus vicieux, à couvrir également

- Publication réussie exactement au moment où l'utilisateur remonte ;
- Erreur de sauvegarde pendant que le focus est sur Publier ;
- Changement de contexte alors qu'un lecteur d'écran parcourt la couche ;
- Perte réseau → reconnexion → autosave reprend → brouillon non publié toujours présent ;
- Escape alors qu'un popover de la Command Layer est ouvert et qu'une erreur apparaît simultanément ;
- **Timeout de résolution** : un signal attendu (succès/échec réseau) qui n'arrive jamais.

## Critère de recette

La machine d'état doit passer tous les tests de cette matrice **sans qu'aucun test ne touche au DOM** — condition nécessaire pour que « state before shape » soit une propriété vérifiée du code, pas seulement une intention de doctrine.
