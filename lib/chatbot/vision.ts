import OpenAI from "openai";

const DEFAULT_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-4o";
function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return apiKey;
}
let client: OpenAI | null = null;

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: getApiKey() });
  }
  return client;
}

function buildDataUrl(imageBase64: string, mimeType: string) {
  return `data:${mimeType};base64,${imageBase64}`;
}

function extractOutputText(payload: { output_text?: string; output?: unknown[] }) {
  const direct = String(payload.output_text ?? "").trim();
  if (direct) return direct;

  const chunks: string[] = [];
  for (const item of payload.output ?? []) {
    if (typeof item !== "object" || item === null) continue;
    const content = Reflect.get(item, "content");
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== "object" || part === null) continue;
      const textObj = Reflect.get(part, "text");
      if (typeof textObj === "string" && textObj.trim()) {
        chunks.push(textObj.trim());
        continue;
      }
      if (typeof textObj === "object" && textObj !== null) {
        const value = Reflect.get(textObj, "value");
        if (typeof value === "string" && value.trim()) {
          chunks.push(value.trim());
        }
      }
    }
  }

  return chunks.join("\n").trim();
}

export async function askVision(
  question: string,
  imageBase64: string,
  mimeType = "image/png",
) {
  const ocrGuardPrompt = [
    "이미지에서 보이는 정보만 추출해서 답변하세요.",
    "추측/보정 금지, 불명확하면 (判読不能)로 표시하세요.",
    "날짜/숫자는 원문 그대로 유지하세요.",
  ].join("\n");
  const response = await getClient().responses.create({
    model: DEFAULT_MODEL,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: ocrGuardPrompt }],
      },
      {
        role: "user",
        content: [
          { type: "input_text", text: question },
          {
            type: "input_image",
            image_url: buildDataUrl(imageBase64, mimeType),
            detail: "high",
          },
        ],
      },
    ],
  });

  return (
    extractOutputText({ output_text: response.output_text, output: response.output }) ||
    "No answer generated."
  );
}

export async function askText(question: string) {
  const response = await getClient().responses.create({
    model: DEFAULT_MODEL,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: question }],
      },
    ],
  });

  return (
    extractOutputText({ output_text: response.output_text, output: response.output }) ||
    "No answer generated."
  );
}
