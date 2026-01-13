"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

type Course = { id: number; name: string; slug: string }
type Difficulty = "easy" | "medium" | "project"

export default function PostEditor({
  courses,
  onSubmit,
}: {
  courses: Course[]
  onSubmit: (payload: {
    title: string
    courseId: number
    difficulty: Difficulty
    content: string
  }) => Promise<void>
}) {
  const safeCourses = Array.isArray(courses) ? courses : []
  const initialCourseId = safeCourses[0]?.id ?? 0

  const [title, setTitle] = useState("")
  const [courseId, setCourseId] = useState<number>(initialCourseId)
  const [difficulty, setDifficulty] = useState<Difficulty>("easy")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<null | "image" | "file">(null)

  const imgRef = useRef<HTMLInputElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  async function uploadAndInsert(kind: "image" | "file", file: File) {
    setUploading(kind)
    try {
      const fd = new FormData()
      fd.append("file", file)

      const res = await fetch("/api/uploads", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({} as any))

      if (!res.ok) {
        alert(data?.message ?? `Upload failed (${res.status})`)
        return
      }

      const url = data?.url as string | undefined
      if (!url) {
        alert("Upload succeeded but no url was returned from /api/uploads")
        return
      }

      const name = (data?.filename as string) || file.name
      const snippet = kind === "image" ? `\n\n![${name}](${url})\n` : `\n\n[${name}](${url})\n`

      setContent((prev) => (prev ? prev + snippet : snippet.trimStart()))
    } finally {
      setUploading(null)
    }
  }

  async function handleSave() {
    const t = title.trim()
    if (!t) return alert("제목을 입력하세요.")
    if (!courseId) return alert("과목을 선택하세요.")

    setSaving(true)
    try {
      await onSubmit({ title: t, courseId, difficulty, content })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6 space-y-4">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">제목</div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: Java 기초 문법" />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">과목</div>
            <div className="w-[160px]">
              <Select
                value={String(courseId)}
                onValueChange={(v) => setCourseId(Number(v))}
                disabled={safeCourses.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={safeCourses.length ? "선택" : "과목 없음"} />
                </SelectTrigger>
                <SelectContent>
                  {safeCourses.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">난이도</div>
            <div className="w-[140px]">
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">easy</SelectItem>
                  <SelectItem value="medium">medium</SelectItem>
                  <SelectItem value="project">project</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={imgRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) uploadAndInsert("image", f)
                e.currentTarget.value = ""
              }}
            />
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) uploadAndInsert("file", f)
                e.currentTarget.value = ""
              }}
            />

            <Button
              variant="secondary"
              onClick={() => imgRef.current?.click()}
              disabled={uploading !== null}
            >
              {uploading === "image" ? "업로드 중..." : "이미지 첨부"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => fileRef.current?.click()}
              disabled={uploading !== null}
            >
              {uploading === "file" ? "업로드 중..." : "파일 첨부"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">내용</div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[520px]"
            placeholder=""
          />
        </div>

        <Button className="w-full" onClick={handleSave} disabled={saving || uploading !== null}>
          {saving ? "저장 중..." : "저장하기"}
        </Button>
      </CardContent>
    </Card>
  )
}
