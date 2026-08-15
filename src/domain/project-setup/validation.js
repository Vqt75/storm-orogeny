// Validation pure du payload POST /api/projects — aucune écriture DB
// ici, aucune correction magique : un payload qui ne respecte pas le
// contrat attendu produit une erreur explicite, jamais un repli
// silencieux (voir docs/contracts/locales.md).

const KNOWN_MODULES = new Set(['faq', 'actu', 'jalons', 'plans', 'ambassadeurs', 'equipe']);
const KNOWN_BUNDLES = new Set(['contributor', 'editor', 'pilot', 'project_admin']);
const KNOWN_THEMES = new Set(['ivory', 'rainbow', 'midnight']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeEmailForComparison(email) {
  return String(email).trim().toLowerCase();
}

// creatorEmail sert uniquement à exclure silencieusement une
// auto-invitation (le créateur reçoit déjà un vrai membership) —
// jamais à valider quoi que ce soit d'autre.
export function validateCreateProjectPayload(payload, { supportedLocales, creatorEmail }) {
  const errors = [];
  const supported = new Set(supportedLocales);

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Payload invalide.'] };
  }

  if (!isNonEmptyString(payload.name)) {
    errors.push('name est requis et ne peut pas être vide.');
  }

  if (!supported.has(payload.workspaceLocale)) {
    errors.push(`workspaceLocale doit être l'une des locales supportées : ${[...supported].join(', ')}.`);
  }
  if (!supported.has(payload.contentLocale)) {
    errors.push(`contentLocale doit être l'une des locales supportées : ${[...supported].join(', ')}.`);
  }

  const identity = payload.identity ?? {};
  if (identity.theme !== undefined && !KNOWN_THEMES.has(identity.theme)) {
    errors.push(`identity.theme doit être l'un de : ${[...KNOWN_THEMES].join(', ')}.`);
  }

  const modules = payload.modules ?? {};
  for (const key of Object.keys(modules)) {
    if (!KNOWN_MODULES.has(key)) {
      errors.push(`modules.${key} n'est pas un module connu.`);
    }
  }

  const rawInvites = Array.isArray(payload.invites) ? payload.invites : [];
  const seenEmails = new Set();
  const normalizedInvites = [];

  for (const invite of rawInvites) {
    if (!invite || !isNonEmptyString(invite.email)) {
      errors.push('Chaque invitation nécessite un email non vide.');
      continue;
    }
    if (!KNOWN_BUNDLES.has(invite.permissionBundle)) {
      errors.push(`Bundle d'invitation inconnu pour ${invite.email} : "${invite.permissionBundle}".`);
      continue;
    }
    if (!supported.has(invite.locale)) {
      errors.push(`Locale d'invitation non supportée pour ${invite.email} : "${invite.locale}".`);
      continue;
    }

    const normalizedEmail = normalizeEmailForComparison(invite.email);
    if (seenEmails.has(normalizedEmail)) {
      errors.push(`Email en double dans les invitations : ${invite.email}.`);
      continue;
    }
    seenEmails.add(normalizedEmail);
    normalizedInvites.push({
      email: invite.email.trim(),
      permissionBundle: invite.permissionBundle,
      locale: invite.locale,
      normalizedEmail
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Auto-invitation silencieusement exclue : le créateur reçoit déjà un
  // vrai project_membership dans la même transaction, jamais une
  // invitation redondante en plus.
  const creatorNormalizedEmail = creatorEmail ? normalizeEmailForComparison(creatorEmail) : null;
  const invitesExcludingCreator = normalizedInvites.filter(i => i.normalizedEmail !== creatorNormalizedEmail);

  return {
    valid: true,
    data: {
      name: payload.name.trim(),
      workspaceLocale: payload.workspaceLocale,
      contentLocale: payload.contentLocale,
      identity: {
        logoAssetId: identity.logoAssetId ?? null,
        primaryColor: identity.primaryColor ?? null,
        secondaryColor: identity.secondaryColor ?? null,
        fontPrimary: identity.fontPrimary ?? null,
        fontSecondary: identity.fontSecondary ?? null,
        theme: identity.theme ?? 'ivory'
      },
      modules,
      invites: invitesExcludingCreator.map(({ normalizedEmail, ...rest }) => rest)
    }
  };
}
