import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { prompts } from "@/db/schema";
import { guard, json, readBody } from "@/lib/http";
import { mapBlock } from "@/lib/data";
import { requireSessionId } from "@/lib/session";
import { autoTag } from "@/lib/tags";
import { BLOCK_TYPES } from "@/lib/types";
import type { BlockType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const sessionId = await requireSessionId(request);
  if (typeof sessionId !== "number") return sessionId;
  const includeArchived = new URL(request.url).searchParams.get("archived") === "1";
  const stackId = new URL(request.url).searchParams.get("stackId");

  const filters = [includeArchived ? undefined : eq(prompts.isArchived, false)];
  const where = and(...filters.filter(Boolean).map((f) => f!), stackId ? eq(prompts.stackId, Number(stackId)) : undefined);

  const rows = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.sessionId, sessionId), where))
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
  const sessionId = await requireSessionId(request);
  if (typeof sessionId !== "number") return sessionId;

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
