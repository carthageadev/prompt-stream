import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Sessions = lightweight workspaces (name-only, no password).
 *  Every library row belongs to exactly one session. */
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("sessions_name_key").on(t.name)]);

/** Stacks = folders / collections of prompt blocks. */
export const stacks = pgTable(
  "stacks",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug"),
    description: text("description").notNull().default(""),
    coverImageUrl: text("cover_image_url"),
    theme: text("theme").notNull().default("midnight"),
    isPublic: boolean("is_public").notNull().default(false),
    sessionId: integer("session_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("stacks_slug_key").on(t.slug), index("stacks_session_idx").on(t.sessionId)],
);

/** Baskets are lightweight visual groups of prompt blocks. */
export const baskets = pgTable("baskets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  sessionId: integer("session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("baskets_session_idx").on(t.sessionId)]);

/** Prompt blocks. */
export const prompts = pgTable(
  "prompts",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    blockType: text("block_type").notNull().default("instruction"),
    sessionId: integer("session_id"),
    stackId: integer("stack_id"),
    stackOrder: integer("stack_order").notNull().default(1),
    basketId: integer("basket_id"),
    basketOrder: integer("basket_order").notNull().default(1),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    parentPromptId: integer("parent_prompt_id"),
    rootPromptId: integer("root_prompt_id"),
    isArchived: boolean("is_archived").notNull().default(false),
    isFavorite: boolean("is_favorite").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("prompts_stack_idx").on(t.stackId),
    index("prompts_basket_idx").on(t.basketId),
    index("prompts_archived_idx").on(t.isArchived),
    index("prompts_session_idx").on(t.sessionId),
  ],
);

/** Custom tag colours (hue / lightness fine tuning). */
export const tagColors = pgTable(
  "tag_colors",
  {
    id: serial("id").primaryKey(),
    tag: text("tag").notNull(),
    hue: integer("hue").notNull().default(200),
    lightness: integer("lightness").notNull().default(58),
    sessionId: integer("session_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tag_colors_tag_key").on(t.tag), index("tag_colors_session_idx").on(t.sessionId)],
);

/** Compositions (ordered prompt recipes). */
export const compositions = pgTable("compositions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default("Untitled composition"),
  description: text("description").notNull().default(""),
  sessionId: integer("session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("compositions_session_idx").on(t.sessionId)]);

export const compositionItems = pgTable(
  "composition_items",
  {
    id: serial("id").primaryKey(),
    compositionId: integer("composition_id").notNull(),
    promptId: integer("prompt_id"),
    label: text("label").notNull().default(""),
    content: text("content").notNull().default(""),
    section: text("section").notNull().default("freeform"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("composition_items_comp_idx").on(t.compositionId)],
);

/** Cached AI / heuristic insights keyed by content hash. */
export const insightCache = pgTable(
  "insight_cache",
  {
    id: serial("id").primaryKey(),
    contentHash: text("content_hash").notNull(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<unknown>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("insight_cache_key").on(t.contentHash)],
);
