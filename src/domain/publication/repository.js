// Publication — orchestration complète : Snapshot → Candidate →
// Compiler → Manifest → activation atomique.
//
// Slice 0 (Phase 2D) : le Snapshot capture déjà l'intégralité des 6
// domaines Studio, en une seule transaction REPEATABLE READ — c'est
// l'invariant central de ce slice, non négociable, même si le
// Candidate/Compiler ne consomment pour l'instant que Homepage. Un
// snapshot partiel aujourd'hui obligerait à revalider l'atomicité plus
// tard, sur un chemin déjà considéré acquis.
import { findProjectIdentity } from '../projects/repository.js';
import {
  findSectionContent,
  listQuestions,
  listArticles,
  listMilestones,
  listTeamMembers,
  listNarrativeSections,
  listAmbassadors,
  listSpaces
} from '../studio/repository.js';
import { buildCandidate } from './candidate.js';
import { compile, CompilerBlockingError } from './compiler.js';

const COMPILER_VERSION = 'orogeny-slice3';

// Une seule lecture par domaine, séquentielle (une connexion pg ne
// peut exécuter qu'une requête à la fois) mais toutes dans la MÊME
// transaction REPEATABLE READ : chaque lecture voit l'état figé au
// début de la transaction, pas l'état courant au moment où elle
// s'exécute. C'est ce qui rend le Snapshot réellement atomique entre
// les 6 domaines, pas seulement "rapide donc probablement cohérent".
async function buildSnapshot(client, { projectId }) {
  const { rows: projectRows } = await client.query('select name from projects where id=$1', [projectId]);
  const project = projectRows[0] ? { name: projectRows[0].name } : null;

  const identityRow = await findProjectIdentity(client, projectId);
  const identity = identityRow ? {
    logoAssetId: identityRow.logo_asset_id,
    primaryColor: identityRow.primary_color,
    secondaryColor: identityRow.secondary_color,
    fontPrimary: identityRow.font_primary,
    fontPrimaryAssetId: identityRow.font_primary_asset_id,
    fontSecondary: identityRow.font_secondary,
    fontSecondaryAssetId: identityRow.font_secondary_asset_id,
    theme: identityRow.theme
  } : null;

  const homepageContent = await findSectionContent(client, { projectId, sectionKey: 'homepage' });
  // fields est déjà stocké en camelCase (voir Homepage V3) — aucun
  // mapping nécessaire, c'est la forme authentique telle qu'écrite par
  // Studio.
  const homepage = homepageContent?.fields ?? {};

  const leProjetContent = await findSectionContent(client, { projectId, sectionKey: 'le_projet' });

  // Les 5 autres domaines : capturés intégralement dès ce slice
  // (invariant d'atomicité), au format brut du repository Studio.
  // Aucun mapping camelCase appliqué ici — ce n'est pas le rôle du
  // Snapshot (copie fidèle de l'état autoritaire) ; le mapping/la
  // sélection appartiennent à l'étape Candidate, quand un slice futur
  // consommera réellement ces domaines.
  const narrativeSections = await listNarrativeSections(client, projectId);
  const milestones = await listMilestones(client, projectId);
  const team = await listTeamMembers(client, projectId);
  const spaces = await listSpaces(client, projectId);
  const articles = await listArticles(client, projectId);
  const ambassadors = await listAmbassadors(client, projectId);
  const questions = await listQuestions(client, projectId);

  // Content-type réel de chaque asset du projet — nécessaire pour que
  // le Compiler puisse construire des URLs publiques portant la bonne
  // extension de fichier (voir publicAssetUrl, compiler.js). Une seule
  // lecture groupée, jamais une requête par référence éparpillée dans
  // chaque domaine.
  const { rows: assetRows } = await client.query('select id, content_type from assets where project_id=$1', [projectId]);
  const assetContentTypes = Object.fromEntries(assetRows.map(a => [a.id, a.content_type]));

  return {
    project,
    identity,
    homepage,
    leProjet: { intro: leProjetContent?.fields ?? {}, sections: narrativeSections, milestones, team },
    spaces,
    articles,
    ambassadors,
    questions,
    assetContentTypes
  };
}

function buildCompilationContext(revision, projectId) {
  const generatedAt = new Date().toISOString();
  return { generatedAt, revision, projectId };
}

