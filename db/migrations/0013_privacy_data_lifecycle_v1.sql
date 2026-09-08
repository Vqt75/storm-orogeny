-- 0013_privacy_data_lifecycle_v1 — Privacy & Data Lifecycle V1, Batch 1
-- (fondations de schéma uniquement). Voir l'audit et le Product
-- Arbitration Addendum validés en amont.
--
-- Ce batch ne change AUCUN comportement runtime : aucun retention
-- runner, aucune désactivation/anonymisation exécutée, aucune
-- suppression de projet exécutée, aucun storage delete. Uniquement
-- les tables et contraintes nécessaires pour que les batches
-- ultérieurs puissent construire dessus.
--
-- Audit préalable confirmé (jamais deviné) : project_invitations.status
-- porte DÉJÀ 'expired' depuis la migration 0011 (Control V2) --
-- confirmé par lecture directe de pg_constraint avant d'écrire quoi
-- que ce soit ici. Aucune modification nécessaire sur cette table
-- dans ce batch.

-- ── Lifecycle utilisateur ────────────────────────────────────────────
-- Trois états, jamais un automate SQL complexe -- le lifecycle métier
-- (qui peut transitionner vers quoi) reste entièrement dans le
-- service domaine d'un batch ultérieur. Les deux CHECK ci-dessous
-- restent volontairement simples : ils protègent uniquement contre un
-- bug qui positionnerait un statut sans jamais enregistrer le
-- timestamp correspondant -- jamais une validation de transition.
alter table users add column status text not null default 'active'
  check (status in ('active', 'deactivated', 'anonymized'));
alter table users add column deactivated_at timestamptz;
alter table users add column anonymized_at timestamptz;

alter table users add constraint users_deactivated_at_consistency
  check (status = 'active' or deactivated_at is not null);
alter table users add constraint users_anonymized_at_consistency
  check (status != 'anonymized' or anonymized_at is not null);

-- email/display_name volontairement INTACTS dans ce batch -- le
-- tombstone anonymisé (valeur synthétique, jamais dérivée de
-- l'original) est une opération applicative d'un batch ultérieur,
-- jamais une contrainte de schéma à anticiper ici.

-- ── Audit minimal ────────────────────────────────────────────────────
-- Aucun contenu, email, secret, token, claim IdP ou requête Liquid
-- Core brute -- jamais un JSON blob générique "au cas où". actor_user_id
-- en ON DELETE SET NULL (jamais RESTRICT/CASCADE) : les users ne sont
-- aujourd'hui jamais supprimés physiquement (tombstone anonymisé),
-- mais cette politique ne doit jamais bloquer une future évolution en
-- ce sens -- un événement d'audit doit survivre même si son acteur
-- disparaissait un jour. project_id et tenant_id restent des UUID
-- informatifs SANS foreign key vers projects/tenants : un événement de
-- suppression de projet doit survivre à la suppression physique du
-- projet lui-même (CASCADE romprait cette survie ; SET NULL perdrait
-- précisément l'identifiant de cible au moment où il compte le plus).
create table audit_events (
  id            uuid primary key default gen_random_uuid(),
  occurred_at   timestamptz not null default now(),
  actor_user_id uuid references users(id) on delete set null,
  event_type    text not null,
  target_type   text not null,
  target_id     uuid,
  tenant_id     uuid,
  project_id    uuid
);

-- Seul index ajouté : la rétention (purge par ancienneté) est le
-- schéma d'accès principal et certain de cette table dès ce batch --
-- lookup par acteur/cible resterait spéculatif tant qu'aucune UI
-- d'investigation n'existe (explicitement différée).
create index idx_audit_events_occurred_at on audit_events(occurred_at);

-- ── Suppression définitive de projet -- job + manifeste ─────────────
-- CRITIQUE : le job et son manifeste doivent survivre à la suppression
-- physique du projet lui-même -- jamais une FK CASCADE (ni RESTRICT,
-- qui bloquerait la suppression) de project_deletion_jobs.project_id
-- vers projects. project_id reste un UUID snapshot stable, informatif
-- uniquement. tenant_id, à l'inverse, référence réellement
-- tenants(id) : un tenant n'est aujourd'hui jamais supprimé
-- physiquement (ON DELETE RESTRICT déjà partout ailleurs dans le
-- schéma) -- cette FK ne met donc jamais en danger la survie du job,
-- contrairement à project_id.
create table project_deletion_jobs (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references tenants(id) on delete restrict,
  project_id             uuid not null,
  requested_at           timestamptz not null default now(),
  requested_by_user_id   uuid references users(id) on delete set null,
  purge_after            timestamptz not null,
  cancelled_at           timestamptz,
  storage_purge_state    text not null default 'pending'
                           check (storage_purge_state in ('pending', 'in_progress', 'completed', 'failed')),
  db_purge_completed_at  timestamptz
);

-- Un seul job actif à la fois par projet -- jamais deux suppressions
-- concurrentes. Partielle : n'empêche jamais l'historique (un job déjà
-- annulé ou déjà terminé ne bloque jamais une nouvelle demande future
-- pour le même projet).
create unique index idx_project_deletion_jobs_one_active_per_project
  on project_deletion_jobs(project_id)
  where cancelled_at is null and db_purge_completed_at is null;

-- Manifeste des objets physiques à purger, capturé au moment de la
-- demande (jamais reconstitué plus tard, une fois les lignes assets
-- potentiellement disparues). CASCADE depuis le job lui-même est
-- acceptable ici (jamais depuis projects) -- si le job disparaissait,
-- son manifeste n'aurait plus de sens propre. UNIQUE(job_id,
-- storage_key) rend la capture du manifeste idempotente : un même
-- objet ne peut jamais être dupliqué dans un même job.
create table project_deletion_job_objects (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references project_deletion_jobs(id) on delete cascade,
  storage_key text not null,
  purged_at   timestamptz,
  unique (job_id, storage_key)
);
