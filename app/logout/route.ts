import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// /logout 으로 GET 들어오면: 쿠키만 즉시 제거하고 /login으로 보냄
export async function GET(req: Request) {
  const cookieStore = await cookies();

  // 세션 쿠키 즉시 제거 (DB 작업 기다리지 않음)
  cookieStore.set("session_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  const url = new URL("/login", req.url);
  return NextResponse.redirect(url);
}

// (선택) POST로 와도 동일하게 처리하고 싶으면 유지
export async function POST(req: Request) {
  return GET(req);
}
