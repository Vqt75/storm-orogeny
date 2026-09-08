-- 0017_telemetry_events_occurred_at_index — Privacy & Data Lifecycle
-- V1, Batch 8. L'index existant idx_telemetry_events_occurred_at est
-- composite (project_id, occurred_at) -- optimisé pour les requêtes
-- par projet (Pilotage), pas exploitable efficacement pour la purge
-- déterministe globale (DELETE ... WHERE occurred_at < cutoff, sans
-- filtre project_id). Index minimal dédié, jamais un sur-index :
-- exactement une colonne, exactement le besoin démontré par cette
-- politique.
create index idx_telemetry_events_occurred_at_only on telemetry_events (occurred_at);
