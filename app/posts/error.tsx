// app/posts/error.tsx
"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function PostsError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("[POSTS_ROUTE_ERROR]", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-4 text-center">
        <h1 className="text-2xl font-bold">페이지 오류</h1>
        <p className="text-muted-foreground">
          게시글 페이지를 여는 중 문제가 발생했습니다.
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => reset()}>다시 시도</Button>
          <Button variant="outline" onClick={() => (location.href = "/")}>
            메인으로
          </Button>
        </div>
      </div>
    </div>
  )
}
