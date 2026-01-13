"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Card, CardContent } from "@/components/ui/card"
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
  const [content, setContent] = useState<string>("") // ✅ 기본 텍스트 없음
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function appendToContent(text: string) {
    setContent((prev) => {
      const next = prev ? (prev.endsWith("\n") ? prev : prev + "\n") : ""
      return next + text + "\n"
    })
  }

  async function uploadFile(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)

      const res = await fetch("/api/upload", { method: "POST", body: form })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        // ✅ 실패 사유를 그대로 보여주기
        throw new Error(data?.message || `Upload failed (${res.status})`)
      }

      return { url: data.url as string, filename: data.filename as string }
    } finally {
      setUploading(false)
    }
  }

  async function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!isImageFile(file)) return alert("이미지 파일만 선택하세요.")

    try {
      const { url, filename } = await uploadFile(file)
      appendToContent(`![${filename}](${url})`)
    } catch (err: any) {
      alert(err?.message ?? "이미지 업로드 실패")
    }
  }

  async function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    try {
      const { url, filename } = await uploadFile(file)
      appendToContent(`[${filename}](${url})`)
    } catch (err: any) {
      alert(err?.message ?? "파일 업로드 실패")
    }
  }

  async function onSubmit() {
    if (!title.trim()) return alert("제목을 입력하세요.")
    if (!courseId) return alert("과목을 선택하세요.")
    if (!content.trim()) return alert("내용을 입력하세요.")

    setLoading(true)
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          courseId: Number(courseId),
          type: "lesson",
          // DB가 hard를 쓰는 경우를 고려
          difficulty: difficulty === "project" ? "hard" : difficulty,
          content,
        }),
      })

      const data = await res.json().catch(() => ({}))
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
        <CardContent className="space-y-4 pt-6">
          {/* 제목 */}
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">제목</div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: Java 기초 문법"
            />
          </div>

          {/* 과목/난이도 (라벨-드롭다운 간격 좁힘) */}
          <div className="grid gap-3 sm:grid-cols-2 items-center">
            {/* 과목 */}
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">과목</div>
              <div className="w-[180px]">
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
            </div>

            {/* 난이도 (오른쪽 끝) */}
            <div className="flex items-center gap-2 justify-end">
              <div className="text-sm text-muted-foreground">난이도</div>
              <div className="w-[160px]">
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
          </div>

          {/* ✅ 버튼 내리기: 과목/난이도 아래 */}
          <div className="flex justify-end gap-2">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handlePickImage}
              className="hidden"
              disabled={uploading || loading}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading || loading}
            >
              {uploading ? "업로드..." : "이미지 첨부"}
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              onChange={handlePickFile}
              className="hidden"
              disabled={uploading || loading}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || loading}
            >
              {uploading ? "업로드..." : "파일 첨부"}
            </Button>
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
                className="min-h-[520px]"
                placeholder="여기에 내용을 작성하세요. (이미지/파일 첨부 버튼을 누르면 링크가 자동으로 들어갑니다)"
              />
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

      {/* 미리보기 */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="text-sm font-medium mb-3">실시간 미리보기</div>
          <div className="prose prose-invert max-w-none rounded-md border border-border p-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
