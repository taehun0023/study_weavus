"use client";

import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RetryWithPrefillButton({
  quizId,
  answers,
}: {
  quizId: number;
  answers: Record<string, any>;
}) {
  const router = useRouter();

  function onRetry() {
    try {
      const key = `study:quiz_prefill:${quizId}`;
      window.localStorage.setItem(key, JSON.stringify({ answers }));
    } catch {
      // ignore
    }

    router.push(`/quiz/${quizId}`);
    router.refresh();
  }

  return (
    <Button onClick={onRetry}>
      <RotateCcw className="h-4 w-4 mr-2" />
      다시 풀기
    </Button>
  );
}
