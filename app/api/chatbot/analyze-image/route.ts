import { NextResponse } from "next/server";
import { askVision } from "@/lib/chatbot/vision";

export const runtime = "nodejs";

type ErrorBody = {
  message: string;
};

function streamText(text: string) {
  const encoder = new TextEncoder();
  const chunkSize = 40;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let offset = 0;
      const timer = setInterval(() => {
        const next = text.slice(offset, offset + chunkSize);
        if (!next) {
          clearInterval(timer);
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(next));
        offset += chunkSize;
      }, 12);
    },
  });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("image");
    const question = String(formData.get("question") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json<ErrorBody>(
        { message: "image is required" },
        { status: 400 },
      );
    }
    if (!question) {
      return NextResponse.json<ErrorBody>(
        { message: "question is required" },
        { status: 400 },
      );
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json<ErrorBody>(
        { message: "Only image files are supported" },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const imageBase64 = Buffer.from(arrayBuffer).toString("base64");

    const answer = await askVision(question, imageBase64, file.type || "image/png");

    return new Response(streamText(answer), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to analyze image";
    return NextResponse.json<ErrorBody>({ message }, { status: 500 });
  }
}
