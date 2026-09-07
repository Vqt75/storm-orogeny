// Rate limiting léger -- Batch 2. Fenêtre fixe, en mémoire, aucun
// système distribué (aucun Redis dans cette stack, jamais introduit
// pour ce seul besoin). Ralentit le bourrage d'identifiants/callback,
// RIEN DE PLUS -- ne participe jamais à une décision d'autorisation :
// un dépassement de limite ne signifie jamais "donc refusé pour
// raison métier", seulement "réessayez plus tard".
//
// LIMITE EXPLICITE, documentée ici : ce compteur vit dans la mémoire
// du process Node courant -- efficace sur UNE instance, jamais
// partagé entre plusieurs instances (aucune coordination inter-
// process/inter-machine). Si Storm scale un jour horizontalement
// (plusieurs instances derrière un load balancer), chaque instance
// aura son propre budget indépendant -- un attaquant distribué sur
// plusieurs instances pourrait donc dépasser la limite nominale d'un
// facteur proche du nombre d'instances. Acceptable pour V1 (topologie
// actuelle mono-instance) ; à remplacer par un store partagé (Redis
// ou équivalent) UNIQUEMENT le jour où une architecture multi-instance
// réelle est déployée -- jamais introduit par anticipation ici.
//
// La clé (req.ip) dépend directement du réglage trust proxy (voir
// config.security.trustProxyHops / app.js) -- sans ce réglage
// correctement aligné sur la topologie réelle de déploiement, cette
// clé serait soit partagée par tous les utilisateurs derrière un
// proxy non déclaré, soit falsifiable par un client parlant
// directement au process.

export function rateLimit({ windowMs, max }) {
  const hits = new Map(); // clé -> {count, windowStart}

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
      hits.set(key, { count: 1, windowStart: now });
      next();
      return;
    }

    if (entry.count >= max) {
      res.status(429).json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Trop de tentatives, réessayez plus tard.' } });
      return;
    }

    entry.count += 1;
    next();
  };
}
