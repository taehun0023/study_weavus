import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ensureAssistantChatLogsTable } from "@/lib/assistant-chat-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.user_role !== "ADMIN") return null;
  return user;
}

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureAssistantChatLogsTable();
    const format = (req.nextUrl.searchParams.get("format") || "json").toLowerCase();
    const limit = Number(req.nextUrl.searchParams.get("limit") || 200);
    const safeLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(5000, Math.trunc(limit)))
      : 200;

    const rows = await sql<{
      id: number;
      user_id: number;
      username: string;
      display_name: string;
      question: string;
      answer: string;
      mode: string;
      created_at: string;
    }>`
      SELECT l.id, l.user_id, u.username, u.display_name, l.question, l.answer, l.mode, l.created_at
      FROM public.assistant_chat_logs l
      JOIN public.users u ON u.id = l.user_id
      ORDER BY l.id DESC
      LIMIT ${safeLimit}
    `;

    if (format === "csv") {
      const header = [
        "id",
        "created_at",
        "user_id",
        "username",
        "display_name",
        "mode",
        "question",
        "answer",
      ].join(",");

      const lines = rows.map((r) =>
        [
          r.id,
          r.created_at,
          r.user_id,
          r.username,
          r.display_name,
          r.mode,
          r.question,
          r.answer,
        ]
          .map(csvEscape)
          .join(","),
      );

      const csv = [header, ...lines].join("\n");
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="assistant-chat-logs.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Failed to load chat logs" },
      { status: 500 },
    );
  }
}
