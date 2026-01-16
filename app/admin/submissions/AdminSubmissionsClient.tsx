"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Row = {
  submissionId: number;
  username: string;
  lessonId: number;
  lessonTitle: string;
  createdAt: string;
  files: { uploadId: number; filename: string; url: string }[];
};

export default function AdminSubmissionsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const res = await fetch("/api/admin/submissions", {
          cache: "no-store",
        });

        // ✅ 먼저 text로 받고 JSON 파싱(에러 HTML/빈응답 방어)
        const text = await res.text();

        if (!res.ok) {
          // 서버가 json 에러를 줬을 수도 있으니 한번 시도
          try {
            const j = JSON.parse(text);
            throw new Error(j?.message || `요청 실패 (${res.status})`);
          } catch {
            throw new Error(text?.slice(0, 200) || `요청 실패 (${res.status})`);
          }
        }

        if (!text.trim()) {
          setRows([]);
          return;
        }

        const data = JSON.parse(text);
        setRows(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setErr(e?.message || "불러오기 실패");
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading)
    return <div className="text-sm text-muted-foreground">로딩 중...</div>;
  if (err) return <div className="text-sm text-destructive">에러: {err}</div>;
  if (rows.length === 0)
    return (
      <div className="text-sm text-muted-foreground">제출물이 없습니다.</div>
    );

  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div
          key={r.submissionId}
          className="rounded-xl border border-border bg-card p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold">{r.lessonTitle}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(r.createdAt).toLocaleString()}
            </div>
          </div>

          <div className="text-sm text-muted-foreground mt-1">
            제출자: {r.username} · lessonId: {r.lessonId}
          </div>

          <div className="mt-3 space-y-2">
            {r.files?.length ? (
              r.files.map((f) => (
                <a
                  key={f.uploadId}
                  href={f.url}
                  className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 hover:bg-accent transition"
                >
                  <div className="truncate">{f.filename}</div>
                  <div className="text-xs text-muted-foreground">다운로드</div>
                </a>
              ))
            ) : (
              <div className="text-xs text-muted-foreground">첨부파일 없음</div>
            )}
          </div>

          <div className="mt-3">
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() =>
                navigator.clipboard.writeText(String(r.submissionId))
              }
            >
              제출ID 복사
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
