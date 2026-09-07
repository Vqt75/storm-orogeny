// Repository external_identities — Batch 1 des fondations SSO /
// External Identity V1. Fonctions typées et nommées, jamais de SQL
// brut ailleurs. Aucune de ces fonctions n'introduit de logique
// AuthN publique -- ce module ne fait que poser les primitives de
// liaison/révocation qu'un futur batch (routes /auth/*) consommera.
//
// Invariant central, jamais dérogé : l'identité canonique d'une
// identité externe est (issuer, subject), JAMAIS l'email. Aucune
// fonction de ce fichier ne résout ou ne matche par email -- si un
// jour un tel besoin apparaît, il appartient à un autre module,
// explicitement, jamais glissé ici par commodité.

export async function findExternalIdentityByIssuerSubject(pool, { issuer, subject }) {
  const { rows } = await pool.query(
    `select id, provider_type, issuer, subject, user_id, email_at_linking,
            status, created_at, revoked_at
     from external_identities
     where issuer = $1 and subject = $2`,
    [issuer, subject]
  );
  return rows[0] ?? null;
}

// Crée une liaison -- jamais un upsert silencieux. Si (issuer, subject)
// existe déjà (contrainte unique réelle en base), retourne un résultat
// structuré {ok:false, code:'DUPLICATE'} plutôt que de laisser fuiter
// l'exception Postgres brute jusqu'à l'appelant -- même convention que
// le reste du domaine (voir memberships/repository.js, revokeProjectGrant).
export async function createExternalIdentity(pool, { providerType, issuer, subject, userId, emailAtLinking = null }) {
  try {
    const { rows: [row] } = await pool.query(
      `insert into external_identities (provider_type, issuer, subject, user_id, email_at_linking)
       values ($1, $2, $3, $4, $5)
       returning id, provider_type, issuer, subject, user_id, email_at_linking, status, created_at, revoked_at`,
      [providerType, issuer, subject, userId, emailAtLinking]
    );
    return { ok: true, identity: row };
  } catch (err) {
    if (err.code === '23505') {
      // Violation de la contrainte unique (issuer, subject) -- jamais
      // une collision silencieuse, jamais une seconde ligne pour la
      // même identité canonique.
      return { ok: false, code: 'DUPLICATE' };
    }
    throw err;
  }
}

export async function listExternalIdentitiesForUser(pool, userId) {
  const { rows } = await pool.query(
    `select id, provider_type, issuer, subject, email_at_linking, status, created_at, revoked_at
     from external_identities
     where user_id = $1
     order by created_at asc`,
    [userId]
  );
  return rows;
}

// Révoque une identité externe précise -- jamais une cascade
// implicite vers d'autres identités du même utilisateur. La
// révocation des sessions correspondantes (uniquement celles liées à
// CETTE identité, jamais toutes les sessions de l'utilisateur) est la
// responsabilité de sessions.js, appelée séparément par le futur appelant
// -- ce module ne touche jamais lui-même à auth_sessions, pour rester
// à une seule responsabilité.
export async function revokeExternalIdentity(pool, { externalIdentityId }) {
  const { rows: [row] } = await pool.query(
    `update external_identities set status = 'revoked', revoked_at = now()
     where id = $1 and status = 'active'
     returning id, provider_type, issuer, subject, user_id, email_at_linking, status, created_at, revoked_at`,
    [externalIdentityId]
  );
  return row ?? null;
}
