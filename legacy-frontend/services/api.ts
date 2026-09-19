/**
 * API service for frontend/backend communication.
 */
import {
  Composition,
  CompositionItem,
  LineageData,
  PromptBlockData,
  PublicStackPayload,
  QualityScorecard,
  RelatedPromptsResult,
  SemanticSearchResponse,
  Stack,
  TagColor,
  TagSuggestionResult,
} from '../types';
import { DEFAULT_TAG_LIGHTNESS } from '../constants';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export { API_URL };

const jsonHeaders = { 'Content-Type': 'application/json' };

const mapBlock = (block: any): PromptBlockData => ({
  id: block.id,
  type: block.type,
  title: block.title,
  content: block.content,
  tags: block.tags || [],
  stackId: block.stack_id ?? undefined,
  stackOrder: block.stack_order ?? undefined,
  parentPromptId: block.parent_prompt_id ?? undefined,
  rootPromptId: block.root_prompt_id ?? undefined,
  forkNote: block.fork_note ?? undefined,
  derivedFromStackId: block.derived_from_stack_id ?? undefined,
  createdAt: block.created_at ? new Date(block.created_at) : undefined,
  updatedAt: block.updated_at ? new Date(block.updated_at) : undefined,
  isNew: false,
});

const mapStack = (stack: any): Stack => ({
  id: stack.id,
  name: stack.name,
  slug: stack.slug ?? undefined,
  description: stack.description ?? undefined,
  isPublished: stack.is_published ?? false,
  themeKey: stack.theme_key ?? 'midnight-grid',
  coverImage: stack.cover_image ?? undefined,
  publishedAt: stack.published_at ? new Date(stack.published_at) : null,
  createdAt: stack.created_at ? new Date(stack.created_at) : new Date(),
});

const mapCompositionItem = (item: any): CompositionItem => ({
  id: item.id,
  compositionId: item.composition_id,
  sourcePromptId: item.source_prompt_id ?? undefined,
  kind: item.kind,
  content: item.content ?? '',
  section: item.section,
  position: item.position,
  label: item.label ?? undefined,
  prompt: item.prompt ? mapBlock(item.prompt) : undefined,
});

const mapComposition = (composition: any): Composition => ({
  id: composition.id,
  name: composition.name,
  description: composition.description ?? undefined,
  sourceStackId: composition.source_stack_id ?? undefined,
  createdAt: composition.created_at ? new Date(composition.created_at) : new Date(),
  updatedAt: composition.updated_at ? new Date(composition.updated_at) : new Date(),
  items: (composition.items || []).map(mapCompositionItem),
});

async function expectOk(response: Response, message: string) {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || message);
  }
  return response;
}

export async function getAllBlocks(): Promise<PromptBlockData[]> {
  const response = await expectOk(
    await fetch(`${API_URL}/api/blocks`),
    'Failed to fetch blocks',
  );
  const data = await response.json();
  return data.map(mapBlock);
}

export async function createBlock(block: PromptBlockData): Promise<PromptBlockData> {
  const response = await expectOk(
    await fetch(`${API_URL}/api/blocks`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        id: block.id,
        type: block.type,
        title: block.title,
        content: block.content,
        tags: block.tags,
        stack_id: block.stackId,
        stack_order: block.stackOrder,
        parent_prompt_id: block.parentPromptId,
        root_prompt_id: block.rootPromptId,
        fork_note: block.forkNote,
        derived_from_stack_id: block.derivedFromStackId,
      }),
    }),
    'Failed to create block',
  );
  return mapBlock(await response.json());
}

