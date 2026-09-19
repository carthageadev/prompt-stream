import React from 'react';
import {
  ArrowLeft,
  Check,
  ClipboardCopy,
  ImagePlus,
  Loader2,
  NotebookPen,
  Plus,
  RefreshCcw,
  Trash2,
} from 'lucide-react';
import { AttachmentRecord, PromptSnapshotRecord, SessionsDbError } from '../../lib/sessionsDb';
import { useSession } from '../../hooks/useSessions';
import { navigateTo } from '../../navigation';
import AttachmentsPanel from './AttachmentsPanel';
import DropZone from './DropZone';
import EmptyState from './EmptyState';
import InsertPromptOverlay from './InsertPromptOverlay';

interface SessionEditorPageProps {
  sessionId: string;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface ToastState {
  id: number;
  message: string;
}

const COLLAPSED_STRIP_HEIGHT = 64;
const EXPANDED_STRIP_HEIGHT = 244;

const getDerivedTitle = (title: string, body: string) => {
  const normalizedTitle = title.trim();
  if (normalizedTitle) return normalizedTitle;
  return (
    body
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? ''
  );
};

const createDownload = (attachment: AttachmentRecord) => {
  const url = URL.createObjectURL(attachment.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = attachment.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const SessionEditorPage: React.FC<SessionEditorPageProps> = ({ sessionId }) => {
  const { session, attachments, loading, error, refresh, update, remove, addAttachment, removeAttachment } = useSession(sessionId);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  const [isPromptPickerOpen, setIsPromptPickerOpen] = React.useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = React.useState(false);
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const [copyingAttachmentId, setCopyingAttachmentId] = React.useState<string | null>(null);
  const [bodyCopied, setBodyCopied] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [isAddingImages, setIsAddingImages] = React.useState(false);
  const [attachmentsExpanded, setAttachmentsExpanded] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const titleTimeoutRef = React.useRef<number | null>(null);
  const bodyTimeoutRef = React.useRef<number | null>(null);
  const dragDepthRef = React.useRef(0);

  React.useEffect(() => {
    if (attachments.length > 0) {
      setAttachmentsExpanded(true);
    }
  }, [attachments.length]);

  const editorBottomPadding = attachmentsExpanded ? EXPANDED_STRIP_HEIGHT : COLLAPSED_STRIP_HEIGHT;

  const pushToast = React.useCallback((message: string) => {
    setToast({ id: Date.now(), message });
  }, []);

  React.useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  React.useEffect(() => {
    if (!session) return;
    setTitle(session.title);
    setBody(session.body);
  }, [session]);

  React.useEffect(() => {
    void body;
    if (!textareaRef.current) return;
    textareaRef.current.style.height = '0px';
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [body]);

  React.useEffect(() => {
    if (attachments.length > 0) {
      setAttachmentsExpanded(true);
    }
  }, [attachments.length]);

  React.useEffect(() => {
    if (isDraggingFiles) {
      setAttachmentsExpanded(true);
    }
  }, [isDraggingFiles]);

  const commitUpdate = React.useCallback(
    async (patch: { title?: string; body?: string }) => {
      try {
        setSaveState('saving');
        await update(patch);
        setSaveState('saved');
      } catch (reason: unknown) {
        const nextMessage =
          reason instanceof SessionsDbError && reason.code === 'quota_exceeded'
            ? 'Storage full. Remove attachments to free space.'
            : 'Unable to save this session.';
        pushToast(nextMessage);
        setSaveState('error');
      }
    },
    [pushToast, update],
  );

  React.useEffect(() => {
    if (saveState !== 'saved') return;
    const timeout = window.setTimeout(() => setSaveState('idle'), 1200);
    return () => window.clearTimeout(timeout);
  }, [saveState]);

  React.useEffect(() => {
    return () => {
      if (titleTimeoutRef.current) window.clearTimeout(titleTimeoutRef.current);
      if (bodyTimeoutRef.current) window.clearTimeout(bodyTimeoutRef.current);
    };
  }, []);

  const scheduleBodySave = React.useCallback(
    (nextBody: string, nextTitle: string) => {
      if (bodyTimeoutRef.current) window.clearTimeout(bodyTimeoutRef.current);
      bodyTimeoutRef.current = window.setTimeout(() => {
        const derivedTitle = getDerivedTitle(nextTitle, nextBody);
        void commitUpdate({ body: nextBody, title: derivedTitle });
      }, 300);
    },
    [commitUpdate],
  );

  const scheduleTitleSave = React.useCallback(
    (nextTitle: string, currentBody: string) => {
      if (titleTimeoutRef.current) window.clearTimeout(titleTimeoutRef.current);
      titleTimeoutRef.current = window.setTimeout(() => {
        const derivedTitle = getDerivedTitle(nextTitle, currentBody);
        void commitUpdate({ title: derivedTitle });
      }, 500);
    },
    [commitUpdate],
  );

  const handleTitleBlur = React.useCallback(() => {
    const derivedTitle = getDerivedTitle(title, body);
    setTitle(derivedTitle);
    if (titleTimeoutRef.current) window.clearTimeout(titleTimeoutRef.current);
    void commitUpdate({ title: derivedTitle });
  }, [body, commitUpdate, title]);

  const appendPromptSnapshot = React.useCallback(
    (prompt: PromptSnapshotRecord) => {
      const marker = `--- [prompt: ${prompt.title}] ---\n${prompt.content}`;
      const nextBody = body.trim() ? `${body.trimEnd()}\n\n${marker}` : marker;
      setBody(nextBody);
      scheduleBodySave(nextBody, title);
      setIsPromptPickerOpen(false);
      pushToast(`Inserted “${prompt.title}” into the session.`);
    },
    [body, pushToast, scheduleBodySave, title],
  );

  const handleFiles = React.useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((file) => file.type.startsWith('image/'));
      if (imageFiles.length === 0) return;

      setIsAddingImages(true);

      try {
        await Promise.all(imageFiles.map((file) => addAttachment(file, file.name)));
        pushToast(`${imageFiles.length} image${imageFiles.length === 1 ? '' : 's'} attached.`);
      } catch (reason: unknown) {
        const nextMessage =
          reason instanceof SessionsDbError && reason.code === 'quota_exceeded'
            ? 'Storage full. Remove attachments to free space.'
            : 'Unable to attach image.';
        pushToast(nextMessage);
      } finally {
        setIsAddingImages(false);
      }
    },
    [addAttachment, pushToast],
  );

  React.useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = Array.from(event.clipboardData?.items ?? []);
      const imageFiles = items
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);

      if (imageFiles.length === 0) return;
      void handleFiles(imageFiles);
    };

