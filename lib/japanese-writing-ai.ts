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

function fallbackPromptByLevel(
  level: JapaneseLevel,
  excludePrompt?: string,
): GeneratedWritingPrompt {
  const pool: Record<JapaneseLevel, Array<{ promptKo: string; hint: string }>> = {
    N5: [
      {
        promptKo: "오늘 아침에는 늦잠을 자서 서둘러 준비한 뒤, 지각하지 않으려고 뛰어서 학교에 갔다.",
        hint: "시간 순서와 과거형을 자연스럽게 연결해 보세요.",
      },
      {
        promptKo: "저는 매일 저녁에 가족과 함께 식사하면서 하루 동안 있었던 일을 이야기하는 시간이 가장 좋다.",
        hint: "일상 표현과 감정 표현을 함께 써보세요.",
      },
      {
        promptKo: "어제는 비가 많이 와서 외출하지 못했지만, 집에서 책을 읽으며 조용하게 시간을 보냈다.",
        hint: "역접 표현(하지만)과 행동 묘사를 넣어 보세요.",
      },
    ],
    N4: [
      {
        promptKo: "주말에 친구와 새로 생긴 카페에 갔는데 분위기가 좋았고, 커피도 맛있어서 다음에 또 가고 싶다고 느꼈다.",
        hint: "경험 + 감상을 한 문장 안에서 연결해 보세요.",
      },
      {
        promptKo: "지난주에는 회사 일이 많아 피곤했지만, 매일 계획을 세워 끝까지 해내면서 성취감을 느꼈다.",
        hint: "피곤했지만/해냈다 같은 대비 표현을 살려 보세요.",
      },
      {
        promptKo: "저는 아침에 일찍 일어나 가볍게 운동을 하고 출근하면 하루 종일 집중이 잘되어 업무 효율이 높아진다.",
        hint: "습관과 결과의 인과관계를 표현해 보세요.",
      },
    ],
    N3: [
      {
        promptKo: "오늘은 해야 할 일이 많아서 피곤했지만, 미루지 않고 끝까지 해내려고 노력했다.",
        hint: "역접(〜ものの/〜が)과 의지 표현을 자연스럽게 써보세요.",
      },
      {
        promptKo: "최근에는 한국어 원문을 일본어로 바꿔 보는 연습을 하면서, 문장 구조를 더 정확하게 이해하게 되었다.",
        hint: "변화(〜ようになった) 표현을 사용해 보세요.",
      },
      {
        promptKo: "회의에서 제안한 아이디어가 바로 채택되지는 않았지만, 팀원들과 논의하는 과정에서 더 나은 방향을 찾을 수 있었다.",
        hint: "수동/가능 표현과 과거 서술을 연결해 보세요.",
      },
    ],
    N2: [
      {
        promptKo: "온라인 수업은 시간과 장소의 제약이 적다는 장점이 있지만, 학습 집중도와 상호작용 측면에서는 오프라인 수업이 더 효과적이라고 생각한다.",
        hint: "장점/단점 비교 후 자신의 결론을 명확히 제시해 보세요.",
      },
      {
        promptKo: "재택근무는 출퇴근 시간을 줄여 삶의 질을 높일 수 있지만, 협업 속도와 조직 소속감을 약화시킬 수 있다는 우려도 존재한다.",
        hint: "양면성을 균형 있게 서술해 보세요.",
      },
      {
        promptKo: "도시 생활은 다양한 기회와 편의시설을 제공하지만, 높은 생활비와 빠른 속도의 환경이 장기적으로 피로를 누적시키기도 한다.",
        hint: "객관적 설명 + 개인적 평가를 함께 써보세요.",
      },
    ],
    N1: [
      {
        promptKo: "기술 발전은 정보 접근성과 생산성을 비약적으로 향상시켰지만, 인간의 주의력 분산과 관계의 표면화를 심화시켜 사회적 신뢰 구조에 장기적 부담을 준다.",
        hint: "추상 개념을 인과 구조로 논리적으로 전개해 보세요.",
      },
      {
        promptKo: "개인의 자유는 민주사회의 핵심 가치이지만, 공동체의 안전과 지속 가능성을 유지하기 위해서는 일정 수준의 제도적 규범과 사회적 책임이 병행되어야 한다.",
        hint: "양립 관계를 접속 표현으로 정교하게 묶어 보세요.",
      },
      {
        promptKo: "AI 시대에 인간의 고유한 역량은 단순 계산 능력이 아니라 맥락 판단, 윤리적 숙고, 그리고 불확실성 속에서 의미를 구성하는 해석 능력이라고 본다.",
        hint: "개념 정의 후 근거를 제시하는 논증 구조를 사용해 보세요.",
      },
    ],
  };

  const trimmedExclude = String(excludePrompt ?? "").trim();
  const source = pool[level] ?? pool.N3;
  const candidates =
    trimmedExclude.length > 0
      ? source.filter((c) => c.promptKo.trim() !== trimmedExclude)
      : source;
  const finalCandidates = candidates.length > 0 ? candidates : source;
  const idx = Math.floor(Math.random() * finalCandidates.length);
  const picked = finalCandidates[idx];
  return {
    level,
    promptKo: picked.promptKo,
    hint: picked.hint,
  };
}

