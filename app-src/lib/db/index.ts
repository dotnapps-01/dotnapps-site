import "server-only";
import { mkdirSync } from "node:fs";
import { migrations } from "./migrations";

/**
 * Postgres access.
 *  - DATABASE_URL set  -> node-postgres pool (Supabase, Neon, RDS, local Postgres...). Required in production.
 *  - otherwise (dev only) -> PGlite, a real Postgres compiled to WASM, stored in .data/pglite (or PGLITE_DIR).
 * Migrations run once per process on first use.
 */

export type Row = Record<string, unknown>;

export interface Queryable {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs several statements at once (migrations). No parameters. */
  exec(sql: string): Promise<void>;
}
export interface Db extends Queryable {
  driver: "pg" | "pglite";
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
}

const g = globalThis as unknown as { __sknDb?: Promise<Db> };

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pg = await import("pg");
    // count(*) and other int8 values arrive as numbers, not strings
    pg.types.setTypeParser(20, (v) => Number(v));
    const pool = new pg.Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX ?? 10) });
    const wrap = (c: { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }): Queryable => ({
      query: async <T,>(sql: string, params?: unknown[]) => (await c.query(sql, params)).rows as T[],
      exec: async (sql: string) => {
        await c.query(sql);
      },
    });
    return {
      driver: "pg",
      query: wrap(pool).query,
      exec: wrap(pool).exec,
      async tx(fn) {
        const client = await pool.connect();
        try {
          await client.query("begin");
          const out = await fn(wrap(client));
          await client.query("commit");
          return out;
        } catch (e) {
          await client.query("rollback").catch(() => {});
          throw e;
        } finally {
          client.release();
        }
      },
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL must be set in production (the embedded dev database is disabled).");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  if (dir !== "memory") mkdirSync(dir, { recursive: true });
  const lite = dir === "memory" ? new PGlite() : new PGlite(dir);
  await lite.waitReady;
  // PGlite is a single connection: serialise statements so concurrent requests queue instead of interleaving.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => {});
    return run;
  };
  return {
    driver: "pglite",
    query: <T,>(sql: string, params?: unknown[]) => serial(async () => (await lite.query<T>(sql, params)).rows),
    exec: (sql: string) => serial(async () => void (await lite.exec(sql))),
    tx: <T,>(fn: (q: Queryable) => Promise<T>) =>
      serial(() =>
        lite.transaction((t) =>
          fn({
            query: async <R,>(sql: string, params?: unknown[]) => (await t.query<R>(sql, params)).rows,
            exec: async (sql: string) => void (await t.exec(sql)),
          }),
        ),
      ),
  };
}

async function migrate(db: Db) {
  await db.query("create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())");
  const done = new Set((await db.query<{ id: string }>("select id from schema_migrations")).map((r) => r.id));
  for (const m of migrations) {
    if (done.has(m.id)) continue;
    await db.tx(async (q) => {
      if (db.driver === "pg") await q.query("select pg_advisory_xact_lock(727274)");
      // another process may have applied it while we waited for the lock
      const again = await q.query("select 1 from schema_migrations where id = $1", [m.id]);
      if (again.length) return;
      await q.exec(m.sql);
      await q.query("insert into schema_migrations (id) values ($1)", [m.id]);
    });
  }
}

/** The shared database handle (connects and migrates on first call). */
export function getDb(): Promise<Db> {
  if (!g.__sknDb) {
    g.__sknDb = connect()
      .then(async (db) => {
        await migrate(db);
        return db;
      })
      .catch((e) => {
        g.__sknDb = undefined; // allow a retry on the next request
        throw e;
      });
  }
  return g.__sknDb;
}

export async function query<T = Row>(sql: string, params?: unknown[]): Promise<T[]> {
  return (await getDb()).query<T>(sql, params);
}

export async function tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
  return (await getDb()).tx(fn);
}
