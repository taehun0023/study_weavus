import Link from "next/link";
import type { AuthUser } from "@/lib/auth";
import HeaderUserBar from "@/components/header-user-bar";
import { listCourses } from "@/lib/courses";
import { sql } from "@/lib/db";

export default async function DashboardHeader({ user }: { user: AuthUser }) {
  const courses = await listCourses({
    includePrivate: user.user_role === "ADMIN",
  });
  let japaneseLevel: "N1" | "N2" | "N3" | "N4" | "N5" | null = null;
  try {
    const rows = await sql<{ japanese_level: string | null }>`
      SELECT japanese_level
      FROM public.users
      WHERE id = ${user.id}
      LIMIT 1
    `;
    const level = String(rows[0]?.japanese_level ?? "").toUpperCase();
    if (level === "N1" || level === "N2" || level === "N3" || level === "N4" || level === "N5") {
      japaneseLevel = level;
    }
  } catch {
    japaneseLevel = null;
  }

  const isAdmin = user.user_role === "ADMIN";

  return (
    <header
      className={`sticky top-0 z-50 backdrop-blur-md ${
        isAdmin
          ? "border-b border-amber-500/20 bg-background/95"
          : "border-b border-border/60 bg-background/95"
      }`}
      suppressHydrationWarning
    >
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-2.5">
        {/* Logo + role badge */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/"
            className="text-base font-bold tracking-tight text-foreground hover:text-primary transition-colors"
          >
            Study
          </Link>
          {isAdmin && (
            <span className="admin-badge">Admin</span>
          )}
        </div>

        {/* Navigation */}
        <HeaderUserBar user={user} courses={courses} japaneseLevel={japaneseLevel} />
      </div>
    </header>
  );
}
