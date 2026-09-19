import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { baskets, compositionItems, compositions, prompts, stacks, tagColors } from "@/db/schema";
import type { Basket, BlockType, Composition, PromptBlock, Stack, StackTheme, TagColor } from "./types";
import { autoTag } from "./tags";

export type BlockRow = typeof prompts.$inferSelect;
export type StackRow = typeof stacks.$inferSelect;

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export const mapBlock = (row: BlockRow): PromptBlock => ({
  id: row.id,
  title: row.title,
  content: row.content,
  blockType: row.blockType as BlockType,
  stackId: row.stackId,
  stackOrder: row.stackOrder,
  basketId: row.basketId,
  basketOrder: row.basketOrder,
  tags: row.tags ?? [],
  parentPromptId: row.parentPromptId,
  rootPromptId: row.rootPromptId,
  isArchived: row.isArchived,
  isFavorite: row.isFavorite,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
});

export const mapStack = (row: StackRow, promptCount = 0): Stack => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description,
  coverImageUrl: row.coverImageUrl,
  theme: row.theme as StackTheme,
  isPublic: row.isPublic,
  promptCount,
});

export async function listStacks(sessionId: number): Promise<Stack[]> {
  const rows = await db
    .select()
    .from(stacks)
    .where(eq(stacks.sessionId, sessionId))
    .orderBy(asc(stacks.id));
  const counts = await db
    .select({ stackId: prompts.stackId, total: sql<number>`count(*)::int` })
    .from(prompts)
    .where(and(eq(prompts.sessionId, sessionId), eq(prompts.isArchived, false)))
    .groupBy(prompts.stackId);
  const totals = new Map(counts.map((row) => [row.stackId, Number(row.total)]));
  return rows.map((row) => mapStack(row, totals.get(row.id) ?? 0));
}

export async function listBaskets(sessionId: number): Promise<Basket[]> {
  const rows = await db
    .select()
    .from(baskets)
    .where(eq(baskets.sessionId, sessionId))
    .orderBy(asc(baskets.position), asc(baskets.id));
  const counts = await db
    .select({ basketId: prompts.basketId, total: sql<number>`count(*)::int` })
    .from(prompts)
    .where(and(eq(prompts.sessionId, sessionId), eq(prompts.isArchived, false)))
    .groupBy(prompts.basketId);
  const totals = new Map(counts.map((row) => [row.basketId, Number(row.total)]));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    position: row.position,
    promptCount: totals.get(row.id) ?? 0,
  }));
}

export async function listBlocks(sessionId: number, includeArchived = false): Promise<PromptBlock[]> {
  const rows = await db
    .select()
    .from(prompts)
    .where(
      and(
        eq(prompts.sessionId, sessionId),
        includeArchived ? sql`true` : eq(prompts.isArchived, false),
      ),
    )
    .orderBy(asc(prompts.basketId), asc(prompts.basketOrder), asc(prompts.stackId), asc(prompts.stackOrder), desc(prompts.id));
  return rows.map(mapBlock);
}

export async function listTagColors(sessionId: number): Promise<TagColor[]> {
  const rows = await db
    .select()
    .from(tagColors)
    .where(eq(tagColors.sessionId, sessionId))
    .orderBy(asc(tagColors.tag));
  return rows.map((row) => ({ tag: row.tag, hue: row.hue, lightness: row.lightness }));
}

