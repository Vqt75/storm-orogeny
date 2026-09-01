// Génération de télémétrie synthétique pour le seed démo — construction
// EXACTE par comptabilité explicite, jamais un Math.random() qui
// dériverait à chaque exécution. PRNG déterministe (seed fixe) utilisé
// uniquement pour la variation réaliste (heure du jour, choix de page),
// jamais pour les totaux structurels, qui sont garantis par
// construction puis vérifiés via la vraie API après coup.
//
// Cinq points vérifiés dans le code réel avant d'écrire ce module
// (voir src/domain/pilotage/telemetry.js) :
// 1. occurredAt est injectable (paramètre `now`, jamais un now() SQL) ;
// 2. visitorRef est fourni par l'appelant, jamais généré en interne ;
// 3. sessionRef est calculé par resolveSession() -- jamais fourni,
//    donc jamais court-circuité ici, le vrai moteur de session
//    (30 min d'inactivité OU 4h de durée absolue) doit être respecté
//    par construction (écarts temporels réels entre événements) ;
// 4. les agrégats journaliers utilisent bien `now` injecté, jamais
//    now() SQL live -- confirmé par lecture directe du code ;
// 5. insérer des événements historiques via ces fonctions produit
//    exactement les mêmes résultats qu'une collecte réelle, À LA
//    CONDITION STRICTE d'insérer dans l'ordre chronologique (sinon
//    resolveSession(), qui interroge le dernier événement par
//    occurred_at desc, calculerait des écarts faux).
//
// Fenêtre de comparaison Pilotage (resolvePeriod, period=30) : la
// période précédente couvre J-60 à J-30. Seule countUniqueVisitors lit
// telemetry_events (bornée à 40 jours de rétention brute) -- toutes
// les autres lectures (sessions, contenu, Storm Match, météo) lisent
// les agrégats durables daily_*_agg, jamais purgés. Conséquence
// assumée et honnête : le delta "visiteurs uniques" ne peut pas être
// garanti exact au-delà de J-40 par l'architecture réelle -- ce module
// génère quand même des événements bruts sur 60 jours (utiles aux
// autres KPI via les agrégats qu'ils produisent), mais ne prétend
// jamais que le delta visiteurs uniques sur la période précédente sera
// structurellement garanti, seulement observé après coup.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randInt(rng, min, max) { return min + Math.floor(rng() * (max - min + 1)); }

// Poids relatif par jour de semaine -- lundi-jeudi fort, vendredi
// intermédiaire, week-end très faible. Trois jours de la fenêtre
// reçoivent un boost ("pics") pour donner une courbe qui raconte une
// histoire plutôt qu'une sinusoïde décorative -- positionnés en
// proportion relative de la fenêtre (jamais alignés sur des dates
// calendaires fixes, puisque la télémétrie est générée relativement à
// la date d'exécution du seed, contrairement aux actualités qui ont
// des dates calendaires figées -- les deux systèmes de dates ne
// peuvent pas être alignés de façon durable, donc ce module ne tente
// pas de le faire).
function dayWeight(dayIndexFromStart, totalDays, dayOfWeek) {
  let w = [0.15, 1, 1, 1, 1, 0.6, 0.2][dayOfWeek]; // dim,lun,mar,mer,jeu,ven,sam
  const spikeAt = [Math.round(totalDays * 0.25), Math.round(totalDays * 0.55), Math.round(totalDays * 0.85)];
  if (spikeAt.includes(dayIndexFromStart)) w *= 2.2;
  return w;
}

// Répartit `total` unités entières sur `n` compartiments selon des
// poids relatifs, en garantissant une somme EXACTEMENT égale à total
// (répartition proportionnelle puis réconciliation de l'arrondi sur
// les plus gros restes -- jamais une simple troncature qui perdrait
// des unités).
function distributeExact(total, weights) {
  const sumWeights = weights.reduce((s, w) => s + w, 0);
  const raw = weights.map(w => (w / sumWeights) * total);
  const floors = raw.map(Math.floor);
  let remainder = total - floors.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => [v - floors[i], i]).sort((a, b) => b[0] - a[0]);
  const result = [...floors];
  for (let k = 0; k < remainder; k++) result[order[k][1]] += 1;
  return result;
}

