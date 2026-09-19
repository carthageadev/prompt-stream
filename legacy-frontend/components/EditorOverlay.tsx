import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Copy,
  GitBranch,
  Hash,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
  ChevronDown,
} from 'lucide-react';
import gsap from 'gsap';
import { PromptBlockData, RelatedPromptsResult, Stack, TagColor } from '../types';
import { getTagColorClasses } from '../constants';
import * as api from '../services/api';

interface EditorOverlayProps {
  block: PromptBlockData;
  onClose: () => void;
  onUpdate: (updates: Partial<PromptBlockData>) => void;
  onDelete: () => void;
  stacks: Stack[];
  tagColors: Map<string, TagColor>;
  onEnsureTagColor: (tag: string) => void;
  onForkCreated: (block: PromptBlockData) => void;
  onOpenPrompt: (id: string) => void;
}

const scoreRows = [
  ['Clarity', 'clarity'],
  ['Specificity', 'specificity'],
  ['Constraints', 'constraints'],
  ['Output', 'outputDefinition'],
  ['Reuse', 'reusePotential'],
  ['Ambiguity', 'ambiguityRisk'],
] as const;

const EditorOverlay: React.FC<EditorOverlayProps> = ({
  block,
  onClose,
  onUpdate,
  onDelete,
  stacks,
  tagColors,
  onEnsureTagColor,
  onForkCreated,
  onOpenPrompt,
}) => {
  const [content, setContent] = useState(block.content);
  const [tags, setTags] = useState<string[]>(block.tags || []);
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isStackMenuOpen, setIsStackMenuOpen] = useState(false);
  const [stackOrderInput, setStackOrderInput] = useState(
    block.stackOrder ? block.stackOrder.toString() : '',
  );
  const [lineage, setLineage] = useState<{
    ancestors: PromptBlockData[];
    descendants: PromptBlockData[];
  }>({ ancestors: [], descendants: [] });
  const [isLineageLoading, setIsLineageLoading] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [mergeSuggestions, setMergeSuggestions] = useState<string[]>([]);
  const [scorecard, setScorecard] = useState<any>(null);
  const [related, setRelated] = useState<RelatedPromptsResult | null>(null);
  const [actionLoading, setActionLoading] = useState<
    'tags' | 'quality' | 'related' | 'fork' | null
  >(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const stackMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(
      containerRef.current,
      { scale: 0.95, opacity: 0, y: 10 },
      { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' },
    );
  }, []);

  useEffect(() => {
    if (isAddingTag && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [isAddingTag]);

  useEffect(() => {
    if (!isStackMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!stackMenuRef.current) return;
      if (!stackMenuRef.current.contains(event.target as Node)) {
        setIsStackMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [isStackMenuOpen]);

  useEffect(() => {
    setContent(block.content);
    setTags(block.tags || []);
    setStackOrderInput(block.stackOrder ? block.stackOrder.toString() : '');
  }, [block]);

  useEffect(() => {
    const run = async () => {
      setIsLineageLoading(true);
      try {
        const data = await api.getPromptLineage(block.id);
        setLineage({
          ancestors: data.ancestors,
          descendants: data.descendants,
        });
      } catch {
        setLineage({ ancestors: [], descendants: [] });
      } finally {
        setIsLineageLoading(false);
      }
    };
    run();
  }, [block.id]);

  const handleClose = () => {
    gsap.to(containerRef.current, {
      scale: 0.95,
      opacity: 0,
      duration: 0.2,
      onComplete: onClose,
    });
    gsap.to(backdropRef.current, { opacity: 0, duration: 0.2 });
  };

  const handleAddTag = () => {
    const nextTag = newTagInput.trim();
    if (nextTag && !tags.includes(nextTag)) {
      const updatedTags = [...tags, nextTag];
      setTags(updatedTags);
      onUpdate({ tags: updatedTags });
      onEnsureTagColor(nextTag);
      setNewTagInput('');
      setIsAddingTag(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = tags.filter((t) => t !== tagToRemove);
    setTags(updatedTags);
    onUpdate({ tags: updatedTags });
  };

  const activeStack = stacks.find((s) => s.id === block.stackId);
  const stackLabel = activeStack ? activeStack.name : 'No Stack';

  const handleSelectStack = (stackId?: string) => {
    const nextStackId = stackId || undefined;
    const preserveOrder =
      nextStackId && nextStackId === block.stackId ? block.stackOrder : undefined;
    onUpdate({
      stackId: nextStackId,
      stackOrder: preserveOrder,
    });
    if (!nextStackId || preserveOrder === undefined) setStackOrderInput('');
    setIsStackMenuOpen(false);
  };

  const handleStackOrderChange = (value: string) => {
    const sanitized = value.replace(/\D/g, '');
    if (!sanitized) {
      setStackOrderInput('');
      onUpdate({ stackOrder: undefined });
      return;
    }
    const numeric = Math.min(99, Math.max(1, parseInt(sanitized, 10)));
    setStackOrderInput(numeric.toString());
    onUpdate({ stackOrder: numeric });
  };

  const runAction = async (action: 'tags' | 'quality' | 'related') => {
    setActionLoading(action);
    try {
      if (action === 'tags') {
        const result = await api.suggestTags(block.id);
        setSuggestedTags(result.suggestedTags);
        setMergeSuggestions(
          result.mergeSuggestions.map((item) => `${item.source} -> ${item.target}`),
        );
      }
      if (action === 'quality') {
        const result = await api.analyzeQuality(block.id);
        setScorecard(result);
      }
      if (action === 'related') {
        const result = await api.findRelatedPrompts(block.id);
        setRelated(result);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleFork = async () => {
    setActionLoading('fork');
    try {
      const fork = await api.forkPrompt(block.id, {
        stackId: block.stackId,
        forkNote: `Forked from ${block.title}`,
      });
      onForkCreated(fork);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className='fixed inset-0 z-[60] flex items-center justify-center p-4 lg:p-10'>
      <div
        ref={backdropRef}
        className='absolute inset-0 bg-black/80 backdrop-blur-sm'
        onClick={handleClose}
      />

      <div
        ref={containerRef}
        className='relative w-full max-w-[1400px] h-full bg-[var(--app-surface)] rounded-xl overflow-hidden flex flex-col shadow-2xl border border-[var(--app-border)]'
      >
        <div className='flex items-center justify-between px-8 py-5 border-b border-[var(--app-border)] bg-[var(--app-surface-2)]'>
          <div className='flex items-center gap-6 flex-wrap'>
            <span className='text-xs text-[var(--app-text-subtle)] font-mono hidden sm:inline-block'>
              ID: {block.id}
            </span>
            <div className='flex items-center gap-4'>
              <div className='flex items-center gap-2'>
                <span className='text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-subtle)]'>
                  Stack:
                </span>
                <div ref={stackMenuRef} className='relative'>
                  <button
                    onClick={() => setIsStackMenuOpen((prev) => !prev)}
                    className='flex items-center gap-2 bg-[var(--app-bg)] border border-[var(--app-border)] rounded px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--app-text)]'
                    type='button'
                  >
                    <span className='max-w-[140px] truncate'>{stackLabel}</span>
                    <ChevronDown size={12} className='text-[var(--app-text-subtle)]' />
                  </button>
                  {isStackMenuOpen && (
                    <div className='absolute top-full left-0 mt-2 w-48 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl z-20 overflow-hidden'>
                      <button
                        onClick={() => handleSelectStack()}
                        className='w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)] hover:bg-[var(--app-surface-3)]'
                      >
                        No Stack
                      </button>
                      <div className='h-px bg-[var(--app-border)]' />
                      {stacks.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => handleSelectStack(s.id)}
                          className={`w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${
                            block.stackId === s.id
                              ? 'bg-[var(--app-surface-3)] text-[var(--app-text-strong)]'
                              : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-3)]'
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {block.stackId && (
                <div className='flex items-center gap-2'>
                  <span className='text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-subtle)]'>
                    Order:
                  </span>
                  <div className='flex items-center gap-1 bg-[var(--app-bg)] border border-[var(--app-border)] rounded px-2 py-1'>
                    <Hash size={12} className='text-[var(--app-text-subtle)]' />
                    <input
                      value={stackOrderInput}
                      onChange={(e) => handleStackOrderChange(e.target.value)}
                      onBlur={() => handleStackOrderChange(stackOrderInput)}
                      placeholder='1-99'
                      className='w-12 bg-transparent text-[10px] font-bold uppercase tracking-wider text-[var(--app-text)] focus:outline-none placeholder:text-[var(--app-text-subtle)]'
                      inputMode='numeric'
                      maxLength={2}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <button
              onClick={() => navigator.clipboard.writeText(content)}
              className='p-2 text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] rounded-lg hover:bg-[var(--app-surface-3)]'
            >
              <Copy size={18} />
            </button>
            <button
              onClick={handleFork}
              className='inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--app-border)] text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)]'
            >
              {actionLoading === 'fork' ? (
                <Loader2 size={14} className='animate-spin' />
              ) : (
                <GitBranch size={14} />
              )}
              Fork
            </button>
            <button
              onClick={() => {
                onDelete();
                handleClose();
              }}
              className='p-2 text-[var(--app-text-subtle)] hover:text-red-500 rounded-lg hover:bg-red-950/20'
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={handleClose}
              className='p-2 text-[var(--app-inverse)] bg-[var(--app-accent)] rounded-lg'
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className='flex-1 overflow-hidden grid lg:grid-cols-[minmax(0,1fr),360px]'>
          <div className='flex flex-col overflow-hidden bg-[var(--app-surface)]'>
            <textarea
              autoFocus
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                onUpdate({ content: e.target.value });
              }}
              className='flex-1 w-full bg-transparent p-8 lg:p-10 text-lg font-mono text-[var(--app-text)] leading-relaxed focus:outline-none resize-none custom-scrollbar placeholder:text-[var(--app-text-subtle)]'
              spellCheck={false}
              placeholder='Start typing...'
            />
          </div>

          <aside className='border-l border-[var(--app-border)] bg-[var(--app-surface-2)] p-5 overflow-y-auto custom-scrollbar'>
            <div className='grid gap-3 sm:grid-cols-3 lg:grid-cols-1'>
              <button
                onClick={() => runAction('tags')}
                className='rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-left'
              >
                <div className='flex items-center gap-2 text-[var(--app-text-strong)]'>
                  {actionLoading === 'tags' ? (
                    <Loader2 size={16} className='animate-spin' />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  <span className='text-xs font-bold uppercase tracking-[0.2em]'>
                    Suggest tags
                  </span>
                </div>
              </button>
              <button
                onClick={() => runAction('quality')}
                className='rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-left'
              >
                <div className='flex items-center gap-2 text-[var(--app-text-strong)]'>
                  {actionLoading === 'quality' ? (
                    <Loader2 size={16} className='animate-spin' />
                  ) : (
                    <Bot size={16} />
                  )}
                  <span className='text-xs font-bold uppercase tracking-[0.2em]'>
                    Analyze quality
                  </span>
                </div>
              </button>
              <button
                onClick={() => runAction('related')}
                className='rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-left'
              >
                <div className='flex items-center gap-2 text-[var(--app-text-strong)]'>
                  {actionLoading === 'related' ? (
                    <Loader2 size={16} className='animate-spin' />
                  ) : (
                    <GitBranch size={16} />
                  )}
                  <span className='text-xs font-bold uppercase tracking-[0.2em]'>
                    Find related
                  </span>
                </div>
              </button>
            </div>

            <div className='mt-5 space-y-4'>
              <section className='rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4'>
                <p className='text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]'>
                  Lineage
                </p>
                {isLineageLoading ? (
                  <Loader2 size={14} className='mt-3 animate-spin text-[var(--app-text-subtle)]' />
                ) : (
                  <div className='mt-3 space-y-3 text-sm'>
                    <div>
                      <p className='text-[10px] uppercase tracking-[0.18em] text-[var(--app-text-subtle)]'>
                        Ancestors
                      </p>
                      <div className='mt-2 space-y-2'>
                        {lineage.ancestors.length === 0 && (
                          <p className='text-[var(--app-text-muted)]'>Original prompt.</p>
                        )}
                        {lineage.ancestors.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => onOpenPrompt(item.id)}
                            className='block text-left text-[var(--app-text)] hover:text-[var(--app-text-strong)]'
                          >
                            {item.title}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className='text-[10px] uppercase tracking-[0.18em] text-[var(--app-text-subtle)]'>
                        Descendants
                      </p>
                      <div className='mt-2 space-y-2'>
                        {lineage.descendants.length === 0 && (
                          <p className='text-[var(--app-text-muted)]'>No forks yet.</p>
                        )}
                        {lineage.descendants.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => onOpenPrompt(item.id)}
                            className='block text-left text-[var(--app-text)] hover:text-[var(--app-text-strong)]'
                          >
                            {item.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className='rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4'>
                <p className='text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]'>
                  Tag intelligence
                </p>
                <div className='mt-3 flex flex-wrap gap-2'>
                  {suggestedTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        if (!tags.includes(tag)) {
                          const updated = [...tags, tag];
                          setTags(updated);
                          onUpdate({ tags: updated });
                          onEnsureTagColor(tag);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${getTagColorClasses(
                        tag,
                        tagColors,
                      )}`}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
                {mergeSuggestions.length > 0 && (
                  <div className='mt-3 space-y-1'>
                    {mergeSuggestions.map((item) => (
                      <p
                        key={item}
                        className='text-xs text-[var(--app-text-muted)] font-mono'
                      >
                        {item}
                      </p>
                    ))}
                  </div>
                )}
              </section>

              {scorecard && (
                <section className='rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4'>
                  <p className='text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]'>
                    Scorecard
                  </p>
                  <div className='mt-3 space-y-3'>
                    {scoreRows.map(([label, key]) => (
                      <div key={key}>
                        <div className='flex items-center justify-between text-xs text-[var(--app-text-muted)]'>
                          <span>{label}</span>
                          <span>{scorecard[key]}/10</span>
                        </div>
                        <div className='mt-1 h-2 rounded-full bg-[var(--app-surface-3)]'>
                          <div
                            className='h-2 rounded-full bg-[var(--app-accent)]'
                            style={{ width: `${Math.min(100, scorecard[key] * 10)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    <p className='text-sm text-[var(--app-text)]'>{scorecard.summary}</p>
                    <ul className='space-y-2 text-xs text-[var(--app-text-muted)]'>
                      {scorecard.recommendations.map((item: string) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {related && (
                <section className='rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4'>
                  <p className='text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]'>
                    Related prompts
                  </p>
                  <div className='mt-3 space-y-3'>
                    {related.results.map((item) => (
                      <button
                        key={item.prompt.id}
                        onClick={() => onOpenPrompt(item.prompt.id)}
                        className='w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 text-left'
                      >
                        <p className='text-sm font-semibold text-[var(--app-text-strong)]'>
                          {item.prompt.title}
                        </p>
                        <p className='mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--app-text-subtle)]'>
                          {item.reason} · {item.score.toFixed(2)}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </aside>
        </div>

        <div className='px-8 py-4 border-t border-[var(--app-border)] bg-[var(--app-surface-2)] flex flex-col sm:flex-row items-center justify-between shrink-0 gap-4'>
          <div className='flex items-center flex-wrap gap-2 w-full sm:w-auto'>
            {tags.map((tag) => (
              <div
                key={tag}
                className={`flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider ${getTagColorClasses(
                  tag,
                  tagColors,
                )}`}
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className='hover:text-white transition-colors'
                >
                  <X size={12} />
                </button>
              </div>
            ))}

            {isAddingTag ? (
              <div className='flex items-center gap-2 animate-in fade-in slide-in-from-left-2'>
                <input
                  ref={tagInputRef}
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  onBlur={() => {
                    if (!newTagInput) setIsAddingTag(false);
                    else handleAddTag();
                  }}
                  className='bg-[var(--app-surface-3)] border border-[var(--app-border-strong)] rounded px-2 py-1 text-xs text-[var(--app-text-strong)] outline-none w-24'
                  placeholder='Tag name...'
                />
              </div>
            ) : (
              <button
                onClick={() => setIsAddingTag(true)}
                className='flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-subtle)] border border-dashed border-[var(--app-border-strong)] px-2 py-1 rounded transition-all'
              >
                <Plus size={12} /> Add Tag
              </button>
            )}
          </div>

          <div className='flex items-center gap-6 text-[var(--app-text-subtle)] self-end sm:self-auto'>
            <span className='text-xs font-mono'>{content.length} chars</span>
            <button
              onClick={handleClose}
              className='px-6 py-2 bg-[var(--app-accent)] text-[var(--app-inverse)] rounded-lg text-sm font-bold'
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorOverlay;
