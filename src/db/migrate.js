// Runner de migration — volontairement minuscule. Lit db/migrations/*.sql
// dans l'ordre, applique ce qui manque, chaque fichier dans sa propre
// transaction sur un seul client (BEGIN/apply/record/COMMIT, ROLLBACK
// sur erreur). Aucune gestion de dépendances, aucune migration
// conditionnelle, aucun rollback "magique" au-delà de ce ROLLBACK
// transactionnel simple. Si ce runner commence un jour à avoir besoin
// de plus, on le remplace par un outil dédié — on ne le fait pas
// grossir ici.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config/env.js';
import { getPool, closePool } from './pool.js';
import { logger } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'db', 'migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists schema_migrations (
      name        text primary key,
      applied_at  timestamptz not null default now()
    )
  `);
}

function listMigrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(name => name.endsWith('.sql'))
    .sort(); // les fichiers sont numérotés (0001_, 0002_, ...) — le tri lexicographique suffit
}

async function alreadyApplied(client) {
  const { rows } = await client.query('select name from schema_migrations');
  return new Set(rows.map(r => r.name));
}

export async function runMigrations() {
  const config = loadConfig();
  const pool = getPool(config);
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await alreadyApplied(client);
    const files = listMigrationFiles();
    let appliedCount = 0;

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      logger.info({ file }, 'Application de la migration');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('insert into schema_migrations (name) values ($1)', [file]);
        await client.query('COMMIT');
        appliedCount += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration échouée (${file}) : ${err.message}`, { cause: err });
      }
    }

    logger.info({ appliedCount, total: files.length }, 'Migrations à jour');
    return { appliedCount, total: files.length };
  } finally {
    client.release();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  runMigrations()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch(err => {
      logger.error({ err }, 'Echec des migrations');
      closePool().finally(() => process.exit(1));
    });
}
