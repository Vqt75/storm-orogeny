// Repository télémétrie Pilotage — doctrine verrouillée : "Storm
// mesure le changement, pas les collaborateurs." Toute la logique de
// session/agrégation vit ici, jamais dans la route HTTP.
//
// Contrat de session (verrouillé) : 30 minutes d'inactivité OU 4
// heures de durée absolue, selon la première limite atteinte.
// Détermination strictement côté serveur — le client ne décide
// jamais quand une session commence ou finit.
const SESSION_IDLE_MS = 30 * 60 * 1000;
const SESSION_MAX_DURATION_MS = 4 * 60 * 60 * 1000;

// Fenêtre de rétention des événements bruts (telemetry_events). Toute
// requête "visiteurs uniques sur une période" au-delà de cette fenêtre
// n'est structurellement plus exacte — jamais servie silencieusement.
export const RAW_RETENTION_DAYS = 40;

// Purge opportuniste, sans cron ni table d'état supplémentaire (voir
// addendum, point 5 : aucune infrastructure Render/Neon nouvelle
// supposée). Déclenchée avec une faible probabilité à chaque écriture
// — un léger retard de purge ne compromet jamais la doctrine de
// rétention (40 jours, marge large), un déclenchement systématique à
// chaque écriture serait un coût inutile.
const PURGE_TRIGGER_PROBABILITY = 0.02;

async function maybePurgeOldEvents(pool) {
  if (Math.random() >= PURGE_TRIGGER_PROBABILITY) return;
  await pool.query(`delete from telemetry_events where occurred_at < now() - interval '${RAW_RETENTION_DAYS} days'`);
}

// Détermine le session_ref à utiliser pour ce visitor_ref : réutilise
// la session ouverte si elle existe et n'a expiré ni par inactivité ni
// par durée absolue, sinon en ouvre une nouvelle. Retourne aussi
// isNewSession et isReturningVisitor (le visitor_ref avait-il déjà une
// session AVANT celle-ci, dans la fenêtre de rétention brute ?).
async function resolveSession(pool, { projectId, visitorRef, now }) {
  const { rows: lastEventRows } = await pool.query(
    `select session_ref, occurred_at from telemetry_events
     where project_id = $1 and visitor_ref = $2
     order by occurred_at desc limit 1`,
    [projectId, visitorRef]
  );
  const lastEvent = lastEventRows[0];

  if (!lastEvent) {
    return { sessionRef: crypto.randomUUID(), isNewSession: true, isReturningVisitor: false };
  }

  const idleMs = now.getTime() - new Date(lastEvent.occurred_at).getTime();
  const { rows: sessionStartRows } = await pool.query(
    `select min(occurred_at) as started_at from telemetry_events where session_ref = $1`,
    [lastEvent.session_ref]
  );
  const sessionDurationMs = now.getTime() - new Date(sessionStartRows[0].started_at).getTime();

  const sessionStillOpen = idleMs < SESSION_IDLE_MS && sessionDurationMs < SESSION_MAX_DURATION_MS;
  if (sessionStillOpen) {
    return { sessionRef: lastEvent.session_ref, isNewSession: false, isReturningVisitor: false };
  }
  // Nouvelle session -- le visitor_ref était déjà connu avant (lastEvent
  // existe), donc cette nouvelle session est par définition un retour.
  return { sessionRef: crypto.randomUUID(), isNewSession: true, isReturningVisitor: true };
}

