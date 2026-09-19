-- Production cutover migration: legacy FastAPI tables -> studio schema.
--
-- Strategy (all in ONE transaction, fails LOUDLY on any mismatch):
--   1. Rename legacy tables aside (legacy_*). Nothing is dropped.
--   2. Create the new studio tables (same DDL as db/schema.sql).
--   3. Copy data with ID remapping notes below.
--   4. Verify row counts match; any mismatch raises -> full rollback.
--
-- Known source shape (verified 2026-09-19, stream_prompts DB):
--   21 prompt_blocks, 0 with stack/parent/fork refs -> flat copy, no remap needed
--   1 stack, 24 tag_colors, 0 compositions, 2 prompt_insights (disposable AI cache, dropped)
-- Run with: psql -v ON_ERROR_STOP=1 -f db/migrate-prod.sql

BEGIN;

-- ---------------------------------------------------------------- 1. retire old
ALTER TABLE IF EXISTS stacks RENAME TO legacy_stacks;
ALTER TABLE IF EXISTS prompt_blocks RENAME TO legacy_prompt_blocks;
ALTER TABLE IF EXISTS tag_colors RENAME TO legacy_tag_colors;
ALTER TABLE IF EXISTS compositions RENAME TO legacy_compositions;
ALTER TABLE IF EXISTS composition_items RENAME TO legacy_composition_items;
ALTER TABLE IF EXISTS prompt_insights RENAME TO legacy_prompt_insights;

-- ---------------------------------------------------------------- 2. new schema
CREATE TABLE stacks (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  theme TEXT NOT NULL DEFAULT 'midnight',
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX stacks_slug_key ON stacks (slug);

CREATE TABLE baskets (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prompts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  block_type TEXT NOT NULL DEFAULT 'instruction',
  stack_id INTEGER,
  stack_order INTEGER NOT NULL DEFAULT 1,
  basket_id INTEGER,
  basket_order INTEGER NOT NULL DEFAULT 1,
  tags JSONB NOT NULL DEFAULT '[]',
  parent_prompt_id INTEGER,
  root_prompt_id INTEGER,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX prompts_stack_idx ON prompts (stack_id);
CREATE INDEX prompts_basket_idx ON prompts (basket_id);
CREATE INDEX prompts_archived_idx ON prompts (is_archived);

CREATE TABLE tag_colors (
  id SERIAL PRIMARY KEY,
  tag TEXT NOT NULL,
  hue INTEGER NOT NULL DEFAULT 200,
  lightness INTEGER NOT NULL DEFAULT 58,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX tag_colors_tag_key ON tag_colors (tag);

CREATE TABLE compositions (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled composition',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE composition_items (
  id SERIAL PRIMARY KEY,
  composition_id INTEGER NOT NULL,
  prompt_id INTEGER,
  label TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT 'freeform',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX composition_items_comp_idx ON composition_items (composition_id);

CREATE TABLE insight_cache (
  id SERIAL PRIMARY KEY,
  content_hash TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX insight_cache_key ON insight_cache (content_hash);

-- ---------------------------------------------------------------- 3. data
-- stacks: string ids -> fresh serials (nothing references old ids: 0 blocks assigned)
INSERT INTO stacks (name, slug, description, cover_image_url, theme, is_public, created_at)
SELECT
  name,
  slug,
  COALESCE(description, ''),
  cover_image,
  CASE
    WHEN theme_key IN ('midnight', 'sunset', 'oxide', 'sea') THEN theme_key
    WHEN theme_key LIKE '%sunset%' THEN 'sunset'
    WHEN theme_key LIKE '%oxide%' THEN 'oxide'
    WHEN theme_key LIKE '%sea%' OR theme_key LIKE '%glass%' THEN 'sea'
    ELSE 'midnight'
  END,
  COALESCE(is_published, false),
  created_at
FROM legacy_stacks;

-- prompts: flat copy (verified: no stack/parent/fork refs in source)
INSERT INTO prompts (title, content, block_type, tags, created_at, updated_at)
SELECT
  title,
  content,
  CASE WHEN type IN ('persona', 'context', 'constraint', 'format', 'instruction', 'example')
    THEN type ELSE 'instruction' END,
  COALESCE(tags::jsonb, '[]'),
  created_at,
  updated_at
FROM legacy_prompt_blocks;

-- tag colours: name -> tag
INSERT INTO tag_colors (tag, hue, lightness)
SELECT name, hue, lightness FROM legacy_tag_colors;

-- compositions/items: source is empty, nothing to copy.
-- prompt_insights: disposable AI cache (2 rows), regenerates on demand. Dropped.

-- ---------------------------------------------------------------- 4. verify
DO $$
DECLARE
  c_old INT; c_new INT;
BEGIN
  SELECT COUNT(*) INTO c_old FROM legacy_prompt_blocks;
  SELECT COUNT(*) INTO c_new FROM prompts;
  IF c_old <> c_new THEN RAISE EXCEPTION 'prompts mismatch: % vs %', c_old, c_new; END IF;

  SELECT COUNT(*) INTO c_old FROM legacy_stacks;
  SELECT COUNT(*) INTO c_new FROM stacks;
  IF c_old <> c_new THEN RAISE EXCEPTION 'stacks mismatch: % vs %', c_old, c_new; END IF;

  SELECT COUNT(*) INTO c_old FROM legacy_tag_colors;
  SELECT COUNT(*) INTO c_new FROM tag_colors;
  IF c_old <> c_new THEN RAISE EXCEPTION 'tag_colors mismatch: % vs %', c_old, c_new; END IF;
END $$;

COMMIT;
