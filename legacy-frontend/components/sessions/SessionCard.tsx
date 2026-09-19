import React from 'react';
import { Clock3, ImagePlus, Trash2 } from 'lucide-react';
import { SessionRecord } from '../../lib/sessionsDb';

interface SessionCardProps {
  session: SessionRecord;
  attachmentCount: number;
  onOpen: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const formatRelativeTime = (timestamp: number) => {
  const diff = timestamp - Date.now();
  const minutes = Math.round(diff / 60000);

  if (Math.abs(minutes) < 60) {
    return relativeFormatter.format(minutes, 'minute');
  }

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return relativeFormatter.format(hours, 'hour');
  }

  const days = Math.round(hours / 24);
  return relativeFormatter.format(days, 'day');
};

const deriveTitle = (session: SessionRecord) => {
  if (session.title.trim()) return session.title.trim();
  const firstLine = session.body
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine || 'Untitled session';
};

const deriveSnippet = (session: SessionRecord) => {
  const text = session.body.replace(/\s+/g, ' ').trim();
  return text || 'Empty draft';
};

const SessionCard: React.FC<SessionCardProps> = ({
  session,
  attachmentCount,
  onOpen,
  onDelete,
}) => {
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

  return (
    <article className='rounded-[26px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface)_84%,transparent)] p-5 shadow-[0_14px_38px_rgba(0,0,0,0.1)] backdrop-blur-sm transition-colors duration-[180ms] hover:border-[var(--app-border-strong)] hover:bg-[color-mix(in_srgb,var(--app-surface)_92%,transparent)] motion-reduce:transition-none'>
      <button
        type='button'
        onClick={() => onOpen(session.id)}
        className='w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]'
      >
        <div className='flex items-start justify-between gap-4'>
          <div className='min-w-0'>
            <p className='text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--app-text-subtle)]'>
              Session
            </p>
            <h2 className='mt-1.5 truncate text-lg font-semibold tracking-tight text-[var(--app-text-strong)]'>
              {deriveTitle(session)}
            </h2>
          </div>
          <span className='inline-flex rounded-full bg-[color-mix(in_srgb,var(--app-surface-2)_88%,transparent)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)]'>
            Open
          </span>
        </div>

        <p className='mt-3 line-clamp-3 text-sm leading-6 text-[var(--app-text-muted)]'>
          {deriveSnippet(session)}
        </p>
      </button>

      <div className='mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[color-mix(in_srgb,var(--app-border)_72%,transparent)] pt-3.5'>
        <div className='flex flex-wrap items-center gap-3 text-[11px] text-[var(--app-text-subtle)]'>
          <span className='inline-flex items-center gap-1.5'>
            <Clock3 size={12} />
            {formatRelativeTime(session.updatedAt)}
          </span>
          <span className='inline-flex items-center gap-1.5'>
            <ImagePlus size={12} />
            {attachmentCount} image{attachmentCount === 1 ? '' : 's'}
          </span>
        </div>

        {confirmingDelete ? (
          <div className='flex items-center gap-2 text-[11px] text-[var(--app-text-muted)]'>
            <span>Delete?</span>
            <button
              type='button'
              onClick={() => onDelete(session.id)}
              className='rounded-full border border-red-500/40 px-3 py-1 font-semibold uppercase tracking-[0.16em] text-red-400 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 motion-reduce:transition-none'
            >
              Delete
            </button>
            <button
              type='button'
              onClick={() => setConfirmingDelete(false)}
              className='rounded-full border border-[var(--app-border)] px-3 py-1 font-semibold uppercase tracking-[0.16em] text-[var(--app-text-subtle)] transition-colors hover:text-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type='button'
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Delete ${deriveTitle(session)}`}
            className='inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--app-text-subtle)] transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 motion-reduce:transition-none'
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </article>
  );
};

export default SessionCard;
