-- 0004_studio_content — Studio Orogeny (Phase 2B), les six domaines
-- produit : Homepage, Le projet, Espaces, Actualités, Ambassadeurs,
-- Questions. Voir la conception validée (schéma + contrats PATCH).
--
-- Discipline d'isolation identique à tout le reste d'Orogeny :
-- tenant_id + project_id explicites, FK composite vers
-- projects(tenant_id, id), on delete cascade (ces tables sont
-- entièrement dépendantes du projet).
--
-- Aucune colonne status/published sur ces tables : elles ne portent
-- que le brouillon. Publier reste un geste séparé (futur pipeline
-- Candidate -> Compiler -> Manifest, Phase 2D), jamais mélangé ici.
--
-- Versionnement optimiste : chaque ressource "parent" porte
-- version/updated_at/updated_by_user_id. Les enfants directement
-- dépendants (blocs d'article, médias d'espace, médias de section
-- narrative) n'ont pas de version propre en Phase 2B — mutés
-- transactionnellement avec leur parent. CRDT-ready sans être
-- CRDT-dependent : la granularité fine viendra avec la collaboration
-- réelle (Phase 2C), pas anticipée ici au-delà de ce que ce
-- versionnement permet déjà.

-- ─────────────────────────────────────────────────────────────────
-- Isolation des assets renforcée : une FK composite (tenant_id,
-- project_id, xxx_asset_id) vers assets exige qu'assets expose une
-- contrainte unique sur ce triplet — même pattern déjà utilisé pour
-- projects(tenant_id, id). Sans ça, une FK simple vers assets(id)
-- permettrait théoriquement d'associer un asset d'un autre
-- tenant/projet à une ressource Studio.
-- ─────────────────────────────────────────────────────────────────
alter table assets add constraint assets_tenant_project_id_key unique (tenant_id, project_id, id);

