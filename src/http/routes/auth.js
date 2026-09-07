import { Router } from 'express';
import { serialize as serializeCookie, parse as parseCookie } from 'cookie';
import { createProviderRegistry } from '../../domain/providers/providerRegistry.js';
import { createLoginTransaction, verifyLoginTransaction } from '../../domain/identity/loginTransaction.js';
import { resolveOrLinkIdentity } from '../../domain/identity/linking.js';
import { reconcileGroupsToGrants } from '../../domain/identity/groupReconciliation.js';
import { createSession, revokeSession, findActiveSessionByRawToken } from '../../domain/identity/sessions.js';
import * as fakeProvider from '../../domain/providers/fakeProvider.js';

// Routes /auth/* -- Batch 2 (squelette) + Batch 3 (réconciliation
// groupes->grants, pont invitation). Testable avec le fake provider,
// aucun réseau, aucun secret Microsoft. N'est PAS monté comme
// mécanisme production réel (voir app.js) -- devAuth reste seul actif.
// Voir domain/identity/linking.js et groupReconciliation.js.
function cookieBaseOptions(config) {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/'
  };
}

// Réponse d'échec uniforme -- jamais un détail interne exposé au
// client (le code reste stable et interne, utile pour les tests,
// jamais un message qui renseignerait un attaquant).
function failClosed(res, status, code) {
  res.status(status).json({ ok: false, error: { code } });
}

