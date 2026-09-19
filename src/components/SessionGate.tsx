"use client";

import { useEffect, useState } from "react";

export type SessionRef = { id: number; name: string };

export function writeSessionCookie(id: number) {
  document.cookie = `ps_session=${id}; path=/; max-age=31536000; samesite=lax`;
}

/** First-visit onboarding + session switcher. Name-only, no password. */
export function SessionGate({
  current,
  onDone,
  onClose,
}: {
  current: SessionRef | null;
  onDone: (session: SessionRef) => void;
  onClose?: () => void;
}) {
  const [sessions, setSessions] = useState<SessionRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((data) => {
        if (alive) setSessions(data.sessions ?? []);
      })
      .catch(() => {
        if (alive) setError("Could not reach the server.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const enter = (session: SessionRef) => {
    writeSessionCookie(session.id);
    onDone(session);
  };

  const create = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Pick a name with at least 2 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.session) {
        setError(data.error ?? "Could not create that session.");
        return;
      }
      enter(data.session);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-bg/85 p-5 backdrop-blur-xl">
      <div className="surface w-full max-w-sm px-6 py-7">
        <div className="flex items-start justify-between gap-4">
          <p className="label">{current ? "Sessions" : "Welcome to prompt studio"}</p>
          {current && onClose && (
            <button type="button" onClick={onClose} className="btn btn-ghost focus-ring !px-2 !py-1 !text-[11px]">
              back
            </button>
          )}
        </div>
        <h2 className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-ink">
          {current ? "Switch session" : "Create your session"}
        </h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink3">
          {current
            ? "Each session is its own library of prompts and groups. Pick one to jump in."
            : "A session is just a name — no password, no account. Your prompts and groups live under it, on any device."}
        </p>

        <div className="mt-5 flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") create();
            }}
            placeholder={current ? "New session name…" : "e.g. ashref"}
            maxLength={32}
            className="field min-w-0 flex-1"
          />
          <button type="button" onClick={create} disabled={busy} className="btn btn-primary focus-ring shrink-0">
            {busy ? "Creating…" : "Create"}
          </button>
        </div>

        {error && <p className="mt-2 text-[12px] text-red-500">{error}</p>}

        <div className="mt-5 border-t border-line pt-4">
          <p className="label mb-2">{current ? "All sessions" : "Pick up where you left off"}</p>
          {loading ? (
            <div className="h-56 space-y-2 overflow-hidden py-1" aria-label="Loading sessions">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="flex items-center justify-between px-3 py-2">
                  <span
                    className="skeleton-bar block w-2/3"
                    style={{ animationDelay: `${row * 0.18}s` }}
                  />
                  <span
                    className="skeleton-bar block w-10"
                    style={{ animationDelay: `${row * 0.18 + 0.09}s` }}
                  />
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex h-56 items-center justify-center">
              <p className="py-2 text-[12.5px] text-ink3">No sessions yet — create the first one above.</p>
            </div>
          ) : (
            <div className="h-56 space-y-1 overflow-y-auto scroll-thin">
              {sessions.map((session) => {
                const active = current?.id === session.id;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => enter(session)}
                    className="focus-ring flex w-full items-center justify-between px-3 py-2 text-left text-[13px]"
                    style={{ background: active ? "var(--surface-2)" : "transparent" }}
                  >
                    <span className="truncate text-ink">{session.name}</span>
                    <span className="num text-[10px] text-ink3">{active ? "current" : "open →"}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
