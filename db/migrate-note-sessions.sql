-- Note sessions: notebooks scoped to a workspace session.
-- Purely additive: rerunning is safe (IF NOT EXISTS everywhere).
-- Run with: psql -v ON_ERROR_STOP=1 -f db/migrate-note-sessions.sql

BEGIN;

SET LOCAL search_path TO public;

CREATE TABLE IF NOT EXISTS note_sessions (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS note_sessions_session_idx ON note_sessions (session_id);

COMMIT;
