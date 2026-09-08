// Domaine audit -- Privacy & Data Lifecycle V1, Batch 3. Primitive
// d'écriture unique pour audit_events (schéma posé migration 0013).
//
// Volontairement structurel : jamais de metadata/payload/details/
// message/champ texte libre, jamais une copie d'objet métier. L'audit
// V1 prouve QU'UNE action a eu lieu, QUI, QUOI, QUAND -- jamais le
// contenu détaillé de cette action (celui-ci vit déjà ailleurs, dans
// l'objet métier lui-même tant qu'il existe).
//
// Prend un client (jamais un pool nu) -- cette primitive est
// systématiquement appelée DANS la transaction métier de l'appelant,
// jamais dans sa propre transaction séparée : soit l'action métier et
// sa trace d'audit committent ensemble, soit aucune des deux.

export async function recordAuditEvent(client, {
  eventType,
  actorUserId = null,
  targetType,
  targetId = null,
  tenantId = null,
  projectId = null
}) {
  await client.query(
    `insert into audit_events (event_type, actor_user_id, target_type, target_id, tenant_id, project_id)
     values ($1, $2, $3, $4, $5, $6)`,
    [eventType, actorUserId, targetType, targetId, tenantId, projectId]
  );
}

// Registre canonique des event types -- un seul ajouté dans ce batch,
// jamais une liste anticipée de types futurs non encore produits par
// aucun code réel.
export const AuditEventType = Object.freeze({
  EXTERNAL_GROUP_MAPPING_DISABLED: 'external_group_mapping.disabled'
});
