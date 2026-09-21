"use client";

/**
 * Browser-side session plumbing. The active session id rides in a cookie
 * (so server components and API routes see it with zero fetch edits);
 * the visible set rides alongside it, mirrored to localStorage so it
 * survives cookie wipes.
 */

export const SESSION_COOKIE = "ps_session";
export const VISIBLE_COOKIE = "ps_visible";
const VISIBLE_STORE = "ps.visible";
const HIDDEN_STORE = "ps.hidden";
const MAX_VISIBLE = 20;

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

export function readSessionId(): number | null {
  const id = Number(readCookie(SESSION_COOKIE));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function writeSessionCookie(id: number) {
  writeCookie(SESSION_COOKIE, String(id));
}

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  return [...new Set(
    raw
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((n) => Number.isInteger(n) && n > 0),
  )].slice(0, MAX_VISIBLE);
}

function readStoredVisible(): number[] {
  try {
    const raw = window.localStorage.getItem(VISIBLE_STORE);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((n) => Number.isInteger(n) && (n as number) > 0))].slice(0, MAX_VISIBLE);
  } catch {
    return [];
  }
}

/** Visible session ids, falling back to localStorage, then [active]. */
export function readVisibleIds(activeId: number | null): number[] {
  const fromCookie = parseIds(readCookie(VISIBLE_COOKIE));
  if (fromCookie.length) return fromCookie;
  const stored = readStoredVisible();
  if (activeId != null && stored.includes(activeId)) return stored;
  return activeId != null ? [activeId] : [];
}

export function writeVisibleIds(ids: number[]) {
  const clean = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAX_VISIBLE);
  writeCookie(VISIBLE_COOKIE, clean.join(","));
  try {
    window.localStorage.setItem(VISIBLE_STORE, JSON.stringify(clean));
  } catch {
    /* private mode etc. — cookie still carries it */
  }
}

/** Entering a session: restore its last visible set, defaulting to itself. */
export function restoreVisibleFor(activeId: number): number[] {
  const stored = readStoredVisible();
  const visible = stored.includes(activeId) ? stored : [activeId];
  writeVisibleIds(visible);
  return visible;
}

/** Prompts the viewer hid from their own view (never deletes anything). */
export function readHiddenIds(): number[] {
  try {
    const raw = window.localStorage.getItem(HIDDEN_STORE);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n) => Number.isInteger(n));
  } catch {
    return [];
  }
}

export function hidePromptId(id: number) {
  const next = [...new Set([...readHiddenIds(), id])].slice(-500);
  try {
    window.localStorage.setItem(HIDDEN_STORE, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function unhidePromptId(id: number) {
  try {
    window.localStorage.setItem(HIDDEN_STORE, JSON.stringify(readHiddenIds().filter((n) => n !== id)));
  } catch {
    /* ignore */
  }
}
