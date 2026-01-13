import Link from "next/link"
import type { AuthUser } from "@/lib/auth"
import HeaderUserBar from "./header-user-bar"

export type DashboardHeaderProps = {
  user: AuthUser
}

export default function DashboardHeader({ user }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold">
          Study
        </Link>

        {/* ✅ 유저 + 글작성 + 로그아웃 */}
        <HeaderUserBar user={user} />
      </div>
    </header>
  )
}
