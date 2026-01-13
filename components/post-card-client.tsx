"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import PostAdminActions from "@/components/post-admin-actions"

type Difficulty = "easy" | "medium" | "hard" | "project" | null

function normalizedDifficulty(d: Difficulty): "easy" | "medium" | "project" | null {
  if (!d) return null
  if (d === "hard" || d === "project") return "project"
  if (d === "easy") return "easy"
  if (d === "medium") return "medium"
  return null
}

function difficultyLabel(d: Difficulty) {
  if (!d) return ""
  return d === "hard" ? "project" : d
}

function difficultyClass(d: Difficulty) {
  const nd = normalizedDifficulty(d)
  if (nd === "easy") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
  if (nd === "medium") return "bg-yellow-500/15 text-yellow-200 border-yellow-500/30"
  if (nd === "project") return "bg-sky-500/15 text-sky-200 border-sky-500/30"
  return ""
}

export default function PostCardClient({
  postId,
  title,
  difficulty,
  courseName,
  isAdmin,
  returnHref,
}: {
  postId: string
  title: string
  difficulty: Difficulty
  courseName: string
  isAdmin: boolean
  returnHref: string
}) {
  const router = useRouter()

  const goDetail = () => {
    router.push(`/posts/${postId}`)
  }

  return (
    <Card
      className="relative cursor-pointer hover:bg-muted/20 transition"
      onClick={(e) => {
        // 버튼 클릭이면 카드 이동 막기
        const target = e.target as HTMLElement
        if (target.closest("[data-admin-actions='true']")) return
        goDetail()
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") goDetail()
      }}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">수업내용</Badge>
            {difficulty && (
              <Badge variant="outline" className={difficultyClass(difficulty)}>
                {difficultyLabel(difficulty)}
              </Badge>
            )}
          </div>

          {isAdmin && (
            <div data-admin-actions="true" className="relative z-20">
              <PostAdminActions
                postId={postId}
                editHref={`/posts/${postId}/edit`}
                afterDeleteHref={returnHref}
                size="sm"
              />
            </div>
          )}
        </div>

        <CardTitle className="mt-2">{title}</CardTitle>
      </CardHeader>

      <CardContent className="text-sm text-muted-foreground">
        과목: {courseName}
      </CardContent>
    </Card>
  )
}
