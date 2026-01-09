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
    // Neon/서버리스에서 가장 무난한 SSL
    ssl: { rejectUnauthorized: false },

    // 서버리스 폭주 방지 (원하면 조절)
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  }
}

export function getPool(): Pool {
  if (process.env.NODE_ENV === "production") {
    // prod는 런타임이 재사용되기도 하고, 서버리스도 있으니 기본 생성
    return new Pool(buildConfig())
  }

  // dev(HMR)에서는 Pool 재생성 누적 방지
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
    // pg 에러는 e.code(예: 28P01, 42P01)가 핵심
    const code = e?.code ? ` code=${e.code}` : ""
    const msg = e?.message ? ` message=${e.message}` : ""
    const detail = e?.detail ? ` detail=${e.detail}` : ""
    throw new Error(`[DB_ERROR]${code}${msg}${detail}`)
  }
}

/* ===== 타입 ===== */
export type User = {
  id: number
  username: string
  password_hash: string
  display_name: string
  role: "USER" | "ADMIN"
  created_at: Date
}
