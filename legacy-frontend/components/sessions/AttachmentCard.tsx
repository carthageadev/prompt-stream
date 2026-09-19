import React from 'react';
import { Check, ClipboardCopy, Download, ImageOff, Trash2 } from 'lucide-react';
import { AttachmentRecord } from '../../lib/sessionsDb';
import useObjectUrl from '../../hooks/useObjectUrl';

interface AttachmentCardProps {
  attachment: AttachmentRecord;
  onCopy: (attachment: AttachmentRecord) => void;
  onDownload: (attachment: AttachmentRecord) => void;
  onRemove: (attachmentId: string) => void;
  isCopying: boolean;
}

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const AttachmentCard: React.FC<AttachmentCardProps> = ({
  attachment,
  onCopy,
  onDownload,
  onRemove,
  isCopying,
}) => {
  const [isBroken, setIsBroken] = React.useState(false);
  const objectUrl = useObjectUrl(attachment.blob);

  return (
    <article className='group overflow-hidden rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface-2)_82%,transparent)] shadow-[0_8px_24px_rgba(0,0,0,0.12)]'>
      <div className='relative aspect-[4/3] overflow-hidden bg-[var(--app-surface-3)]'>
        {objectUrl && !isBroken ? (
          <img
            src={objectUrl}
            alt={attachment.filename}
            className='h-full w-full object-cover'
            loading='lazy'
            decoding='async'
            onError={() => setIsBroken(true)}
          />
        ) : (
          <div className='flex h-full items-center justify-center bg-[color-mix(in_srgb,var(--app-surface-3)_84%,transparent)] px-3 text-center text-[var(--app-text-subtle)]'>
            <div>
              <ImageOff className='mx-auto' size={18} />
              <p className='mt-2 text-[11px] font-medium'>Image unavailable</p>
            </div>
          </div>
        )}

        <div className='session-attachment-actions absolute right-2 top-2 flex items-center gap-1.5'>
          <button
            type='button'
            onClick={() => onCopy(attachment)}
            aria-label={`Copy ${attachment.filename} to clipboard`}
            className='flex h-9 w-9 items-center justify-center rounded-full border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface)_90%,transparent)] text-[var(--app-text)] shadow-[0_8px_24px_rgba(0,0,0,0.16)] transition-colors hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
          >
            {isCopying ? <Check size={14} /> : <ClipboardCopy size={14} />}
          </button>
          <button
            type='button'
            onClick={() => onDownload(attachment)}
            aria-label={`Download ${attachment.filename}`}
            className='flex h-9 w-9 items-center justify-center rounded-full border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface)_90%,transparent)] text-[var(--app-text)] shadow-[0_8px_24px_rgba(0,0,0,0.16)] transition-colors hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
          >
            <Download size={14} />
          </button>
          <button
            type='button'
            onClick={() => onRemove(attachment.id)}
            aria-label={`Remove ${attachment.filename}`}
            className='flex h-9 w-9 items-center justify-center rounded-full border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface)_90%,transparent)] text-[var(--app-text)] shadow-[0_8px_24px_rgba(0,0,0,0.16)] transition-colors hover:border-red-500/60 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 motion-reduce:transition-none'
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className='px-3.5 py-2.5'>
        <p className='truncate text-[13px] font-medium text-[var(--app-text-strong)]'>
          {attachment.filename}
        </p>
        <p className='mt-0.5 text-[11px] text-[var(--app-text-subtle)]'>
          {formatFileSize(attachment.size)}
        </p>
      </div>
    </article>
  );
};

export default AttachmentCard;
