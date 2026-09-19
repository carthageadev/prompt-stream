import React from 'react';
import { ChevronUp, ImagePlus } from 'lucide-react';
import { AttachmentRecord } from '../../lib/sessionsDb';
import AttachmentCard from './AttachmentCard';

interface AttachmentsPanelProps {
  attachments: AttachmentRecord[];
  onAddClick: () => void;
  onCopy: (attachment: AttachmentRecord) => void;
  onDownload: (attachment: AttachmentRecord) => void;
  onRemove: (attachmentId: string) => void;
  copyingAttachmentId: string | null;
  dragActive?: boolean;
  expanded: boolean;
  onExpandedChange: (nextExpanded: boolean) => void;
}

const AttachmentsPanel: React.FC<AttachmentsPanelProps> = ({
  attachments,
  onAddClick,
  onCopy,
  onDownload,
  onRemove,
  copyingAttachmentId,
  dragActive = false,
  expanded,
  onExpandedChange,
}) => {
  const label = attachments.length === 0 ? 'Attachments' : `${attachments.length} attachment${attachments.length === 1 ? '' : 's'}`;

  return (
    <section
      className={`fixed inset-x-3 bottom-3 z-40 overflow-hidden rounded-[24px] border bg-[color-mix(in_srgb,var(--app-surface)_88%,transparent)] backdrop-blur-md transition-[max-height,border-color,background-color,transform] duration-[220ms] ease-out sm:inset-x-4 lg:left-6 lg:right-6 ${
        expanded ? 'max-h-[232px]' : 'max-h-[52px]'
      } ${
        dragActive
          ? 'border-[color-mix(in_srgb,var(--app-accent)_48%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-surface)_80%,var(--app-accent)_6%)]'
          : 'border-[var(--app-border)]'
      } motion-reduce:transition-none`}
      aria-label='Session attachments'
    >
      <div className='flex min-h-[52px] items-center gap-2 px-2.5 sm:px-3'>
        <button
          type='button'
          onClick={() => onExpandedChange(!expanded)}
          className='flex min-h-[44px] min-w-0 flex-1 items-center gap-3 rounded-full px-3 text-left text-[var(--app-text)] outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--app-surface-2)_72%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
          aria-expanded={expanded}
          aria-controls='session-attachments-strip-body'
        >
          <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] text-[var(--app-accent)]'>
            <ImagePlus size={15} />
          </span>
          <span className='min-w-0'>
            <span className='block truncate text-sm font-medium text-[var(--app-text-strong)]'>
              {label}
            </span>
          </span>
          {attachments.length > 0 ? (
            <span className='inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-2 text-[11px] font-semibold text-[var(--app-accent)]'>
              {attachments.length}
            </span>
          ) : null}
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--app-text-subtle)] transition-transform duration-[180ms] motion-reduce:transition-none ${
              expanded ? 'rotate-180 text-[var(--app-accent)]' : ''
            }`}
          >
            <ChevronUp size={16} />
          </span>
        </button>

        <button
          type='button'
          onClick={onAddClick}
          className='inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--app-accent)_20%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] px-3.5 text-xs font-semibold text-[var(--app-accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
        >
          <ImagePlus size={14} />
          <span className='hidden sm:inline'>Add image</span>
        </button>
      </div>

      <div
        id='session-attachments-strip-body'
        className={`px-3 pb-3 pt-1 transition-[opacity,transform] duration-[180ms] ease-out motion-reduce:transition-none ${
          expanded ? 'opacity-100 translate-y-0' : 'pointer-events-none -translate-y-1 opacity-0'
        }`}
      >
        {attachments.length === 0 ? (
          <div className='flex h-[84px] items-center justify-center rounded-[18px] border border-dashed border-[color-mix(in_srgb,var(--app-accent)_20%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-surface-2)_70%,transparent)] px-4 text-center text-sm text-[var(--app-text-muted)]'>
            Paste screenshots, drop images anywhere here, or use add image.
          </div>
        ) : (
          <div className='mask-gradient -mx-1 overflow-x-auto px-1 pb-1 pt-1 custom-scrollbar no-scrollbar'>
            <div className='flex gap-3 snap-x snap-proximity'>
              {attachments.map((attachment) => (
                <div key={attachment.id} className='w-[148px] shrink-0 snap-start sm:w-[160px]'>
                  <AttachmentCard
                    attachment={attachment}
                    onCopy={onCopy}
                    onDownload={onDownload}
                    onRemove={onRemove}
                    isCopying={copyingAttachmentId === attachment.id}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default AttachmentsPanel;
