import type { TagColor } from "./types";

/** Core taxonomy tags (always shown first in Settings). */
export const CORE_TAGS = [
  "Role",
  "Context",
  "Rules",
  "Output",
  "Code",
  "Logic",
  "Tone",
  "Data",
] as const;

export const BUILTIN_TAG_COLORS: Record<string, { hue: number; lightness: number }> = {
  Role: { hue: 262, lightness: 48 },
  Context: { hue: 206, lightness: 46 },
  Rules: { hue: 8, lightness: 48 },
  Output: { hue: 152, lightness: 42 },
  Code: { hue: 192, lightness: 44 },
  Logic: { hue: 44, lightness: 46 },
  Tone: { hue: 318, lightness: 48 },
  Data: { hue: 232, lightness: 48 },
  Python: { hue: 48, lightness: 44 },
  JavaScript: { hue: 50, lightness: 46 },
  TypeScript: { hue: 214, lightness: 48 },
  React: { hue: 188, lightness: 44 },
  "Next.js": { hue: 0, lightness: 42 },
  Unity: { hue: 200, lightness: 44 },
  "C#": { hue: 154, lightness: 42 },
  "C++": { hue: 16, lightness: 46 },
  Unreal: { hue: 276, lightness: 48 },
  SQL: { hue: 222, lightness: 48 },
  Rust: { hue: 22, lightness: 46 },
  Security: { hue: 350, lightness: 46 },
  Writing: { hue: 32, lightness: 46 },
  Review: { hue: 96, lightness: 40 },
};

