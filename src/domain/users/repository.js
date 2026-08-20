// Repository users — fonctions typées et nommées, jamais de query brute
// éparpillée dans les routes.

export async function findUserById(pool, userId) {
  const { rows } = await pool.query(
    'select id, email, display_name from users where id = $1',
    [userId]
  );
  return rows[0] ?? null;
}

export async function findUserByEmail(pool, email) {
  const { rows } = await pool.query(
    'select id, email, display_name from users where email = $1',
    [email]
  );
  return rows[0] ?? null;
}
