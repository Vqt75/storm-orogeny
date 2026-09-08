// Rétention external_identities.email_at_linking -- Privacy & Data
// Lifecycle V1, Batch 9. Même convention que sessionRetention.js/
// invitationRetention.js/auditRetention.js/pilotageRetention.js --
// arithmétique de date entièrement côté Postgres, jamais un calcul JS.
//
// Doctrine : email_at_linking est une trace transitoire de liaison,
// jamais un attribut d'identité durable -- nullifiée 90 jours après
// created_at, jamais la ligne external_identities elle-même. issuer,
// subject, provider_type, user_id, status restent intacts -- l'identité
// externe reste parfaitement fonctionnelle après nullification (aucun
// code applicatif ne prend de décision sur la base de ce champ,
// confirmé par audit avant ce batch -- purement informationnel).
//
// created_at confirmé être le timestamp de PREMIÈRE création du lien
// (issuer, subject) -- jamais remis à zéro lors d'une reconnexion
// (resolveOrLinkIdentity réutilise la ligne existante, ne recrée
// jamais). Aucun `linked_at` artificiel introduit -- created_at est
// déjà le timestamp canonique correct.
//
// Statut (active/revoked) volontairement ignoré par le prédicat --
// le champ devient une trace obsolète après 90 jours quel que soit le
// statut, aucune raison de le conserver plus longtemps pour une
// identité révoquée que pour une identité active.
//
// Aucun index dédié ajouté : au volume V1 (nombre d'identités externes
// jamais lié à un trafic public à fort volume, borné par le nombre
// d'utilisateurs SSO réels), un scan complet de cette table reste
// largement suffisant -- jamais un sur-index sans besoin démontré.

export const EMAIL_AT_LINKING_RETENTION_DAYS = 90;

export async function nullifyOldEmailAtLinking(pool, { now = new Date() } = {}) {
  const { rowCount } = await pool.query(
    `update external_identities
     set email_at_linking = null
     where email_at_linking is not null
       and created_at < $1::timestamptz - interval '${EMAIL_AT_LINKING_RETENTION_DAYS} days'`,
    [now]
  );
  return rowCount;
}
