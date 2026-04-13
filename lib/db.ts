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

    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 10_000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS ?? 20_000),
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

  const isReadOnly = /^\s*select\b/i.test(text)
  const isTransient = (e: any) => {
    const msg = String(e?.message ?? "").toLowerCase()
    const code = String(e?.code ?? "")
    return (
      msg.includes("connection terminated due to connection timeout") ||
      msg.includes("timeout") ||
      code === "57P01" ||
      code === "53300"
    )
  }

  try {
    const result = await pool.query(text, values)
    return result.rows as T[]
  } catch (e: any) {
    if (isReadOnly && isTransient(e)) {
      try {
        const result = await pool.query(text, values)
        return result.rows as T[]
      } catch (e2: any) {
        const code = e2?.code ? ` code=${e2.code}` : ""
        const msg = e2?.message ? ` message=${e2.message}` : ""
        const detail = e2?.detail ? ` detail=${e2.detail}` : ""
        throw new Error(`[DB_ERROR]${code}${msg}${detail}`)
      }
    }
    const code = e?.code ? ` code=${e.code}` : ""
    const msg = e?.message ? ` message=${e.message}` : ""
    const detail = e?.detail ? ` detail=${e.detail}` : ""
    throw new Error(`[DB_ERROR]${code}${msg}${detail}`)
  }
}
