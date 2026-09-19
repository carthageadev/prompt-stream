import React from 'react';
import { Loader2, NotebookPen, Plus, RefreshCcw, Search } from 'lucide-react';
import { createSession, deleteSession, listAttachments } from '../../lib/sessionsDb';
import { useSessionList } from '../../hooks/useSessions';
import { navigateTo } from '../../navigation';
import EmptyState from './EmptyState';
import SessionCard from './SessionCard';

const SessionsListPage: React.FC = () => {
  const { sessions, loading, error, refresh } = useSessionList();
  const [query, setQuery] = React.useState('');
  const [attachmentCounts, setAttachmentCounts] = React.useState<Record<string, number>>({});
  const [creating, setCreating] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let cancelled = false;

    void Promise.all(
      sessions.map(async (session) => {
        const attachments = await listAttachments(session.id);
        return [session.id, attachments.length] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      setAttachmentCounts(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [sessions]);

  const handleCreateSession = React.useCallback(async () => {
    if (creating) return;
    setCreating(true);

    try {
      const session = await createSession();
      navigateTo(`/sessions/${session.id}`);
    } finally {
      setCreating(false);
    }
  }, [creating]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }

      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        void handleCreateSession();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCreateSession]);

  const handleDeleteSession = React.useCallback(async (sessionId: string) => {
    setDeletingId(sessionId);

    try {
      await deleteSession(sessionId);
    } finally {
      setDeletingId(null);
    }
  }, []);

  const filteredSessions = sessions.filter((session) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return (
      session.title.toLowerCase().includes(normalized) ||
      session.body.toLowerCase().includes(normalized)
    );
  });

  return (
    <div className='min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]'>
      <div className='mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8'>
        <header className='sticky top-4 z-20 rounded-[28px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-bg)_82%,transparent)] px-4 py-4 backdrop-blur-md shadow-[0_14px_40px_rgba(0,0,0,0.12)] sm:px-6'>
          <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
            <div className='flex items-center gap-3'>
              <div className='flex h-11 w-11 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] text-[var(--app-accent)]'>
                <NotebookPen size={18} />
              </div>
              <div>
                <p className='text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--app-text-subtle)]'>
                  Local workspace
                </p>
                <h1 className='mt-1 text-2xl font-semibold tracking-tight text-[var(--app-text-strong)]'>
                  Sessions
                </h1>
              </div>
            </div>

            <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
              <label className='flex h-11 items-center gap-3 rounded-full border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface-2)_78%,transparent)] px-4'>
                <Search size={16} className='text-[var(--app-text-subtle)]' />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder='Search sessions'
                  className='w-full bg-transparent text-sm text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-subtle)] sm:w-64'
                />
              </label>

              <button
                type='button'
                onClick={() => navigateTo('/')}
                className='inline-flex h-11 items-center justify-center rounded-full border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface-2)_78%,transparent)] px-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)] transition-colors hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
              >
                Back to app
              </button>

              <button
                type='button'
                onClick={() => void handleCreateSession()}
                className='inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--app-accent)] px-5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-inverse)] transition-colors hover:bg-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
              >
                {creating ? <Loader2 size={14} className='animate-spin' /> : <Plus size={14} />}
                New session
              </button>
            </div>
          </div>
        </header>

        <main className='pt-8'>
          {error ? (
            <EmptyState
              icon={RefreshCcw}
              title='Local storage is unavailable'
              description='The sessions database could not be opened. Retry after checking your browser storage settings.'
              action={
                <button
                  type='button'
                  onClick={() => void refresh()}
                  className='inline-flex items-center gap-2 rounded-full bg-[var(--app-accent)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-inverse)] transition-colors hover:bg-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
                >
                  <RefreshCcw size={14} />
                  Retry
                </button>
              }
            />
          ) : loading ? (
            <div className='flex min-h-[40vh] items-center justify-center text-[var(--app-text-subtle)]'>
              <Loader2 size={22} className='animate-spin' />
            </div>
          ) : filteredSessions.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title={sessions.length === 0 ? 'Start your first session' : 'No sessions match this search'}
              description={
                sessions.length === 0
                  ? 'Create a local draft for plans, screenshots, and prompt snapshots. Everything stays in IndexedDB on this device.'
                  : 'Try a different keyword or create a fresh draft.'
              }
              action={
                <button
                  type='button'
                  onClick={() => void handleCreateSession()}
                  className='inline-flex items-center gap-2 rounded-full bg-[var(--app-accent)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-inverse)] transition-colors hover:bg-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
                >
                  <Plus size={14} />
                  New session
                </button>
              }
            />
          ) : (
            <div className='grid gap-4 lg:grid-cols-2 xl:grid-cols-3'>
              {filteredSessions.map((session) => (
                <div
                  key={session.id}
                  className={deletingId === session.id ? 'pointer-events-none opacity-60' : ''}
                >
                  <SessionCard
                    session={session}
                    attachmentCount={attachmentCounts[session.id] ?? 0}
                    onOpen={(sessionId) => navigateTo(`/sessions/${sessionId}`)}
                    onDelete={handleDeleteSession}
                  />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default SessionsListPage;
