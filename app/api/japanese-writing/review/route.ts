import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  containsJapaneseText,
  generateJapaneseReferenceAnswer,
  reviewJapaneseWriting,
  type JapaneseLevel,
  type WritingReviewResult,
} from "@/lib/japanese-writing-ai";
import { insertJapaneseWritingHistory } from "@/lib/japanese-writing-history";

export const runtime = "nodejs";

type ReviewRequest = {
  level?: string;
  promptKo?: string;
  userText?: string;
};

function parseLevel(input: unknown): JapaneseLevel | null {
  const value = String(input ?? "").trim().toUpperCase();
  if (value === "N1" || value === "N2" || value === "N3" || value === "N4" || value === "N5") {
    return value;
  }
  return null;
}

function finalizeReview(args: {
  review: WritingReviewResult;
  userText: string;
  referenceAnswer: string;
}) {
  const userText = String(args.userText ?? "").trim();
  const hasJapaneseInput = containsJapaneseText(userText);

  let result: "ok" | "fix" = args.review.result;
  let correctedText = String(args.review.correctedText ?? "").trim();
  let comment = String(args.review.comment ?? "").trim();

  if (!hasJapaneseInput) {
    result = "fix";
    comment = "일본어로 작성해 주세요. 현재 입력은 일본어 문장이 아닙니다.";
  }

  if (result === "fix") {
    const correctedLooksInvalid =
      !containsJapaneseText(correctedText) || correctedText === userText;
    if (correctedLooksInvalid) {
      correctedText = args.referenceAnswer;
    }
    if (!comment) {
      comment = "문법, 조사, 어휘, 문장 흐름을 자연스럽게 수정했습니다.";
    }
  }

  if (result === "ok" && !comment) {
    comment = "自然で正しい表現です。";
  }

  return {
    result,
    userText,
    correctedText: correctedText || args.referenceAnswer,
    comment,
  } satisfies WritingReviewResult;
}

function buildFallbackReview(args: {
  userText: string;
  referenceAnswer: string;
}): WritingReviewResult {
  const userText = String(args.userText ?? "").trim();
  const hasJapaneseInput = containsJapaneseText(userText);

  if (!hasJapaneseInput) {
    return {
      result: "fix",
      userText,
      correctedText: "日本語で書いてください。",
      comment: "현재 입력은 일본어 문장이 아닙니다. 한국어 문제를 보고 일본어로 작성해 주세요.",
    };
  }

  return {
    result: "fix",
    userText,
    correctedText: args.referenceAnswer || userText,
    comment:
      "AI 첨삭 연결이 일시적으로 불안정합니다. 잠시 후 다시 시도해 주세요.",
  };
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as ReviewRequest | null;
    const level = parseLevel(body?.level);
    const promptKo = String(body?.promptKo ?? "").trim();
    const userText = String(body?.userText ?? "").trim();

    if (!level) {
      return NextResponse.json({ message: "Invalid level" }, { status: 400 });
    }
    if (!promptKo) {
      return NextResponse.json(
        { message: "promptKo is required" },
        { status: 400 },
      );
    }
    if (!userText) {
      return NextResponse.json({ message: "userText is required" }, { status: 400 });
    }

    let referenceAnswer = "";
    try {
      referenceAnswer = await generateJapaneseReferenceAnswer({
        level,
        promptKo,
      });
    } catch {
      referenceAnswer = "日本語で自然な文になるように、語彙と文法を見直してください。";
    }

    let rawReview: WritingReviewResult;
    try {
      rawReview = await reviewJapaneseWriting({
        level,
        promptKo,
        userText,
      });
    } catch (reviewError) {
      console.error("Failed to review japanese writing, fallback used", reviewError);
      rawReview = buildFallbackReview({
        userText,
        referenceAnswer,
      });
    }

    const review = finalizeReview({
      review: rawReview,
      userText,
      referenceAnswer,
    });

    try {
      await insertJapaneseWritingHistory({
        userId: user.id,
        level,
        promptKo,
        review,
      });
    } catch (historyError) {
      console.error("Failed to save japanese writing history", historyError);
    }

    return NextResponse.json(review);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to review writing";
    return NextResponse.json({ message }, { status: 500 });
  }
}
