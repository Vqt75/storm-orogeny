import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';
import { seedTenantMembership } from './helpers/memberships.js';

// Project Creation V2 — doctrine "creation creates the container".
// Une seule décision métier obligatoire : le nom. Ces tests vérifient
// précisément ce que l'API accepte désormais SANS workspaceLocale/
// contentLocale explicites (dérivation serveur), et que les
// invariants du container (membership, grant, lifecycle, aucune
// invitation implicite) restent corrects avec ce payload minimal.

const config = loadConfig();
const pool = getPool(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let app, server, baseUrl;
let ids = {};

async function cleanAll() {
  await pool.query('delete from project_grants');
  await pool.query('delete from project_invitations');
  await pool.query('delete from project_modules');
  await pool.query('delete from project_settings');
  await pool.query('delete from project_identity');
  await pool.query('delete from project_memberships');
  await pool.query('delete from organization_grants');
  await pool.query('delete from tenant_memberships');
  await pool.query('delete from projects');
  await pool.query('delete from clients');
  await pool.query('delete from users');
  await pool.query('delete from tenants');
}

test.before(async () => {
  await runMigrations();
  await cleanAll();

  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant Creation V2') returning id");
  const { rows: [creator] } = await pool.query("insert into users (email, display_name) values ('createurv2@test.local','Créateur V2') returning id");
  const { rows: [noCap] } = await pool.query("insert into users (email, display_name) values ('sanscapv2@test.local','Sans Capability') returning id");

  await seedTenantMembership(pool, { tenantId: tenant.id, userId: creator.id, permissionBundle: 'organization_admin' });
  await seedTenantMembership(pool, { tenantId: tenant.id, userId: noCap.id, permissionBundle: 'member' });

  // Client de fixture -- Lot A exige désormais clientId à la création
  // de projet ; ce Client sert tous les tests de ce fichier qui
  // attendent un succès (201), jamais un texte libre.
  const { rows: [client] } = await pool.query(
    "insert into clients (tenant_id, name, normalized_slug) values ($1,'Client Fixture V2','client-fixture-v2') returning id",
    [tenant.id]
  );

  ids = { tenant: tenant.id, creator: creator.id, noCap: noCap.id, client: client.id };

  app = createApp({ logger: silentLogger, pool, config });
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await cleanAll();
  server.close();
  await closePool();
});

function withUser(userId, extraHeaders = {}) {
  return { headers: { 'X-Storm-Dev-User': userId, ...extraHeaders } };
}

test('création avec projects.create -> 201, payload minimal {name} accepté', async () => {
  const res = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', ...withUser(ids.creator),
    headers: { ...withUser(ids.creator).headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Projet Minimal V2', clientId: ids.client })
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.id);
  assert.equal(body.name, 'Projet Minimal V2');
  assert.equal(body.status, 'active');
  ids.projectMinimal = body.id;
});

test('sans projects.create -> 403, aucun projet créé', async () => {
  const before = await pool.query('select count(*)::int as n from projects');
  const res = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', ...withUser(ids.noCap),
    headers: { ...withUser(ids.noCap).headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Ne devrait jamais exister', clientId: ids.client })
  });
  assert.equal(res.status, 403);
  const after = await pool.query('select count(*)::int as n from projects');
  assert.equal(after.rows[0].n, before.rows[0].n, 'aucun projet ne doit avoir été créé');
});

test('nom vide -> refusé, aucun projet créé', async () => {
  const before = await pool.query('select count(*)::int as n from projects');
  const res = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', ...withUser(ids.creator),
    headers: { ...withUser(ids.creator).headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '   ', clientId: ids.client })
  });
  assert.equal(res.status, 400);
  const after = await pool.query('select count(*)::int as n from projects');
  assert.equal(after.rows[0].n, before.rows[0].n);
});

test('contentLocale/workspaceLocale dérivés depuis Accept-Language quand absents du payload', async () => {
  const res = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', ...withUser(ids.creator),
    headers: { ...withUser(ids.creator).headers, 'Content-Type': 'application/json', 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.5' },
    body: JSON.stringify({ name: 'Projet Locale Dérivée', clientId: ids.client })
  });
  assert.equal(res.status, 201);
  const { id } = await res.json();
  const { rows: [settings] } = await pool.query('select workspace_locale, content_locale from project_settings where project_id=$1', [id]);
  assert.equal(settings.workspace_locale, 'es', 'dérivé depuis Accept-Language, jamais un défaut arbitraire');
  assert.equal(settings.content_locale, 'es');
});

