import { Router } from 'express';
import { listActiveTenantMembershipsForUser } from '../../domain/memberships/repository.js';
import { OrganizationCapability } from '../../domain/permissions/capabilities.js';
import { createClient, findClientById, searchClients, renameClient } from '../../domain/clients/repository.js';
import { isValidClientName } from '../../domain/clients/slug.js';
import { Errors } from '../../errors/AppError.js';

// Résolution du tenant qualifié pour une capability organisationnelle
// donnée -- même motif que POST /api/projects (voir routes/projects.js) :
// exactement une organisation qualifiée, jamais une ambiguïté résolue
// arbitrairement. Réutilisé ici plutôt que dupliqué en trois endroits.
function requireQualifiedTenant(pool, capability) {
  return async (req, res, next) => {
    const memberships = await listActiveTenantMembershipsForUser(pool, req.user.id);
    const qualified = memberships.filter(m => m.capabilities.includes(capability));

    if (qualified.length === 0) {
      next(Errors.forbidden(`Cette action nécessite la capability "${capability}".`));
      return;
    }
    if (qualified.length > 1) {
      next(Errors.organizationContextRequired());
      return;
    }
    req.tenantMembership = qualified[0];
    next();
  };
}

export function createClientsRouter({ pool }) {
  const router = Router();

  // Recherche/sélection -- disponible à quiconque peut créer un
  // projet (sélectionner un Client existant fait partie de ce geste),
  // jamais réservée à CLIENTS_MANAGE.
  router.get(
    '/',
    requireQualifiedTenant(pool, OrganizationCapability.PROJECTS_CREATE),
    async (req, res) => {
      const query = typeof req.query.search === 'string' ? req.query.search : '';
      const clients = await searchClients(pool, { tenantId: req.tenantMembership.tenant_id, query });
      res.status(200).json(clients.map(c => ({ id: c.id, name: c.name, normalizedSlug: c.normalized_slug })));
    }
  );

  router.get(
    '/:clientId',
    requireQualifiedTenant(pool, OrganizationCapability.PROJECTS_CREATE),
    async (req, res, next) => {
      const client = await findClientById(pool, { tenantId: req.tenantMembership.tenant_id, clientId: req.params.clientId });
      if (!client) {
        next(Errors.notFound('Client'));
        return;
      }
      res.status(200).json({ id: client.id, name: client.name, normalizedSlug: client.normalized_slug, version: client.version });
    }
  );

  // Création/renommage -- structurel, jamais accordé implicitement
  // par PROJECTS_CREATE (voir doctrine capabilities.js).
  router.post(
    '/',
    requireQualifiedTenant(pool, OrganizationCapability.CLIENTS_MANAGE),
    async (req, res, next) => {
      const name = typeof req.body?.name === 'string' ? req.body.name : '';
      if (!isValidClientName(name)) {
        next(Errors.invalid('name est requis et doit produire un identifiant valide.'));
        return;
      }
      const { client, conflict } = await createClient(pool, { tenantId: req.tenantMembership.tenant_id, name });
      if (conflict === 'DUPLICATE_CLIENT_SLUG') {
        res.status(409).json({ ok: false, error: { code: 'DUPLICATE_CLIENT_SLUG', message: 'Un client avec un nom équivalent existe déjà dans cette organisation.' } });
        return;
      }
      res.status(201).json({ id: client.id, name: client.name, normalizedSlug: client.normalized_slug, version: client.version });
    }
  );

  router.patch(
    '/:clientId',
    requireQualifiedTenant(pool, OrganizationCapability.CLIENTS_MANAGE),
    async (req, res, next) => {
      const name = typeof req.body?.name === 'string' ? req.body.name : '';
      const expectedVersion = req.body?.version;
      if (!isValidClientName(name)) {
        next(Errors.invalid('name est requis et doit produire un identifiant valide.'));
        return;
      }
      if (!Number.isInteger(expectedVersion)) {
        next(Errors.invalid('version (entier) requise pour le renommage.'));
        return;
      }
      const { client, conflict } = await renameClient(pool, {
        tenantId: req.tenantMembership.tenant_id, clientId: req.params.clientId, name, expectedVersion
      });
      if (conflict === 'STALE_VERSION') {
        res.status(409).json({ ok: false, error: { code: 'STALE_VERSION', message: 'Ce client a été modifié ailleurs. Rechargez pour repartir de la version actuelle.' } });
        return;
      }
      if (conflict === 'DUPLICATE_CLIENT_SLUG') {
        res.status(409).json({ ok: false, error: { code: 'DUPLICATE_CLIENT_SLUG', message: 'Un client avec un nom équivalent existe déjà dans cette organisation.' } });
        return;
      }
      res.status(200).json({ id: client.id, name: client.name, normalizedSlug: client.normalized_slug, version: client.version });
    }
  );

  return router;
}
