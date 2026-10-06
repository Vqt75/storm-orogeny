-- Independent from assets: save occurs before metadata creation, and existing
-- compensation/deletion jobs own physical deletion through the storage adapter.
-- Historical asset keys and publication JSON are deliberately unchanged.
create table stored_asset_objects (
  storage_key text primary key
    check (storage_key ~ '^[0-9a-f-]{36}(\.[a-z0-9]{1,10})?$'),
  body bytea not null check (octet_length(body) between 1 and 5242880),
  created_at timestamptz not null default now()
);