test('sans Accept-Language exploitable -> repli sur fr, jamais une erreur', async () => {
  const res = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', ...withUser(ids.creator),
    headers: { ...withUser(ids.creator).headers, 'Content-Type': 'application/json', 'Accept-Language': 'xx-XX' },
    body: JSON.stringify({ name: 'Projet Sans Locale Exploitable', clientId: ids.client })
  });
  assert.equal(res.status, 201);
  const { id } = await res.json();
  const { rows: [settings] } = await pool.query('select content_locale from project_settings where project_id=$1', [id]);
  assert.equal(settings.content_locale, 'fr');
});

test('contentLocale explicite dans le payload -> respecté, prioritaire sur Accept-Language', async () => {
  const res = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', ...withUser(ids.creator),
    headers: { ...withUser(ids.creator).headers, 'Content-Type': 'application/json', 'Accept-Language': 'de-DE' },
    body: JSON.stringify({ name: 'Projet Locale Explicite', clientId: ids.client, contentLocale: 'it' })
  });
  assert.equal(res.status, 201);
  const { id } = await res.json();
  const { rows: [settings] } = await pool.query('select content_locale, workspace_locale from project_settings where project_id=$1', [id]);
  assert.equal(settings.content_locale, 'it', 'le choix explicite du contrôle discret doit toujours gagner');
  assert.equal(settings.workspace_locale, 'de', 'workspaceLocale continue de se dériver indépendamment si non fourni');
});

test('créateur reçoit project_admin -- membership ET grant réels, jamais un système parallèle', async () => {
  const { rows: [pm] } = await pool.query(
    'select id, permission_bundle from project_memberships where project_id=$1 and user_id=$2',
    [ids.projectMinimal, ids.creator]
  );
  assert.equal(pm.permission_bundle, 'project_admin');
  const { rows: [grant] } = await pool.query(
    "select permission_bundle, source_type, status from project_grants where project_membership_id=$1",
    [pm.id]
  );
  assert.equal(grant.permission_bundle, 'project_admin');
  assert.equal(grant.source_type, 'direct');
  assert.equal(grant.status, 'active');
});

test('aucune invitation implicite, aucun contenu fictif créé', async () => {
  const { rows: [{ n }] } = await pool.query('select count(*)::int as n from project_invitations where project_id=$1', [ids.projectMinimal]);
  assert.equal(n, 0);
});

test('identité neutre à la création -- aucun logo, couleurs nulles, thème par défaut technique jamais exposé', async () => {
  const { rows: [identity] } = await pool.query(
    'select logo_asset_id, primary_color, secondary_color, theme from project_identity where project_id=$1',
    [ids.projectMinimal]
  );
  assert.equal(identity.logo_asset_id, null);
  assert.equal(identity.primary_color, null);
  assert.equal(identity.secondary_color, null);
  assert.equal(identity.theme, 'ivory', 'valeur technique dérivée, jamais un choix utilisateur');
});

test('transaction atomique -- rollback complet si l\'écriture échoue en cours de création', async () => {
  // project_identity est TOUJOURS écrite, quel que soit le payload
  // (contrairement à project_modules, jamais touchée quand modules
  // est vide -- exactement le cas de Creation V2, qui ne l'envoie
  // plus jamais -- confirmé en le découvrant via ce test lui-même).
  await pool.query('REVOKE INSERT ON project_identity FROM storm_orogeny');
  const before = await pool.query('select count(*)::int as n from projects');
  try {
    const res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST', ...withUser(ids.creator),
      headers: { ...withUser(ids.creator).headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Devrait tout annuler V2', clientId: ids.client })
    });
    assert.equal(res.status, 500);
  } finally {
    await pool.query('GRANT INSERT ON project_identity TO storm_orogeny');
  }
  const after = await pool.query('select count(*)::int as n from projects');
  assert.equal(after.rows[0].n, before.rows[0].n, 'aucun projet partiel ne doit subsister');
});