-- kind s'enrichit des usages Studio réels — remplace la contrainte
-- posée en 0003 (qui n'autorisait que 'logo').
alter table assets drop constraint assets_kind_check;
alter table assets add constraint assets_kind_check
  check (kind in ('logo', 'article_image', 'team_photo', 'ambassador_photo', 'space_media', 'narrative_media'));

-- ─────────────────────────────────────────────────────────────────
-- Questions
-- ─────────────────────────────────────────────────────────────────
create table project_questions (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null,
  project_id          uuid not null,
  question            text not null,
  answer_runs         jsonb not null default '[]',  -- [{text, bold?, italic?, underline?, href?}]
  position            int not null,
  version             int not null default 1,
  updated_at          timestamptz not null default now(),
  updated_by_user_id  uuid references users(id),
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade
);
create index idx_project_questions_project on project_questions(project_id);

-- ─────────────────────────────────────────────────────────────────
-- Actualités
-- ─────────────────────────────────────────────────────────────────
create table project_articles (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null,
  project_id          uuid not null,
  tag                 text,
  publication_date    date,
  title               text not null,
  chapeau_runs        jsonb not null default '[]',
  position            int not null,
  version             int not null default 1,
  updated_at          timestamptz not null default now(),
  updated_by_user_id  uuid references users(id),
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade,
  unique (tenant_id, project_id, id)
);
create index idx_project_articles_project on project_articles(project_id);

-- Enfant direct de project_articles — pas de version propre, muté
-- transactionnellement dans le PATCH de l'article parent.
create table project_article_blocks (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  project_id        uuid not null,
  article_id        uuid not null,
  block_type        text not null check (block_type in ('paragraph', 'heading', 'image')),
  runs              jsonb,       -- pour paragraph/heading uniquement
  image_asset_id    uuid,        -- pour image uniquement
  position          int not null,
  foreign key (tenant_id, project_id, article_id) references project_articles(tenant_id, project_id, id) on delete cascade,
  foreign key (tenant_id, project_id, image_asset_id) references assets(tenant_id, project_id, id)
);
create index idx_project_article_blocks_article on project_article_blocks(article_id);

-- ─────────────────────────────────────────────────────────────────
-- Le projet — jalons, membres d'équipe, sections narratives
-- ─────────────────────────────────────────────────────────────────
create table project_milestones (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null,
  project_id          uuid not null,
  status              text check (status in ('done', 'current', 'future')),
  date_label          text,
  label               text,
  description         text,
  position            int not null,
  version             int not null default 1,
  updated_at          timestamptz not null default now(),
  updated_by_user_id  uuid references users(id),
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade
);
create index idx_project_milestones_project on project_milestones(project_id);

create table project_team_members (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null,
  project_id          uuid not null,
  name                text not null,
  title               text,
  badge               text,
  photo_asset_id      uuid,
  position            int not null,
  version             int not null default 1,
  updated_at          timestamptz not null default now(),
  updated_by_user_id  uuid references users(id),
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade,
  foreign key (tenant_id, project_id, photo_asset_id) references assets(tenant_id, project_id, id)
);
create index idx_project_team_members_project on project_team_members(project_id);

-- section_type 'team' référence project_team_members conceptuellement
-- (affichage narratif de l'équipe déjà éditée ci-dessus) — payload ne
-- duplique pas les données, voir contrat PATCH.
create table project_narrative_sections (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null,
  project_id          uuid not null,
  section_type        text not null check (section_type in
                        ('focus', 'keyFigures', 'text', 'image', 'gallery', 'timeline', 'quote', 'choices', 'team')),
  payload             jsonb not null default '{}',
  position            int not null,
  version             int not null default 1,
  updated_at          timestamptz not null default now(),
  updated_by_user_id  uuid references users(id),
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade,
  unique (tenant_id, project_id, id)
);
create index idx_project_narrative_sections_project on project_narrative_sections(project_id);

-- Enfant direct — utilisé seulement si section_type in ('image','gallery').
-- Pas de version propre, muté avec le parent.
create table project_narrative_section_media (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  project_id        uuid not null,
  section_id        uuid not null,
  asset_id          uuid not null,
  alt               text,
  position          int not null,
  foreign key (tenant_id, project_id, section_id) references project_narrative_sections(tenant_id, project_id, id) on delete cascade,
  foreign key (tenant_id, project_id, asset_id) references assets(tenant_id, project_id, id)
);
create index idx_project_narrative_section_media_section on project_narrative_section_media(section_id);

-- ─────────────────────────────────────────────────────────────────
-- Ambassadeurs
-- ─────────────────────────────────────────────────────────────────
create table project_ambassadors (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null,
  project_id          uuid not null,
  name                text not null,
  role                text,
  tag                 text,
  photo_asset_id      uuid,
  contactable         boolean not null default true,
  contact_channel     text,
  contact_value       text,
  position            int not null,
  version             int not null default 1,
  updated_at          timestamptz not null default now(),
  updated_by_user_id  uuid references users(id),
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade,
  foreign key (tenant_id, project_id, photo_asset_id) references assets(tenant_id, project_id, id)
);
create index idx_project_ambassadors_project on project_ambassadors(project_id);

-- ─────────────────────────────────────────────────────────────────
-- Espaces (basé sur le modèle spaces-content.js de Tectonic, plus
-- riche que le simple plans[] legacy — voir la conception validée)
-- ─────────────────────────────────────────────────────────────────
create table project_spaces (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null,
  project_id          uuid not null,
  name                text not null,
  location            text,
  description         text,
  status              text check (status in ('designing', 'approved', 'delivered')),
  usages              text[] not null default '{}',
  position            int not null,
  version             int not null default 1,
  updated_at          timestamptz not null default now(),
  updated_by_user_id  uuid references users(id),
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade,
  unique (tenant_id, project_id, id)
);
create index idx_project_spaces_project on project_spaces(project_id);

-- Enfant direct — pas de version propre, muté avec le parent.
create table project_space_media (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  project_id        uuid not null,
  space_id          uuid not null,
  kind              text not null check (kind in ('view', 'plan', 'document')),
  asset_id          uuid not null,
  label             text,
  alt               text,
  position          int not null,
  foreign key (tenant_id, project_id, space_id) references project_spaces(tenant_id, project_id, id) on delete cascade,
  foreign key (tenant_id, project_id, asset_id) references assets(tenant_id, project_id, id)
);
create index idx_project_space_media_space on project_space_media(space_id);

-- ─────────────────────────────────────────────────────────────────
-- Homepage + textes d'intro/CTA des autres domaines — une seule
-- petite table partagée. Clé logique complète (tenant_id explicite,
-- jamais implicite même si les UUID projet sont globalement uniques).
-- Homepage : fields = {message, askPrompt} UNIQUEMENT. Actualité mise
-- en avant / jalon courant restent dérivés des autres domaines,
-- jamais dupliqués ici.
-- ─────────────────────────────────────────────────────────────────
create table project_section_content (
  tenant_id           uuid not null,
  project_id          uuid not null,
  section_key         text not null check (section_key in
                        ('homepage', 'questions', 'actualites', 'ambassadeurs', 'le_projet', 'espaces')),
  fields              jsonb not null default '{}',
  version             int not null default 1,
  updated_at          timestamptz not null default now(),
  updated_by_user_id  uuid references users(id),
  primary key (tenant_id, project_id, section_key),
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade
);
