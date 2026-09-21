import { db } from "@/db";
import { compositions } from "@/db/schema";
import { guard, json, readBody } from "@/lib/http";
import { listCompositions } from "@/lib/data";
import { resolveSessions } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const resolved = await resolveSessions(request);
  if (!("active" in resolved)) return resolved;
  return json({ compositions: await listCompositions(resolved.visible) });
}

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const resolved = await resolveSessions(request);
  if (!("active" in resolved)) return resolved;
  const sessionId = resolved.active;
  const body = await readBody<{ title?: string; description?: string }>(request);
  const inserted = await db
    .insert(compositions)
    .values({
      title: body?.title?.trim() || "Untitled composition",
      description: body?.description?.trim() || "",
      sessionId,
    })
    .returning();
  return json(
    { composition: { id: inserted[0].id, title: inserted[0].title, description: inserted[0].description, items: [] } },
    201,
  );
}
