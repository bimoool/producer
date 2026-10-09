import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;
const globalForDb = globalThis as unknown as { goalDb?: Db };

/** Ленивое подключение: сборка не требует DATABASE_URL. */
export function getDb(): Db {
  if (!globalForDb.goalDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.goalDb = drizzle({ client: postgres(url, { max: 5 }), schema });
  }
  return globalForDb.goalDb;
}

export { schema };
