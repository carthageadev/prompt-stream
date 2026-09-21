import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { noteSessions } from "@/db/schema";
import { guard, json, readBody } from "@/lib/http";
import { requireSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const mapNote = (row: typeof noteSessions.$inferSelect) => ({
  id: String(row.id),
  title: row.title,
  body: row.body,
  attachments: row.attachments ?? [],
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
});

/** List this session's notes, freshest first. */
export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const sessionId = await requireSessionId(request);
  if (typeof sessionId !== "number") return sessionId;
  const rows = await db
    .select()
    .from(noteSessions)
    .where(eq(noteSessions.sessionId, sessionId))
    .orderBy(desc(noteSessions.updatedAt));
  return json({ notes: rows.map(mapNote) });
}

/** Start a blank note. */
export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const sessionId = await requireSessionId(request);
  if (typeof sessionId !== "number") return sessionId;
  const body = await readBody<{ title?: string; body?: string }>(request);
  const inserted = await db
    .insert(noteSessions)
    .values({
      title: body?.title?.slice(0, 200) ?? "",
      body: body?.body ?? "",
      attachments: [],
      sessionId,
    })
    .returning();
  return json({ note: mapNote(inserted[0]) }, 201);
}
