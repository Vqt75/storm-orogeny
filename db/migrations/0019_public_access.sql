-- Lot B -- Public Access & Publication Security : identité d'accès
-- public dédiée, rotatable, à haute entropie -- remplace l'UUID projet
-- comme identifiant public.
--
-- Isolation tenant imposée par PostgreSQL (FK composite), même motif
-- que clients/projects (migration 0018). Les lignes révoquées
-- s'accumulent comme historique -- jamais supprimées.

create table project_public_access (
  id                              uuid primary key default gen_random_uuid(),
  tenant_id                       uuid not null references tenants(id) on delete restrict,
  project_id                      uuid not null,
  client_slug                     text not null,
  project_slug                    text not null,
  capability_hash                 text not null,
  capability_encrypted            text not null,
  status                          text not null default 'active'
                                     check (status in ('active', 'unpublished', 'revoked')),
  supersedes_access_id            uuid references project_public_access(id),
  created_reason                  text not null
                                     check (created_reason in (
                                       'first_publication', 'manual_rotation',
                                       'client_renamed', 'project_renamed', 'client_reassigned'
                                     )),
  redistribution_acknowledged_at  timestamptz,
  redistribution_acknowledged_by  uuid references users(id),
  created_at                      timestamptz not null default now(),
  revoked_at                      timestamptz,
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete restrict,
  unique (capability_hash)
);

-- Un seul accès public COURANT (non révoqué) par projet à un instant
-- donné -- imposé par PostgreSQL, pas seulement par discipline
-- applicative. Les lignes 'revoked' peuvent s'accumuler librement.
create unique index idx_public_access_one_current_per_project
  on project_public_access (project_id)
  where status <> 'revoked';

create index idx_public_access_project on project_public_access (project_id);
