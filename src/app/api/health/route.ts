import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok", service: "prompt-studio", db: "up" });
  } catch (error) {
    return Response.json(
      { status: "degraded", db: "down", error: (error as Error).message },
      { status: 503 },
    );
  }
}
