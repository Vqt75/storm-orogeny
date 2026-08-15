-- 0001_core_domain — Tenant, User, Membership, Project (Phase 0).
-- Voir docs/contracts/schema-and-migrations.md et docs/adr/0001-*.md.
--
-- Politique de suppression, choisie relation par relation (jamais
-- CASCADE partout par commodité — voir la correction explicite reçue
-- avant cette migration) :
--   - tenants / users : aucune suppression dure ordinaire attendue en
--     Phase 0. Les tables qui les référencent utilisent RESTRICT : une
--     suppression de tenant ou d'utilisateur échoue tant que des
--     memberships existent encore, forçant une opération administrative
--     explicite plutôt qu'une cascade silencieuse.
--   - project_memberships : table purement relationnelle. CASCADE
--     légitime ici, car sa seule raison d'exister est la ligne parente
--     (projet, tenant_membership) — et cette ligne parente est
--     elle-même protégée par RESTRICT en amont, donc ce CASCADE ne
--     se déclenche qu'après une décision déjà explicite.

create table tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  status      text not null default 'active'
                check (status in ('active', 'suspended')),
  created_at  timestamptz not null default now()
);

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  display_name  text not null,
  created_at    timestamptz not null default now()
);

-- Appartenance à l'organisation (Storm Control) — distincte de
-- l'accès à un projet précis (project_memberships, plus bas).
create table tenant_memberships (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete restrict,
  user_id           uuid not null references users(id) on delete restrict,
  permission_bundle text not null
                      check (permission_bundle in ('member', 'organization_admin')),
  status            text not null default 'active'
                      check (status in ('active', 'suspended')),
  created_at        timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table projects (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete restrict,
  name        text not null,
  status      text not null default 'active'
                check (status in ('active', 'archived')),
  created_at  timestamptz not null default now(),
  -- Clé composite cible des foreign keys de project_memberships
  -- ci-dessous — c'est ce qui rend une membership cross-tenant
  -- impossible au niveau PostgreSQL, pas seulement applicatif.
  unique (tenant_id, id)
);

-- L'appartenance au tenant ne donne jamais automatiquement accès à un
-- projet (voir docs/contracts/permissions.md). Cette table porte
-- l'accès réel, projet par projet.
create table project_memberships (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  project_id        uuid not null,
  user_id           uuid not null,
  permission_bundle text not null
                      check (permission_bundle in ('contributor', 'editor', 'pilot', 'project_admin')),
  status            text not null default 'active'
                      check (status in ('active', 'suspended')),
  created_at        timestamptz not null default now(),
  unique (project_id, user_id),
  -- Isolation tenant garantie par PostgreSQL : une project_membership
  -- ne peut référencer qu'un projet et un tenant_membership qui
  -- partagent le même tenant_id — un bug applicatif ne peut pas créer
  -- de membership cross-tenant, la contrainte l'en empêche.
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade,
  foreign key (tenant_id, user_id) references tenant_memberships(tenant_id, user_id) on delete cascade
);

create index idx_tenant_memberships_user on tenant_memberships(user_id);
create index idx_projects_tenant on projects(tenant_id);
create index idx_project_memberships_user on project_memberships(user_id);
create index idx_project_memberships_tenant on project_memberships(tenant_id);
