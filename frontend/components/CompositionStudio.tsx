import React from 'react';
import {
  ArrowLeft,
  Copy,
  Loader2,
  MoveDown,
  MoveUp,
  Plus,
  Save,
  Trash2,
  WandSparkles,
} from 'lucide-react';
import * as api from '../services/api';
import {
  Composition,
  CompositionItem,
  CompositionSection,
  PromptBlockData,
} from '../types';
import { navigateTo } from '../navigation';

const SECTION_OPTIONS: CompositionSection[] = [
  'role',
  'context',
  'rules',
  'examples',
  'output',
  'freeform',
];

const EXPORT_PRESETS = ['chatgpt', 'claude', 'gemini', 'openrouter'] as const;
type ExportPreset = (typeof EXPORT_PRESETS)[number];

const SECTION_LABELS: Record<CompositionSection, string> = {
  role: 'Role',
  context: 'Context',
  rules: 'Rules',
  examples: 'Examples',
  output: 'Output',
  freeform: 'Freeform',
};

const formatPreview = (composition: Composition, preset: ExportPreset) => {
  const ordered = [...composition.items].sort((a, b) => a.position - b.position);

  if (preset === 'openrouter') {
    return JSON.stringify(
      {
        model: 'openai/gpt-4o-mini',
        messages: ordered.map((item) => ({
          role: item.section === 'role' ? 'system' : 'user',
          content: item.content,
        })),
      },
      null,
      2,
    );
  }

  return ordered
    .map((item) => {
      const label = SECTION_LABELS[item.section];
      const content = item.content;
      if (preset === 'claude') return `${label.toUpperCase()}\n${content}`;
      if (preset === 'gemini') return `## ${label}\n${content}`;
      return `[${label}]\n${content}`;
    })
    .join('\n\n');
};