export async function updateBlock(
  id: string,
  updates: Partial<PromptBlockData>,
): Promise<void> {
  const body: any = {};
  if (updates.type !== undefined) body.type = updates.type;
  if (updates.title !== undefined) body.title = updates.title;
  if (updates.content !== undefined) body.content = updates.content;
  if (updates.tags !== undefined) body.tags = updates.tags;
  if (updates.stackId !== undefined) body.stack_id = updates.stackId;
  if (updates.stackOrder !== undefined) body.stack_order = updates.stackOrder;
  if (updates.parentPromptId !== undefined) body.parent_prompt_id = updates.parentPromptId;
  if (updates.rootPromptId !== undefined) body.root_prompt_id = updates.rootPromptId;
  if (updates.forkNote !== undefined) body.fork_note = updates.forkNote;
  if (updates.derivedFromStackId !== undefined) {
    body.derived_from_stack_id = updates.derivedFromStackId;
  }

  await expectOk(
    await fetch(`${API_URL}/api/blocks/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(body),
    }),
    'Failed to update block',
  );
}

export async function deleteBlock(id: string): Promise<void> {
  await expectOk(
    await fetch(`${API_URL}/api/blocks/${id}`, { method: 'DELETE' }),
    'Failed to delete block',
  );
}

export async function getPromptLineage(id: string): Promise<LineageData> {
  const response = await expectOk(
    await fetch(`${API_URL}/api/prompts/${id}/lineage`),
    'Failed to fetch prompt lineage',
  );
  const data = await response.json();
  return {
    prompt: mapBlock(data.prompt),
    ancestors: (data.ancestors || []).map(mapBlock),
    descendants: (data.descendants || []).map(mapBlock),
  };
}

export async function forkPrompt(
  id: string,
  payload: { title?: string; forkNote?: string; stackId?: string },
): Promise<PromptBlockData> {
  const response = await expectOk(
    await fetch(`${API_URL}/api/prompts/${id}/fork`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        title: payload.title,
        fork_note: payload.forkNote,
        stack_id: payload.stackId,
      }),
    }),
    'Failed to fork prompt',
  );
  return mapBlock(await response.json());
}

export async function getAllTagColors(): Promise<TagColor[]> {
  const response = await expectOk(
    await fetch(`${API_URL}/api/tag-colors`),
    'Failed to fetch tag colors',
  );
  const data = await response.json();
  return data.map((tc: any) => ({
    name: tc.name,
    hue: tc.hue,
    lightness: tc.lightness ?? DEFAULT_TAG_LIGHTNESS,
  }));
}

export async function setTagColor(
  name: string,
  hue: number,
  lightness: number,
): Promise<void> {
  await expectOk(
    await fetch(`${API_URL}/api/tag-colors/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ name, hue, lightness }),
    }),
    'Failed to set tag color',
  );
}

export async function deleteTagColor(name: string): Promise<void> {
  await expectOk(
    await fetch(`${API_URL}/api/tag-colors/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    }),
    'Failed to delete tag color',
  );
}

export async function getAllStacks(): Promise<Stack[]> {
  const response = await expectOk(
    await fetch(`${API_URL}/api/stacks`),
    'Failed to fetch stacks',
  );
  const data = await response.json();
  return data.map(mapStack);
}

export async function getStack(id: string): Promise<Stack> {
  const response = await expectOk(
    await fetch(`${API_URL}/api/stacks/${id}`),
    'Failed to fetch stack',
  );
  return mapStack(await response.json());
}

export async function createStack(stack: Stack): Promise<Stack> {
  const response = await expectOk(
    await fetch(`${API_URL}/api/stacks`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        id: stack.id,
        name: stack.name,
        slug: stack.slug,
        description: stack.description,
        is_published: stack.isPublished ?? false,
        theme_key: stack.themeKey ?? 'midnight-grid',
        cover_image: stack.coverImage,
      }),
    }),
    'Failed to create stack',
  );
  return mapStack(await response.json());
}

export async function updateStack(
  id: string,
  updates: Partial<Stack>,
): Promise<Stack> {
  const response = await expectOk(
    await fetch(`${API_URL}/api/stacks/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({
        name: updates.name,
        slug: updates.slug,
        description: updates.description,
        is_published: updates.isPublished,
        theme_key: updates.themeKey,
        cover_image: updates.coverImage,
      }),
    }),
    'Failed to update stack',
  );
  return mapStack(await response.json());
}

export async function publishStack(
  id: string,
  payload: { isPublished: boolean; slug?: string },
): Promise<Stack> {
  const response = await expectOk(
    await fetch(`${API_URL}/api/stacks/${id}/publish`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({
        is_published: payload.isPublished,
        slug: payload.slug,
      }),
    }),
    'Failed to publish stack',
  );
  return mapStack(await response.json());
}

export async function deleteStack(id: string): Promise<void> {
  await expectOk(
    await fetch(`${API_URL}/api/stacks/${id}`, { method: 'DELETE' }),
    'Failed to delete stack',
  );
}

export async function getPublicStack(slug: string): Promise<PublicStackPayload> {
  const response = await expectOk(
    await fetch(`${API_URL}/api/public/stacks/${slug}`),
    'Failed to fetch public stack',
  );
  const data = await response.json();
  return {
    stack: mapStack(data.stack),
    prompts: (data.prompts || []).map(mapBlock),
  };
}