const LANG_RULES: { tag: string; patterns: RegExp[] }[] = [
  { tag: "Python", patterns: [/\bpython\b/i, /\bdjango\b/i, /\bpandas?\b/i, /\bnumpy\b/i, /\bpytest\b/i, /def\s+\w+\s*\(/] },
  { tag: "TypeScript", patterns: [/\btypescript\b/i, /\bts[- ]?config\b/i, /:\s*(string|number|boolean)\b/, /interface\s+\w+\s*\{/] },
  { tag: "JavaScript", patterns: [/\bjavascript\b/i, /\bnode\b/i, /\bexpress\b/i, /\bnpm\b/i, /=>\s*\{/ ] },
  { tag: "React", patterns: [/\breact\b/i, /\bjsx\b/i, /\btsx\b/i, /use(State|Effect|Memo|Callback|Ref)\s*\(/] },
  { tag: "Next.js", patterns: [/\bnext(\.js|js)?\b/i, /\bapp router\b/i, /server components?/i] },
  { tag: "Unity", patterns: [/\bunity\b/i, /\bmono behaviour\b/i, /\bprefab\b/i] },
  { tag: "C#", patterns: [/\bc#\b/i, /\b\.net\b/i, /\bunity\b/i, /\brazor\b/i] },
  { tag: "C++", patterns: [/\bc\+\+\b/i, /\bstd::/i, /\bue\d\b/i] },
  { tag: "Unreal", patterns: [/\bunreal\b/i, /\bue5\b/i, /\blueprint\b/i] },
  { tag: "SQL", patterns: [/\bsql\b/i, /\bselect\b.+\bfrom\b/i, /\bpostgres\b/i, /\bjoin\b/i] },
  { tag: "Rust", patterns: [/\brust\b/i, /\bcargo\b/i, /\bfn\s+main\b/] },
];

const CATEGORY_RULES: { tag: string; patterns: RegExp[] }[] = [
  { tag: "Role", patterns: [/\byou are\b/i, /\bact as\b/i, /\bpersona\b/i, /\byour role\b/i] },
  { tag: "Context", patterns: [/\bcontext\b/i, /\bbackground\b/i, /\bwe are\b/i, /\bour team\b/i, /\bproject\b/i] },
  { tag: "Rules", patterns: [/\brules?\b/i, /\bconstraints?\b/i, /\bnever\b/i, /\balways\b/i, /\bdo not\b/i, /\bmust\b/i] },
  { tag: "Output", patterns: [/\boutput\b/i, /\bformat\b/i, /\brespond with\b/i, /\breturn (a|an|only)\b/i, /\bjson\b/i, /\bmarkdown\b/i, /\btable\b/i] },
  { tag: "Logic", patterns: [/\bstep[- ]by[- ]step\b/i, /\breason\b/i, /\bthink\b/i, /\bchain of thought\b/i, /\bplan\b/i] },
  { tag: "Tone", patterns: [/\btone\b/i, /\bvoice\b/i, /\bconcise\b/i, /\bfriendly\b/i, /\bformal\b/i, /\bwitty\b/i] },
  { tag: "Data", patterns: [/\bdata\b/i, /\bdataset\b/i, /\bschema\b/i, /\bcsv\b/i, /\bapi\b/i] },
  { tag: "Review", patterns: [/\breview\b/i, /\bcritique\b/i, /\baudit\b/i, /\bfeedback\b/i] },
  { tag: "Writing", patterns: [/\bwrite\b/i, /\bdraft\b/i, /\bblog\b/i, /\bcopy\b/i, /\bessay\b/i] },
  { tag: "Security", patterns: [/\bsecurity\b/i, /\bvulnerab/i, /\bthreat\b/i, /\bsanitize\b/i] },
];

/**
 * Auto-tagging detector: language detection implies "Code", categories stack,
 * and near-duplicate tags are collapsed.
 */
export function autoTag(text: string, extra: string[] = []): string[] {
  const found = new Set<string>(extra.map((t) => t.trim()).filter(Boolean));
  const sample = text.slice(0, 6000);

  let hasLanguage = false;
  for (const rule of LANG_RULES) {
    if (rule.patterns.some((p) => p.test(sample))) {
      found.add(rule.tag);
      hasLanguage = true;
    }
  }
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((p) => p.test(sample))) found.add(rule.tag);
  }
  if (hasLanguage) found.add("Code");

  // Collapse obvious aliases.
  if (found.has("TypeScript")) found.delete("JavaScript");
  if (found.has("Next.js")) found.add("React");
  if (found.has("Unity")) found.add("C#");
  if (found.has("Unreal")) found.add("C++");

  return [...found].slice(0, 10);
}

const hashString = (input: string): number => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

/**
 * Unknown tags receive a golden-angle hue so colours are maximally separated.
 */
export function deriveTagColor(tag: string, usedHues: number[] = []): TagColor {
  const builtin = BUILTIN_TAG_COLORS[tag];
  if (builtin) return { tag, hue: builtin.hue, lightness: builtin.lightness };

  const base = hashString(tag.toLowerCase());
  let hue = base % 360;
  const taken = new Set(usedHues);
  let guard = 0;
  while (guard < 24) {
    const clash = [...taken].some((h) => Math.min(Math.abs(h - hue), 360 - Math.abs(h - hue)) < 22);
    if (!clash) break;
    hue = (hue + 137.508) % 360;
    guard += 1;
  }
  return { tag, hue: Math.round(hue), lightness: 56 + (base % 3) * 5 };
}

export function tagCss(color: TagColor): { background: string; color: string; borderColor: string } {
  const { hue } = color;
  return {
    background: `hsla(${hue}, 42%, 48%, 0.14)`,
    color: `hsl(${hue}, 46%, var(--tag-fg))`,
    borderColor: `hsla(${hue}, 38%, 46%, 0.38)`,
  };
}

export function tagAccent(color: TagColor): string {
  return `hsl(${color.hue}, 46%, var(--tag-fg))`;
}

/**
 * Group (basket) colour: stable per name, reuses the golden-angle derivation so
 * a group never collides with a tag hue already in use.
 */
export function groupColor(name: string, usedHues: number[] = []): TagColor {
  return deriveTagColor(`group:${name}`, usedHues);
}

/** Outline + wash + label colour for a group envelope. */
export function groupEnvelope(color: TagColor) {
  return {
    outline: `hsla(${color.hue}, 40%, 46%, 0.42)`,
    outlineStrong: `hsla(${color.hue}, 44%, 42%, 0.72)`,
    wash: `hsla(${color.hue}, 38%, 50%, 0.1)`,
    label: `hsl(${color.hue}, 44%, var(--tag-fg))`,
    dot: `hsl(${color.hue}, 44%, 48%)`,
  };
}
