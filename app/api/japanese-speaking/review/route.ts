import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reviewJapaneseSpeakingAudio } from "@/lib/japanese-speaking-ai";

export const runtime = "nodejs";

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
  "audio/m4a",
  "audio/flac",
  "audio/x-flac",
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ message: "file is required" }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ message: "empty file is not allowed" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: "file is too large (max 20MB)" },
        { status: 400 },
      );
    }

    const mimeType = String(file.type || "").toLowerCase();
    if (mimeType && !ALLOWED_AUDIO_TYPES.has(mimeType)) {
      return NextResponse.json({ message: "unsupported audio type" }, { status: 400 });
    }

    const audioBuffer = Buffer.from(await file.arrayBuffer());
    const review = await reviewJapaneseSpeakingAudio({
      fileName: file.name || "recording.webm",
      mimeType: file.type || "audio/webm",
      audioBuffer,
    });

    return NextResponse.json(review);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to review speaking audio";
    return NextResponse.json({ message }, { status: 500 });
  }
}

