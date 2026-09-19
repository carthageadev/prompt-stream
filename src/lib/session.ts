import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { fail } from "./http";

export const SESSION_COOKIE = "ps_session";
export const SESSION_HEADER = "x-session-id";

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