// ── Fail closed multi-organisation ──────────────────────────────────
// Aucun mécanisme de "contexte organisationnel actif" n'existe
// aujourd'hui dans le système (vérifié explicitement) -- donc dès que
// PLUSIEURS organisations qualifiées (capability projects.create
// effectivement accordée) existent pour l'utilisateur, Creation ne
// doit JAMAIS choisir silencieusement laquelle, contrairement à la
// résolution déterministe transitoire encore utilisée ailleurs
// (Storm Control notamment, volontairement non modifiée ici).
//
// L'ambiguïté ne porte JAMAIS sur le nombre brut de memberships, mais
// sur le nombre d'organisations où la capability est EFFECTIVEMENT
// accordée -- une membership sans projects.create n'est jamais un
// candidat à l'ambiguïté, ni un motif de 409.

test('une seule membership, projects.create -> succès (cas 1)', async () => {
  const res = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', ...withUser(ids.creator),
    headers: { ...withUser(ids.creator).headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Projet Mono Organisation', clientId: ids.client })
  });
  assert.equal(res.status, 201);
});

test('deux memberships, projects.create dans les DEUX -> 409 ORGANIZATION_CONTEXT_REQUIRED, jamais un choix silencieux', async () => {
  const { rows: [secondTenant] } = await pool.query("insert into tenants (name) values ('Seconde Organisation Créable V2') returning id");
  await seedTenantMembership(pool, { tenantId: secondTenant.id, userId: ids.creator, permissionBundle: 'organization_admin' });

  const before = await pool.query('select count(*)::int as n from projects');
  const beforeIdentity = await pool.query('select count(*)::int as n from project_identity');
  const beforeSettings = await pool.query('select count(*)::int as n from project_settings');
  const beforeMemberships = await pool.query('select count(*)::int as n from project_memberships');
  const beforeGrants = await pool.query('select count(*)::int as n from project_grants');

  const res = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', ...withUser(ids.creator),
    headers: { ...withUser(ids.creator).headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Ne devrait jamais être créé', clientId: ids.client })
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, 'ORGANIZATION_CONTEXT_REQUIRED');
  assert.ok(!/tenant|membership/i.test(body.error.message), 'le message ne doit jamais exposer de vocabulaire technique');

  const after = await pool.query('select count(*)::int as n from projects');
  assert.equal(after.rows[0].n, before.rows[0].n, 'aucune ligne projects créée');
  assert.equal((await pool.query('select count(*)::int as n from project_identity')).rows[0].n, beforeIdentity.rows[0].n, 'aucune identité partielle');
  assert.equal((await pool.query('select count(*)::int as n from project_settings')).rows[0].n, beforeSettings.rows[0].n, 'aucun settings partiel');
  assert.equal((await pool.query('select count(*)::int as n from project_memberships')).rows[0].n, beforeMemberships.rows[0].n, 'aucune membership partielle');
  assert.equal((await pool.query('select count(*)::int as n from project_grants')).rows[0].n, beforeGrants.rows[0].n, 'aucun grant partiel');

  await pool.query('delete from organization_grants where organization_membership_id in (select id from tenant_memberships where tenant_id=$1 and user_id=$2)', [secondTenant.id, ids.creator]);
  await pool.query('delete from tenant_memberships where tenant_id=$1 and user_id=$2', [secondTenant.id, ids.creator]);
  await pool.query('delete from tenants where id=$1', [secondTenant.id]);
});

test('après retrait de la seconde organisation créable, la création redevient possible normalement (confirme que ce n\'est pas un blocage permanent)', async () => {
  const res = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', ...withUser(ids.creator),
    headers: { ...withUser(ids.creator).headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Projet Après Nettoyage', clientId: ids.client })
  });
  assert.equal(res.status, 201);
});

