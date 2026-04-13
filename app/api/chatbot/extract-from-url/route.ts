import { NextResponse } from "next/server";
import { extractImagesFromPage } from "@/lib/chatbot/scrape";
import { askVision } from "@/lib/chatbot/vision";
import type { ExtractFromUrlRequest } from "@/types/chatbot";

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

function validatePayload(payload: unknown): ExtractFromUrlRequest {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Invalid payload");
  }

  const url = String(Reflect.get(payload, "url") ?? "").trim();
  const question = String(Reflect.get(payload, "question") ?? "").trim();

  if (!url) throw new Error("url is required");
  if (!question) throw new Error("question is required");

  return { url, question };
}

export async function POST(req: Request) {
  try {
    const json = (await req.json().catch(() => null)) as unknown;
    const { url, question } = validatePayload(json);

    const { imageUrls, screenshotBase64 } = await extractImagesFromPage(url);

    const prompt = [
      `User question: ${question}`,
      "",
      "You are given a full-page screenshot of the target webpage.",
      "Use the screenshot as the primary evidence.",
      imageUrls.length > 0
        ? `Extracted image URLs (${imageUrls.length}):\n${imageUrls.slice(0, 20).join("\n")}`
        : "No image URLs were extracted.",
    ].join("\n");

    const answer = await askVision(prompt, screenshotBase64, "image/png");

    return new Response(streamText(answer), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to extract from url";
    return NextResponse.json<ErrorBody>({ message }, { status: 500 });
  }
}
