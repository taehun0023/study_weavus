"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface PostsFilterProps {
  currentCourse: string
  currentType: string
}

const typeOptions = [
  { value: "all", label: "전체" },
  { value: "lesson", label: "수업내용" },
  { value: "quiz", label: "문제풀이" },
  { value: "reference", label: "참고자료" },
]

export function PostsFilter({ currentCourse, currentType }: PostsFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`/posts?${params.toString()}`)
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <Select value={currentCourse} onValueChange={(value) => updateFilter("course", value)}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="과목 선택" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="java">Java</SelectItem>
        </SelectContent>
      </Select>

      <Tabs value={currentType} onValueChange={(value) => updateFilter("type", value)}>
        <TabsList className="grid w-full grid-cols-4 sm:w-auto">
          {typeOptions.map((option) => (
            <TabsTrigger key={option.value} value={option.value} className="text-sm">
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
