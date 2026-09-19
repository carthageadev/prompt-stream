import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tagColors } from "@/db/schema";
import { guard, json, readBody } from "@/lib/http";
import { listTagColors } from "@/lib/data";
import { requireSessionId } from "@/lib/session";
import { deriveTagColor } from "@/lib/tags";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const sessionId = await requireSessionId(request);
  if (typeof sessionId !== "number") return sessionId;
  return json({ colors: await listTagColors(sessionId) });
}

/** Upsert a colour, or auto-assign one when only the tag is supplied. */
export async function PUT(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const sessionId = await requireSessionId(request);
  if (typeof sessionId !== "number") return sessionId;
  const body = await readBody<{
    tag?: string;
    hue?: number;
    lightness?: number;
    usedHues?: number[];
  }>(request);
  const tag = body?.tag?.trim();
  if (!tag) return json({ error: "tag is required" }, 400);

  const derived = deriveTagColor(tag, body?.usedHues ?? []);
  const hue = Math.max(0, Math.min(360, Math.round(body?.hue ?? derived.hue)));
  const lightness = Math.max(35, Math.min(80, Math.round(body?.lightness ?? derived.lightness)));

  await db
    .insert(tagColors)
    .values({ tag, hue, lightness, updatedAt: new Date(), sessionId })
    .onConflictDoUpdate({
      target: [tagColors.tag, tagColors.sessionId],
      set: { hue, lightness, updatedAt: new Date() },
    });

  return json({ color: { tag, hue, lightness } });
}

export async function DELETE(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const sessionId = await requireSessionId(request);
  if (typeof sessionId !== "number") return sessionId;
  const tag = new URL(request.url).searchParams.get("tag");
  if (!tag) return json({ error: "tag is required" }, 400);
  await db
    .delete(tagColors)
    .where(and(eq(tagColors.tag, tag), eq(tagColors.sessionId, sessionId)));
  return json({ deleted: true });
}
