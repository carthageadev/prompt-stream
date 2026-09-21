import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { baskets, prompts } from "@/db/schema";
import { listBaskets } from "@/lib/data";
import { guard, json, readBody } from "@/lib/http";
import { resolveSessions } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const resolved = await resolveSessions(request);
  if (!("active" in resolved)) return resolved;
  return json({ baskets: await listBaskets(resolved.visible) });
}

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const resolved = await resolveSessions(request);
  if (!("active" in resolved)) return resolved;
  const sessionId = resolved.active;

  const body = await readBody<{ name?: string; promptIds?: number[] }>(request);
  const name = body?.name?.trim();
  if (!name) return json({ error: "name is required" }, 400);

  const last = await db
    .select({ position: baskets.position })
    .from(baskets)
    .where(eq(baskets.sessionId, sessionId))
    .orderBy(sql`${baskets.position} desc`)
    .limit(1);

  const created = await db
    .insert(baskets)
    .values({ name: name.slice(0, 80), position: (last[0]?.position ?? -1) + 1, sessionId })
    .returning();

  const ids = [...new Set((body?.promptIds ?? []).filter(Number.isFinite))];
  if (ids.length) {
    await db
      .update(prompts)
      .set({ basketId: created[0].id, updatedAt: new Date() })
      .where(and(inArray(prompts.id, ids), eq(prompts.sessionId, sessionId)));
  }

  return json(
    {
      basket: {
        id: created[0].id,
        name: created[0].name,
        position: created[0].position,
        promptCount: ids.length,
      },
    },
    201,
  );
}

/** Bulk assign selected prompts. A null basketId removes grouping. */
export async function PUT(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const resolved = await resolveSessions(request);
  if (!("active" in resolved)) return resolved;
  const sessionId = resolved.active;

  const body = await readBody<{ basketId?: number | null; promptIds?: number[] }>(request);
  const ids = [...new Set((body?.promptIds ?? []).filter(Number.isFinite))];
  if (!ids.length) return json({ error: "promptIds are required" }, 400);

  if (body?.basketId !== null && body?.basketId !== undefined) {
    const exists = await db
      .select({ id: baskets.id })
      .from(baskets)
      .where(and(eq(baskets.id, body.basketId), eq(baskets.sessionId, sessionId)))
      .limit(1);
    if (!exists[0]) return json({ error: "basket not found" }, 404);
  }

  await db
    .update(prompts)
    .set({ basketId: body?.basketId ?? null, updatedAt: new Date() })
    .where(and(inArray(prompts.id, ids), eq(prompts.sessionId, sessionId)));

  return json({ assigned: ids.length, basketId: body?.basketId ?? null });
}
