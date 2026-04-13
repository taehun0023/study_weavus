import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  containsJapaneseText,
  enforceCorrectedText,
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
  return {
    result: "fix",
    userText,
    correctedText: args.referenceAnswer || "日本語で書いてください。",
    comment: "AI 첨삭 연결이 일시적으로 불안정하여 임시 모범 답안을 표시합니다.",
  };
}

function buildStaticReferenceAnswer(level: JapaneseLevel, promptKo: string) {
  const p = String(promptKo ?? "");

  if (/(영화|친구|재미|인상)/.test(p)) {
    return "昨日、友達と映画を見ました。本当におもしろかったです。";
  }
  if (/(주말|휴일|休日|여행|산책)/.test(p)) {
    return "週末は家族と公園へ行って、ゆっくり散歩しました。";
  }
  if (/(비교|의견|찬성|반대|온라인|오프라인)/.test(p)) {
    return "私はオンライン授業にも利点があると思いますが、集中しやすいのは対面授業だと考えます。";
  }
  if (/(기술|사회|영향|논리|주장)/.test(p)) {
    return "技術の発展は生活を便利にする一方で、人間関係の希薄化を招く可能性もあると私は考えます。";
  }

  switch (level) {
    case "N5":
      return "私は毎朝七時に起きて、学校へ行きます。";
    case "N4":
      return "先週の日曜日に友達と買い物をして、とても楽しかったです。";
    case "N3":
      return "最近、忙しいですが、日本語を勉強すると達成感があるので続けています。";
    case "N2":
      return "私はこの問題について、長期的な視点で考えることが重要だと思います。";
    case "N1":
      return "社会課題を解決するには、個人の努力だけでなく制度的な支援と継続的な対話が不可欠です。";
    default:
      return "日本語で自然な文になるように、語彙と文法を見直してください。";
  }
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
      referenceAnswer = buildStaticReferenceAnswer(level, promptKo);
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

    let review = finalizeReview({
      review: rawReview,
      userText,
      referenceAnswer,
    });
    review = enforceCorrectedText({
      review,
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
