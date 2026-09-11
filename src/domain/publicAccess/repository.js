// Repository Accès Public -- une seule ligne "courante" (non révoquée)
// par projet à la fois, imposée par PostgreSQL (voir migration 0019).
// Toute mutation qui touche le statut/la capability doit passer par
// ces fonctions, jamais un UPDATE ad hoc ailleurs dans le code.
import { generateRawCapability, hashCapability } from './capability.js';
import { encryptCapability, decryptCapability } from './encryption.js';

async function insertAccessRow(client, { tenantId, projectId, clientSlug, projectSlug, reason, encryptionKey, status, supersedesAccessId }) {
  const raw = generateRawCapability();
  const hash = hashCapability(raw);
  const encrypted = encryptCapability(raw, encryptionKey);
  const { rows: [row] } = await client.query(
    `insert into project_public_access
       (tenant_id, project_id, client_slug, project_slug, capability_hash, capability_encrypted, status, supersedes_access_id, created_reason)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     returning id, status, client_slug, project_slug, created_reason, supersedes_access_id, created_at`,
    [tenantId, projectId, clientSlug, projectSlug, hash, encrypted, status, supersedesAccessId, reason]
  );
  return { ...row, rawCapability: raw };
}

// createFirstAccess -- appelée uniquement lors de la PREMIÈRE
// publication d'un projet (aucune ligne existante). Doit s'insérer
// dans la même transaction que l'activation de la publication -- voir
// integration dans publication/repository.js.
export async function createFirstAccess(client, { tenantId, projectId, clientSlug, projectSlug, encryptionKey }) {
  return insertAccessRow(client, {
    tenantId, projectId, clientSlug, projectSlug, encryptionKey,
    reason: 'first_publication', status: 'active', supersedesAccessId: null
  });
}

// findCurrentAccess -- la ligne non révoquée (active ou unpublished),
// jamais plus d'une (contrainte DB). Accepte pool ou client de
// transaction indifféremment.
export async function findCurrentAccess(queryable, projectId) {
  const { rows: [row] } = await queryable.query(
    `select id, tenant_id, project_id, client_slug, project_slug, capability_encrypted, status,
            supersedes_access_id, created_reason, redistribution_acknowledged_at, redistribution_acknowledged_by, created_at
     from project_public_access where project_id=$1 and status <> 'revoked'`,
    [projectId]
  );
  return row ?? null;
}

// resolvePublicAccess -- point d'entrée des routes publiques. Recherche
// STRICTEMENT par hash (jamais de comparaison en clair). Un token
// valide présenté avec un chemin lisible incorrect ne doit jamais se
// distinguer d'un chemin totalement inconnu (doctrine D) -- 'unknown'
// dans les deux cas, jamais 'revoked'/'unpublished' révélé par erreur
// de chemin.
export async function resolvePublicAccess(pool, { clientSlug, projectSlug, rawCapability }) {
  const hash = hashCapability(rawCapability);
  const { rows: [row] } = await pool.query(
    `select id, tenant_id, project_id, client_slug, project_slug, status from project_public_access where capability_hash=$1`,
    [hash]
  );
  if (!row) return { kind: 'unknown' };
  if (row.client_slug !== clientSlug || row.project_slug !== projectSlug) return { kind: 'unknown' };
  if (row.status === 'revoked') return { kind: 'revoked' };
  if (row.status === 'unpublished') return { kind: 'unpublished' };
  return { kind: 'active', projectId: row.project_id, tenantId: row.tenant_id };
}

// setAvailability -- bascule active<->unpublished SANS jamais toucher
// capability/slugs (préserve l'URL/QR à l'identique). Aucun effet si
// aucun accès courant n'existe (projet jamais publié).
export async function setAvailability(pool, { projectId, status }) {
  const { rows: [row] } = await pool.query(
    `update project_public_access set status=$1 where project_id=$2 and status <> 'revoked' returning id, status`,
    [status, projectId]
  );
  return row ?? null;
}

// rotateAccess -- DOIT s'exécuter sous verrou, dans une transaction
// déjà ouverte par l'appelant (rename/reassign/rotation manuelle).
// Préserve le statut de disponibilité courant (active reste active,
// unpublished reste unpublished) -- seule la capability et,
// éventuellement, les slugs snapshotés changent.
export async function rotateAccess(client, { tenantId, projectId, clientSlug, projectSlug, reason, encryptionKey }) {
  const { rows: [current] } = await client.query(
    `select id, status from project_public_access where project_id=$1 and status <> 'revoked' for update`,
    [projectId]
  );
  if (!current) return null; // aucun accès courant -- rien à faire tourner
  await client.query(
    `update project_public_access set status='revoked', revoked_at=now() where id=$1`,
    [current.id]
  );
  return insertAccessRow(client, {
    tenantId, projectId, clientSlug, projectSlug, encryptionKey, reason,
    status: current.status, supersedesAccessId: current.id
  });
}

export async function acknowledgeRedistribution(pool, { accessId, userId }) {
  const { rows: [row] } = await pool.query(
    `update project_public_access
     set redistribution_acknowledged_at = now(), redistribution_acknowledged_by = $1
     where id = $2 and status <> 'revoked'
     returning id, redistribution_acknowledged_at`,
    [userId, accessId]
  );
  return row ?? null;
}

// isRedistributionPending -- une première publication (aucun
// supersedes_access_id) n'affiche jamais d'avis.
export function isRedistributionPending(access) {
  return access.status !== 'revoked'
    && access.supersedes_access_id !== null
    && !access.redistribution_acknowledged_at;
}

// decryptCurrentCapability -- SEUL point du code autorisé à reformer
// la capability brute, exclusivement pour un usage Studio authentifié
// (copier le lien, régénérer le QR). Ne jamais exposer
// capability_encrypted lui-même à l'appelant HTTP.
export function decryptCurrentCapability(access, encryptionKey) {
  return decryptCapability(access.capability_encrypted, encryptionKey);
}
