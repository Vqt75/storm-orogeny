import pg from 'pg';

const { Pool, types } = pg;

// DATE (oid 1082) : renvoyer la chaîne brute YYYY-MM-DD telle que
// PostgreSQL la stocke, jamais un objet Date JS. Une donnée métier de
// type date (ex. publicationDate d'un article) n'est pas un instant
// UTC — la convertir en Date JS puis en ISO string risquerait un
// décalage d'un jour selon le fuseau d'exécution. Configuré une seule
// fois, globalement, pour tout le driver.
types.setTypeParser(1082, val => val);

let pool;

export function getPool(config) {
  if (!pool) {
    pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false
    });
  }
  return pool;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