export function createAuthRouter({ pool, config, logger }) {
  const router = Router();
  const registry = createProviderRegistry(config);

  router.get('/login', (req, res) => {
    const providerType = registry.getDefaultProviderType();
    const entry = registry.getByProviderType(providerType);
    if (!entry) {
      failClosed(res, 500, 'PROVIDER_NOT_CONFIGURED');
      return;
    }

    const transaction = createLoginTransaction({
      providerType,
      expectedIssuer: entry.issuer,
      secret: config.sso.transactionSigningSecret
    });

    res.append('Set-Cookie', serializeCookie(config.sso.transactionCookieName, transaction.cookieValue, {
      ...cookieBaseOptions(config),
      maxAge: 10 * 60
    }));

    // Champs de simulation transmis uniquement pour le fake provider
    // (dev/test) -- un futur adaptateur réel les ignorerait purement
    // et simplement, aucun impact sur son propre contrat.
    const overrides = {
      subject: req.query.subject,
      email: req.query.email,
      emailVerified: req.query.emailVerified === 'true' ? true : req.query.emailVerified === 'false' ? false : undefined,
      displayName: req.query.displayName,
      groupIds: typeof req.query.groupIds === 'string' ? req.query.groupIds.split(',') : undefined
    };

    const authorizeUrl = entry.adapter.buildAuthorizeUrl({
      issuer: entry.issuer,
      state: transaction.state,
      nonce: transaction.nonce,
      codeChallenge: transaction.codeChallenge,
      scenario: req.query.scenario,
      overrides
    });

    res.redirect(authorizeUrl);
  });

  // Dev/test uniquement -- referme la boucle du fake provider sans
  // réseau. Jamais monté en production réelle (voir app.js).
  if (!config.isProduction) {
    router.get('/fake-provider/authorize', (req, res) => {
      const code = fakeProvider.buildFakeCode({
        scenario: req.query.scenario,
        nonce: req.query.nonce,
        subject: req.query.subject,
        email: req.query.email,
        emailVerified: req.query.emailVerified === 'true' ? true : req.query.emailVerified === 'false' ? false : undefined,
        displayName: req.query.displayName,
        groupIds: typeof req.query.groupIds === 'string' ? req.query.groupIds.split(',') : undefined
      });
      const callbackUrl = new URL('/auth/callback', `http://${req.get('host')}`);
      callbackUrl.searchParams.set('state', req.query.state);
      callbackUrl.searchParams.set('code', code);
      res.redirect(callbackUrl.toString());
    });
  }

  router.get('/callback', async (req, res) => {
    const cookies = parseCookie(req.headers.cookie || '');
    const clearTransactionCookie = () => {
      res.append('Set-Cookie', serializeCookie(config.sso.transactionCookieName, '', {
        ...cookieBaseOptions(config),
        maxAge: 0
      }));
    };

    // 1. Valider la transaction (présence, signature, expiration).
    const rawTransaction = cookies[config.sso.transactionCookieName];
    if (!rawTransaction) {
      failClosed(res, 400, 'TRANSACTION_MISSING');
      return;
    }
    const verified = verifyLoginTransaction(rawTransaction, config.sso.transactionSigningSecret);
    if (!verified.ok) {
      clearTransactionCookie();
      failClosed(res, 400, `TRANSACTION_${verified.reason}`);
      return;
    }
    const { transaction } = verified;

    // 1bis. state -- fait partie intégrante de la validation de
    // transaction : ce callback doit correspondre à CETTE transaction.
    if (req.query.state !== transaction.state) {
      clearTransactionCookie();
      failClosed(res, 400, 'STATE_MISMATCH');
      return;
    }

    // 2. Provider/issuer attendu -- toujours revérifié contre le
    // registre au moment du callback, jamais seulement fait confiance
    // à ce qui a été décidé à l'initiation.
    const entry = registry.getByProviderType(transaction.providerType);
    if (!entry || !registry.isTrustedIssuer(transaction.providerType, transaction.expectedIssuer)) {
      clearTransactionCookie();
      failClosed(res, 400, 'ISSUER_NOT_TRUSTED');
      return;
    }

    // 3. Traiter le callback provider.
    const callbackResult = entry.adapter.handleCallback({ issuer: entry.issuer, code: req.query.code });
    if (!callbackResult.ok) {
      clearTransactionCookie();
      failClosed(res, 400, 'INVALID_CALLBACK');
      return;
    }
    const identity = callbackResult.result;

    // 4. Confirmer l'issuer effectivement retourné.
    if (identity.issuer !== transaction.expectedIssuer) {
      clearTransactionCookie();
      failClosed(res, 400, 'ISSUER_MISMATCH');
      return;
    }

    // nonce -- comparé après le traitement du callback (c'est le
    // résultat du provider qui le porte, comme un vrai jeton d'ID le
    // ferait).
    if (identity.nonce !== transaction.nonce) {
      clearTransactionCookie();
      failClosed(res, 400, 'NONCE_MISMATCH');
      return;
    }

    // 5. Résoudre/lier l'identité -- issuerTrusted:true passé
    // explicitement ICI, uniquement parce que les étapes 2 et 4
    // ci-dessus viennent de vérifier cet issuer contre le registre de
    // confiance -- jamais une confiance implicite déléguée au module
    // de linking, qui exige cette preuve explicite avant tout pont
    // invitation (voir domain/identity/linking.js).
    const linked = await resolveOrLinkIdentity(pool, {
      providerType: transaction.providerType,
      issuer: identity.issuer,
      subject: identity.subject,
      email: identity.email,
      emailVerified: identity.emailVerified,
      displayName: identity.displayName,
      issuerTrusted: true
    });

    clearTransactionCookie();

    if (!linked.ok) {
      failClosed(res, 403, linked.code);
      return;
    }

    // 5bis. Réconciliation groupes -> grants (JIT, Batch 3).
    //
    // Distinction obligatoire entre deux catégories, jamais mélangées :
    //   - ANOMALIE MÉTIER (adminInterventionRequired non vide) : l'état
    //     DB reste cohérent et voulu (garde-fou dernier administrateur
    //     appliqué délibérément) -- ne bloque JAMAIS la connexion,
    //     seulement un log structuré, sans secret.
    //   - ÉCHEC TECHNIQUE (exception) : FAIL CLOSED AVANT toute création
    //     de session -- si Storm ne peut pas déterminer/appliquer
    //     correctement l'état d'autorisation, autoriser quand même la
    //     session pourrait maintenir un accès périmé. L'authentification
    //     IdP a pu réussir ; l'entrée dans Storm dépend aussi d'un état
    //     d'autorisation serveur cohérent -- jamais un simple
    //     avertissement suivi d'une session.
    let reconciliation;
    try {
      reconciliation = await reconcileGroupsToGrants(pool, {
        userId: linked.userId,
        issuer: identity.issuer,
        groups: identity.groups
      });
    } catch (err) {
      logger.error({ err: { name: err.name, message: err.message } }, 'Échec technique de la réconciliation groupes->grants -- connexion refusée, aucune session créée');
      failClosed(res, 500, 'RECONCILIATION_FAILED');
      return;
    }

    if (reconciliation.adminInterventionRequired.length > 0) {
      logger.warn(
        { userId: linked.userId, issuer: identity.issuer, adminInterventionRequired: reconciliation.adminInterventionRequired },
        'Réconciliation : intervention administrative requise -- une révocation attendue a été bloquée par le garde-fou dernier administrateur'
      );
    }

    // 6. Créer la session, poser le cookie, rediriger.
    const expiresAt = new Date(Date.now() + config.sso.sessionTtlHours * 60 * 60 * 1000);
    const { rawToken } = await createSession(pool, {
      userId: linked.userId,
      externalIdentityId: linked.externalIdentityId,
      expiresAt
    });

    res.append('Set-Cookie', serializeCookie(config.sso.sessionCookieName, rawToken, {
      ...cookieBaseOptions(config),
      expires: expiresAt
    }));

    res.redirect('/');
  });

  router.post('/logout', async (req, res) => {
    const cookies = parseCookie(req.headers.cookie || '');
    const rawToken = cookies[config.sso.sessionCookieName];

    res.append('Set-Cookie', serializeCookie(config.sso.sessionCookieName, '', {
      ...cookieBaseOptions(config),
      maxAge: 0
    }));

    if (!rawToken) {
      // Idempotent -- déjà déconnecté, jamais une erreur.
      res.status(200).json({ ok: true });
      return;
    }

    const session = await findActiveSessionByRawToken(pool, rawToken);
    if (session) {
      // Révoque CETTE session uniquement -- jamais une révocation
      // globale utilisateur.
      await revokeSession(pool, session.id);
    }

    res.status(200).json({ ok: true });
  });

  return router;
}
