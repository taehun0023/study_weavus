// components/login-form.tsx
"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

export function LoginForm() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json().catch(() => ({}))

      // ✅ 우리 API는 { ok: boolean, message?: string }
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? "로그인에 실패했습니다.")
        return
      }

      // ✅ 로그인 성공 → 메인 이동 + 서버컴포넌트 갱신
      router.replace("/")
      router.refresh()
    } catch {
      setError("서버 연결에 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-border bg-card">
      <form onSubmit={handleSubmit}>
        <CardContent className="pt-4 space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="username">사용자명</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="사용자명을 입력하세요"
              required
              disabled={isLoading}
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              required
              disabled={isLoading}
              className="h-11"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 pt-6">
          <Button type="submit" className="w-full h-11 mt-1" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                로그인 중...
              </>
            ) : (
              "로그인"
            )}
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            계정이 없으신가요?{" "}
            <span className="underline underline-offset-4">관리자에게 계정 발급을 요청하세요</span>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
