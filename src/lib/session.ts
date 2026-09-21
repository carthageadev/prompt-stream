import { eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { fail } from "./http";

export const SESSION_COOKIE = "ps_session";
export const SESSION_HEADER = "x-session-id";
export const VISIBLE_COOKIE = "ps_visible";
export const VISIBLE_HEADER = "x-visible-sessions";
const MAX_VISIBLE = 20;

/** Session names: short, human, URL- and cookie-safe. */
export function isValidSessionName(input: string): boolean {
  const name = input.trim();
  return name.length >= 2 && name.length <= 32 && /^[A-Za-z0-9 _-]+$/.test(name);
}

/** Resolve the caller's session id from cookie (browser) or header (other clients). */
export async function currentSessionId(request?: Request): Promise<number | null> {
  let raw: string | null | undefined;
  try {
    raw = (await cookies()).get(SESSION_COOKIE)?.value;
  } catch {
    raw = null;
  }
  if (!raw && request) {
    raw = request.headers.get(SESSION_HEADER);
  }
  if (!raw && request) {
    const header = request.headers.get("cookie") ?? "";
    const match = header.match(/(?:^|;\s*)ps_session=([^;]+)/);
    raw = match ? decodeURIComponent(match[1]) : null;
  }
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** Full session ({id, name}) for server components that render it. */
export async function currentSession(): Promise<{ id: number; name: string } | null> {
  const id = await currentSessionId();
  if (id == null) return null;
  const rows = await db
    .select({ id: sessions.id, name: sessions.name })
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);
  return rows[0] ?? null;
}
export async function requireSessionId(request?: Request): Promise<number | NextResponse> {
  const id = await currentSessionId(request);
  if (id == null) return fail("session required", 401);
  return id;
}

function parseIdList(raw: string | null): number[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ].slice(0, MAX_VISIBLE);
}

async function readVisibleRaw(request?: Request): Promise<string | null> {
  try {
    const value = (await cookies()).get(VISIBLE_COOKIE)?.value;
    if (value) return value;
  } catch {
    /* fall through to the request */
  }
  if (!request) return null;
  const header = request.headers.get(VISIBLE_HEADER);
  if (header) return header;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)ps_visible=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export type ResolvedSessions = { active: number; visible: number[] };

/**
 * Resolve the caller's active session (writes go here, 401 without it) plus
 * the visible set (reads span these; always includes active; unknown ids dropped).
 */
export async function resolveSessions(request?: Request): Promise<ResolvedSessions | NextResponse> {
  const active = await currentSessionId(request);
  if (active == null) return fail("session required", 401);
  const wanted = parseIdList(await readVisibleRaw(request));
  const candidates = [...new Set([active, ...wanted])].slice(0, MAX_VISIBLE);
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(inArray(sessions.id, candidates));
  const existing = new Set(rows.map((row) => row.id));
  const visible = candidates.filter((id) => existing.has(id));
  return { active, visible: visible.length ? visible : [active] };
}
