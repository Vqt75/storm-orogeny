// Seed de démonstration — Storm Orogeny.
// Projet fictif Équinoxe / Asteria / Cobalt, entièrement scopé à un
// tenant DEMO distinct, jamais un tenant réel.
//
// Idempotent : relancer ce script reconstruit intégralement le projet
// démo sans toucher aux autres tenants. tenants est en
// `on delete restrict` (jamais cascade) — la tenant DEMO elle-même
// n'est donc jamais supprimée, seul son contenu (projects, qui cascade
// vers tout le reste : memberships, contenu Studio, publications,
// télémétrie) est nettoyé puis reconstruit à chaque exécution.
//
// Arbitrages verrouillés avant implémentation (addendum) :
// - aucun jalon 'current' -- le H1 Ivory doit rester le message
//   éditorial ("Un nouveau lieu pour mieux travailler ensemble."),
//   jamais un libellé de jalon (home.now.label prend le dessus sur
//   home.message dans le Compiler réel -- confirmé par lecture directe
//   de compileHome(), jamais modifié pour cette démo) ;
// - chronologie recalée pour une démo début septembre 2026 (jalons
//   passés en juillet/août 2026, futurs à partir de mi-septembre) ;
// - télémétrie générée relativement à la date d'exécution du script,
//   jamais des dates codées en dur -- reseeder avant une démo
//   ultérieure reste pertinent ;
// - aucune migration de confort (landingStatement non branché reste
//   non branché, CTA codés en dur dans Ivory restent tels quels).

import { loadConfig } from '../config/env.js';
import { getPool, closePool } from './pool.js';
import { logger } from '../logger.js';
import {
  insertProjectIdentity, insertProjectSettings, insertProjectModules, insertProjectMembership
} from '../domain/project-setup/repository.js';
import {
  insertQuestion, insertArticle, insertMilestone, insertTeamMember,
  insertNarrativeSection, insertAmbassador, insertSpace, upsertSectionContent
} from '../domain/studio/repository.js';
import { createPublication } from '../domain/publication/repository.js';
import { recordPageView, recordMatchResult, recordMoodFeedback } from '../domain/pilotage/telemetry.js';
import { findUserByEmail } from '../domain/users/repository.js';
import { DEMO_USER_EMAIL as PLATFORM_DEMO_IDENTITY_EMAIL } from '../http/routes/demoIdentity.js';

const DEMO_TENANT_NAME = 'Asteria (Démo)';
const DEMO_PROJECT_NAME = 'Équinoxe';
const CONTENT_AUTHOR_EMAIL = 'camille.renaud@demo.storm.local';

async function findOrCreateDemoTenant(pool) {
  const { rows } = await pool.query('select id from tenants where name = $1', [DEMO_TENANT_NAME]);
  if (rows[0]) return rows[0].id;
  const { rows: [created] } = await pool.query('insert into tenants (name) values ($1) returning id', [DEMO_TENANT_NAME]);
  return created.id;
}

// Nettoyage scopé : supprime uniquement les projects de CE tenant --
// cascade vers tout le contenu Studio, l'identité, les publications et
// la télémétrie (toutes ces tables référencent projects(tenant_id,id)
// on delete cascade, confirmé par lecture des migrations). Jamais un
// clearAll() global, jamais une suppression de la tenant elle-même
// (on delete restrict).
async function cleanDemoTenantContent(pool, tenantId) {
  await pool.query('delete from projects where tenant_id = $1', [tenantId]);
  await pool.query('delete from tenant_memberships where tenant_id = $1', [tenantId]);
  await pool.query('delete from users where email = $1', [CONTENT_AUTHOR_EMAIL]);
}

// Utilisateur "auteur de contenu" fictif -- sert de créateur pour les
// jalons/espaces/actualités/etc. et reste listé comme "Directrice du
// projet" dans le contenu Équipe narratif. N'est PAS l'identité
// utilisée pour accéder au projet en démonstration réelle -- voir
// grantPlatformDemoIdentityAccess ci-dessous.
async function findOrCreateContentAuthor(pool) {
  const { rows: [row] } = await pool.query(
    'insert into users (email, display_name) values ($1, $2) returning id',
    [CONTENT_AUTHOR_EMAIL, 'Camille Renaud']
  );
  return row.id;
}

// Accorde l'accès au projet démo à l'identité RÉELLEMENT utilisée par
// /api/demo-identity en production (voir src/http/routes/
// demoIdentity.js) -- jamais seulement à l'utilisateur fictif créé par
// ce script. Bug trouvé en production et corrigé ici : sans cette
// fonction, seul CONTENT_AUTHOR_EMAIL (Camille, jamais l'identité
// réellement chargée par Storm Home) avait un accès, donc le projet
// existait mais restait invisible pour quiconque ouvrait
// l'instance de démonstration normalement.
//
// Deux memberships nécessaires, pas une seule : une tenant_membership
// sur le tenant démo (prérequis FK -- project_memberships_tenant_id_
// user_id_fkey exige qu'une tenant_membership existe d'abord pour ce
// couple tenant_id/user_id, confirmé par contrainte réelle), PUIS une
// project_membership project_admin sur Équinoxe lui-même. Storm
// Control liste les projets par tenant (listAllProjectsForTenant),
// jamais cross-tenant -- sans la tenant_membership, l'identité démo
// ne verrait Équinoxe ni via Storm Home ni via Storm Control.
//
// Si l'identité démo n'existe pas dans cette base (environnement où
// seed.js classique n'a jamais tourné), ne fait rien silencieusement
// -- le projet reste accessible via CONTENT_AUTHOR_EMAIL en secours,
// jamais une dépendance stricte à cette identité précise.
async function grantPlatformDemoIdentityAccess(pool, { tenantId, projectId }) {
  const platformUser = await findUserByEmail(pool, PLATFORM_DEMO_IDENTITY_EMAIL);
  if (!platformUser) {
    logger.info({ email: PLATFORM_DEMO_IDENTITY_EMAIL }, 'Identité démo plateforme introuvable dans cette base -- accès non accordé (seed.js classique n\'a peut-être jamais tourné ici)');
    return;
  }
  await pool.query(
    'insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)',
    [tenantId, platformUser.id, 'organization_admin']
  );
  await insertProjectMembership(pool, { tenantId, projectId, userId: platformUser.id, permissionBundle: 'project_admin' });
  logger.info({ email: PLATFORM_DEMO_IDENTITY_EMAIL, userId: platformUser.id }, 'Accès Équinoxe accordé à l\'identité démo réelle de la plateforme');
}

