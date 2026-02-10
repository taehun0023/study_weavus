// app/api/lesson-bundles/[lessonId]/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { parseOptions } from "@/lib/quiz/parseOptions";

export const runtime = "nodejs";

// UI에서 사용하는 questionType을 모두 허용
type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "number"
  | "short_answer";

type QuestionPayload = {
  /** edit 화면에서는 기존 DB id가 넘어옴(문항 update를 위해 필요) */
  id?: number | string;
  questionText: string;
  questionType: QuestionType;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  orderIndex: number;
};

type AttachmentIdsByType = {
  lesson?: number[];
  reference?: number[];
  quiz?: number[];
};

type BundlePutBody = {
  courseId: number;
  lesson: {
    title: string;
    difficulty: "easy" | "medium" | "hard" | "project" | null;
    content: string;
  };
  reference?: { title: string; content: string } | null;
  quiz?: { title: string; content?: string } | null;
  questions?: QuestionPayload[];

  // ✅ 신버전
  attachmentUploadIdsByType?: AttachmentIdsByType;

  // ✅ 구버전(호환)
  attachmentUploadIds?: number[];
};

function hasMeaningfulHtml(s: any) {
  if (typeof s !== "string") return false;
  if (/<img\b/i.test(s)) return true;
  const text = s
    .replace(/&nbsp;/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0;
}

function isNonEmptyText(s: any) {
  return typeof s === "string" && s.trim().length > 0;
}

function toIds(arr: any): number[] {
  if (!Array.isArray(arr)) return [];
  const ids = arr
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);
  return Array.from(new Set(ids));
}

// -----------------------------
// ✅ quiz re-grade helpers
// -----------------------------
function isBlank(v: any): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

