import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { insightCache, prompts } from "@/db/schema";
import { guard, json, readBody } from "@/lib/http";
import { listBlocks, mapBlock } from "@/lib/data";
import { resolveSessions } from "@/lib/session";
import { contentHash, heuristicQuality, heuristicRelated, heuristicTags } from "@/lib/insights";
import { aiQuality, aiTags } from "@/lib/ai";
import type { BlockType, PromptBlock } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ kind: string }> };
const KINDS = ["tags", "quality", "related"] as const;

export async function POST(request: Request, ctx: Ctx) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const resolved = await resolveSessions(request);
  if (!("active" in resolved)) return resolved;
  const sessionIds = resolved.visible;

  const { kind } = await ctx.params;
  if (!(KINDS as readonly string[]).includes(kind)) {
    return json({ error: `unknown insight: ${kind}` }, 404);
  }

  const body = await readBody<{ promptId?: number; content?: string }>(request);
  let block: PromptBlock | null = null;

  if (Number.isFinite(body?.promptId)) {
    const rows = await db
      .select()
      .from(prompts)
      .where(and(inArray(prompts.sessionId, sessionIds), eq(prompts.id, Number(body!.promptId))))
      .limit(1);
    if (rows[0]) block = mapBlock(rows[0]);
  } else if (body?.content?.trim()) {
    block = {
      id: 0,
      title: body.content.split("\n")[0].slice(0, 60),
      content: body.content,
      blockType: "instruction" as BlockType,
      stackId: null,
      stackOrder: 1,
      basketId: null,
      basketOrder: 1,
      tags: [],
      parentPromptId: null,
      rootPromptId: null,
      isArchived: false,
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  if (!block) return json({ error: "promptId or content is required" }, 400);

  const hash = contentHash(block.content);
  const cached = await db
    .select()
    .from(insightCache)
    .where(eq(insightCache.contentHash, `${hash}:${kind}`))
    .limit(1);

  if (cached[0]) return json({ ...(cached[0].payload as object), cached: true });

  const library = await listBlocks(sessionIds);
  let payload: unknown;
  if (kind === "tags") payload = await aiTags(block, library);
  else if (kind === "quality") payload = await aiQuality(block, library);
  else payload = { related: heuristicRelated(block, library) };

  await db
    .insert(insightCache)
    .values({ contentHash: `${hash}:${kind}`, kind, payload })
    .onConflictDoUpdate({
      target: insightCache.contentHash,
      set: { payload, createdAt: new Date() },
    })
    .catch(() => undefined);

  return json({ ...(payload as object), cached: false });
}
