"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminUserEditForm({
  userId,
  initialUsername,
  initialDisplayName,
}: {
  userId: number;
  initialUsername: string;
  initialDisplayName: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername ?? "");
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");

  // ✅ 추가: 비밀번호 변경(선택)
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);

    const u = username.trim();
    const d = displayName.trim();
    if (!u) {
      setError("아이디를 입력해주세요.");
      return;
    }

    // ✅ 추가: 비밀번호 확인
    const p = newPassword;
    const pc = newPasswordConfirm;

    if (p || pc) {
      if (p.length < 4 || p.length > 72) {
        setError("비밀번호는 4~72자로 입력해주세요.");
        return;
      }
      if (p !== pc) {
        setError("새 비밀번호가 일치하지 않습니다.");
        return;
      }
    }

    // ✅ payload 구성 (password는 입력됐을 때만 포함)
    const payload: any = { username: u, displayName: d };
    if (p) payload.password = p;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "유저 수정 중 오류가 발생했습니다.");
        return;
      }
      setDone("저장 완료");
      setNewPassword("");
      setNewPasswordConfirm("");
      router.refresh();
    } catch {
      setError("유저 수정 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">유저 수정</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">아이디</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">표시 이름</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">새 비밀번호 (선택)</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="변경 시에만 입력"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPasswordConfirm">새 비밀번호 확인</Label>
            <Input
              id="newPasswordConfirm"
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {done && <p className="text-sm text-emerald-600">{done}</p>}

          <div className="flex gap-2">
            <Button type="submit" className="cursor-pointer" disabled={loading}>
              {loading ? "저장 중..." : "저장"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => router.push("/admin/progress")}
            >
              뒤로
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
