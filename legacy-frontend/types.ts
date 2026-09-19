export type BlockType =
  | 'persona'
  | 'context'
  | 'constraint'
  | 'format'
  | 'instruction'
  | 'example';

export type StackThemeKey =
  | 'midnight-grid'
  | 'signal-sunset'
  | 'oxide-paper'
  | 'sea-glass';

export interface PromptBlockData {
  id: string;
  type: BlockType;
  title: string;
  content: string;
  tags: string[];
  stackId?: string | null;
  stackOrder?: number;
  parentPromptId?: string;
  rootPromptId?: string;
  forkNote?: string;
  derivedFromStackId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  isNew?: boolean;
  isDeleting?: boolean;
  isTemp?: boolean;
}

export interface TagColor {
  name: string;
  hue: number;
  lightness: number;
}

export interface Stack {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  isPublished?: boolean;
  themeKey?: StackThemeKey | string;
  coverImage?: string;
  publishedAt?: Date | null;
  createdAt: Date;
}

export interface Template {
  type: BlockType;
  title: string;
  defaultContent: string;
  icon: string;
  description: string;
  category: string;
}

export interface GeminiResponse {
  text: string;
  error?: string;
}

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  actionLabel?: string;
  onAction?: () => void;
}

export interface LineageData {
  prompt: PromptBlockData;
  ancestors: PromptBlockData[];
  descendants: PromptBlockData[];
}

export interface TagMergeSuggestion {
  source: string;
  target: string;
  reason: string;
}

export interface TagSuggestionResult {
  promptId: string;
  cached: boolean;
  suggestedTags: string[];
  mergeSuggestions: TagMergeSuggestion[];
}

export interface QualityScorecard {
  clarity: number;
  specificity: number;
  constraints: number;
  outputDefinition: number;
  reusePotential: number;
  ambiguityRisk: number;
  summary: string;
  recommendations: string[];
}

export interface SemanticProfile {
  intent: string;
  outputStyle: string;
  keywords: string[];
  constraints: string[];
  personas: string[];
}

export interface RelatedPrompt {
  prompt: PromptBlockData;
  score: number;
  reason: string;
}

export interface RelatedPromptsResult {
  promptId: string;
  cached: boolean;
  semanticProfile: SemanticProfile;
  results: RelatedPrompt[];
}

export interface PromptInsight {
  promptId: string;
  contentHash: string;
  suggestedTags: string[];
  tagMergeSuggestions: TagMergeSuggestion[];
  scorecard?: QualityScorecard | null;
  semanticProfile?: SemanticProfile | null;
  relatedPromptIds: string[];
  generatedAt?: Date;
  updatedAt?: Date;
}

export type CompositionItemKind = 'prompt' | 'inline';
export type CompositionSection =
  | 'role'
  | 'context'
  | 'rules'
  | 'examples'
  | 'output'
  | 'freeform';

export interface CompositionItem {
  id: string;
  compositionId: string;
  sourcePromptId?: string;
  kind: CompositionItemKind;
  content: string;
  section: CompositionSection;
  position: number;
  label?: string;
  prompt?: PromptBlockData;
}

export interface Composition {
  id: string;
  name: string;
  description?: string;
  sourceStackId?: string;
  createdAt: Date;
  updatedAt: Date;
  items: CompositionItem[];
}

export interface SemanticSearchResult {
  promptId: string;
  score: number;
  reason: string;
}

export interface SemanticSearchResponse {
  query: string;
  results: SemanticSearchResult[];
}

export interface PublicStackPayload {
  stack: Stack;
  prompts: PromptBlockData[];
}
