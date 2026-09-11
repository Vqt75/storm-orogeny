// Repository Client — CRUD + renommage avec rotation d'Accès Public
// (Lot B). Aucune détection de quasi-doublon sémantique ici (ex.
// "AG2R" vs "AG2R LA MONDIALE") : décision produit explicite, la
// recherche Studio est la défense principale, jamais une règle
// bloquante côté serveur.
import { normalizeClientName } from './slug.js';
import { rotateAccess } from '../publicAccess/repository.js';

// createClient -- unicité (tenant_id, normalized_slug) imposée par la
// contrainte DB elle-même (voir migration 0018) ; ce repository ne
// fait qu'attraper la violation Postgres (code 23505) et la traduire
// en résultat métier, jamais une pré-vérification racy.
export async function createClient(pool, { tenantId, name }) {
  const normalizedSlug = normalizeClientName(name);
  try {
    const { rows: [row] } = await pool.query(
      `insert into clients (tenant_id, name, normalized_slug)
       values ($1, $2, $3)
       returning id, tenant_id, name, normalized_slug, version, created_at`,
      [tenantId, name.trim(), normalizedSlug]
    );
    return { client: row, conflict: null };
  } catch (err) {
    if (err.code === '23505') {
      return { client: null, conflict: 'DUPLICATE_CLIENT_SLUG' };
    }
    throw err;
  }
}

export async function findClientById(pool, { tenantId, clientId }) {
  const { rows: [row] } = await pool.query(
    'select id, tenant_id, name, normalized_slug, version, created_at from clients where id=$1 and tenant_id=$2',
    [clientId, tenantId]
  );
  return row ?? null;
}

// searchClients -- recherche par sous-chaîne du nom d'affichage,
// jamais du slug seul. Toujours scopée au tenant.
export async function searchClients(pool, { tenantId, query = '', limit = 20 }) {
  const { rows } = await pool.query(
    `select id, tenant_id, name, normalized_slug, version, created_at
     from clients
     where tenant_id = $1 and name ilike $2
     order by name asc
     limit $3`,
    [tenantId, `%${query.trim()}%`, limit]
  );
  return rows;
}

// previewClientRename -- lecture seule, jamais de mutation. Calcule le
// nouveau slug et liste les projets PUBLIÉS (accès courant actif OU
// unpublished -- un site temporairement dépublié compte toujours
// comme publié, voir doctrine G) qui seraient affectés si le slug
// change réellement.
export async function previewClientRename(pool, { tenantId, clientId, name }) {
  const newSlug = normalizeClientName(name);
  const { rows: [client] } = await pool.query(
    'select id, name, normalized_slug, version from clients where id=$1 and tenant_id=$2',
    [clientId, tenantId]
  );
  if (!client) return null;
  const slugChanges = client.normalized_slug !== newSlug;
  if (!slugChanges) {
    return { client, newSlug, slugChanges: false, affectedProjects: [] };
  }
  const { rows: affectedProjects } = await pool.query(
    `select p.id, p.name from projects p
     join project_public_access a on a.project_id = p.id and a.status <> 'revoked'
     where p.client_id = $1`,
    [clientId]
  );
  return { client, newSlug, slugChanges: true, affectedProjects };
}

// renameClientAtomic -- si le slug ne change pas, renomme seulement
// (aucune rotation). Si le slug change, verrouille le client, recalcule
// EN DIRECT (jamais une liste figée depuis un preview) l'ensemble des
// projets affectés, renomme le Client et fait tourner l'Accès Public
// de CHAQUE projet concerné -- tout dans une seule transaction :
// succès entier ou rollback entier, jamais un état partiel.
export async function renameClientAtomic(pool, { tenantId, clientId, name, expectedVersion, encryptionKey }) {
  const newSlug = normalizeClientName(name);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [row] } = await client.query(
      `update clients set name=$1, normalized_slug=$2, version=version+1
       where id=$3 and tenant_id=$4 and version=$5
       returning id, name, normalized_slug, version`,
      [name.trim(), newSlug, clientId, tenantId, expectedVersion]
    );
    if (!row) {
      await client.query('ROLLBACK');
      return { client: null, conflict: 'STALE_VERSION' };
    }

    // Recalcul EN DIRECT sous verrou -- jamais une liste de preview
    // périmée. Seuls les accès dont le client_slug PUBLIÉ diffère
    // réellement du nouveau tournent -- jamais une rotation quand le
    // slug ne change pas (ex. seule la casse d'affichage a changé).
    const affected = await client.query(
      `select p.id as project_id, a.project_slug, a.client_slug from projects p
       join project_public_access a on a.project_id = p.id and a.status <> 'revoked'
       where p.client_id = $1
       for update of a`,
      [clientId]
    );
    let rotatedCount = 0;
    for (const row2 of affected.rows) {
      if (row2.client_slug === newSlug) continue;
      await rotateAccess(client, {
        tenantId, projectId: row2.project_id, clientSlug: newSlug, projectSlug: row2.project_slug,
        reason: 'client_renamed', encryptionKey
      });
      rotatedCount += 1;
    }

    await client.query('COMMIT');
    return { client: row, conflict: null, rotatedCount };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return { client: null, conflict: 'DUPLICATE_CLIENT_SLUG' };
    }
    throw err;
  } finally {
    client.release();
  }
}
