// Lecture Pilotage — lit EXCLUSIVEMENT les tables d'agrégats
// (daily_*_agg), jamais telemetry_events. C'est une garantie
// architecturale, pas seulement une politique : aucune fonction de ce
// fichier ne doit jamais recevoir un visitor_ref/session_ref en
// paramètre ou en retour.
//
// Exception documentée et bornée : "visiteurs uniques sur une période"
// exige un COUNT(DISTINCT visitor_ref) qui ne peut mathématiquement
// pas être dérivé d'une somme d'agrégats journaliers (voir doctrine
// verrouillée) — cette unique fonction lit telemetry_events, borne
// strictement sa période à la fenêtre de rétention brute, et ne
// retourne jamais qu'un entier agrégé, jamais une liste de références.

import { RAW_RETENTION_DAYS } from './telemetry.js';

// Bug trouvé et corrigé pendant l'implémentation, confirmé par test
// direct : passer un objet Date JS pour comparer une colonne `date`
// échoue SILENCIEUSEMENT avec le driver pg (aucune erreur levée,
// simplement aucune ligne trouvée) -- même avec un cast SQL explicite
// (::date), la sérialisation du paramètre côté client intervient avant
// que Postgres ne voie la valeur. Une chaîne 'YYYY-MM-DD' fonctionne
// correctement. Toute comparaison contre une colonne `date` (day) dans
// ce fichier doit donc TOUJOURS passer par ce helper -- jamais un objet
// Date brut. occurred_at (timestamptz) n'est PAS concerné : confirmé
// fonctionner correctement avec un objet Date brut (countUniqueVisitors).
function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

// Borne supérieure exclusive sur une colonne `date` (jour civil) : si
// `to` représente "maintenant" (ex. aujourd'hui 18h), tronquer
// directement en 'YYYY-MM-DD' produirait la date du jour même, et
// `day < aujourd'hui` EXCLURAIT alors la ligne du jour en cours (bug
// trouvé et corrigé pendant l'implémentation, confirmé par test
// direct). Décaler d'un jour avant troncature inclut correctement
// aujourd'hui, sans jamais rendre `<=` inclusif au niveau SQL -- ce
// qui aurait recréé un risque de double-comptage à la frontière entre
// la période courante et la période de comparaison précédente
// (compareTo = from de la période courante).
function toExclusiveUpperDateString(date) {
  return toDateString(new Date(date.getTime() + 24 * 60 * 60 * 1000));
}

// Résolution minimale, nécessaire à la route publique de collecte
// (non authentifiée -- aucun req.project fourni par un middleware).
// Retourne null si le projet n'existe pas OU n'est pas actif : la
// télémétrie ne doit jamais être acceptée pour un projet archivé.
export async function findActiveProjectTenant(pool, projectId) {
  const { rows } = await pool.query(
    `select tenant_id from projects where id = $1 and status = 'active'`,
    [projectId]
  );
  return rows[0]?.tenant_id ?? null;
}

// Effectif du projet -- nécessaire au seuil météo renforcé (voir
// getMoodDistribution). Compte les memberships actives, pas les
// invitations en attente (une invitation non acceptée n'est pas une
// personne ayant pu répondre à la météo).
export async function getProjectHeadcount(pool, projectId) {
  const { rows } = await pool.query(
    `select count(*) as n from project_memberships where project_id = $1 and status = 'active'`,
    [projectId]
  );
  return Number(rows[0].n);
}

function clampToRawRetention(from) {
  const earliest = new Date(Date.now() - RAW_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return from < earliest ? earliest : from;
}

// Seule fonction de ce module à lire telemetry_events -- voir
// commentaire d'en-tête. Retourne { value, exact } : exact=false si la
// période demandée dépasse la fenêtre de rétention brute (la valeur
// retournée est alors bornée à la portion encore couverte, jamais
// silencieusement fausse).
export async function countUniqueVisitors(pool, { projectId, from, to }) {
  const boundedFrom = clampToRawRetention(from);
  const exact = boundedFrom.getTime() === from.getTime();
  const { rows } = await pool.query(
    `select count(distinct visitor_ref) as n from telemetry_events
     where project_id = $1 and visitor_ref is not null and occurred_at >= $2 and occurred_at < $3`,
    [projectId, boundedFrom, to]
  );
  return { value: Number(rows[0].n), exact };
}

export async function getUsageSeries(pool, { projectId, from, to }) {
  const { rows } = await pool.query(
    `select day, unique_visitors, sessions, returning_sessions, page_views
     from daily_usage_agg where project_id = $1 and day >= $2 and day < $3 order by day asc`,
    [projectId, toDateString(from), toExclusiveUpperDateString(to)]
  );
  return rows;
}

export async function getUsageTotals(pool, { projectId, from, to }) {
  const { rows } = await pool.query(
    `select coalesce(sum(sessions),0) as sessions,
            coalesce(sum(returning_sessions),0) as returning_sessions,
            coalesce(sum(page_views),0) as page_views
     from daily_usage_agg where project_id = $1 and day >= $2 and day < $3`,
    [projectId, toDateString(from), toExclusiveUpperDateString(to)]
  );
  return {
    sessions: Number(rows[0].sessions),
    returningSessions: Number(rows[0].returning_sessions),
    pageViews: Number(rows[0].page_views)
  };
}

export async function getContentBreakdown(pool, { projectId, from, to }) {
  const { rows } = await pool.query(
    `select path, sum(page_views) as page_views
     from daily_content_agg where project_id = $1 and day >= $2 and day < $3
     group by path order by page_views desc`,
    [projectId, toDateString(from), toExclusiveUpperDateString(to)]
  );
  return rows.map(r => ({ path: r.path, pageViews: Number(r.page_views) }));
}

export async function getMatchSummary(pool, { projectId, from, to }) {
  const { rows } = await pool.query(
    `select outcome, matched_entry_id, confidence_bucket, sum(count) as n
     from daily_match_agg where project_id = $1 and day >= $2 and day < $3
     group by outcome, matched_entry_id, confidence_bucket`,
    [projectId, toDateString(from), toExclusiveUpperDateString(to)]
  );
  return rows.map(r => ({
    outcome: r.outcome,
    matchedEntryId: r.matched_entry_id,
    confidenceBucket: r.confidence_bucket,
    count: Number(r.n)
  }));
}

// Météo -- seuil de confidentialité appliqué ICI, jamais côté client :
// une réponse sous le seuil n'est jamais transmise, quelle que soit la
// capability de l'appelant. Seuil renforcé verrouillé : max(5, 15% de
// l'effectif du projet), jamais le seul n>=5 historique de Tectonic.
export async function getMoodDistribution(pool, { projectId, from, to, projectHeadcount }) {
  const { rows } = await pool.query(
    `select value, sum(count) as n
     from daily_mood_agg where project_id = $1 and day >= $2 and day < $3
     group by value order by value asc`,
    [projectId, toDateString(from), toExclusiveUpperDateString(to)]
  );
  const total = rows.reduce((sum, r) => sum + Number(r.n), 0);
  const threshold = Math.max(5, Math.ceil((projectHeadcount || 0) * 0.15));
  if (total < threshold) {
    return { total, threshold, meetsThreshold: false, distribution: [] };
  }
  return {
    total,
    threshold,
    meetsThreshold: true,
    distribution: rows.map(r => ({ value: r.value, count: Number(r.n) }))
  };
}
