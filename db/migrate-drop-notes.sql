-- Remove the retired note_sessions table (notes were superseded by
-- multi-session viewing; the table never held production data).
-- Run with: psql -v ON_ERROR_STOP=1 -f db/migrate-drop-notes.sql

BEGIN;

SET LOCAL search_path TO public;

DROP TABLE IF EXISTS note_sessions;

COMMIT;
