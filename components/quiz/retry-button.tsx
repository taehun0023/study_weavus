"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  quizId: number;
  /** questionId(string) -> saved answer (number for MC, string for short) */
  answers: Record<string, any>;
};

export default function RetryButton({ quizId, answers }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  function onRetry() {
    try {
      const key = `quiz_retry_${quizId}`;
      localStorage.setItem(key, JSON.stringify({ answers }));
    } catch {
      // ignore
    }

    const from = sp.get("from");
    const qs = from ? `?from=${encodeURIComponent(from)}` : "";
    router.push(`/quiz/${quizId}${qs}`);
    router.refresh();
  }

  return (
    <Button onClick={onRetry}>
      <RotateCcw className="h-4 w-4 mr-2" />
      다시 풀기
    </Button>
  );
}
