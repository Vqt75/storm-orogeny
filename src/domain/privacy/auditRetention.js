// Rétention audit_events -- Privacy & Data Lifecycle V1, Batch 3.
//
// Doctrine : purge physique 12 mois après occurred_at. Même
// convention que sessionRetention.js/invitationRetention.js --
// arithmétique de date entièrement côté Postgres (timestamptz,
// interval), jamais un calcul de mois en JS (les mois calendaires ne
// sont pas des durées fixes, jamais substitués par 365 jours).
//
// Suppression physique directe, aucun contenu retourné -- uniquement
// un compteur, jamais les événements eux-mêmes.

const AUDIT_EVENTS_RETENTION_MONTHS = 12;

export async function purgeOldAuditEvents(pool, { now = new Date() } = {}) {
  const { rowCount } = await pool.query(
    `delete from audit_events
     where occurred_at <= $1::timestamptz - interval '${AUDIT_EVENTS_RETENTION_MONTHS} months'`,
    [now]
  );
  return rowCount;
}
