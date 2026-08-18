-- 0005_asset_reference_lifecycle — politique de suppression différenciée
-- pour les 5 FK référençant assets, jamais un ON DELETE uniforme.
--
-- Découvert par un test réel (suppression d'un projet contenant un
-- article à bloc image) : les 5 FK posées en 0004 n'avaient aucune
-- clause ON DELETE explicite (NO ACTION par défaut). Comme assets
-- cascade indépendamment depuis projects, un ordre de résolution non
-- garanti entre les deux chemins de cascade provoquait une violation
-- de contrainte FK.
--
-- Doctrine retenue, sémantique par type de relation, jamais uniforme :
--   asset supprimé -> supprimer les objets qui SONT l'asset (média) ;
--   asset supprimé -> détacher l'asset des objets qui PEUVENT exister sans lui.
--
-- CASCADE : la ligne n'a structurellement aucun sens sans son asset.
--   - project_article_blocks.image_asset_id : un bloc image sans image
--     contredirait le contrat de validation actuel (imageAssetId requis
--     et non vide pour blockType='image') — SET NULL créerait un état
--     DB que l'API elle-même considère invalide.
--   - project_narrative_section_media.asset_id : ligne entièrement
--     dépendante d'un asset, pas d'existence indépendante.
--   - project_space_media.asset_id : même logique.
--
-- SET NULL : l'objet reste un objet valide sans sa photo.
--   - project_team_members.photo_asset_id
--   - project_ambassadors.photo_asset_id

alter table project_article_blocks
  drop constraint project_article_blocks_tenant_id_project_id_image_asset_id_fkey,
  add constraint project_article_blocks_tenant_id_project_id_image_asset_id_fkey
    foreign key (tenant_id, project_id, image_asset_id) references assets(tenant_id, project_id, id) on delete cascade;

alter table project_team_members
  drop constraint project_team_members_tenant_id_project_id_photo_asset_id_fkey,
  add constraint project_team_members_tenant_id_project_id_photo_asset_id_fkey
    foreign key (tenant_id, project_id, photo_asset_id) references assets(tenant_id, project_id, id) on delete set null (photo_asset_id);

alter table project_narrative_section_media
  drop constraint project_narrative_section_med_tenant_id_project_id_asset_i_fkey,
  add constraint project_narrative_section_media_asset_fkey
    foreign key (tenant_id, project_id, asset_id) references assets(tenant_id, project_id, id) on delete cascade;

alter table project_ambassadors
  drop constraint project_ambassadors_tenant_id_project_id_photo_asset_id_fkey,
  add constraint project_ambassadors_tenant_id_project_id_photo_asset_id_fkey
    foreign key (tenant_id, project_id, photo_asset_id) references assets(tenant_id, project_id, id) on delete set null (photo_asset_id);

alter table project_space_media
  drop constraint project_space_media_tenant_id_project_id_asset_id_fkey,
  add constraint project_space_media_tenant_id_project_id_asset_id_fkey
    foreign key (tenant_id, project_id, asset_id) references assets(tenant_id, project_id, id) on delete cascade;
