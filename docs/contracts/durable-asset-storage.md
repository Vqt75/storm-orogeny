# Durable asset storage

Production uses PostgreSQL (`STORAGE_DRIVER=postgres`, the production default).
Images, logos, fonts and documents are stored as bytea in stored_asset_objects.
The existing assets metadata, opaque keys, publication snapshots, access checks
and save/read/delete interface remain authoritative and unchanged.

An upload is acknowledged only after the byte write succeeds. Storage uses its
own pool operation, independent of the metadata transaction; existing rollback
compensation, cleanup backlog and project deletion workers use the same adapter.
Deletion is idempotent. Ordinary identity removal does not delete historical
publication files. No public route serves objects directly by storage key.

Both adapter and database enforce the existing 5 MiB per-file limit. Database
storage and transfer quotas still apply. Local storage is supported outside
production; production explicitly refuses it. No fallback to temporary disk is
allowed if PostgreSQL fails.

Migration 0021 adds a table only. It does not rewrite assets or publications and
does not fabricate missing bytes. Old local files require an explicit transfer
while their original filesystem is still accessible. A deploy cannot recover
files from the old ephemeral Render instance. Missing files must be uploaded
again; publication is required to change already published references. Do not
redeploy a local-storage instance to attempt recovery: it may erase its files.

Acceptance: run test/1b-project-setup-assets.test.js and public-access/publication
contract tests with TEST_ASSET_STORAGE_DRIVER=postgres for real uploads and reads;
test/postgres-storage.test.js proves binary preservation across reconnection,
failure handling, size limits and physical deletion.
