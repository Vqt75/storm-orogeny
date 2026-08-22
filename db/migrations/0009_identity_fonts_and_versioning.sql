-- Identité réelle — logo/couleurs/police (Studio, domaine Identité).
-- Ajoute le support d'un vrai fichier de police, jamais seulement son
-- nom : jusqu'ici font_primary/font_secondary étaient du texte brut,
-- sans aucun fichier persisté (le formulaire de Project Setup ne
-- chargeait la police qu'en mémoire du navigateur via FontFace, pour
-- la prévisualisation — jamais envoyée au serveur). C'est la cause
-- racine du bug observé en production (Myriad Pro affichée en repli
-- serif sur les rôles typographiques secondaires d'Ivory).

alter table assets drop constraint assets_kind_check;
alter table assets add constraint assets_kind_check
  check (kind in ('logo', 'article_image', 'team_photo', 'ambassador_photo', 'space_media', 'narrative_media', 'font'));

-- font_primary/font_secondary (texte) restent le nom de famille CSS ;
-- ces nouvelles colonnes référencent le FICHIER réel. on delete set
-- null reprend exactement le pattern déjà en place sur logo_asset_id.
alter table project_identity
  add column font_primary_asset_id   uuid references assets(id) on delete set null,
  add column font_secondary_asset_id uuid references assets(id) on delete set null;

-- Verrouillage optimiste — project_identity n'en avait aucun jusqu'ici
-- (seul le logo était modifiable après création, un remplacement de
-- fichier n'a pas besoin de version). Nécessaire maintenant que les
-- couleurs deviennent éditables depuis Studio, avec autosave --
-- même pattern que project_section_content (0004_studio_content.sql).
alter table project_identity
  add column version            int not null default 1,
  add column updated_at         timestamptz not null default now(),
  add column updated_by_user_id uuid references users(id);
