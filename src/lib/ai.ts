import type { PromptBlock, QualityReport, TagSuggestion } from "./types";
import { heuristicQuality, heuristicTags } from "./insights";

const KEY = () => process.env.OPENAI_API_KEY;
export const aiEnabled = (): boolean => Boolean(KEY());

type ChatMessage = { role: "system" | "user"; content: string };

async function chat(messages: ChatMessage[], maxTokens = 500): Promise<string | null> {
  const key = KEY();
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages,
        temperature: 0.3,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function aiQuality(block: PromptBlock, library: PromptBlock[]): Promise<QualityReport> {
  const fallback = heuristicQuality(block, library);
  const raw = await chat([
    {
      role: "system",
      content:
        "You grade prompts. Reply with JSON only: {overall:number, metrics:[{key,label,score,note}], summary:string, recommendations:string[]}. metrics keys must be clarity, specificity, constraints, output, reuse, ambiguity. Scores 0-100.",
    },
    { role: "user", content: `Title: ${block.title}\nType: ${block.blockType}\nTags: ${block.tags.join(", ")}\n\n${block.content}` },
  ]);
  const parsed = parseJson<QualityReport>(raw);
  if (!parsed || !Array.isArray(parsed.metrics) || parsed.metrics.length < 3) return fallback;
  const metrics = parsed.metrics
    .filter((m) => typeof m.score === "number")
    .map((m) => ({ ...m, score: Math.max(0, Math.min(100, Math.round(m.score))) }));
  return {
    overall: Math.round(parsed.overall ?? metrics.reduce((s, m) => s + m.score, 0) / metrics.length),
    metrics,
    summary: parsed.summary || fallback.summary,
    recommendations: parsed.recommendations?.length ? parsed.recommendations : fallback.recommendations,
    source: "ai",
  };
}

export async function aiTags(block: PromptBlock, library: PromptBlock[]): Promise<TagSuggestion> {
  const fallback = heuristicTags(block, library);
  const known = [...new Set(library.flatMap((b) => b.tags))].slice(0, 40);
  const raw = await chat([
    {
      role: "system",
      content:
        'You tag prompt blocks. Reply JSON only: {"tags":string[], "merges":[{"source":string,"target":string}]}. Max 6 tags, each 1-2 words, TitleCase. merges only when an existing tag should be consolidated into a better one.',
    },
    {
      role: "user",
      content: `Existing library tags: ${known.join(", ") || "(none)"}\nCurrent tags: ${block.tags.join(", ")}\n\n${block.title}\n${block.content}`,
    },
  ]);
  const parsed = parseJson<TagSuggestion>(raw);
  if (!parsed || !Array.isArray(parsed.tags)) return fallback;
  return {
    tags: parsed.tags.filter((t) => !block.tags.includes(t)).slice(0, 6),
    merges: Array.isArray(parsed.merges) ? parsed.merges.slice(0, 3) : [],
    source: "ai",
  };
}

export async function aiOptimize(source: string, blockType: string): Promise<string | null> {
  const raw = await chat(
    [
      { role: "system", content: "You rewrite prompt blocks to be sharper, specific and self-contained. Reply JSON only: {\"optimized\": string}. Preserve the author's intent and voice, never invent facts." },
      { role: "user", content: `Block type: ${blockType}\n\n${source}` },
    ],
    900,
  );
  const parsed = parseJson<{ optimized?: string }>(raw);
  return parsed?.optimized?.trim() || null;
}