export async function recordPageView(pool, { tenantId, projectId, visitorRef, path, now = new Date() }) {
  const day = now.toISOString().slice(0, 10);

  const { rows: seenTodayRows } = await pool.query(
    `select 1 from telemetry_events
     where project_id = $1 and visitor_ref = $2 and occurred_at >= $3::date and occurred_at < $3::date + interval '1 day'
     limit 1`,
    [projectId, visitorRef, day]
  );
  const isFirstEventToday = seenTodayRows.length === 0;

  const { sessionRef, isNewSession, isReturningVisitor } = await resolveSession(pool, { projectId, visitorRef, now });

  await pool.query(
    `insert into telemetry_events (tenant_id, project_id, event_type, visitor_ref, session_ref, path, occurred_at)
     values ($1,$2,'page_view',$3,$4,$5,$6)`,
    [tenantId, projectId, visitorRef, sessionRef, path || null, now]
  );

  await pool.query(
    `insert into daily_usage_agg (tenant_id, project_id, day, unique_visitors, sessions, returning_sessions, page_views)
     values ($1,$2,$3,$4,$5,$6,1)
     on conflict (tenant_id, project_id, day) do update set
       unique_visitors = daily_usage_agg.unique_visitors + excluded.unique_visitors,
       sessions = daily_usage_agg.sessions + excluded.sessions,
       returning_sessions = daily_usage_agg.returning_sessions + excluded.returning_sessions,
       page_views = daily_usage_agg.page_views + 1`,
    [tenantId, projectId, day, isFirstEventToday ? 1 : 0, isNewSession ? 1 : 0, (isNewSession && isReturningVisitor) ? 1 : 0]
  );

  if (path) {
    await pool.query(
      `insert into daily_content_agg (tenant_id, project_id, day, path, page_views)
       values ($1,$2,$3,$4,1)
       on conflict (tenant_id, project_id, day, path) do update set page_views = daily_content_agg.page_views + 1`,
      [tenantId, projectId, day, path]
    );
  }

  await maybePurgeOldEvents(pool);
  return { sessionRef };
}

export async function recordMatchResult(pool, { tenantId, projectId, visitorRef, outcome, matchedEntryId, confidenceBucket, now = new Date() }) {
  const day = now.toISOString().slice(0, 10);
  // Storm Match reste rattaché à une session (comme une page_view),
  // pour permettre de relier une recherche à une visite -- jamais au
  // texte recherché, jamais à une identité.
  const { sessionRef } = await resolveSession(pool, { projectId, visitorRef, now });

  await pool.query(
    `insert into telemetry_events (tenant_id, project_id, event_type, visitor_ref, session_ref, outcome, matched_entry_id, confidence_bucket, occurred_at)
     values ($1,$2,'match_result',$3,$4,$5,$6,$7,$8)`,
    [tenantId, projectId, visitorRef, sessionRef, outcome, matchedEntryId || null, confidenceBucket || null, now]
  );

  await pool.query(
    `insert into daily_match_agg (tenant_id, project_id, day, outcome, matched_entry_id, confidence_bucket, count)
     values ($1,$2,$3,$4,$5,$6,1)
     on conflict (tenant_id, project_id, day, outcome, coalesce(matched_entry_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(confidence_bucket, ''))
     do update set count = daily_match_agg.count + 1`,
    [tenantId, projectId, day, outcome, matchedEntryId || null, confidenceBucket || null]
  );

  await maybePurgeOldEvents(pool);
}

// Météo -- jamais de visitor_ref/session_ref, y compris dans
// telemetry_events (voir doctrine verrouillée : seule catégorie
// réellement anonyme dès la collecte, pas seulement pseudonyme).
export async function recordMoodFeedback(pool, { tenantId, projectId, value, now = new Date() }) {
  const day = now.toISOString().slice(0, 10);

  await pool.query(
    `insert into telemetry_events (tenant_id, project_id, event_type, mood_value, occurred_at)
     values ($1,$2,'mood_feedback',$3,$4)`,
    [tenantId, projectId, value, now]
  );

  await pool.query(
    `insert into daily_mood_agg (tenant_id, project_id, day, value, count)
     values ($1,$2,$3,$4,1)
     on conflict (tenant_id, project_id, day, value) do update set count = daily_mood_agg.count + 1`,
    [tenantId, projectId, day, value]
  );

  await maybePurgeOldEvents(pool);
}
