// Repository Client — CRUD minimal nécessaire au Lot A. Aucune
// détection de quasi-doublon sémantique ici (ex. "AG2R" vs "AG2R LA
// MONDIALE") : décision produit explicite, la recherche Studio est la
// défense principale, jamais une règle bloquante côté serveur.
import { normalizeClientName } from './slug.js';

// createClient -- unicité (tenant_id, normalized_slug) imposée par la
// contrainte DB elle-même (voir migration 0018) ; ce repository ne
// fait qu'attraper la violation Postgres (code 23505) et la traduire
// en résultat métier, jamais une pré-vérification racy (select puis
// insert séparés) qui pourrait laisser passer une double création
// concurrente.
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
// jamais du slug seul (l'utilisateur tape un nom, pas un identifiant
// technique). Toujours scopée au tenant -- aucun résultat cross-tenant
// possible, quelle que soit la requête.
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

// renameClient -- verrouillage optimiste via `version`, motif déjà
// éprouvé (updateProjectIdentityColors). Retourne null si la version
// fournie est périmée (0 ligne affectée) -- l'appelant HTTP traduit
// cela en 409, jamais une écriture silencieuse sur un état qu'on n'a
// pas vu. Le conflit de slug dupliqué est distingué explicitement du
// conflit de version périmée -- deux causes différentes, deux réponses
// différentes.
export async function renameClient(pool, { tenantId, clientId, name, expectedVersion }) {
  const normalizedSlug = normalizeClientName(name);
  try {
    const { rows: [row] } = await pool.query(
      `update clients
       set name = $1, normalized_slug = $2, version = version + 1
       where id = $3 and tenant_id = $4 and version = $5
       returning id, tenant_id, name, normalized_slug, version, created_at`,
      [name.trim(), normalizedSlug, clientId, tenantId, expectedVersion]
    );
    if (!row) return { client: null, conflict: 'STALE_VERSION' };
    return { client: row, conflict: null };
  } catch (err) {
    if (err.code === '23505') {
      return { client: null, conflict: 'DUPLICATE_CLIENT_SLUG' };
    }
    throw err;
  }
}
