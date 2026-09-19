import { guard, json, readBody } from "@/lib/http";
import { ensureSeed, listBlocks } from "@/lib/data";
import { semanticSearch } from "@/lib/semantic";
import type { PromptBlock } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Semantic ranking over the whole library (debounced client-side ~280ms). */
export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  await ensureSeed();

  const body = await readBody<{ query?: string; limit?: number }>(request);
  const query = body?.query?.trim();
  if (!query) return json({ hits: [], took: 0 });

  const started = Date.now();
  const blocks: PromptBlock[] = await listBlocks();
  const hits = semanticSearch(query, blocks, Math.min(60, Math.max(5, body?.limit ?? 40)));
  return json({ hits, took: Date.now() - started, total: blocks.length });
}
