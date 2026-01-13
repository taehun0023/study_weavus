"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { AuthUser } from "@/lib/auth"
import { Button } from "@/components/ui/button"

export default function HeaderUserBar({ user }: { user: AuthUser }) {
  const router = useRouter()

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.replace("/login")
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      {/* ✅ username 왼쪽에 글작성(ADMIN만) */}
      {user.user_role === "ADMIN" && (
        <Button asChild variant="secondary" size="sm">
          <Link href="/posts/new">글작성</Link>
        </Button>
      )}

      <span className="text-muted-foreground">
        {user.display_name} ({user.username})
      </span>

      {/* ✅ username 오른쪽에 로그아웃 */}
      <Button onClick={onLogout} variant="outline" size="sm">
        로그아웃
      </Button>
    </div>
  )
}
