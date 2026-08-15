Status: Draft
Generation: Orogeny

# Collaboration — Permission Contract

## Principe

« Connecté à une session collaborative » ≠ « autorisé à écrire ». Ces deux états doivent être vérifiables séparément côté serveur, jamais confondus.

```
canView
canEdit
canPublish
canManageAccess
```

Jamais un simple `hasSocket = true` faisant office d'autorisation implicite.

## À la connexion WebSocket

Le socle technique (Hocuspocus ou équivalent retenu) doit permettre :

- une connexion en lecture seule via un hook d'authentification à la connexion ;
- une réévaluation des permissions en cours de session (token de session synchronisé), pas seulement à l'établissement de la connexion.

## Ce qui reste à trancher

- Mécanisme exact de réévaluation en cours de session (durée de validité du token, fréquence de vérification) ;
- Comportement exact quand une permission est révoquée pendant une session active (déconnexion immédiate vs passage en lecture seule).
