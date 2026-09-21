import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { noteSessions } from "@/db/schema";
import { guard, json, readBody } from "@/lib/http";
import { requireSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

type PatchBody = {
  title?: string;
  body?: string;
  attachments?: { id: string; name: string; dataUrl: string }[];
};

export async function PATCH(request: Request, ctx: Ctx) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const sessionId = await requireSessionId(request);
  if (typeof sessionId !== "number") return sessionId;
  const { id } = await ctx.params;
  const noteId = Number(id);
  if (!Number.isFinite(noteId)) return json({ error: "invalid id" }, 400);

  const body = await readBody<PatchBody>(request);
  if (!body) return json({ error: "invalid body" }, 400);

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.title === "string") update.title = body.title.slice(0, 200);
  if (typeof body.body === "string") update.body = body.body;
  if (Array.isArray(body.attachments)) {
    update.attachments = body.attachments
      .filter((a) => a && typeof a.dataUrl === "string")
      .map((a) => ({ id: String(a.id), name: String(a.name ?? "screenshot"), dataUrl: a.dataUrl }))
      .slice(0, 50);
  }

  const updated = await db
    .update(noteSessions)
    .set(update)
    .where(and(eq(noteSessions.id, noteId), eq(noteSessions.sessionId, sessionId)))
    .returning();
  if (!updated[0]) return json({ error: "not found" }, 404);
  const row = updated[0];
  return json({
    note: {
      id: String(row.id),
      title: row.title,
      body: row.body,
      attachments: row.attachments ?? [],
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    },
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const sessionId = await requireSessionId(request);
  if (typeof sessionId !== "number") return sessionId;
  const { id } = await ctx.params;
  const noteId = Number(id);
  if (!Number.isFinite(noteId)) return json({ error: "invalid id" }, 400);
  await db
    .delete(noteSessions)
    .where(and(eq(noteSessions.id, noteId), eq(noteSessions.sessionId, sessionId)));
  return json({ deleted: true });
}
