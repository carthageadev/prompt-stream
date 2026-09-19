import { createHash } from "node:crypto";
import { autoTag } from "./tags";
import { findRelated } from "./semantic";
import type {
  PromptBlock,
  QualityMetric,
  QualityReport,
  RelatedHit,
  TagSuggestion,
} from "./types";

export const contentHash = (input: string): string =>
  createHash("sha256").update(input.trim().toLowerCase()).digest("hex").slice(0, 32);

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const OUTPUT_MARKERS = [
  /\bjson\b/i,
  /\bmarkdown\b/i,
  /\btable\b/i,
  /\bbullet/i,
  /\bsections?\b/i,
  /\bformat\b/i,
  /\brespond (with|in)\b/i,
  /\breturn only\b/i,
  /\byaml\b/i,
  /\bcsv\b/i,
];
const CONSTRAINT_MARKERS = [
  /\bnever\b/i,
  /\balways\b/i,
  /\bdo not\b/i,
  /\bdon't\b/i,
  /\bmust\b/i,
  /\bavoid\b/i,
  /\bmax(imum)?\b/i,
  /\bmin(imum)?\b/i,
  /\blimit\b/i,
  /\bonly\b/i,
];
const CLARITY_MARKERS = [
  /\bstep[- ]by[- ]step\b/i,
  /\bfirst\b/i,
  /\bthen\b/i,
  /\bfinally\b/i,
  /\bspecifically\b/i,
  /\bfor example\b/i,
  /\bi\.e\./i,
];

function uniqueness(block: PromptBlock, library: PromptBlock[]): number {
  if (!library.length) return 100;
  const words = new Set(block.content.toLowerCase().split(/\s+/));
  let best = 0;
  for (const other of library) {
    if (other.id === block.id) continue;
    const otherWords = new Set(other.content.toLowerCase().split(/\s+/));
    let shared = 0;
    words.forEach((w) => {
      if (w.length > 3 && otherWords.has(w)) shared += 1;
    });
    best = Math.max(best, shared / Math.max(1, words.size));
  }
  return clamp(100 - best * 140);
}

/** Deterministic 6-metric scorecard used when no AI key is configured. */
export function heuristicQuality(block: PromptBlock, library: PromptBlock[] = []): QualityReport {
  const text = block.content;
  const words = text.trim().split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?\n]+/).filter((s) => s.trim().length > 3);
  const avgSentence = words.length / Math.max(1, sentences.length);

  const clarity = clamp(
    42 +
      (CLARITY_MARKERS.filter((r) => r.test(text)).length * 9) +
      (words.length > 25 ? 12 : -12) +
      (avgSentence < 26 ? 8 : -8),
  );
  const specificity = clamp(
    30 + Math.min(38, words.length / 3) + (/\d/.test(text) ? 12 : 0) + (block.tags.length * 4),
  );
  const constraints = clamp(
    18 + CONSTRAINT_MARKERS.filter((r) => r.test(text)).length * 14,
  );
  const output = clamp(14 + OUTPUT_MARKERS.filter((r) => r.test(text)).length * 17);
  const reuse = clamp(46 + (/\{\{|<\w+>|\[.*\]|\bTODO\b/.test(text) ? 22 : 0) + uniqueness(block, library) * 0.3);
  const ambiguity = clamp(
    92 -
      (/\bmaybe\b|\bmight\b|\bsome\b|\bstuff\b|\bethings?\b|\bit depends\b/i.test(text) ? 28 : 0) -
      (words.length < 8 ? 30 : 0) -
      (sentences.length > 1 ? 8 : 0),
  );

  const metrics: QualityMetric[] = [
    { key: "clarity", label: "Clarity", score: clarity, note: clarity > 70 ? "Instructions read as sequenced actions." : "Add sequencing words: first / then / finally." },
    { key: "specificity", label: "Specificity", score: specificity, note: specificity > 65 ? "Concrete detail and domain anchors present." : "Name the stack, audience and scale explicitly." },
    { key: "constraints", label: "Constraints", score: constraints, note: constraints > 55 ? "Boundaries are stated." : "Say what to avoid, not only what to do." },
    { key: "output", label: "Output", score: output, note: output > 55 ? "Response shape is defined." : "Declare a format (JSON, table, sections)." },
    { key: "reuse", label: "Reuse", score: reuse, note: reuse > 60 ? "Generic enough to re-run across projects." : "Insert placeholders for variable details." },
    { key: "ambiguity", label: "Ambiguity control", score: ambiguity, note: ambiguity > 60 ? "Few hedging terms detected." : "Trim vague wording like 'some', 'stuff', 'maybe'." },
  ];

  const overall = clamp(metrics.reduce((s, m) => s + m.score, 0) / metrics.length);
  const weakest = [...metrics].sort((a, b) => a.score - b.score).slice(0, 3);

  return {
    overall,
    metrics,
    summary: `Scores ${overall}/100 across 6 dimensions. Strongest: ${[...metrics]
      .sort((a, b) => b.score - a.score)[0].label.toLowerCase()}. Weakest: ${weakest[0].label.toLowerCase()}.`,
    recommendations: weakest.map((m) => m.note),
    source: "heuristic",
  };
}

const SUGGESTION_POOL = [
  "Role", "Context", "Rules", "Output", "Logic", "Tone", "Code", "Data", "Review",
  "Python", "TypeScript", "React", "Next.js", "SQL", "Rust", "Unity", "Unreal",
  "Security", "Writing", "Planning", "Debug", "Research",
];

export function heuristicTags(block: PromptBlock, library: PromptBlock[]): TagSuggestion {
  const detected = autoTag(block.content, []).filter((t) => !block.tags.includes(t));
  const existing = new Set<string>();
  library.forEach((b) => b.tags.forEach((t) => existing.add(t)));

  const contentTerms = new Set(block.content.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []);
  const contextual = SUGGESTION_POOL.filter((tag) => {
    if (block.tags.includes(tag) || detected.includes(tag)) return false;
    const norm = tag.toLowerCase();
    return contentTerms.has(norm) || [...contentTerms].some((t) => t.startsWith(norm.slice(0, 4)) && norm.length > 4);
  }).slice(0, 4);

  const tags = [...new Set([...detected, ...contextual])].slice(0, 6);

  const merges: TagSuggestion["merges"] = [];
  const lower = (tag: string) => tag.toLowerCase();
  for (const tag of block.tags) {
    const twin = [...existing].find(
      (other) => other !== tag && lower(other) !== lower(tag) && (lower(other).includes(lower(tag)) || lower(tag).includes(lower(other))),
    );
    if (twin) merges.push({ source: tag, target: twin });
  }

  return { tags, merges: merges.slice(0, 3), source: "heuristic" };
}

export function heuristicRelated(block: PromptBlock, library: PromptBlock[]): RelatedHit[] {
  return findRelated(block, library, 6);
}

/** Deterministic rewriter used by the optimize endpoint (AI-free fallback). */
export function heuristicOptimize(source: string, blockType: string): string {
  const cleaned = source.trim().replace(/\n{3,}/g, "\n\n");
  const lines = cleaned.split("\n").filter((l) => l.trim().length);
  const headline = `# ${blockType.toUpperCase()} BLOCK`;
  const body = lines
    .map((line) => (/^[-*•]/.test(line.trim()) ? `- ${line.replace(/^[-*•]\s*/, "")}` : line))
    .join("\n");
  return [
    headline,
    "",
    body,
    "",
    "## Output contract",
    "- Return the result only, no preamble.",
    "- Keep every claim traceable to the input.",
    "- If information is missing, ask exactly one clarifying question first.",
  ].join("\n");
}
