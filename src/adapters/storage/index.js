import { createLocalStorageAdapter } from './local.js';

// Un seul point de décision. Aujourd'hui : toujours local. Le jour où
// un vrai object storage existe, ce fichier est le seul à changer —
// voir docs/adr/0003-storage-adapter.md.
export function createStorageAdapter(config) {
  return createLocalStorageAdapter({ baseDir: config.storage.localDir });
}
