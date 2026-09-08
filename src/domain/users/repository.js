// Repository users — fonctions typées et nommées, jamais de query brute
// éparpillée dans les routes.

export async function findUserById(pool, userId) {
  const { rows } = await pool.query(
    'select id, email, display_name, status from users where id = $1',
    [userId]
  );
  return rows[0] ?? null;
}

export async function findUserByEmail(pool, email) {
  const { rows } = await pool.query(
    'select id, email, display_name, status from users where email = $1',
    [email]
  );
  return rows[0] ?? null;
}

// Plus petite primitive nécessaire au linking SSO (Batch 2) -- aucun
// chemin de production ne créait un utilisateur avant ce batch (voir
// audit SSO). Ne gère jamais l'invitation ni la réconciliation --
// strictement la création du user Storm lui-même. Duplicate d'email
// rapporté proprement (même convention que createExternalIdentity),
// jamais une exception brute qui fuite.
export async function insertUser(pool, { email, displayName }) {
  try {
    const { rows: [row] } = await pool.query(
      'insert into users (email, display_name) values ($1, $2) returning id, email, display_name',
      [email, displayName]
    );
    return { ok: true, user: row };
  } catch (err) {
    if (err.code === '23505') {
      return { ok: false, code: 'DUPLICATE' };
    }
    throw err;
  }
}
