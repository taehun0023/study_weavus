"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AuthUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function HeaderUserBar({ user }: { user: AuthUser }) {
  const router = useRouter();

  const displayName =
    (user.display_name ?? "").trim() || (user.username ?? "").trim() || "User";

  async function onLogout() {
    router.replace("/logout");
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      {user.user_role === "ADMIN" && (
        <>
          <Button asChild variant="secondary" size="sm" type="button">
            <Link href="/posts/new">글작성</Link>
          </Button>

          <Button asChild variant="secondary" size="sm" type="button">
            <Link href="/admin/users/new">유저등록</Link>
          </Button>

          {/* ✅ NEW: 관리자만 제출물 확인 */}
          <Button asChild variant="secondary" size="sm" type="button">
            <Link href="/admin/submissions">제출물</Link>
          </Button>
        </>
      )}

      <span className="whitespace-nowrap">
        {displayName} ({user.username})
      </span>

      <Button onClick={onLogout} variant="outline" size="sm" type="button">
        로그아웃
      </Button>
    </div>
  );
}
