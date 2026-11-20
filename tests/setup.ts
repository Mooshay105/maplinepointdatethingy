// Runs before every test file (see bunfig.toml).
import { mock } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A throwaway SQLite file instead of Turso. A file, not :memory:, because libsql opens a new
// connection for batches and each in-memory connection would get its own empty database.
process.env.TURSO_DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), "mlpdt-")), "test.db")}`;
delete process.env.TURSO_AUTH_TOKEN;

const { db } = await import("@/utils/db");
const { migrate } = await import("drizzle-orm/libsql/migrator");
await migrate(db, { migrationsFolder: join(import.meta.dir, "../db/migrations") });

/** Who the mocked Clerk auth() says is signed in. Tests set this; null means signed out. */
export const authState: { userId: string | null } = { userId: null };

mock.module("@clerk/nextjs/server", () => ({
	auth: async () => ({ userId: authState.userId }),
	clerkMiddleware: () => () => undefined,
}));
