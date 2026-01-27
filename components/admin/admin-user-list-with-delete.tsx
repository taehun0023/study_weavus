"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Row = {
  id: number;
  username: string;
  display_name: string | null;
  user_role: "USER" | "ADMIN";
};

export default function AdminUserListWithDelete({
  users,
  currentEditUserId,
  myUserId,
}: {
  users: Row[];
  currentEditUserId: number;
  myUserId: number;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onDelete(userId: number) {
    if (busyId) return;
    setError(null);

    if (userId === myUserId) {
      setError("자기 자신은 삭제할 수 없습니다.");
      return;
    }

    if (!window.confirm("정말 삭제할까요? (되돌릴 수 없음)")) return;

    setBusyId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "유저 삭제 중 오류가 발생했습니다.");
        return;
      }
      router.refresh();
    } catch {
      setError("유저 삭제 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">유저 목록 (삭제 가능)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-2">
          {users.map((u) => {
            const name = (u.display_name ?? "").trim() || u.username;
            const isEditing = u.id === currentEditUserId;
            const isMe = u.id === myUserId;

            return (
              <div
                key={u.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 ${
                  isEditing
                    ? "border-primary/40 bg-primary/5"
                    : "border-white/10"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium break-words">{name}</span>
                    <Badge variant="outline">@{u.username}</Badge>
                    <Badge
                      variant={
                        u.user_role === "ADMIN" ? "secondary" : "outline"
                      }
                    >
                      {u.user_role}
                    </Badge>
                    {isMe ? <Badge variant="secondary">ME</Badge> : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* ✅ 상세 버튼 추가 */}
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                  >
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="cursor-pointer"
                    >
                      상세
                    </Link>
                  </Button>

                  <Button
                    asChild
                    size="sm"
                    variant={isEditing ? "secondary" : "outline"}
                    className="cursor-pointer"
                  >
                    <Link
                      href={`/admin/users/${u.id}/edit`}
                      className="cursor-pointer"
                    >
                      수정
                    </Link>
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    className="cursor-pointer"
                    disabled={busyId === u.id || isMe}
                    onClick={() => onDelete(u.id)}
                  >
                    {busyId === u.id ? "삭제 중..." : "삭제"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
