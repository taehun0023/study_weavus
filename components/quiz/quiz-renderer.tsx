"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RichText, stripHtml } from "@/components/rich-text";
import HighlightOnView from "@/components/highlight-on-view";

type Question = {
  id: string;
  questionText: string;
  questionType: "multiple_choice" | "short_answer";
  options?: string[];
};

export default function QuizRenderer({
  quizId,
  questions,
}: {
  quizId: number;
  questions: Question[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const questionOrder = useMemo(
    () => questions.map((q) => Number(q.id)).filter((n) => Number.isFinite(n)),
    [questions],
  );

  useEffect(() => {
    if (!quizId || questions.length === 0) return;

    const key = `study:quiz_prefill:${quizId}`;
    const raw =
      typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { answers?: Record<string, any> };
      const saved = parsed?.answers ?? {};
      if (!saved || typeof saved !== "object") return;

      const next: Record<string, any> = {};
      for (const q of questions) {
        const v = saved[String(q.id)];
        if (v == null) continue;

        if (q.questionType === "multiple_choice") {
          if (typeof v === "number") {
            next[String(q.id)] = v;
          } else {
            const s = String(v);
            const idx = (q.options ?? []).findIndex((opt) => opt === s);
            if (idx >= 0) next[String(q.id)] = idx;
          }
        } else {
          next[String(q.id)] = String(v);
        }
      }

      if (Object.keys(next).length > 0) setAnswers(next);
    } catch {
      // ignore
    } finally {
      try {
        window.localStorage.removeItem(key);
      } catch {}
    }
  }, [quizId, questions]);

  const canSubmit = useMemo(() => questions.length > 0, [questions.length]);

  const answeredCount = useMemo(() => {
    let n = 0;
    for (const q of questions) {
      const v = answers[q.id];
      if (q.questionType === "multiple_choice") {
        if (typeof v === "number" && v >= 0) n++;
      } else {
        if (typeof v === "string" && v.trim().length > 0) n++;
      }
    }
    return n;
  }, [answers, questions]);

  async function submit() {
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = { answers, questionOrder };

      const res = await fetch(`/api/quiz/${quizId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        const msg = data?.error ?? data?.message ?? `제출 실패 (${res.status})`;
        setErrorMsg(msg);
        return;
      }

      const attemptId = Number(data?.attemptId);
      if (!Number.isFinite(attemptId) || attemptId <= 0) {
        setErrorMsg("attemptId가 응답에 없습니다. 서버 응답을 확인해주세요.");
        return;
      }

      const from = searchParams.get("from");
      const qs = from ? `?from=${encodeURIComponent(from)}` : "";
      router.push(`/quiz/${quizId}/result/${attemptId}${qs}`);
      router.refresh();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "네트워크 오류");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ✅ 수업내용 페이지처럼 코드 하이라이트/복사버튼/언어배지를 “문제풀이 페이지”에서도 돌리기 */}
      <HighlightOnView selector=".prose" />

      {errorMsg ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {errorMsg}
        </div>
      ) : null}

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <div className="text-sm text-muted-foreground">
          진행:{" "}
          <span className="text-foreground font-medium">{answeredCount}</span>
          <span className="text-muted-foreground"> / {questions.length}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          빈칸(서술형)은 입력 후 제출하세요
        </div>
      </div>

      {questions.map((q, idx) => {
        const selectedIndex =
          typeof answers[q.id] === "number" ? (answers[q.id] as number) : -1;

        const isAnswered =
          q.questionType === "multiple_choice"
            ? selectedIndex >= 0
            : typeof answers[q.id] === "string" &&
              (answers[q.id] as string).trim().length > 0;

        return (
          <div
            key={q.id}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex h-7 items-center rounded-full border border-white/10 bg-black/20 px-3 text-xs font-semibold text-foreground">
                    Q{idx + 1}
                  </span>
                  <span
                    className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-medium ${
                      isAnswered
                        ? "bg-green-500/15 text-green-400 border border-green-500/20"
                        : "bg-white/5 text-muted-foreground border border-white/10"
                    }`}
                  >
                    {isAnswered ? "답안 작성됨" : "미작성"}
                  </span>
                </div>

                <RichText
                  className="prose prose-invert max-w-none text-sm leading-relaxed"
                  html={q.questionText}
                />
              </div>

              <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-muted-foreground">
                {q.questionType === "multiple_choice" ? "객관식" : "단답/서술"}
              </span>
            </div>

            {q.questionType === "multiple_choice" ? (
              <div className="space-y-2">
                {(q.options ?? []).map((opt, i) => (
                  <label
                    key={i}
                    className={`group flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                      selectedIndex === i
                        ? "border-primary/40 bg-primary/10"
                        : "border-white/10 bg-black/10 hover:border-primary/25"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={String(i)}
                      checked={selectedIndex === i}
                      onChange={() => setAnswers((p) => ({ ...p, [q.id]: i }))}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      {opt.includes("<") ? (
                        <RichText
                          className="prose prose-invert max-w-none text-sm leading-relaxed"
                          html={opt}
                        />
                      ) : (
                        <div className="leading-relaxed">{opt}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  className="w-full min-h-[110px] rounded-xl bg-black/20 border border-white/10 px-4 py-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  value={typeof answers[q.id] === "string" ? answers[q.id] : ""}
                  onChange={(e) =>
                    setAnswers((p) => ({ ...p, [q.id]: e.target.value }))
                  }
                  placeholder="정답을 입력하세요"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    미리보기:{" "}
                    <span className="text-foreground">
                      {stripHtml(String(answers[q.id] ?? "")).slice(0, 40) ||
                        "-"}
                    </span>
                  </span>
                  <span>{String(answers[q.id] ?? "").length}자</span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="sticky bottom-4 z-10">
        <div className="rounded-2xl border border-white/10 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              작성:{" "}
              <span className="text-foreground font-medium">
                {answeredCount}
              </span>{" "}
              / {questions.length}
            </span>
            <span>
              {answeredCount === questions.length
                ? "제출 가능"
                : "모든 문항을 채우면 더 좋아요"}
            </span>
          </div>
          <Button
            className="w-full"
            disabled={!canSubmit || submitting}
            onClick={submit}
          >
            {submitting ? "채점/제출 중..." : "문제 제출(채점)"}
          </Button>
        </div>
      </div>
    </div>
  );
}
