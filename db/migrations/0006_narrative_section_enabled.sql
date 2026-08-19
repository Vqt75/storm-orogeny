-- 0006_narrative_section_enabled — état éditorial, pas un état de
-- contenu. Une section masquée reste entièrement stockée avec son
-- payload et ses médias ; elle est simplement destinée à être exclue
-- par le futur Compiler (Phase 2D), jamais supprimée.
--
-- Confirmé nécessaire contre la référence Tectonic : compiler.js
-- filtre explicitement section.enabled !== false avant publication —
-- une vraie capacité éditoriale déjà prouvée, pas une invention.

alter table project_narrative_sections
  add column enabled boolean not null default true;
