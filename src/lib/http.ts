import { NextResponse } from "next/server";

const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 100;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type",
};

/** Fixed-window rate limiting: 100 requests / minute / IP. */
export function rateLimit(request: Request): { ok: boolean; remaining: number } {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: LIMIT - 1 };
  }
  bucket.count += 1;
  if (buckets.size > 5000) buckets.clear();
  return { ok: bucket.count <= LIMIT, remaining: Math.max(0, LIMIT - bucket.count) };
}

export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: CORS });
}

export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: CORS });
}

export function guard(request: Request): NextResponse | null {
  const { ok } = rateLimit(request);
  if (ok) return null;
  return fail("Rate limit exceeded (100 requests per minute).", 429);
}

export function preflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function readBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48) || "stack";
}
