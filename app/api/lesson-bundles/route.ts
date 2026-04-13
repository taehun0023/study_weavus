// app/api/lesson-bundles/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

type Difficulty = "easy" | "medium" | "hard" | "project" | null;
type QuestionType =
  | "multiple_choice"
  | "short_answer"
  | "true_false"
  | "number";

type QuestionPayload = {
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

type BundleBody = {
  courseId: number;
  lesson: { title: string; difficulty: Difficulty; content: string };

  reference?: { title: string; content: string } | null;
  quiz?: { title: string; content?: string } | null;
  questions?: QuestionPayload[];

  // ✅ 신버전(탭별)
  attachmentUploadIdsByType?: AttachmentIdsByType;

  // ✅ 구버전(호환용: lesson에 붙임)
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

function pickAttachmentIds(body: Partial<BundleBody>) {
  // 신버전 우선
  const by = body.attachmentUploadIdsByType ?? {};
  const lessonIds = toIds(by.lesson);

  // 구버전 호환: attachmentUploadIds는 lessonIds에 합침
  const legacy = toIds((body as any).attachmentUploadIds);
  const mergedLesson = Array.from(new Set([...lessonIds, ...legacy]));

  return {
    lessonIds: mergedLesson,
    referenceIds: toIds(by.reference),
    quizIds: toIds(by.quiz),
  };
}

async function replaceAttachments(
  client: any,
  postId: number,
  uploadIds: number[]
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
      [postId, uploadIds[i], i]
    );
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (user.user_role !== "ADMIN")
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Partial<BundleBody>;

  const courseId = Number(body.courseId ?? NaN);
  if (!Number.isFinite(courseId) || courseId <= 0) {
    return NextResponse.json({ message: "Invalid courseId" }, { status: 400 });
  }

  const lesson = body.lesson;
  const reference = body.reference ?? null;
  const quiz = body.quiz ?? null;
  const questions = Array.isArray(body.questions) ? body.questions : [];

  const { lessonIds, referenceIds, quizIds } = pickAttachmentIds(body);

  if (
    !lesson ||
    !isNonEmptyText(lesson.title) ||
    !hasMeaningfulHtml(lesson.content)
  ) {
    return NextResponse.json(
      { message: "Lesson title/content required" },
      { status: 400 }
    );
  }

  // reference: 내용이 있으면 title/content 둘다 필요
  const hasRefAny =
    (reference &&
      (isNonEmptyText(reference.title) ||
        hasMeaningfulHtml(reference.content))) ||
    false;

  // ✅ reference 첨부가 있으면 title은 필수(내용은 선택)
  const hasRefAttachments = referenceIds.length > 0;

  if (hasRefAttachments && !isNonEmptyText(reference?.title)) {
    return NextResponse.json(
      { message: "Reference attachments require reference title" },
      { status: 400 }
    );
  }

  if (
    hasRefAny &&
    (!isNonEmptyText(reference?.title) ||
      !hasMeaningfulHtml(reference?.content))
  ) {
    return NextResponse.json(
      { message: "Reference title/content must be both filled" },
      { status: 400 }
    );
  }

  // quiz: 기존 규칙 유지(제목이 있으면 문항 1개 이상)
  const hasQuiz = !!(quiz && isNonEmptyText(quiz.title));
  if (quiz && !hasQuiz) {
    return NextResponse.json(
      { message: "Quiz title must be filled or quiz should be null" },
      { status: 400 }
    );
  }

  // ✅ quiz 첨부가 있으면 quiz title 필수
  const hasQuizAttachments = quizIds.length > 0;
  if (hasQuizAttachments && !isNonEmptyText(quiz?.title)) {
    return NextResponse.json(
      { message: "Quiz attachments require quiz title" },
      { status: 400 }
    );
  }

  if (hasQuiz && questions.length === 0) {
    return NextResponse.json(
      { message: "At least 1 question required when quiz reveals" },
      { status: 400 }
    );
  }

  for (const q of hasQuiz ? questions : []) {
    if (!isNonEmptyText(q.questionText)) {
      return NextResponse.json(
        { message: "Question text required" },
        { status: 400 }
      );
    }
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
    ) {
      return NextResponse.json(
        { message: "Invalid questionType" },
        { status: 400 }
      );
    }
    if (!isNonEmptyText(q.correctAnswer)) {
      return NextResponse.json(
        { message: "Correct answer required" },
        { status: 400 }
      );
    }
    if (q.questionType === "multiple_choice") {
      const opts = Array.isArray(q.options)
        ? q.options.map((x) => String(x).trim()).filter(Boolean)
        : [];
      if (opts.length < 2) {
        return NextResponse.json(
          { message: "Multiple choice needs >= 2 options" },
          { status: 400 }
        );
      }
    }
  }

  const allIds = Array.from(
    new Set([...lessonIds, ...referenceIds, ...quizIds])
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 업로드 id 존재 검증
    if (allIds.length > 0) {
      const up = await client.query(
        `SELECT id FROM public.uploads WHERE id = ANY($1::bigint[])`,
        [allIds]
      );
      if (up.rows.length !== allIds.length) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { message: "Some attachment uploadIds not found" },
          { status: 400 }
        );
      }
    }

    // 1) lesson 생성
    const lessonRes = await client.query<{ id: number }>(
      `
      INSERT INTO public.posts (course_id, title, type, difficulty, content)
      VALUES ($1, $2, 'lesson', $3, $4)
      RETURNING id
      `,
      [courseId, lesson.title.trim(), lesson.difficulty ?? null, lesson.content]
    );
    const lessonId = lessonRes.rows[0].id;

    // 2) reference 생성(선택) - 내용 있거나 첨부 있으면 생성
    let referenceId: number | null = null;
    const shouldCreateRef = hasRefAny || hasRefAttachments;
    if (shouldCreateRef) {
      const refTitle = (reference?.title ?? "").trim();
      const refContent = reference?.content ?? "";

      const refRes = await client.query<{ id: number }>(
        `
        INSERT INTO public.posts (course_id, title, type, difficulty, content)
        VALUES ($1, $2, 'reference', NULL, $3)
        RETURNING id
        `,
        [courseId, refTitle, refContent]
      );
      referenceId = refRes.rows[0].id;
    }

    // 3) quiz 생성(선택) - 제목 있거나 첨부 있으면 생성
    let quizId: number | null = null;
    const shouldCreateQuiz = hasQuiz || hasQuizAttachments;
    if (shouldCreateQuiz) {
      const quizTitle = (quiz?.title ?? "").trim();
      const quizContent = quiz?.content ?? "";

      const quizRes = await client.query<{ id: number }>(
        `
        INSERT INTO public.posts (course_id, title, type, difficulty, content)
        VALUES ($1, $2, 'quiz', NULL, $3)
        RETURNING id
        `,
        [courseId, quizTitle, quizContent]
      );
      quizId = quizRes.rows[0].id;
    }

    // 4) lesson_sets upsert
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
      [lessonId, referenceId, quizId]
    );

    // 5) attachments 저장(탭별)
    await replaceAttachments(client, lessonId, lessonIds);

    if (referenceId)
      await replaceAttachments(client, referenceId, referenceIds);
    if (quizId) await replaceAttachments(client, quizId, quizIds);

    // 6) quiz_questions insert(quiz가 “문항형”으로 존재할 때만)
    if (hasQuiz && quizId) {
      for (const q of [...questions].sort(
        (a, b) => a.orderIndex - b.orderIndex
      )) {
        const opts =
          q.questionType === "multiple_choice"
            ? Array.isArray(q.options)
              ? q.options.map((x) => String(x).trim()).filter(Boolean)
              : []
            : null;

        const optionsJson = opts === null ? null : JSON.stringify(opts);

        await client.query(
          `
          INSERT INTO public.quiz_questions
            (post_id, question_text, question_type, options, correct_answer, explanation, order_index)
          VALUES
            ($1, $2, $3, $4::jsonb, $5, $6, $7)
          `,
          [
            quizId,
            q.questionText,
            q.questionType,
            optionsJson,
            q.correctAnswer,
            q.explanation ?? null,
            q.orderIndex,
          ]
        );
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, lessonId, referenceId, quizId });
  } catch (e: any) {
    await client.query("ROLLBACK");
    return NextResponse.json(
      { message: e?.message ?? "Transaction failed" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
