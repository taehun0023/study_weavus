"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type JapaneseLevel = "N1" | "N2" | "N3" | "N4" | "N5";
type CountReason = "COUNTED" | "INCORRECT" | "LEVEL_MISMATCH" | "ALREADY_COUNTED";

type GeneratedPrompt = {
  id: string;
  level: JapaneseLevel;
  promptKo: string;
  hint: string;
};

type ReviewResult = {
  result: "ok" | "fix";
  userText: string;
  correctedText: string;
  comment: string;
  isCorrect: boolean;
  counted: boolean;
  reason: CountReason;
  todayCount: number;
  targetCount: number;
  userLevel: JapaneseLevel;
  problemLevel: JapaneseLevel;
};

type WritingStatus = {
  userLevel: JapaneseLevel;
  todayCount: number;
  targetCount: number;
};

const LEVELS: JapaneseLevel[] = ["N1", "N2", "N3", "N4", "N5"];
const YOMIKATA_DICT: Record<string, string> = {
  会議: "かいぎ",
  提案: "ていあん",
  採用: "さいよう",
  議論: "ぎろん",
  方向性: "ほうこうせい",
  技術: "ぎじゅつ",
  発展: "はってん",
  社会: "しゃかい",
  信頼: "しんらい",
  自由: "じゆう",
  責任: "せきにん",
  制度: "せいど",
  規範: "きはん",
  維持: "いじ",
  通勤: "つうきん",
  協働: "きょうどう",
  帰属意識: "きぞくいしき",
  生活: "せいかつ",
  都市: "とし",
  利便性: "りべんせい",
  疲労: "ひろう",
  蓄積: "ちくせき",
  原文: "げんぶん",
  構造: "こうぞう",
  理解: "りかい",
  支度: "したく",
  遅刻: "ちこく",
  家族: "かぞく",
  食事: "しょくじ",
  出来事: "できごと",
  雰囲気: "ふんいき",
  先週: "せんしゅう",
  計画: "けいかく",
  達成感: "たっせいかん",
  出勤: "しゅっきん",
  集中: "しゅうちゅう",
  効率: "こうりつ",
  最近: "さいきん",
  翻訳: "ほんやく",
  韓国語: "かんこくご",
  日本語: "にほんご",
};

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

function reasonToText(reason: CountReason) {
  switch (reason) {
    case "COUNTED":
      return "카운트 반영 완료";
    case "INCORRECT":
      return "오답(정답 완전 일치 아님)";
    case "LEVEL_MISMATCH":
      return "내 등급과 문제 난이도가 달라 카운트 미반영";
    case "ALREADY_COUNTED":
      return "동일 제출은 이미 카운트 반영됨";
    default:
      return "카운트 미반영";
  }
}

