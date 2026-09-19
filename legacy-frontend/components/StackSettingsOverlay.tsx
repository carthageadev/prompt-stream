import React from 'react';
import { ExternalLink, Globe2, Link2, Palette, Save, X } from 'lucide-react';
import gsap from 'gsap';
import { STACK_THEMES } from '../constants';
import { Stack, StackThemeKey } from '../types';

interface StackSettingsOverlayProps {
  isOpen: boolean;
  stack: Stack | null;
  onClose: () => void;
  onSave: (updates: Partial<Stack>) => Promise<void> | void;
  onPublish: (updates: { isPublished: boolean; slug?: string }) => Promise<void> | void;
}

const StackSettingsOverlay: React.FC<StackSettingsOverlayProps> = ({
  isOpen,
  stack,
  onClose,
  onSave,
  onPublish,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const backdropRef = React.useRef<HTMLDivElement>(null);
  const [draft, setDraft] = React.useState<Partial<Stack>>({});

  React.useEffect(() => {
    if (stack) {
      setDraft({
        name: stack.name,
        slug: stack.slug,
        description: stack.description,
        themeKey: stack.themeKey,
        coverImage: stack.coverImage,
        isPublished: stack.isPublished,
      });
    }
  }, [stack]);

  React.useEffect(() => {
    if (isOpen) {
      gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 12, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: 'power3.out' },
      );
    }
  }, [isOpen]);

  if (!isOpen || !stack) return null;

  return (
    <div className='fixed inset-0 z-[75] flex items-center justify-center p-4'>
      <div
        ref={backdropRef}
        className='absolute inset-0 bg-black/75 backdrop-blur-sm'
        onClick={onClose}
      />
      <div
        ref={containerRef}
        className='relative w-full max-w-3xl rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl overflow-hidden'
      >
        <div className='flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-surface-2)] px-6 py-5'>
          <div>
            <p className='text-[10px] uppercase tracking-[0.24em] text-[var(--app-text-subtle)]'>
              Active Stack
            </p>
            <h2 className='mt-2 text-2xl font-brand font-semibold tracking-tight text-[var(--app-text-strong)]'>
              Stack Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className='rounded-full border border-[var(--app-border)] p-2 text-[var(--app-text-subtle)]'
          >
            <X size={18} />
          </button>
        </div>

        <div className='grid gap-6 p-6 lg:grid-cols-[1.1fr,0.9fr]'>
          <div className='space-y-4'>
            <label className='block'>
              <span className='text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]'>
                Name
              </span>
              <input
                value={draft.name || ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                className='mt-2 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-3 text-sm outline-none'
              />
            </label>
            <label className='block'>
              <span className='text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]'>
                Public slug
              </span>
              <input
                value={draft.slug || ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, slug: e.target.value }))}
                className='mt-2 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-3 text-sm outline-none'
              />
            </label>
            <label className='block'>
              <span className='text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]'>
                Description
              </span>
              <textarea
                value={draft.description || ''}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={5}
                className='mt-2 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-3 text-sm leading-7 outline-none resize-none'
              />
            </label>
            <label className='block'>
              <span className='text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]'>
                Cover image URL
              </span>
              <input
                value={draft.coverImage || ''}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, coverImage: e.target.value }))
                }
                className='mt-2 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-3 text-sm outline-none'
              />
            </label>
          </div>

          <div className='space-y-4'>
            <div className='rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-4'>
              <div className='flex items-center gap-2'>
                <Palette size={16} className='text-[var(--app-text-subtle)]' />
                <span className='text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]'>
                  Theme
                </span>
              </div>
              <div className='mt-4 grid gap-3'>
                {Object.entries(STACK_THEMES).map(([key, theme]) => (
                  <button
                    key={key}
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, themeKey: key as StackThemeKey }))
                    }
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      draft.themeKey === key
                        ? 'border-[var(--app-border-strong)] bg-[var(--app-surface)]'
                        : 'border-[var(--app-border)] bg-[var(--app-surface)]/60'
                    }`}
                  >
                    <p className='text-sm font-semibold text-[var(--app-text-strong)]'>
                      {theme.label}
                    </p>
                    <p className='mt-1 text-xs leading-6 text-[var(--app-text-muted)]'>
                      {theme.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className='rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-4'>
              <div className='flex items-center gap-2'>
                <Globe2 size={16} className='text-[var(--app-text-subtle)]' />
                <span className='text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-subtle)]'>
                  Publishing
                </span>
              </div>
              <p className='mt-3 text-sm leading-7 text-[var(--app-text-muted)]'>
                Public stacks get their own dedicated URL and theme.
              </p>
              {draft.slug && (
                <a
                  href={`/s/${draft.slug}`}
                  target='_blank'
                  rel='noreferrer'
                  className='mt-3 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--app-text-subtle)]'
                >
                  <Link2 size={14} />
                  /s/{draft.slug}
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className='flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border)] bg-[var(--app-surface-2)] px-6 py-5'>
          <button
            onClick={() =>
              onPublish({
                isPublished: !(draft.isPublished ?? false),
                slug: draft.slug,
              })
            }
            className='rounded-full border border-[var(--app-border-strong)] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--app-text-strong)]'
          >
            {(draft.isPublished ?? false) ? 'Unpublish' : 'Publish Stack'}
          </button>
          <button
            onClick={() => onSave(draft)}
            className='inline-flex items-center gap-2 rounded-full bg-[var(--app-accent)] px-5 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--app-inverse)]'
          >
            <Save size={14} />
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default StackSettingsOverlay;