export async function uniqueSlug(name: string, ignoreId?: number): Promise<string> {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48) || "stack";
  let candidate = base;
  for (let i = 2; i < 60; i += 1) {
    const clash = await db
      .select({ id: stacks.id })
      .from(stacks)
      .where(eq(stacks.slug, candidate))
      .limit(1);
    const hit = clash[0];
    if (!hit || hit.id === ignoreId) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function getComposition(sessionId: number, id: number): Promise<Composition | null> {
  const head = await db
    .select()
    .from(compositions)
    .where(and(eq(compositions.id, id), eq(compositions.sessionId, sessionId)))
    .limit(1);
  if (!head[0]) return null;
  const items = await db
    .select()
    .from(compositionItems)
    .where(eq(compositionItems.compositionId, id))
    .orderBy(asc(compositionItems.position), asc(compositionItems.id));
  return {
    id: head[0].id,
    title: head[0].title,
    description: head[0].description,
    items: items.map((item) => ({
      id: item.id,
      compositionId: item.compositionId,
      promptId: item.promptId,
      label: item.label,
      content: item.content,
      section: item.section as Composition["items"][number]["section"],
      position: item.position,
    })),
  };
}

export async function listCompositions(sessionId: number): Promise<Composition[]> {
  const heads = await db
    .select()
    .from(compositions)
    .where(eq(compositions.sessionId, sessionId))
    .orderBy(desc(compositions.updatedAt));
  const out: Composition[] = [];
  for (const head of heads) {
    const full = await getComposition(sessionId, head.id);
    if (full) out.push(full);
  }
  return out;
}

export async function publicStackBySlug(slug: string) {
  const row = await db
    .select()
    .from(stacks)
    .where(and(eq(stacks.slug, slug), eq(stacks.isPublic, true)))
    .limit(1);
  if (!row[0]) return null;
  const blocks = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.stackId, row[0].id), eq(prompts.isArchived, false)))
    .orderBy(asc(prompts.stackOrder), asc(prompts.id));
  return { stack: mapStack(row[0], blocks.length), blocks: blocks.map(mapBlock) };
}

/** Lineage lookups: ancestors walk up, descendants walk down. */
export async function lineageFor(sessionId: number, blockId: number) {
  const all = await listBlocks(sessionId, true);
  const byId = new Map(all.map((b) => [b.id, b]));
  const self = byId.get(blockId);
  const ancestors: PromptBlock[] = [];
  let cursor = self?.parentPromptId ?? null;
  let guard = 0;
  while (cursor && byId.has(cursor) && guard < 12) {
    const parent = byId.get(cursor)!;
    ancestors.push(parent);
    cursor = parent.parentPromptId;
    guard += 1;
  }
  const descendants: PromptBlock[] = [];
  const walk = (id: number) => {
    all.filter((b) => b.parentPromptId === id).forEach((child) => {
      descendants.push(child);
      walk(child.id);
    });
  };
  walk(blockId);
  return { self, ancestors, descendants, all };
}

/** Unused stacks / null-stack helpers used by the composer palette. */
export async function unassignedBlocks(sessionId: number): Promise<PromptBlock[]> {
  const rows = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.sessionId, sessionId), eq(prompts.isArchived, false), isNull(prompts.stackId)))
    .orderBy(asc(prompts.id));
  return rows.map(mapBlock);
}

export async function blocksByIds(sessionId: number, ids: number[]): Promise<PromptBlock[]> {
  if (!ids.length) return [];
  const rows = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.sessionId, sessionId), or(...ids.map((id) => eq(prompts.id, id)))));
  return rows.map(mapBlock);
}

const SEED_STACKS: { name: string; theme: StackTheme; description: string }[] = [
  { name: "Engineering", theme: "midnight", description: "Code review, refactors and debugging scaffolds." },
  { name: "Studio", theme: "sunset", description: "Writing, launch copy and narrative work." },
  { name: "Research", theme: "sea", description: "Analysis, synthesis and decision memos." },
];

