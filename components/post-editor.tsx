"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
  const [content, setContent] = useState<string>("") // ✅ 기본 텍스트(글작성) 같은 거 없음
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
        // ✅ 실패 이유를 바로 보여줌(403이면 ADMIN/env 문제 가능)
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
      // ✅ 마크다운이 싫으면 그냥 URL을 넣어도 되지만, 지금 상세가 마크다운 렌더링이라 이게 제일 깔끔
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
        <CardHeader className="flex flex-row items-center justify-between">
          {/* ✅ “글작성” 텍스트 제거: 타이틀 안 둠 */}
          <div className="text-sm text-muted-foreground">
            마크다운/텍스트로 작성하면 상세페이지에서 보기 좋게 렌더링됩니다.
          </div>

          <div className="flex items-center gap-2">
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
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 제목 */}
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">제목</div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: Java 기초 문법"
            />
          </div>

          {/* ✅ 과목/난이도: 라벨+드롭다운 나란히 / 난이도는 오른쪽 끝 */}
          <div className="grid gap-3 sm:grid-cols-2 items-center">
            {/* 과목 */}
            <div className="flex items-center gap-3">
              <div className="w-12 text-sm text-muted-foreground">과목</div>
              <div className="flex-1">
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

            {/* 난이도 (맨 오른쪽 정렬) */}
            <div className="flex items-center gap-3 justify-end">
              <div className="w-12 text-sm text-muted-foreground text-right">난이도</div>
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

          <Tabs defaultValue="edit" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="edit">편집</TabsTrigger>
              <TabsTrigger value="preview">미리보기</TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="space-y-2">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[520px] font-mono"
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
        <CardHeader>
          <div className="text-sm font-medium">실시간 미리보기</div>
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
