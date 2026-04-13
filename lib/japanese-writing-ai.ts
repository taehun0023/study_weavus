import OpenAI from "openai";

export type JapaneseLevel = "N1" | "N2" | "N3" | "N4" | "N5";

export type GeneratedWritingPrompt = {
  level: JapaneseLevel;
  promptKo: string;
  hint: string;
};

export type WritingReviewResult = {
  result: "ok" | "fix";
  userText: string;
  correctedText: string;
  comment: string;
};

const DEFAULT_MODEL = process.env.OPENAI_JAPANESE_WRITING_MODEL || "gpt-4o-mini";

let client: OpenAI | null = null;

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return apiKey;
}

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: getApiKey() });
  }
  return client;
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
      const text = Reflect.get(part, "text");
      if (typeof text === "string" && text.trim()) {
        chunks.push(text.trim());
        continue;
      }
      if (typeof text === "object" && text !== null) {
        const value = Reflect.get(text, "value");
        if (typeof value === "string" && value.trim()) {
          chunks.push(value.trim());
        }
      }
    }
  }

  return chunks.join("\n").trim();
}

function parseJsonObject(raw: string) {
  const text = String(raw ?? "").trim();
  if (!text) throw new Error("Empty model response");

  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1]);
    }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
  }

  throw new Error("Model response is not valid JSON");
}

function normalizeLevel(v: string): JapaneseLevel {
  const value = String(v ?? "").toUpperCase().trim();
  if (value === "N1" || value === "N2" || value === "N3" || value === "N4" || value === "N5") {
    return value;
  }
  throw new Error("Invalid level");
}

function normalizeGenerateResponse(
  input: unknown,
  level: JapaneseLevel,
): GeneratedWritingPrompt {
  const obj = typeof input === "object" && input !== null ? input : {};
  const promptKo = String(Reflect.get(obj, "promptKo") ?? "").trim();
  const hint = String(Reflect.get(obj, "hint") ?? "").trim();
  const modelLevel = String(Reflect.get(obj, "level") ?? level).trim();
  const normalizedLevel = normalizeLevel(modelLevel || level);

  if (!promptKo) {
    throw new Error("Invalid generate payload");
  }

  return {
    level: normalizedLevel,
    promptKo,
    hint,
  };
}

function fallbackPromptByLevel(level: JapaneseLevel): GeneratedWritingPrompt {
  switch (level) {
    case "N5":
      return {
        level,
        promptKo: "오늘 아침에 무엇을 했는지 일본어로 한 문장으로 써보세요.",
        hint: "기본 동사와 현재/과거형을 사용해 보세요.",
      };
    case "N4":
      return {
        level,
        promptKo: "주말에 친구와 무엇을 했는지 1~2문장으로 일본어로 써보세요.",
        hint: "시간 표현과 행동 순서를 자연스럽게 연결해 보세요.",
      };
    case "N3":
      return {
        level,
        promptKo: "최근에 기억에 남는 일을 설명하고, 왜 인상적이었는지 일본어로 써보세요.",
        hint: "경험 + 감정 + 이유를 포함해 보세요.",
      };
    case "N2":
      return {
        level,
        promptKo: "온라인 수업과 오프라인 수업을 비교하고, 자신의 의견을 일본어로 써보세요.",
        hint: "비교 표현과 이유 제시를 분명하게 써보세요.",
      };
    case "N1":
      return {
        level,
        promptKo: "기술 발전이 인간관계에 미치는 영향에 대해 자신의 견해를 일본어로 논리적으로 써보세요.",
        hint: "주장-근거-예시 구조로 작성해 보세요.",
      };
    default:
      return {
        level,
        promptKo: "자신의 하루를 일본어로 설명해 보세요.",
        hint: "문장 흐름을 자연스럽게 이어 보세요.",
      };
  }
}

function normalizeReviewResponse(
  input: unknown,
  userText: string,
): WritingReviewResult {
  const obj = typeof input === "object" && input !== null ? input : {};
  const rawResult = String(Reflect.get(obj, "result") ?? "").trim().toLowerCase();
  const comment = String(Reflect.get(obj, "comment") ?? "").trim();
  const echoedUserText = String(Reflect.get(obj, "userText") ?? userText).trim() || userText;
  const correctedText = String(Reflect.get(obj, "correctedText") ?? userText).trim() || userText;
  const result: "ok" | "fix" = rawResult === "ok" || rawResult === "fix" ? rawResult : "fix";

  return {
    result,
    userText: echoedUserText,
    correctedText,
    comment:
      comment ||
      (result === "ok" ? "自然で正しい表現です。" : "문장을 더 자연스럽게 다듬어 보세요."),
  };
}

