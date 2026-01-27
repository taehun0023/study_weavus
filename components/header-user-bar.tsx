"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AuthUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CourseRow = {
  id: number;
  name: string;
  slug: string;
};

export default function HeaderUserBar({
  user,
  courses,
}: {
  user: AuthUser;
  courses: CourseRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const displayName =
    (user.display_name ?? "").trim() || (user.username ?? "").trim() || "User";

  async function onLogout() {
    router.replace("/logout");
  }

  // ✅ 드롭다운에서만 면접 과목 제거
  const filteredCourses = (courses ?? []).filter((c) => {
    const s = (c.slug ?? "").toLowerCase();
    return s !== "interview" && s !== "interviews";
  });

  // 현재 선택된 과목 (posts 목록 페이지에서만 기본 선택)
  const currentCourse = (() => {
    const course = (searchParams?.get("course") ?? "").toLowerCase();
    if (!course) return "";
    const exists = filteredCourses.some((c) => c.slug.toLowerCase() === course);
    return exists ? course : "";
  })();

  function onCourseChange(next: string) {
    router.push(`/posts?course=${encodeURIComponent(next)}`);
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      {/* ✅ 과목 드롭다운 */}
      <Select value={currentCourse || undefined} onValueChange={onCourseChange}>
        <SelectTrigger
          size="sm"
          className="min-w-[110px]"
          aria-label="과목 선택"
        >
          <SelectValue placeholder="과목" />
        </SelectTrigger>
        <SelectContent>
          {filteredCourses.map((c) => (
            <SelectItem key={c.id} value={c.slug.toLowerCase()}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {user.user_role === "ADMIN" && (
        <>
          <Button asChild variant="secondary" size="sm" type="button">
            <Link href="/posts/new">글작성</Link>
          </Button>

          <Button asChild variant="secondary" size="sm" type="button">
            <Link href="/admin/users/new">유저등록</Link>
          </Button>

          <Button asChild variant="secondary" size="sm" type="button">
            <Link href="/admin/submissions">제출물</Link>
          </Button>
        </>
      )}

      {/* ✅ 이 버튼은 그대로 유지 */}
      <Button asChild variant="secondary" size="sm" type="button">
        <Link href="/interviews">면접</Link>
      </Button>

      {/* ✅ 로그인 유저 아이디(표시명) 클릭 → 유저 정보 수정 */}
      <Button asChild variant="ghost" size="sm" type="button">
        <Link
          href={
            user.user_role === "ADMIN"
              ? `/admin/users/${user.id}/edit`
              : "/account"
          }
        >
          <span className="whitespace-nowrap">
            {displayName} ({user.username})
          </span>
        </Link>
      </Button>

      <Button
        onClick={onLogout}
        variant="outline"
        size="sm"
        type="button"
        className="cursor-pointer"
      >
        로그아웃
      </Button>
    </div>
  );
}
