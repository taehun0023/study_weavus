// components/posts-filter.tsx
"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

interface PostsFilterProps {
  currentCourse: string
  currentType: string
}

export function PostsFilter({
  currentCourse,
  currentType,
}: PostsFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function setType(type: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("course", currentCourse)
    params.set("type", type)
    router.push(`/posts?${params.toString()}`)
  }

  return (
    <div className="flex gap-2">
      {[
        { key: "all", label: "전체" },
        { key: "lesson", label: "수업내용" },
        { key: "quiz", label: "문제풀이" },
        { key: "reference", label: "참고자료" },
      ].map((t) => (
        <Button
          key={t.key}
          variant={currentType === t.key ? "default" : "secondary"}
          onClick={() => setType(t.key)}
        >
          {t.label}
        </Button>
      ))}
    </div>
  )
}
