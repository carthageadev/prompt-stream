import { eq } from "drizzle-orm";
import { db } from "@/db";
import { baskets, prompts } from "@/db/schema";
import { guard, json, readBody } from "@/lib/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function resolveId(ctx: Ctx): Promise<number | null> {
  const { id } = await ctx.params;
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function PATCH(request: Request, ctx: Ctx) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const id = await resolveId(ctx);
  if (!id) return json({ error: "invalid id" }, 400);

  const body = await readBody<{ name?: string; position?: number }>(request);
  if (!body) return json({ error: "invalid body" }, 400);

  const update: Partial<typeof baskets.$inferInsert> = { updatedAt: new Date() };
  if (body.name?.trim()) update.name = body.name.trim().slice(0, 80);
  if (typeof body.position === "number") update.position = Math.max(0, Math.round(body.position));

  const rows = await db.update(baskets).set(update).where(eq(baskets.id, id)).returning();
  if (!rows[0]) return json({ error: "not found" }, 404);
  return json({ basket: { id: rows[0].id, name: rows[0].name, position: rows[0].position } });
}

/** Delete the basket shell; its prompts become ungrouped. */
export async function DELETE(request: Request, ctx: Ctx) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const id = await resolveId(ctx);
  if (!id) return json({ error: "invalid id" }, 400);

  await db.update(prompts).set({ basketId: null, updatedAt: new Date() }).where(eq(prompts.basketId, id));
  await db.delete(baskets).where(eq(baskets.id, id));
  return json({ deleted: true });
}
