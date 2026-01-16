import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

function isValidISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function toISODateOnly(dt: Date) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDefaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  return { from: toISODateOnly(from), to: toISODateOnly(to) };
}

export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (me.user_role !== "ADMIN")
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const qFrom = searchParams.get("from");
  const qTo = searchParams.get("to");

  let fromDate: string;
  let toDate: string;

  if (qFrom || qTo) {
    if (!qFrom || !qTo) {
      return NextResponse.json(
        { message: "from/to must be both provided or both omitted" },
        { status: 400 }
      );
    }
    if (!isValidISODate(qFrom) || !isValidISODate(qTo)) {
      return NextResponse.json(
        { message: "from/to must be YYYY-MM-DD" },
        { status: 400 }
      );
    }
    fromDate = qFrom;
    toDate = qTo;
  } else {
    const def = getDefaultRange();
    fromDate = def.from;
    toDate = def.to;
  }

  const rows = await sql`
    WITH days AS (
      SELECT d::date AS day
      FROM generate_series(${fromDate}::date, ${toDate}::date, interval '1 day') AS d
    ),
    target_users AS (
      SELECT id, username, display_name
      FROM public.users
      WHERE user_role = 'USER'
    ),
    agg AS (
      SELECT
        qa.user_id,
        qa.created_at::date AS day,
        COUNT(*)::int AS perfect_count
      FROM public.quiz_attempts qa
      JOIN target_users u ON u.id = qa.user_id
      WHERE qa.score = 100
        AND qa.created_at::date BETWEEN ${fromDate}::date AND ${toDate}::date
      GROUP BY qa.user_id, qa.created_at::date
    )
    SELECT
      u.id AS user_id,
      u.username,
      u.display_name,
      to_char(d.day, 'YYYY-MM-DD') AS day,
      COALESCE(a.perfect_count, 0)::int AS perfect_count
    FROM target_users u
    CROSS JOIN days d
    LEFT JOIN agg a
      ON a.user_id = u.id AND a.day = d.day
    ORDER BY u.id ASC, d.day ASC
  `;

  return NextResponse.json({ rows, range: { from: fromDate, to: toDate } });
}
