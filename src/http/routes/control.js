import { Router } from 'express';
import { requireOrganizationCapability } from '../middleware/requireOrganizationCapability.js';
import { OrganizationCapability } from '../../domain/permissions/capabilities.js';
import { listAllProjectsForTenant, listTenantMembers, transitionProjectLifecycle } from '../../domain/control/repository.js';
import {
  listProjectAccessSources, projectAccessSummary, listProjectInvitations,
  revokeProjectInvitation, revokeProjectGrant, listExternalGroupMappings, listPendingInvitationsForTenant,
  listMemberProjectAccess
} from '../../domain/memberships/repository.js';
import { insertProjectInvitation, listSupportedLocales } from '../../domain/project-setup/repository.js';
import { requestProjectDeletion, cancelProjectDeletion } from '../../domain/projects/deletionJobs.js';
import { Errors } from '../../errors/AppError.js';
import { AppError } from '../../errors/AppError.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createControlRouter({ pool }) {
  const router = Router();

  // control.access + projects.view_all — les deux vérifiées côté
  // serveur, jamais seulement masquées côté front (voir handoff).
  // Scope strict sur req.tenantMembership.tenant_id, jamais un
  // tenant_id fourni par le client.
  router.get(
    '/projects',
    requireOrganizationCapability(pool, [OrganizationCapability.CONTROL_ACCESS, OrganizationCapability.PROJECTS_VIEW_ALL]),
    async (req, res) => {
      const rows = await listAllProjectsForTenant(pool, req.tenantMembership.tenant_id);
      res.status(200).json(rows.map(r => ({
        id: r.id,
        name: r.name,
        status: r.status,
        previousStatus: r.previous_status,
        createdAt: r.created_at,
        logoAssetId: r.logo_asset_id,
        primaryColor: r.primary_color,
        peopleCount: Number(r.people_count),
        pendingInvitationsCount: Number(r.pending_invitations_count)
      })));
    }
  );

  // Transitions de lifecycle — gardées par projects.manage_lifecycle,
  // JAMAIS par projects.view_all (visibilité pure, sémantiquement
  // incorrecte pour une mutation -- vérifié explicitement avant
  // d'introduire cette capability dédiée, voir capabilities.js).
  async function transition(req, res, next, toStatus) {
    if (!UUID_PATTERN.test(req.params.projectId)) {
      next(Errors.notFound('Projet'));
      return;
    }
    const updated = await transitionProjectLifecycle(pool, {
      tenantId: req.tenantMembership.tenant_id,
      projectId: req.params.projectId,
      toStatus,
      actorUserId: req.user.id
    });
    if (!updated) {
      next(Errors.notFound('Projet'));
      return;
    }
    res.status(200).json({
      id: updated.id,
      name: updated.name,
      status: updated.status,
      previousStatus: updated.previous_status,
      createdAt: updated.created_at
    });
  }

  const LIFECYCLE_CAP = OrganizationCapability.PROJECTS_MANAGE_LIFECYCLE;

  router.post('/projects/:projectId/stabilize', requireOrganizationCapability(pool, LIFECYCLE_CAP),
    (req, res, next) => transition(req, res, next, 'stabilization'));

  router.post('/projects/:projectId/reactivate', requireOrganizationCapability(pool, LIFECYCLE_CAP),
    (req, res, next) => transition(req, res, next, 'active'));

  router.post('/projects/:projectId/archive', requireOrganizationCapability(pool, LIFECYCLE_CAP),
    (req, res, next) => transition(req, res, next, 'archived'));

  // Restauration fidèle -- previous_status mémorisé au moment de
  // l'archivage, jamais systématiquement 'active' (décision produit
  // validée). Le mot réservé 'restore' est résolu dans
  // transitionProjectLifecycle() elle-même.
  router.post('/projects/:projectId/restore', requireOrganizationCapability(pool, LIFECYCLE_CAP),
    (req, res, next) => transition(req, res, next, 'restore'));

  // Suppression définitive — capability distincte, DÉLIBÉRÉMENT non
  // implémentée à ce stade (voir handoff, point 11 et 9 des consignes
  // de suivi : aucun DELETE physique, aucune purge CASCADE, jamais une
  // fausse réussite frontend tant que le chantier Storm Privacy & Data
  // Lifecycle n'avait pas déterminé catégories de données/rétention/
  // anonymisation/audit survivant). Batch 5 : la DEMANDE elle-même est
  // désormais réelle -- capture immédiate du manifest, garde-fou
  // lifecycle/last-active-job, audit transactionnel. La PURGE physique
  // reste un futur batch (Batch 6) -- jamais exécutée ici.
  router.post(
    '/projects/:projectId/delete-permanently',
    requireOrganizationCapability(pool, OrganizationCapability.PROJECTS_DELETE_PERMANENTLY),
    async (req, res, next) => {
      if (!UUID_PATTERN.test(req.params.projectId)) {
        next(Errors.notFound('Projet'));
        return;
      }
      const result = await requestProjectDeletion(pool, {
        tenantId: req.tenantMembership.tenant_id,
        projectId: req.params.projectId,
        actorUserId: req.user.id
      });
      if (!result.ok) {
        const status = result.code === 'NOT_FOUND' ? 404
          : result.code === 'PROJECT_NOT_ARCHIVED' ? 409
          : result.code === 'DELETION_ALREADY_REQUESTED' ? 409
          : 400;
        next(new AppError(result.code, 'Demande de suppression définitive refusée.', { status }));
        return;
      }
      // Jamais de storage key révélée -- uniquement les métadonnées du
      // job lui-même.
      res.status(202).json({
        ok: true,
        jobId: result.jobId,
        purgeAfter: result.purgeAfter,
        cancellable: result.cancellable
      });
    }
  );

  router.post(
    '/projects/:projectId/delete-permanently/cancel',
    requireOrganizationCapability(pool, OrganizationCapability.PROJECTS_DELETE_PERMANENTLY),
    async (req, res, next) => {
      if (!UUID_PATTERN.test(req.params.projectId) || !UUID_PATTERN.test(req.body?.jobId || '')) {
        next(Errors.invalid('jobId requis et valide.'));
        return;
      }
      const result = await cancelProjectDeletion(pool, { jobId: req.body.jobId, actorUserId: req.user.id });
      if (!result.ok) {
        const status = result.code === 'NOT_FOUND' ? 404 : 409;
        next(new AppError(result.code, 'Annulation refusée.', { status }));
        return;
      }
      res.status(200).json({ ok: true });
    }
  );

  router.get(
    '/members',
    requireOrganizationCapability(pool, [OrganizationCapability.CONTROL_ACCESS, OrganizationCapability.MEMBERS_MANAGE]),
    async (req, res) => {
      const rows = await listTenantMembers(pool, req.tenantMembership.tenant_id);
      res.status(200).json(rows.map(r => ({
        id: r.id,
        email: r.email,
        displayName: r.display_name,
        permissionBundle: r.permission_bundle,
        status: r.status,
        createdAt: r.created_at
      })));
    }
  );

  // Gestion des accès d'un projet DEPUIS Storm Control -- gouverné par
  // la capability ORGANISATIONNELLE projects.manage_memberships (gérer
  // les memberships de plusieurs projets), jamais members.manage
  // (niveau projet, exige une project_membership personnelle que
  // l'administrateur Storm Control n'a pas nécessairement -- voir
  // modèle Grant/Bundle validé, distinction explicite des deux
  // niveaux). Lecture seule via CONTROL_ACCESS+PROJECTS_VIEW_ALL, même
  // gate que la liste des projets elle-même.
  const ACCESS_READ_CAP = [OrganizationCapability.CONTROL_ACCESS, OrganizationCapability.PROJECTS_VIEW_ALL];
  const ACCESS_WRITE_CAP = [OrganizationCapability.CONTROL_ACCESS, OrganizationCapability.PROJECTS_MANAGE_MEMBERSHIPS];

  router.get(
    '/projects/:projectId/access',
    requireOrganizationCapability(pool, ACCESS_READ_CAP),
    async (req, res, next) => {
      if (!UUID_PATTERN.test(req.params.projectId)) { next(Errors.notFound('Projet')); return; }
      const tenantId = req.tenantMembership.tenant_id;
      const projectId = req.params.projectId;
      const [people, summary, invitations] = await Promise.all([
        listProjectAccessSources(pool, { tenantId, projectId }),
        projectAccessSummary(pool, { tenantId, projectId }),
        listProjectInvitations(pool, { tenantId, projectId })
      ]);
      res.status(200).json({
        peopleCount: summary.peopleCount,
        pendingInvitationsCount: summary.pendingInvitationsCount,
        people: people.map(p => ({
          userId: p.userId,
          displayName: p.displayName,
          email: p.email,
          sources: p.sources.map(s => ({
            grantId: s.grantId,
            permissionBundle: s.permissionBundle,
            sourceType: s.sourceType,
            externalProvider: s.externalProvider,
            externalGroupId: s.externalGroupId,
            createdAt: s.createdAt
          }))
        })),
        invitations: invitations.map(i => ({
          id: i.id,
          email: i.email,
          permissionBundle: i.permission_bundle,
          status: i.status,
          createdAt: i.created_at,
          acceptedAt: i.accepted_at
        }))
      });
    }
  );

  router.post(
    '/projects/:projectId/invitations',
    requireOrganizationCapability(pool, ACCESS_WRITE_CAP),
    async (req, res, next) => {
      if (!UUID_PATTERN.test(req.params.projectId)) { next(Errors.notFound('Projet')); return; }
      const { email, permissionBundle, locale } = req.body || {};
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        next(Errors.invalid('Adresse email invalide.'));
        return;
      }
      if (!['contributor', 'editor', 'pilot', 'project_admin'].includes(permissionBundle)) {
        next(Errors.invalid('permissionBundle invalide.'));
        return;
      }
      const supportedLocales = await listSupportedLocales(pool);
      const resolvedLocale = supportedLocales.some(l => l.code === locale) ? locale : 'fr';
      const invitationId = await insertProjectInvitation(pool, {
        tenantId: req.tenantMembership.tenant_id,
        projectId: req.params.projectId,
        email, permissionBundle, locale: resolvedLocale,
        invitedByUserId: req.user.id
      });
      res.status(201).json({ id: invitationId, email, permissionBundle, status: 'pending' });
    }
  );

  router.post(
    '/projects/:projectId/invitations/:invitationId/revoke',
    requireOrganizationCapability(pool, ACCESS_WRITE_CAP),
    async (req, res, next) => {
      if (!UUID_PATTERN.test(req.params.projectId) || !UUID_PATTERN.test(req.params.invitationId)) {
        next(Errors.notFound('Invitation'));
        return;
      }
      const updated = await revokeProjectInvitation(pool, {
        tenantId: req.tenantMembership.tenant_id,
        projectId: req.params.projectId,
        invitationId: req.params.invitationId
      });
      if (!updated) { next(Errors.notFound('Invitation')); return; }
      res.status(200).json({ id: updated.id, status: updated.status });
    }
  );

  // Révoque UNE source d'accès précise -- jamais toute la membership
  // d'un coup (voir modèle Grant : "la révocation d'une source ne doit
  // pas supprimer l'accès direct restant"). Garde-fou dernier
  // project_admin appliqué dans revokeProjectGrant() elle-même.
  router.delete(
    '/projects/:projectId/grants/:grantId',
    requireOrganizationCapability(pool, ACCESS_WRITE_CAP),
    async (req, res, next) => {
      if (!UUID_PATTERN.test(req.params.projectId) || !UUID_PATTERN.test(req.params.grantId)) {
        next(Errors.notFound('Accès'));
        return;
      }
      const result = await revokeProjectGrant(pool, {
        tenantId: req.tenantMembership.tenant_id,
        projectId: req.params.projectId,
        grantId: req.params.grantId
      });
      if (!result.ok && result.code === 'NOT_FOUND') { next(Errors.notFound('Accès')); return; }
      if (!result.ok && result.code === 'LAST_ADMIN') {
        next(Errors.forbidden('Impossible de retirer ce dernier accès administrateur du projet -- transférez d\'abord l\'administration à quelqu\'un d\'autre.'));
        return;
      }
      res.status(204).end();
    }
  );

  router.get(
    '/members/:userId/access',
    requireOrganizationCapability(pool, [OrganizationCapability.CONTROL_ACCESS, OrganizationCapability.MEMBERS_MANAGE]),
    async (req, res, next) => {
      if (!UUID_PATTERN.test(req.params.userId)) { next(Errors.notFound('Membre')); return; }
      const rows = await listMemberProjectAccess(pool, { tenantId: req.tenantMembership.tenant_id, userId: req.params.userId });
      res.status(200).json(rows.map(p => ({
        projectId: p.projectId,
        projectName: p.projectName,
        sources: p.sources.map(s => ({
          grantId: s.grantId,
          permissionBundle: s.permissionBundle,
          sourceType: s.sourceType,
          externalProvider: s.externalProvider,
          externalGroupId: s.externalGroupId
        }))
      })));
    }
  );

  // Invitations en attente, tous projets confondus -- vue "Accès"
  // globale (jamais scopée à un projet, contrairement à /access
  // ci-dessus). Même gate en lecture que la liste des projets.
  router.get(
    '/invitations',
    requireOrganizationCapability(pool, ACCESS_READ_CAP),
    async (req, res) => {
      const rows = await listPendingInvitationsForTenant(pool, req.tenantMembership.tenant_id);
      res.status(200).json(rows.map(r => ({
        id: r.id,
        email: r.email,
        permissionBundle: r.permission_bundle,
        createdAt: r.created_at,
        projectId: r.project_id,
        projectName: r.project_name
      })));
    }
  );

  // Accès automatisés (mappings groupe externe → bundle Storm) --
  // lecture seule pour cette passe (voir consignes : pas de CRUD tant
  // qu'aucun provider réel n'est branché). Gardé par la capability
  // dédiée, distincte de members.manage -- un project_admin seul ne
  // doit jamais pouvoir configurer l'identité externe.
  router.get(
    '/external-group-mappings',
    requireOrganizationCapability(pool, [OrganizationCapability.CONTROL_ACCESS, OrganizationCapability.EXTERNAL_IDENTITY_MANAGE]),
    async (req, res) => {
      const rows = await listExternalGroupMappings(pool, req.tenantMembership.tenant_id);
      res.status(200).json(rows.map(r => ({
        id: r.id,
        provider: r.provider,
        externalGroupId: r.external_group_id,
        targetType: r.target_type,
        targetId: r.target_id,
        permissionBundle: r.permission_bundle,
        createdAt: r.created_at
      })));
    }
  );

  return router;
}
