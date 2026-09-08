// Retention runner -- Privacy & Data Lifecycle V1. Point d'entrée
// unique et déterministe pour toutes les politiques de rétention V1.
// Batch 2 : sessions et invitations. Batch 3 : + audit_events.
// Batch 8 : + Pilotage raw (telemetry_events, 40 jours -- jamais les
// agrégats daily_*_agg, conservés jusqu'à suppression permanente du
// projet). Batch 9 : + external_identities.email_at_linking (90
// jours, nullification jamais suppression de ligne). User lifecycle,
// project deletion, publications (doctrine V1 finale : suivent le
// lifecycle projet, jamais un timer par âge) restent explicitement
// hors scope de ce runner -- chacun rejoindra ce même runner
// uniquement si une future doctrine l'exige, jamais un second
// orchestrateur parallèle.
//
// `now` est injectable -- jamais une dépendance implicite à l'horloge
// du process ni au fuseau horaire local du serveur. Toute
// l'arithmétique de date se fait côté Postgres (timestamptz, interval)
// à partir de cette seule valeur -- jamais un calcul de date en JS qui
// pourrait diverger du fuseau/horloge réels de la base.
//
// Transactionnalité : UNE transaction PAR POLITIQUE, jamais une
// transaction géante englobant tout. Sessions et invitations sont
// indépendantes -- une panne technique sur l'une ne doit jamais
// annuler le travail déjà correctement effectué par l'autre. Chaque
// politique reste par elle-même idempotente et rejouable : un second
// run immédiat produit des compteurs à zéro, jamais un effet de bord.
//
// Sur échec technique d'UNE politique : ROLLBACK de cette politique
// précise, l'erreur remonte au caller (jamais transformée en simple
// avertissement), les politiques déjà commitées avant elle restent
// acquises.
//
// Résultat structuré, jamais de donnée personnelle : uniquement des
// compteurs. Logs : jamais un email, un hash de session, un user_id
// sans utilité, un issuer/subject, un contenu métier -- uniquement le
// nom de la politique et ses compteurs.

import { purgeExpiredSessions } from './sessionRetention.js';
import { expirePendingInvitations, purgeTerminalInvitations } from './invitationRetention.js';
import { purgeOldAuditEvents } from './auditRetention.js';
import { purgeOldTelemetryEvents } from './pilotageRetention.js';
import { nullifyOldEmailAtLinking } from './externalIdentityRetention.js';

async function runPolicyInOwnTransaction(pool, { logger, policyName, work }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    logger.info({ ...result }, `retention.${policyName}.completed`);
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error(
      { err: { name: err.name, message: err.message } },
      `retention.${policyName}.failed`
    );
    throw err;
  } finally {
    client.release();
  }
}

export async function runRetentionPolicies(pool, { now = new Date(), logger }) {
  logger.info({}, 'retention.started');

  const sessions = await runPolicyInOwnTransaction(pool, {
    logger,
    policyName: 'sessions',
    work: async (client) => ({ purged: await purgeExpiredSessions(client, { now }) })
  });

  const invitations = await runPolicyInOwnTransaction(pool, {
    logger,
    policyName: 'invitations',
    work: async (client) => {
      const expired = await expirePendingInvitations(client, { now });
      const purged = await purgeTerminalInvitations(client, { now });
      return { expired, purged };
    }
  });

  const auditEvents = await runPolicyInOwnTransaction(pool, {
    logger,
    policyName: 'audit_events',
    work: async (client) => ({ purged: await purgeOldAuditEvents(client, { now }) })
  });

  const pilotage = await runPolicyInOwnTransaction(pool, {
    logger,
    policyName: 'pilotage',
    work: async (client) => ({ purged: await purgeOldTelemetryEvents(client, { now }) })
  });

  const externalIdentities = await runPolicyInOwnTransaction(pool, {
    logger,
    policyName: 'external_identities',
    work: async (client) => ({ emailsNullified: await nullifyOldEmailAtLinking(client, { now }) })
  });

  const result = { sessions, invitations, auditEvents, pilotage, externalIdentities };
  logger.info({ result }, 'retention.completed');
  return result;
}
