import Link from "next/link";
import type { AuthUser } from "@/lib/auth";
import HeaderUserBar from "@/components/header-user-bar";
import { listCourses } from "@/lib/courses";

export default async function DashboardHeader({ user }: { user: AuthUser }) {
  const courses = await listCourses({
    includePrivate: user.user_role === "ADMIN",
  });

  return (
    <header
      className="sticky top-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur"
      suppressHydrationWarning
    >
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          Study
        </Link>
        <HeaderUserBar user={user} courses={courses} />
      </div>
    </header>
  );
}
