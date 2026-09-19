import { nanoid } from 'nanoid';
import { DBSchema, IDBPDatabase, openDB } from 'idb';
import * as api from '../services/api';

export interface SessionRecord {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface AttachmentRecord {
  id: string;
  sessionId: string;
  blob: Blob;
  mime: string;
  filename: string;
  size: number;
  createdAt: number;
}

export interface PromptSnapshotRecord {
  id: string;
  title: string;
  content: string;
}

export interface SessionsSchema extends DBSchema {
  sessions: {
    key: string;
    value: SessionRecord;
    indexes: {
      byUpdatedAt: number;
    };
  };
  attachments: {
    key: string;
    value: AttachmentRecord;
    indexes: {
      bySession: string;
    };
  };
}

export class SessionsDbError extends Error {
  code: 'open_failed' | 'quota_exceeded' | 'unknown';

  constructor(code: SessionsDbError['code'], message: string) {
    super(message);
    this.name = 'SessionsDbError';
    this.code = code;
  }
}

const DB_NAME = 'prompts-sessions';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<SessionsSchema>> | null = null;
let storeVersion = 0;
const listeners = new Set<() => void>();

const emitChange = () => {
  storeVersion += 1;
  listeners.forEach((listener) => {
    listener();
  });
};

export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getStoreVersion = () => storeVersion;

const toSessionsError = (error: unknown) => {
  if (error instanceof SessionsDbError) return error;

  if (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'UnknownError')
  ) {
    return new SessionsDbError(
      'quota_exceeded',
      'Storage full. Remove attachments to free space.',
    );
  }

  if (
    error instanceof Error &&
    /quota/i.test(error.message)
  ) {
    return new SessionsDbError(
      'quota_exceeded',
      'Storage full. Remove attachments to free space.',
    );
  }

  return new SessionsDbError('unknown', 'Unable to access browser storage.');
};

export const getDb = async (): Promise<IDBPDatabase<SessionsSchema>> => {
  if (!dbPromise) {
    dbPromise = openDB<SessionsSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionsStore = db.createObjectStore('sessions', {
            keyPath: 'id',
          });
          sessionsStore.createIndex('byUpdatedAt', 'updatedAt');
        }

        if (!db.objectStoreNames.contains('attachments')) {
          const attachmentsStore = db.createObjectStore('attachments', {
            keyPath: 'id',
          });
          attachmentsStore.createIndex('bySession', 'sessionId');
        }
      },
    }).catch((error: unknown) => {
      dbPromise = null;
      throw new SessionsDbError(
        'open_failed',
        error instanceof Error
          ? error.message
          : 'Unable to open local sessions storage.',
      );
    });
  }

  return dbPromise;
};

export const listSessions = async (): Promise<SessionRecord[]> => {
  const db = await getDb();
  const tx = db.transaction('sessions', 'readonly');
  const index = tx.store.index('byUpdatedAt');
  const sessions: SessionRecord[] = [];
  let cursor = await index.openCursor(null, 'prev');

  while (cursor) {
    sessions.push(cursor.value);
    cursor = await cursor.continue();
  }

  await tx.done;
  return sessions;
};

export const getSession = async (id: string): Promise<SessionRecord | undefined> => {
  const db = await getDb();
  return db.get('sessions', id);
};

export const createSession = async (
  initial: Partial<SessionRecord> = {},
): Promise<SessionRecord> => {
  try {
    const db = await getDb();
    const now = Date.now();
    const record: SessionRecord = {
      id: initial.id ?? nanoid(),
      title: initial.title ?? '',
      body: initial.body ?? '',
      createdAt: initial.createdAt ?? now,
      updatedAt: initial.updatedAt ?? now,
    };
    await db.put('sessions', record);
    emitChange();
    return record;
  } catch (error) {
    throw toSessionsError(error);
  }
};

export const updateSession = async (
  id: string,
  patch: Partial<Omit<SessionRecord, 'id' | 'createdAt'>>,
): Promise<SessionRecord> => {
  try {
    const db = await getDb();
    const existing = await db.get('sessions', id);

    if (!existing) {
      throw new SessionsDbError('unknown', 'Session not found.');
    }

    const record: SessionRecord = {
      ...existing,
      ...patch,
      updatedAt: Date.now(),
    };

    await db.put('sessions', record);
    emitChange();
    return record;
  } catch (error) {
    throw toSessionsError(error);
  }
};

export const deleteSession = async (id: string): Promise<void> => {
  try {
    const db = await getDb();
    const tx = db.transaction(['sessions', 'attachments'], 'readwrite');

    await tx.objectStore('sessions').delete(id);

    const attachmentsIndex = tx.objectStore('attachments').index('bySession');
    let cursor = await attachmentsIndex.openCursor(IDBKeyRange.only(id));

    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }

    await tx.done;
    emitChange();
  } catch (error) {
    throw toSessionsError(error);
  }
};

export const listAttachments = async (
  sessionId: string,
): Promise<AttachmentRecord[]> => {
  const db = await getDb();
  const attachments = await db.getAllFromIndex('attachments', 'bySession', sessionId);
  return [...attachments].sort((left, right) => left.createdAt - right.createdAt);
};

const inferFilename = (file: File | Blob, providedFilename?: string) => {
  if (providedFilename) return providedFilename;
  if (file instanceof File && file.name) return file.name;
  const extension = file.type.split('/')[1] || 'png';
  return `attachment-${Date.now()}.${extension}`;
};

export const addAttachment = async (
  sessionId: string,
  file: File | Blob,
  filename?: string,
): Promise<AttachmentRecord> => {
  try {
    const db = await getDb();
    const now = Date.now();
    const record: AttachmentRecord = {
      id: nanoid(),
      sessionId,
      blob: file,
      mime: file.type || 'application/octet-stream',
      filename: inferFilename(file, filename),
      size: file.size,
      createdAt: now,
    };

    const tx = db.transaction(['sessions', 'attachments'], 'readwrite');
    const existingSession = await tx.objectStore('sessions').get(sessionId);

    if (!existingSession) {
      throw new SessionsDbError('unknown', 'Session not found.');
    }

    await tx.objectStore('attachments').put(record);
    await tx.objectStore('sessions').put({
      ...existingSession,
      updatedAt: now,
    });
    await tx.done;
    emitChange();
    return record;
  } catch (error) {
    throw toSessionsError(error);
  }
};

export const removeAttachment = async (id: string): Promise<void> => {
  try {
    const db = await getDb();
    const attachment = await db.get('attachments', id);
    if (!attachment) return;

    const tx = db.transaction(['sessions', 'attachments'], 'readwrite');
    await tx.objectStore('attachments').delete(id);

    const existingSession = await tx.objectStore('sessions').get(attachment.sessionId);
    if (existingSession) {
      await tx.objectStore('sessions').put({
        ...existingSession,
        updatedAt: Date.now(),
      });
    }

    await tx.done;
    emitChange();
  } catch (error) {
    throw toSessionsError(error);
  }
};

export const listPrompts = async (): Promise<PromptSnapshotRecord[]> => {
  const blocks = await api.getAllBlocks();
  return [...blocks
    .map((block) => ({
      id: block.id,
      title: block.title,
      content: block.content,
    }))].sort((left, right) => left.title.localeCompare(right.title));
};
