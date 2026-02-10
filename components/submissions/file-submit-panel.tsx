// components/submissions/file-submit-panel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/datetime";

type SubmissionRow = {
  id: number;
  user_id: number;
  username: string;
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
  const [viewer, setViewer] = useState<{ id: number; isAdmin: boolean } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function loadMine() {
    const res = await fetch(`/api/submissions/me?lessonId=${lessonId}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setRows(data.submissions ?? []);
      setViewer(data.viewer ?? null);
    }
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

  async function deleteSubmission(id: number) {
    if (!confirm("이 제출을 삭제할까요?")) return;
    const res = await fetch(`/api/submissions/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(data?.message ?? "삭제 실패");
      return;
    }
    await loadMine();
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div className="font-semibold">파일 제출</div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
        >
          파일 선택
        </Button>
        <div className="text-xs text-muted-foreground">
          {files.length === 0
            ? "선택된 파일 없음"
            : `선택됨: ${files.length}개`}
        </div>
      </div>

      {files.length > 0 ? (
        <div className="text-xs text-muted-foreground">
          {files.map((f) => f.name).join(", ")}
        </div>
      ) : null}

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
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(r.created_at)}
                    {viewer?.isAdmin ? ` · ${r.username}` : ""}
                  </div>
                  {viewer &&
                  (viewer.isAdmin || r.user_id === viewer.id) ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteSubmission(r.id)}
                    >
                      삭제
                    </Button>
                  ) : null}
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
