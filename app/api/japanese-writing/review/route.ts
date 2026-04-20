import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  generateJapaneseReferenceAnswer,
  type JapaneseLevel,
  type WritingReviewResult,
} from "@/lib/japanese-writing-ai";
import {
  JAPANESE_WRITING_DAILY_TARGET,
  getUserJapaneseLevel,
  recordJapaneseWritingAttempt,
} from "@/lib/japanese-writing-history";

export const runtime = "nodejs";

type ReviewRequest = {
  level?: string;
  promptId?: string;
  promptKo?: string;
  userText?: string;
};

function normalizeForStrictMatch(input: string) {
  return String(input ?? "")
    .trim()
    .replaceAll("、", "")
    .replaceAll("。", "");
}

function buildMismatchComment(userText: string, correctedText: string) {
  const user = String(userText ?? "");
  const correct = String(correctedText ?? "");

  if (!user.trim()) {
    return "입력 문장이 비어 있습니다. 정답 문장을 보며 처음부터 다시 작성해 보세요.";
  }

  const min = Math.min(user.length, correct.length);
  let firstDiff = -1;
  for (let i = 0; i < min; i += 1) {
    if (user[i] !== correct[i]) {
      firstDiff = i;
      break;
    }
  }

  if (firstDiff === -1 && user.length !== correct.length) {
    const missing = user.length < correct.length;
    const tail = missing
      ? correct.slice(user.length, Math.min(user.length + 8, correct.length))
      : user.slice(correct.length, Math.min(correct.length + 8, user.length));
    return missing
      ? `문장 뒤쪽이 부족합니다. 뒤에 "${tail}" 부분이 더 필요합니다.`
      : `문장 뒤쪽에 불필요한 입력이 있습니다. "${tail}" 부분을 정리해 보세요.`;
  }

  if (firstDiff >= 0) {
    const expected = correct[firstDiff] ?? "(없음)";
    const got = user[firstDiff] ?? "(없음)";
    const nearStart = Math.max(0, firstDiff - 6);
    const nearEnd = Math.min(correct.length, firstDiff + 6);
    const expectedNear = correct.slice(nearStart, nearEnd);
    return `앞에서 ${firstDiff + 1}번째 글자부터 다릅니다. 정답은 "${expected}"인데 입력은 "${got}"입니다. 근처 정답 표현: "${expectedNear}"`;
  }

  return "정답 문장과 완전히 동일하지 않습니다. 글자 하나씩 다시 비교해 보세요.";
}

function parseLevel(input: unknown): JapaneseLevel | null {
  const value = String(input ?? "").trim().toUpperCase();
  if (value === "N1" || value === "N2" || value === "N3" || value === "N4" || value === "N5") {
    return value;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as ReviewRequest | null;
    const level = parseLevel(body?.level);
    const promptId = String(body?.promptId ?? "").trim();
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
        promptId,
        promptKo,
      });
    } catch {
      return NextResponse.json(
        { message: "문제를 다시 생성한 뒤 채점해 주세요." },
        { status: 400 },
      );
    }

    const trimmedUserText = userText.trim();
    const trimmedCorrected = referenceAnswer.trim();
    const isCorrect =
      normalizeForStrictMatch(trimmedUserText) ===
      normalizeForStrictMatch(trimmedCorrected);

    const review: WritingReviewResult = {
      result: isCorrect ? "ok" : "fix",
      userText: trimmedUserText,
      correctedText: trimmedCorrected,
      comment: isCorrect
        ? "完全に一致しています。"
        : buildMismatchComment(trimmedUserText, trimmedCorrected),
    };

    const userLevel = await getUserJapaneseLevel(user.id);
    const countResult = await recordJapaneseWritingAttempt({
      userId: user.id,
      userLevel,
      problemLevel: level,
      promptId,
      promptKo,
      userText: review.userText,
      correctedText: review.correctedText,
      result: review.result,
      comment: review.comment,
    });

    return NextResponse.json({
      ...review,
      isCorrect,
      counted: countResult.counted,
      reason: countResult.reason,
      todayCount: countResult.todayCount,
      targetCount: JAPANESE_WRITING_DAILY_TARGET,
      userLevel,
      problemLevel: level,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to review writing";
    return NextResponse.json({ message }, { status: 500 });
  }
}