export function containsJapaneseText(input: string) {
  const text = String(input ?? "");
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
}

async function askForJson(systemPrompt: string, userPrompt: string) {
  const response = await getClient().responses.create({
    model: DEFAULT_MODEL,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: userPrompt }],
      },
    ],
  });

  return extractOutputText({
    output_text: response.output_text,
    output: response.output,
  });
}

export async function generateJapaneseWritingPrompt(level: JapaneseLevel) {
  const normalizedLevel = normalizeLevel(level);

  const systemPrompt = [
    "Generate one Korean prompt for Korean-to-Japanese writing practice.",
    "Conditions:",
    "- Level: N1 ~ N5",
    "- N5: very simple daily expression, 1 short sentence.",
    "- N4: daily conversation, 1 to 2 sentences.",
    "- N3: experience, feeling, reason, 1 to 3 sentences.",
    "- N2: opinion, comparison, explanation.",
    "- N1: abstract topic and logical explanation.",
    "Return JSON only:",
    '{ "level": "N3", "promptKo": "...", "hint": "..." }',
    "No text outside JSON.",
  ].join("\n");

  const userPrompt = [
    `level: ${normalizedLevel}`,
    "The prompt must be written in Korean and ask user to write Japanese.",
    "Hint should be short, practical, and also in Korean.",
  ].join("\n");
  try {
    const raw = await askForJson(systemPrompt, userPrompt);
    const parsed = parseJsonObject(raw);
    return normalizeGenerateResponse(parsed, normalizedLevel);
  } catch {
    // Fallback for missing OpenAI key / provider errors / invalid JSON output.
    return fallbackPromptByLevel(normalizedLevel);
  }
}

export async function reviewJapaneseWriting(args: {
  level: JapaneseLevel;
  promptKo: string;
  userText: string;
}) {
  const normalizedLevel = normalizeLevel(args.level);
  const promptKo = String(args.promptKo ?? "").trim();
  const userText = String(args.userText ?? "").trim();

  if (!promptKo) throw new Error("promptKo is required");
  if (!userText) throw new Error("userText is required");

  const systemPrompt = [
    "Evaluate the user's Japanese writing based on the Korean prompt.",
    "Review criteria:",
    "- Grammar",
    "- Particles",
    "- Natural expression",
    "- Vocabulary",
    "- Sentence flow",
    "Do NOT compare exact match. Evaluate correctness and naturalness.",
    "Return JSON only:",
    '{',
    '  "result": "ok" or "fix",',
    '  "userText": "...",',
    '  "correctedText": "...",',
    '  "comment": "..."',
    '}',
    "No explanation outside JSON.",
  ].join("\n");

  const userPrompt = [
    `level: ${normalizedLevel}`,
    `promptKo: ${promptKo}`,
    `userText: ${userText}`,
  ].join("\n");

  const raw = await askForJson(systemPrompt, userPrompt);
  const parsed = parseJsonObject(raw);
  return normalizeReviewResponse(parsed, userText);
}

export async function generateJapaneseReferenceAnswer(args: {
  level: JapaneseLevel;
  promptKo: string;
}) {
  const normalizedLevel = normalizeLevel(args.level);
  const promptKo = String(args.promptKo ?? "").trim();
  if (!promptKo) throw new Error("promptKo is required");

  const systemPrompt = [
    "Create one model Japanese answer for the Korean writing prompt.",
    "Requirements:",
    "- Natural Japanese",
    "- Level appropriate",
    "- One concise answer",
    "Return JSON only:",
    '{ "correctedText": "..." }',
    "No text outside JSON.",
  ].join("\n");

  const userPrompt = [
    `level: ${normalizedLevel}`,
    `promptKo: ${promptKo}`,
  ].join("\n");

  const raw = await askForJson(systemPrompt, userPrompt);
  const parsed = parseJsonObject(raw);
  const correctedText = String(
    (typeof parsed === "object" && parsed !== null
      ? Reflect.get(parsed, "correctedText")
      : "") ?? "",
  ).trim();

  if (!correctedText) {
    throw new Error("Invalid correctedText from model answer generator");
  }

  return correctedText;
}
