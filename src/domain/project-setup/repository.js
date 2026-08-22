// Repository Project Setup — fonctions typées, jamais de SQL brut
// dans les routes. Conçu pour être appelé à l'intérieur d'une seule
// transaction (Lot 2, POST /api/projects) — chaque fonction accepte un
// client déjà ouvert (pas le pool), jamais sa propre connexion.

export async function insertProject(client, { tenantId, name }) {
  const { rows: [row] } = await client.query(
    'insert into projects (tenant_id, name) values ($1, $2) returning id',
    [tenantId, name]
  );
  return row.id;
}

export async function insertProjectIdentity(client, { tenantId, projectId, identity }) {
  await client.query(
    `insert into project_identity
       (tenant_id, project_id, logo_asset_id, primary_color, secondary_color, font_primary, font_secondary, theme)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      tenantId, projectId,
      identity.logoAssetId ?? null,
      identity.primaryColor ?? null,
      identity.secondaryColor ?? null,
      identity.fontPrimary ?? null,
      identity.fontSecondary ?? null,
      identity.theme ?? 'ivory'
    ]
  );
}

export async function insertProjectSettings(client, { tenantId, projectId, workspaceLocale, contentLocale }) {
  await client.query(
    `insert into project_settings (tenant_id, project_id, workspace_locale, content_locale)
     values ($1, $2, $3, $4)`,
    [tenantId, projectId, workspaceLocale, contentLocale]
  );
}

export async function insertProjectModules(client, { tenantId, projectId, modules }) {
  const entries = Object.entries(modules ?? {});
  for (const [moduleKey, enabled] of entries) {
    await client.query(
      `insert into project_modules (tenant_id, project_id, module_key, enabled)
       values ($1, $2, $3, $4)`,
      [tenantId, projectId, moduleKey, Boolean(enabled)]
    );
  }
}

export async function insertProjectMembership(client, { tenantId, projectId, userId, permissionBundle }) {
  await client.query(
    `insert into project_memberships (tenant_id, project_id, user_id, permission_bundle)
     values ($1, $2, $3, $4)`,
    [tenantId, projectId, userId, permissionBundle]
  );
}

export async function insertProjectInvitation(client, { tenantId, projectId, email, permissionBundle, locale, invitedByUserId }) {
  await client.query(
    `insert into project_invitations
       (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id)
     values ($1, $2, $3, $4, $5, $6)`,
    [tenantId, projectId, email, permissionBundle, locale, invitedByUserId]
  );
}

export async function listSupportedLocales(pool) {
  const { rows } = await pool.query('select code from supported_locales order by code');
  return rows.map(r => r.code);
}

// Assets — voir docs/adr/0003-storage-adapter.md. storage_key reste
// opaque au domaine et aux routes ; seul l'adapter de storage sait
// comment le résoudre en octets réels.
export async function insertAsset(client, { tenantId, projectId, kind, storageKey, contentType, byteSize }) {
  const { rows: [row] } = await client.query(
    `insert into assets (tenant_id, project_id, kind, storage_key, content_type, byte_size)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [tenantId, projectId, kind, storageKey, contentType, byteSize]
  );
  return row.id;
}

export async function updateProjectIdentityLogo(pool, { projectId, logoAssetId }) {
  const result = await pool.query('update project_identity set logo_asset_id = $1 where project_id = $2', [logoAssetId, projectId]);
  if (result.rowCount === 0) {
    // Ne devrait jamais arriver pour un projet créé via POST /api/projects
    // (project_identity y est toujours créée dans la même transaction) —
    // mais un succès silencieux serait pire qu'une erreur explicite si
    // ce cas se présentait un jour pour une autre raison.
    throw new Error(`Aucune project_identity trouvée pour le projet ${projectId} — mise à jour du logo impossible.`);
  }
}

// Police — remplace à la fois le fichier (asset) ET le nom de famille
// CSS en une seule opération atomique : les deux doivent toujours
// rester cohérents, jamais une mise à jour partielle de l'un sans
// l'autre. role ∈ {'primary','secondary'} — validé par l'appelant
// (route HTTP), jamais construit dynamiquement ici pour éviter toute
// injection de nom de colonne.
export async function updateProjectIdentityFontAsset(pool, { projectId, role, assetId, fontName }) {
  const nameColumn = role === 'primary' ? 'font_primary' : 'font_secondary';
  const assetColumn = role === 'primary' ? 'font_primary_asset_id' : 'font_secondary_asset_id';
  const result = await pool.query(
    `update project_identity set ${nameColumn} = $1, ${assetColumn} = $2 where project_id = $3`,
    [fontName, assetId, projectId]
  );
  if (result.rowCount === 0) {
    throw new Error(`Aucune project_identity trouvée pour le projet ${projectId} — mise à jour de la police impossible.`);
  }
}

// Retrait de la police secondaire uniquement — jamais la primaire,
// obligatoire par construction produit (le modèle cible interdit un
// projet sans aucune police). Retour immédiat au régime "principale
// partout" : fontSecondary/fontSecondaryAssetId redeviennent null,
// le Compiler retombe alors sur son repli déjà existant vers la
// primaire (voir compileBranding).
export async function removeProjectIdentitySecondaryFont(pool, { projectId }) {
  await pool.query(
    'update project_identity set font_secondary = null, font_secondary_asset_id = null where project_id = $1',
    [projectId]
  );
}

// Couleurs — verrouillage optimiste, même contrat que les autres
// domaines Studio (project_section_content) : la version attendue
// doit correspondre exactement, sinon aucune ligne n'est mise à jour
// (conflit, jamais un écrasement silencieux). Retourne la nouvelle
// version si succès, null si la version attendue ne correspond plus.
export async function updateProjectIdentityColors(pool, { projectId, primaryColor, secondaryColor, expectedVersion, userId }) {
  const { rows } = await pool.query(
    `update project_identity
     set primary_color = $1, secondary_color = $2, version = version + 1, updated_at = now(), updated_by_user_id = $3
     where project_id = $4 and version = $5
     returning version, updated_at`,
    [primaryColor, secondaryColor, userId, projectId, expectedVersion]
  );
  return rows[0] ?? null;
}

export async function findAsset(pool, assetId) {
  const { rows } = await pool.query(
    'select id, tenant_id, project_id, storage_key, content_type from assets where id = $1',
    [assetId]
  );
  return rows[0] ?? null;
}
