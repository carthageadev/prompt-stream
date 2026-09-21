import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { prompts, sessions } from "@/db/schema";
import { seedSession } from "@/lib/data";
import { guard, json, readBody } from "@/lib/http";
import { isValidSessionName } from "@/lib/session";

export const dynamic = "force-dynamic";

/** List sessions (id + name + prompt count — enough to pick yours on a new device). */
export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const rows = await db
    .select({ id: sessions.id, name: sessions.name })
    .from(sessions)
    .orderBy(asc(sessions.id));
  const counts = await db
    .select({ sessionId: prompts.sessionId, total: sql<number>`count(*)::int` })
    .from(prompts)
    .where(eq(prompts.isArchived, false))
    .groupBy(prompts.sessionId);
  const totals = new Map(counts.map((row) => [row.sessionId, Number(row.total)]));
  return json({
    sessions: rows.map((row) => ({ ...row, promptCount: totals.get(row.id) ?? 0 })),
  });
}

/** Create a session with just a name. First session on a fresh DB gets demo content. */
export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const body = await readBody<{ name?: string }>(request);
  const name = body?.name?.trim() ?? "";
  if (!isValidSessionName(name)) {
    return json({ error: "name must be 2-32 chars: letters, numbers, spaces, - _" }, 400);
  }

  const taken = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(sql`lower(${sessions.name}) = lower(${name})`)
    .limit(1);
  if (taken[0]) return json({ error: "that name is taken" }, 409);

  const libraryEmpty =
    (await db.select({ id: prompts.id }).from(prompts).limit(1)).length === 0;
  const created = await db.insert(sessions).values({ name }).returning();
  if (libraryEmpty) await seedSession(created[0].id);
  return json({ session: { id: created[0].id, name: created[0].name } }, 201);
}
