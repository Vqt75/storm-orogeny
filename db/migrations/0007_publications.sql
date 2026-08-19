-- 0007_publications — infrastructure Phase 2D (Slice 0).
--
-- Une ligne = une tentative de publication, jamais recalculée après
-- coup. snapshot/candidate/manifest conservés en jsonb (V1, décision
-- explicite) : ce sont des artefacts compilés, pas une base métier à
-- éclater en tables relationnelles. Permet de distinguer précisément
-- "Snapshot correct / Candidate incorrect / Manifest incorrect"
-- pendant le diagnostic, sans reconstruire quoi que ce soit après coup.
--
-- revision : entier séquentiel PAR PROJET (identité humaine — "Publication
-- n°7"), distinct de id (UUID, identité technique). Une tentative
-- échouée conserve sa révision — la suite failed/active reste lisible
-- ("Publication 14 : failed, Publication 15 : active"), jamais un trou
-- silencieux qui donnerait l'illusion que rien ne s'est passé entre les
-- deux.
--
-- status : compiling -> ready -> active, ou compiling -> failed.
-- Une seule publication 'active' par projet, garantie par l'index
-- unique partiel ci-dessous — pas seulement une convention applicative.
create table project_publications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  project_id uuid not null,
  revision integer not null,
  status text not null default 'compiling',
  snapshot jsonb,
  candidate jsonb,
  manifest jsonb,
  compiler_version text,
  failure_code text,
  failure_detail text,
  created_by_user_id uuid not null references users(id),
  created_at timestamptz not null default now(),
  compiled_at timestamptz,
  activated_at timestamptz,
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade,
  unique (tenant_id, project_id, revision),
  check (status in ('compiling', 'failed', 'ready', 'active', 'superseded'))
);

create index idx_project_publications_project_id on project_publications(project_id);

-- Une seule publication active par projet — invariant garanti par la
-- DB, jamais seulement par la discipline applicative du basculement
-- atomique (qui reste malgré tout la voie normale d'y arriver).
create unique index idx_project_publications_one_active_per_project
  on project_publications(project_id)
  where status = 'active';
