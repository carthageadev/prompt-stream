import React from 'react';
import { Loader2, NotebookPen, Search, X } from 'lucide-react';
import gsap from 'gsap';
import { listPrompts, PromptSnapshotRecord } from '../../lib/sessionsDb';

interface InsertPromptOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (prompt: PromptSnapshotRecord) => void;
}

const InsertPromptOverlay: React.FC<InsertPromptOverlayProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [prompts, setPrompts] = React.useState<PromptSnapshotRecord[]>([]);
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const backdropRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const prefersReducedMotion = React.useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  React.useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);
    void listPrompts()
      .then((nextPrompts) => {
        setPrompts(nextPrompts);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Unable to load prompts.');
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;

    inputRef.current?.focus();
    const duration = prefersReducedMotion ? 0 : 0.18;
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration });
    gsap.fromTo(
      containerRef.current,
      { opacity: 0, y: 10, scale: 0.98 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: prefersReducedMotion ? 0 : 0.26,
        ease: 'power3.out',
      },
    );
  }, [isOpen, prefersReducedMotion]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredPrompts = prompts.filter((prompt) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return (
      prompt.title.toLowerCase().includes(normalized) ||
      prompt.content.toLowerCase().includes(normalized)
    );
  });

  return (
    <div className='fixed inset-0 z-[95] flex items-center justify-center p-4 sm:p-8'>
      <button
        type='button'
        ref={backdropRef}
        className='absolute inset-0 bg-black/75 backdrop-blur-sm'
        onClick={onClose}
        aria-label='Close insert prompt picker'
      />

      <div
        ref={containerRef}
        className='relative flex h-[min(82vh,840px)] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[0_30px_100px_rgba(0,0,0,0.4)]'
      >
        <div className='flex items-center justify-between gap-4 border-b border-[var(--app-border)] bg-[var(--app-surface-2)] px-6 py-5'>
          <div className='flex items-center gap-3'>
            <div className='flex h-11 w-11 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] text-[var(--app-accent)]'>
              <NotebookPen size={18} />
            </div>
            <div>
              <p className='text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--app-text-subtle)]'>
                Insert prompt
              </p>
              <h2 className='mt-1 text-2xl font-semibold tracking-tight text-[var(--app-text-strong)]'>
                Pick from library
              </h2>
            </div>
          </div>
          <button
            type='button'
            onClick={onClose}
            aria-label='Close insert prompt picker'
            className='flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-border)] text-[var(--app-text-subtle)] transition-colors hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
          >
            <X size={18} />
          </button>
        </div>

        <div className='border-b border-[var(--app-border)] bg-[var(--app-surface)] px-6 py-4'>
          <label className='flex items-center gap-3 rounded-full border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface-2)_82%,transparent)] px-4 py-3'>
            <Search size={16} className='text-[var(--app-text-subtle)]' />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='Search prompts by title or content'
              className='w-full bg-transparent text-sm text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-subtle)]'
            />
          </label>
        </div>

        <div className='custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-6'>
          {loading ? (
            <div className='flex h-full items-center justify-center text-[var(--app-text-subtle)]'>
              <Loader2 size={20} className='animate-spin' />
            </div>
          ) : error ? (
            <div className='rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300'>
              {error}
            </div>
          ) : filteredPrompts.length === 0 ? (
            <div className='rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface-2)_82%,transparent)] px-6 py-10 text-center'>
              <p className='text-sm text-[var(--app-text-muted)]'>No prompts match this search.</p>
            </div>
          ) : (
            <div className='grid gap-3'>
              {filteredPrompts.map((prompt) => (
                <button
                  key={prompt.id}
                  type='button'
                  onClick={() => onSelect(prompt)}
                  className='rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface-2)_80%,transparent)] p-4 text-left transition-colors duration-[180ms] hover:border-[var(--app-border-strong)] hover:bg-[color-mix(in_srgb,var(--app-surface-3)_82%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
                >
                  <h3 className='text-base font-semibold tracking-tight text-[var(--app-text-strong)]'>
                    {prompt.title}
                  </h3>
                  <p className='mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-[var(--app-text-muted)]'>
                    {prompt.content}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InsertPromptOverlay;
