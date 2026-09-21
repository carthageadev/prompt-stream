export const BLOCK_TYPES = [
  "persona",
  "context",
  "constraint",
  "format",
  "instruction",
  "example",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_TYPE_META: Record<
  BlockType,
  { label: string; glyph: string; hue: number }
> = {
  persona: { label: "Persona", glyph: "◈", hue: 262 },
  context: { label: "Context", glyph: "▤", hue: 206 },
  constraint: { label: "Constraint", glyph: "⌗", hue: 8 },
  format: { label: "Format", glyph: "▦", hue: 168 },
  instruction: { label: "Instruction", glyph: "→", hue: 228 },
  example: { label: "Example", glyph: "≡", hue: 38 },
};

/** Readable type colour that follows the light/dark --type-fg token. */
export function typeInk(type: BlockType): string {
  return `hsl(${BLOCK_TYPE_META[type].hue}, 42%, var(--type-fg))`;
}

export type Basket = {
  id: number;
  name: string;
  position: number;
  sessionId?: number | null;
  promptCount?: number;
};

export const STACK_THEMES = ["midnight", "sunset", "oxide", "sea"] as const;
export type StackTheme = (typeof STACK_THEMES)[number];

export const STACK_THEME_META: Record<StackTheme, { label: string; hint: string }> = {
  midnight: { label: "Slate", hint: "cool steel" },
  sunset: { label: "Clay", hint: "muted umber" },
  oxide: { label: "Stone", hint: "warm grey" },
  sea: { label: "Moss", hint: "quiet teal" },
};

export type Stack = {
  id: number;
  name: string;
  slug: string | null;
  description: string;
  coverImageUrl: string | null;
  theme: StackTheme;
  isPublic: boolean;
  sessionId?: number | null;
  promptCount?: number;
};

export type PromptBlock = {
  id: number;
  title: string;
  content: string;
  blockType: BlockType;
  sessionId?: number | null;
  stackId: number | null;
  stackOrder: number;
  basketId: number | null;
  basketOrder: number;
  tags: string[];
  parentPromptId: number | null;
  rootPromptId: number | null;
  isArchived: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TagColor = {
  tag: string;
  hue: number;
  lightness: number;
  sessionId?: number | null;
};

export type CompositionSection =
  | "role"
  | "context"
  | "rules"
  | "examples"
  | "output"
  | "freeform";

export const COMPOSITION_SECTIONS: CompositionSection[] = [
  "role",
  "context",
  "rules",
  "examples",
  "output",
  "freeform",
];

export const COMPOSITION_SECTION_LABELS: Record<CompositionSection, string> = {
  role: "Role",
  context: "Context",
  rules: "Rules",
  examples: "Examples",
  output: "Output",
  freeform: "Freeform",
};

export type CompositionItem = {
  id: number;
  compositionId: number;
  promptId: number | null;
  label: string;
  content: string;
  section: CompositionSection;
  position: number;
};

export type Composition = {
  id: number;
  title: string;
  description: string;
  sessionId?: number | null;
  items: CompositionItem[];
};

export type SemanticHit = {
  id: number;
  score: number;
  reason: string;
};

export type QualityMetric = {
  key: "clarity" | "specificity" | "constraints" | "output" | "reuse" | "ambiguity";
  label: string;
  score: number;
  note: string;
};

export type QualityReport = {
  overall: number;
  metrics: QualityMetric[];
  summary: string;
  recommendations: string[];
  source: "ai" | "heuristic";
};

export type TagSuggestion = {
  tags: string[];
  merges: { source: string; target: string }[];
  source: "ai" | "heuristic";
};

export type RelatedHit = {
  id: number;
  title: string;
  score: number;
  reason: string;
}