const CompositionStudio: React.FC<{ compositionId: string }> = ({ compositionId }) => {
  const [composition, setComposition] = React.useState<Composition | null>(null);
  const [blocks, setBlocks] = React.useState<PromptBlockData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [preset, setPreset] = React.useState<ExportPreset>('chatgpt');

  React.useEffect(() => {
    document.title = 'Composition Studio | prompts.achraf.tn';
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [loadedComposition, loadedBlocks] = await Promise.all([
          api.getComposition(compositionId),
          api.getAllBlocks(),
        ]);
        setComposition(loadedComposition);
        setBlocks(loadedBlocks);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load composition');
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [compositionId]);

  const filteredBlocks = React.useMemo(() => {
    const query = searchQuery.toLowerCase();
    return blocks.filter((block) => {
      if (!query) return true;
      return (
        block.title.toLowerCase().includes(query) ||
        block.content.toLowerCase().includes(query) ||
        block.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });
  }, [blocks, searchQuery]);

  const updateItems = (nextItems: CompositionItem[]) => {
    setComposition((prev) =>
      prev
        ? {
            ...prev,
            items: nextItems.map((item, index) => ({ ...item, position: index })),
          }
        : prev,
    );
  };

  const addPromptItem = (prompt: PromptBlockData) => {
    if (!composition) return;
    updateItems([
      ...composition.items,
      {
        id: crypto.randomUUID(),
        compositionId: composition.id,
        sourcePromptId: prompt.id,
        kind: 'prompt',
        content: prompt.content,
        section: 'context',
        position: composition.items.length,
        label: prompt.title,
        prompt,
      },
    ]);
  };

  const addInlineItem = () => {
    if (!composition) return;
    updateItems([
      ...composition.items,
      {
        id: crypto.randomUUID(),
        compositionId: composition.id,
        kind: 'inline',
        content: 'Add a custom instruction...',
        section: 'freeform',
        position: composition.items.length,
        label: 'Inline note',
      },
    ]);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    if (!composition) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= composition.items.length) return;
    const nextItems = [...composition.items];
    [nextItems[index], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[index]];
    updateItems(nextItems);
  };

  const preview = composition ? formatPreview(composition, preset) : '';

  const saveComposition = async () => {
    if (!composition) return;
    setIsSaving(true);
    try {
      const saved = await api.updateComposition(composition.id, composition);
      setComposition(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save composition');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className='min-h-screen bg-[var(--app-bg)] text-[var(--app-text)] flex items-center justify-center'>
        <Loader2 className='animate-spin text-[var(--app-text-subtle)]' />
      </div>
    );
  }

  if (!composition || error) {
    return (
      <div className='min-h-screen bg-[var(--app-bg)] text-[var(--app-text)] p-8'>
        <button
          onClick={() => navigateTo('/')}
          className='inline-flex items-center gap-2 text-sm text-[var(--app-text-subtle)]'
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div className='mt-8 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-8'>
          <p className='text-[var(--app-text-muted)]'>{error || 'Composition not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]'>
      <div className='mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8'>
        <header className='mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-4'>
          <div>
            <button
              onClick={() => navigateTo('/')}
              className='inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--app-text-subtle)]'
            >
              <ArrowLeft size={14} />
              Back to studio
            </button>
            <div className='mt-3 flex items-center gap-3'>
              <WandSparkles size={18} className='text-[var(--app-text-subtle)]' />
              <input
                value={composition.name}
                onChange={(e) =>
                  setComposition((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                }
                className='bg-transparent text-2xl font-brand font-semibold tracking-tight text-[var(--app-text-strong)] outline-none'
              />
            </div>
          </div>
          <div className='flex items-center gap-3'>
            <button
              onClick={() => navigator.clipboard.writeText(preview)}
              className='inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]'
            >
              <Copy size={14} />
              Copy export
            </button>
            <button
              onClick={saveComposition}
              className='inline-flex items-center gap-2 rounded-full border border-[var(--app-border-strong)] bg-[var(--app-accent)] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--app-inverse)]'
            >
              {isSaving ? <Loader2 size={14} className='animate-spin' /> : <Save size={14} />}
              Save
            </button>
          </div>
        </header>

        <div className='grid gap-5 xl:grid-cols-[300px,minmax(0,1fr),420px]'>
          <aside className='rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4'>
            <div className='flex items-center justify-between gap-3'>
              <h2 className='text-sm font-bold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]'>
                Library
              </h2>
              <button
                onClick={addInlineItem}
                className='inline-flex items-center gap-1 rounded-full border border-[var(--app-border)] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--app-text-subtle)]'
              >
                <Plus size={12} />
                Inline
              </button>
            </div>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search prompts'
              className='mt-4 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3 py-2 text-sm outline-none'
            />
            <div className='mt-4 space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1'>
              {filteredBlocks.map((block) => (
                <button
                  key={block.id}
                  onClick={() => addPromptItem(block)}
                  className='w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 text-left hover:border-[var(--app-border-strong)] transition-colors'
                >
                  <div className='text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-text-subtle)]'>
                    {block.tags[0] || block.type}
                  </div>
                  <div className='mt-2 text-sm font-semibold text-[var(--app-text-strong)]'>
                    {block.title}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className='rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4'>
            <div className='flex items-center justify-between'>
              <h2 className='text-sm font-bold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]'>
                Composition Canvas
              </h2>
              <textarea
                value={composition.description || ''}
                onChange={(e) =>
                  setComposition((prev) =>
                    prev ? { ...prev, description: e.target.value } : prev,
                  )
                }
                placeholder='Describe this composition'
                className='w-72 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3 py-2 text-sm outline-none resize-none'
                rows={2}
              />
            </div>
            <div className='mt-4 space-y-3'>
              {composition.items.map((item, index) => (
                <div
                  key={item.id}
                  className='rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-4'
                >
                  <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div className='flex items-center gap-3'>
                      <select
                        value={item.section}
                        onChange={(e) =>
                          updateItems(
                            composition.items.map((current) =>
                              current.id === item.id
                                ? {
                                    ...current,
                                    section: e.target.value as CompositionSection,
                                  }
                                : current,
                            ),
                          )
                        }
                        className='rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em]'
                      >
                        {SECTION_OPTIONS.map((section) => (
                          <option key={section} value={section}>
                            {SECTION_LABELS[section]}
                          </option>
                        ))}
                      </select>
                      <input
                        value={item.label || ''}
                        onChange={(e) =>
                          updateItems(
                            composition.items.map((current) =>
                              current.id === item.id
                                ? { ...current, label: e.target.value }
                                : current,
                            ),
                          )
                        }
                        className='bg-transparent text-sm font-semibold text-[var(--app-text-strong)] outline-none'
                      />
                    </div>
                    <div className='flex items-center gap-2'>
                      <button
                        onClick={() => moveItem(index, -1)}
                        className='rounded-full border border-[var(--app-border)] p-2 text-[var(--app-text-subtle)]'
                      >
                        <MoveUp size={14} />
                      </button>
                      <button
                        onClick={() => moveItem(index, 1)}
                        className='rounded-full border border-[var(--app-border)] p-2 text-[var(--app-text-subtle)]'
                      >
                        <MoveDown size={14} />
                      </button>
                      <button
                        onClick={() =>
                          updateItems(
                            composition.items.filter((current) => current.id !== item.id),
                          )
                        }
                        className='rounded-full border border-[var(--app-border)] p-2 text-[var(--app-text-subtle)]'
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={item.content}
                    onChange={(e) =>
                      updateItems(
                        composition.items.map((current) =>
                          current.id === item.id ? { ...current, content: e.target.value } : current,
                        ),
                      )
                    }
                    className='mt-4 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-4 text-sm font-mono leading-7 outline-none'
                    rows={6}
                  />
                </div>
              ))}
            </div>
          </section>

          <aside className='rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4'>
            <div className='flex items-center justify-between'>
              <h2 className='text-sm font-bold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]'>
                Export Preview
              </h2>
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value as ExportPreset)}
                className='rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em]'
              >
                {EXPORT_PRESETS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <pre className='mt-4 min-h-[70vh] overflow-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-4 text-xs font-mono leading-6 text-[var(--app-text)] custom-scrollbar whitespace-pre-wrap'>
              {preview}
            </pre>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CompositionStudio;
