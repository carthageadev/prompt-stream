"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PromptBlock } from "@/lib/types";
import { ToastProvider, copyText, useToast } from "@/components/ui";
import {
  IconBack,
  IconCopy,
  IconDoc,
  IconImage,
  IconPlus,
  IconTrash,
} from "@/components/icons";

type Attachment = { id: string; name: string; dataUrl: string };
type SessionNote = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
};

const STORE_KEY = "ps.sessions";
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function SessionsWorkbench() {
  const toast = useToast();
  const [sessions, setSessions] = useState<SessionNote[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("saved");
  const [library, setLibrary] = useState<PromptBlock[]>([]);
  const [promptPicker, setPromptPicker] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [quotaFull, setQuotaFull] = useState(false);
  const [dragging, setDragging] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const hydrated = useRef(false);
  const [mode, setMode] = useState<"cloud" | "local">("local");
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);

  /* ------------------------------- storage ------------------------------- */
  const load = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      const parsed = raw ? (JSON.parse(raw) as SessionNote[]) : [];
      setSessions(parsed);
      setActiveId(parsed[0]?.id ?? null);
    } catch {
      setSessions([]);
    }
    hydrated.current = true;
  }, []);

  const readWorkspaceId = () => {
    const match = document.cookie.match(/(?:^|;\s*)ps_session=([^;]+)/);
    const id = Number(match ? decodeURIComponent(match[1]) : NaN);
    return Number.isInteger(id) && id > 0 ? id : null;
  };

  const persist = useCallback(
    (next: SessionNote[]) => {
      setStatus("saving");
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
        setQuotaFull(false);
        setStatus("saved");
      } catch {
        setQuotaFull(true);
        setStatus("idle");
        toast.error("Local storage is full — remove an attachment to free space.");
      }
    },
    [toast],
  );

  useEffect(() => {
    load();
    fetch("/api/prompts")
      .then((res) => res.json())
      .then((data: { blocks?: PromptBlock[] }) => setLibrary(data.blocks ?? []))
      .catch(() => undefined);
    // Cloud notes when a workspace session is active, local drafts otherwise.
    fetch("/api/note-sessions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { notes?: SessionNote[] } | null) => {
        if (!data) return;
        setSessions(data.notes ?? []);
        setActiveId(data.notes?.[0]?.id ?? null);
        setMode("cloud");
        hydrated.current = true;
        const wid = readWorkspaceId();
        if (wid != null) {
          fetch("/api/sessions")
            .then((res) => res.json())
            .then((list: { sessions?: { id: number; name: string }[] }) => {
              setWorkspaceName(list.sessions?.find((s) => s.id === wid)?.name ?? null);
            })
            .catch(() => undefined);
        }
      })
      .catch(() => undefined);
  }, [load]);

  // Cmd/Ctrl+K → search, Cmd/Ctrl+Enter → new session.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        createSession();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = sessions.find((session) => session.id === activeId) ?? null;

  const update = (changes: Partial<SessionNote>) => {
    if (!active) return;
    setSessions((prev) =>
      prev.map((session) =>
        session.id === active.id ? { ...session, ...changes, updatedAt: new Date().toISOString() } : session,
      ),
    );
  };

  // Debounced autosave: localStorage drafts offline, PATCH in cloud mode.
  useEffect(() => {
    if (!hydrated.current || !active) return;
    if (mode === "cloud") {
      const note = active;
      const handle = setTimeout(() => {
        fetch(`/api/note-sessions/${encodeURIComponent(note.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: note.title, body: note.body, attachments: note.attachments }),
        }).catch(() => undefined);
      }, 400);
      return () => clearTimeout(handle);
    }
    const handle = setTimeout(() => persist(sessions), 400);
    return () => clearTimeout(handle);
  }, [sessions, active, mode, persist]);

  const createSession = () => {
    if (mode === "cloud") {
      fetch("/api/note-sessions", { method: "POST" })
        .then((res) => res.json())
        .then((data: { note?: SessionNote }) => {
          if (!data.note) return;
          setSessions((prev) => [data.note!, ...prev]);
          setActiveId(data.note!.id);
          setTimeout(() => bodyRef.current?.focus(), 50);
        })
        .catch(() => toast.error("Could not create note."));
      return;
    }
    const note: SessionNote = {
      id: uid(),
      title: "",
      body: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: [],
    };
    setSessions((prev) => {
      const next = [note, ...prev];
      persist(next);
      return next;
    });
    setActiveId(note.id);
    setTimeout(() => bodyRef.current?.focus(), 50);
  };

  const deleteSession = (id: string) => {
    if (mode === "cloud") {
      fetch(`/api/note-sessions/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => undefined);
    }
    setSessions((prev) => {
      const next = prev.filter((session) => session.id !== id);
      if (mode === "local") persist(next);
      return next;
    });
    setActiveId((current) => (current === id ? null : current));
  };

  const addAttachment = async (file: File) => {
    if (!active) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only images can be attached.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(file);
    }).catch(() => "");
    if (!dataUrl) return;
    update({ attachments: [...active.attachments, { id: uid(), name: file.name || "screenshot", dataUrl }] });
    toast.success("Image attached.");
  };

  // Paste screenshots straight into a session.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (!active) return;
      const target = event.target as HTMLElement | null;
      const image = [...(event.clipboardData?.items ?? [])].find((item) => item.type.startsWith("image/"));
      if (image) {
        event.preventDefault();
        const file = image.getAsFile();
        if (file) void addAttachment(file);
        return;
      }
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      const text = event.clipboardData?.getData("text/plain");
      if (text) {
        event.preventDefault();
        update({ body: `${active.body}${active.body ? "\n\n" : ""}${text}` });
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sessions.filter((session) =>
      !needle ? true : `${session.title}\n${session.body}`.toLowerCase().includes(needle),
    );
  }, [sessions, search]);

  const derivedTitle = active
    ? active.title.trim() || active.body.trim().split("\n")[0].slice(0, 60) || "Untitled session"
    : "";

  const copyImage = async (attachment: Attachment) => {
    try {
      const blob = await (await fetch(attachment.dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      toast.success("Image copied to clipboard.");
    } catch {
      toast.error("This browser refuses image clipboard writes.");
    }
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) void addAttachment(file);
      }}
      className={dragging ? "min-h-screen outline outline-1 outline-offset-0 outline-linestrong" : "min-h-screen"}
    >
      <header
        className="sticky top-0 z-50 border-b border-line"
        style={{ background: "color-mix(in oklab, var(--bg-elev) 92%, transparent)", backdropFilter: "blur(10px)" }}
      >
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-5 py-2.5">
          <Link href="/" className="btn btn-ghost focus-ring !px-2 !py-1 !text-[11.5px]">
            <IconBack width={13} height={13} />
            studio
          </Link>
          <span className="h-3 w-px bg-line" />
          <h1 className="text-[13.5px] font-semibold tracking-[-0.02em] text-ink">Sessions</h1>
          <span className="label">
            {mode === "cloud" ? `synced · ${workspaceName ?? "session"}` : "local draft · pick a session on the studio page to sync"}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search sessions"
              className="field focus-ring !w-52 !py-1.5 !text-[12px]"
            />
            <button type="button" onClick={createSession} className="btn btn-primary focus-ring">
              <IconPlus width={13} height={13} />
              New session
            </button>
          </div>
        </div>
      </header>

      {quotaFull && (
        <div
          className="border-b px-5 py-2 text-center text-[12px]"
          style={{ borderColor: "var(--line-strong)", background: "var(--accent-soft)", color: "var(--ink)" }}
        >
          Storage full — screenshots live locally as data URLs. Download one, then remove it to continue.
        </div>
      )}

      <div className="mx-auto grid max-w-[1400px] gap-4 px-5 py-6 lg:grid-cols-[300px_1fr]">
        <aside className="surface max-h-[78vh] overflow-y-auto scroll-thin p-3">
          {filtered.length === 0 && <p className="px-1 text-[12px] text-ink3">No sessions yet.</p>}
          <ul className="space-y-1.5">
            {filtered.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(session.id)}
                  className="focus-ring w-full border px-2.5 py-2 text-left transition-all duration-150"
                  style={{
                    borderColor: session.id === activeId ? "var(--line-strong)" : "transparent",
                    background: session.id === activeId ? "var(--surface-2)" : "transparent",
                  }}
                >
                  <span className="block truncate text-[12.5px] font-medium text-ink">
                    {session.title.trim() || session.body.trim().split("\n")[0].slice(0, 60) || "Untitled session"}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[10px] text-ink3">
                    <span>{new Date(session.updatedAt).toLocaleDateString()}</span>
                    {session.attachments.length > 0 && <span className="num">{session.attachments.length} img</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="surface p-5">
          {!active ? (
            <div className="grid h-64 place-items-center text-center">
              <div>
                <div className="mx-auto grid h-10 w-10 place-items-center border border-line" style={{ color: "var(--ink-3)" }}>
                  <IconDoc width={16} height={16} />
                </div>
                <p className="mt-3 text-[12.5px] text-ink3">
                  No session selected. Press <span className="kbd">⌘</span> <span className="kbd">↵</span> to start one.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={active.title}
                  onChange={(event) => update({ title: event.target.value })}
                  placeholder={derivedTitle}
                  className="focus-ring min-w-0 flex-1 border border-transparent bg-transparent px-1 py-1 text-[16px] font-semibold tracking-tight text-ink outline-none transition-colors hover:border-line focus:border-linestrong"
                />
                <span className="label shrink-0" style={{ color: status === "saving" ? "var(--accent)" : "var(--ink-3)" }}>
                  {status === "saving" ? "saving" : "saved"}
                </span>
              </div>

              <textarea
                ref={bodyRef}
                value={active.body}
                onChange={(event) => update({ body: event.target.value })}
                placeholder="Write freely. Paste screenshots, drop images anywhere, or insert a prompt block."
                className="field focus-ring mt-3 min-h-[46vh] !p-4 !text-[13.5px] !leading-[1.75]"
              />

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <button type="button" onClick={() => setPromptPicker((open) => !open)} className="btn btn-secondary focus-ring !py-1 !text-[11.5px]">
                  <IconDoc width={12} height={12} />
                  Insert prompt
                </button>
                <label className="btn btn-secondary focus-ring cursor-pointer !py-1 !text-[11.5px]">
                  <IconImage width={12} height={12} />
                  Attach image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void addAttachment(file);
                      event.target.value = "";
                    }}
                  />
                </label>
                <button type="button" onClick={() => setAttachmentsOpen((open) => !open)} className="btn btn-ghost focus-ring !py-1 !text-[11.5px]">
                  Attachments
                  {active.attachments.length > 0 && <span className="num">{active.attachments.length}</span>}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (await copyText(active.body)) toast.success("Session copied.");
                  }}
                  className="btn btn-ghost focus-ring !py-1 !text-[11.5px]"
                >
                  <IconCopy width={12} height={12} />
                  Copy body
                </button>
                <button
                  type="button"
                  onClick={() => deleteSession(active.id)}
                  className="btn btn-ghost focus-ring ml-auto !py-1 !text-[11.5px] hover:!text-ink"
                >
                  <IconTrash width={12} height={12} />
                  Delete
                </button>
              </div>

              {promptPicker && (
                <div className="mt-3 max-h-52 overflow-y-auto scroll-thin border border-line bg-bg p-2">
                  {library.length === 0 && <p className="p-2 text-[12px] text-ink3">Library unavailable.</p>}
                  {library.map((block) => (
                    <button
                      key={block.id}
                      type="button"
                      onClick={() => {
                        update({ body: `${active.body}${active.body ? "\n\n" : ""}> ${block.title}\n${block.content}` });
                        setPromptPicker(false);
                      }}
                      className="focus-ring block w-full truncate px-2.5 py-1.5 text-left text-[12px] text-ink2 hover:bg-surface2 hover:text-ink"
                    >
                      <span className="num text-ink3">#{block.id}</span> {block.title}
                    </button>
                  ))}
                </div>
              )}

              {attachmentsOpen && (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {active.attachments.length === 0 && (
                    <p className="text-[12px] text-ink3">No attachments — paste or drop a screenshot.</p>
                  )}
                  {active.attachments.map((attachment) => (
                    <figure key={attachment.id} className="border border-line bg-surface p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={attachment.dataUrl} alt={attachment.name} className="h-32 w-full object-cover" />
                      <figcaption className="mt-1.5 flex items-center justify-between gap-1">
                        <span className="truncate text-[10.5px] text-ink3">{attachment.name}</span>
                        <span className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => void copyImage(attachment)}
                            className="focus-ring border border-line px-1.5 py-0.5 text-[10px] text-ink3 hover:text-ink"
                          >
                            copy
                          </button>
                          <a
                            href={attachment.dataUrl}
                            download={attachment.name}
                            className="border border-line px-1.5 py-0.5 text-[10px] text-ink3 hover:text-ink"
                          >
                            save
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              update({ attachments: active.attachments.filter((item) => item.id !== attachment.id) })
                            }
                            className="focus-ring border border-line px-1.5 py-0.5 text-[10px] text-ink3 hover:text-ink"
                          >
                            ×
                          </button>
                        </span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default function SessionsPage() {
  return (
    <ToastProvider>
      <SessionsWorkbench />
    </ToastProvider>
  );
}
