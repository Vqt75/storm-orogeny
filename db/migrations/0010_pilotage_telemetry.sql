-- Storm Pilotage — télémétrie et agrégats.
-- Architecture verrouillée : "Storm mesure le changement, pas les
-- collaborateurs." Séparation stricte entre données brutes pseudonymes
-- à courte durée de vie (telemetry_events) et agrégats durables sans
-- aucun identifiant individuel (daily_*_agg).

-- Table brute — rôle strictement transitoire. Jamais lue directement
-- par les routes de lecture Pilotage (voir GET /api/projects/:id/
-- pilotage, qui ne lit QUE les tables d'agrégats). Purgée au-delà de
-- 40 jours glissants (voir purge applicative, aucune infrastructure
-- cron supposée — agrégation à l'écriture, purge opportuniste).
create table telemetry_events (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  project_id        uuid not null,
  event_type        text not null check (event_type in ('page_view', 'match_result', 'mood_feedback')),
  visitor_ref       uuid,
  session_ref       uuid,
  path              text,
  outcome           text check (outcome in ('matched', 'disambiguated', 'abstained')),
  matched_entry_id  uuid,
  confidence_bucket text check (confidence_bucket in ('high', 'medium', 'low')),
  mood_value        smallint check (mood_value between 1 and 5),
  occurred_at       timestamptz not null default now(),
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade
);

-- Index nécessaire à la détermination de session côté serveur (30 min
-- d'inactivité / 4h de durée absolue) : recherche du dernier événement
-- connu pour un visitor_ref donné, sur un projet donné.
create index idx_telemetry_events_visitor on telemetry_events(project_id, visitor_ref, occurred_at desc);
-- Index nécessaire à la purge (suppression par ancienneté) et au
-- calcul exact "visiteurs uniques sur une période" (borné à la
-- fenêtre de rétention brute, jamais déduit d'un agrégat journalier —
-- voir doctrine KPI verrouillée).
create index idx_telemetry_events_occurred_at on telemetry_events(project_id, occurred_at);

-- Agrégats durables — jamais de colonne visitor_ref/session_ref/texte
-- libre. "unique_visitors" ici est un comptage PAR JOUR (pseudonymes
-- actifs ce jour précis) : valide en soi pour un graphique journalier,
-- jamais sommé entre jours pour prétendre un total de période (ce
-- calcul se fait exclusivement sur telemetry_events, borné à sa
-- fenêtre de rétention).
create table daily_usage_agg (
  tenant_id         uuid not null,
  project_id        uuid not null,
  day               date not null,
  unique_visitors   int not null default 0,
  sessions          int not null default 0,
  returning_sessions int not null default 0,
  page_views        int not null default 0,
  primary key (tenant_id, project_id, day),
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade
);

create table daily_content_agg (
  tenant_id  uuid not null,
  project_id uuid not null,
  day        date not null,
  path       text not null,
  page_views int not null default 0,
  primary key (tenant_id, project_id, day, path),
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade
);

-- daily_match_agg : matched_entry_id/confidence_bucket doivent rester
-- NULLABLES (un outcome 'abstained' n'a ni l'un ni l'autre) -- les
-- inclure dans une clé primaire composite les rendrait implicitement
-- NOT NULL en PostgreSQL (bug trouvé et corrigé pendant
-- l'implémentation, avant tout commit). Clé de substitution + index
-- unique avec COALESCE : les valeurs stockées restent de vrais NULL,
-- seule la résolution de conflit (ON CONFLICT) traite NULL comme une
-- valeur stable pour l'agrégation.
create table daily_match_agg (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  project_id        uuid not null,
  day               date not null,
  outcome           text not null check (outcome in ('matched', 'disambiguated', 'abstained')),
  matched_entry_id  uuid,
  confidence_bucket text check (confidence_bucket in ('high', 'medium', 'low')),
  count             int not null default 0,
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade
);
create unique index daily_match_agg_conflict_key on daily_match_agg (
  tenant_id, project_id, day, outcome,
  coalesce(matched_entry_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(confidence_bucket, '')
);

-- Météo : jamais de session/visitor_ref associé, y compris ici — la
-- seule catégorie de donnée réellement anonyme dès la collecte (voir
-- doctrine verrouillée, point 3 de l'addendum : aucun taux de
-- participation en V1, uniquement le nombre de réponses + distribution).
create table daily_mood_agg (
  tenant_id  uuid not null,
  project_id uuid not null,
  day        date not null,
  value      smallint not null check (value between 1 and 5),
  count      int not null default 0,
  primary key (tenant_id, project_id, day, value),
  foreign key (tenant_id, project_id) references projects(tenant_id, id) on delete cascade
);
