import { guard, json, readBody } from "@/lib/http";
import { listBlocks } from "@/lib/data";
import { resolveSessions } from "@/lib/session";
import { semanticSearch } from "@/lib/semantic";
import type { PromptBlock } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Semantic ranking over the whole library (debounced client-side ~280ms). */
export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const resolved = await resolveSessions(request);
  if (!("active" in resolved)) return resolved;
  const sessionIds = resolved.visible;

  const body = await readBody<{ query?: string; limit?: number }>(request);
  const query = body?.query?.trim();
  if (!query) return json({ hits: [], took: 0 });

  const started = Date.now();
  const blocks: PromptBlock[] = await listBlocks(sessionIds);
  const hits = semanticSearch(query, blocks, Math.min(60, Math.max(5, body?.limit ?? 40)));
  return json({ hits, took: Date.now() - started, total: blocks.length });
}
