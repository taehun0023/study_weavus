"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Note = {
  id: number;
  content: string;
  created_at: string;
  updated_at: string;
  admin_id: number;
};

export default function UserAdminNotes({
  targetUserId,
  adminId,
}: {
  targetUserId: number;
  adminId: number;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch(`/api/admin/users/${targetUserId}/notes`, {
      cache: "no-store",
    });
    const data = await res.json();
    setNotes(data.notes ?? []);
  }

  async function save() {
    const text = content.trim();
    if (!text) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d?.error ?? "저장 실패");
        return;
      }
      setContent("");
      await load();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">관리자 메모</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          className="w-full min-h-[96px] rounded-lg bg-black/20 border border-white/10 p-3 text-sm outline-none"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="이 유저에 대한 메모를 남겨두세요 (유저에게는 보이지 않음)"
        />

        <div className="flex justify-end">
          <Button onClick={save} disabled={loading}>
            {loading ? "저장 중..." : "메모 저장"}
          </Button>
        </div>

        <div className="grid gap-2">
          {notes.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              아직 메모가 없습니다.
            </div>
          ) : (
            notes.map((n) => (
              <div
                key={n.id}
                className="rounded-lg border border-white/10 bg-white/5 p-3"
              >
                <div className="text-sm whitespace-pre-wrap">{n.content}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                  {n.admin_id === adminId ? " · 내가 작성" : ""}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
