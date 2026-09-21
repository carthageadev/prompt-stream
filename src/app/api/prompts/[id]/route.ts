import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { prompts } from "@/db/schema";
import { guard, json, readBody } from "@/lib/http";
import { lineageFor, mapBlock } from "@/lib/data";
import { resolveSessions } from "@/lib/session";
import { autoTag } from "@/lib/tags";
import { BLOCK_TYPES } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function loadId(ctx: Ctx): Promise<number | null> {
  const { id } = await ctx.params;
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : null;
}

const owned = (sessionId: number, id: number) =>
  and(eq(prompts.id, id), eq(prompts.sessionId, sessionId));

export async function GET(request: Request, ctx: Ctx) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const resolved = await resolveSessions(request);
  if (!("active" in resolved)) return resolved;
  const id = await loadId(ctx);
  if (!id) return json({ error: "invalid id" }, 400);

  const { self, ancestors, descendants, all } = await lineageFor(resolved.visible, id);
  if (!self) return json({ error: "not found" }, 404);
  return json({ block: self, ancestors, descendants, library: all });
}

type PatchBody = {
  title?: string;
  content?: string;
  blockType?: string;
  stackId?: number | null;
  stackOrder?: number;
  basketId?: number | null;
  basketOrder?: number;
  tags?: string[];
  isArchived?: boolean;
  isFavorite?: boolean;
  autoTag?: boolean;
};

export async function PATCH(request: Request, ctx: Ctx) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const resolved = await resolveSessions(request);
  if (!("active" in resolved)) return resolved;
  const sessionId = resolved.active;
  const id = await loadId(ctx);
  if (!id) return json({ error: "invalid id" }, 400);

  const body = await readBody<PatchBody>(request);
  if (!body) return json({ error: "invalid body" }, 400);

  const existing = await db.select().from(prompts).where(owned(sessionId, id)).limit(1);
  if (!existing[0]) return json({ error: "not found" }, 404);

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.title === "string") update.title = body.title.trim() || existing[0].title;
  if (typeof body.content === "string") update.content = body.content;
  if (body.blockType && (BLOCK_TYPES as readonly string[]).includes(body.blockType)) {
    update.blockType = body.blockType;
  }
  if (body.stackId !== undefined) update.stackId = body.stackId;
  if (typeof body.stackOrder === "number") {
    update.stackOrder = Math.max(1, Math.min(99, Math.round(body.stackOrder)));
  }
  if (body.basketId !== undefined) update.basketId = body.basketId;
  if (typeof body.basketOrder === "number") {
    update.basketOrder = Math.max(1, Math.min(999, Math.round(body.basketOrder)));
  }
  if (Array.isArray(body.tags)) update.tags = body.tags.map((t) => t.trim()).filter(Boolean);
  if (typeof body.isArchived === "boolean") update.isArchived = body.isArchived;
  if (typeof body.isFavorite === "boolean") update.isFavorite = body.isFavorite;

  const nextContent = typeof body.content === "string" ? body.content : existing[0].content;
  const mergedTags = (update.tags as string[] | undefined) ?? existing[0].tags ?? [];
  if (body.autoTag !== false) {
    update.tags = autoTag(nextContent, mergedTags);
  }

  const updated = await db.update(prompts).set(update).where(owned(sessionId, id)).returning();
  return json({ block: mapBlock(updated[0]) });
}

/** Soft delete (archive). Reversible until purged. */
export async function DELETE(request: Request, ctx: Ctx) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const resolved = await resolveSessions(request);
  if (!("active" in resolved)) return resolved;
  const sessionId = resolved.active;
  const id = await loadId(ctx);
  if (!id) return json({ error: "invalid id" }, 400);

  const hard = new URL(request.url).searchParams.get("hard") === "1";
  if (hard) {
    await db.delete(prompts).where(owned(sessionId, id));
    return json({ deleted: true, hard: true });
  }

  const updated = await db
    .update(prompts)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(owned(sessionId, id))
    .returning();
  if (!updated[0]) return json({ error: "not found" }, 404);
  return json({ archived: true, block: mapBlock(updated[0]) });
}
