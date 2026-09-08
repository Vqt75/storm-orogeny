// Résolution/liaison d'identité externe -- Batch 3. Couvre :
//   (issuer, subject) déjà liée -> résolution directe
//   nouvelle identité, aucune collision d'email -> création user + identity
//     + pont invitation (réclame les invitations pending pour cet
//     email, UNIQUEMENT à cet instant précis -- voir plus bas)
//   collision d'email avec un user existant non lié -> fail closed
// N'implémente PAS la réconciliation de groupes (voir
// groupReconciliation.js, appelé séparément après linking réussi).
//
// issuerTrusted -- frontière de confiance RÉAFFIRMÉE EXPLICITEMENT ici,
// jamais seulement implicite via l'appelant. Le callback réel
// (routes/auth.js) ne doit passer issuerTrusted:true qu'après AVOIR
// LUI-MÊME vérifié que l'issuer appartient au registre de confiance
// (registry.isTrustedIssuer(...)) -- ce module ne fait jamais cette
// vérification à la place de l'appelant, il exige seulement sa preuve
// explicite avant tout pont invitation. Si demain ce module est
// réutilisé par un autre appelant qui omettrait cette preuve
// (issuerTrusted absent ou strictement différent de true), AUCUNE
// invitation n'est jamais réclamée -- fail closed par défaut, jamais
// une confiance silencieuse accordée à un email vérifié seul.

import { findExternalIdentityByIssuerSubject, createExternalIdentity } from './repository.js';
import { findUserByEmail, insertUser, findUserById } from '../users/repository.js';
import { listPendingInvitationsForEmail, acceptProjectInvitation } from '../memberships/repository.js';

export async function resolveOrLinkIdentity(pool, { providerType, issuer, subject, email, emailVerified, displayName, issuerTrusted }) {
  const existing = await findExternalIdentityByIssuerSubject(pool, { issuer, subject });
  if (existing) {
    if (existing.status !== 'active') {
      return { ok: false, code: 'IDENTITY_REVOKED' };
    }
    // Déjà liée : résolution strictement par (issuer, subject), l'email
    // n'intervient plus jamais à ce stade, vérifié ou non -- et donc
    // aucun scan d'invitation n'a jamais lieu ici non plus. Mais le
    // STATUT DU USER lui-même doit toujours être revérifié ici --
    // l'identité externe peut rester active tout en pointant vers un
    // user deactivated/anonymized (la désactivation ne supprime jamais
    // l'identité, seule l'anonymisation le fait -- et dans ce cas
    // l'identité n'existe même plus, on ne passerait jamais par cette
    // branche). Aucune nouvelle session ne doit jamais être créée pour
    // un user non actif, quel que soit l'état de son identité externe.
    const user = await findUserById(pool, existing.user_id);
    if (!user || user.status !== 'active') {
      return { ok: false, code: 'USER_NOT_ACTIVE' };
    }
    return { ok: true, userId: existing.user_id, externalIdentityId: existing.id };
  }

  // Pas encore liée -- un email NON vérifié ne peut servir ni à
  // chercher une collision ni à créer un compte : on ne peut pas s'y
  // fier assez pour l'une ou l'autre décision (doctrine validée).
  //
  // Cas re-création après anonymisation (doctrine V1 explicite) :
  // l'anonymisation supprime physiquement l'external_identity ET
  // remplace l'email du user par une valeur synthétique -- une
  // personne revenant avec le même (issuer, subject)/email historique
  // ne matche donc plus RIEN ici (ni l'identité, ni l'email) et suit
  // naturellement ce même chemin de création normale. Un NOUVEAU
  // users.id est créé, jamais le tombstone réactivé, aucun ancien
  // grant/membership ne revient -- comportement correct par
  // construction, jamais un cas spécial à coder séparément.
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

  // Pont invitation -- UNIQUEMENT si TOUTES ces conditions sont réunies
  // au même instant : issuerTrusted === true (réaffirmé ici, jamais
  // supposé), le user vient réellement d'être créé par CETTE création
  // (jamais un compte préexistant, jamais un scan opportuniste), et la
  // liaison (issuer, subject) vient d'être créée avec succès juste
  // au-dessus. acceptProjectInvitation crée la membership + le grant
  // direct exactement comme le ferait une acceptation manuelle --
  // aucun système parallèle. Une invitation qui échoue à être acceptée
  // (déjà expirée entre-temps, etc.) n'empêche jamais la connexion
  // elle-même de réussir -- jamais bloquant.
  if (issuerTrusted === true) {
    const pendingInvitations = await listPendingInvitationsForEmail(pool, email);
    for (const invitation of pendingInvitations) {
      try {
        await acceptProjectInvitation(pool, { invitationId: invitation.id, userId: createdUser.user.id });
      } catch {
        // Ignoré volontairement -- la connexion réussit dans tous les
        // cas, une invitation non réclamée reste simplement pending.
      }
    }
  }

  return { ok: true, userId: createdUser.user.id, externalIdentityId: createdIdentity.identity.id };
}