const SEED_BLOCKS: {
  title: string;
  blockType: BlockType;
  stack: string;
  order: number;
  tags: string[];
  content: string;
}[] = [
  {
    title: "Staff Engineer Persona",
    blockType: "persona",
    stack: "Engineering",
    order: 1,
    tags: ["Role", "Code"],
    content:
      "You are a staff software engineer with 12 years of experience shipping production TypeScript and Python. You optimise for readability first, then performance, then cleverness. You never invent APIs — when unsure, you say what you would need to check.",
  },
  {
    title: "Repo Context Frame",
    blockType: "context",
    stack: "Engineering",
    order: 2,
    tags: ["Context", "TypeScript"],
    content:
      "Context: a Next.js 16 App Router project using Drizzle ORM against PostgreSQL, Tailwind v4 for styling, and no external state library. Tests run with vitest. Deploy target is a single Node server.",
  },
  {
    title: "Code Review Pass",
    blockType: "instruction",
    stack: "Engineering",
    order: 3,
    tags: ["Review", "Code", "Rules"],
    content:
      "Review the diff below in three passes: correctness, edge cases, and naming. For each finding give severity (blocker / warn / nit), the exact line, and a one-line fix. Never restate the diff back to me.",
  },
  {
    title: "Refactor Guardrails",
    blockType: "constraint",
    stack: "Engineering",
    order: 4,
    tags: ["Rules", "Code"],
    content:
      "Constraints: keep the public API unchanged, do not add dependencies, keep functions under 40 lines, and preserve existing test behaviour. If a change would break the API, stop and propose alternatives instead.",
  },
  {
    title: "Bug Reproduction Loop",
    blockType: "instruction",
    stack: "Engineering",
    order: 5,
    tags: ["Logic", "Code", "Debug"],
    content:
      "Reproduce the bug mentally first: list the exact conditions that trigger it, then rank three hypotheses by likelihood, then give the cheapest experiment that would falsify each one. End with the single most probable root cause.",
  },
  {
    title: "Test Plan Output",
    blockType: "format",
    stack: "Engineering",
    order: 6,
    tags: ["Output", "Code"],
    content:
      "Output as a markdown table with columns: case, arrangement, action, expected result. After the table add a short list of untestable risks. No prose introduction.",
  },
  {
    title: "Launch Copy Persona",
    blockType: "persona",
    stack: "Studio",
    order: 1,
    tags: ["Role", "Writing", "Tone"],
    content:
      "You are a blunt product copywriter for developer tools. You write short declarative sentences, cut adjectives, and never use the words 'revolutionary', 'seamless' or 'unlock'.",
  },
  {
    title: "Audience Frame",
    blockType: "context",
    stack: "Studio",
    order: 2,
    tags: ["Context", "Tone"],
    content:
      "Audience: senior engineers who skim. They already distrust marketing. They care about latency, pricing and whether the thing deletes their data.",
  },
  {
    title: "Landing Hero Variants",
    blockType: "instruction",
    stack: "Studio",
    order: 3,
    tags: ["Writing", "Output"],
    content:
      "Write 5 headline variants for the hero section. Each must be under 9 words, name a concrete outcome, and read fine with no supporting subhead. Mark the one you would ship and say why in one sentence.",
  },
  {
    title: "Copy Rules",
    blockType: "constraint",
    stack: "Studio",
    order: 4,
    tags: ["Rules", "Tone"],
    content:
      "Rules: no exclamation marks, no rhetorical questions, no em-dash chains. Prefer verbs to nouns. Keep every sentence under 22 words.",
  },
  {
    title: "Good Example Pattern",
    blockType: "example",
    stack: "Studio",
    order: 5,
    tags: ["Context", "Writing"],
    content:
      "Example of the register I want:\n\"Postgres migrations that run in under a second. Zero-downtime by default.\"\nNow match that density.",
  },
  {
    title: "Analyst Persona",
    blockType: "persona",
    stack: "Research",
    order: 1,
    tags: ["Role", "Data"],
    content:
      "You are a research analyst who separates evidence from inference. Every claim you make is labelled either [evidence], [inference] or [speculation], and you quantify uncertainty instead of hiding it.",
  },
  {
    title: "Decision Memo Format",
    blockType: "format",
    stack: "Research",
    order: 2,
    tags: ["Output", "Logic"],
    content:
      "Output format: 1) Recommendation in one sentence. 2) Options considered, three bullets each with cost. 3) What would change my mind. 4) Decision deadline. Keep the whole memo under 300 words.",
  },
  {
    title: "Source Synthesis",
    blockType: "instruction",
    stack: "Research",
    order: 3,
    tags: ["Logic", "Data", "Context"],
    content:
      "Synthesise the sources into a single narrative. Flag every point where sources disagree, and never resolve a disagreement silently — present both readings with their strongest support.",
  },
  {
    title: "SQL Explainer",
    blockType: "instruction",
    stack: "Research",
    order: 4,
    tags: ["SQL", "Data", "Code"],
    content:
      "Explain what this SQL does, line by line, then estimate its cost on a 10M row table and propose one index that would change the plan. Show the rewritten query last.",
  },
  {
    title: "Assumption Audit",
    blockType: "constraint",
    stack: "Research",
    order: 5,
    tags: ["Rules", "Logic"],
    content:
      "Constraints: list your assumptions explicitly before answering. If an assumption is load-bearing, mark it. Never fill gaps in the data with plausible-sounding numbers.",
  },
];

