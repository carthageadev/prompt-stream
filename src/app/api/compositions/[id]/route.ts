import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { compositionItems, compositions } from "@/db/schema";
import { guard, json, readBody } from "@/lib/http";
import { getComposition } from "@/lib/data";
import { requireSessionId } from "@/lib/session";
import { COMPOSITION_SECTIONS } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
type ItemPayload = {
  id?: number;
  promptId?: number | null;
  label?: string;
  content?: string;
  section?: string;
  position?: number;
};

async function resolveId(ctx: Ctx): Promise<number | null> {
  const { id } = await ctx.params;
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request, ctx: Ctx) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const id = await resolveId(ctx);
  if (!id) return json({ error: "invalid id" }, 400);
  const sessionId = await requireSessionId(request);
  if (typeof sessionId !== "number") return sessionId;
  const composition = await getComposition(sessionId, id);
  if (!composition) return json({ error: "not found" }, 404);
  return json({ composition });
}

/** Full replace of items (the composer is the source of truth). */
export async function PATCH(request: Request, ctx: Ctx) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const id = await resolveId(ctx);
  if (!id) return json({ error: "invalid id" }, 400);

  const body = await readBody<{ title?: string; description?: string; items?: ItemPayload[] }>(request);
  if (!body) return json({ error: "invalid body" }, 400);
  const sessionId = await requireSessionId(request);
  if (typeof sessionId !== "number") return sessionId;

  const existing = await db
    .select()
    .from(compositions)
    .where(and(eq(compositions.id, id), eq(compositions.sessionId, sessionId)))
    .limit(1);
  if (!existing[0]) return json({ error: "not found" }, 404);

  await db
    .update(compositions)
    .set({
      title: body.title?.trim() || existing[0].title,
      description: body.description ?? existing[0].description,
      updatedAt: new Date(),
    })
    .where(and(eq(compositions.id, id), eq(compositions.sessionId, sessionId)));

  if (Array.isArray(body.items)) {
    await db.delete(compositionItems).where(eq(compositionItems.compositionId, id));
    const rows = body.items
      .map((item, index) => ({
        compositionId: id,
        promptId: item.promptId ?? null,
        label: item.label?.slice(0, 120) ?? "",
        content: item.content ?? "",
        section: (COMPOSITION_SECTIONS as readonly string[]).includes(item.section ?? "")
          ? item.section!
          : "freeform",
        position: typeof item.position === "number" ? item.position : index,
      }))
      .filter((row) => row.content.trim().length > 0);
    if (rows.length) await db.insert(compositionItems).values(rows);
  }

  const composition = await getComposition(sessionId, id);
  return json({ composition });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const id = await resolveId(ctx);
  if (!id) return json({ error: "invalid id" }, 400);
  const sessionId = await requireSessionId(request);
  if (typeof sessionId !== "number") return sessionId;
  const owned = await db
    .select({ id: compositions.id })
    .from(compositions)
    .where(and(eq(compositions.id, id), eq(compositions.sessionId, sessionId)))
    .limit(1);
  if (!owned[0]) return json({ error: "not found" }, 404);
  await db.delete(compositionItems).where(eq(compositionItems.compositionId, id));
  await db.delete(compositions).where(and(eq(compositions.id, id), eq(compositions.sessionId, sessionId)));
  return json({ deleted: true });
}
