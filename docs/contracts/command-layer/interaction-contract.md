Status: Draft
Generation: Orogeny

# Command Layer — contrat d'interaction

## Focus et clavier

Une transformation de la Command Layer ne doit jamais :

- voler le focus ;
- supprimer brutalement l'élément actuellement focusé ;
- renvoyer le focus au body ;
- rendre une commande inaccessible au clavier.

**Tant que le focus clavier appartient à la Command Layer, sa géométrie est gelée.** L'état interne peut évoluer (une région live peut annoncer « Tout est enregistré »), mais la barre attend que le focus la quitte avant de changer spatialement de forme.

Si une forme disparaît alors qu'un contrôle qu'elle contient est focusé, une stratégie explicite de restitution du focus est nécessaire.

## Reduced motion

En `prefers-reduced-motion: reduce`, la Command Layer **ne change pas de position**. Elle garde une ancre spatiale stable (par exemple une capsule fixe en haut) et son contenu change, pas sa localisation. Navigation → statut → Publier restent au même endroit.

Ne pas se contenter de retirer l'animation en gardant la même téléportation spatiale — une téléportation instantanée peut être cognitivement pire qu'une transition douce.

## Mobile et desktop

La même logique produit doit exister sur les deux (navigation → retrait → état/action contextuel → retour), mais dimensions, seuils, mouvement et placement peuvent être spécifiques au tactile. Ne pas appliquer mécaniquement le comportement desktop au mobile.

## Continuité perceptive

Conserver autant que possible entre les formes : matériau, rayon, épaisseur de bordure, langage typographique, courbes de mouvement, comportement général. Le cerveau doit comprendre « Storm s'est recomposé », pas « un nouveau bouton vient de popper ».