/** Seed the demo library into a brand-new session (first session on a fresh DB only). */
export async function seedSession(sessionId: number): Promise<void> {
  const stackIds = new Map<string, number>();
  for (const seed of SEED_STACKS) {
    const inserted = await db
      .insert(stacks)
      .values({ name: seed.name, theme: seed.theme, description: seed.description, sessionId })
      .returning();
    stackIds.set(seed.name, inserted[0].id);
  }

  const blockIds = new Map<string, number>();
  for (const block of SEED_BLOCKS) {
    const created = await db
      .insert(prompts)
      .values({
        title: block.title,
        content: block.content,
        blockType: block.blockType,
        stackId: stackIds.get(block.stack) ?? null,
        stackOrder: block.order,
        tags: block.tags.length ? block.tags : autoTag(block.content),
        sessionId,
      })
      .returning({ id: prompts.id });
    blockIds.set(block.title, created[0].id);
  }

    const seedBaskets = [
      {
        name: "Review system",
        titles: ["Staff Engineer Persona", "Repo Context Frame", "Code Review Pass", "Refactor Guardrails"],
      },
      {
        name: "Launch voice",
        titles: ["Launch Copy Persona", "Audience Frame", "Landing Hero Variants", "Copy Rules"],
      },
    ];
    for (let position = 0; position < seedBaskets.length; position += 1) {
      const createdBasket = await db
        .insert(baskets)
        .values({ name: seedBaskets[position].name, position, sessionId })
        .returning({ id: baskets.id });
      for (let basketOrder = 0; basketOrder < seedBaskets[position].titles.length; basketOrder += 1) {
        const promptId = blockIds.get(seedBaskets[position].titles[basketOrder]);
        if (promptId) {
          await db
            .update(prompts)
            .set({ basketId: createdBasket[0].id, basketOrder })
            .where(eq(prompts.id, promptId));
        }
      }
    }

    const comp = await db
      .insert(compositions)
      .values({
        title: "Deep code review",
        description: "Persona + context + review instruction + output contract.",
        sessionId,
      })
      .returning();
    const compositionId = comp[0].id;
    const order: { title: string; section: string }[] = [
      { title: "Staff Engineer Persona", section: "role" },
      { title: "Repo Context Frame", section: "context" },
      { title: "Code Review Pass", section: "rules" },
      { title: "Test Plan Output", section: "output" },
    ];
    for (let i = 0; i < order.length; i += 1) {
      const seed = SEED_BLOCKS.find((b) => b.title === order[i].title);
      if (!seed) continue;
      await db.insert(compositionItems).values({
        compositionId,
        promptId: blockIds.get(seed.title) ?? null,
        label: seed.title,
        content: seed.content,
        section: order[i].section,
        position: i,
      });
    }
}