// createPublication — point d'entrée unique de ce module.
//
// TROIS transactions distinctes, jamais une ni deux — trouvé
// nécessaire en testant explicitement la concurrence (deux
// publications simultanées sur le même projet), à deux reprises :
//
//   1er échec : un calcul de "prochaine révision" fait dans la même
//   transaction REPEATABLE READ que le reste entrait en collision —
//   sous REPEATABLE READ, l'instantané se fixe à la première requête
//   de la transaction, pas au moment où un verrou FOR UPDATE se
//   débloque. Corrigé en isolant le calcul de révision dans sa propre
//   transaction courte, validée immédiatement.
//
//   2e échec, plus subtil : déplacer le verrou FOR UPDATE en tête de
//   la transaction REPEATABLE READ ne suffit pas non plus — la
//   re-lecture après déblocage d'un verrou ne concerne QUE la ligne
//   verrouillée elle-même, jamais l'instantané de la transaction dans
//   son ensemble. Deux tentatives concurrentes pouvaient donc encore
//   toutes deux constater "aucune publication active" au moment de la
//   bascule, et entrer en collision sur idx_project_publications_
//   one_active_per_project.
//
// D'où la séparation en trois transactions, chacune avec le niveau
// d'isolation qui correspond réellement à son besoin :
//
//   Transaction 1 (courte, isolation par défaut) : verrouille la ligne
//   projet, calcule la prochaine révision, insère la ligne 'compiling'.
//   Commit immédiat — libère le verrou pour la tentative suivante.
//
//   Transaction 2 (REPEATABLE READ, lecture seule) : snapshot atomique
//   des 6 domaines Studio. Aucun verrou nécessaire ici — elle ne veut
//   qu'un instantané interne cohérent, jamais coordonner une écriture
//   avec quiconque.
//
//   Transaction 3 (courte, isolation par défaut, verrou en tête) :
//   verrouille de nouveau la ligne projet AVANT toute lecture, puis
//   écrit le résultat de la compilation et bascule active/superseded.
//   Isolation par défaut (jamais REPEATABLE READ) précisément pour
//   que la vérification "y a-t-il une publication active ?" voie
//   l'état réellement courant une fois le verrou obtenu, pas un
//   instantané pris avant que la tentative précédente n'ait validé.
export async function createPublication(pool, { tenantId, projectId, userId }) {
  const client = await pool.connect();

  let pendingId;
  let revision;
  try {
    await client.query('BEGIN');
    const { rows: lockRows } = await client.query('select id from projects where id=$1 for update', [projectId]);
    if (!lockRows[0]) {
      await client.query('ROLLBACK');
      client.release();
      return null;
    }
    const { rows: revRows } = await client.query(
      'select coalesce(max(revision), 0) + 1 as next from project_publications where project_id=$1',
      [projectId]
    );
    revision = revRows[0].next;
    const { rows: [pending] } = await client.query(
      `insert into project_publications (tenant_id, project_id, revision, status, created_by_user_id)
       values ($1,$2,$3,'compiling',$4) returning id`,
      [tenantId, projectId, revision, userId]
    );
    pendingId = pending.id;
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    throw err;
  }

  let snapshot;
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    snapshot = await buildSnapshot(client, { projectId });
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    throw err;
  }

  const candidate = buildCandidate(snapshot);
  const context = buildCompilationContext(revision, projectId);

  let manifest = null;
  let warnings = [];
  let compileError = null;
  try {
    const result = compile(candidate, context);
    manifest = result.manifest;
    warnings = result.warnings;
  } catch (err) {
    if (!(err instanceof CompilerBlockingError)) {
      client.release();
      throw err;
    }
    compileError = err;
  }

  try {
    await client.query('BEGIN');
    // Verrou en tête, avant toute lecture de cette transaction —
    // isolation par défaut (jamais REPEATABLE READ) pour que ce qui
    // suit voie l'état réellement courant une fois le verrou obtenu.
    await client.query('select id from projects where id=$1 for update', [projectId]);

    if (compileError) {
      await client.query(
        `update project_publications
         set status='failed', snapshot=$1, candidate=$2, compiler_version=$3,
             failure_code=$4, failure_detail=$5, compiled_at=now()
         where id=$6`,
        [JSON.stringify(snapshot), JSON.stringify(candidate), COMPILER_VERSION, compileError.code, compileError.message, pendingId]
      );
      await client.query('COMMIT');
      return { id: pendingId, revision, status: 'failed', failureCode: compileError.code, failureDetail: compileError.message };
    }

    await client.query(
      `update project_publications
       set status='ready', snapshot=$1, candidate=$2, manifest=$3, warnings=$4, compiler_version=$5, compiled_at=now()
       where id=$6`,
      [JSON.stringify(snapshot), JSON.stringify(candidate), JSON.stringify(manifest), JSON.stringify(warnings), COMPILER_VERSION, pendingId]
    );

    // Bascule atomique : l'éventuelle publication active précédente
    // passe superseded, la nouvelle devient active — dans la même
    // transaction, sous un verrou qui vient d'être acquis fraîchement.
    await client.query(
      `update project_publications set status='superseded' where project_id=$1 and status='active'`,
      [projectId]
    );
    await client.query(
      `update project_publications set status='active', activated_at=now() where id=$1`,
      [pendingId]
    );

    await client.query('COMMIT');
    return { id: pendingId, revision, status: 'active', manifest, warnings };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function findActivePublication(pool, projectId) {
  const { rows } = await pool.query(
    `select id, revision, status, manifest, warnings, compiler_version, created_at, compiled_at, activated_at
     from project_publications where project_id=$1 and status='active'`,
    [projectId]
  );
  return rows[0] ?? null;
}

export async function listPublications(pool, projectId) {
  const { rows } = await pool.query(
    `select id, revision, status, warnings, compiler_version, failure_code, failure_detail,
            created_by_user_id, created_at, compiled_at, activated_at
     from project_publications where project_id=$1 order by revision desc`,
    [projectId]
  );
  return rows;
}