async function seedDemo() {
  const config = loadConfig();
  const pool = getPool(config);

  logger.info({}, 'Seed démo — début');

  const tenantId = await findOrCreateDemoTenant(pool);
  await cleanDemoTenantContent(pool, tenantId);

  const userId = await findOrCreateContentAuthor(pool);
  await pool.query(
    'insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)',
    [tenantId, userId, 'organization_admin']
  );

  const { rows: [project] } = await pool.query(
    'insert into projects (tenant_id, name) values ($1,$2) returning id',
    [tenantId, DEMO_PROJECT_NAME]
  );
  const projectId = project.id;

  await insertProjectIdentity(pool, { tenantId, projectId, identity: {} });
  await insertProjectSettings(pool, { tenantId, projectId, workspaceLocale: 'fr', contentLocale: 'fr' });
  await insertProjectModules(pool, {
    tenantId, projectId,
    modules: { faq: true, actu: true, jalons: true, plans: true, ambassadeurs: true, equipe: true }
  });
  await insertProjectMembership(pool, { tenantId, projectId, userId, permissionBundle: 'project_admin' });
  await grantPlatformDemoIdentityAccess(pool, { tenantId, projectId });

  logger.info({ tenantId, projectId }, 'Tenant/projet démo créés');

  // ── Homepage ──────────────────────────────────────────────────────
  // message : devient le H1 Ivory UNIQUEMENT si aucun jalon 'current'
  // n'existe (confirmé par lecture de compileHome() -- home.now.label
  // prend le dessus sinon). Aucun jalon 'current' n'est créé plus bas,
  // par arbitrage explicite : ce texte doit rester le H1 réellement
  // affiché.
  await upsertSectionContent(pool, {
    tenantId, projectId, sectionKey: 'homepage',
    fields: {
      message: 'Un nouveau lieu pour mieux travailler ensemble.',
      askPrompt: 'Une question sur Cobalt ?'
    }
  });

  // ── Jalons — aucun 'current', par arbitrage explicite ──────────────
  const milestones = [
    { status: 'done', dateLabel: '6 juillet 2026', label: 'Présentation du projet' },
    { status: 'done', dateLabel: '27 juillet 2026', label: 'Ouverture du plateau témoin' },
    { status: 'done', dateLabel: '18 août 2026', label: 'Premiers ateliers équipes' },
    { status: 'future', dateLabel: '15 septembre 2026', label: 'Choix des quartiers d\u2019équipe' },
    { status: 'future', dateLabel: '5 octobre 2026', label: 'Guide des nouveaux usages' },
    { status: 'future', dateLabel: '2 novembre 2026', label: 'Réservation des casiers' },
    { status: 'future', dateLabel: '30 novembre 2026', label: 'Visites de Cobalt' },
    { status: 'future', dateLabel: '11 janvier 2027', label: 'Semaine de préparation' },
    { status: 'future', dateLabel: '18 janvier 2027', label: 'Bienvenue à Cobalt' }
  ];
  for (let i = 0; i < milestones.length; i++) {
    await insertMilestone(pool, { tenantId, projectId, position: i, userId, ...milestones[i] });
  }

  // ── Espaces ─────────────────────────────────────────────────────────
  const spaces = [
    { name: 'Quartiers d\u2019équipe', description: 'Zones de référence regroupant postes, petites salles et rangement.', usages: ['Travail individuel', 'Travail d\u2019équipe'] },
    { name: 'Espaces Focus', description: 'Postes isolés pour concentration.', usages: ['Concentration'] },
    { name: 'Bibliothèque', description: '24 places, silence renforcé.', usages: ['Concentration'] },
    { name: 'Salles de réunion', description: 'De 4 à 16 personnes, réunion sur site et hybride.', usages: ['Réunion'] },
    { name: 'Bulles', description: '1 à 2 personnes, appels et visioconférences courtes.', usages: ['Appel'] },
    { name: 'Project Rooms', description: '6 à 10 personnes, travail projet à la demi-journée ou journée.', usages: ['Travail d\u2019équipe'] },
    { name: 'Forum', description: 'Jusqu\u2019à 120 personnes, événements et prises de parole.', usages: ['Événement'] },
    { name: 'Café central', description: 'Environ 80 places, convivialité.', usages: ['Convivialité'] },
    { name: 'Restaurant', description: 'Environ 220 places, offre chaude, végétarienne et rapide.', usages: ['Restauration'] },
    { name: 'Terrasse', description: 'Environ 70 places.', usages: ['Convivialité'] },
    { name: 'Espace bien-être', description: 'Repos, allaitement, récupération.', usages: ['Bien-être'] },
    { name: 'Local vélos', description: '160 places, prises de recharge, casiers et douches à proximité.', usages: ['Mobilité'] }
  ];
  for (let i = 0; i < spaces.length; i++) {
    await insertSpace(pool, { tenantId, projectId, position: i, userId, status: 'approved', location: 'Cobalt', ...spaces[i] });
  }

  // ── Actualités — recalées début juillet à fin août 2026 ────────────
  const articles = [
    { publicationDate: '2026-07-06', title: 'Le projet Équinoxe est lancé', chapeau: 'Les grandes étapes jusqu\u2019à Cobalt.', tag: 'Calendrier' },
    { publicationDate: '2026-07-20', title: 'Cobalt en 5 chiffres', chapeau: 'Les principaux repères du futur site.', tag: 'Chiffres' },
    { publicationDate: '2026-07-27', title: 'Le plateau témoin ouvre ses portes', chapeau: 'Testez les mobiliers et futurs usages.', tag: 'Espaces' },
    { publicationDate: '2026-08-03', title: 'Rencontrez les ambassadeurs Équinoxe', chapeau: 'Les relais de proximité.', tag: 'Équipe' },
    { publicationDate: '2026-08-10', title: 'Comment fonctionnera le flex office ?', chapeau: 'Quartiers d\u2019équipe et règles de fonctionnement.', tag: 'Usages' },
    { publicationDate: '2026-08-17', title: 'Venir à Cobalt : toutes les options', chapeau: 'Métro, RER, vélo et accès visiteurs.', tag: 'Mobilité' },
    { publicationDate: '2026-08-24', title: 'Concentration : quels espaces choisir ?', chapeau: 'Bibliothèque, Focus et bulles.', tag: 'Espaces' },
    { publicationDate: '2026-08-31', title: 'Ce que nous retenons des premiers tests', chapeau: 'Les premiers ajustements issus des retours.', tag: 'Retours' }
  ];
  const insertedArticles = [];
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const inserted = await insertArticle(pool, {
      tenantId, projectId, position: i, userId,
      tag: a.tag, publicationDate: a.publicationDate, title: a.title,
      chapeauRuns: [{ text: a.chapeau }],
      blocks: [{ blockType: 'paragraph', runs: [{ text: a.chapeau }], position: 0 }]
    });
    insertedArticles.push(inserted);
  }

  // ── Ambassadeurs ────────────────────────────────────────────────────
  const ambassadors = [
    ['Nora Benali', 'Finance'], ['Paul Delaunay', 'Marketing'], ['Inès Morel', 'RH'],
    ['Arthur Nguyen', 'IT'], ['Sofia Martins', 'Commercial'], ['Julien Masson', 'Juridique'],
    ['Clara Besson', 'Communication'], ['Mehdi Cherif', 'Opérations'], ['Émilie Robert', 'Achats'],
    ['Thomas Leroy', 'Data'], ['Aya Haddad', 'RSE'], ['Lucas Girard', 'Support']
  ];
  for (let i = 0; i < ambassadors.length; i++) {
    const [name, role] = ambassadors[i];
    await insertAmbassador(pool, { tenantId, projectId, position: i, userId, name, role, tag: 'Ambassadeur\u2022rice', contactable: false });
  }

  // ── Équipe projet ───────────────────────────────────────────────────
  const team = [
    ['Camille Renaud', 'Directrice du projet'], ['Léa Fontaine', 'Change & communication'],
    ['Yanis Cohen', 'Environnements de travail'], ['Margaux Legrand', 'Ressources humaines'],
    ['Alexandre Petit', 'IT & équipements'], ['Nina Rossi', 'Services aux occupants'],
    ['Hugo Lambert', 'Immobilier'], ['Salomé Diallo', 'Accessibilité & QVT']
  ];
  for (let i = 0; i < team.length; i++) {
    const [name, title] = team[i];
    await insertTeamMember(pool, { tenantId, projectId, position: i, userId, name, title });
  }

  // ── Le projet — sections narratives ─────────────────────────────────
  await insertNarrativeSection(pool, {
    tenantId, projectId, position: 0, userId, enabled: true, sectionType: 'keyFigures',
    payload: { title: 'Chiffres clés', items: [
      { value: '640', label: 'collaborateurs concernés' },
      { value: '8', label: 'niveaux de travail' },
      { value: '18 janvier 2027', label: 'emménagement' }
    ] }
  });
  await insertNarrativeSection(pool, {
    tenantId, projectId, position: 1, userId, enabled: true, sectionType: 'choices',
    payload: { title: 'Pourquoi ce projet', items: [
      { title: 'Réunir les équipes', body: 'Réunir des équipes aujourd\u2019hui réparties sur trois implantations.' },
      { title: 'Plus de choix', body: 'Donner davantage de choix entre concentration, collaboration et échanges informels.' },
      { title: 'Mieux équipé', body: 'Améliorer la qualité des équipements et des services sur site.' },
      { title: 'Des surfaces mieux utilisées', body: 'Réduire les surfaces sous-utilisées sans dégrader le confort de travail.' }
    ] }
  });
  await insertNarrativeSection(pool, {
    tenantId, projectId, position: 2, userId, enabled: true, sectionType: 'choices',
    payload: { title: 'Nos principes', items: [
      { title: 'Le bon espace pour le bon usage', body: 'Postes ouverts, zones calmes, salles et espaces informels.' },
      { title: 'Des repères simples', body: 'Quartiers de référence sans poste attribué.' },
      { title: 'Un projet ajustable', body: 'Observation des usages après l\u2019emménagement et ajustements si nécessaire.' },
      { title: 'Une attention portée à tous', body: 'Accessibilité, acoustique, ergonomie et qualité de l\u2019air.' }
    ] }
  });
  await insertNarrativeSection(pool, { tenantId, projectId, position: 3, userId, enabled: true, sectionType: 'timeline', payload: {} });
  await insertNarrativeSection(pool, { tenantId, projectId, position: 4, userId, enabled: true, sectionType: 'team', payload: {} });

  // ── Questions ────────────────────────────────────────────────────
  const questionIdByText = {};
  for (let i = 0; i < QUESTIONS.length; i++) {
    const [question, answer] = QUESTIONS[i];
    const inserted = await insertQuestion(pool, { tenantId, projectId, position: i, userId, question, answerRuns: [{ text: answer }] });
    questionIdByText[question] = inserted.id;
  }

  logger.info({ questionCount: QUESTIONS.length }, 'Structure du projet démo créée (jalons, espaces, actualités, ambassadeurs, équipe, sections, questions)');

  return { pool, tenantId, projectId, userId, insertedArticles, questionIdByText };
}

