-- Lot A -- Public Access & Publication Security rail : introduction de
-- Client comme entité de première classe, distincte de l'Organisation
-- (tenant) et du Projet.
--
-- Isolation tenant imposée par PostgreSQL lui-même, jamais seulement
-- par validation applicative : unique(tenant_id, id) sur clients rend
-- possible la FK composite (tenant_id, client_id) -> clients(tenant_id, id)
-- sur projects -- un projet d'un tenant ne peut référencer un client
-- d'un autre tenant, même si la validation applicative échoue.
--
-- client_id reste NULLABLE dans cette migration : aucun Client
-- synthétique "Non attribué" n'est créé, aucune inférence depuis le
-- nom de projet. Le backfill réel des projets existants est explicite
-- (voir seed.js / rapport de cette passe) -- la contrainte NOT NULL
-- ne pourra être ajoutée que dans une migration ultérieure, une fois
-- prouvé que 100% des projets persistés ont un client_id réel.

create table clients (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete restrict,
  name             text not null,
  normalized_slug  text not null,
  version          integer not null default 1,
  created_at       timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, normalized_slug)
);

alter table projects add column client_id uuid;
alter table projects add constraint projects_client_tenant_fk
  foreign key (tenant_id, client_id) references clients(tenant_id, id) on delete restrict;

-- Verrouillage optimiste du renommage de Projet -- même motif déjà
-- éprouvé sur project_identity.version (updateProjectIdentityColors).
-- Aucune route de renommage de projet n'existait avant cette passe
-- (confirmé par l'audit) -- cette colonne est introduite avec elle.
alter table projects add column version integer not null default 1;