const PATHS = ['home', 'spaces', 'news', 'questions', 'ambassadors'];

// Construit un plan de sessions EXACT pour une fenêtre de `days` jours
// se terminant à `endDate` (exclu, i.e. le dernier jour généré est
// endDate-1) : targetVisitors visiteurs distincts, targetSessions
// sessions au total, dont targetReturningSessions comptent comme un
// retour (déjà vus avant, dans ou avant la fenêtre), targetPageViews
// pages vues au total. Retourne un tableau de sessions ordonnées
// chronologiquement : { visitorRef, startTime, pageCount, isPrepop }.
function buildSessionPlan({ rng, days, endDate, targetVisitors, targetSessions, targetReturningSessions, targetPageViews, prepopBufferDays }) {
  const nonReturning = targetSessions - targetReturningSessions;
  // nonReturning visiteurs "nouveaux" (1ère session jamais vue dans
  // cette fenêtre) -- targetVisitors - nonReturning visiteurs déjà
  // connus AVANT le début de la fenêtre (buffer pré-période).
  const newVisitorCount = nonReturning;
  const prepopVisitorCount = targetVisitors - newVisitorCount;
  if (prepopVisitorCount < 0) throw new Error('targetVisitors insuffisant pour ce taux de retour cible');
  const extraReturningSessions = targetReturningSessions - prepopVisitorCount;
  if (extraReturningSessions < 0) throw new Error('targetReturningSessions insuffisant pour prepopVisitorCount');

  const newVisitorRefs = Array.from({ length: newVisitorCount }, () => crypto.randomUUID());
  const prepopVisitorRefs = Array.from({ length: prepopVisitorCount }, () => crypto.randomUUID());

  // Poids par jour de la fenêtre.
  const dayEntries = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(endDate.getTime() - (days - i) * 24 * 60 * 60 * 1000);
    dayEntries.push({ index: i, date: d, dayOfWeek: d.getUTCDay() });
  }
  const weights = dayEntries.map(d => dayWeight(d.index, days, d.dayOfWeek));

  // Sessions "premières visites" (1 par visiteur nouveau) réparties
  // sur la fenêtre selon les poids jour.
  const newPerDay = distributeExact(newVisitorCount, weights);
  // Sessions "1ère visite en fenêtre d'un prepop" réparties de même.
  const prepopFirstPerDay = distributeExact(prepopVisitorCount, weights);
  // Sessions de retour supplémentaires (visites répétées) réparties
  // de même sur la fenêtre.
  const extraPerDay = distributeExact(extraReturningSessions, weights);

  const sessions = [];
  let newCursor = 0, prepopCursor = 0;
  const allVisitorsForExtra = [...newVisitorRefs, ...prepopVisitorRefs];

  for (let i = 0; i < days; i++) {
    const day = dayEntries[i];
    // Premières visites de "nouveaux" ce jour-là.
    for (let k = 0; k < newPerDay[i]; k++) {
      sessions.push({ visitorRef: newVisitorRefs[newCursor++], day, isPrepop: false });
    }
    // Premières visites en fenêtre des "prepop" ce jour-là.
    for (let k = 0; k < prepopFirstPerDay[i]; k++) {
      sessions.push({ visitorRef: prepopVisitorRefs[prepopCursor++], day, isPrepop: true });
    }
    // Visites répétées (retour) ce jour-là -- visiteur choisi au
    // hasard parmi tous ceux déjà introduits jusqu'ici (déterministe
    // via rng), jamais un visiteur qui n'existe pas encore à ce stade
    // chronologique.
    for (let k = 0; k < extraPerDay[i]; k++) {
      const introducedSoFar = newCursor + prepopCursor;
      if (introducedSoFar === 0) continue; // garde-fou, ne devrait pas arriver en pratique
      const idx = randInt(rng, 0, introducedSoFar - 1);
      sessions.push({ visitorRef: allVisitorsForExtra[idx], day, isPrepop: null });
    }
  }

  // Répartition des pages vues par session -- réaliste (1 à 8+),
  // réconciliée pour une somme EXACTEMENT égale à targetPageViews.
  const baseWeights = sessions.map(() => 1 + rng() * 3); // variation réaliste avant réconciliation
  const pageCounts = distributeExact(targetPageViews, baseWeights).map(v => Math.max(1, v));
  // La réconciliation ci-dessus peut légèrement dépasser/manquer le
  // total à cause du plancher à 1 -- correction finale stricte.
  let diff = targetPageViews - pageCounts.reduce((s, v) => s + v, 0);
  let idx2 = 0;
  while (diff !== 0 && sessions.length > 0) {
    const i = idx2 % pageCounts.length;
    if (diff > 0) { pageCounts[i]++; diff--; }
    else if (pageCounts[i] > 1) { pageCounts[i]--; diff++; }
    idx2++;
  }
  sessions.forEach((s, i) => { s.pageCount = pageCounts[i]; });

  // Heure de début de chaque session -- réaliste (8h-19h, avec un
  // creux méridien léger), déterministe via rng.
  sessions.forEach(s => {
    const hour = rng() < 0.15 ? randInt(rng, 12, 13) : randInt(rng, 8, 19);
    const minute = randInt(rng, 0, 59);
    s.startTime = new Date(Date.UTC(s.day.date.getUTCFullYear(), s.day.date.getUTCMonth(), s.day.date.getUTCDate(), hour, minute, randInt(rng, 0, 59)));
  });

  // Tri chronologique strict -- requis pour que resolveSession()
  // calcule des écarts corrects (voir vérification du point 5).
  sessions.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Correction de collision -- deux sessions du MÊME visiteur générées
  // trop proches (< 35 min, marge de sécurité au-dessus du seuil réel
  // de 30 min) fusionneraient en une seule session aux yeux du vrai
  // moteur (resolveSession), réduisant silencieusement le nombre de
  // sessions réellement obtenu en-dessous de la cible. Décalée en
  // avant jusqu'à obtenir un écart réel, puis retriée.
  const bySessionEnd = new Map(); // visitorRef -> fin de session connue la plus tardive déjà placée
  for (const s of sessions) {
    const lastEnd = bySessionEnd.get(s.visitorRef);
    if (lastEnd && s.startTime.getTime() - lastEnd < 35 * 60 * 1000) {
      s.startTime = new Date(lastEnd + 35 * 60 * 1000);
    }
    // Fin approximative de session = début + 2 min par page (réaliste,
    // borne large -- sert uniquement à espacer les sessions entre
    // elles, jamais à modéliser le temps réel passé par page).
    bySessionEnd.set(s.visitorRef, s.startTime.getTime() + s.pageCount * 2 * 60 * 1000);
  }
  sessions.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return { sessions, prepopVisitorRefs };
}