// ── Questions — corpus de démonstration, 12 familles, langage naturel
// de collaborateur (jamais une FAQ contractuelle). Modèle réel
// question + answerRuns uniquement -- aucun keyword, aucun alias,
// aucun champ Liquid Core (l'audit a confirmé qu'aucun corpus
// réutilisable n'existait dans le repo -- écrit intégralement ici).
const QUESTIONS = [
  // calendrier & déménagement
  ['Quand déménageons-nous ?', 'Le 18 janvier 2027.'],
  ['C\u2019est prévu pour quand exactement, l\u2019emménagement ?', 'L\u2019emménagement à Cobalt est prévu le 18 janvier 2027.'],
  ['Le calendrier peut-il encore changer ?', 'Le calendrier est stabilisé, mais certaines dates intermédiaires (ateliers, visites) peuvent être ajustées en fonction de l\u2019avancement.'],
  ['Quand aura lieu la semaine de préparation ?', 'La semaine de préparation est prévue le 11 janvier 2027, juste avant l\u2019emménagement.'],
  ['Est-ce que je peux visiter Cobalt avant le déménagement ?', 'Oui, des visites sont prévues fin novembre 2026 -- les créneaux seront communiqués par les ambassadeurs.'],
  ['Quand le plateau témoin a-t-il ouvert ?', 'Le plateau témoin a ouvert ses portes le 27 juillet 2026.'],
  ['On aura combien de temps pour préparer notre déménagement personnel ?', 'Le guide des nouveaux usages sera disponible début octobre, plusieurs mois avant le déménagement.'],
  ['Y a-t-il une date limite pour poser des questions sur le projet ?', 'Non, vous pouvez poser vos questions à tout moment via Storm.'],
  ['Le déménagement se fera-t-il en une fois ou par étapes ?', 'Les modalités précises seront communiquées dans le guide des nouveaux usages, début octobre.'],

  // postes & flex office
  ['Aurai-je un bureau attitré ?', 'Non, vous aurez un quartier d\u2019équipe mais pas de poste nominatif.'],
  ['C\u2019est quoi le flex office exactement ?', 'C\u2019est un mode de travail où les postes ne sont pas attribués nominativement : chacun choisit sa place selon son activité du jour.'],
  ['Je vais devoir changer de bureau tous les jours ?', 'Vous resterez principalement dans le quartier d\u2019équipe qui vous est associé, avec la liberté de varier selon vos besoins.'],
  ['Qu\u2019est-ce qu\u2019un quartier d\u2019équipe ?', 'C\u2019est une zone de référence d\u2019une équipe, regroupant postes, petites salles et rangement.'],
  ['Mon équipe aura-t-elle toujours la même zone ?', 'Oui, chaque équipe se voit attribuer un quartier de référence stable.'],
  ['Est-ce que je choisis où je m\u2019assois chaque matin ?', 'Oui, au sein de votre quartier d\u2019équipe vous choisissez librement votre poste du jour.'],
  ['Le flex office, ça veut dire moins de postes que de personnes ?', 'Le ratio prévu (0,82) reflète les usages observés -- présence simultanée rarement à 100 %, pas une pénurie organisée.'],
  ['Pourquoi ne pas garder un bureau attitré pour tout le monde ?', 'Le flex office permet plus de choix entre concentration, collaboration et échanges, plutôt qu\u2019un poste figé sous-utilisé une partie du temps.'],

  // réservation & présence
  ['Dois-je réserver un poste ?', 'Pas systématiquement en V1.'],
  ['Comment je réserve une salle de réunion ?', 'Via l\u2019outil de réservation habituel, qui reste inchangé pour les salles de réunion.'],
  ['Faut-il réserver pour aller à la Bibliothèque ?', 'Non, la Bibliothèque fonctionne en accès libre.'],
  ['Je dois prévenir si je viens un jour précis ?', 'Aucune obligation de déclarer sa présence n\u2019est prévue pour le moment.'],
  ['Peut-on réserver une Project Room à l\u2019avance ?', 'Oui, les Project Rooms se réservent à la demi-journée ou à la journée.'],
  ['Et les bulles, on les réserve aussi ?', 'Non, les bulles sont pensées pour un usage court et spontané, sans réservation.'],
  ['Le Forum est-il réservable pour un événement d\u2019équipe ?', 'Oui, le Forum peut être réservé pour des événements, sur demande auprès de l\u2019équipe projet.'],

  // espaces & usages
  ['Où travailler au calme ?', 'À la Bibliothèque ou dans les espaces Focus.'],
  ['C\u2019est quoi la différence entre Focus et Bibliothèque ?', 'Les espaces Focus sont des postes individuels isolés ; la Bibliothèque est un espace collectif à silence renforcé, 24 places.'],
  ['Où puis-je passer un appel rapide sans déranger personne ?', 'Utilisez une bulle, pensée pour les appels et visioconférences courtes.'],
  ['Quelle est la capacité des salles de réunion ?', 'Les salles de réunion accueillent de 4 à 16 personnes, en présentiel ou hybride.'],
  ['Le Forum, c\u2019est pour quoi ?', 'Le Forum est un espace pour les événements et prises de parole, jusqu\u2019à 120 personnes.'],
  ['Il y aura un espace pour se détendre ?', 'Oui, un espace bien-être est prévu pour le repos, l\u2019allaitement et la récupération.'],
  ['Combien de personnes dans une Project Room ?', 'Les Project Rooms accueillent de 6 à 10 personnes.'],
  ['Y a-t-il un espace pour les échanges informels ?', 'Oui, le Café central et la Terrasse sont pensés pour la convivialité et les échanges informels.'],
  ['Les quartiers d\u2019équipe ont-ils des petites salles dédiées ?', 'Oui, chaque quartier d\u2019équipe regroupe postes, petites salles et rangement.'],

  // casiers & rangement
  ['Combien de places vélos ?', 'Environ 160.'],
  ['J\u2019aurai un casier personnel ?', 'Oui, des casiers seront disponibles -- la réservation ouvrira début décembre 2026.'],
  ['Où je mets mes affaires si je n\u2019ai pas de bureau fixe ?', 'Dans votre casier personnel, réservable à partir de début décembre 2026.'],
  ['Le local vélos a des douches à proximité ?', 'Oui, des casiers et des douches sont prévus à proximité du local vélos.'],
  ['Y a-t-il des prises de recharge pour vélos électriques ?', 'Oui, le local vélos prévoit des prises de recharge.'],
  ['Quand puis-je réserver mon casier ?', 'La réservation des casiers ouvre le 3 décembre 2026.'],

  // télétravail & organisation
  ['Le projet change-t-il le télétravail ?', 'Non.'],
  ['Est-ce que je vais devoir venir plus souvent au bureau ?', 'Le projet ne modifie pas les règles de télétravail actuelles.'],
  ['Les jours de télétravail restent-ils les mêmes ?', 'Oui, aucun changement n\u2019est prévu sur l\u2019organisation du télétravail.'],
  ['Cobalt va-t-il imposer une présence minimale ?', 'Non, le projet Cobalt porte sur les espaces, pas sur les règles de présence.'],
  ['Mon manager peut-il m\u2019imposer des jours fixes au bureau ?', 'Les règles de télétravail restent celles en vigueur dans votre équipe, inchangées par le projet.'],

  // IT & équipements
  ['Quel matériel IT sera fourni sur les nouveaux postes ?', 'Les écrans et équipements standards seront disponibles sur les postes des quartiers d\u2019équipe -- le détail est en cours de finalisation avec l\u2019IT.'],
  ['Puis-je garder mon ordinateur actuel ?', 'Oui, votre matériel personnel de travail n\u2019est pas concerné par le déménagement.'],
  ['Y aura-t-il du wifi partout dans le bâtiment ?', 'Oui, une couverture wifi est prévue sur l\u2019ensemble des espaces de Cobalt.'],
  ['Comment se passera le branchement de mon poste le premier jour ?', 'Une assistance IT sera présente lors de la semaine de préparation, début janvier 2027.'],
  ['Les écrans seront-ils partagés entre plusieurs postes ?', 'Le détail de l\u2019équipement par poste sera précisé dans le guide des nouveaux usages.'],

  // réunions & confidentialité
  ['Comment garantir la confidentialité dans un open space ?', 'Les salles de réunion et bulles sont prévues pour les échanges nécessitant de la confidentialité.'],
  ['Puis-je passer un entretien RH confidentiel sur site ?', 'Oui, utilisez une salle de réunion ou une bulle pour ce type d\u2019échange.'],
  ['Les Project Rooms sont-elles insonorisées ?', 'Les Project Rooms sont conçues pour le travail de projet en petit groupe, avec une bonne isolation sonore.'],
  ['Comment réserver une salle pour un entretien annuel ?', 'Via l\u2019outil de réservation habituel des salles de réunion.'],

  // mobilité & accès
  ['Comment accéder à Cobalt en transport en commun ?', 'Cobalt est desservi par le métro et le RER -- le détail des accès sera communiqué avant l\u2019emménagement.'],
  ['Y a-t-il un accès facile en RER ?', 'Oui, Cobalt est situé à proximité d\u2019une gare RER.'],
  ['Puis-je venir en vélo ?', 'Oui, un local vélos de 160 places est prévu, avec prises de recharge et douches à proximité.'],
  ['Comment accueillir un visiteur ?', 'Via l\u2019accueil et la procédure dédiée aux visiteurs.'],
  ['Y a-t-il un parking pour les visiteurs ?', 'Les modalités d\u2019accès visiteurs, y compris le stationnement, seront précisées avant l\u2019emménagement.'],
  ['Le site est-il accessible facilement depuis le centre de Paris ?', 'Oui, Cobalt bénéficie d\u2019un accès direct en RER et métro.'],

  // services & restauration
  ['Y aura-t-il un restaurant ?', 'Oui.'],
  ['Combien de places au restaurant ?', 'Le restaurant proposera environ 220 places.'],
  ['Y aura-t-il une offre végétarienne ?', 'Oui, une offre chaude, végétarienne et rapide est prévue au restaurant.'],
  ['Le café central sert-il aussi à manger ?', 'Le Café central est surtout pensé pour la convivialité -- l\u2019offre précise sera communiquée avant l\u2019ouverture.'],
  ['Puis-je déjeuner dehors quand il fait beau ?', 'Oui, une terrasse d\u2019environ 70 places est prévue.'],
  ['Le restaurant sera-t-il ouvert dès le premier jour ?', 'L\u2019ouverture des services (dont le restaurant) est prévue au moment de l\u2019emménagement, le 18 janvier 2027.'],

  // accessibilité & bien-être
  ['Comment demander un poste adapté ?', 'Via les circuits RH/santé habituels.'],
  ['Cobalt est-il accessible aux personnes à mobilité réduite ?', 'Oui, l\u2019accessibilité fait partie des principes du projet, avec une attention portée à tous.'],
  ['Y a-t-il une salle d\u2019allaitement ?', 'Oui, l\u2019espace bien-être prévoit un espace dédié à l\u2019allaitement.'],
  ['Qui contacter pour un besoin spécifique d\u2019ergonomie ?', 'Les circuits RH/santé habituels restent le point d\u2019entrée pour toute demande d\u2019adaptation de poste.'],
  ['L\u2019acoustique a-t-elle été pensée pour les personnes sensibles au bruit ?', 'Oui, l\u2019acoustique fait partie des points d\u2019attention explicites du projet, au même titre que l\u2019ergonomie et la qualité de l\u2019air.'],
  ['Y a-t-il un espace de récupération en cas de besoin ?', 'Oui, l\u2019espace bien-être prévoit repos et récupération.'],

  // divers usages concrets, langage spontané
  ['Et pour manger le midi, on fait comment ?', 'Vous pourrez utiliser le restaurant (environ 220 places), le Café central ou la Terrasse selon vos envies.'],
  ['Je peux amener mon vélo à l\u2019intérieur ?', 'Non, un local vélos dédié de 160 places est prévu, avec douches et casiers à proximité.'],
  ['C\u2019est loin de la gare ?', 'Cobalt est situé à Saint-Denis Pleyel, avec un accès direct en RER et métro.'],
  ['Il y a combien d\u2019étages ?', 'Le bâtiment compte 8 niveaux.'],
  ['Combien de personnes vont travailler à Cobalt ?', 'Environ 640 collaborateurs sont concernés par le projet.'],
  ['Qui sont les ambassadeurs, ils servent à quoi ?', 'Les ambassadeurs sont des relais de proximité dans chaque service, pour répondre à vos questions au quotidien.'],
  ['On peut suivre l\u2019avancement du projet quelque part ?', 'Oui, les actualités et les jalons du projet sont mis à jour régulièrement dans Storm.'],
  ['Le mobilier du plateau témoin, c\u2019est celui qu\u2019on aura à Cobalt ?', 'Le plateau témoin permet de tester les mobiliers et futurs usages envisagés pour Cobalt.'],
  ['Est-ce que les ateliers équipes sont obligatoires ?', 'Ils sont fortement recommandés pour préparer au mieux votre quartier d\u2019équipe, mais organisés avec votre manager.'],
  ['Qui décide de la composition des quartiers d\u2019équipe ?', 'Chaque équipe choisit son quartier lors des ateliers dédiés, en lien avec l\u2019équipe projet.'],
  ['Le projet prévoit-il des espaces pour les stagiaires et alternants ?', 'Les quartiers d\u2019équipe accueillent l\u2019ensemble des collaborateurs, y compris stagiaires et alternants rattachés à une équipe.'],
  ['Y a-t-il un contact si j\u2019ai une question qui n\u2019est pas dans Storm ?', 'Vous pouvez contacter un ambassadeur de votre service ou l\u2019équipe projet directement.'],

  // compléments -- calendrier & déménagement
  ['Le guide des nouveaux usages, c\u2019est quoi concrètement ?', 'Un document pratique qui explique comment fonctionneront les espaces et les usages quotidiens à Cobalt.'],
  ['Est-ce qu\u2019il y aura des points d\u2019étape réguliers ?', 'Oui, des actualités et jalons sont publiés régulièrement dans Storm au fil de l\u2019avancement.'],

  // compléments -- postes & flex office
  ['Est-ce que je change d\u2019équipe si mon quartier change ?', 'Non, le quartier d\u2019équipe suit votre équipe, il ne modifie pas votre rattachement hiérarchique.'],
  ['Les managers auront-ils un espace dédié ?', 'Non, les managers travaillent au sein du même quartier d\u2019équipe que leur équipe, sans bureau à part.'],
  ['Le flex office s\u2019applique-t-il à tout le monde, y compris la direction ?', 'Oui, le principe du quartier d\u2019équipe sans poste attribué s\u2019applique à l\u2019ensemble des collaborateurs.'],

  // compléments -- réservation & présence
  ['Comment savoir si une salle est libre ?', 'L\u2019outil de réservation habituel indique la disponibilité des salles en temps réel.'],
  ['Peut-on annuler une réservation de Project Room ?', 'Oui, les réservations peuvent être annulées via l\u2019outil de réservation.'],

  // compléments -- espaces & usages
  ['Les espaces Focus sont-ils fermés ou ouverts ?', 'Ce sont des postes individuels isolés, pensés pour limiter les distractions sans être totalement cloisonnés.'],
  ['Peut-on manger à son poste ?', 'Les espaces prévus pour la restauration sont le Café central, le Restaurant et la Terrasse, plutôt que les postes de travail.'],
  ['Le café central est-il accessible toute la journée ?', 'Oui, le Café central est pensé comme un lieu de convivialité accessible tout au long de la journée.'],

  // compléments -- casiers & rangement
  ['Le casier est-il suffisant pour un carton de dossiers ?', 'Les casiers sont dimensionnés pour les effets personnels et documents courants -- le détail des tailles sera précisé avec l\u2019ouverture des réservations.'],
  ['Y a-t-il un casier par personne ou par équipe ?', 'Les casiers sont individuels, réservables par chaque collaborateur.'],

  // compléments -- télétravail & organisation
  ['Cobalt va-t-il encourager plus de présence sur site ?', 'Le projet vise surtout à améliorer la qualité des espaces disponibles sur site, sans changer les règles de télétravail.'],

  // compléments -- IT & équipements
  ['Faudra-t-il réinstaller mes logiciels le jour J ?', 'Non, la configuration de votre poste est prise en charge par l\u2019IT en amont du déménagement.'],
  ['Les imprimantes seront-elles disponibles dans chaque quartier ?', 'Le détail de l\u2019implantation des équipements partagés sera précisé dans le guide des nouveaux usages.'],

  // compléments -- réunions & confidentialité
  ['Puis-je réserver une salle pour un appel client confidentiel ?', 'Oui, les salles de réunion et bulles conviennent à ce type d\u2019échange.'],

  // compléments -- mobilité & accès
  ['Y a-t-il des bornes de recharge pour voitures électriques ?', 'Les modalités de stationnement et de recharge seront précisées avant l\u2019emménagement.'],
  ['Le site est-il proche d\u2019un arrêt de bus ?', 'Les détails de desserte complète (bus, RER, métro) seront communiqués avant l\u2019emménagement.'],

  // compléments -- services & restauration
  ['Y a-t-il des distributeurs si je veux juste un snack ?', 'L\u2019offre précise de restauration rapide sera détaillée avant l\u2019ouverture du site.'],
  ['Le restaurant propose-t-il un menu différent chaque jour ?', 'Le Restaurant proposera une offre chaude, végétarienne et rapide -- le détail de la carte sera communiqué plus tard.'],

  // compléments -- accessibilité & bien-être
  ['Qui puis-je contacter pour une question d\u2019accessibilité avant même le déménagement ?', 'Vous pouvez vous adresser dès maintenant aux circuits RH/santé habituels ou à un ambassadeur.'],

  // compléments -- divers usages concrets
  ['Le Forum sera-t-il utilisé pour les réunions d\u2019équipe classiques ?', 'Le Forum est plutôt réservé aux grands événements et prises de parole, jusqu\u2019à 120 personnes.'],
  ['Les ambassadeurs sont-ils dans mon service ?', 'Oui, chaque service dispose d\u2019un ambassadeur qui sert de relais de proximité.'],
  ['Comment sont choisis les ambassadeurs ?', 'Les ambassadeurs sont désignés au sein de chaque service comme relais de proximité pour le projet.'],
  ['Le projet prévoit-il d\u2019autres ateliers après le choix des quartiers ?', 'Oui, des visites et une semaine de préparation sont prévues avant l\u2019emménagement.'],
  ['Y aura-t-il une signalétique pour se repérer facilement ?', 'Des repères simples, via les quartiers de référence, sont prévus pour faciliter l\u2019orientation.'],
  ['Qui gère les premiers retours après l\u2019ouverture du plateau témoin ?', 'L\u2019équipe projet recueille les retours pour ajuster les choix avant le déménagement définitif.'],
  ['Le projet est-il définitif ou peut-il encore évoluer ?', 'Le projet reste ajustable : les usages seront observés après l\u2019emménagement et des ajustements resteront possibles.'],
  ['Puis-je proposer une idée d\u2019amélioration ?', 'Oui, vous pouvez transmettre vos idées à votre ambassadeur ou à l\u2019équipe projet.']
];

