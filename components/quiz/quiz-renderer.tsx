"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

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

  // ✅ multiple_choice는 "옵션 index"를 저장 (중복 옵션 텍스트 문제 방지)
  // - multiple_choice: number (0,1,2...)
  // - short_answer: string
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const questionOrder = useMemo(
    () => questions.map((q) => Number(q.id)).filter((n) => Number.isFinite(n)),
    [questions],
  );

  const canSubmit = useMemo(() => questions.length > 0, [questions.length]);

  async function submit() {
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        answers,
        questionOrder,
      };

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
      {errorMsg ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {errorMsg}
        </div>
      ) : null}

      {questions.map((q, idx) => {
        const selectedIndex =
          typeof answers[q.id] === "number" ? (answers[q.id] as number) : -1;

        return (
          <div
            key={q.id}
            className="rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <div className="text-sm font-semibold mb-2">
              Q{idx + 1}. {q.questionText}
            </div>

            {q.questionType === "multiple_choice" ? (
              <div className="space-y-2">
                {(q.options ?? []).map((opt, i) => (
                  <label key={i} className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={String(i)}
                      checked={selectedIndex === i}
                      onChange={() =>
                        setAnswers((p) => ({
                          ...p,
                          [q.id]: i, // ✅ index 저장
                        }))
                      }
                      className="mt-[3px]"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                className="mt-2 w-full min-h-[88px] rounded-lg bg-black/20 border border-white/10 p-2 text-sm outline-none"
                value={typeof answers[q.id] === "string" ? answers[q.id] : ""}
                onChange={(e) =>
                  setAnswers((p) => ({ ...p, [q.id]: e.target.value }))
                }
                placeholder="정답을 입력하세요"
              />
            )}
          </div>
        );
      })}

      <Button
        className="w-full"
        disabled={!canSubmit || submitting}
        onClick={submit}
      >
        {submitting ? "채점/제출 중..." : "문제 제출(채점)"}
      </Button>
    </div>
  );
}
