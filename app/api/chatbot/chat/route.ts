import { NextResponse } from "next/server";
import { askText } from "@/lib/chatbot/vision";

export const runtime = "nodejs";

type ErrorBody = {
  message: string;
};

type ChatBody = {
  question: string;
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
    const body = (await req.json().catch(() => null)) as ChatBody | null;
    const question = String(body?.question ?? "").trim();

    if (!question) {
      return NextResponse.json<ErrorBody>(
        { message: "question is required" },
        { status: 400 },
      );
    }

    const answer = await askText(question);
    return new Response(streamText(answer), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to chat";
    return NextResponse.json<ErrorBody>({ message }, { status: 500 });
  }
}
