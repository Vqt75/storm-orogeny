-- 0002_project_setup — Project Setup (Phase 1B).
-- Voir docs/contracts/locales.md et docs/adr/0002-project-experience-addressing.md.
--
-- Isolation tenant garantie en base sur TOUTES les nouvelles tables,
-- même discipline qu'en 0001 : chaque table porte tenant_id +
-- project_id, avec foreign key (tenant_id, project_id) référençant
-- projects(tenant_id, id) — une configuration ne peut physiquement
-- pas se raccrocher au projet d'un autre tenant.
--
-- Politique de suppression : CASCADE depuis projects. Ces tables sont
-- entièrement dépendantes du projet (identité, réglages, modules,
-- invitations n'ont aucun sens sans lui) — contrairement à
-- tenant_memberships/users en 0001, qui restent en RESTRICT.

-- Source unique des locales supportées, référencée par FK plutôt que
-- par un CHECK dupliqué sur chaque table qui en a besoin.
create table supported_locales (
  code  text primary key
);
insert into supported_locales (code) values ('fr'),('en'),('it'),('es'),('nl'),('de');

-- Identité visuelle du projet — logo, couleurs, typographies, thème.
-- Jamais la langue : voir project_settings ci-dessous (docs/contracts/locales.md,
-- correction explicite : ce ne sont pas des attributs d'identité visuelle).
create table project_identity (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  project_id        uuid not null unique,
  logo_asset_id     uuid,
  primary_color     text,
  secondary_color   text,
  font_primary      text,
  font_secondary    text,
  theme             text not null default 'ivory'
                      check (theme in ('ivory', 'rainbow', 'midnight')),
  created_at        timestamptz not null default now(),
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade
);

-- Réglages de langue du projet — workspaceLocale (travail) et
-- contentLocale (communications collaborateurs), jamais dépendants
-- l'un de l'autre (docs/contracts/locales.md).
create table project_settings (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  project_id        uuid not null unique,
  workspace_locale  text not null references supported_locales(code),
  content_locale    text not null references supported_locales(code),
  created_at        timestamptz not null default now(),
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade
);

-- Modules activables — une ligne par module, pas des colonnes
-- booléennes rigides.
create table project_modules (
  tenant_id   uuid not null,
  project_id  uuid not null,
  module_key  text not null
                check (module_key in ('faq', 'actu', 'jalons', 'plans', 'ambassadeurs', 'equipe')),
  enabled     boolean not null default true,
  primary key (project_id, module_key),
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade
);

-- Invitations enregistrées à la création du projet (scène "Access" du
-- Setup) — status=pending uniquement dans ce lot. L'envoi de mail, le
-- token et l'activation de compte appartiennent à une phase ultérieure
-- (Invitation / Account Activation), voir docs/contracts/locales.md.
create table project_invitations (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null,
  project_id          uuid not null,
  email               text not null,
  permission_bundle   text not null
                        check (permission_bundle in ('contributor', 'editor', 'pilot', 'project_admin')),
  locale              text not null references supported_locales(code),
  status              text not null default 'pending'
                        check (status in ('pending', 'accepted', 'revoked')),
  invited_by_user_id  uuid not null references users(id) on delete restrict,
  created_at          timestamptz not null default now(),
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade
);

create index idx_project_invitations_project on project_invitations(project_id);
create index idx_project_invitations_email on project_invitations(email);
create index idx_project_modules_project on project_modules(project_id);