export async function getCompositions(): Promise<Composition[]> {
  const response = await expectOk(
    await fetch(`${API_URL}/api/compositions`),
    'Failed to fetch compositions',
  );
  const data = await response.json();
  return data.map(mapComposition);
}

export async function getComposition(id: string): Promise<Composition> {
  const response = await expectOk(
    await fetch(`${API_URL}/api/compositions/${id}`),
    'Failed to fetch composition',
  );
  return mapComposition(await response.json());
}

export async function createComposition(payload: {
  id: string;
  name: string;
  description?: string;
  sourceStackId?: string;
  items: Array<{
    id: string;
    sourcePromptId?: string;
    kind: CompositionItem['kind'];
    content: string;
    section: CompositionItem['section'];
    position: number;
    label?: string;
  }>;
}): Promise<Composition> {
  const response = await expectOk(
    await fetch(`${API_URL}/api/compositions`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        id: payload.id,
        name: payload.name,
        description: payload.description,
        source_stack_id: payload.sourceStackId,
        items: payload.items.map((item) => ({
          id: item.id,
          source_prompt_id: item.sourcePromptId,
          kind: item.kind,
          content: item.content,
          section: item.section,
          position: item.position,
          label: item.label,
        })),
      }),
    }),
    'Failed to create composition',
  );
  return mapComposition(await response.json());
}

export async function updateComposition(
  id: string,
  payload: Partial<Composition>,
): Promise<Composition> {
  const response = await expectOk(
    await fetch(`${API_URL}/api/compositions/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({
        name: payload.name,
        description: payload.description,
        source_stack_id: payload.sourceStackId,
        items: payload.items?.map((item) => ({
          id: item.id,
          source_prompt_id: item.sourcePromptId,
          kind: item.kind,
          content: item.content,
          section: item.section,
          position: item.position,
          label: item.label,
        })),
      }),
    }),
    'Failed to update composition',
  );
  return mapComposition(await response.json());
}

export async function suggestTags(promptId: string): Promise<TagSuggestionResult> {
  const response = await expectOk(
    await fetch(`${API_URL}/api/insights/prompts/${promptId}/tags`, {
      method: 'POST',
    }),
    'Failed to suggest tags',
  );
  const data = await response.json();
  return {
    promptId: data.prompt_id,
    cached: data.cached,
    suggestedTags: data.suggested_tags || [],
    mergeSuggestions: data.merge_suggestions || [],
  };
}

export async function analyzeQuality(promptId: string): Promise<QualityScorecard> {
  const response = await expectOk(
    await fetch(`${API_URL}/api/insights/prompts/${promptId}/quality`, {
      method: 'POST',
    }),
    'Failed to analyze quality',
  );
  const data = await response.json();
  return {
    clarity: data.clarity,
    specificity: data.specificity,
    constraints: data.constraints,
    outputDefinition: data.output_definition,
    reusePotential: data.reuse_potential,
    ambiguityRisk: data.ambiguity_risk,
    summary: data.summary,
    recommendations: data.recommendations || [],
  };
}

export async function findRelatedPrompts(
  promptId: string,
): Promise<RelatedPromptsResult> {
  const response = await expectOk(
    await fetch(`${API_URL}/api/insights/prompts/${promptId}/related`, {
      method: 'POST',
    }),
    'Failed to find related prompts',
  );
  const data = await response.json();
  return {
    promptId: data.prompt_id,
    cached: data.cached,
    semanticProfile: {
      intent: data.semantic_profile.intent,
      outputStyle: data.semantic_profile.output_style,
      keywords: data.semantic_profile.keywords || [],
      constraints: data.semantic_profile.constraints || [],
      personas: data.semantic_profile.personas || [],
    },
    results: (data.results || []).map((item: any) => ({
      prompt: mapBlock(item.prompt),
      score: item.score,
      reason: item.reason,
    })),
  };
}

export async function semanticSearch(payload: {
  query: string;
  activeTags?: string[];
  stackId?: string | null;
  limit?: number;
}): Promise<SemanticSearchResponse> {
  const response = await expectOk(
    await fetch(`${API_URL}/api/search/semantic`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        query: payload.query,
        active_tags: payload.activeTags || [],
        stack_id: payload.stackId || null,
        limit: payload.limit || 20,
      }),
    }),
    'Failed to run semantic search',
  );
  const data = await response.json();
  return {
    query: data.query,
    results: (data.results || []).map((item: any) => ({
      promptId: item.prompt_id,
      score: item.score,
      reason: item.reason,
    })),
  };
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}
