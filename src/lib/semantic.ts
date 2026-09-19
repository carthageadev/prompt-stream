import type { PromptBlock, SemanticHit } from "./types";

const STOPWORDS = new Set(
  `a an the and or but if then else for to of in on at by with without from into about as is are was were be been being it its this that these those you your i we they them he she his her not no do does did doing have has had having will would should can could may might must about over under again further once here there when where why how all any both each few more most other some such only own same so than too very s t just don now me my our us out up down off while during before after above below between through what which who whom whose prompt prompts write make create help please using use used`.split(
    /\s+/,
  ),
);

const SYNONYMS: Record<string, string[]> = {
  code: ["engineering", "developer", "programming", "refactor", "bug", "function"],
  review: ["critique", "audit", "feedback", "improve"],
  writing: ["copy", "blog", "article", "draft", "essay", "newsletter"],
  sql: ["database", "query", "postgres", "schema", "table"],
  react: ["component", "hook", "jsx", "frontend"],
  python: ["script", "django", "pandas"],
  role: ["persona", "character", "act"],
  rules: ["constraint", "constraints", "restrictions", "limits"],
  output: ["format", "structure", "response", "json", "markdown", "table"],
  context: ["background", "situation", "setup"],
  logic: ["reasoning", "step", "plan", "chain", "thought"],
  tone: ["voice", "style", "concise", "friendly"],
};

export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[`*_>#|]/g, " ")
    .split(/[^a-z0-9+#.]+/)
    .map((raw) => raw.replace(/(ies)$/, "y").replace(/(ing|ed|ers|es|s)$/, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function expand(terms: string[]): string[] {
  const out = new Set<string>(terms);
  for (const term of terms) {
    for (const [key, list] of Object.entries(SYNONYMS)) {
      if (term === key || list.includes(term)) {
        out.add(key);
        list.forEach((v) => out.add(v));
      }
    }
  }
  return [...out];
}

type Vector = Map<string, number>;

function vectorize(text: string, title: string, tags: string[]): Vector {
  const v: Vector = new Map();
  const bump = (term: string, weight: number) => v.set(term, (v.get(term) ?? 0) + weight);

  tokenize(title).forEach((t) => bump(t, 3));
  tokenize(text).forEach((t) => bump(t, 1));
  tags.forEach((tag) => {
    const norm = tag.toLowerCase().replace(/[^a-z0-9+#.]/g, "");
    bump(norm, 4);
    tokenize(norm).forEach((t) => bump(t, 2));
  });
  return v;
}

export type IndexedDoc = {
  id: number;
  title: string;
  content: string;
  tags: string[];
  vector: Vector;
  magnitude: number;
};

export function buildIndex(blocks: PromptBlock[]): IndexedDoc[] {
  return blocks.map((block) => {
    const vector = vectorize(block.content, block.title, block.tags);
    let sum = 0;
    vector.forEach((w) => {
      sum += w * w;
    });
    return {
      id: block.id,
      title: block.title,
      content: block.content,
      tags: block.tags,
      vector,
      magnitude: Math.sqrt(sum) || 1,
    };
  });
}

function cosine(a: Vector, b: IndexedDoc): number {
  let dot = 0;
  a.forEach((weight, term) => {
    const other = b.vector.get(term);
    if (other) dot += weight * other;
  });
  return dot / (Math.sqrt([...a.values()].reduce((s, w) => s + w * w, 0)) || 1) / b.magnitude;
}

/**
 * Hybrid lexical-semantic ranking: cosine similarity over weighted term
 * vectors (title/tags boosted), query expansion through a synonym graph, plus
 * coverage of matched terms so short strong matches win over long fuzzy ones.
 */
export function semanticSearch(query: string, blocks: PromptBlock[], limit = 40): SemanticHit[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const rawTerms = tokenize(trimmed);
  if (!rawTerms.length) return [];

  const terms = expand(rawTerms);
  const queryVector: Vector = new Map();
  terms.forEach((t) => queryVector.set(t, (queryVector.get(t) ?? 0) + 1));

  const index = buildIndex(blocks);
  const hits: SemanticHit[] = [];

  for (const doc of index) {
    const matched = terms.filter((t) => doc.vector.has(t));
    if (!matched.length) continue;

    const similarity = cosine(queryVector, doc);
    const coverage = matched.length / terms.length;
    const tagBoost = doc.tags.some((tag) =>
      rawTerms.some((t) => tag.toLowerCase().includes(t)),
    )
      ? 0.12
      : 0;
    const titleBoost = rawTerms.some((t) => doc.title.toLowerCase().includes(t)) ? 0.1 : 0;
    const score = Math.min(1, similarity * 1.7 + coverage * 0.45 + tagBoost + titleBoost);
    if (score < 0.08) continue;

    const headline = matched
      .filter((t) => rawTerms.includes(t))
      .slice(0, 3)
      .map((t) => `"${t}"`)
      .join(", ");
    const tagHit = doc.tags.find((tag) => rawTerms.some((t) => tag.toLowerCase().includes(t)));
    const reason = tagHit
      ? `matched ${headline || tagHit} · tagged ${tagHit}`
      : `matched ${headline || matched.slice(0, 2).map((m) => `"${m}"`).join(", ")}`;

    hits.push({ id: doc.id, score: Number(score.toFixed(4)), reason });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Pairwise similarity used by "find related". */
export function findRelated(target: PromptBlock, blocks: PromptBlock[], limit = 6) {
  const hits = semanticSearch(`${target.title} ${target.tags.join(" ")} ${target.content}`, blocks, limit + 1);
  return hits
    .filter((hit) => hit.id !== target.id)
    .slice(0, limit)
    .map((hit) => ({
      id: hit.id,
      title: blocks.find((b) => b.id === hit.id)?.title ?? `#${hit.id}`,
      score: hit.score,
      reason: hit.reason,
    }));
}
