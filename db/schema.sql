-- Full studio schema. Mirrors src/db/schema.ts exactly.
-- Used for fresh databases (local scratch). NEVER run blindly against
-- a database that already holds the legacy FastAPI tables — use
-- db/migrate-prod.sql for the production cutover instead.

CREATE TABLE IF NOT EXISTS stacks (
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
CREATE UNIQUE INDEX IF NOT EXISTS stacks_slug_key ON stacks (slug);

CREATE TABLE IF NOT EXISTS baskets (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prompts (
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
CREATE INDEX IF NOT EXISTS prompts_stack_idx ON prompts (stack_id);
CREATE INDEX IF NOT EXISTS prompts_basket_idx ON prompts (basket_id);
CREATE INDEX IF NOT EXISTS prompts_archived_idx ON prompts (is_archived);

CREATE TABLE IF NOT EXISTS tag_colors (
  id SERIAL PRIMARY KEY,
  tag TEXT NOT NULL,
  hue INTEGER NOT NULL DEFAULT 200,
  lightness INTEGER NOT NULL DEFAULT 58,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tag_colors_tag_key ON tag_colors (tag);

CREATE TABLE IF NOT EXISTS compositions (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled composition',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS composition_items (
  id SERIAL PRIMARY KEY,
  composition_id INTEGER NOT NULL,
  prompt_id INTEGER,
  label TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT 'freeform',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS composition_items_comp_idx ON composition_items (composition_id);

CREATE TABLE IF NOT EXISTS insight_cache (
  id SERIAL PRIMARY KEY,
  content_hash TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS insight_cache_key ON insight_cache (content_hash);
