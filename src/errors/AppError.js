// Modèle d'erreur structuré — une seule forme d'erreur applicative dans
// tout Orogeny, jamais des erreurs ad-hoc lancées un peu partout avec
// des formes différentes selon l'endroit du code.

export class AppError extends Error {
  constructor(code, message, { status = 500, details = undefined } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;           // identifiant stable, machine-readable
    this.status = status;       // code HTTP à renvoyer
    this.details = details;     // détails additionnels, jamais une stack trace
  }

  toJSON() {
    return {
      ok: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {})
      }
    };
  }
}

// Erreurs prédéfinies pour les cas récurrents de Phase 0 — un seul
// endroit pour ces codes, pour ne jamais les réinventer légèrement
// différents à chaque route.
export const Errors = {
  notFound(resource = 'Ressource') {
    return new AppError('NOT_FOUND', `${resource} introuvable.`, { status: 404 });
  },
  unauthenticated() {
    return new AppError('UNAUTHENTICATED', 'Authentification requise.', { status: 401 });
  },
  forbidden(reason = 'Accès refusé.') {
    return new AppError('FORBIDDEN', reason, { status: 403 });
  },
  invalid(message, details) {
    return new AppError('INVALID_REQUEST', message, { status: 400, details });
  },
  internal(message = 'Erreur interne.') {
    return new AppError('INTERNAL_ERROR', message, { status: 500 });
  }
};
