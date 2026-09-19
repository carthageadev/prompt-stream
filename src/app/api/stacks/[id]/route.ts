import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { prompts, stacks } from "@/db/schema";
import { guard, json, readBody, slugify } from "@/lib/http";
import { mapStack, uniqueSlug } from "@/lib/data";
import { requireSessionId } from "@/lib/session";
import { STACK_THEMES } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const stackId = Number(id);
  if (!Number.isFinite(stackId)) return json({ error: "invalid id" }, 400);

  const body = await readBody<{
    name?: string;
    description?: string;
    coverImageUrl?: string | null;
    theme?: string;
    isPublic?: boolean;
    slug?: string | null;
  }>(request);
  if (!body) return json({ error: "invalid body" }, 400);
  const sessionId = await requireSessionId(request);
  if (typeof sessionId !== "number") return sessionId;

  const existing = await db
    .select()
    .from(stacks)
    .where(and(eq(stacks.id, stackId), eq(stacks.sessionId, sessionId)))
    .limit(1);
  if (!existing[0]) return json({ error: "not found" }, 404);

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body.description === "string") update.description = body.description;
  if (body.coverImageUrl !== undefined) {
    update.coverImageUrl = body.coverImageUrl?.trim() ? body.coverImageUrl.trim() : null;
  }
  if (body.theme && (STACK_THEMES as readonly string[]).includes(body.theme)) update.theme = body.theme;
  if (typeof body.isPublic === "boolean") {
    update.isPublic = body.isPublic;
    if (body.isPublic && !existing[0].slug) {
      const nextName = typeof update.name === "string" ? update.name : existing[0].name;
      update.slug = await uniqueSlug(nextName, stackId);
    }
  }
  if (body.slug !== undefined) {
    if (body.slug === "") update.slug = null;
    else if (body.slug) update.slug = slugify(body.slug);
  }

  const updated = await db
    .update(stacks)
    .set(update)
    .where(and(eq(stacks.id, stackId), eq(stacks.sessionId, sessionId)))
    .returning();
  return json({ stack: mapStack(updated[0]) });
}

/** Deleting a stack detaches its blocks instead of destroying them. */
export async function DELETE(request: Request, ctx: Ctx) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const stackId = Number(id);
  if (!Number.isFinite(stackId)) return json({ error: "invalid id" }, 400);
  const sessionId = await requireSessionId(request);
  if (typeof sessionId !== "number") return sessionId;

  await db
    .update(prompts)
    .set({ stackId: null })
    .where(and(eq(prompts.stackId, stackId), eq(prompts.sessionId, sessionId)));
  await db
    .delete(stacks)
    .where(and(eq(stacks.id, stackId), eq(stacks.sessionId, sessionId)));
  return json({ deleted: true });
}
