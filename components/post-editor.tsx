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

function isImageFile(file: File) {
  return file.type.startsWith("image/")
}

export default function PostEditor({ courses }: { courses: Course[] }) {
  const router = useRouter()
  const defaultCourseId = useMemo(() => courses?.[0]?.id?.toString() ?? "", [courses])

  const [title, setTitle] = useState("")
  const [courseId, setCourseId] = useState(defaultCourseId)
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "project">("easy")
  const [content, setContent] = useState<string>(
    `# 제목\n\n- 여기에 내용을 작성하세요.\n\n## 코드\n\n\`\`\`java\npublic class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello");\n  }\n}\n\`\`\`\n`
  )
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  function insertAtCursor(text: string) {
    setContent((prev) => prev + (prev.endsWith("\n") ? "" : "\n") + text + "\n")
  }

  async function uploadFile(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)

      const res = await fetch("/api/upload", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? "Upload failed")

      return { url: data.url as string, filename: data.filename as string }
    } finally {
      setUploading(false)
    }
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!isImageFile(file)) {
      alert("이미지 파일만 선택하세요.")
      return
    }

    const { url, filename } = await uploadFile(file)
    insertAtCursor(`![${filename}](${url})`)
  }

  async function onPickAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    const { url, filename } = await uploadFile(file)
    insertAtCursor(`[${filename}](${url})`)
  }

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
          type: "lesson",
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>글 작성</CardTitle>

          <div className="flex items-center gap-2">
            {/* 이미지 업로드 */}
            <label>
              <input
                type="file"
                accept="image/*"
                onChange={onPickImage}
                className="hidden"
                disabled={uploading || loading}
              />
              <Button type="button" variant="secondary" size="sm" disabled={uploading || loading}>
                {uploading ? "업로드..." : "이미지 첨부"}
              </Button>
            </label>

            {/* 파일 업로드 */}
            <label>
              <input
                type="file"
                onChange={onPickAttachment}
                className="hidden"
                disabled={uploading || loading}
              />
              <Button type="button" variant="outline" size="sm" disabled={uploading || loading}>
                {uploading ? "업로드..." : "파일 첨부"}
              </Button>
            </label>
          </div>
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

          {/* ✅ “작성” 같은 불필요한 글씨 제거: 탭은 편집/미리보기만 */}
          <Tabs defaultValue="edit" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="edit">편집</TabsTrigger>
              <TabsTrigger value="preview">미리보기</TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="space-y-2">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[460px] font-mono"
                placeholder="마크다운으로 작성하세요"
              />
              <div className="text-xs text-muted-foreground">
                이미지/파일 첨부 버튼을 누르면 마크다운 링크가 본문에 자동으로 들어갑니다.
              </div>
            </TabsContent>

            <TabsContent value="preview">
              <div className="prose prose-invert max-w-none rounded-md border border-border p-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            </TabsContent>
          </Tabs>

          <Button onClick={onSubmit} disabled={loading || uploading} className="w-full">
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
