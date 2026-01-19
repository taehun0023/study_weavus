"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Row = {
  lesson_id: number;
  lesson_title: string;
  difficulty: string | null;

  quiz_post_id: number | null;
  quiz_title: string | null;

  last_attempt_at: string | null;
  last_score: number | null;
  last_total: number | null;
  last_is_perfect: boolean | null;
};

function fmt(dt: string | null) {
  if (!dt) return "-";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export default function UserCourseLessonStatus({
  userId,
  course,
}: {
  userId: number;
  course: "java" | "react" | string;
}) {
  const courseSlug = useMemo(
    () => String(course ?? "").toLowerCase(),
    [course]
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/admin/user-course-lessons?userId=${userId}&course=${encodeURIComponent(
          courseSlug
        )}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error ?? "불러오기 실패");
        setRows([]);
        return;
      }
      setRows(data?.rows ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "네트워크 오류");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!userId || !courseSlug) return;
    load();
  }, [userId, courseSlug]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {courseSlug.toUpperCase()} · 수업별 문제풀이 제출/합격 현황
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? "불러오는 중..." : "새로고침"}
        </Button>
      </div>

      {err ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {err}
        </div>
      ) : null}

      <div className="grid gap-2">
        {rows.map((r) => {
          const hasQuiz = !!r.quiz_post_id;

          const notSubmitted = hasQuiz && !r.last_attempt_at;
          const submitted = hasQuiz && !!r.last_attempt_at;
          const pass = submitted && r.last_is_perfect === true;
          const fail = submitted && r.last_is_perfect !== true; // 만점 아니면 불합격

          return (
            <div
              key={r.lesson_id}
              className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-semibold truncate">{r.lesson_title}</div>

                <div className="mt-1 text-xs text-muted-foreground">
                  {hasQuiz
                    ? `문제풀이: ${r.quiz_title ?? `#${r.quiz_post_id}`}`
                    : "문제풀이 없음"}
                </div>

                {submitted ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    제출일: {fmt(r.last_attempt_at)} · 점수: {r.last_score ?? 0}
                    /{r.last_total ?? 0}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                {!hasQuiz ? (
                  <Badge variant="secondary">문제풀이 없음</Badge>
                ) : notSubmitted ? (
                  <Badge variant="outline">미제출</Badge>
                ) : pass ? (
                  <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                    합격
                  </Badge>
                ) : fail ? (
                  <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                    불합격
                  </Badge>
                ) : (
                  <Badge variant="outline">-</Badge>
                )}

                <Button asChild size="sm" variant="outline">
                  <Link href={`/posts/${r.lesson_id}`}>수업</Link>
                </Button>

                {hasQuiz ? (
                  <Button asChild size="sm">
                    <Link href={`/quiz/${r.quiz_post_id}?from=${r.lesson_id}`}>
                      문제풀이
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
