import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

type TotalRow = { total: number };

type ProgressUserRow = {
  user_id: number;
  username: string;
  display_name: string | null;
  completed: number;
  last_raised_at: string | null;
};

type ProgressDetailRow = {
  username: string;
  display_name: string | null;
  post_id: number;
  title: string;
  first_at: string;
  course_slug: string;
};

type TimelineRow = {
  username: string;
  day: string;
  cnt: number;
};

function isValidISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export async function GET(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (me.user_role !== "ADMIN")
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const course = (searchParams.get("course") || "java").toLowerCase();

    const qFrom = searchParams.get("from");
    const qTo = searchParams.get("to");
    const hasExplicitRange = Boolean(qFrom && qTo);

    if ((qFrom && !qTo) || (!qFrom && qTo)) {
      return NextResponse.json(
        { message: "from/to must be both provided or both omitted" },
        { status: 400 },
      );
    }
    if (hasExplicitRange) {
      if (!isValidISODate(qFrom!) || !isValidISODate(qTo!)) {
        return NextResponse.json(
          { message: "from/to must be YYYY-MM-DD" },
          { status: 400 },
        );
      }
    }

    // 총 퀴즈 수(코스별)
    const totalRows = await sql<TotalRow>`
      SELECT count(*)::int AS total
      FROM posts p
      JOIN courses c ON c.id = p.course_id
      WHERE p.type = 'quiz'
        AND lower(c.slug) = ${course}
    `;
    const total = totalRows[0]?.total ?? 0;

    // ✅ users: 기본(전체유저)은 "전체기간 누적", 기간 지정이면 "기간 내 + completed>0"
    const users = hasExplicitRange
      ? await sql<ProgressUserRow>`
  WITH first_perfect AS (
    SELECT
      qa.user_id,
      qa.post_id,
      min(qa.created_at) AS first_at
    FROM quiz_attempts qa
    WHERE qa.is_perfect IS TRUE
    GROUP BY qa.user_id, qa.post_id
  ),
  first_perfect_range AS (
    SELECT *
    FROM first_perfect fp
    WHERE fp.first_at::date BETWEEN ${qFrom!}::date AND ${qTo!}::date
  ),
  first_perfect_course AS (
    SELECT fpr.*
    FROM first_perfect_range fpr
    JOIN posts p ON p.id = fpr.post_id
    JOIN courses c ON c.id = p.course_id
    WHERE p.type='quiz'
      AND lower(c.slug) = ${course}
  ),
  user_done AS (
    SELECT
      u.id AS user_id,
      u.username,
      u.display_name,
      count(fpc.post_id)::int AS completed,
      max(fpc.first_at) AS last_raised_at
    FROM users u
    LEFT JOIN first_perfect_course fpc ON fpc.user_id = u.id
    WHERE u.user_role = 'USER'
    GROUP BY u.id, u.username, u.display_name
  )
  SELECT
    user_id,
    username,
    display_name,
    completed,
    CASE
      WHEN last_raised_at IS NULL THEN NULL
      ELSE to_char(last_raised_at, 'YYYY-MM-DD HH24:MI')
    END AS last_raised_at
  FROM user_done
  WHERE completed > 0
  ORDER BY completed DESC, username ASC
`
      : await sql<ProgressUserRow>`
        WITH first_perfect AS (
          SELECT
            qa.user_id,
            qa.post_id,
            min(qa.created_at) AS first_at
          FROM quiz_attempts qa
          WHERE qa.is_perfect IS TRUE
          GROUP BY qa.user_id, qa.post_id
        ),
        first_perfect_course AS (
          SELECT fp.*
          FROM first_perfect fp
          JOIN posts p ON p.id = fp.post_id
          JOIN courses c ON c.id = p.course_id
          WHERE p.type = 'quiz'
            AND lower(c.slug) = ${course}
        ),
        user_done AS (
          SELECT
            u.id AS user_id,
            u.username,
            u.display_name,
            count(fpc.post_id)::int AS completed,
            max(fpc.first_at) AS last_raised_at
          FROM users u
          LEFT JOIN first_perfect_course fpc ON fpc.user_id = u.id
          WHERE u.user_role = 'USER'
          GROUP BY u.id, u.username, u.display_name
        )
        SELECT
          user_id,
          username,
          display_name,
          completed,
          CASE
            WHEN last_raised_at IS NULL THEN NULL
            ELSE to_char(last_raised_at, 'YYYY-MM-DD HH24:MI')
          END AS last_raised_at
        FROM user_done
        ORDER BY completed DESC, username ASC
      `;

    // ✅ detail/timeline: 기간 지정일 때만 제공(불필요한 대량 데이터 방지)
    let detail: ProgressDetailRow[] = [];
    let timelineByUser: Record<string, { day: string; cumulative: number }[]> =
      {};

    if (hasExplicitRange) {
      detail = await sql<ProgressDetailRow>`
        WITH first_perfect AS (
          SELECT
            qa.user_id,
            qa.post_id,
            min(qa.created_at) as first_at
          FROM quiz_attempts qa
          WHERE qa.is_perfect IS TRUE
          GROUP BY qa.user_id, qa.post_id
        )
        SELECT
          u.username,
          u.display_name,
          p.id as post_id,
          p.title,
          to_char(fp.first_at, 'YYYY-MM-DD HH24:MI') as first_at,
          c.slug as course_slug
        FROM first_perfect fp
        JOIN users u ON u.id = fp.user_id
        JOIN posts p ON p.id = fp.post_id
        JOIN courses c ON c.id = p.course_id
        WHERE u.user_role = 'USER'
          AND p.type = 'quiz'
          AND lower(c.slug) = ${course}
          AND fp.first_at::date BETWEEN ${qFrom!}::date AND ${qTo!}::date
        ORDER BY fp.first_at DESC
        LIMIT 300
      `;

      const tl = await sql<TimelineRow>`
        WITH first_perfect AS (
          SELECT
            qa.user_id,
            qa.post_id,
            min(qa.created_at) as first_at
          FROM quiz_attempts qa
          WHERE qa.is_perfect IS TRUE
          GROUP BY qa.user_id, qa.post_id
        ),
        daily AS (
          SELECT
            u.username,
            fp.first_at::date as d,
            count(*)::int as cnt
          FROM first_perfect fp
          JOIN users u ON u.id = fp.user_id
          JOIN posts p ON p.id = fp.post_id
          JOIN courses c ON c.id = p.course_id
          WHERE u.user_role = 'USER'
            AND p.type = 'quiz'
            AND lower(c.slug) = ${course}
            AND fp.first_at::date BETWEEN ${qFrom!}::date AND ${qTo!}::date
          GROUP BY u.username, fp.first_at::date
        )
        SELECT
          username,
          to_char(d, 'YYYY-MM-DD') as day,
          cnt
        FROM daily
        ORDER BY username ASC, d ASC
      `;

      const running: Record<string, number> = {};
      for (const row of tl) {
        if (!timelineByUser[row.username]) timelineByUser[row.username] = [];
        if (running[row.username] == null) running[row.username] = 0;
        running[row.username] += row.cnt;
        timelineByUser[row.username].push({
          day: row.day,
          cumulative: running[row.username],
        });
      }
    }

    return NextResponse.json({
      course,
      range: hasExplicitRange ? { from: qFrom!, to: qTo! } : null,
      total,
      users,
      detail,
      timelineByUser,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        message: "ADMIN_PROGRESS_FAILED",
        pg: {
          code: e?.code,
          message: e?.message,
          detail: e?.detail,
          hint: e?.hint,
          where: e?.where,
        },
      },
      { status: 500 },
    );
  }
}
