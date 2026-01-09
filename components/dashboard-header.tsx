import Link from "next/link"
import type { AuthUser } from "@/lib/auth"

export type DashboardHeaderProps = {
  user: AuthUser
}

export default function DashboardHeader({ user }: DashboardHeaderProps) {
  return (
    <header className="border-b border-border bg-background">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold">
          Study
        </Link>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            {user.display_name} ({user.username})
          </span>
        </div>
      </div>
    </header>
  )
}
