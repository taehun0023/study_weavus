// app/api/interviews/[id]/route.ts
import { NextResponse } from "next/server";
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

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await ensureInterviewsTable();

  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  const r = await pool.query<InterviewRow>(
    `
      SELECT id, title, content, created_at
      FROM public.interviews
      WHERE id=$1
      LIMIT 1
    `,
    [id]
  );

  const row = r.rows[0];
  if (!row) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ interview: row });
}