// ── Télémétrie synthétique — orchestration ──────────────────────────
// Deux périodes distinctes de 30 jours, chacune avec ses propres
// cibles (voir corrections mathématiques verrouillées avant
// l'orchestration) :
//   courante  : 412 visiteurs / 689 sessions / 303 retours (44%) / 2618 pages
//   précédente: 350 visiteurs / 584 sessions / 234 retours (40%) / 1869 pages
// La période précédente est générée en PLUS de la courante -- pas à sa
// place -- pour que les deltas Pilotage (sessions/contenu/Storm Match/
// météo, tous lus depuis les agrégats durables jamais purgés) soient
// réellement exacts. Les visiteurs uniques restent structurellement
// non comparables au-delà de 40 jours (voir correctif pilotage.js) --
// assumé, jamais contourné.
const MATCH_TOPICS_CURRENT = [
  ['Aurai-je un bureau attitré ?', 58],
  ['Le projet change-t-il le télétravail ?', 41],
  ['Où travailler au calme ?', 28],
  ['Dois-je réserver un poste ?', 17],
  ['Comment accéder à Cobalt en transport en commun ?', 12],
  ['Quel matériel IT sera fourni sur les nouveaux postes ?', 10],
  ['J\u2019aurai un casier personnel ?', 8],
  ['Y aura-t-il un restaurant ?', 5],
  ['Cobalt est-il accessible aux personnes à mobilité réduite ?', 4],
  ['Comment accueillir un visiteur ?', 3]
];
const MATCH_TOPICS_PREVIOUS = [
  ['Aurai-je un bureau attitré ?', 48],
  ['Le projet change-t-il le télétravail ?', 32],
  ['Où travailler au calme ?', 22],
  ['Dois-je réserver un poste ?', 13],
  ['Comment accéder à Cobalt en transport en commun ?', 9],
  ['Quel matériel IT sera fourni sur les nouveaux postes ?', 8],
  ['J\u2019aurai un casier personnel ?', 6],
  ['Y aura-t-il un restaurant ?', 4],
  ['Cobalt est-il accessible aux personnes à mobilité réduite ?', 3],
  ['Comment accueillir un visiteur ?', 2]
];
const CONTENT_TARGETS = { home: 816, spaces: 684, news: 666, questions: 301, ambassadors: 151 };
const MOOD_CURRENT = { 5: 29, 4: 33, 3: 20, 2: 9, 1: 5 };
const MOOD_PREVIOUS = { 5: 25, 4: 29, 3: 17, 2: 8, 1: 5 };