function isGenericCorrectedText(text: string) {
  const t = String(text ?? "").trim();
  if (!t) return true;
  return /(日本語で書いてください|日本語で作成|見直してください|もう一度|再入力)/.test(t);
}

function shouldReplaceCorrectedText(correctedText: string, userText: string) {
  if (!containsJapaneseText(correctedText)) return true;
  if (correctedText === userText) return true;
  if (isGenericCorrectedText(correctedText)) return true;
  if (correctedText.length < 8) return true;
  return false;
}

export function enforceCorrectedText(args: {
  review: WritingReviewResult;
  userText: string;
  referenceAnswer: string;
}) {
  const review = { ...args.review };
  const userText = String(args.userText ?? "").trim();
  const referenceAnswer = String(args.referenceAnswer ?? "").trim();

  if (review.result === "fix" && shouldReplaceCorrectedText(review.correctedText, userText)) {
    review.correctedText = referenceAnswer || review.correctedText;
  }

  if (!containsJapaneseText(userText)) {
    review.result = "fix";
    review.comment = "일본어로 작성해 주세요. 현재 입력은 일본어 문장이 아닙니다.";
    if (referenceAnswer) {
      review.correctedText = referenceAnswer;
    }
  }

  if (review.result === "ok" && !review.comment.trim()) {
    review.comment = "自然で正しい表現です。";
  }

  if (review.result === "fix" && !review.comment.trim()) {
    review.comment = "문법, 조사, 어휘, 문장 흐름을 자연스럽게 수정했습니다.";
  }

  return review;
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

export async function generateJapaneseWritingPrompt(args: {
  level: JapaneseLevel;
  excludePrompt?: string;
}) {
  const normalizedLevel = normalizeLevel(args.level);
  const excludePrompt = String(args.excludePrompt ?? "").trim();

  const systemPrompt = [
    "Generate one Korean source sentence for Korean-to-Japanese translation writing practice.",
    "Conditions:",
    "- Level: N1 ~ N5",
    "- Return a declarative Korean sentence, not a question or instruction.",
    "- N5: simple daily sentence, around 25~40 Korean chars.",
    "- N4: daily sentence with one connector, around 35~55 chars.",
    "- N3: slightly longer sentence with reason/contrast, around 45~75 chars.",
    "- N2: opinion/comparison sentence, around 55~90 chars.",
    "- N1: abstract/logical sentence, around 70~120 chars.",
    "Return JSON only:",
    '{ "level": "N3", "promptKo": "...", "hint": "..." }',
    "No text outside JSON.",
  ].join("\n");

  const userPrompt = [
    `level: ${normalizedLevel}`,
    "promptKo must be a Korean source sentence to translate into Japanese.",
    "Do not include any question marks.",
    "Hint should be short, practical, and also in Korean.",
    excludePrompt ? `Do not repeat this exact sentence: ${excludePrompt}` : "",
    `nonce: ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    "Avoid repeating the same prompt as previous response.",
  ]
    .filter(Boolean)
    .join("\n");
  try {
    const raw = await askForJson(systemPrompt, userPrompt);
    const parsed = parseJsonObject(raw);
    const generated = normalizeGenerateResponse(parsed, normalizedLevel);
    if (excludePrompt && generated.promptKo.trim() === excludePrompt) {
      return fallbackPromptByLevel(normalizedLevel, excludePrompt);
    }
    return generated;
  } catch {
    // Fallback for missing OpenAI key / provider errors / invalid JSON output.
    return fallbackPromptByLevel(normalizedLevel, excludePrompt);
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
