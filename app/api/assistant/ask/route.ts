// app/api/assistant/ask/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ensureAssistantKnowledgeTable } from "@/lib/assistant-knowledge";
import { retrieveKnowledgeChunks } from "@/lib/assistant-knowledge-chunks";
import { recordAssistantChatLog } from "@/lib/assistant-chat-log";
import { appendAssistantDailyTxtLog } from "@/lib/assistant-file-log";
import { getVerifiedAnswer } from "@/lib/assistant-review";
import {
  checkAssistantLimits,
  estimateTokens,
  recordAssistantUsage,
} from "@/lib/assistant-limits";

export const runtime = "nodejs";

const DEFAULT_MODEL = process.env.OPENAI_ASSISTANT_MODEL || "gpt-4o-mini";
const DEFAULT_MAX_OUTPUT_TOKENS = Number(
  process.env.OPENAI_ASSISTANT_MAX_OUTPUT_TOKENS || 500,
);
const OPENAI_ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID || "";
const ENABLE_ASSISTANT_API = process.env.ENABLE_ASSISTANT_API === "true";

async function ensureFaqTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS public.assistant_faqs (
      id BIGSERIAL PRIMARY KEY,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function makeSnippet(text: string, max = 500) {
  const t = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}...`;
}

function extractMonthFromQuestion(question: string): number | null {
  const q = String(question ?? "");
  const numeric = q.match(/\b(1[0-2]|0?[1-9])\s*(월|月|month)\b/i);
  if (numeric) {
    const n = Number(numeric[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 12) return n;
  }

  const koWords = [
    "일월",
    "이월",
    "삼월",
    "사월",
    "오월",
    "유월",
    "육월",
    "칠월",
    "팔월",
    "구월",
    "시월",
    "십월",
    "십일월",
    "십이월",
  ];
  for (let i = 0; i < koWords.length; i++) {
    if (q.includes(koWords[i])) return i + 1;
  }

  const enMonths = [
    ["jan", "january"],
    ["feb", "february"],
    ["mar", "march"],
    ["apr", "april"],
    ["may"],
    ["jun", "june"],
    ["jul", "july"],
    ["aug", "august"],
    ["sep", "sept", "september"],
    ["oct", "october"],
    ["nov", "november"],
    ["dec", "december"],
  ];
  const lq = q.toLowerCase();
  for (let i = 0; i < enMonths.length; i++) {
    if (enMonths[i].some((w) => lq.includes(w))) return i + 1;
  }
  return null;
}

function monthKeywords(month: number) {
  const enLong = [
    "",
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const enShort = [
    "",
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const koWords = [
    "",
    "일월",
    "이월",
    "삼월",
    "사월",
    "오월",
    "유월",
    "칠월",
    "팔월",
    "구월",
    "시월",
    "십일월",
    "십이월",
  ];
  const jpWords = [
    "",
    "一月",
    "二月",
    "三月",
    "四月",
    "五月",
    "六月",
    "七月",
    "八月",
    "九月",
    "十月",
    "十一月",
    "十二月",
  ];
  return Array.from(
    new Set([
      `${month}월`,
      `${String(month).padStart(2, "0")}월`,
      `${month} 月`,
      `${month}月`,
      `${month} month`,
      enLong[month],
      enShort[month],
      koWords[month],
      jpWords[month],
      "calendar",
      "캘린더",
      "행사",
      "일정",
      "イベント",
      "スケジュール",
    ]),
  );
}

function buildRetrievalKeywords(question: string) {
  const raw = String(question ?? "").trim();
  const fromQuestion = raw
    .split(/[\s,./!?()[\]{}"':;|\\]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 24);
  const month = extractMonthFromQuestion(raw);
  const monthTokens = month ? monthKeywords(month) : [];
  return Array.from(new Set([...fromQuestion, ...monthTokens])).slice(0, 28);
}

function buildSynonymVariants(question: string) {
  const q = String(question ?? "");
  const variants: string[] = [];
  const map: Array<[RegExp, string[]]> = [
    [/(행사|이벤트)/gi, ["イベント"]],
    [/(일정|달력|캘린더)/gi, ["日程", "カレンダー"]],
    [/(회의)/gi, ["会議"]],
    [/(부서)/gi, ["部署"]],
    [/(공동|공통)/gi, ["共通"]],
    [/(휴가)/gi, ["休暇", "有給"]],
    [
      /(교통비|통근비|여비)/gi,
      ["交通費", "通勤費", "通勤", "精算", "上限", "限度", "規程"],
    ],
    [/(임금|급여|월급)/gi, ["賃金", "給与"]],
  ];
  for (const [re, targets] of map) {
    if (re.test(q)) variants.push(...targets);
  }
  return Array.from(new Set(variants));
}

function buildJapaneseMonthVariants(question: string) {
  const q = String(question ?? "");
  const out: string[] = [];

  const md = q.match(/\b(1[0-2]|0?[1-9])\s*월\s*(3[01]|[12]?\d)\s*일\b/i);
  if (md) {
    const m = Number(md[1]);
    const d = Number(md[2]);
    out.push(`${m}月${d}日`, `${m}月 ${d}日`);
  }

  const mOnly = q.match(/\b(1[0-2]|0?[1-9])\s*월\b/i);
  if (mOnly) {
    const m = Number(mOnly[1]);
    out.push(`${m}月`, `${m}月 日程`, `${m}月 イベント`, `${m}月 会議`);
  }

  return Array.from(new Set(out));
}

function prioritizeDocsForTopic(
  question: string,
  docs: Array<{
    docId?: number;
    title: string;
    content: string;
    similarity?: number;
    sourceRef?: string;
  }>,
) {
  const q = String(question ?? "");
  const isSchedule = /(일정|행사|달력|캘린더|日程|カレンダー|イベント)/i.test(
    q,
  );
  const isPolicy = /(규정|임금|급여|교통비|賃金|給与|交通費|規程)/i.test(q);
  if (!isSchedule && !isPolicy) return docs;

  return [...docs].sort((a, b) => {
    const aTitle = `${a.title} ${a.sourceRef ?? ""}`;
    const bTitle = `${b.title} ${b.sourceRef ?? ""}`;
    const aBoost =
      (isSchedule &&
      /(社内日程|日程|カレンダー|calendar|행사|일정)/i.test(aTitle)
        ? 0.25
        : 0) +
      (isPolicy && /(賃金規程|規程|규정|교통비|交通費)/i.test(aTitle)
        ? 0.25
        : 0);
    const bBoost =
      (isSchedule &&
      /(社内日程|日程|カレンダー|calendar|행사|일정)/i.test(bTitle)
        ? 0.25
        : 0) +
      (isPolicy && /(賃金規程|規程|규정|교통비|交通費)/i.test(bTitle)
        ? 0.25
        : 0);
    return (
      Number((b.similarity ?? 0) + bBoost) -
      Number((a.similarity ?? 0) + aBoost)
    );
  });
}

function sanitizeAssistantAnswer(answer: string, userQuestion: string) {
  const text = String(answer ?? "").trim();
  if (!text) return "제공된 자료에서 확인되지 않습니다.";

  const cut = text.search(
    /(확인\s*불가\/한계|근거\(출처\)|근거\s*:|출처\s*:|근거\s*없음|근거\s*:\s*없음)/i,
  );
  if (cut >= 0) {
    const main = text.slice(0, cut).trim();
    return main || "제공된 자료에서 확인되지 않습니다.";
  }
  return text;
}

async function rewriteQueryForSearch(question: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "";
  const prompt = [
    "다국어 문서 검색용 질의로 짧게 재작성하라.",
    "한국어/일본어 키워드를 함께 포함해 1줄로 출력.",
    `질문: ${question}`,
  ].join("\n");

  try {
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_output_tokens: 80,
        input: [
          { role: "user", content: [{ type: "input_text", text: prompt }] },
        ],
      }),
    });
    if (!resp.ok) return "";
    const payload = await resp.json().catch(() => ({}));
    return parseResponseText(payload).replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

function extractAround(content: string, keyword: string, radius = 520) {
  const src = String(content ?? "");
  const idx = src.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx < 0) return "";
  const start = Math.max(0, idx - radius);
  const end = Math.min(src.length, idx + keyword.length + radius);
  return src.slice(start, end).trim();
}

function isPolicyQuestion(question: string) {
  const q = String(question ?? "");
  return /(규정|임금|급여|교통비|통근|여비|賃金|給与|交通費|通勤|規程|手当|上限|限度)/i.test(
    q,
  );
}

function policyKeywords() {
  return [
    "교통비",
    "통근비",
    "여비",
    "交通費",
    "通勤",
    "通勤費",
    "通勤手当",
    "手当",
    "精算",
    "上限",
    "限度",
    "規程",
    "非課税",
  ];
}

function bestKeywordSnippets(content: string, keys: string[], maxSnippets = 4) {
  const hits = keys
    .map((k) => ({ k, s: extractAround(content, k) }))
    .filter((x) => x.s && x.s.length >= 40);

  const uniq: string[] = [];
  for (const h of hits) {
    const same = uniq.some(
      (u) => u.includes(h.k) && Math.abs(u.length - h.s.length) < 80,
    );
    if (!same) uniq.push(h.s);
    if (uniq.length >= maxSnippets) break;
  }
  return uniq;
}

function buildDocContext(
  question: string,
  docs: { title: string; content: string; similarity?: number }[],
) {
  const month = extractMonthFromQuestion(question);
  const needsPolicyHint = isPolicyQuestion(question);
  const needsScheduleHint = /(행사|일정|캘린더|calendar|イベント)/i.test(
    question,
  );
  const blocks = docs
    .slice(0, 5)
    .map((d, i) => {
      let body = "";
      if (month && needsScheduleHint) {
        const hits = monthKeywords(month)
          .map((k) => extractAround(d.content, k))
          .filter(Boolean);
        if (hits.length) body = hits.join("\n---\n");
      }

      if (!body && needsPolicyHint) {
        const keys = policyKeywords();
        const hits = bestKeywordSnippets(d.content, keys, 5);
        if (hits.length) body = hits.join("\n---\n");
      }

      if (!body) body = makeSnippet(String(d.content || ""), 3200);

      const score = Number(d.similarity ?? 0);
      const scoreLabel =
        Number.isFinite(score) && score > 0 ? ` score=${score.toFixed(3)}` : "";
      return `DOC${i + 1} (${d.title}${scoreLabel})\n${body}`;
    })
    .join("\n\n");

  return { docBlock: blocks, month, scheduleHint: needsScheduleHint };
}

function parseResponseText(payload: any): string {
  const direct = String(payload?.output_text ?? "").trim();
  if (direct) return direct;

  const out = Array.isArray(payload?.output) ? payload.output : [];
  const parts: string[] = [];
  for (const item of out) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const c of content) {
      const t = String(c?.text ?? c?.output_text ?? "").trim();
      if (t) parts.push(t);
    }
  }
  return parts.join("\n").trim();
}

function compactErrorMessage(input: unknown, max = 500) {
  const text = String(input ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function isScheduleQuestion(question: string) {
  const q = String(question ?? "");
  return /(일정|행사|날짜|캘린더|calendar|schedule|イベント|日程|日付)/i.test(
    q,
  );
}

function extractDateTokens(text: string) {
  const src = String(text ?? "");
  const patterns = [
    /\b\d{1,2}\/\d{1,2}\b/g,
    /\b\d{1,2}-\d{1,2}\b/g,
    /\b\d{4}-\d{1,2}-\d{1,2}\b/g,
    /\b\d{1,2}월\s*\d{1,2}일\b/g,
    /\b\d{1,2}月\s*\d{1,2}日\b/g,
  ];
  const tokens = new Set<string>();
  for (const re of patterns) {
    for (const m of src.matchAll(re)) {
      const v = String(m[0] ?? "").trim();
      if (v) tokens.add(v);
    }
  }
  return Array.from(tokens);
}

function hasDateDrift(answer: string, context: string) {
  const answerDates = extractDateTokens(answer);
  if (answerDates.length === 0) return false;
  const ctx = String(context ?? "");
  return answerDates.some((d) => !ctx.includes(d));
}

async function askOpenAI(args: {
  question: string;
  faqRows: { question: string; answer: string }[];
  docRows: { title: string; content: string; similarity?: number }[];
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const faqBlock = args.faqRows
    .slice(0, 8)
    .map((f, i) => `FAQ${i + 1}\nQ: ${f.question}\nA: ${f.answer}`)
    .join("\n\n");

  const { docBlock, month, scheduleHint } = buildDocContext(
    args.question,
    args.docRows,
  );

  const baseRules = [
    "너는 사내 규정/일정 질의응답 도우미다.",
    "아래에 제공된 FAQ/DOC만 근거로 답변한다.",
    "규칙:",
    "- 출력은 제목/섹션 없이 자연스러운 한국어 답변 본문만 작성한다.",
    "- 사용자 질문에 출처 요청이 있어도 `근거:`, `출처:`, `확인 불가/한계:` 같은 섹션/라벨을 만들지 않는다.",
    "- 출처를 언급할 때도 라벨 없이 자연문장 한 문장으로만 포함한다.",
    "- 제공 자료에서 확인되지 않으면 정확히 한 문장만 출력: 제공된 자료에서 확인되지 않습니다.",
    "- 제공 근거에 없는 내용을 추정/보정/재해석하지 않는다.",
    "- 일반 상식/외부 지식을 임의로 섞지 않는다.",
    "- 질문이 n월 행사/일정이면 문서에서 n월 구간을 우선 찾아 답한다.",
    "- 일정/행사/날짜/캘린더 질문의 날짜/숫자/고유명사는 문맥의 문자열을 그대로 복사한다.",
    "- 숫자 오타 보정(예: 13→14) 금지.",
    month && scheduleHint
      ? `- 이번 질문은 ${month}월 행사/일정 질의다. ${month}월 관련 근거를 최우선으로 사용한다.`
      : "",
  ].filter(Boolean);

  const userPrompt = [
    `질문: ${args.question}`,
    "",
    "[FAQ 근거]",
    faqBlock || "없음",
    "",
    "[문서 근거]",
    docBlock || "없음",
  ].join("\n");

  async function runOnce(systemText: string) {
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_output_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
        temperature: 0.1,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemText }],
          },
          { role: "user", content: [{ type: "input_text", text: userPrompt }] },
        ],
      }),
    });

    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => "");
      throw new Error(
        `OPENAI_ERROR status=${resp.status} body=${compactErrorMessage(bodyText)}`,
      );
    }

    const payload = await resp.json().catch(() => ({}));
    return {
      answer:
        parseResponseText(payload) || "제공된 자료에서 확인되지 않습니다.",
      inputTokens: Number(payload?.usage?.input_tokens ?? 0),
      outputTokens: Number(payload?.usage?.output_tokens ?? 0),
    };
  }

  const primary = await runOnce(baseRules.join("\n"));
  const contextForCheck = [faqBlock, docBlock].join("\n\n");

  if (
    isScheduleQuestion(args.question) &&
    hasDateDrift(primary.answer, contextForCheck)
  ) {
    const strict = [
      ...baseRules,
      "- 날짜/숫자는 문맥에서 찾은 원문 문자열만 그대로 사용한다.",
      "- 문맥에 없는 날짜를 출력하지 않는다.",
      "- 일치하는 날짜가 없으면 정확히 한 문장만 출력: 제공된 자료에서 확인되지 않습니다.",
    ].join("\n");
    return await runOnce(strict);
  }

  return primary;
}

async function askOpenAIAssistant(args: {
  question: string;
  threadId?: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!ENABLE_ASSISTANT_API || !apiKey || !OPENAI_ASSISTANT_ID) return null;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "OpenAI-Beta": "assistants=v2",
  };

  let threadId = String(args.threadId ?? "").trim();
  if (!threadId) {
    const tRes = await fetch("https://api.openai.com/v1/threads", {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    if (!tRes.ok) {
      const bodyText = await tRes.text().catch(() => "");
      throw new Error(
        `ASSISTANT_THREAD_CREATE_ERROR status=${tRes.status} body=${compactErrorMessage(bodyText)}`,
      );
    }
    const tJson = await tRes.json().catch(() => ({}));
    threadId = String(tJson?.id ?? "").trim();
    if (!threadId) throw new Error("ASSISTANT_THREAD_ID_MISSING");
  }

  const mRes = await fetch(
    `https://api.openai.com/v1/threads/${threadId}/messages`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ role: "user", content: args.question }),
    },
  );
  if (!mRes.ok) {
    const bodyText = await mRes.text().catch(() => "");
    throw new Error(
      `ASSISTANT_MESSAGE_ERROR status=${mRes.status} body=${compactErrorMessage(bodyText)}`,
    );
  }

  const rRes = await fetch(
    `https://api.openai.com/v1/threads/${threadId}/runs`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ assistant_id: OPENAI_ASSISTANT_ID }),
    },
  );
  if (!rRes.ok) {
    const bodyText = await rRes.text().catch(() => "");
    throw new Error(
      `ASSISTANT_RUN_ERROR status=${rRes.status} body=${compactErrorMessage(bodyText)}`,
    );
  }

  const run = await rRes.json().catch(() => ({}));
  const runId = String(run?.id ?? "").trim();
  if (!runId) throw new Error("ASSISTANT_RUN_ID_MISSING");

  let runUsageInput = 0;
  let runUsageOutput = 0;

  for (let i = 0; i < 25; i++) {
    const pRes = await fetch(
      `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
      { method: "GET", headers },
    );
    if (!pRes.ok) {
      const bodyText = await pRes.text().catch(() => "");
      throw new Error(
        `ASSISTANT_RUN_POLL_ERROR status=${pRes.status} body=${compactErrorMessage(bodyText)}`,
      );
    }
    const pJson = await pRes.json().catch(() => ({}));
    const status = String(pJson?.status ?? "");
    runUsageInput = Number(pJson?.usage?.prompt_tokens ?? 0);
    runUsageOutput = Number(pJson?.usage?.completion_tokens ?? 0);

    if (status === "completed") break;
    if (status === "failed" || status === "cancelled" || status === "expired") {
      throw new Error(`ASSISTANT_RUN_NOT_COMPLETED status=${status}`);
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  const msgRes = await fetch(
    `https://api.openai.com/v1/threads/${threadId}/messages?limit=10`,
    { method: "GET", headers },
  );
  if (!msgRes.ok) {
    const bodyText = await msgRes.text().catch(() => "");
    throw new Error(
      `ASSISTANT_MESSAGES_READ_ERROR status=${msgRes.status} body=${compactErrorMessage(bodyText)}`,
    );
  }
  const msgJson = await msgRes.json().catch(() => ({}));
  const data = Array.isArray(msgJson?.data) ? msgJson.data : [];
  const assistantMsg = data.find(
    (m: any) => String(m?.role ?? "") === "assistant",
  );
  const parts = Array.isArray(assistantMsg?.content)
    ? assistantMsg.content
    : [];
  const answer = parts
    .map((p: any) => String(p?.text?.value ?? "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!answer) throw new Error("ASSISTANT_ANSWER_EMPTY");

  return {
    answer,
    threadId,
    inputTokens: runUsageInput,
    outputTokens: runUsageOutput,
  };
}

async function tryRecordChatLog(args: {
  userId: number;
  question: string;
  answer: string;
  mode: "faq" | "llm" | "knowledge" | "miss" | "verified" | "pending_review";
  metadata?: Record<string, unknown>;
}) {
  try {
    await recordAssistantChatLog(args);
  } catch {
    // ignore
  }
}

async function tryAppendDailyTxtLog(args: {
  userLabel: string;
  mode: "faq" | "llm" | "knowledge" | "miss" | "verified" | "pending_review";
  question: string;
  answer: string;
}) {
  try {
    await appendAssistantDailyTxtLog(args);
  } catch {
    // ignore
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureFaqTable();
    await ensureAssistantKnowledgeTable();

    const body = await req.json().catch(() => ({}));
    const question = String(body?.question ?? "").trim();
    const threadId = String(body?.threadId ?? "").trim() || undefined;
    const mode =
      String(body?.mode ?? "hybrid")
        .trim()
        .toLowerCase() === "llm"
        ? "llm"
        : "hybrid";
    const includeDebug =
      body?.includeDebug === true && user.user_role === "ADMIN";

    if (!question) {
      return NextResponse.json(
        { message: "질문을 입력해주세요." },
        { status: 400 },
      );
    }

    const inputTokens = estimateTokens(question);
    const gate = await checkAssistantLimits(
      user.id,
      inputTokens,
      DEFAULT_MAX_OUTPUT_TOKENS,
    );
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, answer: gate.message },
        { status: 429 },
      );
    }

    const exactFaq = await sql<{ answer: string }>`
      SELECT answer
      FROM public.assistant_faqs
      WHERE is_active = TRUE
        AND (
          lower(question) = lower(${question})
          OR lower(${question}) LIKE ('%' || lower(question) || '%')
          OR lower(question) LIKE ('%' || lower(${question}) || '%')
        )
      ORDER BY char_length(question) DESC, id DESC
      LIMIT 1
    `;

    if (exactFaq[0]?.answer) {
      const answer = exactFaq[0].answer;
      const outputTokens = estimateTokens(answer);

      await recordAssistantUsage({
        userId: user.id,
        inputTokens,
        outputTokens,
        source: "faq",
      });

      await tryRecordChatLog({
        userId: user.id,
        question,
        answer,
        mode: "faq",
      });
      await tryAppendDailyTxtLog({
        userLabel: `${user.username}(${user.id})`,
        mode: "faq",
        question,
        answer,
      });

      return NextResponse.json({ ok: true, mode: "faq", answer });
    }

    const verified = await getVerifiedAnswer(question);
    if (verified?.answer) {
      const answer = verified.answer;
      const outputTokens = estimateTokens(answer);

      await recordAssistantUsage({
        userId: user.id,
        inputTokens,
        outputTokens,
        source: "verified",
      });

      await tryRecordChatLog({
        userId: user.id,
        question,
        answer,
        mode: "verified",
      });

      await tryAppendDailyTxtLog({
        userLabel: `${user.username}(${user.id})`,
        mode: "verified",
        question,
        answer,
      });

      return NextResponse.json({ ok: true, mode: "verified", answer });
    }

    let assistantError: string | null = null;
    const useAssistantApi = body?.useAssistantApi === true;

    if (useAssistantApi) {
      try {
        const assistant = await askOpenAIAssistant({ question, threadId });
        if (assistant?.answer) {
          const cleanedAssistantAnswer = sanitizeAssistantAnswer(
            assistant.answer,
            question,
          );

          await recordAssistantUsage({
            userId: user.id,
            inputTokens:
              assistant.inputTokens > 0 ? assistant.inputTokens : inputTokens,
            outputTokens:
              assistant.outputTokens > 0
                ? assistant.outputTokens
                : estimateTokens(cleanedAssistantAnswer),
            source: "assistant_api",
          });

          await tryRecordChatLog({
            userId: user.id,
            question,
            answer: cleanedAssistantAnswer,
            mode: "llm",
          });

          await tryAppendDailyTxtLog({
            userLabel: `${user.username}(${user.id})`,
            mode: "llm",
            question,
            answer: cleanedAssistantAnswer,
          });

          return NextResponse.json({
            ok: true,
            mode: mode === "llm" ? "llm" : "hybrid",
            answer: cleanedAssistantAnswer,
            threadId: assistant.threadId,
          });
        }
      } catch (e: any) {
        assistantError = compactErrorMessage(
          e?.message ?? "ASSISTANT_API_FAILED",
        );
      }
    }

    const faqRows = await sql<{ question: string; answer: string }>`
      SELECT question, answer
      FROM public.assistant_faqs
      WHERE is_active = TRUE
      ORDER BY updated_at DESC, id DESC
      LIMIT 80
    `;

    const rewritten = await rewriteQueryForSearch(question);
    const retrievalKeywords = Array.from(
      new Set([
        ...buildRetrievalKeywords(question),
        ...buildRetrievalKeywords(rewritten),
        ...buildSynonymVariants(question),
        ...buildJapaneseMonthVariants(question),
      ]),
    ).slice(0, 36);

    let retrievalMode = mode === "llm" ? "llm_only" : "vector";
    let retrievalError: string | null = null;

    let docs: {
      docId?: number;
      title: string;
      content: string;
      similarity?: number;
      sourceRef?: string;
    }[] = [];

    if (mode !== "llm") {
      try {
        const chunks = await retrieveKnowledgeChunks({
          question,
          topK: 12,
          queryVariants: [rewritten, ...retrievalKeywords.slice(0, 12)],
        });

        docs = chunks.map((c) => ({
          docId: c.doc_id,
          title: c.title,
          content: c.content,
          similarity: c.similarity,
        }));
      } catch (e: any) {
        retrievalMode = "keyword";
        retrievalError = compactErrorMessage(
          e?.message ?? "vector retrieval failed",
        );
      }
    }

    if (mode !== "llm") {
      const keywordRows = await sql<{
        id: number;
        title: string;
        content: string;
        source_ref: string | null;
      }>`
        WITH tokens AS (
          SELECT unnest(${retrievalKeywords}::text[]) AS kw
        ),
        scored AS (
          SELECT
            d.id,
            d.title,
            d.content,
            COALESCE(d.metadata->>'sourceRef', '') AS source_ref,
            d.updated_at,
            SUM(
              CASE
                WHEN d.title ILIKE ('%' || t.kw || '%')
                  OR d.content ILIKE ('%' || t.kw || '%')
                THEN 1
                ELSE 0
              END
            )::int AS score
          FROM public.assistant_knowledge_docs d
          CROSS JOIN tokens t
          WHERE d.is_active = TRUE
          GROUP BY d.id, d.title, d.content, source_ref, d.updated_at
        )
        SELECT id, title, content, source_ref
        FROM scored
        WHERE score > 0
        ORDER BY score DESC, updated_at DESC, id DESC
        LIMIT 10
      `;

      if (keywordRows.length > 0) {
        const merged = new Map<
          string,
          {
            docId?: number;
            title: string;
            content: string;
            similarity?: number;
            sourceRef?: string;
          }
        >();

        for (const row of docs) {
          merged.set(`${row.title}::${row.content.slice(0, 120)}`, row);
        }

        for (const row of keywordRows) {
          const key = `${row.title}::${row.content.slice(0, 120)}`;
          if (!merged.has(key)) {
            merged.set(key, {
              docId: row.id,
              title: row.title,
              content: row.content,
              sourceRef: row.source_ref || undefined,
            });
          }
        }

        docs = Array.from(merged.values()).slice(0, 12);
        retrievalMode = "hybrid";
      }
    }

    if (mode !== "llm" && docs.length === 0) {
      docs = await sql<{
        id: number;
        title: string;
        content: string;
        source_ref: string | null;
      }>`
        SELECT id, title, content, COALESCE(metadata->>'sourceRef', '') AS source_ref
        FROM public.assistant_knowledge_docs
        WHERE is_active = TRUE
        ORDER BY updated_at DESC, id DESC
        LIMIT 20
      `.then((rows) =>
        rows.map((row) => ({
          docId: row.id,
          title: row.title,
          content: row.content,
          sourceRef: row.source_ref || undefined,
        })),
      );
      if (docs.length > 0) retrievalMode = "latest";
    }

    docs = prioritizeDocsForTopic(question, docs);

    if (
      mode !== "llm" &&
      /(교통비|통근비|여비|交通費|通勤|規程|賃金)/i.test(question)
    ) {
      const policyRows = await sql<{
        id: number;
        title: string;
        content: string;
        source_ref: string | null;
      }>`
        SELECT
          id,
          title,
          content,
          COALESCE(metadata->>'sourceRef', '') AS source_ref
        FROM public.assistant_knowledge_docs
        WHERE is_active = TRUE
          AND (
            title ~* '(賃金規程|規程|교통비|交通費|通勤)'
            OR content ~* '(通勤手当|交通費|30,000\\s*円|上限|非課税)'
          )
        ORDER BY updated_at DESC, id DESC
        LIMIT 3
      `;

      if (policyRows.length > 0) {
        const merged = new Map<string, (typeof docs)[number]>();
        for (const row of docs)
          merged.set(`${row.docId ?? 0}:${row.title}`, row);

        for (const row of policyRows) {
          const key = `${row.id}:${row.title}`;
          if (!merged.has(key)) {
            merged.set(key, {
              docId: row.id,
              title: row.title,
              content: row.content,
              sourceRef: row.source_ref || undefined,
            });
          }
        }

        docs = prioritizeDocsForTopic(
          question,
          Array.from(merged.values()),
        ).slice(0, 12);
      }
    }

    if (
      mode !== "llm" &&
      docs.length < 2 &&
      /(일정|행사|달력|규정|교통비|賃金|規程|交通費)/i.test(question)
    ) {
      const forced = await sql<{
        id: number;
        title: string;
        content: string;
        source_ref: string | null;
      }>`
        SELECT id, title, content, COALESCE(metadata->>'sourceRef', '') AS source_ref
        FROM public.assistant_knowledge_docs
        WHERE is_active = TRUE
          AND (
            title ~* '(社内日程|日程|カレンダー|calendar|행사|일정|賃金規程|規程|규정|交通費|교통비)'
            OR COALESCE(metadata->>'sourceRef', '') ~* '(sites\\.google\\.com|社内日程|賃金規程)'
          )
        ORDER BY updated_at DESC, id DESC
        LIMIT 4
      `;

      const merged = new Map<string, (typeof docs)[number]>();
      for (const row of docs) merged.set(`${row.docId ?? 0}:${row.title}`, row);

      for (const row of forced) {
        const key = `${row.id}:${row.title}`;
        if (!merged.has(key)) {
          merged.set(key, {
            docId: row.id,
            title: row.title,
            content: row.content,
            sourceRef: row.source_ref || undefined,
          });
        }
      }

      docs = Array.from(merged.values()).slice(0, 12);
    }

    let llm: Awaited<ReturnType<typeof askOpenAI>> | null = null;
    let llmError: string | null = null;

    try {
      llm = await askOpenAI({ question, faqRows, docRows: docs });
    } catch (e: any) {
      llmError = compactErrorMessage(e?.message ?? "LLM request failed");
    }

    if (llm?.answer) {
      const answer = sanitizeAssistantAnswer(llm.answer, question);

      await recordAssistantUsage({
        userId: user.id,
        inputTokens: llm.inputTokens > 0 ? llm.inputTokens : inputTokens,
        outputTokens:
          llm.outputTokens > 0 ? llm.outputTokens : estimateTokens(answer),
        source: "llm",
      });

      await tryRecordChatLog({
        userId: user.id,
        question,
        answer,
        mode: "llm",
        metadata: {
          sources: docs.slice(0, 5).map((d) => ({
            docId: d.docId ?? null,
            title: d.title,
            sourceRef: d.sourceRef ?? null,
          })),
          retrievalMode,
        },
      });

      await tryAppendDailyTxtLog({
        userLabel: `${user.username}(${user.id})`,
        mode: "llm",
        question,
        answer,
      });

      return NextResponse.json({
        ok: true,
        mode: mode === "llm" ? "llm" : "hybrid",
        answer,
        ...(includeDebug
          ? {
              debug: {
                retrievalMode,
                retrievalError,
                retrievalKeywords,
                docsUsed: docs.slice(0, 5).map((d) => ({
                  title: d.title,
                  similarity: Number(d.similarity ?? 0),
                })),
              },
            }
          : {}),
      });
    }

    if (docs[0]?.content) {
      const fallbackAnswer = makeSnippet(docs[0].content);
      const outputTokens = estimateTokens(fallbackAnswer);

      await recordAssistantUsage({
        userId: user.id,
        inputTokens,
        outputTokens,
        source: "knowledge",
      });

      await tryRecordChatLog({
        userId: user.id,
        question,
        answer: fallbackAnswer,
        mode: "knowledge",
        metadata: {
          sources: docs.slice(0, 3).map((d) => ({
            docId: d.docId ?? null,
            title: d.title,
            sourceRef: d.sourceRef ?? null,
          })),
          retrievalMode,
        },
      });

      await tryAppendDailyTxtLog({
        userLabel: `${user.username}(${user.id})`,
        mode: "knowledge",
        question,
        answer: fallbackAnswer,
      });

      return NextResponse.json({
        ok: true,
        mode: "knowledge",
        answer: fallbackAnswer,
        llm_error: llmError,
        ...(includeDebug
          ? { debug: { retrievalMode, retrievalError, retrievalKeywords } }
          : {}),
      });
    }

    const fallback = "제공된 자료에서 확인되지 않습니다.";

    await recordAssistantUsage({
      userId: user.id,
      inputTokens,
      outputTokens: estimateTokens(fallback),
      source: "miss",
    });

    await tryRecordChatLog({
      userId: user.id,
      question,
      answer: fallback,
      mode: "miss",
      metadata: {
        sources: docs.slice(0, 3).map((d) => ({
          docId: d.docId ?? null,
          title: d.title,
          sourceRef: d.sourceRef ?? null,
        })),
        retrievalMode,
      },
    });

    await tryAppendDailyTxtLog({
      userLabel: `${user.username}(${user.id})`,
      mode: "miss",
      question,
      answer: fallback,
    });

    return NextResponse.json({
      ok: true,
      mode: "miss",
      answer: fallback,
      llm_error: assistantError || llmError,
      ...(includeDebug
        ? { debug: { retrievalMode, retrievalError, retrievalKeywords } }
        : {}),
    });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Assistant ask failed" },
      { status: 500 },
    );
  }
}
