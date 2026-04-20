import OpenAI from "openai";
import { toFile } from "openai/uploads";

const DEFAULT_REVIEW_MODEL = process.env.OPENAI_JAPANESE_SPEAKING_MODEL || "gpt-4o";
const DEFAULT_TRANSCRIBE_MODEL =
  process.env.OPENAI_JAPANESE_SPEAKING_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";

type ReviewIssue = {
  original: string;
  problem: string;
  reason: string;
  fix: string;
};

export type JapaneseSpeakingReviewResult = {
  estimatedTranscript: string;
  overall: string;
  strengths: string[];
  issues: ReviewIssue[];
  pronunciationPoints: string[];
  naturalVersion: string;
  practiceTips: string[];
};

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

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeIssues(value: unknown): ReviewIssue[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const original = String(Reflect.get(item, "original") ?? "").trim();
      const problem = String(Reflect.get(item, "problem") ?? "").trim();
      const reason = String(Reflect.get(item, "reason") ?? "").trim();
      const fix = String(Reflect.get(item, "fix") ?? "").trim();
      if (!problem && !reason && !fix) return null;
      return { original, problem, reason, fix } satisfies ReviewIssue;
    })
    .filter((item): item is ReviewIssue => !!item)
    .slice(0, 12);
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error ?? "unknown error");
}

export async function reviewJapaneseSpeakingAudio(args: {
  fileName: string;
  mimeType: string;
  audioBuffer: Buffer;
}): Promise<JapaneseSpeakingReviewResult> {
  const bytes = new Uint8Array(args.audioBuffer);
  const fileName = args.fileName || "recording.webm";
  const mimeType = args.mimeType || "audio/webm";

  const primaryFile = await toFile(bytes, fileName, { type: mimeType });

  let estimatedTranscript = "";
  let transcriptError = "";
  try {
    const transcript = await getClient().audio.transcriptions.create({
      file: primaryFile,
      model: DEFAULT_TRANSCRIBE_MODEL,
      response_format: "text",
      language: "ja",
    });
    estimatedTranscript = String(transcript ?? "").trim();
  } catch (error) {
    transcriptError = toErrorMessage(error);
    const fallbackFile = await toFile(bytes, fileName, { type: mimeType });
    try {
      const transcript = await getClient().audio.transcriptions.create({
        file: fallbackFile,
        model: "whisper-1",
        response_format: "text",
        language: "ja",
      });
      estimatedTranscript = String(transcript ?? "").trim();
      transcriptError = "";
    } catch (fallbackError) {
      transcriptError = `${transcriptError} | fallback: ${toErrorMessage(fallbackError)}`;
      estimatedTranscript = "";
    }
  }

  if (!estimatedTranscript) {
    throw new Error(
      `음성 전사에 실패했습니다. OPENAI_API_KEY/모델 권한/오디오 코덱을 확인해 주세요. detail: ${transcriptError || "empty transcript"}`,
    );
  }

  const reviewPrompt = [
    "You are a strict but helpful Japanese speaking evaluator for Korean learners.",
    "Evaluate the learner's spoken Japanese for interview and conversation use.",
    "You will receive the transcribed Japanese text.",
    "If text seems partially wrong due to ASR, infer likely intended speech and still give practical corrections.",
    "Return JSON only with this exact schema:",
    "{",
    '  "overall": "string",',
    '  "strengths": ["string"],',
    '  "issues": [',
    "    {",
    '      "original": "string",',
    '      "problem": "string",',
    '      "reason": "string",',
    '      "fix": "string"',
    "    }",
    "  ],",
    '  "pronunciationPoints": ["string"],',
    '  "naturalVersion": "string",',
    '  "practiceTips": ["string"]',
    "}",
    "Rules:",
    "- Explain why awkward parts are awkward.",
    "- Provide concrete corrections, not vague comments.",
    "- naturalVersion must be natural Japanese often used by natives.",
    "- Keep all feedback in Korean language except Japanese example sentences.",
    "- Do not output any text outside JSON.",
  ].join("\n");

  let response;
  let reviewError = "";
  try {
    try {
      response = await getClient().responses.create({
        model: DEFAULT_REVIEW_MODEL,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: reviewPrompt }],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "Learner locale: ko-KR",
                  "Goal: Japanese interview + daily conversation naturalness",
                  `Transcribed speech: ${estimatedTranscript || "(empty)"}`,
                ].join("\n"),
              },
            ],
          },
        ],
      });
    } catch (error) {
      reviewError = toErrorMessage(error);
      response = await getClient().responses.create({
        model: "gpt-4o-mini",
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: reviewPrompt }],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "Learner locale: ko-KR",
                  "Goal: Japanese interview + daily conversation naturalness",
                  `Transcribed speech: ${estimatedTranscript || "(empty)"}`,
                ].join("\n"),
              },
            ],
          },
        ],
      });
      reviewError = "";
    }

    const raw = extractOutputText({
      output_text: response.output_text,
      output: response.output,
    });
    const parsed = parseJsonObject(raw);
    const obj = typeof parsed === "object" && parsed !== null ? parsed : {};

    const overall = String(Reflect.get(obj, "overall") ?? "").trim();
    const strengths = normalizeStringArray(Reflect.get(obj, "strengths"));
    const issues = normalizeIssues(Reflect.get(obj, "issues"));
    const pronunciationPoints = normalizeStringArray(Reflect.get(obj, "pronunciationPoints"));
    const naturalVersion = String(Reflect.get(obj, "naturalVersion") ?? "").trim();
    const practiceTips = normalizeStringArray(Reflect.get(obj, "practiceTips"));

    return {
      estimatedTranscript,
      overall:
        overall ||
        "전반적으로 전달은 되었지만 발음과 문장 연결을 더 다듬으면 자연스러움이 크게 좋아집니다.",
      strengths,
      issues,
      pronunciationPoints,
      naturalVersion: naturalVersion || estimatedTranscript || "もう一度録音してみてください。",
      practiceTips,
    };
  } catch (error) {
    const msg = toErrorMessage(error);
    throw new Error(
      `음성 평가 생성에 실패했습니다. 모델 권한/요금제/응답 포맷을 확인해 주세요. detail: ${reviewError || msg}`,
    );
  }
}
