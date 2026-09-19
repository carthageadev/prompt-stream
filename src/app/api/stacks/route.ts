import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { prompts, stacks } from "@/db/schema";
import { guard, json, readBody } from "@/lib/http";
import { listStacks, mapStack } from "@/lib/data";
import { requireSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const sessionId = await requireSessionId(request);
  if (typeof sessionId !== "number") return sessionId;
  return json({ stacks: await listStacks(sessionId) });
}

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const sessionId = await requireSessionId(request);
  if (typeof sessionId !== "number") return sessionId;
  const body = await readBody<{ name?: string; theme?: string; description?: string }>(request);
  const name = body?.name?.trim();
  if (!name) return json({ error: "name is required" }, 400);

  const inserted = await db
    .insert(stacks)
    .values({
      name,
      theme: ["midnight", "sunset", "oxide", "sea"].includes(body?.theme ?? "") ? body!.theme! : "midnight",
      description: body?.description?.trim() ?? "",
      sessionId,
    })
    .returning();
  return json({ stack: mapStack(inserted[0]) }, 201);
}

export async function DELETE(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const sessionId = await requireSessionId(request);
  if (typeof sessionId !== "number") return sessionId;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isFinite(id)) return json({ error: "invalid id" }, 400);
  await db
    .update(prompts)
    .set({ stackId: null })
    .where(and(eq(prompts.stackId, id), eq(prompts.sessionId, sessionId)));
  await db.delete(stacks).where(and(eq(stacks.id, id), eq(stacks.sessionId, sessionId)));
  return json({ deleted: true });
}