export default function JapaneseWritingPractice() {
  const [level, setLevel] = useState<JapaneseLevel>("N3");
  const [problem, setProblem] = useState<GeneratedPrompt | null>(null);
  const [userText, setUserText] = useState("");
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [status, setStatus] = useState<WritingStatus | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedYomikata, setSelectedYomikata] = useState<{
    word: string;
    reading: string;
  } | null>(null);

  const canSubmit = useMemo(() => {
    return !!problem && userText.trim().length > 0 && !isReviewing;
  }, [problem, userText, isReviewing]);

  const diff = useMemo(() => {
    if (!review || review.result !== "fix") return null;
    return markDiff(review.correctedText, review.userText);
  }, [review]);

  const todayCount = review?.todayCount ?? status?.todayCount ?? 0;
  const targetCount = review?.targetCount ?? status?.targetCount ?? 30;
  const userLevel = review?.userLevel ?? status?.userLevel ?? "N3";
  const reachedTarget = todayCount >= targetCount;
  const levelMismatch = !!problem && userLevel !== problem.level;
  const yomikataWords = useMemo(() => {
    const text = review?.correctedText ?? "";
    return Object.entries(YOMIKATA_DICT).filter(([word]) => text.includes(word));
  }, [review?.correctedText]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/japanese-writing/status", { method: "GET" });
      const data = await safeJson<WritingStatus & { message?: string }>(res);
      if (!mounted) return;
      if (res.ok && data?.userLevel) {
        setStatus({
          userLevel: data.userLevel,
          todayCount: Number(data.todayCount ?? 0),
          targetCount: Number(data.targetCount ?? 30),
        });
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function generateNextProblem() {
    setIsGenerating(true);
    setErrorMessage("");
    setReview(null);

    try {
      const res = await fetch("/api/japanese-writing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level,
          excludeId: problem?.id ?? "",
          excludePrompt: problem?.promptKo ?? "",
        }),
      });

      const data = await safeJson<GeneratedPrompt & { message?: string }>(res);
      if (!res.ok || !data?.promptKo) {
        const apiMessage =
          data?.message && String(data.message).trim()
            ? String(data.message).trim()
            : "問題の生成に失敗しました。";
        throw new Error(
          apiMessage,
        );
      }

      setProblem({
        id: String(data.id ?? ""),
        level,
        promptKo: String(data.promptKo),
        hint: String(data.hint ?? ""),
      });
      setUserText("");
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "問題の生成に失敗しました。";
      setErrorMessage(message);
      setProblem(null);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGenerate() {
    await generateNextProblem();
  }

  async function handleReview() {
    if (!problem || !userText.trim() || isReviewing) return;

    setIsReviewing(true);
    setErrorMessage("");
    setReview(null);
    setSelectedYomikata(null);

    try {
      const res = await fetch("/api/japanese-writing/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level,
          promptId: problem.id,
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

      const nextReview: ReviewResult = {
        result: data.result,
        userText: String(data.userText),
        correctedText: String(data.correctedText),
        comment: String(data.comment ?? ""),
        isCorrect: Boolean(data.isCorrect),
        counted: Boolean(data.counted),
        reason: data.reason,
        todayCount: Number(data.todayCount ?? 0),
        targetCount: Number(data.targetCount ?? 30),
        userLevel: data.userLevel,
        problemLevel: data.problemLevel,
      };
      setStatus({
        userLevel: nextReview.userLevel,
        todayCount: nextReview.todayCount,
        targetCount: nextReview.targetCount,
      });
      if (nextReview.result === "ok") {
        setReview(null);
        setUserText("");
        await generateNextProblem();
        return;
      }
      setReview(nextReview);
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
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-border/60">
              내 일본어 등급: {userLevel}
            </Badge>
            <Badge
              variant="outline"
              className={
                reachedTarget
                  ? "border-emerald-500/60 text-emerald-300"
                  : "border-border/60"
              }
            >
              오늘 카운트: {todayCount} / {targetCount}
            </Badge>
            {problem ? (
              <Badge variant="outline" className="border-border/60">
                현재 문제: {problem.level}
              </Badge>
            ) : null}
          </div>
        </CardContent>
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
              선택 난이도: {level}
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
            {levelMismatch ? (
              <p className="text-xs text-amber-300">
                이 문제는 현재 내 등급 카운트에 반영되지 않습니다.
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
          <CardContent className="py-4 text-sm text-destructive">{errorMessage}</CardContent>
        </Card>
      )}

      {review && review.result === "ok" && (
        <Card className="border-emerald-500/40 bg-emerald-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-emerald-300">OK</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-emerald-100">{review.comment || "自然な表現です。"}</p>
            <p className="text-xs text-muted-foreground">
              카운트 결과: {reasonToText(review.reason)}
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
            <p className="text-xs text-muted-foreground">
              카운트 결과: {reasonToText(review.reason)}
            </p>
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
                  <span className="whitespace-pre-wrap break-words">{review.correctedText}</span>
                )}
              </div>
              {yomikataWords.length > 0 ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    한자를 누르면 요미카타가 표시됩니다.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {yomikataWords.map(([word, reading]) => (
                      <button
                        key={`${word}-${reading}`}
                        type="button"
                        onClick={() => setSelectedYomikata({ word, reading })}
                        className="rounded-md border border-emerald-500/40 bg-background/50 px-2 py-1 text-xs hover:bg-emerald-500/10"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                  {selectedYomikata ? (
                    <p className="text-xs text-emerald-200">
                      {selectedYomikata.word}: {selectedYomikata.reading}
                    </p>
                  ) : null}
                </div>
              ) : null}
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
