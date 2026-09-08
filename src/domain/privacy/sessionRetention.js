// Rétention auth_sessions -- Privacy & Data Lifecycle V1, Batch 2.
//
// Doctrine : une session devient invalide au PREMIER de expires_at ou
// revoked_at (jamais uniquement l'un des deux) -- l'horloge de 7 jours
// démarre à ce premier instant d'invalidation, pas nécessairement à
// la révocation. Exemples exacts confirmés par test :
//   - expire le 1er, jamais révoquée -> invalidation = 1er
//   - révoquée le 1er, expiration prévue le 20 -> invalidation = 1er
//   - expire le 1er, révoquée administrativement le 3 -> invalidation
//     reste le 1er (la première des deux dates, jamais la dernière
//     action effectuée)
//
// SQL : least(expires_at, coalesce(revoked_at, expires_at)) --
// lorsque revoked_at est NULL, coalesce renvoie expires_at, donc
// least(expires_at, expires_at) = expires_at (session jamais révoquée,
// seule l'expiration compte). Lorsque revoked_at est renseigné, least
// choisit correctement la plus ancienne des deux dates.
//
// Suppression physique directe -- jamais un tombstone. Une session
// supprimée est terminée, aucune trace n'est utile au-delà (voir
// audit_events pour toute trace d'audit qui en aurait besoin
// ailleurs -- hors scope de cette primitive).

const PURGE_AFTER_INVALIDATION_DAYS = 7;

export async function purgeExpiredSessions(pool, { now = new Date() } = {}) {
  const { rowCount } = await pool.query(
    `delete from auth_sessions
     where least(expires_at, coalesce(revoked_at, expires_at)) <= $1::timestamptz - interval '${PURGE_AFTER_INVALIDATION_DAYS} days'`,
    [now]
  );
  return rowCount;
}
