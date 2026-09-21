import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { prompts, stacks } from "@/db/schema";
import { guard, json, readBody } from "@/lib/http";
import { mapBlock } from "@/lib/data";
import { resolveSessions } from "@/lib/session";
import { autoTag } from "@/lib/tags";
import { BLOCK_TYPES } from "@/lib/types";
import type { BlockType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const resolved = await resolveSessions(request);
  if (!("active" in resolved)) return resolved;
  const sessionIds = resolved.visible;
  const includeArchived = new URL(request.url).searchParams.get("archived") === "1";
  const stackId = new URL(request.url).searchParams.get("stackId");

  const filters = [includeArchived ? undefined : eq(prompts.isArchived, false)];
  const where = and(...filters.filter(Boolean).map((f) => f!), stackId ? eq(prompts.stackId, Number(stackId)) : undefined);

  const rows = await db
    .select()
    .from(prompts)
    .where(and(inArray(prompts.sessionId, sessionIds), where))
    .orderBy(asc(prompts.stackId), asc(prompts.stackOrder), desc(prompts.id));
  return json({ blocks: rows.map(mapBlock) });
}

type CreateBody = {
  title?: string;
  content?: string;
  blockType?: string;
  stackId?: number | null;
  stackOrder?: number;
  tags?: string[];
  autoTag?: boolean;
};

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const resolved = await resolveSessions(request);
  if (!("active" in resolved)) return resolved;
  const sessionId = resolved.active;

  const body = await readBody<CreateBody>(request);
  if (!body || !body.content?.trim()) {
    return json({ error: "content is required" }, 400);
  }

  const type = (BLOCK_TYPES as readonly string[]).includes(body.blockType ?? "")
    ? (body.blockType as BlockType)
    : "instruction";
  const providedTags = body.tags ?? [];
  const tags = body.autoTag === false ? providedTags : autoTag(body.content, providedTags);

  const firstLine = body.content.trim().split("\n")[0].replace(/^#+\s*/, "").slice(0, 70);
  const title = body.title?.trim() || firstLine || "Untitled block";

  if (body.stackId != null) {
    const owner = await db
      .select({ id: stacks.id })
      .from(stacks)
      .where(and(eq(stacks.id, body.stackId), eq(stacks.sessionId, sessionId)))
      .limit(1);
    if (!owner[0]) return json({ error: "stack not found" }, 400);
  }

  const inserted = await db
    .insert(prompts)
    .values({
      title,
      content: body.content.trim(),
      blockType: type,
      stackId: body.stackId ?? null,
      stackOrder: body.stackOrder ?? 1,
      tags,
      sessionId,
    })
    .returning();

  return json({ block: mapBlock(inserted[0]) }, 201);
}
