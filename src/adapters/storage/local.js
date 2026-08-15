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

  return {
    async save(buffer, { extension } = {}) {
      await ensureBaseDir();
      const storageKey = extension ? `${randomUUID()}.${extension}` : randomUUID();
      await fs.writeFile(path.join(baseDir, storageKey), buffer);
      return { storageKey };
    },

    async read(storageKey) {
      return fs.readFile(path.join(baseDir, storageKey));
    }
  };
}
