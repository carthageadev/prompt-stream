import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stacks } from "@/db/schema";
import { guard, json, readBody } from "@/lib/http";
import { ensureSeed, listStacks, mapStack } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  await ensureSeed();
  return json({ stacks: await listStacks() });
}

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const body = await readBody<{ name?: string; theme?: string; description?: string }>(request);
  const name = body?.name?.trim();
  if (!name) return json({ error: "name is required" }, 400);

  const inserted = await db
    .insert(stacks)
    .values({
      name,
      theme: ["midnight", "sunset", "oxide", "sea"].includes(body?.theme ?? "") ? body!.theme! : "midnight",
      description: body?.description?.trim() ?? "",
    })
    .returning();
  return json({ stack: mapStack(inserted[0]) }, 201);
}

export async function DELETE(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isFinite(id)) return json({ error: "invalid id" }, 400);
  await db.delete(stacks).where(eq(stacks.id, id));
  return json({ deleted: true });
}