function toFiniteInt(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function normalizeForCompare(input: any) {
  return String(input ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function gradeAnswer(args: {
  questionType: string;
  optionsRaw: any;
  correctRaw: any;
  userAnswerRaw: any;
  answerState?: any;
}): boolean {
  const opts = parseOptions(args.optionsRaw);
  const unanswered =
    args.answerState === "unanswered" ||
    args.answerState === "UNANSWERED" ||
    isBlank(args.userAnswerRaw);

  if (unanswered) return false;

  const userRaw = args.userAnswerRaw;
  const userAnswerText = String(userRaw ?? "");
  const correctRaw = String(args.correctRaw ?? "");

  // multiple_choice: 기본은 index 문자열 비교. 레거시로 텍스트도 허용
  if (args.questionType === "multiple_choice") {
    const uIdx = toFiniteInt(userRaw);
    const cIdx = toFiniteInt(correctRaw);

    // 둘 다 index면 index 비교
    if (uIdx != null && cIdx != null) return uIdx === cIdx;

    // index vs 텍스트 혼재 방어
    if (uIdx != null && opts.length > 0) {
      const uText = String(opts[uIdx] ?? "");
      return normalizeForCompare(uText) === normalizeForCompare(correctRaw);
    }

    return (
      normalizeForCompare(userAnswerText) === normalizeForCompare(correctRaw)
    );
  }

  // true_false: true/false, 1/0, o/x 허용
  if (args.questionType === "true_false") {
    const u = normalizeForCompare(userAnswerText).toLowerCase();
    const c = normalizeForCompare(correctRaw).toLowerCase();
    const uNorm =
      u === "o" || u === "true" || u === "1"
        ? "true"
        : u === "x" || u === "false" || u === "0"
          ? "false"
          : u;
    const cNorm =
      c === "o" || c === "true" || c === "1"
        ? "true"
        : c === "x" || c === "false" || c === "0"
          ? "false"
          : c;
    return uNorm === cNorm;
  }

  // number: 문자열 비교(공백 제거). 필요하면 향후 number tolerance 확장
  if (args.questionType === "number") {
    return (
      normalizeForCompare(userAnswerText) === normalizeForCompare(correctRaw)
    );
  }

  // short_answer: "||"로 여러 정답 허용(기존 submit 로직과 동일)
  const candidates = String(correctRaw ?? "")
    .split("||")
    .map((x) => x.replace(/\r\n/g, "\n").trim());
  const userNorm = normalizeForCompare(userAnswerText);
  return candidates.some((c) => userNorm === normalizeForCompare(c));
}

async function regradeQuizAttempts(client: any, quizId: number) {
  // 현재 문항 (✅ 삭제된 문항 제외)
  const questions = (
    await client.query(
      `
      SELECT id, correct_answer, options, question_type
      FROM public.quiz_questions
      WHERE post_id=$1
        AND is_deleted = FALSE
      ORDER BY order_index ASC, id ASC
      `,
      [quizId],
    )
  ).rows as {
    id: number;
    correct_answer: string;
    options: any;
    question_type: string;
  }[];

  const totalQuestions = questions.length;

  const attempts = (
    await client.query(
      `SELECT id, user_id, created_at FROM public.quiz_attempts WHERE post_id=$1 ORDER BY created_at ASC, id ASC`,
      [quizId],
    )
  ).rows as { id: number; user_id: number; created_at: string }[];

  // attempt 별로 답안 upsert + 재채점
  for (const a of attempts) {
    const answers = (
      await client.query(
        `
        SELECT id, question_id, user_answer, answer_state
        FROM public.quiz_attempt_answers
        WHERE attempt_id=$1
        `,
        [a.id],
      )
    ).rows as {
      id: number;
      question_id: number;
      user_answer: string | null;
      answer_state: string | null;
    }[];

    const byQ = new Map<number, (typeof answers)[number]>();
    for (const r of answers) byQ.set(Number(r.question_id), r);

    let score = 0;

    for (const q of questions) {
      const ex = byQ.get(q.id);

      // ✅ 새로 추가된 문제면: 기존 attempt에 "미제출" row를 만들어 둔다
      if (!ex) {
        await client.query(
          `
          INSERT INTO public.quiz_attempt_answers
            (attempt_id, question_id, user_answer, answer_state, is_correct)
          VALUES
            ($1, $2, NULL, 'unanswered', false)
          `,
          [a.id, q.id],
        );
        continue;
      }

      const isCorrect = gradeAnswer({
        questionType: q.question_type,
        optionsRaw: q.options,
        correctRaw: q.correct_answer,
        userAnswerRaw: ex.user_answer,
        answerState: ex.answer_state,
      });

      if (isCorrect) score++;

      await client.query(
        `UPDATE public.quiz_attempt_answers SET is_correct=$1 WHERE id=$2`,
        [isCorrect, ex.id],
      );
    }

    const isPerfect = totalQuestions > 0 && score === totalQuestions;
    await client.query(
      `
      UPDATE public.quiz_attempts
      SET score=$1, total_questions=$2, is_perfect=$3
      WHERE id=$4
      `,
      [score, totalQuestions, isPerfect, a.id],
    );
  }

  // user_quiz_progress 재계산
  const users = (
    await client.query(
      `SELECT DISTINCT user_id FROM public.quiz_attempts WHERE post_id=$1`,
      [quizId],
    )
  ).rows as { user_id: number }[];

  for (const u of users) {
    const rows = (
      await client.query(
        `
        SELECT score, created_at
        FROM public.quiz_attempts
        WHERE post_id=$1 AND user_id=$2
        ORDER BY created_at ASC, id ASC
        `,
        [quizId, u.user_id],
      )
    ).rows as { score: number; created_at: string }[];

    const attemptCount = rows.length;
    const bestScore = rows.reduce(
      (m, r) => Math.max(m, Number(r.score) || 0),
      0,
    );
    const lastScore =
      attemptCount > 0 ? Number(rows[attemptCount - 1].score) || 0 : 0;
    const completed = totalQuestions > 0 && bestScore === totalQuestions;

    await client.query(
      `
      INSERT INTO public.user_quiz_progress (user_id, post_id, best_score, last_score, completed, attempt_count, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id, post_id)
      DO UPDATE SET
        best_score=EXCLUDED.best_score,
        last_score=EXCLUDED.last_score,
        completed=EXCLUDED.completed,
        attempt_count=EXCLUDED.attempt_count,
        updated_at=NOW()
      `,
      [u.user_id, quizId, bestScore, lastScore, completed, attemptCount],
    );
  }
}

function pickAttachmentIds(body: Partial<BundlePutBody>) {
  const by = body.attachmentUploadIdsByType ?? {};
  const lessonIds = toIds(by.lesson);
  const legacy = toIds((body as any).attachmentUploadIds);

  return {
    lessonIds: Array.from(new Set([...lessonIds, ...legacy])),
    referenceIds: toIds(by.reference),
    quizIds: toIds(by.quiz),
  };
}

async function loadAttachments(client: any, postId: number) {
  return (
    await client.query(
      `
      SELECT
        pa.upload_id,
        pa.label,
        pa.order_index,
        u.filename,
        u.mime,
        u.size
      FROM public.post_attachments pa
      JOIN public.uploads u ON u.id = pa.upload_id
      WHERE pa.post_id = $1
      ORDER BY pa.order_index ASC, pa.id ASC
      `,
      [postId],
    )
  ).rows.map((r: any) => ({
    uploadId: r.upload_id,
    label: r.label,
    filename: r.filename,
    mime: r.mime,
    size: r.size,
    url: `/api/upload/${r.upload_id}`,
  }));
}

async function replaceAttachments(
  client: any,
  postId: number,
  uploadIds: number[],
) {
  await client.query(`DELETE FROM public.post_attachments WHERE post_id=$1`, [
    postId,
  ]);
  for (let i = 0; i < uploadIds.length; i++) {
    await client.query(
      `
      INSERT INTO public.post_attachments (post_id, upload_id, order_index)
      VALUES ($1, $2, $3)
      `,
      [postId, uploadIds[i], i],
    );
  }
}

/**
 * ✅ "연결 해제"가 아니라 "진짜 삭제"를 위한 helper
 * - FK 문제 방지 위해 attachments/questions 먼저 삭제
 * - 마지막에 posts 삭제
 */
async function deleteReferencePostCascade(client: any, postId: number) {
  await client.query(`DELETE FROM public.post_attachments WHERE post_id=$1`, [
    postId,
  ]);
  await client.query(
    `DELETE FROM public.posts WHERE id=$1 AND type='reference'`,
    [postId],
  );
}

async function deleteQuizPostCascade(client: any, postId: number) {
  await client.query(`DELETE FROM public.quiz_questions WHERE post_id=$1`, [
    postId,
  ]);
  await client.query(`DELETE FROM public.post_attachments WHERE post_id=$1`, [
    postId,
  ]);
  await client.query(`DELETE FROM public.posts WHERE id=$1 AND type='quiz'`, [
    postId,
  ]);
}

export async function GET(
  _req: Request,
  { params }: { params: { lessonId: string } | Promise<{ lessonId: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (user.user_role !== "ADMIN")
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const p = params ? await params : ({ lessonId: "" } as any);
  const lessonId = Number.parseInt(String((p as any).lessonId ?? ""), 10);
  if (!Number.isFinite(lessonId) || lessonId <= 0) {
    return NextResponse.json({ message: "Invalid lessonId" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const lessonRes = await client.query(
      `
      SELECT id, course_id, title, difficulty, content
      FROM public.posts
      WHERE id = $1 AND type='lesson'
      LIMIT 1
      `,
      [lessonId],
    );
    const lesson = lessonRes.rows[0];
    if (!lesson)
      return NextResponse.json({ message: "Not a lesson" }, { status: 404 });

    const setRes = await client.query(
      `
      SELECT reference_post_id, quiz_post_id
      FROM public.lesson_sets
      WHERE lesson_id = $1
      LIMIT 1
      `,
      [lessonId],
    );
    const setRow = setRes.rows[0] ?? {
      reference_post_id: null,
      quiz_post_id: null,
    };

    const referenceId = setRow.reference_post_id as number | null;
    const quizId = setRow.quiz_post_id as number | null;

    const refPost = referenceId
      ? (
          await client.query(
            `SELECT id, title, content FROM public.posts WHERE id=$1 AND type='reference' LIMIT 1`,
            [referenceId],
          )
        ).rows[0]
      : null;

    const quizPost = quizId
      ? (
          await client.query(
            `SELECT id, title, content FROM public.posts WHERE id=$1 AND type='quiz' LIMIT 1`,
            [quizId],
          )
        ).rows[0]
      : null;

    const questions = quizId
      ? (
          await client.query(
            `
        SELECT id, question_text, question_type, options, correct_answer, explanation, order_index
        FROM public.quiz_questions
        WHERE post_id = $1
          AND is_deleted = FALSE
        ORDER BY order_index ASC
        `,
            [quizId],
          )
        ).rows.map((r: any) => ({
          id: r.id,
          questionText: r.question_text,
          questionType: r.question_type,
          options: (() => {
            if (Array.isArray(r.options)) return r.options;
            if (typeof r.options === "string") {
              try {
                const parsed = JSON.parse(r.options);
                if (Array.isArray(parsed)) return parsed;
              } catch {}
            }
            return r.options ? r.options : [];
          })(),
          correctAnswer: r.correct_answer,
          explanation: r.explanation ?? "",
          orderIndex: r.order_index,
        }))
      : [];

    // ✅ attachments by type
    const lessonAtts = await loadAttachments(client, lessonId);
    const refAtts = referenceId
      ? await loadAttachments(client, referenceId)
      : [];
    const quizAtts = quizId ? await loadAttachments(client, quizId) : [];

    return NextResponse.json({
      ok: true,
      courseId: lesson.course_id,
      lesson: {
        id: lesson.id,
        title: lesson.title,
        difficulty: lesson.difficulty,
        content: lesson.content ?? "",
      },
      reference: refPost
        ? {
            id: refPost.id,
            title: refPost.title,
            content: refPost.content ?? "",
          }
        : null,
      quiz: quizPost
        ? {
            id: quizPost.id,
            title: quizPost.title,
            content: quizPost.content ?? "",
          }
        : null,
      questions,

      // ✅ 신버전
      attachmentsByType: {
        lesson: lessonAtts,
        reference: refAtts,
        quiz: quizAtts,
      },

      // ✅ 구버전 호환(기존 UI가 attachments만 쓰면 lesson만 보이게)
      attachments: lessonAtts,
    });
  } finally {
    client.release();
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { lessonId: string } | Promise<{ lessonId: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (user.user_role !== "ADMIN")
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const p = params ? await params : ({ lessonId: "" } as any);
  const lessonId = Number.parseInt(String((p as any).lessonId ?? ""), 10);
  if (!Number.isFinite(lessonId) || lessonId <= 0) {
    return NextResponse.json({ message: "Invalid lessonId" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<BundlePutBody>;

  const courseId = Number(body.courseId ?? NaN);
  if (!Number.isFinite(courseId) || courseId <= 0) {
    return NextResponse.json({ message: "Invalid courseId" }, { status: 400 });
  }

  if (
    !body.lesson ||
    !isNonEmptyText(body.lesson.title) ||
    !hasMeaningfulHtml(body.lesson.content)
  ) {
    return NextResponse.json(
      { message: "Lesson title/content required" },
      { status: 400 },
    );
  }

  const reference = body.reference ?? null;
  const quiz = body.quiz ?? null;
  const questions = Array.isArray(body.questions) ? body.questions : [];

  const { lessonIds, referenceIds, quizIds } = pickAttachmentIds(body);

  const hasRefAny =
    (reference &&
      (isNonEmptyText(reference.title) ||
        hasMeaningfulHtml(reference.content))) ||
    false;
  const hasRefAttachments = referenceIds.length > 0;

  if (hasRefAttachments && !isNonEmptyText(reference?.title)) {
    return NextResponse.json(
      { message: "Reference attachments require reference title" },
      { status: 400 },
    );
  }

  if (
    hasRefAny &&
    (!isNonEmptyText(reference?.title) ||
      !hasMeaningfulHtml(reference?.content))
  ) {
    return NextResponse.json(
      { message: "Reference title/content must be both filled" },
      { status: 400 },
    );
  }

  const hasQuiz = !!(quiz && isNonEmptyText(quiz.title));
  const hasQuizAttachments = quizIds.length > 0;

  if (hasQuizAttachments && !isNonEmptyText(quiz?.title)) {
    return NextResponse.json(
      { message: "Quiz attachments require quiz title" },
      { status: 400 },
    );
  }

  if (quiz && !hasQuiz && !hasQuizAttachments) {
    return NextResponse.json(
      { message: "Quiz title must be filled or quiz should be null" },
      { status: 400 },
    );
  }

  for (const q of hasQuiz ? questions : []) {
    if (!isNonEmptyText(q.questionText))
      return NextResponse.json(
        { message: "Question text required" },
        { status: 400 },
      );
    // questionType: UI에서 사용하는 값들을 모두 허용
    // - multiple_choice: 객관식(보기)
    // - true_false: O/X
    // - number: 숫자 정답
    // - short_answer: 단답(텍스트)
    if (
      q.questionType !== "multiple_choice" &&
      q.questionType !== "true_false" &&
      q.questionType !== "number" &&
      q.questionType !== "short_answer"
    )
      return NextResponse.json(
        { message: "Invalid questionType" },
        { status: 400 },
      );
    if (!isNonEmptyText(q.correctAnswer))
      return NextResponse.json(
        { message: "Correct answer required" },
        { status: 400 },
      );

    if (q.questionType === "multiple_choice") {
      const opts = Array.isArray(q.options)
        ? q.options.map((x) => String(x).trim()).filter(Boolean)
        : [];
      if (opts.length < 2)
        return NextResponse.json(
          { message: "Multiple choice needs >= 2 options" },
          { status: 400 },
        );
    }
  }

  const allIds = Array.from(
    new Set([...lessonIds, ...referenceIds, ...quizIds]),
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // uploadIds 존재 검증
    if (allIds.length > 0) {
      const up = await client.query(
        `SELECT id FROM public.uploads WHERE id = ANY($1::bigint[])`,
        [allIds],
      );
      if (up.rows.length !== allIds.length) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { message: "Some attachment uploadIds not found" },
          { status: 400 },
        );
      }
    }

    // lesson 존재 확인
    const lessonRes = await client.query(
      `SELECT id FROM public.posts WHERE id=$1 AND type='lesson' LIMIT 1`,
      [lessonId],
    );
    if (lessonRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ message: "Not a lesson" }, { status: 404 });
    }

    const setRes = await client.query(
      `SELECT reference_post_id, quiz_post_id FROM public.lesson_sets WHERE lesson_id=$1 LIMIT 1`,
      [lessonId],
    );
    const setRow = setRes.rows[0] ?? {
      reference_post_id: null,
      quiz_post_id: null,
    };

    // ✅ 기존 값 보관 (삭제 시 필요)
    const oldReferenceId: number | null = setRow.reference_post_id;
    const oldQuizId: number | null = setRow.quiz_post_id;

    let referenceId: number | null = setRow.reference_post_id;
    let quizId: number | null = setRow.quiz_post_id;

    // reference 연결/생성/제거
    const shouldHaveRef = hasRefAny || hasRefAttachments;

    if (!shouldHaveRef) {
      referenceId = null;

      // ✅ 실제 reference post 삭제
      if (oldReferenceId) {
        await deleteReferencePostCascade(client, oldReferenceId);
      }
    } else if (!referenceId) {
      const refInsert = await client.query<{ id: number }>(
        `
        INSERT INTO public.posts (course_id, title, type, difficulty, content)
        VALUES ($1, $2, 'reference', NULL, $3)
        RETURNING id
        `,
        [courseId, (reference?.title ?? "").trim(), reference?.content ?? ""],
      );
      referenceId = refInsert.rows[0].id;
    }

    // quiz 연결/생성/제거
    const shouldHaveQuiz = hasQuiz || hasQuizAttachments;

    if (!shouldHaveQuiz) {
      quizId = null;

      // ✅ 실제 quiz post 삭제 + 문항/첨부 정리
      if (oldQuizId) {
        await deleteQuizPostCascade(client, oldQuizId);
      }
    } else if (!quizId) {
      const quizInsert = await client.query<{ id: number }>(
        `
        INSERT INTO public.posts (course_id, title, type, difficulty, content)
        VALUES ($1, $2, 'quiz', NULL, $3)
        RETURNING id
        `,
        [courseId, (quiz?.title ?? "").trim(), quiz?.content ?? ""],
      );
      quizId = quizInsert.rows[0].id;
    }

    // lesson update
    await client.query(
      `
      UPDATE public.posts
      SET course_id=$1, title=$2, difficulty=$3, content=$4
      WHERE id=$5 AND type='lesson'
      `,
      [
        courseId,
        body.lesson.title.trim(),
        body.lesson.difficulty ?? null,
        body.lesson.content,
        lessonId,
      ],
    );

    if (referenceId && shouldHaveRef) {
      await client.query(
        `
        UPDATE public.posts
        SET course_id=$1, title=$2, content=$3
        WHERE id=$4 AND type='reference'
        `,
        [
          courseId,
          (reference?.title ?? "").trim(),
          reference?.content ?? "",
          referenceId,
        ],
      );
    }

    if (quizId && shouldHaveQuiz) {
      await client.query(
        `
        UPDATE public.posts
        SET course_id=$1, title=$2, content=$3
        WHERE id=$4 AND type='quiz'
        `,
        [courseId, (quiz?.title ?? "").trim(), quiz?.content ?? "", quizId],
      );
    }

    // lesson_sets upsert
    await client.query(
      `
      INSERT INTO public.lesson_sets (lesson_id, reference_post_id, quiz_post_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (lesson_id)
      DO UPDATE SET
        reference_post_id = EXCLUDED.reference_post_id,
        quiz_post_id = EXCLUDED.quiz_post_id,
        updated_at = CURRENT_TIMESTAMP
      `,
      [lessonId, referenceId, quizId],
    );

    // ✅ attachments replace (탭별)
    await replaceAttachments(client, lessonId, lessonIds);

    if (referenceId) {
      await replaceAttachments(client, referenceId, referenceIds);
    }

    if (quizId) {
      await replaceAttachments(client, quizId, quizIds);
    }

    // ✅ questions upsert (B안: "항상 최신 기준 재채점")
    // - 문항 id는 절대 바꾸지 않는다(DELETE+INSERT 금지)
    // - 삭제는 soft delete(is_deleted=true)
    // - 기존 문항: UPDATE (is_deleted=false로 복구 포함)
    // - 새 문항: INSERT (is_deleted=false)
    // - 저장 후: 전체 attempt를 현재 문항 기준으로 재채점/재집계
    if (quizId && hasQuiz) {
      const existing = (
        await client.query(
          `SELECT id FROM public.quiz_questions WHERE post_id=$1`,
          [quizId],
        )
      ).rows
        .map((r: any) => Number(r.id))
        .filter((n: any) => Number.isFinite(n));
      const existingSet = new Set<number>(existing);

      const sorted = [...questions].sort((a, b) => a.orderIndex - b.orderIndex);

      // payload에 포함된 "유지" id 수집
      const keepIds = new Set<number>();
      for (const q of sorted) {
        const qidRaw = (q as any).id;
        const qid =
          typeof qidRaw === "number"
            ? qidRaw
            : typeof qidRaw === "string"
              ? Number.parseInt(qidRaw, 10)
              : NaN;
        if (Number.isFinite(qid) && qid > 0) keepIds.add(qid);
      }

      // ✅ 제거된 문항은 soft delete
      const toDelete = existing.filter((id) => !keepIds.has(id));
      if (toDelete.length > 0) {
        // ✅ 방어: 기존 문항이 있는데 payload에서 id가 1개도 안 오면(프론트 버그)
        // 전부 삭제 사고 방지 → soft delete도 하지 않음
        if (existing.length > 0 && keepIds.size === 0 && sorted.length > 0) {
          // noop
        } else {
          await client.query(
            `UPDATE public.quiz_questions
         SET is_deleted = TRUE
         WHERE post_id=$1 AND id = ANY($2::bigint[])`,
            [quizId, toDelete],
          );
        }
      }

      // UPDATE / INSERT
      for (const q of sorted) {
        const opts =
          q.questionType === "multiple_choice"
            ? Array.isArray(q.options)
              ? q.options.map((x) => String(x).trim()).filter(Boolean)
              : []
            : null;
        const optionsJson = opts === null ? null : JSON.stringify(opts);

        const qidRaw = (q as any).id;
        const qid =
          typeof qidRaw === "number"
            ? qidRaw
            : typeof qidRaw === "string"
              ? Number.parseInt(qidRaw, 10)
              : NaN;

        // 기존 문항이면 UPDATE (삭제됐던 문항도 되살림: is_deleted=FALSE)
        if (Number.isFinite(qid) && qid > 0 && existingSet.has(qid)) {
          await client.query(
            `
        UPDATE public.quiz_questions
        SET question_text=$1, question_type=$2, options=$3::jsonb, correct_answer=$4, explanation=$5, order_index=$6,
            is_deleted=FALSE
        WHERE id=$7 AND post_id=$8
        `,
            [
              q.questionText,
              q.questionType,
              optionsJson,
              q.correctAnswer,
              (q as any).explanation ?? null,
              q.orderIndex,
              qid,
              quizId,
            ],
          );
          continue;
        }

        // 신규 문항이면 INSERT
        await client.query(
          `
      INSERT INTO public.quiz_questions
        (post_id, question_text, question_type, options, correct_answer, explanation, order_index, is_deleted)
      VALUES
        ($1, $2, $3, $4::jsonb, $5, $6, $7, FALSE)
      `,
          [
            quizId,
            q.questionText,
            q.questionType,
            optionsJson,
            q.correctAnswer,
            (q as any).explanation ?? null,
            q.orderIndex,
          ],
        );
      }

      // ✅ 현재 문항 기준으로 제출/진척도 재계산(정답변경/문항추가/삭제 모두 반영)
      await regradeQuizAttempts(client, quizId);
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, lessonId, referenceId, quizId });
  } catch (e: any) {
    await client.query("ROLLBACK");
    return NextResponse.json(
      { message: e?.message ?? "Update failed" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
