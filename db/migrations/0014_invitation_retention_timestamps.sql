-- 0014_invitation_retention_timestamps — Privacy & Data Lifecycle V1,
-- Batch 2. Timestamps manquants découverts par audit réel avant toute
-- écriture (jamais supposés) : project_invitations ne portait
-- jusqu'ici que created_at et accepted_at -- AUCUNE colonne
-- revoked_at n'existait (revokeProjectInvitation se contentait de
-- positionner status='revoked' sans jamais enregistrer quand),
-- et aucune colonne n'enregistre le moment réel du passage à
-- 'expired' (statut déjà accepté par le CHECK depuis la migration
-- 0011, mais jamais encore produit par aucun code).
--
-- Sans ces deux colonnes, la politique de rétention "12 mois après le
-- passage réel dans l'état terminal" n'aurait aucune base
-- sémantiquement correcte pour les invitations révoquées ou expirées
-- -- jamais détourné created_at/accepted_at comme substitut, cela
-- aurait produit une durée de conservation fausse (ex. une invitation
-- restée pending 8 mois puis révoquée aurait semblé conservée depuis
-- sa création, pas depuis sa révocation réelle).

alter table project_invitations add column revoked_at timestamptz;
alter table project_invitations add column expired_at timestamptz;

-- ── Backfill des lignes terminales préexistantes ────────────────────
-- Le schéma historique (migration 0002) autorisait déjà
-- status in ('pending','accepted','revoked') AVANT même que ces deux
-- colonnes n'existent -- toute ligne 'revoked' créée avant CETTE
-- migration porte donc nécessairement revoked_at=NULL (et de même pour
-- 'expired', accepté par le CHECK depuis la migration 0011). Sans
-- backfill, ces lignes ne satisferaient JAMAIS la future purge à 12
-- mois (une comparaison contre NULL n'est jamais vraie).
--
-- Doctrine retenue, volontairement conservatrice : nous ne connaissons
-- pas la vraie date de passage terminal de ces lignes historiques --
-- jamais reconstruite depuis created_at (une invitation restée
-- pending 8 mois avant sa révocation réelle rendrait cette
-- reconstruction fausse). Le seul choix honnête est de faire repartir
-- la fenêtre de rétention de 12 mois à partir de CETTE migration --
-- jamais une suppression anticipée sur une date inventée.
--
-- Idempotent et sûr par construction : la clause "IS NULL" garantit
-- de ne jamais écraser un timestamp déjà présent, ne touche jamais
-- created_at/accepted_at/status, et ne concerne que les lignes dont
-- le statut correspond exactement.
update project_invitations
  set revoked_at = now()
  where status = 'revoked' and revoked_at is null;

update project_invitations
  set expired_at = now()
  where status = 'expired' and expired_at is null;

-- ── accepted_at : aucun backfill nécessaire, confirmé par archéologie
-- Git, jamais supposé ────────────────────────────────────────────────
-- Vérifié explicitement (git log -S sur 'accepted' dans le code
-- applicatif et les migrations) : accepted_at et la toute première
-- transition de code vers status='accepted' (acceptProjectInvitation)
-- ont été introduits dans LE MÊME commit (migration 0011, Control V2)
-- -- aucun chemin de code applicatif n'a jamais pu créer une ligne
-- 'accepted' sans accepted_at à aucun moment de l'histoire de ce repo.
-- Le CHECK constraint autorisait bien 'accepted' depuis 0002, mais
-- aucune fonction ne l'a jamais produit avant que accepted_at
-- n'existe simultanément. Aucun backfill ajouté ici en conséquence --
-- voir le rapport de checkpoint pour la limite exacte de cette
-- confirmation (portée à ce que l'historique Git de ce repo permet de
-- vérifier, jamais une insertion SQL manuelle hors du code applicatif).
