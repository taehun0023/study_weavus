import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  JAPANESE_WRITING_DAILY_TARGET,
  getTodayJapaneseWritingCount,
  getUserJapaneseLevel,
} from "@/lib/japanese-writing-history";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userLevel = await getUserJapaneseLevel(user.id);
    const todayCount = await getTodayJapaneseWritingCount(user.id);

    return NextResponse.json({
      userLevel,
      todayCount,
      targetCount: JAPANESE_WRITING_DAILY_TARGET,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch writing status";
    return NextResponse.json({ message }, { status: 500 });
  }
}

