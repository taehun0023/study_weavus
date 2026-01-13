"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Course = { id: number; name: string; slug: string }

export default function PostEditor({ courses }: { courses: Course[] }) {
  const router = useRouter()

  const defaultCourseId = useMemo(() => courses?.[0]?.id?.toString() ?? "", [courses])

  const [title, setTitle] = useState("")
  const [courseId, setCourseId] = useState(defaultCourseId)
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "project">("easy")
  const [content, setContent] = useState(`# 제목\n\n- 여기에 내용을 작성하세요.\n\n## 코드\n\n\`\`\`java\npublic class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello");\n  }\n}\n\`\`\`\n`)
  const [loading, setLoading] = useState(false)

  async function onSubmit() {
    if (!title.trim()) return alert("제목을 입력하세요.")
    if (!courseId) return alert("과목을 선택하세요.")

    setLoading(true)
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          courseId: Number(courseId),
          // ✅ 일람은 수업내용만 보이게 할 거라 기본 type=lesson
          type: "lesson",
          // ✅ DB에 hard가 이미 쓰이고 있으면 project는 hard로 저장해도 됨
          difficulty: difficulty === "project" ? "hard" : difficulty,
          content,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data?.message ?? "저장 실패")
        return
      }

      router.push(`/posts/${data.id}`)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>작성</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">제목</div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: Java 기초 문법" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">과목</div>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder="과목 선택" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">난이도</div>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="난이도 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">easy</SelectItem>
                  <SelectItem value="medium">medium</SelectItem>
                  <SelectItem value="project">project</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs defaultValue="edit" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="edit">편집</TabsTrigger>
              <TabsTrigger value="preview">미리보기</TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="space-y-2">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[420px] font-mono"
                placeholder="마크다운으로 작성하세요"
              />
              <div className="text-xs text-muted-foreground">
                팁: 제목은 `#`, 소제목은 `##`, 코드블록은 ```java 처럼 작성
              </div>
            </TabsContent>

            <TabsContent value="preview">
              <div className="prose prose-invert max-w-none rounded-md border border-border p-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            </TabsContent>
          </Tabs>

          <Button onClick={onSubmit} disabled={loading} className="w-full">
            {loading ? "저장 중..." : "저장하기"}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>실시간 미리보기</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-invert max-w-none rounded-md border border-border p-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
