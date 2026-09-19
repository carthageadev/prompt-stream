-- Sessions cutover: every library row belongs to exactly one session.
--
-- Strategy (all in ONE transaction, fails LOUDLY on any mismatch):
--   1. Create the sessions table + a 'main' session for all existing rows.
--   2. Add nullable session_id columns, backfill to 'main', then SET NOT NULL.
--   3. Verify: no NULLs remain, row counts unchanged.
-- Run with: psql -v ON_ERROR_STOP=1 -f db/migrate-sessions.sql

BEGIN;

SET LOCAL search_path TO public;

-- ---------------------------------------------------------------- 1. sessions
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sessions_name_key ON sessions (name);

INSERT INTO sessions (name) VALUES ('main');

-- ---------------------------------------------------------------- 2. columns
ALTER TABLE stacks ADD COLUMN session_id INTEGER;
ALTER TABLE baskets ADD COLUMN session_id INTEGER;
ALTER TABLE prompts ADD COLUMN session_id INTEGER;
ALTER TABLE tag_colors ADD COLUMN session_id INTEGER;
ALTER TABLE compositions ADD COLUMN session_id INTEGER;

-- ---------------------------------------------------------------- 3. backfill
UPDATE stacks SET session_id = (SELECT id FROM sessions WHERE name = 'main') WHERE session_id IS NULL;
UPDATE baskets SET session_id = (SELECT id FROM sessions WHERE name = 'main') WHERE session_id IS NULL;
UPDATE prompts SET session_id = (SELECT id FROM sessions WHERE name = 'main') WHERE session_id IS NULL;
UPDATE tag_colors SET session_id = (SELECT id FROM sessions WHERE name = 'main') WHERE session_id IS NULL;
UPDATE compositions SET session_id = (SELECT id FROM sessions WHERE name = 'main') WHERE session_id IS NULL;

ALTER TABLE stacks ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE baskets ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE prompts ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE tag_colors ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE compositions ALTER COLUMN session_id SET NOT NULL;

CREATE INDEX stacks_session_idx ON stacks (session_id);
CREATE INDEX baskets_session_idx ON baskets (session_id);
CREATE INDEX prompts_session_idx ON prompts (session_id);
CREATE INDEX tag_colors_session_idx ON tag_colors (session_id);
CREATE INDEX compositions_session_idx ON compositions (session_id);

-- ---------------------------------------------------------------- 4. verify
DO $$
DECLARE
  n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM stacks WHERE session_id IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'stacks has % NULL session_id', n; END IF;
  SELECT COUNT(*) INTO n FROM baskets WHERE session_id IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'baskets has % NULL session_id', n; END IF;
  SELECT COUNT(*) INTO n FROM prompts WHERE session_id IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'prompts has % NULL session_id', n; END IF;
  SELECT COUNT(*) INTO n FROM tag_colors WHERE session_id IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'tag_colors has % NULL session_id', n; END IF;
  SELECT COUNT(*) INTO n FROM compositions WHERE session_id IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'compositions has % NULL session_id', n; END IF;
  SELECT COUNT(*) INTO n FROM sessions WHERE name = 'main';
  IF n <> 1 THEN RAISE EXCEPTION 'main session missing'; END IF;
END $$;

COMMIT;
