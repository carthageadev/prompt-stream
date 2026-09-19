import { db } from "@/db";
import { compositions } from "@/db/schema";
import { guard, json, readBody } from "@/lib/http";
import { ensureSeed, listCompositions } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  await ensureSeed();
  return json({ compositions: await listCompositions() });
}

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const body = await readBody<{ title?: string; description?: string }>(request);
  const inserted = await db
    .insert(compositions)
    .values({
      title: body?.title?.trim() || "Untitled composition",
      description: body?.description?.trim() || "",
    })
    .returning();
  return json(
    { composition: { id: inserted[0].id, title: inserted[0].title, description: inserted[0].description, items: [] } },
    201,
  );
}