    const handleDragEnter = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      dragDepthRef.current += 1;
      setIsDraggingFiles(true);
    };

    const handleDragLeave = () => {
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDraggingFiles(false);
      }
    };

    const handleDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
    };

    const handleDrop = (event: DragEvent) => {
      const transferFiles = Array.from(event.dataTransfer?.files ?? []);
      const imageFiles = transferFiles.filter((file) => file.type.startsWith('image/'));
      dragDepthRef.current = 0;
      setIsDraggingFiles(false);
      if (imageFiles.length === 0) return;
      event.preventDefault();
      void handleFiles(imageFiles);
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleFiles]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPromptPickerOpen(false);
        setConfirmDelete(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const copyBody = React.useCallback(async () => {
    await navigator.clipboard.writeText(body);
    setBodyCopied(true);
    pushToast('Session body copied.');
    window.setTimeout(() => setBodyCopied(false), 1200);
  }, [body, pushToast]);

  const copyAttachment = React.useCallback(
    async (attachment: AttachmentRecord) => {
      try {
        if (!('clipboard' in navigator) || typeof ClipboardItem === 'undefined') {
          createDownload(attachment);
          pushToast('Clipboard unavailable. Download started instead.');
          return;
        }

        await navigator.clipboard.write([
          new ClipboardItem({
            [attachment.blob.type]: attachment.blob,
          }),
        ]);
        setCopyingAttachmentId(attachment.id);
        window.setTimeout(() => setCopyingAttachmentId(null), 1200);
        pushToast('Image copied to clipboard.');
      } catch {
        createDownload(attachment);
        pushToast('Copy unsupported in this browser; download started instead.');
      }
    },
    [pushToast],
  );

  const downloadAttachment = React.useCallback((attachment: AttachmentRecord) => {
    createDownload(attachment);
  }, []);

  const handleRemoveAttachment = React.useCallback(
    async (attachmentId: string) => {
      await removeAttachment(attachmentId);
      pushToast('Attachment removed.');
    },
    [pushToast, removeAttachment],
  );

  const handleDeleteSession = React.useCallback(async () => {
    await remove();
    navigateTo('/sessions');
  }, [remove]);

  if (error) {
    return (
      <div className='min-h-screen bg-[var(--app-bg)] px-4 py-10 text-[var(--app-text)] sm:px-6'>
        <div className='mx-auto max-w-4xl'>
          <EmptyState
            icon={RefreshCcw}
            title='Local storage is unavailable'
            description='The session workspace could not be loaded. Retry after checking your browser storage settings.'
            action={
              <div className='flex flex-wrap items-center justify-center gap-3'>
                <button
                  type='button'
                  onClick={() => navigateTo('/sessions')}
                  className='inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)] transition-colors hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
                >
                  <ArrowLeft size={14} />
                  Back to sessions
                </button>
                <button
                  type='button'
                  onClick={() => void refresh()}
                  className='inline-flex items-center gap-2 rounded-full bg-[var(--app-accent)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-inverse)] transition-colors hover:bg-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
                >
                  <RefreshCcw size={14} />
                  Retry
                </button>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-[var(--app-text-subtle)]'>
        <Loader2 size={22} className='animate-spin' />
      </div>
    );
  }

  if (!session) {
    return (
      <div className='min-h-screen bg-[var(--app-bg)] px-4 py-10 text-[var(--app-text)] sm:px-6'>
        <div className='mx-auto max-w-4xl'>
          <EmptyState
            icon={NotebookPen}
            title='This session no longer exists'
            description='It may have been deleted from local storage. Create a new draft or return to the sessions list.'
            action={
              <div className='flex flex-wrap items-center justify-center gap-3'>
                <button
                  type='button'
                  onClick={() => navigateTo('/sessions')}
                  className='inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)] transition-colors hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
                >
                  <ArrowLeft size={14} />
                  Back to sessions
                </button>
                <button
                  type='button'
                  onClick={() => navigateTo('/sessions')}
                  className='inline-flex items-center gap-2 rounded-full bg-[var(--app-accent)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-inverse)] transition-colors hover:bg-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
                >
                  <Plus size={14} />
                  Open list
                </button>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]'>
      <DropZone active={isDraggingFiles} />

      <div className='mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8'>
        <header className='sticky top-4 z-30 rounded-[28px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-bg)_82%,transparent)] px-4 py-4 backdrop-blur-md shadow-[0_14px_40px_rgba(0,0,0,0.12)] sm:px-6'>
          <div className='flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between'>
            <div className='min-w-0'>
              <div className='flex items-center gap-3'>
                <button
                  type='button'
                  onClick={() => navigateTo('/sessions')}
                  className='inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface-2)_78%,transparent)] px-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)] transition-colors hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
                >
                  <ArrowLeft size={14} />
                  Sessions
                </button>
                <button
                  type='button'
                  onClick={() => navigateTo('/')}
                  className='hidden h-11 items-center justify-center rounded-full border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface-2)_78%,transparent)] px-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)] transition-colors hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-strong)] sm:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
                >
                  Back to app
                </button>
              </div>

              <div className='mt-4'>
                <p className='text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--app-text-subtle)]'>
                  Session draft
                </p>
                <input
                  value={title}
                  onChange={(event) => {
                    const nextTitle = event.target.value;
                    setTitle(nextTitle);
                    scheduleTitleSave(nextTitle, body);
                  }}
                  onBlur={handleTitleBlur}
                  placeholder='Untitled session'
                  className='mt-2 w-full bg-transparent text-3xl font-semibold tracking-tight text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-text-subtle)] sm:text-4xl'
                />
                <div className='mt-2.5 flex items-center gap-2 text-xs text-[var(--app-text-subtle)]'>
                  {saveState === 'saving' ? <Loader2 size={14} className='animate-spin' /> : saveState === 'saved' ? <Check size={14} /> : null}
                  <span>
                    {saveState === 'saving'
                      ? 'Saving locally...'
                      : saveState === 'saved'
                        ? 'Saved locally'
                        : saveState === 'error'
                          ? 'Save failed'
                          : 'Stored in IndexedDB on this device'}
                  </span>
                </div>
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-2.5'>
              <button
                type='button'
                onClick={copyBody}
                className='inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface-2)_78%,transparent)] px-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)] transition-colors hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
              >
                {bodyCopied ? <Check size={14} /> : <ClipboardCopy size={14} />}
                Copy body
              </button>
              <button
                type='button'
                onClick={() => fileInputRef.current?.click()}
                className='inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface-2)_78%,transparent)] px-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)] transition-colors hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
              >
                {isAddingImages ? <Loader2 size={14} className='animate-spin' /> : <ImagePlus size={14} />}
                Add image
              </button>
              <button
                type='button'
                onClick={() => setIsPromptPickerOpen(true)}
                className='inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface-2)_78%,transparent)] px-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)] transition-colors hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
              >
                <NotebookPen size={14} />
                Insert prompt
              </button>

              {confirmDelete ? (
                <div className='flex flex-wrap items-center gap-2 text-xs text-[var(--app-text-muted)]'>
                  <span>Delete permanently?</span>
                  <button
                    type='button'
                    onClick={() => void handleDeleteSession()}
                    className='inline-flex h-11 items-center justify-center gap-2 rounded-full border border-red-500/60 px-4 text-xs font-semibold uppercase tracking-[0.18em] text-red-400 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 motion-reduce:transition-none'
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                  <button
                    type='button'
                    onClick={() => setConfirmDelete(false)}
                    className='inline-flex h-11 items-center justify-center rounded-full border border-[var(--app-border)] px-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)] transition-colors hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] motion-reduce:transition-none'
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type='button'
                  onClick={() => setConfirmDelete(true)}
                  className='inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--app-border)] px-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)] transition-colors hover:border-red-500/60 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 motion-reduce:transition-none'
                >
                  <Trash2 size={14} />
                  Delete session
                </button>
              )}
            </div>
          </div>
        </header>

        <input
          ref={fileInputRef}
          type='file'
          accept='image/*'
          multiple
          className='hidden'
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            void handleFiles(files);
            event.target.value = '';
          }}
        />

        <main className='pt-7' style={{ paddingBottom: `${editorBottomPadding}px` }}>
          <section className='rounded-[28px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface)_86%,transparent)] shadow-[0_18px_56px_rgba(0,0,0,0.12)] backdrop-blur-sm'>
            <div className='border-b border-[color-mix(in_srgb,var(--app-border)_72%,transparent)] px-5 py-4 sm:px-6'>
              <p className='text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--app-text-subtle)]'>
                Body
              </p>
              <h2 className='mt-2 text-base font-semibold tracking-tight text-[var(--app-text-strong)] sm:text-lg'>
                Draft plan, notes, or instructions
              </h2>
            </div>
            <div className='px-5 py-5 sm:px-6'>
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(event) => {
                  const nextBody = event.target.value;
                  setBody(nextBody);
                  scheduleBodySave(nextBody, title);
                }}
                placeholder='Write the session body here. Paste plain text normally, then drop screenshots anywhere on the page.'
                spellCheck={false}
                className='custom-scrollbar min-h-[56vh] w-full resize-none overflow-hidden bg-transparent text-[15px] leading-7 text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-subtle)] sm:text-base'
              />
            </div>
          </section>
        </main>
      </div>

      <AttachmentsPanel
        attachments={attachments}
        onAddClick={() => fileInputRef.current?.click()}
        onCopy={copyAttachment}
        onDownload={downloadAttachment}
        onRemove={(attachmentId) => void handleRemoveAttachment(attachmentId)}
        copyingAttachmentId={copyingAttachmentId}
        dragActive={isDraggingFiles}
        expanded={attachmentsExpanded}
        onExpandedChange={setAttachmentsExpanded}
      />

      {toast ? (
        <div className='pointer-events-none fixed bottom-[calc(56px+1.25rem)] left-1/2 z-[100] -translate-x-1/2 sm:bottom-[calc(56px+1.5rem)]'>
          <div className='rounded-full border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface)_92%,transparent)] px-4 py-2 text-sm text-[var(--app-text)] shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-md'>
            {toast.message}
          </div>
        </div>
      ) : null}

      <InsertPromptOverlay
        isOpen={isPromptPickerOpen}
        onClose={() => setIsPromptPickerOpen(false)}
        onSelect={appendPromptSnapshot}
      />
    </div>
  );
};

export default SessionEditorPage;
