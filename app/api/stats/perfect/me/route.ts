import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

type Point = { date: string; count: number };

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
  from.setDate(to.getDate() - 29); // 오늘 포함 30일
  return { from: toISODateOnly(from), to: toISODateOnly(to) };
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const qFrom = searchParams.get("from");
  const qTo = searchParams.get("to");

  let fromDate: string;
  let toDate: string;

  if (qFrom || qTo) {
    if (!qFrom || !qTo) {
      return NextResponse.json(
        { error: "from/to must be both provided or both omitted" },
        { status: 400 }
      );
    }
    if (!isValidISODate(qFrom) || !isValidISODate(qTo)) {
      return NextResponse.json(
        { error: "from/to must be YYYY-MM-DD" },
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

  const rows = await sql<Point>`
    WITH days AS (
      SELECT d::date AS d
      FROM generate_series(${fromDate}::date, ${toDate}::date, interval '1 day') AS d
    )
    SELECT
      to_char(days.d, 'YYYY-MM-DD') AS date,
      COALESCE(COUNT(a.id), 0)::int AS count
    FROM days
    LEFT JOIN public.quiz_attempts a
      ON a.user_id = ${user.id}
      AND a.is_perfect = true
      AND a.created_at::date = days.d
    GROUP BY days.d
    ORDER BY days.d
  `;

  const hasAnyPerfect = rows.some((r) => r.count > 0);
  return NextResponse.json({
    points: rows,
    hasAnyPerfect,
    range: { from: fromDate, to: toDate },
  });
}
