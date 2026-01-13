// components/posts-filter.tsx
"use client"

import { useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type CourseOption = {
  name: string
  slug: string
}

interface PostsFilterProps {
  courses: CourseOption[]
  currentCourse: string
  currentDifficulty: string
}

export function PostsFilter({
  courses,
  currentCourse,
  currentDifficulty,
}: PostsFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const courseOptions = useMemo(() => {
    if (!courses || courses.length === 0) return [{ slug: "java", name: "Java" }]
    return courses
  }, [courses])

  function push(next: { course?: string; difficulty?: string }) {
    const params = new URLSearchParams(searchParams.toString())

    const course = next.course ?? params.get("course") ?? currentCourse ?? "java"
    params.set("course", course)

    const diff =
      next.difficulty ??
      params.get("difficulty") ??
      currentDifficulty ??
      "all"

    if (!diff || diff === "all") params.delete("difficulty")
    else params.set("difficulty", diff)

    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Select value={currentCourse} onValueChange={(v) => push({ course: v })}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="과목 선택" />
        </SelectTrigger>
        <SelectContent>
          {courseOptions.map((c) => (
            <SelectItem key={c.slug} value={c.slug}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ToggleGroup
        type="single"
        value={currentDifficulty}
        onValueChange={(v) => push({ difficulty: v || "all" })}
        variant="outline"
        className="grid w-full grid-cols-4 sm:w-auto"
      >
        <ToggleGroupItem value="all" className="text-sm">
          전체
        </ToggleGroupItem>
        <ToggleGroupItem value="easy" className="text-sm">
          easy
        </ToggleGroupItem>
        <ToggleGroupItem value="medium" className="text-sm">
          medium
        </ToggleGroupItem>
        <ToggleGroupItem value="project" className="text-sm">
          project
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
