// Adapter de storage — implémentation locale (disque), strictement
// derrière l'interface save()/read(). Voir docs/adr/0003-storage-adapter.md.
// Aucune route ni aucun domaine ne doit connaître ce mécanisme : tout
// passe par cette interface, remplaçable par un vrai object storage
// sans changer un seul appelant.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function createLocalStorageAdapter({ baseDir }) {
  async function ensureBaseDir() {
    await fs.mkdir(baseDir, { recursive: true });
  }

  // Garde-fou path traversal -- storageKey est TOUJOURS généré côté
  // serveur par save() (randomUUID, jamais un séparateur de chemin),
  // mais delete()/read() ne doivent jamais faire confiance à cette
  // seule garantie amont : un storageKey contenant '/', '\\' ou '..'
  // est refusé explicitement ici, jamais silencieusement résolu par
  // path.join en dehors de baseDir.
  function assertSafeStorageKey(storageKey) {
    if (typeof storageKey !== 'string' || storageKey.length === 0 ||
        storageKey.includes('/') || storageKey.includes('\\') || storageKey.includes('..')) {
      throw new Error(`storageKey invalide : ${storageKey}`);
    }
  }

  return {
    async save(buffer, { extension } = {}) {
      await ensureBaseDir();
      const storageKey = extension ? `${randomUUID()}.${extension}` : randomUUID();
      await fs.writeFile(path.join(baseDir, storageKey), buffer);
      return { storageKey };
    },

    async read(storageKey) {
      assertSafeStorageKey(storageKey);
      return fs.readFile(path.join(baseDir, storageKey));
    },

    // Idempotent par contrat -- succès si l'objet existe et est
    // supprimé, succès également si l'objet n'existe déjà plus (jamais
    // une erreur NOT_FOUND considérée comme un échec métier). Les
    // vraies erreurs IO/provider remontent normalement. Une clé
    // précise = un objet précis, jamais de suppression par préfixe/
    // dossier implicite.
    async delete(storageKey) {
      assertSafeStorageKey(storageKey);
      try {
        await fs.unlink(path.join(baseDir, storageKey));
      } catch (err) {
        if (err.code === 'ENOENT') return; // déjà absent -- succès, jamais un échec.
        throw err;
      }
    }
  };
}
