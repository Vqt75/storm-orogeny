// Repository Studio — les six domaines produit (Homepage, Le projet,
// Espaces, Actualités, Ambassadeurs, Questions). Verrouillage optimiste
// sur toutes les ressources parentes : chaque update vérifie
// tenant_id + project_id + id + version, jamais un écrasement
// silencieux. Les fonctions retournent null si la version ne
// correspond plus (l'appelant traduit en 409), ou si la ressource
// n'existe pas/n'appartient pas au projet.
//
// Domaines à enfants (Articles+blocs, Espaces+médias, Sections
// narratives+médias) : les fonctions de mise à jour acceptent un
// client déjà en transaction (jamais leur propre connexion), parent
// et enfants mutés ensemble, une seule unité de version portée par le
// parent.

// ─────────────────────────────────────────────────────────────────
// Questions
// ─────────────────────────────────────────────────────────────────

export async function listQuestions(pool, projectId) {
  const { rows } = await pool.query(
    'select * from project_questions where project_id = $1 order by position asc',
    [projectId]
  );
  return rows;
}

export async function insertQuestion(pool, { tenantId, projectId, question, answerRuns, position, userId }) {
  const { rows: [row] } = await pool.query(
    `insert into project_questions (tenant_id, project_id, question, answer_runs, position, updated_by_user_id)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [tenantId, projectId, question ?? '', JSON.stringify(answerRuns ?? []), position, userId]
  );
  return row;
}

export async function updateQuestion(pool, { tenantId, projectId, id, version, question, answerRuns, userId }) {
  const { rows } = await pool.query(
    `update project_questions
     set question = $1, answer_runs = $2, version = version + 1, updated_at = now(), updated_by_user_id = $3
     where tenant_id = $4 and project_id = $5 and id = $6 and version = $7
     returning *`,
    [question ?? '', JSON.stringify(answerRuns ?? []), userId, tenantId, projectId, id, version]
  );
  return rows[0] ?? null;
}

export async function deleteQuestion(pool, { tenantId, projectId, id, version }) {
  const { rowCount } = await pool.query(
    'delete from project_questions where tenant_id=$1 and project_id=$2 and id=$3 and version=$4',
    [tenantId, projectId, id, version]
  );
  return rowCount > 0;
}

// ─────────────────────────────────────────────────────────────────
// Actualités — Article (parent) + blocs (enfants, pas de version propre)
// ─────────────────────────────────────────────────────────────────

export async function listArticles(pool, projectId) {
  const { rows: articles } = await pool.query(
    'select * from project_articles where project_id = $1 order by position asc',
    [projectId]
  );
  const { rows: blocks } = await pool.query(
    `select b.* from project_article_blocks b
     join project_articles a on a.id = b.article_id
     where a.project_id = $1 order by b.position asc`,
    [projectId]
  );
  return articles.map(article => ({
    ...article,
    blocks: blocks.filter(b => b.article_id === article.id)
  }));
}

export async function insertArticle(pool, { tenantId, projectId, tag, publicationDate, title, chapeauRuns, position, blocks, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [article] } = await client.query(
      `insert into project_articles (tenant_id, project_id, tag, publication_date, title, chapeau_runs, position, updated_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [tenantId, projectId, tag ?? null, publicationDate ?? null, title ?? '', JSON.stringify(chapeauRuns ?? []), position, userId]
    );
    const insertedBlocks = await replaceArticleBlocks(client, { tenantId, projectId, articleId: article.id, blocks: blocks ?? [] });
    await client.query('COMMIT');
    return { ...article, blocks: insertedBlocks };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function replaceArticleBlocks(client, { tenantId, projectId, articleId, blocks }) {
  // Diff simple : on retire tout ce qui appartenait à l'article, on
  // réinsère l'état fourni. Les blocs n'ont pas de version propre —
  // ils appartiennent entièrement à l'unité de version de l'article.
  await client.query('delete from project_article_blocks where tenant_id=$1 and project_id=$2 and article_id=$3', [tenantId, projectId, articleId]);
  const inserted = [];
  for (const block of blocks) {
    const { rows: [row] } = await client.query(
      `insert into project_article_blocks (tenant_id, project_id, article_id, block_type, runs, image_asset_id, position)
       values ($1,$2,$3,$4,$5,$6,$7) returning *`,
      [tenantId, projectId, articleId, block.blockType, block.runs ? JSON.stringify(block.runs) : null, block.imageAssetId ?? null, block.position]
    );
    inserted.push(row);
  }
  return inserted;
}

export async function updateArticle(pool, { tenantId, projectId, id, version, tag, publicationDate, title, chapeauRuns, blocks, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `update project_articles
       set tag=$1, publication_date=$2, title=$3, chapeau_runs=$4, version=version+1, updated_at=now(), updated_by_user_id=$5
       where tenant_id=$6 and project_id=$7 and id=$8 and version=$9
       returning *`,
      [tag ?? null, publicationDate ?? null, title ?? '', JSON.stringify(chapeauRuns ?? []), userId, tenantId, projectId, id, version]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const insertedBlocks = await replaceArticleBlocks(client, { tenantId, projectId, articleId: id, blocks: blocks ?? [] });
    await client.query('COMMIT');
    return { ...rows[0], blocks: insertedBlocks };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteArticle(pool, { tenantId, projectId, id, version }) {
  // Les blocs partent en cascade (FK on delete cascade) — pas besoin
  // de les effacer explicitement.
  const { rowCount } = await pool.query(
    'delete from project_articles where tenant_id=$1 and project_id=$2 and id=$3 and version=$4',
    [tenantId, projectId, id, version]
  );
  return rowCount > 0;
}

// ─────────────────────────────────────────────────────────────────
// Le projet — Jalons, Membres d'équipe, Sections narratives (+médias)
// ─────────────────────────────────────────────────────────────────

export async function listMilestones(pool, projectId) {
  const { rows } = await pool.query('select * from project_milestones where project_id=$1 order by position asc', [projectId]);
  return rows;
}

export async function insertMilestone(pool, { tenantId, projectId, status, dateLabel, label, description, position, userId }) {
  const { rows: [row] } = await pool.query(
    `insert into project_milestones (tenant_id, project_id, status, date_label, label, description, position, updated_by_user_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [tenantId, projectId, status ?? null, dateLabel ?? null, label ?? null, description ?? null, position, userId]
  );
  return row;
}

export async function updateMilestone(pool, { tenantId, projectId, id, version, status, dateLabel, label, description, userId }) {
  const { rows } = await pool.query(
    `update project_milestones
     set status=$1, date_label=$2, label=$3, description=$4, version=version+1, updated_at=now(), updated_by_user_id=$5
     where tenant_id=$6 and project_id=$7 and id=$8 and version=$9
     returning *`,
    [status ?? null, dateLabel ?? null, label ?? null, description ?? null, userId, tenantId, projectId, id, version]
  );
  return rows[0] ?? null;
}

export async function deleteMilestone(pool, { tenantId, projectId, id, version }) {
  const { rowCount } = await pool.query(
    'delete from project_milestones where tenant_id=$1 and project_id=$2 and id=$3 and version=$4',
    [tenantId, projectId, id, version]
  );
  return rowCount > 0;
}

export async function listTeamMembers(pool, projectId) {
  const { rows } = await pool.query('select * from project_team_members where project_id=$1 order by position asc', [projectId]);
  return rows;
}

export async function insertTeamMember(pool, { tenantId, projectId, name, title, badge, photoAssetId, position, userId }) {
  const { rows: [row] } = await pool.query(
    `insert into project_team_members (tenant_id, project_id, name, title, badge, photo_asset_id, position, updated_by_user_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [tenantId, projectId, name ?? '', title ?? null, badge ?? null, photoAssetId ?? null, position, userId]
  );
  return row;
}

export async function updateTeamMember(pool, { tenantId, projectId, id, version, name, title, badge, photoAssetId, userId }) {
  const { rows } = await pool.query(
    `update project_team_members
     set name=$1, title=$2, badge=$3, photo_asset_id=$4, version=version+1, updated_at=now(), updated_by_user_id=$5
     where tenant_id=$6 and project_id=$7 and id=$8 and version=$9
     returning *`,
    [name ?? '', title ?? null, badge ?? null, photoAssetId ?? null, userId, tenantId, projectId, id, version]
  );
  return rows[0] ?? null;
}

export async function deleteTeamMember(pool, { tenantId, projectId, id, version }) {
  const { rowCount } = await pool.query(
    'delete from project_team_members where tenant_id=$1 and project_id=$2 and id=$3 and version=$4',
    [tenantId, projectId, id, version]
  );
  return rowCount > 0;
}

export async function listNarrativeSections(pool, projectId) {
  const { rows: sections } = await pool.query('select * from project_narrative_sections where project_id=$1 order by position asc', [projectId]);
  const { rows: media } = await pool.query(
    `select m.* from project_narrative_section_media m
     join project_narrative_sections s on s.id = m.section_id
     where s.project_id = $1 order by m.position asc`,
    [projectId]
  );
  return sections.map(section => ({ ...section, media: media.filter(m => m.section_id === section.id) }));
}

async function replaceNarrativeSectionMedia(client, { tenantId, projectId, sectionId, media }) {
  await client.query('delete from project_narrative_section_media where tenant_id=$1 and project_id=$2 and section_id=$3', [tenantId, projectId, sectionId]);
  const inserted = [];
  for (const m of media) {
    const { rows: [row] } = await client.query(
      `insert into project_narrative_section_media (tenant_id, project_id, section_id, asset_id, alt, position)
       values ($1,$2,$3,$4,$5,$6) returning *`,
      [tenantId, projectId, sectionId, m.assetId, m.alt ?? null, m.position]
    );
    inserted.push(row);
  }
  return inserted;
}

export async function insertNarrativeSection(pool, { tenantId, projectId, sectionType, payload, media, position, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [section] } = await client.query(
      `insert into project_narrative_sections (tenant_id, project_id, section_type, payload, position, updated_by_user_id)
       values ($1,$2,$3,$4,$5,$6) returning *`,
      [tenantId, projectId, sectionType, JSON.stringify(payload ?? {}), position, userId]
    );
    const insertedMedia = await replaceNarrativeSectionMedia(client, { tenantId, projectId, sectionId: section.id, media: media ?? [] });
    await client.query('COMMIT');
    return { ...section, media: insertedMedia };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateNarrativeSection(pool, { tenantId, projectId, id, version, sectionType, payload, media, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `update project_narrative_sections
       set section_type=$1, payload=$2, version=version+1, updated_at=now(), updated_by_user_id=$3
       where tenant_id=$4 and project_id=$5 and id=$6 and version=$7
       returning *`,
      [sectionType, JSON.stringify(payload ?? {}), userId, tenantId, projectId, id, version]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const insertedMedia = await replaceNarrativeSectionMedia(client, { tenantId, projectId, sectionId: id, media: media ?? [] });
    await client.query('COMMIT');
    return { ...rows[0], media: insertedMedia };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteNarrativeSection(pool, { tenantId, projectId, id, version }) {
  const { rowCount } = await pool.query(
    'delete from project_narrative_sections where tenant_id=$1 and project_id=$2 and id=$3 and version=$4',
    [tenantId, projectId, id, version]
  );
  return rowCount > 0;
}

// ─────────────────────────────────────────────────────────────────
// Ambassadeurs
// ─────────────────────────────────────────────────────────────────

export async function listAmbassadors(pool, projectId) {
  const { rows } = await pool.query('select * from project_ambassadors where project_id=$1 order by position asc', [projectId]);
  return rows;
}

export async function insertAmbassador(pool, { tenantId, projectId, name, role, tag, photoAssetId, contactable, contactChannel, contactValue, position, userId }) {
  const { rows: [row] } = await pool.query(
    `insert into project_ambassadors (tenant_id, project_id, name, role, tag, photo_asset_id, contactable, contact_channel, contact_value, position, updated_by_user_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
    [tenantId, projectId, name ?? '', role ?? null, tag ?? null, photoAssetId ?? null, contactable ?? true, contactChannel ?? null, contactValue ?? null, position, userId]
  );
  return row;
}

export async function updateAmbassador(pool, { tenantId, projectId, id, version, name, role, tag, photoAssetId, contactable, contactChannel, contactValue, userId }) {
  const { rows } = await pool.query(
    `update project_ambassadors
     set name=$1, role=$2, tag=$3, photo_asset_id=$4, contactable=$5, contact_channel=$6, contact_value=$7,
         version=version+1, updated_at=now(), updated_by_user_id=$8
     where tenant_id=$9 and project_id=$10 and id=$11 and version=$12
     returning *`,
    [name ?? '', role ?? null, tag ?? null, photoAssetId ?? null, contactable ?? true, contactChannel ?? null, contactValue ?? null, userId, tenantId, projectId, id, version]
  );
  return rows[0] ?? null;
}

export async function deleteAmbassador(pool, { tenantId, projectId, id, version }) {
  const { rowCount } = await pool.query(
    'delete from project_ambassadors where tenant_id=$1 and project_id=$2 and id=$3 and version=$4',
    [tenantId, projectId, id, version]
  );
  return rowCount > 0;
}

// ─────────────────────────────────────────────────────────────────
// Espaces — Espace (parent) + médias (enfants, pas de version propre)
// ─────────────────────────────────────────────────────────────────

export async function listSpaces(pool, projectId) {
  const { rows: spaces } = await pool.query('select * from project_spaces where project_id=$1 order by position asc', [projectId]);
  const { rows: media } = await pool.query(
    `select m.* from project_space_media m
     join project_spaces s on s.id = m.space_id
     where s.project_id = $1 order by m.position asc`,
    [projectId]
  );
  return spaces.map(space => ({ ...space, media: media.filter(m => m.space_id === space.id) }));
}

async function replaceSpaceMedia(client, { tenantId, projectId, spaceId, media }) {
  await client.query('delete from project_space_media where tenant_id=$1 and project_id=$2 and space_id=$3', [tenantId, projectId, spaceId]);
  const inserted = [];
  for (const m of media) {
    const { rows: [row] } = await client.query(
      `insert into project_space_media (tenant_id, project_id, space_id, kind, asset_id, label, alt, position)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [tenantId, projectId, spaceId, m.kind, m.assetId, m.label ?? null, m.alt ?? null, m.position]
    );
    inserted.push(row);
  }
  return inserted;
}

export async function insertSpace(pool, { tenantId, projectId, name, location, description, status, usages, media, position, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [space] } = await client.query(
      `insert into project_spaces (tenant_id, project_id, name, location, description, status, usages, position, updated_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [tenantId, projectId, name ?? '', location ?? null, description ?? null, status ?? null, usages ?? [], position, userId]
    );
    const insertedMedia = await replaceSpaceMedia(client, { tenantId, projectId, spaceId: space.id, media: media ?? [] });
    await client.query('COMMIT');
    return { ...space, media: insertedMedia };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateSpace(pool, { tenantId, projectId, id, version, name, location, description, status, usages, media, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `update project_spaces
       set name=$1, location=$2, description=$3, status=$4, usages=$5, version=version+1, updated_at=now(), updated_by_user_id=$6
       where tenant_id=$7 and project_id=$8 and id=$9 and version=$10
       returning *`,
      [name ?? '', location ?? null, description ?? null, status ?? null, usages ?? [], userId, tenantId, projectId, id, version]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const insertedMedia = await replaceSpaceMedia(client, { tenantId, projectId, spaceId: id, media: media ?? [] });
    await client.query('COMMIT');
    return { ...rows[0], media: insertedMedia };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteSpace(pool, { tenantId, projectId, id, version }) {
  const { rowCount } = await pool.query(
    'delete from project_spaces where tenant_id=$1 and project_id=$2 and id=$3 and version=$4',
    [tenantId, projectId, id, version]
  );
  return rowCount > 0;
}

// ─────────────────────────────────────────────────────────────────
// Homepage + textes de section (project_section_content)
// ─────────────────────────────────────────────────────────────────

export async function findSectionContent(pool, { projectId, sectionKey }) {
  const { rows } = await pool.query(
    'select * from project_section_content where project_id=$1 and section_key=$2',
    [projectId, sectionKey]
  );
  return rows[0] ?? null;
}

// upsert : la ligne peut ne pas encore exister (aucune donnée saisie
// pour cette section) — version=1 à la création, jamais de conflit
// possible sur une première écriture.
export async function upsertSectionContent(pool, { tenantId, projectId, sectionKey, fields, version, userId }) {
  if (version === undefined || version === null) {
    const { rows } = await pool.query(
      `insert into project_section_content (tenant_id, project_id, section_key, fields, updated_by_user_id)
       values ($1,$2,$3,$4,$5)
       on conflict (tenant_id, project_id, section_key) do nothing
       returning *`,
      [tenantId, projectId, sectionKey, JSON.stringify(fields ?? {}), userId]
    );
    return rows[0] ?? null; // null si la ligne existait déjà -> l'appelant doit fournir une version
  }
  const { rows } = await pool.query(
    `update project_section_content
     set fields=$1, version=version+1, updated_at=now(), updated_by_user_id=$2
     where tenant_id=$3 and project_id=$4 and section_key=$5 and version=$6
     returning *`,
    [JSON.stringify(fields ?? {}), userId, tenantId, projectId, sectionKey, version]
  );
  return rows[0] ?? null;
}
