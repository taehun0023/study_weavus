"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import Underline from "@tiptap/extension-underline"

type Course = { id: number; name: string; slug: string }
type Difficulty = "easy" | "medium" | "project"

export default function PostEditor({
  courses,
  initial,
  onSubmit,
}: {
  courses: Course[]
  initial?: {
    title: string
    courseId: number
    difficulty: Difficulty
    content: string
  }
  onSubmit?: (payload: {
    title: string
    courseId: number
    difficulty: Difficulty
    content: string
  }) => Promise<void>
}) {
  const router = useRouter()

  const safeCourses = Array.isArray(courses) ? courses : []
  const initialCourseId = initial?.courseId ?? safeCourses[0]?.id ?? 0

  const [title, setTitle] = useState(initial?.title ?? "")
  const [courseId, setCourseId] = useState<number>(initialCourseId)
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? "easy")
  const [content, setContent] = useState<string>(initial?.content ?? "")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<null | "image" | "file">(null)

  const imgRef = useRef<HTMLInputElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { rel: "noreferrer", target: "_blank" },
      }),
      Placeholder.configure({
        placeholder: "",
      }),
    ],
    content: initial?.content ?? "",
    editorProps: {
      attributes: {
        class:
          "min-h-[520px] rounded-md border border-border bg-background/40 p-4 outline-none prose prose-invert max-w-none",
      },
    },
    onUpdate: ({ editor }) => {
      setContent(editor.getHTML())
    },
  })

  // ✅ initial이 바뀌었을 때(편집페이지) 에디터에도 주입
  useEffect(() => {
    if (!editor) return
    if (initial?.content != null) editor.commands.setContent(initial.content)
  }, [editor, initial?.content])

  const canSubmit = useMemo(() => {
    return title.trim().length > 0 && courseId !== 0 && !saving && uploading === null
  }, [title, courseId, saving, uploading])

  async function uploadAndInsert(kind: "image" | "file", file: File) {
    if (!editor) return
    setUploading(kind)
    try {
      const fd = new FormData()
      fd.append("file", file)

      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({} as any))

      if (!res.ok) {
        alert(data?.message ?? `Upload failed (${res.status})`)
        return
      }

      const url = data?.url as string | undefined
      const name = (data?.filename as string) || file.name

      if (!url) {
        alert("Upload succeeded but no url was returned from /api/upload")
        return
      }

      if (kind === "image") {
        editor.chain().focus().setImage({ src: url, alt: name }).run()
      } else {
        editor
          .chain()
          .focus()
          .insertContent(
            `<p><a href="${escapeHtmlAttr(url)}" target="_blank" rel="noreferrer">${escapeHtmlText(
              name
            )}</a></p>`
          )
          .run()
      }
    } finally {
      setUploading(null)
    }
  }

  async function defaultSubmit(payload: {
    title: string
    courseId: number
    difficulty: Difficulty
    content: string
  }) {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: payload.title,
        courseId: payload.courseId,
        difficulty: payload.difficulty,
        content: payload.content,
        type: "lesson",
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(data?.message ?? `저장 실패 (${res.status})`)
      return
    }
    const id = data?.id
    router.push(id ? `/posts/${id}` : "/posts")
    router.refresh()
  }

  async function handleSave() {
    const t = title.trim()
    if (!t) return alert("제목을 입력하세요.")
    if (!courseId) return alert("과목을 선택하세요.")

    const html = editor?.getHTML?.() ?? content

    setSaving(true)
    try {
      if (onSubmit) {
        await onSubmit({ title: t, courseId, difficulty, content: html })
      } else {
        await defaultSubmit({ title: t, courseId, difficulty, content: html })
      }
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
              <Select value={String(courseId)} onValueChange={(v) => setCourseId(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
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

            <Button type="button" variant="secondary" onClick={() => imgRef.current?.click()} disabled={uploading !== null}>
              {uploading === "image" ? "업로드 중..." : "이미지 첨부"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading !== null}>
              {uploading === "file" ? "업로드 중..." : "파일 첨부"}
            </Button>
          </div>
        </div>

        <div>{editor ? <EditorContent editor={editor} /> : null}</div>

        <Button className="w-full" onClick={handleSave} disabled={!canSubmit}>
          {saving ? "저장 중..." : "저장하기"}
        </Button>
      </CardContent>
    </Card>
  )
}

function escapeHtmlText(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}
function escapeHtmlAttr(s: string) {
  return escapeHtmlText(s)
}
