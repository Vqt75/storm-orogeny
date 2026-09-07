// Validation pure du payload POST /api/projects — aucune écriture DB
// ici, aucune correction magique : un payload qui ne respecte pas le
// contrat attendu produit une erreur explicite, jamais un repli
// silencieux (voir docs/contracts/locales.md).
//
// Project Creation V2 (doctrine "creation creates the container") ne
// demande plus jamais workspaceLocale/contentLocale à l'écran — la
// langue d'interface est SYSTEM_DERIVED (jamais un champ), la langue
// de contenu se dérive automatiquement et n'est modifiable que par un
// contrôle discret optionnel. Si le payload omet ces deux champs, ils
// sont dérivés ici -- jamais requis, jamais un repli silencieux sur
// une valeur non documentée.
//
// Ordre de dérivation réel (voir audit) : aucune préférence de
// contenu organisationnelle n'existe dans le modèle actuel (vérifié :
// ni colonne ni table dédiée sur tenants) -- le meilleur repli
// réellement disponible, sans inventer de nouvelle table, est l'en-
// tête Accept-Language de la requête HTTP, puis 'fr' si rien
// n'exploitable n'y figure.

const KNOWN_MODULES = new Set(['faq', 'actu', 'jalons', 'plans', 'ambassadeurs', 'equipe']);
const KNOWN_BUNDLES = new Set(['contributor', 'editor', 'pilot', 'project_admin']);
const KNOWN_THEMES = new Set(['ivory', 'rainbow', 'midnight']);
const DEFAULT_FALLBACK_LOCALE = 'fr';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeEmailForComparison(email) {
  return String(email).trim().toLowerCase();
}

// Parse minimal d'un en-tête Accept-Language ("fr-FR,fr;q=0.9,en;q=0.8")
// -- ne retient que le sous-tag de langue de base, dans l'ordre de
// préférence du client, jamais les paramètres régionaux/qualité.
export function deriveLocaleFromAcceptLanguage(acceptLanguageHeader, supportedSet) {
  if (!isNonEmptyString(acceptLanguageHeader)) return null;
  const tags = acceptLanguageHeader.split(',').map(part => part.split(';')[0].trim().toLowerCase());
  for (const tag of tags) {
    const base = tag.split('-')[0];
    if (supportedSet.has(base)) return base;
  }
  return null;
}

// creatorEmail sert uniquement à exclure silencieusement une
// auto-invitation (le créateur reçoit déjà un vrai membership) —
// jamais à valider quoi que ce soit d'autre.
export function validateCreateProjectPayload(payload, { supportedLocales, creatorEmail, acceptLanguageHeader }) {
  const errors = [];
  const supported = new Set(supportedLocales);

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Payload invalide.'] };
  }

  if (!isNonEmptyString(payload.name)) {
    errors.push('name est requis et ne peut pas être vide.');
  }

  const derivedLocale = deriveLocaleFromAcceptLanguage(acceptLanguageHeader, supported)
    ?? (supported.has(DEFAULT_FALLBACK_LOCALE) ? DEFAULT_FALLBACK_LOCALE : [...supported][0]);

  const workspaceLocale = payload.workspaceLocale !== undefined ? payload.workspaceLocale : derivedLocale;
  const contentLocale = payload.contentLocale !== undefined ? payload.contentLocale : derivedLocale;

  if (!supported.has(workspaceLocale)) {
    errors.push(`workspaceLocale doit être l'une des locales supportées : ${[...supported].join(', ')}.`);
  }
  if (!supported.has(contentLocale)) {
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
      workspaceLocale,
      contentLocale,
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
