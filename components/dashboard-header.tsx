import Link from "next/link";
import type { AuthUser } from "@/lib/auth";
import HeaderUserBar from "@/components/header-user-bar";
import { sql } from "@/lib/db";

type CourseRow = {
  id: number;
  name: string;
  slug: string;
};

export default async function DashboardHeader({ user }: { user: AuthUser }) {
  // 헤더 과목 드롭다운에 쓸 과목 목록
  const courses = await sql<CourseRow>`
    SELECT id, name, slug
    FROM courses
    ORDER BY id ASC
  `;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          Study
        </Link>

        {/* ✅ 오른쪽 영역은 무조건 이 컴포넌트 하나로 고정 */}
        <HeaderUserBar user={user} courses={courses} />
      </div>
    </header>
  );
}
