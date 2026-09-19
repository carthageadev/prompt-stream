import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { prompts } from "@/db/schema";
import { guard, json, readBody } from "@/lib/http";
import { mapBlock } from "@/lib/data";
import { requireSessionId } from "@/lib/session";
import { heuristicOptimize } from "@/lib/insights";
import { aiOptimize } from "@/lib/ai";

export const dynamic = "force-dynamic";

/** Compress / sharpen a block. Uses AI when a key exists, heuristic otherwise. */
export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const sessionId = await requireSessionId(request);
  if (typeof sessionId !== "number") return sessionId;

  const body = await readBody<{
    promptId?: number;
    content?: string;
    blockType?: string;
    saveAsNew?: boolean;
    title?: string;
  }>(request);

  let content = body?.content ?? "";
  let blockType = body?.blockType ?? "instruction";
  let title = body?.title ?? "Optimized block";

  if (Number.isFinite(body?.promptId)) {
    const rows = await db
      .select()
      .from(prompts)
      .where(and(eq(prompts.id, Number(body!.promptId)), eq(prompts.sessionId, sessionId)))
      .limit(1);
    if (!rows[0]) return json({ error: "not found" }, 404);
    content = rows[0].content;
    blockType = rows[0].blockType;
    title = rows[0].title;
  }

  if (!content.trim()) return json({ error: "content is required" }, 400);

  const ai = await aiOptimize(content, blockType);
  const result = ai ?? heuristicOptimize(content, blockType);

  if (body?.saveAsNew) {
    const inserted = await db
      .insert(prompts)
      .values({
        title: `${title} (optimized)`,
        content: result,
        blockType,
        tags: [],
        sessionId,
      })
      .returning();
    return json({ result, source: ai ? "ai" : "heuristic", block: mapBlock(inserted[0]) });
  }

  return json({ result, source: ai ? "ai" : "heuristic" });
}
