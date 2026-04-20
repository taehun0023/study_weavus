"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ReviewIssue = {
  original: string;
  problem: string;
  reason: string;
  fix: string;
};

type ReviewResult = {
  estimatedTranscript: string;
  overall: string;
  strengths: string[];
  issues: ReviewIssue[];
  pronunciationPoints: string[];
  naturalVersion: string;
  practiceTips: string[];
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

async function readErrorMessage(res: Response, fallback: string) {
  const data = await safeJson<{ message?: string }>(res);
  if (data?.message && String(data.message).trim()) {
    return String(data.message).trim();
  }
  return fallback;
}

export default function JapaneseSpeakingPractice() {
  const [file, setFile] = useState<File | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [review, setReview] = useState<ReviewResult | null>(null);

  async function handleReview() {
    if (!file || isReviewing) return;

    setIsReviewing(true);
    setErrorMessage("");
    setReview(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/japanese-speaking/review", {
        method: "POST",
        body: formData,
      });

      const data = await safeJson<ReviewResult>(res);
      if (!res.ok || !data?.overall) {
        const message = await readErrorMessage(res, "音声評価に失敗しました。");
        throw new Error(message);
      }

      setReview({
        estimatedTranscript: String(data.estimatedTranscript ?? ""),
        overall: String(data.overall ?? ""),
        strengths: Array.isArray(data.strengths) ? data.strengths : [],
        issues: Array.isArray(data.issues) ? data.issues : [],
        pronunciationPoints: Array.isArray(data.pronunciationPoints)
          ? data.pronunciationPoints
          : [],
        naturalVersion: String(data.naturalVersion ?? ""),
        practiceTips: Array.isArray(data.practiceTips) ? data.practiceTips : [],
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "音声評価に失敗しました。";
      setErrorMessage(message);
    } finally {
      setIsReviewing(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-2xl tracking-tight">日本語音声評価</CardTitle>
          <p className="text-sm text-muted-foreground">
            일본어 녹음 파일을 업로드하면 발음, 억양, 문법, 자연스러움을 면접/회화 관점으로 평가합니다.
          </p>
        </CardHeader>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">音声アップロード</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border/60 file:bg-background file:px-3 file:py-2 file:text-sm"
            disabled={isReviewing}
          />

          <div className="flex items-center gap-3">
            <Button type="button" onClick={handleReview} disabled={!file || isReviewing}>
              {isReviewing ? "分析中..." : "評価する"}
            </Button>
            {file ? (
              <Badge variant="outline" className="border-border/60">
                {file.name}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {errorMessage ? (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="py-4 text-sm text-destructive">{errorMessage}</CardContent>
        </Card>
      ) : null}

      {review ? (
        <div className="space-y-4">
          <Card className="border-border/60 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">1. 전체 총평</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 whitespace-pre-wrap">
              {review.overall}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">2. 잘한 점</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm space-y-2">
                {(review.strengths.length ? review.strengths : ["강점이 명확하지 않으면 발화 분량을 조금 더 길게 녹음해 주세요."]).map((item, idx) => (
                  <li key={`${idx}-${item}`}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-amber-500/40 bg-amber-500/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">3. 어색하거나 틀린 부분</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {review.issues.length === 0 ? (
                <p className="text-sm">명확한 오류가 두드러지지 않습니다.</p>
              ) : (
                review.issues.map((issue, idx) => (
                  <div key={`${idx}-${issue.problem}`} className="rounded-md border border-border/60 bg-background/60 p-3 text-sm space-y-1">
                    <p><span className="text-muted-foreground">추정 원문:</span> {issue.original || "(추정 불가)"}</p>
                    <p><span className="text-muted-foreground">문제:</span> {issue.problem}</p>
                    <p><span className="text-muted-foreground">이유:</span> {issue.reason}</p>
                    <p><span className="text-muted-foreground">수정:</span> {issue.fix}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">4. 발음에서 특히 고쳐야 할 포인트</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm space-y-2">
                {(review.pronunciationPoints.length
                  ? review.pronunciationPoints
                  : ["장음/촉음(っ)/탁음 구분을 더 또렷하게 연습해 보세요."]).map((item, idx) => (
                  <li key={`${idx}-${item}`}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/40 bg-emerald-500/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">5. 더 자연스러운 일본어 수정본</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 whitespace-pre-wrap">
              {review.naturalVersion || "修正文が生成できませんでした。"}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">6. 다시 연습할 때 주의할 점</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm space-y-2">
                {(review.practiceTips.length
                  ? review.practiceTips
                  : ["같은 문장을 3회 반복 녹음해서 억양 안정성을 먼저 맞춰 보세요."]).map((item, idx) => (
                  <li key={`${idx}-${item}`}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">추정 전사 문장</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 whitespace-pre-wrap">
              {review.estimatedTranscript || "음성에서 문장을 안정적으로 추출하지 못했습니다."}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
