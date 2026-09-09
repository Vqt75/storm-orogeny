import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// Drag & drop Studio -- ajouté sur demande explicite ("on peut
// intégrer le drag & drop sur l'ensemble des encarts images/plans/
// pdf ?"). Un seul helper wireDropZone(el, onFile) dupliqué à
// l'identique dans chaque page statique (pas de module JS partagé
// entre ces fichiers autonomes, cohérent avec la convention déjà en
// place -- ex. loadAssetImages()/devHeaders() déjà dupliqués de la
// même façon). Le principe testé partout : le drop appelle toujours
// la MÊME fonction d'upload déjà câblée au clic classique, jamais un
// second chemin parallèle.

const files = {
  identite: 'studio-identite.html',
  actualites: 'studio-actualites.html',
  ambassadeurs: 'studio-ambassadeurs.html',
  espaces: 'studio-espaces.html',
  leProjet: 'studio-le-projet.html'
};

const html = {};

test.before(async () => {
  for (const [key, filename] of Object.entries(files)) {
    html[key] = await fs.readFile(new URL(`../public/${filename}`, import.meta.url), 'utf8');
  }
});

// ── Helper présent et cohérent sur les cinq pages ────────────────────

test('wireDropZone présent sur les cinq pages, signature identique', () => {
  for (const [key, content] of Object.entries(html)) {
    assert.match(content, /function wireDropZone\(el,onFile\)/, `${key} doit porter le helper`);
    assert.match(content, /el\.addEventListener\((['"])drop\1/, `${key} doit gérer l'événement drop`);
  }
});

test('wireDropZone empêche le comportement par défaut du navigateur (ouverture du fichier) sur dragover ET drop', () => {
  for (const [key, content] of Object.entries(html)) {
    const idx = content.indexOf('function wireDropZone');
    const snippet = content.slice(idx, idx + 700);
    const preventCount = (snippet.match(/e\.preventDefault\(\)/g) || []).length;
    assert.ok(preventCount >= 3, `${key} doit appeler preventDefault sur dragover/dragenter/drop`);
  }
});

test('classe visuelle drag-active posée/retirée -- jamais un dépôt sans retour visuel', () => {
  for (const [key, content] of Object.entries(html)) {
    assert.match(content, /classList\.add\((['"])drag-active\1\)/, `${key} doit indiquer visuellement la zone de dépôt active`);
    assert.match(content, /classList\.remove\((['"])drag-active\1\)/, `${key} doit retirer l'indication à la fin`);
    assert.match(content, /\.drag-active\{/, `${key} doit définir le style correspondant`);
  }
});

// ── Chaque page : le dépôt réutilise la fonction d'upload existante, jamais un second chemin ──

test('Identité -- logo : dépôt et clic appellent la même fonction handleLogoFile', () => {
  const c = html.identite;
  assert.match(c, /async function handleLogoFile\(file\)/);
  assert.match(c, /logoInput\.onchange=async\(\)=>\{\s*const file=logoInput\.files\?\.\[0\];if\(!file\)return;\s*await handleLogoFile\(file\);/);
  assert.match(c, /wireDropZone\(document\.getElementById\("logoBox"\),handleLogoFile\)/);
});

test('Actualités -- image de bloc : dépôt et clic appellent la même fonction replaceImageBlock', () => {
  const c = html.actualites;
  assert.match(c, /async function replaceImageBlock\(index,file\)/);
  assert.match(c, /replaceIndex\){replaceImageBlock\(\+replaceIndex,file\);return\}/);
  assert.match(c, /wireDropZone\(el,file=>replaceImageBlock\(i,file\)\)/);
});

test('Ambassadeurs -- photo : dépôt et clic appellent la même fonction uploadPhoto', () => {
  const c = html.ambassadeurs;
  assert.match(c, /photoInput\.addEventListener\("change",\(\)=>\{\s*const file=photoInput\.files\?\.\[0\];if\(file\)uploadPhoto\(file\);/);
  assert.match(c, /wireDropZone\(document\.getElementById\("photoBox"\),uploadPhoto\)/);
});

test('Espaces -- aperçus (vues/plans/PDF) : dépôt réutilise uploadSelectedFile, jamais un second mécanisme', () => {
  const c = html.espaces;
  assert.match(c, /async function uploadSelectedFile\(file,kind,replaceKey\)/);
  assert.match(c, /wireDropZone\(card\.querySelector\("\.preview"\),file=>uploadSelectedFile\(file,m\.kind,mediaKey\(m\)\)\)/);
  // Couvre explicitement les trois types -- vue, plan, document (PDF).
  assert.match(c, /m\.kind===.view./);
  assert.match(c, /m\.kind===.plan./);
  assert.match(c, /kind===.document.\?.application\/pdf./);
});

test('Le Projet -- photo d\'équipe : dépôt et clic appellent la même fonction uploadTeamPhoto', () => {
  const c = html.leProjet;
  assert.match(c, /async function uploadTeamPhoto\(memberId,file\)/);
  assert.match(c, /teamPhotoInput\.onchange=async\(\)=>\{const f=teamPhotoInput\.files\?\.\[0\];await uploadTeamPhoto\(teamPhotoInput\.dataset\.member,f\)\}/);
  assert.match(c, /wireDropZone\(el\.querySelector\('\[data-photo-box\]'\),file=>uploadTeamPhoto\(m\.id,file\)\)/);
});

test('Le Projet -- média de récit : dépôt et clic appellent la même fonction uploadNarrativeMedia', () => {
  const c = html.leProjet;
  assert.match(c, /async function uploadNarrativeMedia\(sectionId,file\)/);
  assert.match(c, /wireDropZone\(el\.querySelector\('\[data-upload\]'\),file=>uploadNarrativeMedia\(s\.id,file\)\)/);
});

// ── Aucune régression du contrat d'upload existant ───────────────────

test('tous les inputs file cachés restent présents -- le clic classique reste disponible partout', () => {
  assert.match(html.identite, /id="logoInput"/);
  assert.match(html.actualites, /id="imageFileInput"/);
  assert.match(html.ambassadeurs, /id="photoInput"/);
  assert.match(html.espaces, /id="fileInput"/);
  assert.match(html.leProjet, /id="mediaInput"/);
  assert.match(html.leProjet, /id="teamPhotoInput"/);
});
