// app/api/interviews/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

type InterviewRow = {
  id: number;
  title: string;
  content: string;
  created_at: string;
};

async function ensureInterviewsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS interviews (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function GET() {
  await ensureInterviewsTable();

  const rows = await pool.query<InterviewRow>(`
    SELECT id, title, content, created_at
    FROM public.interviews
    ORDER BY created_at DESC
  `);

  return NextResponse.json({ interviews: rows.rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (user.user_role !== "ADMIN")
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  await ensureInterviewsTable();

  const body = (await req.json().catch(() => ({}))) as Partial<{
    title: string;
    content: string;
  }>;

  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "");

  if (!title) {
    return NextResponse.json({ message: "Title required" }, { status: 400 });
  }

  const inserted = await pool.query<{ id: number }>(
    `
      INSERT INTO public.interviews (title, content)
      VALUES ($1, $2)
      RETURNING id
    `,
    [title, content]
  );

  return NextResponse.json({ interviewId: inserted.rows[0]?.id });
}
