// Rétention telemetry_events (Pilotage, données brutes pseudonymisées)
// -- Privacy & Data Lifecycle V1, Batch 8. Même convention que
// sessionRetention.js/invitationRetention.js/auditRetention.js --
// arithmétique de date entièrement côté Postgres (timestamptz,
// interval), jamais un calcul JS.
//
// FRONTIÈRE RAW / AGREGATS (doctrine verrouillée, jamais franchie
// ici) : seul telemetry_events est purgé par âge. Les quatre
// daily_*_agg (usage, content, match, mood) sont des agrégats
// durables sans identifiant individuel -- conservés pendant toute la
// vie du projet, supprimés uniquement par la suppression permanente
// du projet (cascade déjà en place, Batch 6). Aucun timer M+1/M+3,
// aucune purge par âge sur les agrégats dans ce batch ni ailleurs.
//
// Prédicat canonique : occurred_at < now - 40 jours -- strictement
// plus ancien est éligible, exactement au cutoff est conservé.

export const PILOTAGE_RAW_RETENTION_DAYS = 40;

export async function purgeOldTelemetryEvents(pool, { now = new Date() } = {}) {
  const { rowCount } = await pool.query(
    `delete from telemetry_events
     where occurred_at < $1::timestamptz - interval '${PILOTAGE_RAW_RETENTION_DAYS} days'`,
    [now]
  );
  return rowCount;
}