// Construit la liste à plat des événements page_view pour une fenêtre
// donnée -- un événement par page vue, path assigné depuis un pool
// mélangé (déterministe) respectant EXACTEMENT la distribution cible
// {home,news,spaces,questions,ambassadors}. Retourne un tableau
// d'événements { type:'page_view', visitorRef, occurredAt, path }.
function assignPathsToSessions(rng, sessions, pathTargets) {
  const pool = [];
  for (const path of PATHS) {
    for (let i = 0; i < (pathTargets[path] || 0); i++) pool.push(path);
  }
  // Fisher-Yates déterministe.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const events = [];
  let cursor = 0;
  for (const s of sessions) {
    for (let k = 0; k < s.pageCount; k++) {
      const offsetMs = k * randInt(rng, 30, 180) * 1000; // 30s à 3min entre pages d'une même session
      events.push({
        type: 'page_view',
        visitorRef: s.visitorRef,
        occurredAt: new Date(s.startTime.getTime() + offsetMs),
        path: pool[cursor++] || 'home'
      });
    }
  }
  return events;
}

// Construit les événements Storm Match (matched + abstained) en les
// rattachant à des sessions RÉELLEMENT existantes du plan -- jamais
// des sessions à part, qui gonfleraient artificiellement le nombre
// total de sessions au-delà de la cible déjà garantie par
// buildSessionPlan(). matchedTopics : [{ matchedEntryId, count,
// confidenceBucket }]. abstainedCount : nombre d'événements sans
// entrée ni confiance.
function assignMatchEvents(rng, sessions, matchedTopics, abstainedCount) {
  const events = [];
  function attachToRandomSession(outcome, matchedEntryId, confidenceBucket) {
    const s = sessions[randInt(rng, 0, sessions.length - 1)];
    const offsetMs = randInt(rng, 0, Math.max(1, s.pageCount) * 90) * 1000;
    events.push({
      type: 'match_result',
      visitorRef: s.visitorRef,
      occurredAt: new Date(s.startTime.getTime() + offsetMs),
      outcome, matchedEntryId: matchedEntryId || null, confidenceBucket: confidenceBucket || null
    });
  }
  for (const topic of matchedTopics) {
    for (let i = 0; i < topic.count; i++) {
      const r = rng();
      const confidenceBucket = r < 0.70 ? 'high' : r < 0.95 ? 'medium' : 'low';
      attachToRandomSession('matched', topic.matchedEntryId, confidenceBucket);
    }
  }
  for (let i = 0; i < abstainedCount; i++) attachToRandomSession('abstained', null, null);
  return events;
}

