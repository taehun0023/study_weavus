"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type JapaneseLevel = "N1" | "N2" | "N3" | "N4" | "N5";

type GeneratedPrompt = {
  level: JapaneseLevel;
  promptKo: string;
  hint: string;
};

type ReviewResult = {
  result: "ok" | "fix";
  userText: string;
  correctedText: string;
  comment: string;
};

const LEVELS: JapaneseLevel[] = ["N1", "N2", "N3", "N4", "N5"];

async function safeJson<T>(res: Response): Promise<T | null> {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function markDiff(base: string, other: string) {
  const max = Math.max(base.length, other.length);
  const baseDiff = new Array(base.length).fill(false);
  const otherDiff = new Array(other.length).fill(false);

  for (let i = 0; i < max; i += 1) {
    const b = base[i] ?? "";
    const o = other[i] ?? "";
    if (b !== o) {
      if (i < base.length) baseDiff[i] = true;
      if (i < other.length) otherDiff[i] = true;
    }
  }
  return { baseDiff, otherDiff };
}

function DiffText({
  text,
  marks,
  diffClass,
}: {
  text: string;
  marks: boolean[];
  diffClass: string;
}) {
  return (
    <span className="whitespace-pre-wrap break-words">
      {text.split("").map((ch, idx) => (
        <span key={`${idx}-${ch}`} className={marks[idx] ? diffClass : ""}>
          {ch}
        </span>
      ))}
    </span>
  );
}

export default function JapaneseWritingPractice() {
  const [level, setLevel] = useState<JapaneseLevel>("N3");
  const [problem, setProblem] = useState<GeneratedPrompt | null>(null);
  const [userText, setUserText] = useState("");
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const canSubmit = useMemo(() => {
    return !!problem && userText.trim().length > 0 && !isReviewing;
  }, [problem, userText, isReviewing]);

  const diff = useMemo(() => {
    if (!review || review.result !== "fix") return null;
    return markDiff(review.correctedText, review.userText);
  }, [review]);

  async function handleGenerate() {
    setIsGenerating(true);
    setErrorMessage("");
    setReview(null);

    try {
      const res = await fetch("/api/japanese-writing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level,
          excludePrompt: problem?.promptKo ?? "",
        }),
      });

      const data = await safeJson<GeneratedPrompt & { message?: string }>(res);
      if (!res.ok || !data?.promptKo) {
        throw new Error(data?.message || "問題の生成に失敗しました。");
      }

      setProblem({
        level,
        promptKo: String(data.promptKo),
        hint: String(data.hint ?? ""),
      });
      setUserText("");
    } catch {
      setErrorMessage("問題の生成に失敗しました。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleReview() {
    if (!problem || !userText.trim() || isReviewing) return;

    setIsReviewing(true);
    setErrorMessage("");
    setReview(null);

    try {
      const res = await fetch("/api/japanese-writing/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level,
          promptKo: problem.promptKo,
          userText: userText.trim(),
        }),
      });

      const data = await safeJson<ReviewResult & { message?: string }>(res);
      if (
        !res.ok ||
        !data ||
        (data.result !== "ok" && data.result !== "fix") ||
        !data.userText ||
        !data.correctedText
      ) {
        throw new Error(data?.message || "添削に失敗しました。");
      }

      setReview({
        result: data.result,
        userText: String(data.userText),
        correctedText: String(data.correctedText),
        comment: String(data.comment ?? ""),
      });
    } catch {
      setErrorMessage("添削に失敗しました。");
    } finally {
      setIsReviewing(false);
    }
  }

  function onAnswerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (canSubmit) handleReview();
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-2xl tracking-tight">日本語作文</CardTitle>
          <p className="text-sm text-muted-foreground">
            N1〜N5レベルを選択して、韓国語の原文を日本語に自然に訳す練習ができます。
          </p>
        </CardHeader>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">レベル選択</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((candidate) => {
              const selected = candidate === level;
              return (
                <Button
                  key={candidate}
                  type="button"
                  variant={selected ? "default" : "outline"}
                  className={selected ? "" : "border-border/60"}
                  onClick={() => setLevel(candidate)}
                  disabled={isGenerating || isReviewing}
                >
                  {candidate}
                </Button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" onClick={handleGenerate} disabled={isGenerating || isReviewing}>
              {isGenerating ? "生成中..." : "作文問題を生成"}
            </Button>
            <Badge variant="outline" className="border-border/60">
              現在: {level}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {problem && (
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">作文問題</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="rounded-md border border-border/60 bg-background/60 p-3 text-sm leading-7">
              {problem.promptKo}
            </p>
            {problem.hint ? (
              <p className="text-xs text-muted-foreground">
                ヒント: {problem.hint}
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">入力</CardTitle>
          <p className="text-xs text-muted-foreground">
            下の韓国語の原文を、自然な日本語の1文として書いてください
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            onKeyDown={onAnswerKeyDown}
            placeholder="ここに日本語で作文してください"
            className="min-h-[180px] resize-y"
            disabled={isReviewing}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Ctrl+Enter / Cmd+Enter でも提出できます
            </p>
            <Button type="button" onClick={handleReview} disabled={!canSubmit}>
              {isReviewing ? "添削中..." : "添削する"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {errorMessage && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="py-4 text-sm text-destructive">
            {errorMessage}
          </CardContent>
        </Card>
      )}

      {review && review.result === "ok" && (
        <Card className="border-emerald-500/40 bg-emerald-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-emerald-300">OK</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-emerald-100">
              {review.comment || "自然な表現です。"}
            </p>
          </CardContent>
        </Card>
      )}

      {review && review.result === "fix" && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">添削結果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                あなたの入力
              </p>
              <div className="rounded-md border border-border/60 bg-background/60 p-3 text-sm">
                {diff ? (
                  <DiffText
                    text={review.userText}
                    marks={diff.otherDiff}
                    diffClass="bg-red-500/25 text-red-100 rounded-sm"
                  />
                ) : (
                  <span className="whitespace-pre-wrap break-words">{review.userText}</span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                正しい表現
              </p>
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                {diff ? (
                  <DiffText
                    text={review.correctedText}
                    marks={diff.baseDiff}
                    diffClass="bg-emerald-500/30 text-emerald-100 rounded-sm"
                  />
                ) : (
                  <span className="whitespace-pre-wrap break-words">
                    {review.correctedText}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                修正ポイント
              </p>
              <div className="rounded-md border border-border/60 bg-background/60 p-3 text-sm whitespace-pre-wrap">
                {review.comment}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
