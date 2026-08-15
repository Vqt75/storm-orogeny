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
