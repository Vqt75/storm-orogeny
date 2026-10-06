-- Explicit V1 setting: existing rows are backfilled by the column default.
-- No identity inference; historical publication JSON is deliberately untouched.
alter table project_identity add column expression_profile text not null default 'balanced'
  constraint project_identity_expression_profile_check
  check (expression_profile in ('balanced', 'editorial', 'panoramic'));
