import React from 'react';
import {
  addAttachment as addDbAttachment,
  AttachmentRecord,
  createSession,
  deleteSession as deleteDbSession,
  getSession,
  getStoreVersion,
  listAttachments,
  listSessions,
  removeAttachment as removeDbAttachment,
  SessionRecord,
  subscribe,
  updateSession as updateDbSession,
} from '../lib/sessionsDb';

interface SessionListState {
  sessions: SessionRecord[];
  loading: boolean;
  error: Error | null;
}

interface SessionDetailState {
  session: SessionRecord | undefined;
  attachments: AttachmentRecord[];
  loading: boolean;
  error: Error | null;
}

const getSnapshot = () => getStoreVersion();

export const useSessionList = () => {
  const revision = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [state, setState] = React.useState<SessionListState>({
    sessions: [],
    loading: true,
    error: null,
  });

  const refresh = React.useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));

    try {
      const sessions = await listSessions();
      setState({ sessions, loading: false, error: null });
    } catch (error) {
      setState({
        sessions: [],
        loading: false,
        error: error instanceof Error ? error : new Error('Unable to load sessions.'),
      });
    }
  }, []);

  React.useEffect(() => {
    void revision;
    void refresh();
  }, [refresh, revision]);

  return {
    sessions: state.sessions,
    loading: state.loading,
    error: state.error,
    refresh,
    createSession,
  };
};

export const useSession = (id: string) => {
  const revision = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [state, setState] = React.useState<SessionDetailState>({
    session: undefined,
    attachments: [],
    loading: true,
    error: null,
  });

  const refresh = React.useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));

    try {
      const [session, attachments] = await Promise.all([
        getSession(id),
        listAttachments(id),
      ]);
      setState({ session, attachments, loading: false, error: null });
    } catch (error) {
      setState({
        session: undefined,
        attachments: [],
        loading: false,
        error: error instanceof Error ? error : new Error('Unable to load session.'),
      });
    }
  }, [id]);

  React.useEffect(() => {
    void revision;
    void refresh();
  }, [refresh, revision]);

  const update = React.useCallback(
    (patch: Partial<Omit<SessionRecord, 'id' | 'createdAt'>>) => updateDbSession(id, patch),
    [id],
  );

  const remove = React.useCallback(() => deleteDbSession(id), [id]);

  const addAttachment = React.useCallback(
    (file: File | Blob, filename?: string) => addDbAttachment(id, file, filename),
    [id],
  );

  const removeAttachment = React.useCallback(
    (attachmentId: string) => removeDbAttachment(attachmentId),
    [],
  );

  const reorderAttachments = React.useCallback(async () => undefined, []);

  return {
    session: state.session,
    attachments: state.attachments,
    loading: state.loading,
    error: state.error,
    refresh,
    update,
    remove,
    addAttachment,
    removeAttachment,
    reorderAttachments,
  };
};
