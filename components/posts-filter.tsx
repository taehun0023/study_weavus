// components/posts-filter.tsx
"use client"

import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function PostsFilter({ currentCourse }: { currentCourse: string }) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-3">
      <div className="w-48">
        <Select
          value={currentCourse}
          onValueChange={(v) => {
            router.replace(`/posts?course=${encodeURIComponent(v)}`)
            router.refresh()
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="과목 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="java">Java</SelectItem>
            {/* 필요하면 추가 */}
            {/* <SelectItem value="spring">Spring</SelectItem> */}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
