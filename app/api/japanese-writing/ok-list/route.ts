import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserJapaneseWritingOkList } from "@/lib/japanese-writing-history";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const items = await getUserJapaneseWritingOkList(user.id);
    return NextResponse.json({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load writing ok list";
    return NextResponse.json({ message }, { status: 500 });
  }
}

