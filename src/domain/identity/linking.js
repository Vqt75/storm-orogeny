// Résolution/liaison d'identité externe -- Batch 2, sous-ensemble
// minimal de la state machine validée. Couvre exactement :
//   (issuer, subject) déjà liée -> résolution directe
//   nouvelle identité, aucune collision d'email -> création user + identity
//   collision d'email avec un user existant non lié -> fail closed
// N'implémente PAS : pont invitation, réconciliation de groupes --
// batches ultérieurs.

import { findExternalIdentityByIssuerSubject, createExternalIdentity } from './repository.js';
import { findUserByEmail, insertUser } from '../users/repository.js';

export async function resolveOrLinkIdentity(pool, { providerType, issuer, subject, email, emailVerified, displayName }) {
  const existing = await findExternalIdentityByIssuerSubject(pool, { issuer, subject });
  if (existing) {
    if (existing.status !== 'active') {
      return { ok: false, code: 'IDENTITY_REVOKED' };
    }
    // Déjà liée : résolution strictement par (issuer, subject), l'email
    // n'intervient plus jamais à ce stade, vérifié ou non.
    return { ok: true, userId: existing.user_id, externalIdentityId: existing.id };
  }

  // Pas encore liée -- un email NON vérifié ne peut servir ni à
  // chercher une collision ni à créer un compte : on ne peut pas s'y
  // fier assez pour l'une ou l'autre décision (doctrine validée).
  if (!email || emailVerified !== true) {
    return { ok: false, code: 'EMAIL_NOT_VERIFIED' };
  }

  const existingUser = await findUserByEmail(pool, email);
  if (existingUser) {
    // Fail closed, TOUJOURS -- même un email affirmé vérifié ne
    // suffit jamais, seul, à revendiquer un compte Storm préexistant
    // non lié (doctrine validée). Aucune fusion automatique.
    return { ok: false, code: 'EMAIL_COLLISION' };
  }

  const createdUser = await insertUser(pool, { email, displayName: displayName || email });
  if (!createdUser.ok) {
    // Duplicate détecté seulement à l'insertion (course) -- traité
    // identiquement à une collision, jamais une fusion silencieuse.
    return { ok: false, code: 'EMAIL_COLLISION' };
  }

  const createdIdentity = await createExternalIdentity(pool, {
    providerType, issuer, subject, userId: createdUser.user.id, emailAtLinking: email
  });
  if (!createdIdentity.ok) {
    return { ok: false, code: 'DUPLICATE_IDENTITY' };
  }

  return { ok: true, userId: createdUser.user.id, externalIdentityId: createdIdentity.identity.id };
}
