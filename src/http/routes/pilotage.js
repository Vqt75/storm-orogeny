import { Router } from 'express';
import XLSX from 'xlsx';
import { requireProjectCapability } from '../middleware/requireProjectCapability.js';
import { ProjectCapability } from '../../domain/permissions/capabilities.js';
import {
  countUniqueVisitors, getUsageSeries, getUsageTotals, getContentBreakdown,
  getMatchSummary, getMoodDistribution, getProjectHeadcount
} from '../../domain/pilotage/reporting.js';
import { Errors } from '../../errors/AppError.js';

const VALID_PERIODS = new Set([7, 30]);

// Résout les bornes [from, to) pour la période courante ET la période
// de comparaison précédente, de même durée -- jamais une comparaison
// entre deux durées différentes (doctrine KPI verrouillée).
function resolvePeriod(periodDays) {
  const to = new Date();
  const from = new Date(to.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const compareTo = from;
  const compareFrom = new Date(from.getTime() - periodDays * 24 * 60 * 60 * 1000);
  return { from, to, compareFrom, compareTo };
}

function computeDelta(current, previous) {
  if (previous === 0) return current === 0 ? { value: 0, comparable: false } : { value: null, comparable: false };
  return { value: Math.round(((current - previous) / previous) * 1000) / 10, comparable: true };
}

async function buildPilotageData(pool, { projectId, periodDays }) {
  const { from, to, compareFrom, compareTo } = resolvePeriod(periodDays);

  const [uniqueVisitors, previousUniqueVisitors, totals, previousTotals, usageSeries, content, match, headcount] = await Promise.all([
    countUniqueVisitors(pool, { projectId, from, to }),
    countUniqueVisitors(pool, { projectId, from: compareFrom, to: compareTo }),
    getUsageTotals(pool, { projectId, from, to }),
    getUsageTotals(pool, { projectId, from: compareFrom, to: compareTo }),
    getUsageSeries(pool, { projectId, from, to }),
    getContentBreakdown(pool, { projectId, from, to }),
    getMatchSummary(pool, { projectId, from, to }),
    getProjectHeadcount(pool, projectId)
  ]);
  const mood = await getMoodDistribution(pool, { projectId, from, to, projectHeadcount: headcount });

  const totalPageViewsForContent = content.reduce((s, c) => s + c.pageViews, 0);
  const matchedTotal = match.filter(m => m.outcome === 'matched').reduce((s, m) => s + m.count, 0);
  const totalRequests = match.reduce((s, m) => s + m.count, 0);
  const abstainedTotal = match.filter(m => m.outcome === 'abstained').reduce((s, m) => s + m.count, 0);

  const returningRate = totals.sessions > 0 ? Math.round((totals.returningSessions / totals.sessions) * 1000) / 10 : null;
  const previousReturningRate = previousTotals.sessions > 0 ? Math.round((previousTotals.returningSessions / previousTotals.sessions) * 1000) / 10 : null;
  const pageViewsPerSession = totals.sessions > 0 ? Math.round((totals.pageViews / totals.sessions) * 10) / 10 : null;
  const previousPageViewsPerSession = previousTotals.sessions > 0 ? Math.round((previousTotals.pageViews / previousTotals.sessions) * 10) / 10 : null;
  const coverageRate = totalRequests > 0 ? Math.round((matchedTotal / totalRequests) * 1000) / 10 : null;

  return {
    period: { days: periodDays, from: from.toISOString(), to: to.toISOString() },
    kpis: {
      uniqueVisitors: { value: uniqueVisitors.value, exact: uniqueVisitors.exact, delta: computeDelta(uniqueVisitors.value, previousUniqueVisitors.value) },
      sessions: { value: totals.sessions, delta: computeDelta(totals.sessions, previousTotals.sessions) },
      returningRate: { value: returningRate, delta: returningRate !== null && previousReturningRate !== null ? { value: Math.round((returningRate - previousReturningRate) * 10) / 10, comparable: true, isPoints: true } : { value: null, comparable: false } },
      pageViewsPerSession: { value: pageViewsPerSession, delta: pageViewsPerSession !== null && previousPageViewsPerSession !== null ? computeDelta(pageViewsPerSession, previousPageViewsPerSession) : { value: null, comparable: false } },
      matchRequests: { value: totalRequests, delta: null },
      coverageRate: { value: coverageRate, delta: null },
      moodResponses: { value: mood.total, meetsThreshold: mood.meetsThreshold }
    },
    usageSeries: usageSeries.map(r => ({ day: r.day, sessions: r.sessions, uniqueVisitors: r.unique_visitors })),
    content: content.map(c => ({ path: c.path, pageViews: c.pageViews, share: totalPageViewsForContent > 0 ? Math.round((c.pageViews / totalPageViewsForContent) * 1000) / 10 : 0 })),
    match: {
      total: totalRequests,
      abstained: abstainedTotal,
      coverageRate,
      top: match.filter(m => m.outcome === 'matched' && m.matchedEntryId).sort((a, b) => b.count - a.count).slice(0, 10)
        .map(m => ({ matchedEntryId: m.matchedEntryId, count: m.count, share: matchedTotal > 0 ? Math.round((m.count / matchedTotal) * 1000) / 10 : 0, confidenceBucket: m.confidenceBucket }))
    },
    mood: { total: mood.total, threshold: mood.threshold, meetsThreshold: mood.meetsThreshold, distribution: mood.distribution }
  };
}

export function createPilotageRouter({ pool }) {
  const router = Router();

  router.get(
    '/:projectId/pilotage',
    requireProjectCapability(pool, ProjectCapability.PILOTAGE_VIEW),
    async (req, res, next) => {
      const periodDays = VALID_PERIODS.has(Number(req.query.period)) ? Number(req.query.period) : 30;
      try {
        const data = await buildPilotageData(pool, { projectId: req.project.id, periodDays });
        res.status(200).json(data);
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/:projectId/pilotage/export.xlsx',
    requireProjectCapability(pool, ProjectCapability.PILOTAGE_VIEW),
    async (req, res, next) => {
      const periodDays = VALID_PERIODS.has(Number(req.query.period)) ? Number(req.query.period) : 30;
      try {
        const data = await buildPilotageData(pool, { projectId: req.project.id, periodDays });
        const buffer = buildWorkbook(data, req.project.name);
        res.status(200)
          .set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
          .set('Content-Disposition', `attachment; filename="pilotage-${req.project.id}.xlsx"`)
          .send(buffer);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

// Export -- reprend EXACTEMENT les mêmes données que buildPilotageData
// (aucun accès direct différent à la base), pour garantir que l'export
// ne puisse structurellement jamais exposer plus que l'interface. Pas
// d'onglet raw events, pas de parcours individuel, pas de requête
// Storm Match rattachable à un individu (voir doctrine verrouillée).
function buildWorkbook(data, projectName) {
  const wb = XLSX.utils.book_new();

  const synthese = [
    ['KPI', 'Valeur', 'Unité', 'Évolution', 'Période'],
    ['Visiteurs uniques', data.kpis.uniqueVisitors.value, 'personnes', data.kpis.uniqueVisitors.exact ? formatDelta(data.kpis.uniqueVisitors.delta) : 'non comparable (hors fenêtre de rétention exacte)', `${data.period.days} derniers jours`],
    ['Sessions', data.kpis.sessions.value, 'visites', formatDelta(data.kpis.sessions.delta), `${data.period.days} derniers jours`],
    ['Taux de retour', data.kpis.returningRate.value, '%', formatDelta(data.kpis.returningRate.delta), `${data.period.days} derniers jours`],
    ['Pages vues / session', data.kpis.pageViewsPerSession.value, 'pages', formatDelta(data.kpis.pageViewsPerSession.delta), `${data.period.days} derniers jours`],
    ['Requêtes Storm Match', data.kpis.matchRequests.value, 'requêtes', '', `${data.period.days} derniers jours`],
    ['Taux de couverture', data.kpis.coverageRate.value, '%', '', `${data.period.days} derniers jours`],
    ['Réponses météo', data.kpis.moodResponses.value, 'réponses', '', `${data.period.days} derniers jours`]
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(synthese), 'Synthèse');

  const audience = [['Jour', 'Sessions', 'Visiteurs actifs ce jour'], ...data.usageSeries.map(d => [d.day, d.sessions, d.uniqueVisitors])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(audience), 'Audience');

  const contenus = [['Rubrique', 'Vues', 'Part'], ...data.content.map(c => [c.path, c.pageViews, `${c.share}%`])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(contenus), 'Contenus');

  const matchSheet = [
    ['Volume de requêtes', data.match.total],
    ['Taux de couverture', data.match.coverageRate !== null ? `${data.match.coverageRate}%` : 'non calculable'],
    ['Sans correspondance', data.match.abstained],
    [],
    ['Contenu', 'Requêtes', 'Part', 'Confiance'],
    ...data.match.top.map(m => [m.matchedEntryId, m.count, `${m.share}%`, m.confidenceBucket || ''])
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matchSheet), 'Storm Match');

  const meteo = data.mood.meetsThreshold
    ? [['Réponses', data.mood.total], [], ['Note', 'Nombre', 'Part'], ...data.mood.distribution.map(d => [d.value, d.count, `${Math.round((d.count / data.mood.total) * 1000) / 10}%`])]
    : [['Réponses', data.mood.total], ['Distribution non affichée -- sous le seuil de confidentialité (' + data.mood.threshold + ' réponses minimum)']];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meteo), 'Météo du projet');

  const methodologie = [
    ['KPI', 'Définition', 'Fenêtre', 'Source'],
    ['Visiteurs uniques', 'Pseudonymes navigateur distincts observés sur la période. Exact uniquement dans la fenêtre de rétention brute.', `${data.period.days} jours`, 'telemetry_events (bruts, pseudonymes)'],
    ['Session', 'Période d\'activité continue : nouvelle session après 30 min d\'inactivité ou 4h de durée continue.', `${data.period.days} jours`, 'daily_usage_agg'],
    ['Taux de retour', 'Part des sessions dont le pseudonyme avait déjà une session antérieure dans la fenêtre de rétention.', `${data.period.days} jours`, 'daily_usage_agg'],
    ['Taux de couverture', 'Part des requêtes Storm Match ayant obtenu une correspondance.', `${data.period.days} jours`, 'daily_match_agg'],
    ['Météo du projet', `Distribution des réponses, jamais affichée sous ${data.mood.threshold} réponses (seuil de confidentialité).`, `${data.period.days} jours`, 'daily_mood_agg'],
    [],
    ['Confidentialité', 'Storm mesure le changement, pas les collaborateurs. Aucune donnée individuelle, aucun parcours nominatif, aucune requête Storm Match rattachable à une personne.']
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(methodologie), 'Méthodologie');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function formatDelta(delta) {
  if (!delta || !delta.comparable) return 'non comparable';
  return delta.isPoints ? `${delta.value > 0 ? '+' : ''}${delta.value} pts` : `${delta.value > 0 ? '+' : ''}${delta.value}%`;
}
