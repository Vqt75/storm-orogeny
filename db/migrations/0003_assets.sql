-- 0003_assets — micro-lot storage (Lot 3A), avant branchement de la
-- scène logo du Project Setup (Lot 3B). Voir docs/adr/0003-storage-adapter.md.
--
-- Même discipline d'isolation qu'ailleurs : tenant_id + project_id,
-- foreign key composite vers projects(tenant_id, id).

create table assets (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  project_id    uuid not null,
  kind          text not null check (kind in ('logo')),
  storage_key   text not null,
  content_type  text not null,
  byte_size     integer not null check (byte_size > 0),
  created_at    timestamptz not null default now(),
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade
);

create index idx_assets_project on assets(project_id);

-- logo_asset_id existait déjà (nullable, sans contrainte) depuis 0002 —
-- la table qu'il référence n'existait pas encore à ce moment.
alter table project_identity
  add constraint project_identity_logo_asset_id_fkey
  foreign key (logo_asset_id) references assets(id) on delete set null;
