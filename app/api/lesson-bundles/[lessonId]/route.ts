// app/api/lesson-bundles/[lessonId]/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

type QuestionType = "multiple_choice" | "short_answer";

type QuestionPayload = {
  questionText: string;
  questionType: QuestionType;
  options?: string[];
  correctAnswer: string;
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
            SELECT id, question_text, question_type, options, correct_answer, order_index
            FROM public.quiz_questions
            WHERE post_id = $1
            ORDER BY order_index ASC
            `,
            [quizId],
          )
        ).rows.map((r: any) => ({
          id: r.id,
          questionText: r.question_text,
          questionType: r.question_type,
          options: Array.isArray(r.options)
            ? r.options
            : r.options
              ? r.options
              : [],
          correctAnswer: r.correct_answer,
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

  if (hasQuiz && questions.length === 0) {
    return NextResponse.json(
      { message: "At least 1 question required when quiz reveals" },
      { status: 400 },
    );
  }

  for (const q of hasQuiz ? questions : []) {
    if (!isNonEmptyText(q.questionText))
      return NextResponse.json(
        { message: "Question text required" },
        { status: 400 },
      );
    if (
      q.questionType !== "multiple_choice" &&
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

    // questions replace (퀴즈가 문항형으로 존재할 때만)
    if (quizId && hasQuiz) {
      await client.query(`DELETE FROM public.quiz_questions WHERE post_id=$1`, [
        quizId,
      ]);

      const sorted = [...questions].sort((a, b) => a.orderIndex - b.orderIndex);
      for (const q of sorted) {
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
            (post_id, question_text, question_type, options, correct_answer, order_index)
          VALUES
            ($1, $2, $3, $4::jsonb, $5, $6)
          `,
          [
            quizId,
            q.questionText,
            q.questionType,
            optionsJson,
            q.correctAnswer,
            q.orderIndex,
          ],
        );
      }
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
