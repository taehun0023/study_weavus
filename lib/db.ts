// lib/db.ts
import { Pool, type PoolConfig } from "pg"

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  return url
}

function buildConfig(): PoolConfig {
  const connectionString = getDatabaseUrl()

  return {
    connectionString,
    ssl: { rejectUnauthorized: false },

    // ❌ Neon pooler(pgBouncer)는 startup options(search_path 등) 지원 안 함
    // options: "-c search_path=public",

    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  }
}

export function getPool(): Pool {
  if (process.env.NODE_ENV === "production") {
    return new Pool(buildConfig())
  }
  if (!globalThis.__pgPool) {
    globalThis.__pgPool = new Pool(buildConfig())
  }
  return globalThis.__pgPool
}

export const pool = getPool()

export async function sql<T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<T[]> {
  const text = strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""),
    ""
  )

  try {
    const result = await pool.query(text, values)
    return result.rows as T[]
  } catch (e: any) {
    const code = e?.code ? ` code=${e.code}` : ""
    const msg = e?.message ? ` message=${e.message}` : ""
    const detail = e?.detail ? ` detail=${e.detail}` : ""
    throw new Error(`[DB_ERROR]${code}${msg}${detail}`)
  }
}
