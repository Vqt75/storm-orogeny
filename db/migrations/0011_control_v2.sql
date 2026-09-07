-- 0011_control_v2 — Storm Control V2 (lifecycle, grants, groupes externes).
-- Voir handoff storm_control_orogeny_v2_handoff_v4.html et le modèle
-- conceptuel Membership/Grant/Bundle validé en amont (aucune migration
-- n'avait encore été faite pour ce modèle -- c'est ici la première).
--
-- Politique de suppression : CASCADE depuis project_memberships/
-- tenant_memberships pour les grants (un grant n'a aucun sens sans sa
-- membership), RESTRICT pour actor_user_id (jamais perdre la trace de
-- qui a accordé un accès en supprimant l'utilisateur -- même doctrine
-- que 0001 pour users).

-- ── Lifecycle projet ────────────────────────────────────────────────
-- 'stabilization' ajouté. previous_status mémorise le dernier état
-- métier avant archivage, pour une restauration fidèle (jamais
-- systématiquement vers 'active') -- décision explicite : une colonne
-- dédiée plutôt qu'une dépendance à l'historique ci-dessous, parce que
-- le besoin réel est "un seul pas en arrière", jamais une pile
-- profonde. L'historique complet (project_lifecycle_events) répond
-- séparément au besoin d'audit, jamais confondu avec ce mécanisme.
alter table projects drop constraint projects_status_check;
alter table projects add constraint projects_status_check
  check (status in ('active', 'stabilization', 'archived'));
alter table projects add column previous_status text
  check (previous_status in ('active', 'stabilization'));

-- Historique des transitions de lifecycle -- append-only, jamais
-- modifié après écriture. Répond au besoin d'audit trail validé
-- séparément de previous_status ci-dessus.
create table project_lifecycle_events (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  project_id        uuid not null,
  from_status       text,
  to_status         text not null,
  actor_user_id     uuid references users(id) on delete restrict,
  created_at        timestamptz not null default now(),
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade
);
create index idx_project_lifecycle_events_project on project_lifecycle_events(project_id);

-- ── Grants — raison indépendante d'un accès, jamais confondue avec la
-- membership elle-même (voir modèle conceptuel validé). Plusieurs
-- grants actifs peuvent coexister sur une même membership ; les
-- permissions effectives sont l'union des bundles des grants actifs,
-- jamais un raisonnement "rôle le plus élevé". ────────────────────────

create table project_grants (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null,
  project_id            uuid not null,
  project_membership_id uuid not null references project_memberships(id) on delete cascade,
  permission_bundle     text not null
                          check (permission_bundle in ('contributor', 'editor', 'pilot', 'project_admin')),
  source_type           text not null
                          check (source_type in ('direct', 'external_group_mapping', 'migrated')),
  -- Renseignés uniquement si source_type='external_group_mapping' --
  -- jamais un faux utilisateur "Storm System" comme acteur (décision
  -- explicite du modèle conceptuel validé).
  external_provider     text,
  external_group_id     text,
  mapping_id            uuid,
  actor_user_id         uuid references users(id) on delete restrict,
  created_at            timestamptz not null default now(),
  revoked_at            timestamptz,
  status                text not null default 'active'
                          check (status in ('active', 'revoked')),
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade
);
create index idx_project_grants_membership on project_grants(project_membership_id, status);

create table organization_grants (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null,
  organization_membership_id uuid not null references tenant_memberships(id) on delete cascade,
  permission_bundle         text not null
                              check (permission_bundle in ('member', 'organization_admin')),
  source_type               text not null
                              check (source_type in ('direct', 'external_group_mapping', 'migrated')),
  external_provider         text,
  external_group_id         text,
  mapping_id                uuid,
  actor_user_id             uuid references users(id) on delete restrict,
  created_at                timestamptz not null default now(),
  revoked_at                timestamptz,
  status                    text not null default 'active'
                              check (status in ('active', 'revoked'))
);
create index idx_organization_grants_membership on organization_grants(organization_membership_id, status);

-- ── Mappings groupe externe → bundle Storm — configuration, jamais une
-- identité. En V0, un mapping donne un bundle, jamais un ensemble de
-- capabilities arbitraire (décision explicite validée). ─────────────
create table external_group_mappings (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  provider          text not null,
  external_group_id text not null,
  target_type       text not null check (target_type in ('organization', 'project')),
  target_id         uuid not null,
  permission_bundle text not null,
  created_at        timestamptz not null default now()
);
create index idx_external_group_mappings_tenant on external_group_mappings(tenant_id, external_group_id);

-- project_grants.mapping_id référence external_group_mappings, créée
-- après -- Postgres exige la table cible existante pour le FK.
alter table project_grants add constraint project_grants_mapping_id_fkey
  foreign key (mapping_id) references external_group_mappings(id) on delete set null;
alter table organization_grants add constraint organization_grants_mapping_id_fkey
  foreign key (mapping_id) references external_group_mappings(id) on delete set null;

-- ── Invitations — cycle de vie complet (accepted_at + 'expired'),
-- jamais confondu avec le grant qu'une acceptation produit. ─────────
alter table project_invitations drop constraint project_invitations_status_check;
alter table project_invitations add constraint project_invitations_status_check
  check (status in ('pending', 'accepted', 'revoked', 'expired'));
alter table project_invitations add column accepted_at timestamptz;

-- ── Rétro-peuplement — un grant miroir par membership existante,
-- jamais un changement de comportement observable à ce stade (le
-- calcul de permissions effectives, câblé séparément dans le code,
-- retombe exactement sur le même bundle qu'aujourd'hui). ─────────────
insert into project_grants (tenant_id, project_id, project_membership_id, permission_bundle, source_type, actor_user_id, created_at)
select tenant_id, project_id, id, permission_bundle, 'migrated', null, created_at
from project_memberships;

insert into organization_grants (tenant_id, organization_membership_id, permission_bundle, source_type, actor_user_id, created_at)
select tenant_id, id, permission_bundle, 'migrated', null, created_at
from tenant_memberships;
