import { sql } from "./db"
import { cookies } from "next/headers"
import { randomBytes, createHash } from "crypto"
import * as bcrypt from "bcryptjs"

export type AuthUser = {
  id: number
  username: string
  display_name: string
  user_role: "USER" | "ADMIN"
}

const BCRYPT_COST = Number(process.env.BCRYPT_COST ?? 12)

export function isBcryptHash(hash: string): boolean {
  return hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")
}

/** 레거시(SHA-256) 해시 (기존 데이터 호환용) */
function sha256(password: string): string {
  return createHash("sha256").update(password).digest("hex")
}

/** 신규 저장용: bcrypt 해시 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST)
}

/** bcrypt 우선 검증, 아니면 sha256 레거시 검증 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (isBcryptHash(storedHash)) {
    return bcrypt.compare(password, storedHash)
  }
  return sha256(password) === storedHash
}

/** 레거시 sha256 유저는 로그인 성공 시 bcrypt로 자동 업그레이드 */
export async function upgradePasswordHashIfNeeded(userId: number, password: string, storedHash: string) {
  if (isBcryptHash(storedHash)) return
  const newHash = await hashPassword(password)
  await sql`UPDATE public.users SET password_hash = ${newHash} WHERE id = ${userId}`
}

/** 세션 토큰 생성 */
function generateToken(): string {
  return randomBytes(32).toString("hex")
}

/** 세션 생성 */
export async function createSession(userId: number): Promise<string> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await sql`
    INSERT INTO public.sessions (user_id, token, expires_at)
    VALUES (${userId}, ${token}, ${expiresAt})
  `
  return token
}

/** 세션 삭제 */
export async function deleteSession(token: string) {
  await sql`DELETE FROM public.sessions WHERE token = ${token}`
}

/** 토큰으로 유저 조회 */
export async function getSessionUser(token: string): Promise<AuthUser | null> {
  const rows = (await sql`
    SELECT u.id, u.username, u.display_name, u.user_role
    FROM public.sessions s
    JOIN public.users u ON s.user_id = u.id
    WHERE s.token = ${token} AND s.expires_at > NOW()
    LIMIT 1
  `) as AuthUser[]

  return rows[0] ?? null
}

/** 현재 로그인 유저 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("session_token")?.value
  if (!token) return null
  return getSessionUser(token)
}

/** 쿠키 세팅 */
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set("session_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  })
}

/** 쿠키 제거 */
export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.set("session_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  })
}
