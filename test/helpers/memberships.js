// Helper de test partagé — toute fixture de test doit désormais créer
// une membership ET son grant miroir (jamais une membership seule,
// voir modèle Membership/Grant). Centralise ce couplage une seule
// fois plutôt que de le dupliquer dans chaque fichier de test.

export async function seedTenantMembership(pool, { tenantId, userId, permissionBundle }) {
  const { rows: [row] } = await pool.query(
    'insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3) returning id',
    [tenantId, userId, permissionBundle]
  );
  await pool.query(
    'insert into organization_grants (tenant_id, organization_membership_id, permission_bundle, source_type, actor_user_id) values ($1,$2,$3,$4,$5)',
    [tenantId, row.id, permissionBundle, 'direct', userId]
  );
  return row.id;
}

export async function seedProjectMembership(pool, { tenantId, projectId, userId, permissionBundle }) {
  const { rows: [row] } = await pool.query(
    'insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4) returning id',
    [tenantId, projectId, userId, permissionBundle]
  );
  await pool.query(
    'insert into project_grants (tenant_id, project_id, project_membership_id, permission_bundle, source_type, actor_user_id) values ($1,$2,$3,$4,$5,$6)',
    [tenantId, projectId, row.id, permissionBundle, 'direct', userId]
  );
  return row.id;
}
