"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SessionGate, type SessionRef } from "@/components/SessionGate";
import { ToastProvider, useToast } from "@/components/ui";
import { IconBack, IconCheck, IconPlus } from "@/components/icons";
import {
  readSessionId,
  readVisibleIds,
  restoreVisibleFor,
  writeSessionCookie,
  writeVisibleIds,
} from "@/lib/session-client";

type ListedSession = SessionRef & { promptCount: number };

/**
 * Session manager: which workspace is active (writes land here) and which
 * sessions share one view. Friends' rows are read-only in the studio —
 * hiding one only hides it for you, never deletes it for them.
 */
function SessionsManager() {
  const toast = useToast();
  const [sessions, setSessions] = useState<ListedSession[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [visibleIds, setVisibleIds] = useState<number[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);

  const refresh = useCallback(() => {
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((data: { sessions?: ListedSession[] }) => setSessions(data.sessions ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    const active = readSessionId();
    setActiveId(active);
    setVisibleIds(readVisibleIds(active));
  }, [refresh]);

  const enter = (id: number) => {
    writeSessionCookie(id);
    const visible = restoreVisibleFor(id);
    setActiveId(id);
    setVisibleIds(visible);
    setGateOpen(false);
  };

  const toggle = (id: number) => {
    if (id === activeId) return;
    const next = visibleIds.includes(id)
      ? visibleIds.filter((v) => v !== id)
      : [...visibleIds, id];
    writeVisibleIds(next);
    setVisibleIds(next);
  };

  const create = async () => {
    const name = newName.trim();
    if (name.length < 2) {
      setError("Pick a name with at least 2 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok || !data.session) {
        setError(data.error ?? "Could not create that session.");
        return;
      }
      setNewName("");
      refresh();
      enter(data.session.id);
      toast.success(`Session "${data.session.name}" created — it is now active.`);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const active = sessions.find((s) => s.id === activeId) ?? null;

  return (
    <div className="min-h-screen">
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
          <span className="label">workspaces · one UI</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-5 py-8">
        <section className="surface p-5">
          <p className="label">Active session</p>
          {active ? (
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[20px] font-semibold tracking-[-0.03em] text-ink">
                  {active.name}
                </h2>
                <p className="mt-1 text-[12px] text-ink3">
                  {active.promptCount} prompt{active.promptCount === 1 ? "" : "s"} · new blocks land here
                </p>
              </div>
              <button type="button" onClick={() => setGateOpen(true)} className="btn btn-ghost focus-ring">
                Switch
              </button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <p className="text-[13px] text-ink3">No active session yet.</p>
              <button type="button" onClick={() => setGateOpen(true)} className="btn btn-primary focus-ring">
                Choose one
              </button>
            </div>
          )}
        </section>

        <section className="surface p-5">
          <p className="label">In view</p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink3">
            Tick the sessions that share your studio. Their prompts are read-only for you —
            hiding one only hides it from your view, never from its owner.
          </p>
          <ul className="mt-3 space-y-1">
            {sessions.map((session) => {
              const isActive = session.id === activeId;
              const shown = isActive || visibleIds.includes(session.id);
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => toggle(session.id)}
                    disabled={isActive}
                    title={isActive ? "Active session is always in view" : shown ? "Hide from view" : "Show in view"}
                    className="focus-ring flex w-full items-center gap-3 px-2.5 py-2 text-left"
                  >
                    <span className={`check ${shown ? "on" : ""}`}>
                      <IconCheck width={11} height={11} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                      {session.name}
                    </span>
                    <span className="num text-[10.5px] text-ink3">
                      {session.promptCount} prompt{session.promptCount === 1 ? "" : "s"}
                    </span>
                    {isActive && <span className="label !text-[10px]">active</span>}
                  </button>
                </li>
              );
            })}
            {sessions.length === 0 && (
              <li className="px-2 py-3 text-[12.5px] text-ink3">No sessions yet — create the first one below.</li>
            )}
          </ul>
        </section>

        <section className="surface p-5">
          <p className="label">New session</p>
          <div className="mt-3 flex gap-2">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void create();
              }}
              placeholder="e.g. ashref"
              maxLength={32}
              className="field min-w-0 flex-1"
            />
            <button type="button" onClick={() => void create()} disabled={busy} className="btn btn-primary focus-ring shrink-0">
              <IconPlus width={13} height={13} />
              {busy ? "Creating…" : "Create & enter"}
            </button>
          </div>
          {error && <p className="mt-2 text-[12px] text-red-500">{error}</p>}
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink3">
            A session is just a name. Creating one makes it active immediately.
          </p>
        </section>
      </div>

      {gateOpen && (
        <SessionGate
          current={active ? { id: active.id, name: active.name } : null}
          onDone={(next) => enter(next.id)}
          onClose={() => setGateOpen(false)}
        />
      )}
    </div>
  );
}

export default function SessionsPage() {
  return (
    <ToastProvider>
      <SessionsManager />
    </ToastProvider>
  );
}
