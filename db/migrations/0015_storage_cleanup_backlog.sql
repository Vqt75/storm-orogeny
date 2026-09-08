-- 0015_storage_cleanup_backlog — Privacy & Data Lifecycle V1, Batch 5
-- (dernière fermeture). PostgreSQL et le storage ne partagent jamais
-- la même transaction -- storage.save() peut réussir puis insertAsset()
-- ou le COMMIT lui-même échouer, laissant un objet physique sans
-- ligne assets correspondante. Le verrou sur projects (voir
-- withProjectDeletionGuard) sérialise correctement les races DB-vs-DB,
-- mais ne protège jamais contre cette classe de défaillance DB-vs-
-- filesystem -- confirmé par audit, jamais déduit du seul verrou.
--
-- Contrat : après un storage.save() réussi suivi d'un échec de la
-- mutation DB, une compensation storage.delete() immédiate est
-- tentée. Si CETTE compensation échoue à son tour, la storage key ne
-- doit jamais rester connue seulement d'un log/exception/commentaire
-- -- elle est enregistrée ici, durablement, retrouvable et retraitable
-- plus tard (le sweeper de retraitement lui-même reste un chantier
-- ultérieur, hors scope de cette fermeture).
--
-- reason décrit la cause D'ORIGINE de l'échec DB ('insert_failed' ou
-- 'commit_failed') -- jamais "compensation_delete_failed" comme
-- valeur distincte : la seule EXISTENCE d'une ligne dans cette table
-- atteste déjà que la compensation a échoué, un troisième état
-- redondant n'apporterait rien.
--
-- Aucune donnée sensible : storage_key est un identifiant technique
-- opaque (UUID généré serveur, jamais un chemin ni un nom réel),
-- reason reste un code stable, jamais un message d'erreur brut/une
-- stack trace qui pourrait fuiter un détail interne inattendu.
create table storage_cleanup_backlog (
  id           uuid primary key default gen_random_uuid(),
  storage_key  text not null,
  reason       text not null
                 check (reason in ('insert_failed', 'commit_failed')),
  created_at   timestamptz not null default now(),
  cleaned_at   timestamptz
);

-- Seul schéma d'accès certain dès ce batch : lister les entrées encore
-- à traiter, par ancienneté -- même convention que les autres tables
-- de rétention/nettoyage déjà posées (aucun index spéculatif au-delà).
create index idx_storage_cleanup_backlog_pending on storage_cleanup_backlog(created_at) where cleaned_at is null;
