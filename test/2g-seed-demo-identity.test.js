import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';
import { insertProjectIdentity, insertProjectMembership } from '../src/domain/project-setup/repository.js';
import {
  findOrCreateDemoTenant, grantPlatformDemoIdentityAccess, PLATFORM_DEMO_IDENTITY_EMAIL, DEMO_TENANT_NAME
} from '../src/db/seedDemo.js';
import { seedTenantMembership } from './helpers/memberships.js';

// Bug trouvé en production, corrigé ici : le seed démo créait son
// propre utilisateur fictif (Camille Renaud) et ne l'accordait qu'à
// LUI un accès au projet démo -- jamais à l'identité RÉELLEMENT
// utilisée par Storm Home en production (/api/demo-identity, voir
// src/http/routes/demoIdentity.js). Le projet existait donc en base,
// mais restait invisible pour quiconque ouvrait l'instance de
// démonstration normalement. Ce test garantit que ça ne régresse
// jamais silencieusement : après le bootstrap démo, l'identité
// PLATFORM_DEMO_IDENTITY_EMAIL doit voir et pouvoir ouvrir le projet
// démo via la vraie route /api/projects (celle que Storm Home
// interroge), pas seulement via une vérification de base directe.

const config = loadConfig();
const pool = getPool(config);
const storageAdapter = createStorageAdapter(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let app, server, baseUrl;
let platformUserId;

test.before(async () => {
  await runMigrations();

  // Nettoyage scopé au tenant démo uniquement -- jamais un clearAll()
  // global, cohérent avec la doctrine du seed démo lui-même.
  const { rows: [demoTenant] } = await pool.query('select id from tenants where name = $1', [DEMO_TENANT_NAME]);
  if (demoTenant) {
    await pool.query('delete from projects where tenant_id = $1', [demoTenant.id]);
    await pool.query('delete from tenant_memberships where tenant_id = $1', [demoTenant.id]);
  }

  // L'identité démo de la plateforme (PLATFORM_DEMO_IDENTITY_EMAIL)
  // est la MÊME identité que celle créée par seed.js classique
  // ('vivien@parella.example') -- un vrai utilisateur persistant,
  // avec ses propres memberships sur le tenant Parella (hors du
  // périmètre de ce test, jamais supprimées). Réutilisée si présente
  // plutôt que supprimée/recréée -- la supprimer violerait la
  // contrainte FK on delete restrict dès qu'elle a la moindre
  // membership ailleurs, exactement le comportement réel qu'on ne
  // veut jamais casser en environnement de test.
  const { rows: [existing] } = await pool.query('select id from users where email = $1', [PLATFORM_DEMO_IDENTITY_EMAIL]);
  if (existing) {
    platformUserId = existing.id;
  } else {
    const { rows: [created] } = await pool.query(
      "insert into users (email, display_name) values ($1, 'Identité Démo Plateforme') returning id",
      [PLATFORM_DEMO_IDENTITY_EMAIL]
    );
    platformUserId = created.id;
  }

  // Reproduit la partie pertinente de seedDemo() : créer le tenant/
  // projet démo, puis appeler EXACTEMENT la fonction de correctif
  // testée -- jamais une réimplémentation parallèle de la logique.
  const tenantId = await findOrCreateDemoTenant(pool);
  const { rows: [project] } = await pool.query(
    "insert into projects (tenant_id, name) values ($1, 'Équinoxe Test') returning id",
    [tenantId]
  );
  const projectId = project.id;
  await insertProjectIdentity(pool, { tenantId, projectId, identity: {} });

  // Un autre utilisateur (type Camille) garde aussi son accès --
  // vérifie que le correctif AJOUTE l'accès plateforme, ne remplace
  // jamais l'accès existant de l'auteur de contenu fictif.
  const { rows: [contentAuthor] } = await pool.query(
    "insert into users (email, display_name) values ('contentauthor.testfix@demo.storm.local', 'Auteur Contenu Test') returning id"
  );
  await seedTenantMembership(pool, { tenantId: tenantId, userId: contentAuthor.id, permissionBundle: 'organization_admin' });
  await insertProjectMembership(pool, { tenantId, projectId, userId: contentAuthor.id, permissionBundle: 'project_admin' });

  await grantPlatformDemoIdentityAccess(pool, { tenantId, projectId });

  app = createApp({ logger: silentLogger, pool, config, storageAdapter });
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

test.after(async () => {
  server.close();
  const { rows: [demoTenant] } = await pool.query('select id from tenants where name = $1', [DEMO_TENANT_NAME]);
  if (demoTenant) {
    // Projects d'abord (cascade vers project_memberships), puis
    // tenant_memberships, puis seulement l'utilisateur -- jamais
    // l'inverse (contrainte FK on delete restrict sur les deux tables
    // de memberships référençant users).
    await pool.query("delete from projects where tenant_id = $1 and name = 'Équinoxe Test'", [demoTenant.id]);
    // Retire la tenant_membership de l'identité plateforme sur CE
    // tenant démo (accordée par grantPlatformDemoIdentityAccess dans
    // test.before()) -- jamais l'utilisateur lui-même, qui reste la
    // vraie identité persistante partagée avec le reste de la suite.
    await pool.query('delete from tenant_memberships where tenant_id = $1 and user_id = $2', [demoTenant.id, platformUserId]);
    await pool.query('delete from tenant_memberships where tenant_id = $1 and user_id in (select id from users where email = $2)', [demoTenant.id, 'contentauthor.testfix@demo.storm.local']);
  }
  await pool.query("delete from users where email = 'contentauthor.testfix@demo.storm.local'");
  await closePool();
});

test('après le bootstrap démo, l\'identité démo réelle de la plateforme voit le projet via /api/projects (la route que Storm Home interroge)', async () => {
  const res = await fetch(`${baseUrl}/api/projects`, { headers: { 'X-Storm-Dev-User': platformUserId } });
  assert.equal(res.status, 200);
  const projects = await res.json();
  const found = projects.find(p => p.name === 'Équinoxe Test');
  assert.ok(found, 'l\'identité démo plateforme doit voir le projet démo dans /api/projects, jamais seulement en base');
});

test('après le bootstrap démo, l\'identité démo réelle peut réellement OUVRIR le projet (capability project_admin, pas seulement le voir listé)', async () => {
  const listRes = await fetch(`${baseUrl}/api/projects`, { headers: { 'X-Storm-Dev-User': platformUserId } });
  const projects = await listRes.json();
  const found = projects.find(p => p.name === 'Équinoxe Test');
  const contextRes = await fetch(`${baseUrl}/api/projects/${found.id}/context`, { headers: { 'X-Storm-Dev-User': platformUserId } });
  assert.equal(contextRes.status, 200);
  const context = await contextRes.json();
  assert.ok(context.membership.capabilities.includes('project.view'), 'doit pouvoir ouvrir le projet, pas seulement le lister');
  assert.equal(context.membership.permissionBundle, 'project_admin');
});

test('grantPlatformDemoIdentityAccess ajoute l\'accès plateforme SANS retirer l\'accès de l\'auteur de contenu fictif existant', async () => {
  const res = await fetch(`${baseUrl}/api/projects`, { headers: { 'X-Storm-Dev-User': platformUserId } });
  const projects = await res.json();
  const found = projects.find(p => p.name === 'Équinoxe Test');

  const { rows } = await pool.query(
    `select u.email, pm.permission_bundle from project_memberships pm
     join users u on u.id = pm.user_id where pm.project_id = $1 order by u.email`,
    [found.id]
  );
  const emails = rows.map(r => r.email);
  assert.ok(emails.includes(PLATFORM_DEMO_IDENTITY_EMAIL), 'identité plateforme toujours présente');
  assert.ok(emails.includes('contentauthor.testfix@demo.storm.local'), 'accès de l\'auteur de contenu fictif jamais retiré');
});

test('grantPlatformDemoIdentityAccess ne fait rien silencieusement si l\'identité démo plateforme n\'existe pas dans cette base (jamais une erreur bloquante)', async () => {
  const tenantId = await findOrCreateDemoTenant(pool);
  const { rows: [project] } = await pool.query(
    "insert into projects (tenant_id, name) values ($1, 'Projet Sans Identité Plateforme') returning id",
    [tenantId]
  );
  await insertProjectIdentity(pool, { tenantId, projectId: project.id, identity: {} });

  // Renommage temporaire de l'email (jamais une suppression -- cet
  // utilisateur a déjà des memberships réelles créées par
  // test.before(), la contrainte FK on delete restrict empêcherait sa
  // suppression) -- le temps de cet appel, PLATFORM_DEMO_IDENTITY_EMAIL
  // ne correspond plus à personne dans cette base, reproduisant
  // fidèlement le scénario "identité démo absente" sans casser les
  // memberships déjà établies pour les autres tests de ce fichier.
  await pool.query('update users set email = $1 where email = $2', ['temporairement-renomme@demo.storm.local', PLATFORM_DEMO_IDENTITY_EMAIL]);
  try {
    await assert.doesNotReject(grantPlatformDemoIdentityAccess(pool, { tenantId, projectId: project.id }));
    const { rows: membershipRows } = await pool.query(
      'select count(*) as n from project_memberships where project_id = $1', [project.id]
    );
    assert.equal(Number(membershipRows[0].n), 0, 'aucune membership ne doit être créée quand l\'identité est introuvable');
  } finally {
    await pool.query('update users set email = $1 where email = $2', [PLATFORM_DEMO_IDENTITY_EMAIL, 'temporairement-renomme@demo.storm.local']);
  }

  await pool.query('delete from projects where id = $1', [project.id]);
});
