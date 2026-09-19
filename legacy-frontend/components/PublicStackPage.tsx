import React from 'react';
import { Copy, Link2, Loader2, Waves } from 'lucide-react';
import * as api from '../services/api';
import { PromptBlockData, PublicStackPayload } from '../types';
import { getStackThemeStyle, getTagColorClasses } from '../constants';
import { navigateTo } from '../navigation';

const PublicPromptCard: React.FC<{ prompt: PromptBlockData }> = ({ prompt }) => {
  const [copied, setCopied] = React.useState(false);

  return (
    <article className='rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.2)]'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <div className='flex flex-wrap gap-2 mb-3'>
            {prompt.tags.map((tag) => (
              <span
                key={tag}
                className={`text-[9px] px-2 py-1 rounded-full border font-bold uppercase tracking-[0.22em] ${getTagColorClasses(
                  tag,
                  new Map(),
                )}`}
              >
                {tag}
              </span>
            ))}
          </div>
          <h2 className='text-xl font-semibold tracking-tight text-[var(--app-text-strong)]'>
            {prompt.title}
          </h2>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(prompt.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className='shrink-0 h-10 w-10 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:border-[var(--app-border-strong)] transition-colors flex items-center justify-center'
          title='Copy prompt'
        >
          <Copy size={16} />
        </button>
      </div>
      <pre className='mt-5 whitespace-pre-wrap break-words text-sm leading-7 font-mono text-[var(--app-text)] opacity-90'>
        {prompt.content}
      </pre>
      {copied && (
        <p className='mt-3 text-[10px] uppercase tracking-[0.24em] text-[var(--app-text-subtle)]'>
          Copied
        </p>
      )}
    </article>
  );
};

interface PublicStackPageProps {
  slug: string;
}

const PublicStackPage: React.FC<PublicStackPageProps> = ({ slug }) => {
  const [payload, setPayload] = React.useState<PublicStackPayload | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    document.title = `Stack | ${slug}`;
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.getPublicStack(slug);
        setPayload(data);
        document.title = `${data.stack.name} | prompts.achraf.tn`;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stack');
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [slug]);

  const themeStyle = getStackThemeStyle(payload?.stack.themeKey);

  return (
    <div
      className='min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]'
      style={themeStyle}
    >
      <div className='absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_36%)]' />
      <main className='relative z-10 mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-12'>
        <header className='flex flex-wrap items-center justify-between gap-4 border-b border-[var(--app-border)] pb-6'>
          <button
            onClick={() => navigateTo('/')}
            className='flex items-center gap-3 text-[var(--app-text-strong)]'
          >
            <Waves size={24} />
            <span className='font-brand text-lg tracking-tight'>prompts.achraf.tn</span>
          </button>
          <div className='flex items-center gap-3'>
            <button
              onClick={() => navigator.clipboard.writeText(window.location.href)}
              className='inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] transition-colors'
            >
              <Link2 size={14} />
              Copy Link
            </button>
          </div>
        </header>

        {isLoading && (
          <div className='flex min-h-[50vh] items-center justify-center'>
            <Loader2 className='animate-spin text-[var(--app-text-subtle)]' />
          </div>
        )}

        {!isLoading && error && (
          <div className='rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-8 mt-12'>
            <h1 className='text-2xl font-semibold text-[var(--app-text-strong)]'>
              Stack unavailable
            </h1>
            <p className='mt-3 text-sm text-[var(--app-text-muted)]'>{error}</p>
          </div>
        )}

        {!isLoading && payload && (
          <>
            <section className='py-10'>
              <div className='flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between'>
                <div className='max-w-3xl'>
                  <p className='text-[10px] uppercase tracking-[0.28em] text-[var(--app-text-subtle)] mb-4'>
                    Published Stack
                  </p>
                  <h1 className='text-4xl sm:text-5xl lg:text-6xl font-brand font-semibold tracking-tight text-[var(--app-text-strong)]'>
                    {payload.stack.name}
                  </h1>
                  {payload.stack.description && (
                    <p className='mt-5 text-base leading-8 text-[var(--app-text-muted)]'>
                      {payload.stack.description}
                    </p>
                  )}
                </div>
                <div className='rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-4'>
                  <p className='text-[10px] uppercase tracking-[0.22em] text-[var(--app-text-subtle)]'>
                    Theme
                  </p>
                  <p className='mt-2 text-sm font-medium text-[var(--app-text-strong)]'>
                    {payload.stack.themeKey || 'midnight-grid'}
                  </p>
                </div>
              </div>
            </section>

            <section className='grid gap-6 lg:grid-cols-2 pb-20'>
              {payload.prompts.map((prompt) => (
                <PublicPromptCard key={prompt.id} prompt={prompt} />
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default PublicStackPage;