test('deux memberships, projects.create dans UNE SEULE -> succès dans CETTE organisation précise, jamais l\'autre', async () => {
  // Seconde organisation avec un bundle 'member' -- n'accorde jamais
  // projects.create (vérifié par capabilities.js). Une seule
  // organisation reste donc réellement créable malgré deux memberships.
  const { rows: [nonCreatableTenant] } = await pool.query("insert into tenants (name) values ('Organisation Non Créable V2') returning id");
  await seedTenantMembership(pool, { tenantId: nonCreatableTenant.id, userId: ids.creator, permissionBundle: 'member' });

  const res = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', ...withUser(ids.creator),
    headers: { ...withUser(ids.creator).headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Projet Organisation Unique Créable', clientId: ids.client })
  });
  assert.equal(res.status, 201, 'une seule organisation réellement créable -- jamais un 409, malgré deux memberships');
  const { id: projectId } = await res.json();

  // Vérification en DB : le projet, la membership et le grant créés
  // correspondent bien à l'organisation AUTORISÉE (ids.tenant),
  // jamais à celle sans projects.create.
  const { rows: [project] } = await pool.query('select tenant_id from projects where id=$1', [projectId]);
  assert.equal(project.tenant_id, ids.tenant, 'le projet doit appartenir à l\'organisation qui accorde réellement projects.create');
  assert.notEqual(project.tenant_id, nonCreatableTenant.id);

  const { rows: [membership] } = await pool.query('select tenant_id, permission_bundle from project_memberships where project_id=$1 and user_id=$2', [projectId, ids.creator]);
  assert.equal(membership.tenant_id, ids.tenant);
  assert.equal(membership.permission_bundle, 'project_admin');

  const { rows: [grant] } = await pool.query(
    `select pg.tenant_id, pg.permission_bundle, pg.status from project_grants pg
     join project_memberships pm on pm.id = pg.project_membership_id
     where pm.project_id=$1 and pm.user_id=$2`,
    [projectId, ids.creator]
  );
  assert.equal(grant.tenant_id, ids.tenant);
  assert.equal(grant.permission_bundle, 'project_admin');
  assert.equal(grant.status, 'active');

  await pool.query('delete from organization_grants where organization_membership_id in (select id from tenant_memberships where tenant_id=$1 and user_id=$2)', [nonCreatableTenant.id, ids.creator]);
  await pool.query('delete from tenant_memberships where tenant_id=$1 and user_id=$2', [nonCreatableTenant.id, ids.creator]);
  await pool.query('delete from tenants where id=$1', [nonCreatableTenant.id]);
});

test('deux memberships, projects.create dans AUCUNE -> refus d\'autorisation (403), jamais un 409 de contexte', async () => {
  const { rows: [tenantA] } = await pool.query("insert into tenants (name) values ('Sans Droit A V2') returning id");
  const { rows: [tenantB] } = await pool.query("insert into tenants (name) values ('Sans Droit B V2') returning id");
  const { rows: [userNoCreate] } = await pool.query("insert into users (email, display_name) values ('sanscreatepartout@test.local','Sans Create Partout') returning id");
  await seedTenantMembership(pool, { tenantId: tenantA.id, userId: userNoCreate.id, permissionBundle: 'member' });
  await seedTenantMembership(pool, { tenantId: tenantB.id, userId: userNoCreate.id, permissionBundle: 'member' });

  const before = await pool.query('select count(*)::int as n from projects');

  const res = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', ...withUser(userNoCreate.id),
    headers: { ...withUser(userNoCreate.id).headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Ne devrait jamais être créé non plus', clientId: ids.client })
  });
  assert.equal(res.status, 403, 'refus d\'autorisation standard, jamais un 409 de contexte quand aucune organisation n\'est réellement créable');
  const body = await res.json();
  assert.notEqual(body.error.code, 'ORGANIZATION_CONTEXT_REQUIRED');

  const after = await pool.query('select count(*)::int as n from projects');
  assert.equal(after.rows[0].n, before.rows[0].n);
});

// ── Résolution par grants effectifs, jamais le bundle legacy de la
// membership -- voir audit : tenant_memberships.permission_bundle
// n'est jamais mis à jour par une révocation de grant, et un grant
// supplémentaire sur une membership 'member' était jusqu'ici invisible
// pour l'autorisation. Ces tests couvrent précisément les 3 cas
// audités (A, B, C).

