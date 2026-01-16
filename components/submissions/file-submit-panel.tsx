// components/submissions/file-submit-panel.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type SubmissionRow = {
  id: number;
  created_at: string;
  note: string | null;
  files: { uploadId: number; filename: string; downloadUrl: string }[];
};

async function uploadOne(file: File): Promise<number> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message ?? "업로드 실패");

  // 프로젝트의 upload 응답이 { id } 형태라고 가정(기존 route.ts 기준으로 맞춰놔야 함)
  return Number(data.id);
}

export default function FileSubmitPanel({
  lessonId,
  attemptId,
}: {
  lessonId: number;
  attemptId: number | null;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<SubmissionRow[]>([]);

  async function loadMine() {
    const res = await fetch(`/api/submissions/me?lessonId=${lessonId}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (res.ok) setRows(data.submissions ?? []);
  }

  useEffect(() => {
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function submitFiles() {
    if (files.length === 0 || submitting) return;
    setSubmitting(true);

    try {
      const uploadIds: number[] = [];
      for (const f of files) {
        uploadIds.push(await uploadOne(f));
      }

      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          uploadIds,
          attemptId: attemptId ?? null,
          note: note.trim() ? note.trim() : null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.message ?? "제출 실패");
        return;
      }

      setFiles([]);
      setNote("");
      await loadMine();
      alert("파일 제출 완료!");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div className="font-semibold">파일 제출</div>

      <input
        type="file"
        multiple
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />

      <input
        className="w-full rounded-lg bg-black/20 border border-white/10 p-2 text-sm"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="메모(선택)"
      />

      <Button
        className="w-full"
        disabled={files.length === 0 || submitting}
        onClick={submitFiles}
      >
        {submitting ? "제출 중..." : "파일 제출하기"}
      </Button>

      <div className="pt-2 border-t border-white/10">
        <div className="text-sm font-semibold mb-2">내 제출 목록</div>
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            제출 내역이 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-white/10 bg-black/20 p-3"
              >
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </div>
                {r.note ? <div className="text-sm mt-1">{r.note}</div> : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.files.map((f) => (
                    <a
                      key={f.uploadId}
                      className="text-sm underline"
                      href={f.downloadUrl}
                    >
                      {f.filename}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
