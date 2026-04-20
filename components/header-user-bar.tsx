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
  japaneseLevel,
}: {
  user: AuthUser;
  courses: CourseRow[];
  japaneseLevel?: "N1" | "N2" | "N3" | "N4" | "N5" | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const baseDisplayName =
    (user.display_name ?? "").trim() || (user.username ?? "").trim() || "User";
  const displayName = japaneseLevel ? `${baseDisplayName}(${japaneseLevel})` : baseDisplayName;

  const isAdmin = user.user_role === "ADMIN";

  async function onLogout() {
    router.replace("/logout");
  }

  const filteredCourses = (courses ?? []).filter((c) => {
    const s = (c.slug ?? "").toLowerCase();
    return s !== "interview" && s !== "interviews";
  });

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
    <nav className="flex items-center gap-1 text-sm min-w-0">
      {/* Course selector */}
      <Select value={currentCourse || undefined} onValueChange={onCourseChange}>
        <SelectTrigger
          size="sm"
          className="h-7 min-w-[100px] max-w-[130px] text-xs border-border/60"
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

      {/* Common nav */}
      <Button asChild variant="ghost" size="sm" className="h-7 px-2.5 text-xs">
        <Link href="/projects">프로젝트</Link>
      </Button>
      <Button asChild variant="ghost" size="sm" className="h-7 px-2.5 text-xs">
        <Link href="/interviews">면접</Link>
      </Button>
      <Button asChild variant="ghost" size="sm" className="h-7 px-2.5 text-xs">
        <Link href="/japanese-writing">日本語作文</Link>
      </Button>
      <Button asChild variant="ghost" size="sm" className="h-7 px-2.5 text-xs">
        <Link href="/japanese-speaking">日本語音声</Link>
      </Button>

      {/* Admin tools — amber-accented group */}
      {isAdmin && (
        <>
          <div className="w-px h-4 bg-border/60 mx-0.5" />
          <div className="admin-nav-group">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-amber-300/90 hover:text-amber-200 hover:bg-amber-500/15"
            >
              <Link href="/posts/new-set">+ 글작성</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-amber-300/90 hover:text-amber-200 hover:bg-amber-500/15"
            >
              <Link href="/admin/users/new">유저등록</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-amber-300/90 hover:text-amber-200 hover:bg-amber-500/15"
            >
              <Link href="/admin/submissions">제출물</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-amber-300/90 hover:text-amber-200 hover:bg-amber-500/15"
            >
              <Link href="/admin/assistant">AI학습</Link>
            </Button>
          </div>
        </>
      )}

      {/* User section */}
      <div className="w-px h-4 bg-border/60 mx-0.5" />

      <Button
        asChild
        variant="ghost"
        size="sm"
        className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Link
          href={isAdmin ? `/admin/users/${user.id}/edit` : "/account"}
        >
          <span className="whitespace-nowrap max-w-[120px] truncate">
            {displayName}
          </span>
        </Link>
      </Button>

      <Button
        onClick={onLogout}
        variant="outline"
        size="sm"
        className="h-7 px-2.5 text-xs cursor-pointer border-border/60 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40"
        type="button"
      >
        로그아웃
      </Button>
    </nav>
  );
}
