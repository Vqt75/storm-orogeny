import pg from 'pg';
import { logger } from '../logger.js';

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
    // Diagnostic sûr — jamais le mot de passe — de la cible de
    // connexion réellement utilisée. migrate.js, seed.js et
    // server.js appellent chacun getPool() dans leur propre process ;
    // ce log permet de confirmer, en comparant les logs de déploiement,
    // que les trois pointent bien vers la même base — un déploiement
    // où le build (migrate+seed) et le service runtime auraient des
    // variables d'environnement de connexion différentes produirait
    // exactement le symptôme "seed réussi, mais rien ne s'affiche" :
    // deux bases distinctes, chacune cohérente avec elle-même,
    // jamais un bug de requête.
    logger.info(
      { host: config.database.host, port: config.database.port, database: config.database.name, ssl: config.database.ssl },
      'Connexion PostgreSQL — cible'
    );
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