async function generateDemoTelemetry(pool, { tenantId, projectId, questionIdByText }) {
  const { mulberry32, buildSessionPlan, assignPathsToSessions, assignMatchEvents, assignMoodEvents, buildPrepopBufferEvents } = await import('./seedDemoTelemetry.js');
  const rng = mulberry32(20260901);
  const now = new Date();

  const currentPeriodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const { sessions: currentSessions, prepopVisitorRefs: currentPrepop } = buildSessionPlan({
    rng, days: 30, endDate: now,
    targetVisitors: 412, targetSessions: 689, targetReturningSessions: 303, targetPageViews: 2618
  });
  const previousEndDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const previousPeriodStart = new Date(previousEndDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const { sessions: previousSessions, prepopVisitorRefs: previousPrepop } = buildSessionPlan({
    rng, days: 30, endDate: previousEndDate,
    targetVisitors: 350, targetSessions: 584, targetReturningSessions: 234, targetPageViews: 1869
  });

  // Événements tampon pré-période -- une visite antérieure réelle pour
  // chaque visiteur "prepop", sans quoi leur première session en
  // période ne compterait jamais comme un retour (bug trouvé et
  // corrigé, voir commentaire de buildPrepopBufferEvents). Datés
  // STRICTEMENT avant le début de la période PRÉCÉDENTE (jamais
  // seulement avant le début de la période courante) -- sinon ces
  // événements tombent dans la fenêtre de requête [J-60,J-30) de la
  // période précédente et gonflent artificiellement ses totaux (bug
  // trouvé par test direct : +26 sessions et +26 pages exactement,
  // correspondant aux 26 tampons mal datés). resolveSession() n'a
  // aucune contrainte de proximité temporelle pour la détection "déjà
  // vu avant" -- dater plus loin dans le passé ne change rien à son
  // fonctionnement, seulement à quelle fenêtre d'agrégat les capte.
  const currentPrepopBuffer = buildPrepopBufferEvents(rng, currentPrepop, previousPeriodStart, 10);
  const previousPrepopBuffer = buildPrepopBufferEvents(rng, previousPrepop, previousPeriodStart, 10);

  const currentPageEvents = assignPathsToSessions(rng, currentSessions, CONTENT_TARGETS);
  const scale = 1869 / 2618;
  const previousContentTargets = Object.fromEntries(Object.entries(CONTENT_TARGETS).map(([k, v]) => [k, Math.round(v * scale)]));
  {
    const diff = 1869 - Object.values(previousContentTargets).reduce((s, v) => s + v, 0);
    previousContentTargets.home += diff;
  }
  const previousPageEvents = assignPathsToSessions(rng, previousSessions, previousContentTargets);

  const matchedCurrent = MATCH_TOPICS_CURRENT.map(([text, count]) => ({ matchedEntryId: questionIdByText[text], count }));
  const matchedPrevious = MATCH_TOPICS_PREVIOUS.map(([text, count]) => ({ matchedEntryId: questionIdByText[text], count }));
  const currentMatchEvents = assignMatchEvents(rng, currentSessions, matchedCurrent, 28);
  const previousMatchEvents = assignMatchEvents(rng, previousSessions, matchedPrevious, 16);

  const currentMoodEvents = assignMoodEvents(rng, 30, now, MOOD_CURRENT);
  const previousMoodEvents = assignMoodEvents(rng, 30, previousEndDate, MOOD_PREVIOUS);

  // Fusion chronologique GLOBALE -- resolveSession() regarde le
  // dernier événement tous types confondus, un ordre partiel casserait
  // le calcul des écarts (voir vérification préalable). Garantie
  // supplémentaire (verrouillée) : le premier événement de chaque
  // session est un page_view -- assignPathsToSessions() positionne
  // chaque page_view à partir de s.startTime + offset croissant dès 0 ;
  // assignMatchEvents() positionne ses événements à un offset >= 0 à
  // partir de ce même s.startTime -- un match_result ne peut donc
  // jamais précéder la première page vue de sa session.
  const allEvents = [
    ...currentPrepopBuffer, ...previousPrepopBuffer,
    ...currentPageEvents, ...previousPageEvents,
    ...currentMatchEvents, ...previousMatchEvents,
    ...currentMoodEvents, ...previousMoodEvents
  ].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  // skipPurge:true sur les 3 appels ci-dessous -- bug trouvé et
  // corrigé par test direct pendant l'implémentation : sans ce
  // paramètre, la purge probabiliste (2% par écriture) se déclenche
  // presque certainement au moins une fois sur un lot de cette taille
  // (1-0.98^1869 ≈ 100%), et supprime alors TOUT événement de plus de
  // 40 jours -- y compris ceux que ce même lot vient d'insérer pour la
  // période précédente (31-60 jours dans le passé). Confirmé : sans
  // skipPurge, seulement 574/1869 événements survivaient ; avec,
  // 1869/1869 exacts. Jamais une modification de la politique de
  // rétention elle-même (toujours 40 jours en production) -- seulement
  // un report de la purge après la fin de CE lot historique cohérent.
  logger.info({ total: allEvents.length }, 'Plan de télémétrie construit, insertion en cours (ordre chronologique strict)');

  let inserted = 0;
  for (const e of allEvents) {
    if (e.type === 'page_view') {
      await recordPageView(pool, { tenantId, projectId, visitorRef: e.visitorRef, path: e.path, now: e.occurredAt, skipPurge: true });
    } else if (e.type === 'match_result') {
      await recordMatchResult(pool, { tenantId, projectId, visitorRef: e.visitorRef, outcome: e.outcome, matchedEntryId: e.matchedEntryId, confidenceBucket: e.confidenceBucket, now: e.occurredAt, skipPurge: true });
    } else if (e.type === 'mood_feedback') {
      await recordMoodFeedback(pool, { tenantId, projectId, value: e.value, now: e.occurredAt, skipPurge: true });
    }
    inserted++;
    if (inserted % 500 === 0) logger.info({ inserted, total: allEvents.length }, 'Télémétrie — progression');
  }

  logger.info({ inserted }, 'Télémétrie démo générée');
}

export { seedDemo, generateDemoTelemetry, DEMO_TENANT_NAME, DEMO_PROJECT_NAME, CONTENT_AUTHOR_EMAIL, findOrCreateDemoTenant, grantPlatformDemoIdentityAccess, PLATFORM_DEMO_IDENTITY_EMAIL };

import { fileURLToPath } from 'node:url';
import path from 'node:path';

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  seedDemo()
    .then(async ({ pool, tenantId, projectId, userId, questionIdByText }) => {
      await generateDemoTelemetry(pool, { tenantId, projectId, questionIdByText });
      const publication = await createPublication(pool, { tenantId, projectId, userId });
      logger.info({ tenantId, projectId, userId, publicationRevision: publication?.revision }, 'Seed démo terminé — structure, télémétrie et publication');
      await closePool();
      process.exit(0);
    })
    .catch(err => {
      logger.error({ err }, 'Echec du seed démo');
      closePool().finally(() => process.exit(1));
    });
}