// Construit les événements météo -- jamais de visitorRef/sessionRef,
// répartis sur des jours différents de la fenêtre (jamais un seul
// instant), conformément au modèle réellement anonyme.
function assignMoodEvents(rng, days, endDate, distribution) {
  const events = [];
  for (const [value, count] of Object.entries(distribution)) {
    for (let i = 0; i < count; i++) {
      const dayOffset = randInt(rng, 1, days);
      const d = new Date(endDate.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      const occurredAt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), randInt(rng, 8, 18), randInt(rng, 0, 59)));
      events.push({ type: 'mood_feedback', value: Number(value), occurredAt });
    }
  }
  return events;
}

// Événements tampon pré-période -- une visite antérieure réelle pour
// chaque visiteur "prepop", datée dans les `bufferDays` jours PRÉCÉDANT
// le début de la période. Sans ces événements, resolveSession() ne
// trouverait aucun historique antérieur réel pour ces visiteurs et leur
// première session en période ne compterait jamais comme un retour --
// bug trouvé et corrigé par test direct contre la vraie API (voir
// rapport : 40,2% obtenu au lieu de 44% cible, exactement la
// différence des 26 visiteurs prepop non comptés).
function buildPrepopBufferEvents(rng, prepopVisitorRefs, periodStartDate, bufferDays) {
  return prepopVisitorRefs.map(visitorRef => {
    const dayOffset = randInt(rng, 1, bufferDays);
    const d = new Date(periodStartDate.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    const occurredAt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), randInt(rng, 8, 19), randInt(rng, 0, 59)));
    return { type: 'page_view', visitorRef, occurredAt, path: 'home' };
  });
}

export {
  mulberry32, pick, randInt, distributeExact, buildSessionPlan, dayWeight, PATHS,
  assignPathsToSessions, assignMatchEvents, assignMoodEvents, buildPrepopBufferEvents
};
