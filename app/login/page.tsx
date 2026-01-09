"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data?.ok) {
        setError(data?.message ?? "로그인에 실패했습니다.")
        return
      }

      // ✅ 로그인 성공 → 메인 이동
      router.replace("/") // 또는 router.push("/")
      router.refresh()    // 서버 컴포넌트에서 유저 상태를 읽는 경우 필수급
    } catch {
      setError("네트워크 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {error && <div style={{ color: "red" }}>{error}</div>}

      <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" />

      <button disabled={loading} type="submit">
        {loading ? "로그인 중..." : "로그인"}
      </button>
    </form>
  )
}
