"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type CourseRow = {
  id: number;
  name: string;
  slug: string;
  is_public?: boolean;
};

export default function AdminCourseCategoryManager() {
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/courses", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "목록 로드 실패");
        setRows([]);
        return;
      }
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch {
      setError("목록 로드 실패");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate() {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          isPublic,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "추가 실패");
        return;
      }
      setName("");
      setSlug("");
      setIsPublic(true);
      await load();
    } catch {
      setError("추가 실패");
    } finally {
      setSaving(false);
    }
  }

  async function onEdit(row: CourseRow) {
    if (busyId) return;
    const nextName = window.prompt("카테고리 이름 수정", row.name);
    if (nextName == null) return;
    const nextSlug = window.prompt("카테고리 slug 수정", row.slug);
    if (nextSlug == null) return;
    const nextVisible = window.confirm(
      "확인 = 공개(유저에게 보임), 취소 = 비공개(ADMIN만 보임)",
    );

    setError(null);
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/courses/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nextName.trim(),
          slug: nextSlug.trim(),
          isPublic: nextVisible,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "수정 실패");
        return;
      }
      await load();
    } catch {
      setError("수정 실패");
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(row: CourseRow) {
    if (busyId) return;
    if (!window.confirm(`카테고리 "${row.name}" 를 삭제할까요?`)) return;
    setError(null);
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/courses/${row.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "삭제 실패");
        return;
      }
      await load();
    } catch {
      setError("삭제 실패");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">카테고리 관리 (드롭다운 과목)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="grid gap-2 md:grid-cols-[1fr_1fr_160px_auto]">
          <Input
            placeholder="이름 (예: Java)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="slug (예: java)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <label className="h-10 rounded-md border border-input px-3 text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            공개
          </label>
          <Button type="button" onClick={onCreate} disabled={saving}>
            {saving ? "추가 중..." : "추가"}
          </Button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">불러오는 중...</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/10 p-3"
              >
                <div className="min-w-0">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    @{r.slug} · {r.is_public === false ? "비공개" : "공개"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(r)}
                    disabled={busyId === r.id}
                  >
                    수정
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => onDelete(r)}
                    disabled={busyId === r.id}
                  >
                    {busyId === r.id ? "처리 중..." : "삭제"}
                  </Button>
                </div>
              </div>
            ))}
            {rows.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                등록된 카테고리가 없습니다.
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
