-- 0012_external_identity_v1 — SSO / External Identity V1, Batch 1
-- (fondations de données uniquement). Voir l'audit et le plan
-- d'architecture SSO validés en amont (Security Implementation Gate).
--
-- Ce batch ne change AUCUN comportement d'AuthN actif : devAuth reste
-- l'unique mécanisme réellement branché. Aucune route OIDC publique,
-- aucun cookie, aucun provider réel. Uniquement les tables et
-- contraintes nécessaires aux primitives domaine de ce batch.

-- ── Identité externe canonique : (issuer, subject) ──────────────────
-- provider_type sélectionne l'adaptateur (entra/google/fake/...),
-- jamais une clé d'identité -- l'identité canonique reste strictement
-- (issuer, subject). email_at_linking est capturé à titre informatif/
-- audit uniquement à l'instant de la liaison, jamais réutilisé pour
-- résoudre ou authentifier une connexion ultérieure -- l'email n'est
-- JAMAIS une contrainte d'identité externe (doctrine validée).
create table external_identities (
  id                uuid primary key default gen_random_uuid(),
  provider_type     text not null,
  issuer            text not null,
  subject           text not null,
  user_id           uuid not null references users(id) on delete cascade,
  email_at_linking  text,
  status            text not null default 'active'
                      check (status in ('active', 'revoked')),
  created_at        timestamptz not null default now(),
  revoked_at        timestamptz,
  unique (issuer, subject)
);
create index idx_external_identities_user on external_identities(user_id);

-- ── Sessions serveur — cookie opaque, jamais un JWT applicatif ──────
-- Seule l'empreinte SHA-256 du token brut est stockée ; le token brut
-- n'existe jamais en base ni dans ce schéma. external_identity_id est
-- informatif (quelle liaison a produit cette session) et permet la
-- révocation ciblée à une seule identité externe -- jamais toutes les
-- sessions de l'utilisateur par accident (doctrine corrigée et
-- validée : révocation d'identité externe ≠ suspension utilisateur).
-- Pas de last_seen_at, pas d'expiration idle en V1 -- expiration
-- absolue seule (expires_at), volontairement minimal.
create table auth_sessions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references users(id) on delete cascade,
  external_identity_id  uuid references external_identities(id) on delete set null,
  session_token_hash    text not null unique,
  created_at            timestamptz not null default now(),
  expires_at            timestamptz not null,
  revoked_at            timestamptz
);
create index idx_auth_sessions_user_active on auth_sessions(user_id) where revoked_at is null;

-- ── Scoping des mappings de groupe externe par autorité réelle ─────
-- issuer nullable UNIQUEMENT pour compatibilité avec les lignes
-- historiques/démo déjà seedées par Control V2 -- jamais un joker en
-- exécution réelle : tout batch de réconciliation future doit exiger
-- explicitement issuer is not null et une correspondance exacte,
-- jamais un repli "OR issuer is null" qui ferait de null un
-- wildcard. status permet de désactiver un mapping sans jamais le
-- supprimer physiquement (pas de hard delete métier en V1) -- la
-- désactivation transactionnelle avec garde-fou dernier-administrateur
-- capability-based reste un batch ultérieur, pas celui-ci.
alter table external_group_mappings add column issuer text;
alter table external_group_mappings add column status text not null default 'active'
  check (status in ('active', 'disabled'));
