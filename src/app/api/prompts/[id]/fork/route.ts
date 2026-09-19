import { eq } from "drizzle-orm";
import { db } from "@/db";
import { prompts } from "@/db/schema";
import { guard, json } from "@/lib/http";
import { mapBlock } from "@/lib/data";
import { autoTag } from "@/lib/tags";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Fork a block: child carries parentPromptId + rootPromptId lineage. */
export async function POST(request: Request, ctx: Ctx) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const parentId = Number(id);
  if (!Number.isFinite(parentId)) return json({ error: "invalid id" }, 400);

  const rows = await db.select().from(prompts).where(eq(prompts.id, parentId)).limit(1);
  const parent = rows[0];
  if (!parent) return json({ error: "not found" }, 404);

  const body = (await request.json().catch(() => ({}))) as { title?: string; content?: string };

  const inserted = await db
    .insert(prompts)
    .values({
      title: body.title?.trim() || `${parent.title} (fork)`,
      content: body.content?.trim() || parent.content,
      blockType: parent.blockType,
      stackId: parent.stackId,
      stackOrder: parent.stackOrder,
      basketId: parent.basketId,
      basketOrder: parent.basketOrder,
      tags: autoTag(body.content ?? parent.content, parent.tags ?? []),
      parentPromptId: parent.id,
      rootPromptId: parent.rootPromptId ?? parent.id,
    })
    .returning();

  return json({ block: mapBlock(inserted[0]) }, 201);
}
