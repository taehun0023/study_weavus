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

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const questionOrder = useMemo(
    () => questions.map((q) => Number(q.id)).filter((n) => Number.isFinite(n)),
    [questions]
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

      // ✅ 응답이 JSON이 아닐 수도 있으니 방어
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

      // ✅ 성공하면 결과 페이지로 이동
      // 기존에 from(lessonId) 쿼리가 있으면 그대로 넘김
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

      {questions.map((q, idx) => (
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
                    checked={answers[q.id] === opt}
                    onChange={() => setAnswers((p) => ({ ...p, [q.id]: opt }))}
                    className="mt-[3px]"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          ) : (
            <textarea
              className="mt-2 w-full min-h-[88px] rounded-lg bg-black/20 border border-white/10 p-2 text-sm outline-none"
              value={answers[q.id] ?? ""}
              onChange={(e) =>
                setAnswers((p) => ({ ...p, [q.id]: e.target.value }))
              }
              placeholder="정답을 입력하세요"
            />
          )}
        </div>
      ))}

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
