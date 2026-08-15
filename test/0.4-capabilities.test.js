import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ProjectCapability, OrganizationCapability,
  bundleHasProjectCapability, bundleHasOrganizationCapability
} from '../src/domain/permissions/capabilities.js';

test('contributor peut éditer le contenu mais pas publier', () => {
  assert.equal(bundleHasProjectCapability('contributor', ProjectCapability.CONTENT_EDIT), true);
  assert.equal(bundleHasProjectCapability('contributor', ProjectCapability.PUBLICATION_PUBLISH), false);
});

test('editor peut éditer et publier', () => {
  assert.equal(bundleHasProjectCapability('editor', ProjectCapability.CONTENT_EDIT), true);
  assert.equal(bundleHasProjectCapability('editor', ProjectCapability.PUBLICATION_PUBLISH), true);
});

test('pilot voit Pilotage mais n\'édite pas le contenu', () => {
  assert.equal(bundleHasProjectCapability('pilot', ProjectCapability.PILOTAGE_VIEW), true);
  assert.equal(bundleHasProjectCapability('pilot', ProjectCapability.CONTENT_EDIT), false);
});

test('project_admin a toutes les capabilities de projet', () => {
  for (const cap of Object.values(ProjectCapability)) {
    assert.equal(bundleHasProjectCapability('project_admin', cap), true, `project_admin devrait avoir ${cap}`);
  }
});

test('un bundle de projet inconnu n\'a aucune capability (repli sûr, jamais une exception qui autoriserait par erreur)', () => {
  for (const cap of Object.values(ProjectCapability)) {
    assert.equal(bundleHasProjectCapability('bundle_inexistant', cap), false);
  }
});

test('member (organisation) n\'a aucune capability organisationnelle', () => {
  for (const cap of Object.values(OrganizationCapability)) {
    assert.equal(bundleHasOrganizationCapability('member', cap), false, `member ne devrait pas avoir ${cap}`);
  }
});

test('organization_admin a toutes les capabilities organisationnelles', () => {
  for (const cap of Object.values(OrganizationCapability)) {
    assert.equal(bundleHasOrganizationCapability('organization_admin', cap), true, `organization_admin devrait avoir ${cap}`);
  }
});

test('invariant central : aucune capability organisationnelle n\'existe dans l\'espace des capabilities de projet, et réciproquement', () => {
  const projectCaps = new Set(Object.values(ProjectCapability));
  const orgCaps = new Set(Object.values(OrganizationCapability));
  for (const cap of orgCaps) assert.equal(projectCaps.has(cap), false, `${cap} ne doit jamais être une capability de projet`);
  for (const cap of projectCaps) assert.equal(orgCaps.has(cap), false, `${cap} ne doit jamais être une capability organisationnelle`);
});

test('organization_admin, en tant que bundle ORGANISATIONNEL, n\'a par construction aucune capability de PROJET (fonctions distinctes, jamais confondues)', () => {
  for (const cap of Object.values(ProjectCapability)) {
    assert.equal(bundleHasProjectCapability('organization_admin', cap), false);
  }
});
