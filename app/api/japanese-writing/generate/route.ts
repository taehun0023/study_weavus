import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  generateJapaneseWritingPrompt,
  type JapaneseLevel,
} from "@/lib/japanese-writing-ai";
import { getSolvedPromptIdsByLevel } from "@/lib/japanese-writing-history";

export const runtime = "nodejs";

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

    const body = (await req.json().catch(() => null)) as {
      level?: string;
      excludePrompt?: string;
      excludeId?: string;
    } | null;
    const level = parseLevel(body?.level);
    if (!level) {
      return NextResponse.json({ message: "Invalid level" }, { status: 400 });
    }

    const generated = await generateJapaneseWritingPrompt({
      level,
      excludePrompt: String(body?.excludePrompt ?? "").trim(),
      excludeId: String(body?.excludeId ?? "").trim(),
      excludeIds: await getSolvedPromptIdsByLevel({
        userId: user.id,
        level,
      }),
    });
    return NextResponse.json(generated);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate writing prompt";
    return NextResponse.json({ message }, { status: 500 });
  }
}
