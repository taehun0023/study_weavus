"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/rich-text";
import HighlightOnView from "@/components/highlight-on-view";
import CodeBlockEnhancer from "@/components/codeblock-enhancer";

type Question = {
  id: string;
  questionText: string;
  questionType: "multiple_choice" | "short_answer" | "true_false";
  options?: string[];
};

function isBlank(v: any) {
  return v == null || (typeof v === "string" && v.trim() === "");
}

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

  /**
   * ✅ 다시풀기(prefill) 로직
   * - 빈값("")/공백은 무조건 무시 (미작성 유지)
   * - 객관식 index는 0..options.length-1 범위만 허용
   * - 객관식 문자열은 옵션 텍스트 매칭으로만 변환
   *
   * ⚠️ UI는 그대로. 로직만 안전하게.
   */
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
        const qid = String(q.id);
        const v = saved[qid];

        // ✅ 미작성은 prefill 금지
        if (v == null) continue;
        if (typeof v === "string" && v.trim() === "") continue;

        if (q.questionType === "multiple_choice") {
          const opts = q.options ?? [];

          // 1) 숫자 index로 들어온 경우: 범위 체크 필수
          if (typeof v === "number" && Number.isFinite(v)) {
            if (v >= 0 && v < opts.length) {
              next[qid] = v;
            }
            continue;
          }

          // 2) 문자열이 숫자처럼 들어온 경우: "" 방어 + 범위 체크
          const s = String(v);
          if (s.trim() === "") continue;
          const n = Number(s);
          if (Number.isFinite(n) && n >= 0 && n < opts.length) {
            next[qid] = n;
            continue;
          }

          // 3) 옵션 텍스트로 들어온 경우: 동일 텍스트 찾아서 index로
          const idx = opts.findIndex((opt) => opt === s);
          if (idx >= 0) {
            next[qid] = idx;
          }
        } else {
          // short_answer: 공백만 있는 값은 미작성으로 취급
          const s = String(v);
          if (s.trim().length > 0) {
            next[qid] = s;
          }
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
      /**
       * ✅ 제출 payload 정리
       * - 객관식: 선택한 것만 (숫자 index)
       * - 서술형: 빈 문자열이면 굳이 보내지 않아도 되지만,
       *   서버가 isBlank로 처리하게 "그대로" 보내도 괜찮음.
       *
       * 다만 "미작성 key 자체를 없애면" 서버/DB에서도 더 깔끔함.
       */
      const cleanedAnswers: Record<string, any> = {};
      for (const q of questions) {
        const key = String(q.id);
        const v = answers[key];

        if (q.questionType === "multiple_choice") {
          if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
            cleanedAnswers[key] = v;
          }
        } else {
          if (typeof v === "string" && v.trim().length > 0) {
            cleanedAnswers[key] = v;
          }
        }
      }

      const payload = { answers: cleanedAnswers, questionOrder };

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
      <HighlightOnView selector=".study-richtext" />
      <CodeBlockEnhancer selector=".study-richtext.ql-editor" />

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
        {
          /* 문제 지문 */
        }
        {
          q.questionText && (
            <div className="mb-4">
              <RichText className="study-richtext" html={q.questionText} />
            </div>
          );
        }

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
                  className="study-richtext ql-editor"
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
                        <RichText className="study-richtext" html={opt} />
                      ) : (
                        <div className="leading-relaxed">{opt}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            ) : q.questionType === "true_false" ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-3">
                  {(
                    [
                      { label: "O", value: "true" },
                      { label: "X", value: "false" },
                    ] as const
                  ).map((item) => {
                    const selected = String(answers[q.id] ?? "") === item.value;
                    return (
                      <label
                        key={item.value}
                        className={`group flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm transition ${
                          selected
                            ? "border-primary/40 bg-primary/10"
                            : "border-white/10 bg-black/10 hover:border-primary/25"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={item.value}
                          checked={selected}
                          onChange={() =>
                            setAnswers((p) => ({ ...p, [q.id]: item.value }))
                          }
                          className="mt-0.5"
                        />
                        <span className="font-medium">{item.label}</span>
                      </label>
                    );
                  })}
                </div>
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
