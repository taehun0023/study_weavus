"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function AdminUserCreateForm() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [password, setPassword] = useState("")
  const [japaneseLevel, setJapaneseLevel] = useState<"N1" | "N2" | "N3" | "N4" | "N5">("N3")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(null)

    const u = username.trim()
    const d = displayName.trim()

    if (!u || !d || !password) {
      setError("모든 필드를 입력해주세요.")
      return
    }
    if (password.length < 4) {
      setError("비밀번호는 최소 4자 이상이어야 합니다.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, displayName: d, password, japaneseLevel }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || "유저 등록 중 오류가 발생했습니다.")
        return
      }
      setDone(`생성 완료: ${data.user?.displayName ?? d} (${data.user?.username ?? u})`)
      setUsername("")
      setDisplayName("")
      setPassword("")
      setJapaneseLevel("N3")
      router.refresh()
    } catch {
      setError("유저 등록 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">새 유저 생성</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">아이디</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="user1"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">표시 이름</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="유저1"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="japaneseLevel">일본어 등급</Label>
            <select
              id="japaneseLevel"
              value={japaneseLevel}
              onChange={(e) => setJapaneseLevel(e.target.value as "N1" | "N2" | "N3" | "N4" | "N5")}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="N1">N1</option>
              <option value="N2">N2</option>
              <option value="N3">N3</option>
              <option value="N4">N4</option>
              <option value="N5">N5</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="****"
              autoComplete="new-password"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {done && <p className="text-sm text-emerald-600">{done}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "생성 중..." : "유저 생성"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/")}> 
              메인으로
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
