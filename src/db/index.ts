import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

type Db = ReturnType<typeof drizzle>;

const globalForDb = globalThis as typeof globalThis & {
  __promptStudioDb?: Db;
};

function createDb(): Db {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  const pool = new Pool({ connectionString: databaseUrl });
  return drizzle(pool);
}

/**
 * Lazily-initialised client. The module must stay import-safe without a
 * database (e.g. `next build` imports every route to collect page data),
 * so the pool is only created on first use. At request time a missing
 * DATABASE_URL still throws loudly.
 */
function getDb(): Db {
  if (!globalForDb.__promptStudioDb) {
    globalForDb.__promptStudioDb = createDb();
  }
  return globalForDb.__promptStudioDb;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
