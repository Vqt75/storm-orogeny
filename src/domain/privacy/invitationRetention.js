// Rétention project_invitations -- Privacy & Data Lifecycle V1,
// Batch 2.
//
// Deux gestes distincts, volontairement dans la même politique (une
// seule transaction, voir retentionRunner.js) car ils forment un seul
// cycle de vie cohérent :
//   1. pending -> expired après 90 jours sans action (jamais retransité
//      une fois accepted/revoked/expired).
//   2. Suppression physique d'une ligne terminale (accepted/revoked/
//      expired) 12 mois après son passage RÉEL dans cet état -- jamais
//      created_at comme substitut si l'invitation est restée pending
//      longtemps (ex. créée en janvier, acceptée en juin -> conservée
//      jusqu'en juin l'année suivante, jamais janvier).
//
// Timestamp de référence exact par état, jamais détourné :
//   accepted -> accepted_at (déjà existant)
//   revoked  -> revoked_at  (ajouté migration 0014, désormais réellement
//                            renseigné par revokeProjectInvitation)
//   expired  -> expired_at  (ajouté migration 0014, renseigné par
//                            expirePendingInvitations ci-dessous)
//
// Provenance : aucune FK ne référence project_invitations (confirmé
// par audit direct du catalogue Postgres avant d'écrire ce module) --
// l'invitation devient purement historique dès son acceptation
// (membership + grant portent la provenance durable, jamais
// l'invitation elle-même). Sa suppression physique après 12 mois ne
// casse donc jamais rien.
//
// Email minimisé par construction : aucun hashing préalable, aucun
// tombstone, aucune table d'archive -- la ligne entière disparaît,
// l'email avec elle. Moins de données conservées est préférable à une
// archive supplémentaire (doctrine validée).
//
// Lignes historiques dont le timestamp terminal pertinent serait NULL
// (ex. une invitation révoquée avant la migration 0014, jamais
// horodatée à l'époque) ne sont JAMAIS purgées par une estimation --
// conservées prudemment plutôt que purgées sur une donnée incertaine.

const PENDING_EXPIRES_AFTER_DAYS = 90;
const TERMINAL_RETENTION_MONTHS = 12;

export async function expirePendingInvitations(pool, { now = new Date() } = {}) {
  const { rowCount } = await pool.query(
    `update project_invitations
     set status = 'expired', expired_at = $1
     where status = 'pending'
       and created_at <= $1::timestamptz - interval '${PENDING_EXPIRES_AFTER_DAYS} days'`,
    [now]
  );
  return rowCount;
}

export async function purgeTerminalInvitations(pool, { now = new Date() } = {}) {
  const { rowCount } = await pool.query(
    `delete from project_invitations
     where (status = 'accepted' and accepted_at is not null and accepted_at <= $1::timestamptz - interval '${TERMINAL_RETENTION_MONTHS} months')
        or (status = 'revoked'  and revoked_at  is not null and revoked_at  <= $1::timestamptz - interval '${TERMINAL_RETENTION_MONTHS} months')
        or (status = 'expired'  and expired_at  is not null and expired_at  <= $1::timestamptz - interval '${TERMINAL_RETENTION_MONTHS} months')`,
    [now]
  );
  return rowCount;
}
