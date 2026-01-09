// app/api/health/db/route.ts
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const runtime = "nodejs" // ✅ pg는 node 런타임 고정 추천

export async function GET() {
  try {
    const r = await sql<{ now: string }>`select now()::text as now`
    return NextResponse.json({ ok: true, now: r[0]?.now })
  } catch (e: any) {
    console.error("[DB_HEALTH_ERROR]", e)
    return NextResponse.json(
      {
        ok: false,
        message: e?.message ?? "DB error",
      },
      { status: 500 }
    )
  }
}
