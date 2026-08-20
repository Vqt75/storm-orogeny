-- 0008_publication_warnings — Slice 1.
--
-- Une compilation réussie peut porter des avertissements non
-- bloquants (ex. featuredArticleId devenu obsolète, replié sur
-- latest) : la publication aboutit, mais ce n'est pas invisible.
-- Jamais mélangé avec failure_code/failure_detail, qui restent
-- réservés à une compilation refusée (statut 'failed').
alter table project_publications
  add column warnings jsonb not null default '[]'::jsonb;