test('cas A -- membership bundle SANS projects.create, mais grant actif supplémentaire qui l\'apporte -> organisation reconnue créable', async () => {
  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Org Grant Seul V2') returning id");
  const { rows: [user] } = await pool.query("insert into users (email, display_name) values ('grantseul@test.local','Grant Seul') returning id");
  await seedTenantMembership(pool, { tenantId: tenant.id, userId: user.id, permissionBundle: 'member' });
  const { rows: [tm] } = await pool.query('select id from tenant_memberships where tenant_id=$1 and user_id=$2', [tenant.id, user.id]);
  await pool.query(
    `insert into organization_grants (tenant_id, organization_membership_id, permission_bundle, source_type, actor_user_id)
     values ($1,$2,'organization_admin','direct',$3)`,
    [tenant.id, tm.id, user.id]
  );
  const { rows: [localClient] } = await pool.query(
    "insert into clients (tenant_id, name, normalized_slug) values ($1,'Client Grant Seul V2','client-grant-seul-v2') returning id",
    [tenant.id]
  );

  const res = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', ...withUser(user.id),
    headers: { ...withUser(user.id).headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Projet Via Grant Seul', clientId: localClient.id })
  });
  assert.equal(res.status, 201, 'le grant actif doit suffire, indépendamment du bundle de la membership elle-même');
  const { id: projectId } = await res.json();
  const { rows: [project] } = await pool.query('select tenant_id from projects where id=$1', [projectId]);
  assert.equal(project.tenant_id, tenant.id);
});

test('cas B -- bundle de membership historiquement porteur, mais grant correspondant révoqué -> plus autorisé', async () => {
  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Org Grant Révoqué V2') returning id");
  const { rows: [user] } = await pool.query("insert into users (email, display_name) values ('grantrevoque@test.local','Grant Révoqué') returning id");
  await seedTenantMembership(pool, { tenantId: tenant.id, userId: user.id, permissionBundle: 'organization_admin' });
  await pool.query(
    `update organization_grants set status='revoked', revoked_at=now()
     where organization_membership_id = (select id from tenant_memberships where tenant_id=$1 and user_id=$2)`,
    [tenant.id, user.id]
  );

  const before = await pool.query('select count(*)::int as n from projects');
  const res = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', ...withUser(user.id),
    headers: { ...withUser(user.id).headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Ne devrait plus être autorisé', clientId: ids.client })
  });
  assert.equal(res.status, 403, 'le bundle legacy de la membership ne doit plus suffire une fois son grant révoqué');
  const after = await pool.query('select count(*)::int as n from projects');
  assert.equal(after.rows[0].n, before.rows[0].n);
});

test('cas C -- union de plusieurs grants actifs -- additive, jamais "le dernier gagne" ni un doublon de comptage', async () => {
  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Org Union Grants V2') returning id");
  const { rows: [user] } = await pool.query("insert into users (email, display_name) values ('uniongrants@test.local','Union Grants') returning id");
  await seedTenantMembership(pool, { tenantId: tenant.id, userId: user.id, permissionBundle: 'member' });
  const { rows: [tm] } = await pool.query('select id from tenant_memberships where tenant_id=$1 and user_id=$2', [tenant.id, user.id]);
  await pool.query(
    `insert into organization_grants (tenant_id, organization_membership_id, permission_bundle, source_type, actor_user_id)
     values ($1,$2,'member','direct',$3)`,
    [tenant.id, tm.id, user.id]
  );

  const res1 = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', ...withUser(user.id),
    headers: { ...withUser(user.id).headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Ne devrait pas être autorisé (union de member)', clientId: ids.client })
  });
  assert.equal(res1.status, 403, 'union de deux grants member ne doit jamais produire projects.create par accident');

  await pool.query(
    `insert into organization_grants (tenant_id, organization_membership_id, permission_bundle, source_type, actor_user_id)
     values ($1,$2,'organization_admin','direct',$3)`,
    [tenant.id, tm.id, user.id]
  );
  const { rows: [localClient] } = await pool.query(
    "insert into clients (tenant_id, name, normalized_slug) values ($1,'Client Union Grants V2','client-union-grants-v2') returning id",
    [tenant.id]
  );
  const res2 = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', ...withUser(user.id),
    headers: { ...withUser(user.id).headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Projet Union Additive', clientId: localClient.id })
  });
  assert.equal(res2.status, 201, 'l\'union doit rester additive -- le nouveau grant s\'ajoute, jamais un remplacement');
});
